import { C, all, col, daysOf, firestore, nextId, nightsOf, nowISO } from '../store/db'
import { isLive, type DaySlot } from './schedule'
import { datesIn } from './properties'

// Collection: availabilityBlocks/{id} — nights a host has closed. Each also claims its night documents.

export interface BlockDoc { id: number; propertyId: number; checkIn: string; checkOut: string; note: string | null; createdAt: string }

export class BlockConflictError extends Error {
  constructor(public reason: 'booked' | 'blocked') {
    super(reason)
  }
}

export const availabilityRepo = {
  async upcomingBlocks(propertyId: number, today: string) {
    const rows = await all<BlockDoc>(col(C.blocks).where('propertyId', '==', propertyId))
    return rows.filter((b) => b.checkOut > today).sort((a, b) => a.checkIn.localeCompare(b.checkIn))
      .map(({ id, checkIn, checkOut, note }) => ({ id, checkIn, checkOut, note }))
  },

  /** Claims the nights for a block; throws BlockConflictError if any is booked or already blocked. */
  async addBlock(propertyId: number, checkIn: string, checkOut: string, note: string | null) {
    await firestore.runTransaction(async (tx) => {
      const dates = datesIn(checkIn, checkOut)
      const nightRefs = dates.map((d) => nightsOf(propertyId).doc(d))
      const [existing, days] = await Promise.all([tx.getAll(...nightRefs), tx.getAll(...dates.map((d) => daysOf(propertyId).doc(d)))])
      if (days.some((d) => ((d.data()?.slots ?? []) as DaySlot[]).some((sl) => isLive(sl.holdUntil, nowISO())))) throw new BlockConflictError('booked')
      const now = nowISO()
      // A lapsed payment or request hold doesn't stop a block; the expiry sweep closes that booking.
      const taken = existing.filter((n) => n.exists && !(n.data()!.holdUntil && n.data()!.holdUntil < now)).map((n) => n.data()!.kind as string)
      if (taken.includes('booking')) throw new BlockConflictError('booked')
      if (taken.length) throw new BlockConflictError('blocked')
      const id = await nextId('blocks', tx)
      tx.set(col(C.blocks).doc(String(id)), { id, propertyId, checkIn, checkOut, note, createdAt: nowISO() } satisfies BlockDoc)
      for (const n of nightRefs) tx.set(n, { kind: 'block', ref: String(id) })
    })
  },

  async removeBlock(blockId: number, propertyId: number) {
    await firestore.runTransaction(async (tx) => {
      const ref = col(C.blocks).doc(String(blockId))
      const b = (await tx.get(ref)).data() as BlockDoc | undefined
      if (!b || b.propertyId !== propertyId) return
      tx.delete(ref)
      for (const d of datesIn(b.checkIn, b.checkOut)) tx.delete(nightsOf(propertyId).doc(d))
    })
  },
}
