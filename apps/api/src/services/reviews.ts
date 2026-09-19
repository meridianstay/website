import { todayISO, type Me } from '@meridian/shared'
import { transaction } from '../db/pool'
import { auditLogRepo, bookingsRepo, propertiesRepo, reviewsRepo } from '../repositories'
import { AppError } from '../http/errors'
import { checkLength, collect } from '../http/validate'

// Reviews: only after a finished stay, once per booking. Ratings stay in sync.

/** "Priya Natarajan" → "Priya N." */
export const reviewerName = (fullName: string) => {
  const [first, ...rest] = fullName.trim().split(/\s+/)
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first
}

export const reviewService = {
  async post(guest: Me, slug: string, input: { bookingCode: string; rating: number; comment: string }) {
    const { rating, comment } = input
    collect({
      rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? null : 'Choose a rating from 1 to 5 stars.',
      comment: checkLength(comment, 'Your review', 10, 2000),
    })
    const booking = await bookingsRepo.findReviewable(input.bookingCode, slug, guest.id, todayISO())
    if (!booking) throw new AppError(403, 'You can review a stay after your check-out, once per booking.')
    await transaction(async (db) => {
      await reviewsRepo.insert({ propertyId: booking.property_id, userId: guest.id, bookingId: booking.id, authorName: reviewerName(guest.name), rating, comment }, db)
      await propertiesRepo.adjustRating(booking.property_id, rating, 1, db)
    })
  },

  /** Hiding removes the review from the listing's rating; restoring adds it back. */
  async setHidden(adminId: number, id: number, hidden: boolean) {
    const changed = await transaction(async (db) => {
      const review = await reviewsRepo.setHidden(id, hidden, db)
      if (!review) return false
      await propertiesRepo.adjustRating(review.property_id, review.rating, hidden ? -1 : 1, db)
      await auditLogRepo.record(adminId, hidden ? 'review.hide' : 'review.restore', 'review', id, {}, db)
      return true
    })
    if (!changed) throw new AppError(400, hidden ? 'That review is already hidden.' : 'That review is already visible.')
  },
}
