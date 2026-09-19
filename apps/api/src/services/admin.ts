import { todayISO, type ListingStatus, type Me, type UserRole } from '@meridian/shared'
import { auth } from '../store/firebase'
import { nowISO } from '../store/db'
import { auditLogRepo, bookingsRepo, messagesRepo, propertiesRepo, usersRepo, type MessageStatus } from '../repositories'
import { AppError, notFound } from '../http/errors'
import { checkLength, collect } from '../http/validate'

// Control-center actions. Every change is written to the audit log.

async function requireListing(id: number) {
  const p = await propertiesRepo.get(id)
  if (!p) throw notFound('listing')
  return p
}

export const adminService = {
  async approveListing(admin: Me, id: number) {
    await requireListing(id)
    await propertiesRepo.setFields(id, { status: 'Approved', rejectionReason: null, approvedAt: nowISO() })
    await auditLogRepo.record(admin, 'listing.approve', 'property', id)
  },

  async rejectListing(admin: Me, id: number, reason: string) {
    collect({ reason: checkLength(reason, 'Reason', 5, 500) })
    await requireListing(id)
    await propertiesRepo.setFields(id, { status: 'Rejected', rejectionReason: reason, approvedAt: null, featuredRank: null })
    await auditLogRepo.record(admin, 'listing.reject', 'property', id, { reason })
  },

  async featureListing(admin: Me, id: number, rank: number | null) {
    collect({ rank: rank === null || (Number.isInteger(rank) && rank >= 1 && rank <= 99) ? null : 'Rank must be between 1 and 99.' })
    const p = await requireListing(id)
    if (rank !== null && p.status !== 'Approved') throw new AppError(400, 'Only live listings can be featured.')
    await propertiesRepo.setFields(id, { featuredRank: rank })
    await auditLogRepo.record(admin, rank === null ? 'listing.unfeature' : 'listing.feature', 'property', id, { rank })
  },

  async listListings(status: ListingStatus | null, q: string | null) {
    const users = await usersRepo.list({})
    return propertiesRepo.listForAdmin({ status, q }, new Map(users.map((u) => [u.id, u])))
  },

  listBookings: (q: string | null) => bookingsRepo.listAll(q, todayISO()),

  async cancelBooking(admin: Me, code: string) {
    const today = todayISO()
    if (!(await bookingsRepo.cancel(code, (b) => b.checkOut > today))) throw new AppError(400, 'Only upcoming or current confirmed bookings can be cancelled.')
    await auditLogRepo.record(admin, 'booking.cancel', 'booking', code)
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
}
