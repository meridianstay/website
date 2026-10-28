import { addDays, siteAddress, todayISO, type HostStats, type Me } from '@meridian/shared'
import { calendarFeedsRepo, clientSitesRepo, datesIn, propertiesRepo, statsRepo, bookingsRepo } from '../repositories'
import { payoutService } from './payouts'
import { subscriptionService, subscriptionSettings } from './subscriptions'
import { clientSiteService } from './clientSites'
import { hasUnpublishedChanges, planById, subscriptionActive, daysLeft, freePlan } from '@meridian/shared'
import { subscriptionsRepo } from '../repositories'

// The host dashboard's figures. One answer rather than six calls, because the first screen of the
// client portal should not take six round trips to draw.

export const hostDashboard = {
  async stats(host: Me): Promise<HostStats> {
    const today = todayISO()
    const [base, listings, payouts, site, feeds, settings, subscription] = await Promise.all([
      statsRepo.forHost(host.id, today),
      propertiesRepo.listForHost(host.id),
      payoutService.summary(host.id),
      clientSitesRepo.find(host.id),
      calendarFeedsRepo.forProperties((await propertiesRepo.listForHost(host.id)).map((l) => l.id)),
      subscriptionSettings(),
      subscriptionsRepo.get(host.id),
    ])

    // How full the next month is, across every live stay.
    const live = listings.filter((l) => l.status === 'Approved')
    const horizon = addDays(today, 30)
    const bookings = await bookingsRepo.forHostRaw(host.id)
    const bookedNights = bookings
      .filter((b) => b.status === 'Confirmed' && b.checkOut > today && b.checkIn < horizon)
      .reduce((sum, b) => sum + datesIn(b.checkIn, b.checkOut).filter((d: string) => d >= today && d < horizon).length, 0)

    const paidPlan = subscriptionActive(subscription) ? planById(settings.plans, subscription.planId) : null
    const plan = paidPlan ?? freePlan(settings.plans)
    const entitlements = await subscriptionService.entitlementsOf(host.id)

    return {
      ...base,
      rejected: listings.filter((l) => l.status === 'Rejected').length,
      nights: { booked: bookedNights, available: live.length * 30 },
      payouts: { due: payouts.due, pending: payouts.pending, processing: payouts.processing, paidToDate: payouts.paidToDate },
      site: {
        status: site?.status ?? 'none',
        address: site ? siteAddress(site.published?.slug || site.content.slug, site.domain, clientSiteService.baseDomain()) : '',
        live: !!site?.published,
        unpublished: site ? hasUnpublishedChanges(site) : false,
      },
      plan: {
        id: plan.id,
        name: plan.name,
        active: !!paidPlan,
        daysLeft: paidPlan ? daysLeft(subscription) : null,
        maxStaysOnSite: entitlements.maxStaysOnSite,
        customDomain: entitlements.customDomain,
        commissionFree: entitlements.commissionFree,
      },
      calendars: {
        feeds: feeds.filter((f) => !!f.url).length,
        failing: feeds.filter((f) => !!f.url && f.status === 'failing').length,
        clashes: feeds.reduce((n, f) => n + (f.clashes?.length ?? 0), 0),
      },
    }
  },
}
