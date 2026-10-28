import type { HostStats } from '@meridian/shared'
import { RENEWAL_WARNING_DAYS, daysLeft, defaultPayouts, payableUpTo, subscriptionActive, withPlanDefaults, type AboutStats, type AdminStats } from '@meridian/shared'
import { C, all, col } from '../store/db'
import { cached } from '../store/cache'
import { promotionsRepo } from './promotions'
import { subscriptionsRepo } from './subscriptions'
import { clientSitesRepo } from './clientSites'
import { calendarFeedsRepo } from './calendarFeeds'
import { contentRepo } from './content'
import { payoutsRepo } from './payouts'
import { keptMinor, withDefaults, type BookingDoc } from './bookings'
import type { PropertyDoc } from './properties'
import type { UserDoc } from './users'

// Dashboard figures, computed from the collections.

/** The part of a host's figures that comes straight from the collections; services add the rest. */
export type HostBaseStats = Pick<HostStats, 'earnings' | 'requests' | 'listings' | 'live' | 'rated' | 'avgRating' | 'upcoming'>

export const statsRepo = {
  async forHost(hostId: number, today: string): Promise<HostBaseStats> {
    const [listings, bookings] = await Promise.all([
      all<PropertyDoc>(col(C.properties).where('hostId', '==', hostId)),
      all<BookingDoc>(col(C.bookings).where('hostId', '==', hostId)).then((r) => r.map(withDefaults)),
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
    const [properties, users, bookings, messages, reviews, adRevenue, subs, sites, feeds, plans, payouts, payoutConfig] = await Promise.all([
      all<PropertyDoc>(col(C.properties)),
      all<UserDoc>(col(C.users)),
      all<BookingDoc>(col(C.bookings)).then((r) => r.map(withDefaults)),
      all<{ status: string }>(col(C.messages).select('status')),
      all<{ hiddenAt: string | null }>(col(C.reviews).select('hiddenAt')),
      promotionsRepo.spendTotal(),
      subscriptionsRepo.list(),
      clientSitesRepo.list(),
      calendarFeedsRepo.list(),
      contentRepo.settings().then((s) => withPlanDefaults(s.subscriptions?.plans)),
      payoutsRepo.list(),
      contentRepo.settings().then((s) => s.payouts ?? defaultPayouts),
    ])

    const now = new Date().toISOString()
    const paidUp = subs.filter((s) => subscriptionActive(s, now))
    const priceOf = (planId: string | null) => plans.find((p) => p.id === planId)?.pricePerYear ?? 0
    // A feed only counts as a feed once it has a url; the export tokens share the collection.
    const liveFeeds = feeds.filter((f) => !!f.url)

    // What hosts have earned on stays that are out of their hold period, less whatever has already
    // been put into a payout. A failed payout went back into the queue, so it doesn't count as sent.
    const cutoff = payableUpTo(today, payoutConfig.holdDays)
    const earned = bookings
      .filter((b) => keptMinor(b) > 0 && b.checkOut <= cutoff)
      .reduce((sum, b) => sum + b.hostPayoutMinor, 0) / 100
    const alreadyPaid = payouts.filter((p) => p.status !== 'Failed').reduce((sum, p) => sum + p.net, 0)
    const payoutsOwed = Math.max(0, Math.round((earned - alreadyPaid) * 100) / 100)
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
      adRevenue,
      new_messages: messages.filter((m) => m.status === 'new').length,
      reviews: reviews.filter((r) => !r.hiddenAt).length,
      subscriptions: {
        paying: paidUp.length,
        lapsed: subs.filter((s) => !subscriptionActive(s, now) && s.terms.length > 0).length,
        yearly: paidUp.reduce((sum, s) => sum + priceOf(s.planId), 0),
        renewingSoon: paidUp.filter((s) => {
          const left = daysLeft(s)
          return left !== null && left <= RENEWAL_WARNING_DAYS
        }).length,
      },
      sites: {
        live: sites.filter((s) => !!s.published).length,
        pendingReview: sites.filter((s) => s.status === 'Pending').length,
        pendingDomains: sites.filter((s) => s.domain.status === 'pending').length,
      },
      calendars: {
        feeds: liveFeeds.length,
        failing: liveFeeds.filter((f) => f.status === 'failing').length,
        clashes: liveFeeds.reduce((n, f) => n + (f.clashes?.length ?? 0), 0),
      },
      payoutsOwed,
    }
  },

  /** Live figures for the About us page. Counted across every listing and booking, so cached. */
  async forAbout(): Promise<AboutStats> {
    return cached('stats', 'about', async () => this.aboutStats())
  },

  async aboutStats(): Promise<AboutStats> {
    const [live, bookings] = await Promise.all([
      all<PropertyDoc>(col(C.properties).where('status', '==', 'Approved')),
      all<BookingDoc>(col(C.bookings)).then((r) => r.map(withDefaults)),
    ])
    return {
      liveStays: live.length,
      hosts: new Set(live.map((p) => p.hostId)).size,
      destinations: new Set(live.map((p) => `${p.city}|${p.region}`)).size,
      states: new Set(live.map((p) => p.region)).size,
      guestNights: bookings.filter((b) => keptMinor(b) > 0 || b.status === 'Confirmed').reduce((n, b) => n + b.nights, 0),
      managedStays: live.filter((p) => p.management === 'managed').length,
    }
  },
}
