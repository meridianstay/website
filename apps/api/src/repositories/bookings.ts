import type { BookingDetail, BookingState, HostBooking, Management, PaymentMethod, PaymentState, PropertyType } from '@meridian/shared'
import type { Transaction } from 'firebase-admin/firestore'
import { C, all, col, firestore, nightsOf, nowISO } from '../store/db'
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
  checkIn: string; checkOut: string; nights: number; guests: number; currency: string
  pricePerNightMinor: number; baseMinor: number; extraGuestMinor: number; serviceFeeMinor: number; totalMinor: number
  management: Management; instantBook: boolean
  /** Commission rate at booking time, and the resulting split of what the guest paid (minus refunds). */
  commissionPct: number; commissionMinor: number; hostPayoutMinor: number
  status: StoredStatus; paymentMethod: PaymentMethod; paymentStatus: PaymentState
  razorpayOrderId: string | null; razorpayPaymentId: string | null; refundedMinor: number
  /** A refund Razorpay refused; an admin can retry it. */
  refundPendingMinor?: number
  /** When an AwaitingPayment hold or a Requested booking lapses. */
  expiresAt: string | null
  contactPhone: string; specialRequests: string | null
  createdAt: string; confirmedAt: string | null; cancelledAt: string | null; decidedAt: string | null
  declineReason: string | null; reviewed: boolean
}

export const HOLDING: StoredStatus[] = ['AwaitingPayment', 'Requested']
const ACTIVE: StoredStatus[] = ['AwaitingPayment', 'Requested', 'Confirmed']

export class NightsTakenError extends Error {}

/** The guest's money that stays with the platform and host (total minus refunds) for a booking that was confirmed. */
export const keptMinor = (b: BookingDoc) => (b.confirmedAt && (b.status === 'Confirmed' || b.status === 'Cancelled') ? b.totalMinor - b.refundedMinor : 0)

export function toBooking(b: BookingDoc, today: string): BookingDetail {
  const status: BookingState = b.status === 'Confirmed' && b.checkOut <= today ? 'Completed' : b.status
  return {
    id: b.id, code: b.code, property: b.property, checkIn: b.checkIn, checkOut: b.checkOut, nights: b.nights, guests: b.guests,
    pricePerNight: b.pricePerNightMinor / 100, baseAmount: b.baseMinor / 100, extraGuestAmount: b.extraGuestMinor / 100,
    serviceFee: b.serviceFeeMinor / 100, total: b.totalMinor / 100, status, paymentMethod: b.paymentMethod,
    paymentStatus: b.paymentStatus, refunded: b.refundedMinor / 100, expiresAt: HOLDING.includes(b.status) ? b.expiresAt : null,
    instantBook: b.instantBook, declineReason: b.declineReason ?? null, contactPhone: b.contactPhone, specialRequests: b.specialRequests, createdAt: b.createdAt, reviewed: b.reviewed,
  }
}

export type BookingWithGuest = HostBooking

/** For hosts and admins: the guest, and how the money splits. Before confirmation the split is what it will be. */
export function withGuest(b: BookingDoc, today: string): BookingWithGuest {
  return {
    ...toBooking(b, today), guestName: b.guest.name, guestEmail: b.guest.email ?? b.guest.phone ?? '',
    commissionPct: b.commissionPct, commission: b.commissionMinor / 100, payout: b.hostPayoutMinor / 100,
    refundPending: (b.refundPendingMinor ?? 0) / 100,
  }
}

const ref = (code: string) => col(C.bookings).doc(code)

export type NewBooking = Pick<BookingDoc,
  'code' | 'propertyId' | 'guestId' | 'checkIn' | 'checkOut' | 'nights' | 'guests' | 'currency' | 'pricePerNightMinor' | 'baseMinor' |
  'extraGuestMinor' | 'serviceFeeMinor' | 'totalMinor' | 'commissionPct' | 'commissionMinor' | 'hostPayoutMinor' | 'paymentMethod' |
  'contactPhone' | 'specialRequests' | 'status' | 'paymentStatus' | 'expiresAt'>

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
  async create(input: NewBooking, property: PropertyDoc, guest: UserDoc) {
    const nights = datesIn(input.checkIn, input.checkOut)
    const now = nowISO()
    const stale: string[] = []
    await firestore.runTransaction(async (tx) => {
      stale.length = 0
      const nightRefs = nights.map((d) => nightsOf(property.id).doc(d))
      const [counter, ...existing] = await tx.getAll(col(C.counters).doc('bookings'), ...nightRefs)
      for (const n of existing) {
        if (!n.exists) continue
        const night = n.data() as { kind: string; ref: string; holdUntil?: string | null }
        if (night.kind === 'booking' && night.holdUntil && night.holdUntil < now) stale.push(night.ref)
        else throw new NightsTakenError()
      }
      const staleDocs = stale.length ? await tx.getAll(...[...new Set(stale)].map(ref)) : []
      const id = ((counter.data()?.value as number | undefined) ?? 0) + 1
      tx.set(col(C.counters).doc('bookings'), { value: id })
      for (const s of staleDocs) {
        const b = s.data() as BookingDoc | undefined
        if (b && HOLDING.includes(b.status)) tx.update(s.ref, { status: 'Expired', decidedAt: now })
      }
      const doc: BookingDoc = {
        ...input, id, hostId: property.hostId, management: property.management ?? 'self', instantBook: (property.management ?? 'self') === 'managed',
        property: { slug: property.slug, title: property.title, type: property.type, location: `${property.city}, ${property.region}`, image: property.coverImageUrl },
        guest: { name: guest.name, email: guest.email, phone: guest.phone },
        razorpayOrderId: null, razorpayPaymentId: null, refundedMinor: 0,
        createdAt: now, confirmedAt: input.status === 'Confirmed' ? now : null, cancelledAt: null, decidedAt: null, declineReason: null, reviewed: false,
      }
      tx.create(ref(input.code), doc)
      const holdUntil = HOLDING.includes(input.status) ? input.expiresAt : null
      for (const n of nightRefs) tx.set(n, { kind: 'booking', ref: input.code, holdUntil })
      if (!guest.phone) tx.update(col(C.users).doc(guest.uid), { phone: input.contactPhone })
    })
  },

  async find(code: string) {
    const snap = await ref(code).get()
    return snap.exists ? (snap.data() as BookingDoc) : null
  },

  async findByOrder(orderId: string) {
    const snap = await col(C.bookings).where('razorpayOrderId', '==', orderId).limit(1).get()
    return snap.empty ? null : (snap.docs[0].data() as BookingDoc)
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
      const b = snap.data() as BookingDoc | undefined
      if (!b || !from.includes(b.status)) return null
      const patch = change(b)
      if (!patch) return null
      const next = { ...b, ...patch }
      const nightRefs = datesIn(b.checkIn, b.checkOut).map((d) => nightsOf(b.propertyId).doc(d))
      if (!ACTIVE.includes(next.status)) {
        const release = await releaseNights(tx, b)
        tx.update(ref(code), patch)
        release()
      } else {
        const holdUntil = HOLDING.includes(next.status) ? next.expiresAt : null
        tx.update(ref(code), patch)
        for (const n of nightRefs) tx.set(n, { kind: 'booking', ref: code, holdUntil })
      }
      return b
    })
  },

  /** Holding bookings whose time has run out. */
  async stale(now: string) {
    const rows = await all<BookingDoc>(col(C.bookings).where('status', 'in', HOLDING))
    return rows.filter((b) => b.expiresAt && b.expiresAt < now)
  },

  async listForGuest(guestId: number, today: string) {
    const rows = await all<BookingDoc>(col(C.bookings).where('guestId', '==', guestId))
    // Checkouts the guest abandoned before paying aren't trips.
    return rows.filter((b) => !(['Expired', 'Cancelled'].includes(b.status) && ['created', 'failed'].includes(b.paymentStatus)))
      .sort((a, b) => b.checkIn.localeCompare(a.checkIn)).map((b) => toBooking(b, today))
  },

  async listForHost(hostId: number, today: string) {
    const rows = await all<BookingDoc>(col(C.bookings).where('hostId', '==', hostId))
    // Hosts only see bookings once the guest has paid (or requested).
    return rows.filter((b) => b.status !== 'AwaitingPayment').sort((a, b) => b.checkIn.localeCompare(a.checkIn)).map((b) => withGuest(b, today))
  },

  async listAll(q: string | null, status: string | null, today: string) {
    let rows = await all<BookingDoc>(col(C.bookings))
    const s = q?.toLowerCase()
    if (s) rows = rows.filter((b) => [b.code, b.guest.name, b.guest.email, b.property.title].some((v) => v?.toLowerCase().includes(s)))
    let out = rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((b) => withGuest(b, today))
    if (status) out = out.filter((b) => b.status === status)
    return out.slice(0, 300)
  },

  async forProperty(propertyId: number) {
    return all<BookingDoc>(col(C.bookings).where('propertyId', '==', propertyId))
  },
}
