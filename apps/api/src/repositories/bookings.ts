import { addDays, bookingUnlocked, commissionMinor, dayUseRefundMinor, defaultCommission, guestRefundMinor, publicTitle, type BookingDetail, type GuestBreakdown, type BookingState, type HostBooking, type Management, type PaymentMethod, type PaymentState, type PropertyType } from '@meridian/shared'
import type { Transaction } from 'firebase-admin/firestore'
import { C, all, col, daysOf, firestore, nightsOf, nowISO } from '../store/db'
import { dayUseConflict, isLive, stayClashesWithDayUse, type DaySlot, type NightLock } from './schedule'
import { datesIn, type PropertyDoc } from './properties'
import type { UserDoc } from './users'

// Collection: bookings/{code}. Every booking that holds dates also owns one night document per night
// (properties/{id}/nights/{date}); creating those inside a transaction is what prevents double bookings.
//
// Lifecycle
//   managed listing (instant):  AwaitingPayment → Confirmed            (no gateway: straight to Confirmed)
//   self-managed (request):     AwaitingPayment → Requested → Confirmed | Declined | Expired
//   any holding state → Cancelled (guest or admin).  AwaitingPayment → Expired when payment isn't finished in time.
// While AwaitingPayment or Requested, night documents carry `holdUntil`; an expired hold counts as free.

export type StoredStatus = 'AwaitingPayment' | 'Requested' | 'Confirmed' | 'Declined' | 'Expired' | 'Cancelled'

export interface BookingDoc {
  id: number; code: string; propertyId: number; hostId: number; guestId: number
  /** Snapshot of the listing at booking time. */
  property: { slug: string; title: string; type: PropertyType; location: string; image: string }
  guest: { name: string; email: string | null; phone: string | null }
  /** Snapshot of the owner, shown to the guest once the booking is confirmed and paid. */
  host: { name: string; email: string; phone: string }
  checkIn: string; checkOut: string; nights: number; guests: number; currency: string
  pricePerNightMinor: number; baseMinor: number; extraGuestMinor: number; serviceFeeMinor: number; totalMinor: number
  management: Management; instantBook: boolean
  /** Commission rate at booking time, and the resulting split of what the guest paid (minus refunds). */
  commissionPct: number; commissionMinor: number; hostPayoutMinor: number
  /** The convenience fee agreed at booking time (percent of the total, never refunded). */
  cancellationFeePct: number
  status: StoredStatus; paymentMethod: PaymentMethod; paymentStatus: PaymentState
  razorpayOrderId: string | null; razorpayPaymentId: string | null; refundedMinor: number
  /** A refund Razorpay refused; an admin can retry it. */
  refundPendingMinor?: number
  /** When an AwaitingPayment hold or a Requested booking lapses. */
  expiresAt: string | null
  contactPhone: string; specialRequests: string | null
  createdAt: string; confirmedAt: string | null; cancelledAt: string | null; decidedAt: string | null
  declineReason: string | null; reviewed: boolean
  /** stay: nights checkIn → checkOut. dayuse: one day (checkIn), startTime → endTime ("HH:MM"). */
  kind: 'stay' | 'dayuse'; startTime: string | null; endTime: string | null; hours: number | null
  guestBreakdown: GuestBreakdown; securityDepositMinor: number; checkInTime: string; checkOutTime: string
  /** Coupon used at checkout, and what it took off (already reflected in totalMinor). */
  couponCode: string | null; discountMinor: number
  /** The property's exact address when booked; shown only once the booking is confirmed. */
  address: string
}

/**
 * Fills fields added in 0.6.0 for bookings stored by earlier versions (so old data never breaks a page):
 * commission at the default rate for the property type, no refunds, confirmed when it was created.
 */
export function withDefaults(raw: Partial<BookingDoc> & Pick<BookingDoc, 'code' | 'totalMinor' | 'status' | 'createdAt'>): BookingDoc {
  const b = raw as BookingDoc
  const management = b.management ?? 'self'
  const commissionPct = b.commissionPct ?? (management === 'managed' ? defaultCommission.managedPct : defaultCommission.selfPct)
  const refundedMinor = b.refundedMinor ?? (b.status === 'Cancelled' ? b.totalMinor : 0)
  const confirmedAt = b.confirmedAt !== undefined ? b.confirmedAt : b.status === 'Confirmed' || b.status === 'Cancelled' ? b.createdAt : null
  const kept = confirmedAt && (b.status === 'Confirmed' || b.status === 'Cancelled') ? b.totalMinor - refundedMinor : b.status === 'Requested' ? b.totalMinor : 0
  const commission = b.commissionMinor ?? commissionMinor(kept, commissionPct)
  return {
    ...b, management, instantBook: b.instantBook ?? management === 'managed', commissionPct, commissionMinor: commission,
    hostPayoutMinor: b.hostPayoutMinor ?? kept - commission, refundedMinor, confirmedAt, paymentStatus: b.paymentStatus ?? 'test',
    razorpayOrderId: b.razorpayOrderId ?? null, razorpayPaymentId: b.razorpayPaymentId ?? null, expiresAt: b.expiresAt ?? null,
    decidedAt: b.decidedAt ?? null, declineReason: b.declineReason ?? null, serviceFeeMinor: b.serviceFeeMinor ?? 0,
    kind: b.kind ?? 'stay', startTime: b.startTime ?? null, endTime: b.endTime ?? null, hours: b.hours ?? null,
    guestBreakdown: b.guestBreakdown ?? { adults: b.guests, children: 0, infants: 0, pets: 0 }, securityDepositMinor: b.securityDepositMinor ?? 0,
    checkInTime: b.checkInTime ?? '14:00', checkOutTime: b.checkOutTime ?? '11:00', address: b.address ?? '',
    host: b.host ?? { name: 'Your host', email: '', phone: '' }, cancellationFeePct: b.cancellationFeePct ?? defaultCommission.cancellationFeePct,
    couponCode: b.couponCode ?? null, discountMinor: b.discountMinor ?? 0,
  }
}

/** Reads bookings from a query with defaults filled in. */
const readAll = async (q: FirebaseFirestore.Query): Promise<BookingDoc[]> => (await all<BookingDoc>(q)).map(withDefaults)

export const HOLDING: StoredStatus[] = ['AwaitingPayment', 'Requested']
const ACTIVE: StoredStatus[] = ['AwaitingPayment', 'Requested', 'Confirmed']

/** The dates or hours are taken. `message` says why when it's useful to show. */
export class NightsTakenError extends Error {}

/** The guest's money that stays with the platform and host (total minus refunds) for a booking that was confirmed. */
export const keptMinor = (b: BookingDoc) => (b.confirmedAt && (b.status === 'Confirmed' || b.status === 'Cancelled') ? b.totalMinor - b.refundedMinor : 0)

export function toBooking(b: BookingDoc, today: string): BookingDetail {
  const status: BookingState = b.status === 'Confirmed' && b.checkOut <= today ? 'Completed' : b.status
  // The name of the property and who owns it are only shared once the booking is paid for.
  const open = bookingUnlocked({ status, paymentStatus: b.paymentStatus })
  const property = open ? b.property
    : { ...b.property, title: publicTitle({ id: b.propertyId, type: b.property.type, city: b.property.location.split(',')[0].trim() }) }
  const refundIfCancelled = status === 'Confirmed'
    ? (b.kind === 'dayuse'
      ? dayUseRefundMinor(b.totalMinor, b.checkIn, b.startTime ?? '12:00', b.cancellationFeePct)
      : guestRefundMinor(b.totalMinor, b.pricePerNightMinor, b.checkIn, b.cancellationFeePct))
    : status === 'Requested' || status === 'AwaitingPayment' ? b.totalMinor : 0
  return {
    id: b.id, code: b.code, property, checkIn: b.checkIn, checkOut: b.checkOut, nights: b.nights, guests: b.guests,
    pricePerNight: b.pricePerNightMinor / 100, baseAmount: b.baseMinor / 100, extraGuestAmount: b.extraGuestMinor / 100,
    serviceFee: b.serviceFeeMinor / 100, total: b.totalMinor / 100, status, paymentMethod: b.paymentMethod,
    paymentStatus: b.paymentStatus, refunded: b.refundedMinor / 100, expiresAt: HOLDING.includes(b.status) ? b.expiresAt : null,
    instantBook: b.instantBook, kind: b.kind, startTime: b.startTime, endTime: b.endTime, hours: b.hours, guestBreakdown: b.guestBreakdown,
    securityDeposit: b.securityDepositMinor / 100, checkInTime: b.checkInTime, checkOutTime: b.checkOutTime,
    couponCode: b.couponCode, discount: b.discountMinor / 100,
    address: (open && b.address) || null,
    host: open ? b.host : null,
    refundIfCancelled: refundIfCancelled / 100,
    declineReason: b.declineReason ?? null, contactPhone: b.contactPhone, specialRequests: b.specialRequests, createdAt: b.createdAt, reviewed: b.reviewed,
  }
}

export type BookingWithGuest = HostBooking

/** For hosts and admins: the guest, and how the money splits. Before confirmation the split is what it will be. */
export function withGuest(b: BookingDoc, today: string): BookingWithGuest {
  return {
    // Hosts and our team always see the real name, address and owner.
    ...toBooking(b, today), property: b.property, address: b.address || null, host: b.host, guestName: b.guest.name, guestEmail: b.guest.email ?? b.guest.phone ?? '',
    commissionPct: b.commissionPct, commission: b.commissionMinor / 100, payout: b.hostPayoutMinor / 100,
    refundPending: (b.refundPendingMinor ?? 0) / 100,
  }
}

const ref = (code: string) => col(C.bookings).doc(code)

export type NewBooking = Pick<BookingDoc,
  'code' | 'propertyId' | 'guestId' | 'checkIn' | 'checkOut' | 'nights' | 'guests' | 'currency' | 'pricePerNightMinor' | 'baseMinor' |
  'extraGuestMinor' | 'serviceFeeMinor' | 'totalMinor' | 'commissionPct' | 'commissionMinor' | 'hostPayoutMinor' | 'paymentMethod' |
  'contactPhone' | 'specialRequests' | 'status' | 'paymentStatus' | 'expiresAt' | 'kind' | 'startTime' | 'endTime' | 'hours' |
  'guestBreakdown' | 'securityDepositMinor' | 'checkInTime' | 'checkOutTime' | 'couponCode' | 'discountMinor' | 'cancellationFeePct'>

/** Frees a booking's nights, but only those it still owns (an expired hold may have been taken over). */
async function releaseNights(tx: Transaction, b: BookingDoc) {
  const refs = datesIn(b.checkIn, b.checkOut).map((d) => nightsOf(b.propertyId).doc(d))
  const snaps = refs.length ? await tx.getAll(...refs) : []
  return () => snaps.forEach((s, i) => s.exists && s.data()!.ref === b.code && tx.delete(refs[i]))
}

export const bookingsRepo = {
  /**
   * Creates a booking and claims each night in one transaction. Nights held by a lapsed hold are taken over
   * and that booking is marked Expired. Throws NightsTakenError if any night is booked, blocked or validly held.
   */
  async create(input: NewBooking, property: PropertyDoc, guest: UserDoc, host: UserDoc | null) {
    const now = nowISO()
    await firestore.runTransaction(async (tx) => {
      // ── Reads (Firestore needs every read before the first write) ──
      const counterRef = col(C.counters).doc('bookings')
      let staleRefs: string[] = []
      let writeLocks: () => void
      if (input.kind === 'dayuse') {
        const date = input.checkIn
        const [counter, nightSnap, beforeSnap, daySnap] = await tx.getAll(
          counterRef, nightsOf(property.id).doc(date), nightsOf(property.id).doc(addDays(date, -1)), daysOf(property.id).doc(date))
        const slots = ((daySnap.data()?.slots ?? []) as DaySlot[])
        const conflict = dayUseConflict({
          start: input.startTime!, end: input.endTime!, slots, now, checkInTime: property.checkInTime, checkOutTime: property.checkOutTime,
          night: (nightSnap.data() as NightLock | undefined) ?? null, nightBefore: (beforeSnap.data() as NightLock | undefined) ?? null,
        })
        if (conflict) throw new NightsTakenError(conflict)
        staleRefs = slots.filter((sl) => !isLive(sl.holdUntil, now)).map((sl) => sl.ref)
        const kept = slots.filter((sl) => isLive(sl.holdUntil, now))
        writeLocks = () => tx.set(daySnap.ref, {
          slots: [...kept, { ref: input.code, start: input.startTime!, end: input.endTime!, holdUntil: HOLDING.includes(input.status) ? input.expiresAt : null }],
        })
        await finish(counter)
      } else {
        const nightRefs = datesIn(input.checkIn, input.checkOut).map((d) => nightsOf(property.id).doc(d))
        const dayDates = [...datesIn(input.checkIn, input.checkOut), input.checkOut]
        const snaps = await tx.getAll(counterRef, ...nightRefs, ...dayDates.map((d) => daysOf(property.id).doc(d)))
        const [counter, ...rest] = snaps
        const existing = rest.slice(0, nightRefs.length)
        const daySnaps = rest.slice(nightRefs.length)
        for (const n of existing) {
          if (!n.exists) continue
          const night = n.data() as NightLock
          if (night.kind === 'booking' && night.holdUntil && night.holdUntil < now) staleRefs.push(night.ref)
          else throw new NightsTakenError()
        }
        const days = new Map(dayDates.map((d, i) => [d, ((daySnaps[i].data()?.slots ?? []) as DaySlot[])]))
        if (stayClashesWithDayUse({ checkIn: input.checkIn, checkOut: input.checkOut, days, checkInTime: property.checkInTime, checkOutTime: property.checkOutTime, now })) {
          throw new NightsTakenError('A day-use booking overlaps these dates.')
        }
        const holdUntil = HOLDING.includes(input.status) ? input.expiresAt : null
        writeLocks = () => { for (const n of nightRefs) tx.set(n, { kind: 'booking', ref: input.code, holdUntil }) }
        await finish(counter)
      }

      async function finish(counter: FirebaseFirestore.DocumentSnapshot) {
        const staleDocs = staleRefs.length ? await tx.getAll(...[...new Set(staleRefs)].map(ref)) : []
        // ── Writes ──
        const id = ((counter.data()?.value as number | undefined) ?? 0) + 1
        tx.set(counterRef, { value: id })
        for (const sd of staleDocs) {
          const b = sd.data() as BookingDoc | undefined
          if (b && HOLDING.includes(b.status)) tx.update(sd.ref, { status: 'Expired', decidedAt: now })
        }
        const doc: BookingDoc = {
          ...input, id, hostId: property.hostId, management: property.management ?? 'self', instantBook: (property.management ?? 'self') === 'managed',
          property: { slug: property.slug, title: property.title, type: property.type, location: `${property.city}, ${property.region}`, image: property.coverImageUrl },
          guest: { name: guest.name, email: guest.email, phone: guest.phone },
          host: { name: host?.name ?? 'Your host', email: host?.email ?? '', phone: host?.phone ?? '' },
          razorpayOrderId: null, razorpayPaymentId: null, refundedMinor: 0, address: property.address ?? '',
          createdAt: now, confirmedAt: input.status === 'Confirmed' ? now : null, cancelledAt: null, decidedAt: null, declineReason: null, reviewed: false,
        }
        tx.create(ref(input.code), doc)
        writeLocks()
        if (!guest.phone) tx.update(col(C.users).doc(guest.uid), { phone: input.contactPhone })
      }
    })
  },

  async find(code: string) {
    const snap = await ref(code).get()
    return snap.exists ? withDefaults(snap.data() as BookingDoc) : null
  },

  async findByOrder(orderId: string) {
    const snap = await col(C.bookings).where('razorpayOrderId', '==', orderId).limit(1).get()
    return snap.empty ? null : withDefaults(snap.docs[0].data() as BookingDoc)
  },

  setFields: (code: string, patch: Partial<BookingDoc>) => ref(code).update(patch),

  /**
   * Moves a booking from one of `from` to a new state inside a transaction, updating its night holds.
   * `change` sees the current booking and returns the fields to write, or null to leave it alone.
   * Returns the booking as it was before the change, or null if nothing changed.
   */
  async transition(code: string, from: StoredStatus[], change: (b: BookingDoc) => Partial<BookingDoc> | null) {
    return firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref(code))
      const raw = snap.data() as BookingDoc | undefined
      const b = raw && withDefaults(raw)
      if (!b || !from.includes(b.status)) return null
      const patch = change(b)
      if (!patch) return null
      const next = { ...b, ...patch }
      const active = ACTIVE.includes(next.status)
      const holdUntil = HOLDING.includes(next.status) ? next.expiresAt : null
      if (b.kind === 'dayuse') {
        const dayRef = daysOf(b.propertyId).doc(b.checkIn)
        const slots = (((await tx.get(dayRef)).data()?.slots ?? []) as DaySlot[])
        tx.update(ref(code), patch)
        tx.set(dayRef, { slots: active ? slots.map((sl) => (sl.ref === code ? { ...sl, holdUntil } : sl)) : slots.filter((sl) => sl.ref !== code) })
      } else if (!active) {
        const release = await releaseNights(tx, b)
        tx.update(ref(code), patch)
        release()
      } else {
        const nightRefs = datesIn(b.checkIn, b.checkOut).map((d) => nightsOf(b.propertyId).doc(d))
        tx.update(ref(code), patch)
        for (const n of nightRefs) tx.set(n, { kind: 'booking', ref: code, holdUntil })
      }
      return b
    })
  },

  /** Holding bookings whose time has run out. */
  async stale(now: string) {
    const rows = await readAll(col(C.bookings).where('status', 'in', HOLDING))
    return rows.filter((b) => b.expiresAt && b.expiresAt < now)
  },

  async listForGuest(guestId: number, today: string) {
    const rows = await readAll(col(C.bookings).where('guestId', '==', guestId))
    // Checkouts the guest abandoned before paying aren't trips.
    return rows.filter((b) => !(['Expired', 'Cancelled'].includes(b.status) && ['created', 'failed'].includes(b.paymentStatus)))
      .sort((a, b) => b.checkIn.localeCompare(a.checkIn)).map((b) => toBooking(b, today))
  },

  async listForHost(hostId: number, today: string) {
    const rows = await readAll(col(C.bookings).where('hostId', '==', hostId))
    // Hosts only see bookings once the guest has paid (or requested).
    return rows.filter((b) => b.status !== 'AwaitingPayment').sort((a, b) => b.checkIn.localeCompare(a.checkIn)).map((b) => withGuest(b, today))
  },

  async listAll(q: string | null, status: string | null, today: string) {
    let rows = await readAll(col(C.bookings))
    const s = q?.toLowerCase()
    if (s) rows = rows.filter((b) => [b.code, b.guest.name, b.guest.email, b.property.title].some((v) => v?.toLowerCase().includes(s)))
    let out = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((b) => withGuest(b, today))
    if (status) out = out.filter((b) => b.status === status)
    return out.slice(0, 300)
  },

  async forProperty(propertyId: number) {
    return readAll(col(C.bookings).where('propertyId', '==', propertyId))
  },
}
