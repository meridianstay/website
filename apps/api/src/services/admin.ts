import { todayISO, type ListingStatus, type UserRole } from '@meridian/shared'
import { transaction } from '../db/pool'
import { auditLogRepo, bookingsRepo, messagesRepo, propertiesRepo, sessionsRepo, usersRepo, type MessageStatus } from '../repositories'
import { AppError, notFound } from '../http/errors'
import { checkLength, collect } from '../http/validate'

// Control-center actions. Every change is written to the audit log.

export const adminService = {
  async approveListing(adminId: number, id: number) {
    if (!(await propertiesRepo.approve(id))) throw notFound('listing')
    await auditLogRepo.record(adminId, 'listing.approve', 'property', id)
  },

  async rejectListing(adminId: number, id: number, reason: string) {
    collect({ reason: checkLength(reason, 'Reason', 5, 500) })
    if (!(await propertiesRepo.reject(id, reason))) throw notFound('listing')
    await auditLogRepo.record(adminId, 'listing.reject', 'property', id, { reason })
  },

  async featureListing(adminId: number, id: number, rank: number | null) {
    collect({ rank: rank === null || (Number.isInteger(rank) && rank >= 1 && rank <= 99) ? null : 'Rank must be between 1 and 99.' })
    if (!(await propertiesRepo.setFeatured(id, rank))) throw new AppError(400, 'Only live listings can be featured.')
    await auditLogRepo.record(adminId, rank === null ? 'listing.unfeature' : 'listing.feature', 'property', id, { rank })
  },

  listListings(status: ListingStatus | null, q: string | null) {
    return propertiesRepo.listForAdmin({ status, q })
  },

  listBookings(q: string | null) {
    return bookingsRepo.listAll(q, todayISO())
  },

  async cancelBooking(adminId: number, code: string) {
    if (!(await bookingsRepo.cancelByAdmin(code, todayISO()))) throw new AppError(400, 'Only upcoming or current confirmed bookings can be cancelled.')
    await auditLogRepo.record(adminId, 'booking.cancel', 'booking', code)
  },

  /** Changes a user's role and/or suspends them. Suspension signs them out everywhere. */
  async updateUser(adminId: number, id: number, change: { role?: UserRole; suspended?: boolean }) {
    if (id === adminId) throw new AppError(400, 'You can’t change your own role or suspend yourself.')
    if (change.role !== undefined && !['guest', 'host', 'admin'].includes(change.role)) collect({ role: 'Choose guest, host or admin.' })
    const found = await transaction(async (db) => {
      if (!(await usersRepo.updateAccess(id, change, db))) return false
      if (change.suspended) await sessionsRepo.deleteAllForUser(id, db)
      if (change.role) await auditLogRepo.record(adminId, 'user.role', 'user', id, { role: change.role }, db)
      if (change.suspended !== undefined) await auditLogRepo.record(adminId, change.suspended ? 'user.suspend' : 'user.restore', 'user', id, {}, db)
      return true
    })
    if (!found) throw notFound('user')
  },

  async setMessageStatus(adminId: number, id: number, status: string) {
    collect({ status: ['new', 'read', 'closed'].includes(status) ? null : 'Choose new, read or closed.' })
    if (!(await messagesRepo.setStatus(id, status as MessageStatus))) throw notFound('message')
    await auditLogRepo.record(adminId, 'message.status', 'message', id, { status })
  },
}
