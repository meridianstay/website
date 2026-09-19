import type { AdminStats, HostStats } from '@meridian/shared'
import { C, all, col } from '../store/db'
import { keptMinor, type BookingDoc } from './bookings'
import type { PropertyDoc } from './properties'
import type { UserDoc } from './users'

// Dashboard figures, computed from the collections.

export const statsRepo = {
  async forHost(hostId: number, today: string): Promise<HostStats> {
    const [listings, bookings] = await Promise.all([
      all<PropertyDoc>(col(C.properties).where('hostId', '==', hostId)),
      all<BookingDoc>(col(C.bookings).where('hostId', '==', hostId)),
    ])
    const confirmed = bookings.filter((b) => b.status === 'Confirmed')
    const rated = listings.filter((p) => p.reviewCount > 0)
    return {
      earnings: bookings.filter((b) => keptMinor(b) > 0).reduce((s, b) => s + b.hostPayoutMinor, 0) / 100,
      requests: bookings.filter((b) => b.status === 'Requested').length,
      listings: listings.length,
      live: listings.filter((p) => p.status === 'Approved').length,
      rated: rated.length,
      avgRating: rated.length ? Math.round((rated.reduce((s, p) => s + p.ratingAvg, 0) / rated.length) * 100) / 100 : null,
      upcoming: confirmed.filter((b) => b.checkOut > today).length,
    }
  },

  async forAdmin(today: string): Promise<AdminStats> {
    const [properties, users, bookings, messages, reviews] = await Promise.all([
      all<PropertyDoc>(col(C.properties)),
      all<UserDoc>(col(C.users)),
      all<BookingDoc>(col(C.bookings)),
      all<{ status: string }>(col(C.messages).select('status')),
      all<{ hiddenAt: string | null }>(col(C.reviews).select('hiddenAt')),
    ])
    const confirmed = bookings.filter((b) => b.status === 'Confirmed')
    return {
      listings: properties.length,
      live: properties.filter((p) => p.status === 'Approved').length,
      pending: properties.filter((p) => p.status === 'Pending').length,
      users: users.length,
      hosts: users.filter((u) => u.role === 'host').length,
      suspended: users.filter((u) => u.suspendedAt).length,
      bookings: confirmed.length,
      upcoming: confirmed.filter((b) => b.checkOut > today).length,
      requests: bookings.filter((b) => b.status === 'Requested').length,
      gbv: bookings.reduce((s, b) => s + keptMinor(b), 0) / 100,
      commission: bookings.filter((b) => keptMinor(b) > 0).reduce((s, b) => s + b.commissionMinor, 0) / 100,
      new_messages: messages.filter((m) => m.status === 'new').length,
      reviews: reviews.filter((r) => !r.hiddenAt).length,
    }
  },
}
