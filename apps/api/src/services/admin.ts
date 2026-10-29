import { todayISO, type ListingStatus, type Management, type Me, type UserRole } from '@meridian/shared'
import { auth } from '../store/firebase'
import { nowISO } from '../store/db'
import { auditLogRepo, bookingsRepo, clientSitesRepo, messagesRepo, promotionsRepo, propertiesRepo, toMe, usersRepo, type MessageStatus } from '../repositories'
import { subscriptionService } from './subscriptions'
import { AppError, notFound } from '../http/errors'
import { checkLength, collect } from '../http/validate'
import { notifyService } from './notify'
import { siteOrigin } from '../http/origin'

// Control-center actions. Every change is written to the audit log.

async function requireListing(id: number) {
  const p = await propertiesRepo.get(id)
  if (!p) throw notFound('listing')
  return p
}

/** Tells the host what our team decided about their listing. */
async function tellHost(event: 'listing.approved' | 'listing.rejected', id: number, reason = '') {
  const property = await propertiesRepo.get(id)
  if (!property) return
  const host = await usersRepo.findById(property.hostId)
  if (!host) return
  await notifyService.send(event, { name: host.name, email: host.email, phone: host.phone }, {
    property: property.title,
    reason,
    link: `${siteOrigin()}/host/listings`,
  })
}

export const adminService = {
  async approveListing(admin: Me, id: number) {
    await requireListing(id)
    await propertiesRepo.setFields(id, { status: 'Approved', rejectionReason: null, approvedAt: nowISO() })
    await auditLogRepo.record(admin, 'listing.approve', 'property', id)
    await tellHost('listing.approved', id)
  },

  async rejectListing(admin: Me, id: number, reason: string) {
    collect({ reason: checkLength(reason, 'Reason', 5, 500) })
    await requireListing(id)
    await propertiesRepo.setFields(id, { status: 'Rejected', rejectionReason: reason, approvedAt: null, featuredRank: null })
    await auditLogRepo.record(admin, 'listing.reject', 'property', id, { reason })
    await tellHost('listing.rejected', id, reason)
  },

  async featureListing(admin: Me, id: number, rank: number | null) {
    collect({ rank: rank === null || (Number.isInteger(rank) && rank >= 1 && rank <= 99) ? null : 'Rank must be between 1 and 99.' })
    const p = await requireListing(id)
    if (rank !== null && p.status !== 'Approved') throw new AppError(400, 'Only live listings can be featured.')
    await propertiesRepo.setFields(id, { featuredRank: rank })
    await auditLogRepo.record(admin, rank === null ? 'listing.unfeature' : 'listing.feature', 'property', id, { rank })
  },

  async listListings(status: ListingStatus | null, q: string | null) {
    const [users, promotedIds] = await Promise.all([usersRepo.list({}), promotionsRepo.livePropertyIds(todayISO())])
    return propertiesRepo.listForAdmin({ status, q }, new Map(users.map((u) => [u.id, u])), promotedIds)
  },

  listBookings: (q: string | null, status: string | null) => bookingsRepo.listAll(q, status, todayISO()),

  /** "BookMyGetaway Assured": the team has inspected and verified the property. */
  async setAssured(admin: Me, id: number, assured: boolean) {
    await requireListing(id)
    await propertiesRepo.setFields(id, { assured })
    await auditLogRepo.record(admin, assured ? 'listing.assure' : 'listing.unassure', 'property', id)
  },

  /** Managed listings are run by BookMyGetaway: instant booking and the managed commission. */
  async setManagement(admin: Me, id: number, management: string) {
    collect({ management: management === 'managed' || management === 'self' ? null : 'Choose managed or self-managed.' })
    await requireListing(id)
    await propertiesRepo.setFields(id, { management: management as Management })
    await auditLogRepo.record(admin, 'listing.management', 'property', id, { management })
  },

  /** Changes a user's role and/or suspends them. Suspension disables their Firebase login and signs them out. */
  async updateUser(admin: Me, id: number, change: { role?: UserRole; suspended?: boolean }) {
    if (id === admin.id) throw new AppError(400, 'You can’t change your own role or suspend yourself.')
    if (change.role !== undefined && !['guest', 'host', 'admin'].includes(change.role)) collect({ role: 'Choose guest, host or admin.' })
    const user = await usersRepo.findById(id)
    if (!user) throw notFound('user')

    if (change.role) {
      await usersRepo.update(user.uid, { role: change.role })
      await auditLogRepo.record(admin, 'user.role', 'user', id, { role: change.role })
    }
    if (change.suspended !== undefined) {
      const now = nowISO()
      await usersRepo.update(user.uid, change.suspended ? { suspendedAt: now, sessionsRevokedAt: now } : { suspendedAt: null })
      // Also disable the Firebase account so the person can't get new sign-in tokens.
      await auth.updateUser(user.uid, { disabled: change.suspended }).catch(() => {})
      if (change.suspended) await auth.revokeRefreshTokens(user.uid).catch(() => {})
      await auditLogRepo.record(admin, change.suspended ? 'user.suspend' : 'user.restore', 'user', id)
    }
  },

  async setMessageStatus(admin: Me, id: number, status: string) {
    collect({ status: ['new', 'read', 'closed'].includes(status) ? null : 'Choose new, read or closed.' })
    if (!(await messagesRepo.setStatus(id, status as MessageStatus))) throw notFound('message')
    await auditLogRepo.record(admin, 'message.status', 'message', id, { status })
  },

  /**
   * Everything about one person in a single answer: who they are, what they run, what they have
   * booked, what they pay and what their website is doing. The control centre's user page is built
   * from this, so no part of a person's standing has to be hunted for across five screens.
   */
  async userDetail(id: number) {
    const user = await usersRepo.findById(id)
    if (!user) throw notFound('user')
    const today = todayISO()

    const [listings, asGuest, asHost, subscription, site] = await Promise.all([
      propertiesRepo.listForHost(id),
      bookingsRepo.listForGuest(id, today),
      bookingsRepo.listForHost(id, today).catch(() => []),
      subscriptionService.mine(toMe(user)).catch(() => null),
      clientSitesRepo.find(id),

    ])

    const spent = asGuest.reduce((sum, b) => sum + (b.status === 'Confirmed' || b.status === 'Completed' ? b.total : 0), 0)
    return {
      user: { ...toMe(user), suspended: !!user.suspendedAt, createdAt: user.createdAt },
      listings,
      bookings: { asGuest, asHost },
      spent,
      subscription: subscription && {
        planId: subscription.subscription.planId,
        status: subscription.subscription.status,
        expiresAt: subscription.subscription.expiresAt,
        active: subscription.active,
        daysLeft: subscription.daysLeft,
        planName: subscription.plans.find((p) => p.id === subscription.subscription.planId)?.name ?? null,
        paid: subscription.subscription.terms.reduce((sum, t) => sum + t.amount, 0),
      },
      site: site && {
        businessName: site.content.businessName,
        slug: site.published?.slug || site.content.slug,
        status: site.status,
        domain: site.domain,
        published: !!site.published,
        updatedAt: site.updatedAt,
      },
    }
  },


  /** One booking in full, with the people on both sides and what has been paid. */
  async bookingDetail(code: string) {
    // The stored document carries who and what it is for; the view of it carries the money.
    const raw = await bookingsRepo.find(code.toUpperCase())
    if (!raw) throw notFound('booking')
    const booking = (await adminService.listBookings(code, null)).find((b) => b.code === raw.code)
    if (!booking) throw notFound('booking')
    const [property, guest, host] = await Promise.all([
      propertiesRepo.get(raw.propertyId),
      usersRepo.findById(raw.guestId),
      usersRepo.findById(raw.hostId),
    ])
    return {
      booking,
      guest: guest && { id: guest.id, name: guest.name, email: guest.email, phone: guest.phone, createdAt: guest.createdAt },
      host: host && { id: host.id, name: host.name, email: host.email, phone: host.phone },
      property: property && { id: property.id, slug: property.slug, title: property.title, address: property.address, city: property.city, region: property.region },
      // The moments this booking passed through, which the booking view itself doesn't carry.
      timeline: {
        confirmedAt: raw.confirmedAt,
        cancelledAt: raw.cancelledAt,
        decidedAt: raw.decidedAt,
        paymentId: raw.razorpayPaymentId ?? null,
      },
    }
  },

}
