import { propertyCode } from './places'
import type { BookingState, PaymentState } from './api-types'

// Guests browse stays without seeing who owns them. The property's real name, the host's name, phone
// and email and the exact address only appear once a booking is confirmed and paid in full, so
// enquiries and payments always go through Meridian.

/** What guests see in place of the property's real name, e.g. "Farmstay in Coorg · MS007". */
export const publicTitle = (p: { id: number; type: string; city: string }) => `${p.type} in ${p.city} · ${propertyCode(p.id)}`

/** The web address of a listing's page, which must not give the name away either: "farmstay-in-coorg". */
export const publicSlugBase = (p: { type: string; city: string }) => `${p.type} in ${p.city}`

/** Payments that count as money actually received (`test` is a booking made while payments are switched off). */
const SETTLED: PaymentState[] = ['paid', 'released', 'test']

/** True once a booking is confirmed and paid, which is when the host's details are shown. */
export const bookingUnlocked = (b: { status: BookingState; paymentStatus: PaymentState }) =>
  (b.status === 'Confirmed' || b.status === 'Completed') && SETTLED.includes(b.paymentStatus)

/** Shown wherever details are hidden, so guests know what to expect. */
export const PRIVACY_NOTE = 'The property’s name, the owner’s details and the exact address are shared with you as soon as your booking is confirmed and paid.'
