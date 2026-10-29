import {
  GST_STATES, blankHostGst, defaultGstSettings, isGstin, stateCodeOf, stateName, supplierFor, taxLines,
  type GstSettings, type Invoice, type Me,
} from '@meridian/shared'
import { bookingsRepo, hostTaxRepo, invoicesRepo, propertiesRepo, usersRepo } from '../repositories'
import { contentRepo } from '../repositories'
import { AppError, notFound } from '../http/errors'
import { collect, str } from '../http/validate'

// Tax invoices for bookings.
//
// One is raised when a booking is paid for, and a credit note when it is cancelled and refunded.
// Neither is ever recalculated: whatever the rates were on the day is what the document keeps, so
// changing a rate tomorrow cannot quietly rewrite last month's returns.

export const gstSettings = async (): Promise<GstSettings> => {
  const { gst } = await contentRepo.settings()
  return { ...defaultGstSettings, ...(gst ?? {}), slabs: gst?.slabs?.length ? gst.slabs : defaultGstSettings.slabs }
}

/** Whether the platform is set up to issue invoices at all. */
export async function invoicingReady(settings?: GstSettings) {
  const gst = settings ?? (await gstSettings())
  return gst.enabled && isGstin(gst.gstin) && !!gst.legalName && !!gst.stateCode
}

export const invoiceService = {
  settings: gstSettings,

  /**
   * Raises the invoice for a paid booking, once. Called after payment is confirmed; a booking that
   * already has one is left alone, so a repeated webhook can't produce a second document.
   */
  async forPaidBooking(bookingCode: string): Promise<Invoice | null> {
    const gst = await gstSettings()
    if (!(await invoicingReady(gst))) return null

    const existing = await invoicesRepo.forBooking(bookingCode)
    if (existing.some((i) => i.kind === 'booking')) return existing.find((i) => i.kind === 'booking')!

    const booking = await bookingsRepo.find(bookingCode)
    if (!booking) return null
    const property = await propertiesRepo.get(booking.propertyId)
    const [guest, hostGst] = await Promise.all([
      usersRepo.findById(booking.guestId),
      hostTaxRepo.find(booking.hostId),
    ])
    // The client owns the property, so their registration is the one the guest is invoiced under.
    // A client who hasn't registered falls to BookMyGetaway's, which is what the platform is there for.
    const supplier = supplierFor(gst, hostGst)

    const total = booking.totalMinor / 100
    const perNight = booking.pricePerNightMinor / 100
    const placeOfSupply = stateCodeOf(property?.region ?? '')

    return invoicesRepo.issue({
      kind: 'booking',
      bookingCode,
      hostId: booking.hostId,
      raisedBy: supplier.who,
      supplier: { legalName: supplier.legalName, gstin: supplier.gstin, address: supplier.address, stateCode: supplier.stateCode },
      recipient: {
        name: booking.guest.name,
        email: booking.guest.email ?? guest?.email ?? null,
        phone: booking.guest.phone ?? guest?.phone ?? null,
        // A guest who gave a GSTIN is claiming the tax back; most will not have one.
        gstin: null,
      },
      placeOfSupply: { stateCode: placeOfSupply, stateName: stateName(placeOfSupply) || (property?.region ?? '') },
      description: `${booking.kind === 'dayuse' ? 'Day use of ' : 'Accommodation at '}${booking.property.title}, ${booking.property.location}`
        + ` · ${booking.checkIn} to ${booking.checkOut}`,
      sac: gst.sac,
      nights: booking.nights,
      perNight,
      // Whose state decides CGST+SGST or IGST is whoever is supplying, not always BookMyGetaway.
      lines: taxLines(total, perNight, { ...gst, stateCode: supplier.stateCode }, placeOfSupply),
      against: null,
    }, gst.invoicePrefix)
  },

  /**
   * A credit note for what was actually refunded, which is rarely the whole invoice: the
   * convenience fee and whatever the cancellation policy keeps are not given back.
   */
  async creditNote(bookingCode: string, refunded: number): Promise<Invoice | null> {
    const gst = await gstSettings()
    if (!(await invoicingReady(gst)) || refunded <= 0) return null

    const raised = await invoicesRepo.forBooking(bookingCode)
    const original = raised.find((i) => i.kind === 'booking')
    if (!original) return null
    const already = raised.filter((i) => i.kind === 'cancellation').reduce((sum, i) => sum + i.lines.total, 0)
    const left = Math.round((original.lines.total - already) * 100) / 100
    if (left <= 0) return null

    const amount = Math.min(refunded, left)
    return invoicesRepo.issue({
      kind: 'cancellation',
      bookingCode,
      hostId: original.hostId,
      // A credit note is raised by whoever raised the invoice it reverses, whatever has changed since.
      raisedBy: original.raisedBy,
      supplier: original.supplier,
      recipient: original.recipient,
      placeOfSupply: original.placeOfSupply,
      description: `Refund against ${original.number} — ${original.description}`,
      sac: original.sac,
      nights: original.nights,
      perNight: original.perNight,
      // Taxed at the rate the booking was taxed at, not at today's.
      lines: taxLines(
        amount,
        original.perNight,
        { ...gst, stateCode: original.supplier.stateCode, slabs: [{ upTo: Number.MAX_SAFE_INTEGER, rate: original.lines.rate, label: '' }] },
        original.placeOfSupply.stateCode,
      ),
      against: original.number,
    }, gst.invoicePrefix)
  },

  /** Every document raised for a booking, for the guest, the host and your team. */
  forBooking: (bookingCode: string) => invoicesRepo.forBooking(bookingCode),

  /** One invoice, with a check that the person asking is entitled to see it. */
  async get(number: string, viewer: Me): Promise<Invoice> {
    const invoice = await invoicesRepo.find(number)
    if (!invoice) throw notFound('invoice')
    if (viewer.role === 'admin') return invoice
    const booking = await bookingsRepo.find(invoice.bookingCode)
    if (!booking) throw notFound('invoice')
    if (booking.guestId !== viewer.id && booking.hostId !== viewer.id) throw new AppError(403, 'That invoice isn’t yours.')
    return invoice
  },

  /**
   * A client saving their own GST registration. Checked rather than trusted: an invoice raised
   * under a wrong GSTIN is worse than one raised under BookMyGetaway's.
   */
  async saveHostGst(host: Me, body: Record<string, unknown>) {
    const gstin = str(body.gstin).trim().toUpperCase()
    const legalName = str(body.legalName).slice(0, 120)
    const stateCode = str(body.stateCode)
    const fields: Record<string, string> = {}

    // Clearing it is always allowed: a client who deregisters says so by emptying the box.
    if (!gstin && !legalName) {
      return hostTaxRepo.save(host.id, { ...blankHostGst(), updatedAt: new Date().toISOString() })
    }
    if (!isGstin(gstin)) fields.gstin = 'That is not a GSTIN. It is 15 characters, e.g. 29ABCDE1234F1Z5.'
    if (!legalName) fields.legalName = 'The name your registration is in.'
    if (!GST_STATES.some((s) => s.code === stateCode)) fields.stateCode = 'Choose the state you are registered in.'
    if (isGstin(gstin) && stateCode && gstin.slice(0, 2) !== stateCode) {
      fields.stateCode = `Your GSTIN begins ${gstin.slice(0, 2)}, which is ${stateName(gstin.slice(0, 2)) || 'another state'}.`
    }
    collect(fields)

    const existing = await hostTaxRepo.find(host.id)
    return hostTaxRepo.save(host.id, {
      gstin,
      legalName,
      stateCode,
      address: str(body.address).slice(0, 300),
      // A changed registration is a new thing for your team to look at.
      verifiedAt: existing?.gstin === gstin ? existing.verifiedAt : null,
    })
  },

  /** Your team marking a client's registration as checked. */
  async verifyHostGst(hostId: number, verified: boolean) {
    return hostTaxRepo.save(hostId, { verifiedAt: verified ? new Date().toISOString() : null })
  },

  /**
   * A guest's own tax documents, across every booking they have made. Read from their bookings
   * rather than stored against them, so a guest can never be shown a document raised for someone
   * else even if two bookings share a code by accident.
   */
  async forGuest(guestId: number, today: string) {
    const bookings = await bookingsRepo.listForGuest(guestId, today)
    const invoices = bookings.length ? await invoicesRepo.forBookings(bookings.map((b) => b.code)) : []
    const titles = new Map(bookings.map((b) => [b.code, b.property.title]))
    const sum = (rows: Invoice[]) => Math.round(rows.reduce((t, i) => t + i.lines.total, 0) * 100) / 100
    const billed = invoices.filter((i) => i.kind === 'booking')
    const credited = invoices.filter((i) => i.kind === 'cancellation')
    return {
      invoices: invoices.map((i) => ({ ...i, stayTitle: titles.get(i.bookingCode) ?? '' })),
      totals: {
        documents: invoices.length,
        billed: sum(billed),
        credited: sum(credited),
        tax: Math.round((billed.reduce((t, i) => t + i.lines.tax, 0) - credited.reduce((t, i) => t + i.lines.tax, 0)) * 100) / 100,
      },
    }
  },

  /** One client's own invoices — what they would file under their own registration. */
  async forHost(hostId: number) {
    const [all, registration] = await Promise.all([invoicesRepo.byHost(hostId), hostTaxRepo.get(hostId)])
    const mine = all.filter((i) => i.raisedBy === 'owner')
    const booked = mine.filter((i) => i.kind === 'booking')
    const credited = mine.filter((i) => i.kind === 'cancellation')
    const sum = (rows: Invoice[], pick: (i: Invoice) => number) => Math.round(rows.reduce((t, i) => t + pick(i), 0) * 100) / 100
    return {
      invoices: all,
      registration,
      /** Invoices raised under BookMyGetaway's registration because this client had none at the time. */
      raisedByPlatform: all.filter((i) => i.raisedBy === 'platform' && i.kind === 'booking').length,
      totals: {
        count: booked.length,
        taxable: Math.round((sum(booked, (i) => i.lines.taxable) - sum(credited, (i) => i.lines.taxable)) * 100) / 100,
        tax: Math.round((sum(booked, (i) => i.lines.tax) - sum(credited, (i) => i.lines.tax)) * 100) / 100,
        total: Math.round((sum(booked, (i) => i.lines.total) - sum(credited, (i) => i.lines.total)) * 100) / 100,
      },
    }
  },

  /** The register your team files from. */
  async register(filter: { financialYear?: string; month?: string }) {
    const [invoices, gst] = await Promise.all([invoicesRepo.list(filter), gstSettings()])
    const booked = invoices.filter((i) => i.kind === 'booking')
    const credited = invoices.filter((i) => i.kind === 'cancellation')
    const sum = (rows: Invoice[], pick: (i: Invoice) => number) => Math.round(rows.reduce((t, i) => t + pick(i), 0) * 100) / 100
    return {
      invoices,
      ready: await invoicingReady(gst),
      totals: {
        count: booked.length,
        credits: credited.length,
        taxable: Math.round((sum(booked, (i) => i.lines.taxable) - sum(credited, (i) => i.lines.taxable)) * 100) / 100,
        cgst: Math.round((sum(booked, (i) => i.lines.cgst) - sum(credited, (i) => i.lines.cgst)) * 100) / 100,
        sgst: Math.round((sum(booked, (i) => i.lines.sgst) - sum(credited, (i) => i.lines.sgst)) * 100) / 100,
        igst: Math.round((sum(booked, (i) => i.lines.igst) - sum(credited, (i) => i.lines.igst)) * 100) / 100,
        total: Math.round((sum(booked, (i) => i.lines.total) - sum(credited, (i) => i.lines.total)) * 100) / 100,
      },
    }
  },
}
