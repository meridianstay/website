import type { Coupon } from '@meridian/shared'
import { C, all, col, firestore, nowISO } from '../store/db'

// Collection: coupons/{CODE} (uppercase).

const ref = (code: string) => col(C.coupons).doc(code.toUpperCase())

export const couponsRepo = {
  async find(code: string) {
    const snap = await ref(code).get()
    return snap.exists ? (snap.data() as Coupon) : null
  },

  async list(): Promise<Coupon[]> {
    return (await all<Coupon>(col(C.coupons))).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  },

  save: (coupon: Coupon) => ref(coupon.code).set({ ...coupon, code: coupon.code.toUpperCase(), createdAt: coupon.createdAt ?? nowISO() }),

  async remove(code: string) {
    const doc = ref(code)
    if (!(await doc.get()).exists) return false
    await doc.delete()
    return true
  },

  /** Counts one use, and refuses if the coupon ran out in the meantime. */
  async claim(code: string) {
    return firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref(code))
      const c = snap.data() as Coupon | undefined
      if (!c || !c.enabled) return false
      if (c.usageLimit > 0 && (c.usedCount ?? 0) >= c.usageLimit) return false
      tx.update(snap.ref, { usedCount: (c.usedCount ?? 0) + 1 })
      return true
    })
  },

  /** Gives a use back when a booking never happens. */
  async release(code: string) {
    const snap = await ref(code).get()
    const c = snap.data() as Coupon | undefined
    if (c && (c.usedCount ?? 0) > 0) await snap.ref.update({ usedCount: c.usedCount - 1 })
  },
}
