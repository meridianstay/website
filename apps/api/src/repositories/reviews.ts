import type { Review } from '@meridian/shared'
import { C, all, col, firestore, nextId, nowISO } from '../store/db'
import { propertiesRepo, type PropertyDoc } from './properties'

// Collection: reviews/{id}. Hidden reviews stay stored but aren't shown or counted.

export interface ReviewDoc {
  id: number; propertyId: number; userId: number | null; bookingCode: string | null; authorName: string
  rating: number; comment: string; createdAt: string; hiddenAt: string | null
}

const toReview = (r: ReviewDoc): Review => ({ id: r.id, authorName: r.authorName, rating: r.rating, comment: r.comment, createdAt: r.createdAt })

export interface AdminReview extends Review { hidden: boolean; property: { slug: string; title: string } }

export const reviewsRepo = {
  async visibleForProperty(propertyId: number, limit = 30) {
    const rows = await all<ReviewDoc>(col(C.reviews).where('propertyId', '==', propertyId))
    return rows.filter((r) => !r.hiddenAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit).map(toReview)
  },

  /** Adds a review for a booking, marks the booking reviewed and updates the rating, atomically. */
  async addForBooking(input: { propertyId: number; userId: number; bookingCode: string; authorName: string; rating: number; comment: string }) {
    await firestore.runTransaction(async (tx) => {
      const bookingRef = col(C.bookings).doc(input.bookingCode)
      const [booking, property] = await Promise.all([tx.get(bookingRef), propertiesRepo.get(input.propertyId, tx)])
      if (!booking.exists || booking.data()!.reviewed || !property) throw new Error('not reviewable')
      const id = await nextId('reviews', tx)
      tx.set(col(C.reviews).doc(String(id)), { ...input, id, createdAt: nowISO(), hiddenAt: null } satisfies ReviewDoc)
      tx.update(bookingRef, { reviewed: true })
      propertiesRepo.adjustRating(tx, property, input.rating, 1)
    })
  },

  /** Hides or restores a review and adjusts the rating. Returns false if nothing changed. */
  async setHidden(id: number, hidden: boolean) {
    return firestore.runTransaction(async (tx) => {
      const ref = col(C.reviews).doc(String(id))
      const r = (await tx.get(ref)).data() as ReviewDoc | undefined
      if (!r || !!r.hiddenAt === hidden) return false
      const property = (await propertiesRepo.get(r.propertyId, tx)) as PropertyDoc
      tx.update(ref, { hiddenAt: hidden ? nowISO() : null })
      propertiesRepo.adjustRating(tx, property, r.rating, hidden ? -1 : 1)
      return true
    })
  },

  async listForAdmin(q: string | null): Promise<AdminReview[]> {
    const [rows, properties] = await Promise.all([all<ReviewDoc>(col(C.reviews)), all<PropertyDoc>(col(C.properties))])
    const byId = new Map(properties.map((p) => [p.id, p]))
    const s = q?.toLowerCase()
    return rows
      .filter((r) => !s || [r.comment, r.authorName, byId.get(r.propertyId)?.title].some((v) => v?.toLowerCase().includes(s)))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 300)
      .map((r) => ({ ...toReview(r), hidden: !!r.hiddenAt, property: { slug: byId.get(r.propertyId)?.slug ?? '', title: byId.get(r.propertyId)?.title ?? 'Deleted listing' } }))
  },
}
