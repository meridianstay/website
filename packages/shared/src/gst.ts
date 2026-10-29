// GST on a booking.
//
// Indian accommodation is taxed by what a unit costs per day: at the time of writing, 5% up to
// ₹7,500 a night and 18% above it (the two-slab structure from 22 September 2025, which replaced
// the old 12% band). Those numbers are settings rather than constants, because rates move and only
// the client's accountant can say which applies to them.
//
// Place of supply for accommodation is where the property is, so a stay in the same state as the
// registered business is CGST + SGST, and one in another state is IGST.

export interface GstSlab {
  /** Up to and including this much per night, in rupees. The last slab uses Infinity. */
  upTo: number
  /** Percent. */
  rate: number
  label: string
}

export interface GstSettings {
  /** Off until the business is registered and the details below are filled in. */
  enabled: boolean
  /** 15 characters, e.g. 29ABCDE1234F1Z5. */
  gstin: string
  /** The name GST is registered under, which may differ from the brand. */
  legalName: string
  address: string
  /** The state the business is registered in — the other half of deciding CGST+SGST or IGST. */
  stateCode: string
  /** Services Accounting Code for accommodation. 996311 is hotel and guest-house lodging. */
  sac: string
  /**
   * What Book My Get Away's own services to a client are taxed at — the commission on a booking and the
   * yearly plan. Services are 18% as a rule, but it is a setting like everything else here.
   */
  serviceRate: number
  /** SAC for what Book My Get Away supplies. 998599 is other support services. */
  serviceSac: string
  /** What invoice numbers look like, e.g. BMG/26-27/0001. */
  invoicePrefix: string
  /**
   * True when the price a guest sees already contains the tax, which is how this platform charges:
   * the tax is worked back out of what was collected rather than added on top of it.
   */
  pricesIncludeTax: boolean
  slabs: GstSlab[]
  /**
   * Who the law treats as supplying the stay.
   *
   * `owner` — the usual arrangement, and the default: the client owns the property, so a client
   * who is GST-registered invoices the guest under their own registration. A client who is not
   * registered falls to Book My Get Away, which is what an e-commerce operator is for.
   *
   * `platform` — Book My Get Away invoices for every stay, whatever the client's registration. Only set
   * this if an accountant has told you to.
   */
  supplier: 'owner' | 'platform'
}

export const defaultGstSettings: GstSettings = {
  enabled: false,
  gstin: '',
  legalName: '',
  address: '',
  stateCode: '',
  sac: '996311',
  serviceRate: 18,
  serviceSac: '998599',
  invoicePrefix: 'BMG',
  pricesIncludeTax: true,
  slabs: [
    { upTo: 7500, rate: 5, label: 'Up to ₹7,500 a night' },
    { upTo: Number.MAX_SAFE_INTEGER, rate: 18, label: 'Above ₹7,500 a night' },
  ],
  supplier: 'owner',
}

/** The state codes GST uses, which are the first two digits of every GSTIN. */
export const GST_STATES: { code: string; name: string }[] = [
  { code: '01', name: 'Jammu and Kashmir' }, { code: '02', name: 'Himachal Pradesh' }, { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' }, { code: '05', name: 'Uttarakhand' }, { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' }, { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' }, { code: '11', name: 'Sikkim' }, { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' }, { code: '14', name: 'Manipur' }, { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' }, { code: '17', name: 'Meghalaya' }, { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' }, { code: '20', name: 'Jharkhand' }, { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' }, { code: '23', name: 'Madhya Pradesh' }, { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' }, { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' }, { code: '30', name: 'Goa' }, { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' }, { code: '33', name: 'Tamil Nadu' }, { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' }, { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' }, { code: '38', name: 'Ladakh' },
]

/** Maps the state a listing says it is in onto a GST state code. */
export function stateCodeOf(region: string): string {
  const want = region.trim().toLowerCase()
  const hit = GST_STATES.find((s) => s.name.toLowerCase() === want)
    ?? GST_STATES.find((s) => want.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(want))
  return hit?.code ?? ''
}

export const stateName = (code: string) => GST_STATES.find((s) => s.code === code)?.name ?? ''

/** 15 characters: two for the state, ten for the PAN, then an entity digit, a Z, and a check character. */
export const isGstin = (value: string) => /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value.trim().toUpperCase())

/** The rate for a night at this price. */
export function rateFor(slabs: GstSlab[], perNight: number): GstSlab {
  const sorted = [...slabs].sort((a, b) => a.upTo - b.upTo)
  return sorted.find((s) => perNight <= s.upTo) ?? sorted[sorted.length - 1]
}

export interface TaxLines {
  /** What the stay is worth before tax. */
  taxable: number
  rate: number
  cgst: number
  sgst: number
  igst: number
  tax: number
  total: number
  /** True when supplier and property are in different states. */
  interState: boolean
}

const round = (n: number) => Math.round(n * 100) / 100

/**
 * Splits an amount into what it is worth and the tax on it. With tax-inclusive pricing the tax is
 * taken out of the total; otherwise it is added to it. CGST and SGST are half the rate each, and
 * they are replaced by a single IGST when the supply crosses a state line.
 */
export function taxLines(amount: number, perNight: number, settings: GstSettings, propertyStateCode: string): TaxLines {
  const { rate } = rateFor(settings.slabs, perNight)
  const taxable = settings.pricesIncludeTax ? round(amount / (1 + rate / 100)) : round(amount)
  const tax = round(settings.pricesIncludeTax ? amount - taxable : (taxable * rate) / 100)
  const interState = !!settings.stateCode && !!propertyStateCode && settings.stateCode !== propertyStateCode
  const half = round(tax / 2)
  return {
    taxable,
    rate,
    cgst: interState ? 0 : half,
    // The halves must still add to the whole when the tax ends in an odd paisa.
    sgst: interState ? 0 : round(tax - half),
    igst: interState ? tax : 0,
    tax,
    total: round(taxable + tax),
    interState,
  }
}

/** A client's own GST registration. Theirs to fill in, and theirs to keep correct. */
export interface HostGst {
  gstin: string
  /** The name the registration is in, which is often not the name of the stay. */
  legalName: string
  address: string
  stateCode: string
  /** Set when your team has looked at it. Invoices are raised under it either way. */
  verifiedAt: string | null
  updatedAt: string
}

export const blankHostGst = (): HostGst =>
  ({ gstin: '', legalName: '', address: '', stateCode: '', verifiedAt: null, updatedAt: '' })

/** True once there is a registration good enough to raise an invoice under. */
export const hostGstReady = (gst: HostGst | null | undefined) =>
  !!gst && isGstin(gst.gstin) && !!gst.legalName && !!gst.stateCode

/**
 * Whose registration a booking is invoiced under. The client's when they have one and the settings
 * allow it, otherwise Book My Get Away's — which is how an unregistered owner's stay is still invoiced.
 */
export function supplierFor(settings: GstSettings, hostGst: HostGst | null | undefined) {
  if (settings.supplier === 'owner' && hostGstReady(hostGst)) {
    return {
      who: 'owner' as const,
      legalName: hostGst!.legalName,
      gstin: hostGst!.gstin,
      address: hostGst!.address,
      stateCode: hostGst!.stateCode,
    }
  }
  return {
    who: 'platform' as const,
    legalName: settings.legalName,
    gstin: settings.gstin,
    address: settings.address,
    stateCode: settings.stateCode,
  }
}

/**
 * booking / cancellation — what a guest is billed for a stay, by whoever owns it.
 * commission / subscription — what Book My Get Away bills a client for, where Book My Get Away is the supplier.
 */
export type InvoiceKind = 'booking' | 'cancellation' | 'commission' | 'subscription'

/** A tax invoice, kept exactly as it was issued. Nothing about one is ever recalculated. */
export interface Invoice {
  /** The number on the document, e.g. BMG/26-27/0007. Never reused, never reordered. */
  number: string
  /** Running count within the financial year, which is what the number is built from. */
  serial: number
  /** The Indian financial year it falls in, e.g. "26-27". */
  financialYear: string
  kind: InvoiceKind
  bookingCode: string
  issuedAt: string
  /** Who is supplying, copied in full so a later settings change can't alter a past invoice. */
  supplier: { legalName: string; gstin: string; address: string; stateCode: string }
  /** Whether that was the property's owner or Book My Get Away, which decides whose return it belongs in. */
  raisedBy: 'owner' | 'platform'
  /** The client whose stay it was, so a register can be split by owner. */
  hostId: number
  /** Who it is for. A guest without a GSTIN is an unregistered recipient, which is normal. */
  recipient: { name: string; email: string | null; phone: string | null; gstin: string | null }
  /** Where the supply happened, which for a stay is where the property is. */
  placeOfSupply: { stateCode: string; stateName: string }
  description: string
  sac: string
  nights: number
  perNight: number
  lines: TaxLines
  /** A credit note points back at the invoice it reverses. */
  against: string | null
  /** What a commission invoice covers, as dates. Null on anything billed for a single thing. */
  period?: { from: string; to: string } | null
  /** The lines of a bill that covers several things, e.g. a month of commission. */
  items?: { description: string; amount: number }[]
}

/** True when Book My Get Away is billing the client rather than a guest being billed for a stay. */
export const isPlatformBill = (kind: InvoiceKind) => kind === 'commission' || kind === 'subscription'

/**
 * Place of supply for a service Book My Get Away sells a client is where the client is — their registered
 * state when they have one. Without that there is nothing to go on but Book My Get Away's own state, which
 * makes it a supply within it.
 */
export const clientPlaceOfSupply = (settings: GstSettings, hostGst: HostGst | null | undefined) =>
  (hostGstReady(hostGst) ? hostGst!.stateCode : settings.stateCode)

/** April to March. A number issued in March belongs to the year that is ending. */
export function financialYear(iso: string): string {
  const d = new Date(iso)
  const year = d.getUTCFullYear()
  const start = d.getUTCMonth() >= 3 ? year : year - 1
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`
}

export const invoiceNumber = (prefix: string, year: string, serial: number) =>
  `${prefix || 'MS'}/${year}/${String(serial).padStart(4, '0')}`
