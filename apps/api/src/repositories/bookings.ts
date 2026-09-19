import type { BookingDetail, BookingState, PaymentMethod, PropertyType } from '@meridian/shared'
import { C, all, col, firestore, nightsOf, nowISO } from '../store/db'
import { datesIn, type PropertyDoc } from './properties'
import type { UserDoc } from './users'

// Collection: bookings/{code}. Each confirmed booking also holds one night document per night
// (properties/{id}/nights/{date}); creating those inside a transaction is what prevents double bookings.

export interface BookingDoc {
  id: number; code: string; propertyId: number; hostId: number; guestId: number
  /** Snapshot of the listing at booking time. */
  property: { slug: string; title: string; type: PropertyType; location: string; image: string }
  guest: { name: string; email: string | null; phone: string | null }
  checkIn: string; checkOut: string; nights: number; guests: number; currency: string
  pricePerNightMinor: number; baseMinor: number; extraGuestMinor: number; serviceFeeMinor: number; totalMinor: number
  status: 'Confirmed' | 'Cancelled'; paymentMethod: PaymentMethod; paymentStatus: 'test' | 'pending' | 'paid' | 'refunded' | 'failed'
  paymentReference: string | null; contactPhone: string; specialRequests: string | null
  createdAt: string; cancelledAt: string | null; reviewed: boolean
}

export class NightsTakenError extends Error {}

export function toBooking(b: BookingDoc, today: string): BookingDetail {
  const status: BookingState = b.status === 'Cancelled' ? 'Cancelled' : b.checkOut <= today ? 'Completed' : 'Confirmed'
  return {
    id: b.id, code: b.code, property: b.property, checkIn: b.checkIn, checkOut: b.checkOut, nights: b.nights, guests: b.guests,
    pricePerNight: b.pricePerNightMinor / 100, baseAmount: b.baseMinor / 100, extraGuestAmount: b.extraGuestMinor / 100,
    serviceFee: b.serviceFeeMinor / 100, total: b.totalMinor / 100, status, paymentMethod: b.paymentMethod,
    contactPhone: b.contactPhone, specialRequests: b.specialRequests, createdAt: b.createdAt, reviewed: b.reviewed,
  }
}

export type BookingWithGuest = BookingDetail & { guestName: string; guestEmail: string }
const withGuest = (b: BookingDoc, today: string): BookingWithGuest => ({ ...toBooking(b, today), guestName: b.guest.name, guestEmail: b.guest.email ?? b.guest.phone ?? '' })

const ref = (code: string) => col(C.bookings).doc(code)

export type NewBooking = Omit<BookingDoc, 'id' | 'createdAt' | 'cancelledAt' | 'reviewed' | 'status' | 'paymentStatus' | 'paymentReference' | 'property' | 'guest' | 'hostId'>

export const bookingsRepo = {
  /**
   * Creates a confirmed booking and claims each night in one transaction.
   * Throws NightsTakenError if any night is already booked or blocked.
   */
  async create(input: NewBooking, property: PropertyDoc, guest: UserDoc) {
    const nights = datesIn(input.checkIn, input.checkOut)
    await firestore.runTransaction(async (tx) => {
      const nightRefs = nights.map((d) => nightsOf(property.id).doc(d))
      const [counter, ...existing] = await tx.getAll(col(C.counters).doc('bookings'), ...nightRefs)
      if (existing.some((n) => n.exists)) throw new NightsTakenError()
      const id = ((counter.data()?.value as number | undefined) ?? 0) + 1
      tx.set(col(C.counters).doc('bookings'), { value: id })
      const doc: BookingDoc = {
        ...input, id, hostId: property.hostId,
        property: { slug: property.slug, title: property.title, type: property.type, location: `${property.city}, ${property.region}`, image: property.coverImageUrl },
        guest: { name: guest.name, email: guest.email, phone: guest.phone },
        status: 'Confirmed', paymentStatus: 'test', paymentReference: null, createdAt: nowISO(), cancelledAt: null, reviewed: false,
      }
      tx.create(ref(input.code), doc)
      for (const n of nightRefs) tx.create(n, { kind: 'booking', ref: input.code })
      if (!guest.phone) tx.update(col(C.users).doc(guest.uid), { phone: input.contactPhone })
    })
  },

  async find(code: string) {
    const snap = await ref(code).get()
    return snap.exists ? (snap.data() as BookingDoc) : null
  },

  async listForGuest(guestId: number, today: string) {
    const rows = await all<BookingDoc>(col(C.bookings).where('guestId', '==', guestId))
    return rows.sort((a, b) => b.checkIn.localeCompare(a.checkIn)).map((b) => toBooking(b, today))
  },

  async listForHost(hostId: number, today: string) {
    const rows = await all<BookingDoc>(col(C.bookings).where('hostId', '==', hostId))
    return rows.sort((a, b) => b.checkIn.localeCompare(a.checkIn)).map((b) => withGuest(b, today))
  },

  async listAll(q: string | null, today: string) {
    let rows = await all<BookingDoc>(col(C.bookings))
    const s = q?.toLowerCase()
    if (s) rows = rows.filter((b) => [b.code, b.guest.name, b.guest.email, b.property.title].some((v) => v?.toLowerCase().includes(s)))
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 300).map((b) => withGuest(b, today))
  },

  async forProperty(propertyId: number) {
    return all<BookingDoc>(col(C.bookings).where('propertyId', '==', propertyId))
  },

  /** Cancels and frees the nights. `allowed` decides from the current booking whether it may be cancelled. */
  async cancel(code: string, allowed: (b: BookingDoc) => boolean) {
    return firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref(code))
      const b = snap.data() as BookingDoc | undefined
      if (!b || b.status !== 'Confirmed' || !allowed(b)) return false
      tx.update(ref(code), { status: 'Cancelled', cancelledAt: nowISO() })
      for (const d of datesIn(b.checkIn, b.checkOut)) tx.delete(nightsOf(b.propertyId).doc(d))
      return true
    })
  },
}
