import type { Payout, PayoutStatus } from '@meridian/shared'
import { C, all, col, firestore, nowISO } from '../store/db'

// Payout records. Which bookings each one covers is kept on the payout, and each booking carries
// the payout's id, so a booking can never end up in two payouts.

export interface PayoutDoc extends Payout {
  /** The booking codes this payout covers, for the guard against double payment. */
  bookingCodes: string[]
}

export const payoutsRepo = {
  async create(input: Omit<PayoutDoc, 'id' | 'createdAt'>): Promise<PayoutDoc> {
    const id = await firestore.runTransaction(async (tx) => {
      const ref = col(C.counters).doc('payouts')
      const snap = await tx.get(ref)
      const next = ((snap.data()?.value as number | undefined) ?? 0) + 1
      tx.set(ref, { value: next })
      return next
    })
    const doc: PayoutDoc = { ...input, id, createdAt: nowISO() }
    await col(C.payouts).doc(String(id)).set(doc)
    return doc
  },

  async find(id: number): Promise<PayoutDoc | null> {
    const snap = await col(C.payouts).doc(String(id)).get()
    return snap.exists ? (snap.data() as PayoutDoc) : null
  },

  async update(id: number, patch: Partial<PayoutDoc>) {
    await col(C.payouts).doc(String(id)).set(patch, { merge: true })
  },

  /** Newest first. Filtered by host for the host portal, by status for the control centre. */
  async list(filter: { hostId?: number; status?: PayoutStatus | null } = {}): Promise<PayoutDoc[]> {
    const rows = await all<PayoutDoc>(col(C.payouts))
    return rows
      .filter((p) => (filter.hostId === undefined || p.hostId === filter.hostId) && (!filter.status || p.status === filter.status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },
}
