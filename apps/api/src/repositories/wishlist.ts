import { C, all, col, nowISO } from '../store/db'
import { toPropertySummary, type PropertyDoc } from './properties'

// Collection: wishlists/{userId}_{propertyId}

const ref = (userId: number, propertyId: number) => col(C.wishlists).doc(`${userId}_${propertyId}`)

export const wishlistRepo = {
  async list(userId: number) {
    const items = await all<{ propertyId: number; createdAt: string }>(col(C.wishlists).where('userId', '==', userId))
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const docs = await Promise.all(items.map((i) => col(C.properties).doc(String(i.propertyId)).get()))
    return docs.map((d) => d.data() as PropertyDoc | undefined).filter((p): p is PropertyDoc => p?.status === 'Approved').map((p) => toPropertySummary(p))
  },

  add: (userId: number, propertyId: number) => ref(userId, propertyId).set({ userId, propertyId, createdAt: nowISO() }),
  remove: (userId: number, propertyId: number) => ref(userId, propertyId).delete(),
}
