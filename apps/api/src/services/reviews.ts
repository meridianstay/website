import { todayISO, type Me } from '@meridian/shared'
import { auditLogRepo, bookingsRepo, propertiesRepo, reviewsRepo } from '../repositories'
import { AppError } from '../http/errors'
import { checkLength, collect } from '../http/validate'

// Reviews: only after a finished stay, once per booking. Ratings stay in sync.

/** "Priya Natarajan" → "Priya N." */
export const reviewerName = (fullName: string) => {
  const [first, ...rest] = fullName.trim().split(/\s+/)
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first || 'Guest'
}

export const reviewService = {
  /** Guests rate the property and the service (1–5 each); the overall rating is their average. */
  async post(guest: Me, slug: string, input: { bookingCode: string; rating?: number; propertyRating?: number; serviceRating?: number; comment: string }) {
    const { comment } = input
    // Older clients send one rating; use it for both.
    const propertyRating = Number(input.propertyRating ?? input.rating)
    const serviceRating = Number(input.serviceRating ?? input.rating)
    const star = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5
    const rating = (propertyRating + serviceRating) / 2
    collect({
      propertyRating: star(propertyRating) ? null : 'Rate the property from 1 to 5 stars.',
      serviceRating: star(serviceRating) ? null : 'Rate the host’s service from 1 to 5 stars.',
      comment: checkLength(comment, 'Your review', 10, 2000),
    })
    const [booking, property] = await Promise.all([bookingsRepo.find(input.bookingCode), propertiesRepo.findBySlug(slug)])
    const allowed = booking && property && booking.propertyId === property.id && booking.guestId === guest.id &&
      booking.status === 'Confirmed' && booking.checkOut <= todayISO() && !booking.reviewed
    if (!allowed) throw new AppError(403, 'You can review a stay after your check-out, once per booking.')
    await reviewsRepo.addForBooking({ propertyId: property.id, userId: guest.id, bookingCode: booking.code, authorName: reviewerName(guest.name), rating, propertyRating, serviceRating, comment })
  },

  /** Hiding removes the review from the listing's rating; restoring adds it back. */
  async setHidden(admin: Me, id: number, hidden: boolean) {
    if (!(await reviewsRepo.setHidden(id, hidden))) throw new AppError(400, hidden ? 'That review is already hidden.' : 'That review is already visible.')
    await auditLogRepo.record(admin, hidden ? 'review.hide' : 'review.restore', 'review', id)
  },
}
