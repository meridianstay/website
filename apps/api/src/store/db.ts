import { FieldValue, type DocumentReference, type Transaction } from 'firebase-admin/firestore'
import { firestore } from './firebase'

// Collection names in one place. Data model: docs/database.md.
export const C = {
  users: 'users',
  properties: 'properties',
  bookings: 'bookings',
  reviews: 'reviews',
  blocks: 'availabilityBlocks',
  wishlists: 'wishlists',
  amenities: 'amenities',
  settings: 'siteSettings',
  pages: 'contentPages',
  messages: 'contactMessages',
  audit: 'auditLog',
  coupons: 'coupons',
  promotions: 'adCampaigns',
  counters: 'counters',
  /** What the platform has emailed or texted, and whether it arrived. */
  notifications: 'notifications',
  /** What has been paid to hosts, and what each payment covered. */
  payouts: 'payouts',
  /** Encrypted integration secrets (Razorpay, mail and SMS). Never listed in the admin Database screen. */
  secrets: 'secrets',
} as const

export const col = (name: string) => firestore.collection(name)
export const nowISO = () => new Date().toISOString()

/** Nights booked or blocked, one document per date: properties/{id}/nights/{YYYY-MM-DD}. */
export const nightsOf = (propertyId: number) => col(C.properties).doc(String(propertyId)).collection('nights')

/** Day-use bookings per date: properties/{id}/days/{YYYY-MM-DD} = { slots: [{ ref, start, end, holdUntil }] }. */
export const daysOf = (propertyId: number) => col(C.properties).doc(String(propertyId)).collection('days')

/**
 * Next number in a sequence (listings, reviews, users…), so records keep short numeric ids.
 * Pass a transaction to allocate inside it.
 */
export async function nextId(sequence: string, tx?: Transaction): Promise<number> {
  const ref = col(C.counters).doc(sequence)
  if (tx) {
    const snap = await tx.get(ref)
    const value = ((snap.data()?.value as number | undefined) ?? 0) + 1
    tx.set(ref, { value })
    return value
  }
  return firestore.runTransaction((t) => nextId(sequence, t))
}

export const increment = FieldValue.increment
export const serverDelete = FieldValue.delete

/** Reads every doc of a query (fine at this platform's size; see docs/database.md on scaling). */
export async function all<T>(query: FirebaseFirestore.Query): Promise<T[]> {
  return (await query.get()).docs.map((d) => d.data() as T)
}

export type Ref = DocumentReference
export { firestore }
