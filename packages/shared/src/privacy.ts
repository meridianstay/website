import type { BookingState, PaymentState } from './api-types'

// Stays are listed under their real names, and the business behind them is named too: a client's own
// site is their shopfront, and a name that only appeared after payment would make nonsense of it.
//
// What still waits for a paid booking is the way to reach a host *directly* from the marketplace —
// their phone, email and the exact address. A client's own site gives its own contact details,
// because that is the point of it.

/** The web address of a listing's page, built from its name and town: "green-valley-farmstay-coorg". */
export const slugBase = (p: { title: string; city: string }) => `${p.title} ${p.city}`

/** Payments that count as money actually received (`test` is a booking made while payments are switched off). */
const SETTLED: PaymentState[] = ['paid', 'released', 'test']

/** True once a booking is confirmed and paid, which is when the host's own contact details are shown. */
export const bookingUnlocked = (b: { status: BookingState; paymentStatus: PaymentState }) =>
  (b.status === 'Confirmed' || b.status === 'Completed') && SETTLED.includes(b.paymentStatus)

/** Shown on the marketplace wherever the host's direct contact details are still held back. */
export const PRIVACY_NOTE = 'The owner’s phone number, email and the exact address are shared with you as soon as your booking is confirmed and paid.'
