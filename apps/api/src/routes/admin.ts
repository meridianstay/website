import { Hono } from 'hono'
import { todayISO, type ListingStatus, type UserRole } from '@meridian/shared'
import { auditLogRepo, contentRepo, messagesRepo, reviewsRepo, statsRepo, usersRepo, type MessageStatus } from '../repositories'
import { integrationsService } from '../services/integrations'
import { bookingService } from '../services/bookings'
import { paymentsService } from '../services/payments'
import { homepageService, staysFor } from '../services/homepage'
import { couponService } from '../services/coupons'
import { newBlock, type HomeBlock } from '@meridian/shared'
import { demoResetAllowed, resetDemo } from '../store/resetDemo'
import { adminService } from '../services/admin'
import { contentService } from '../services/content'
import { reviewService } from '../services/reviews'
import { explorerService } from '../services/explorer'
import { body, currentUser, requireRole, type AppEnv } from '../http/auth'
import { AppError } from '../http/errors'
import { str } from '../http/validate'

export const adminRoutes = new Hono<AppEnv>()
adminRoutes.use('/admin/*', requireRole('admin'))

const admin = (c: Parameters<typeof currentUser>[0]) => currentUser(c)
const q = (v: string | undefined) => (v && v.trim() ? v.trim() : null)
const oneOf = <T extends string>(v: string | undefined, allowed: readonly T[]) => (allowed.includes(v as T) ? (v as T) : null)
const done = () => new Response(null, { status: 204 })

adminRoutes.get('/admin/stats', async (c) => {
  await bookingService.sweepSoon()
  return c.json(await statsRepo.forAdmin(todayISO()))
})

// ─── Listings ────────────────────────────────────────────────────────────────
adminRoutes.get('/admin/listings', async (c) =>
  c.json({ listings: await adminService.listListings(oneOf<ListingStatus>(c.req.query('status'), ['Draft', 'Pending', 'Approved', 'Rejected']), q(c.req.query('q'))) }))
adminRoutes.post('/admin/listings/:id/approve', async (c) => (await adminService.approveListing(admin(c), Number(c.req.param('id'))), done()))
adminRoutes.post('/admin/listings/:id/reject', async (c) => (await adminService.rejectListing(admin(c), Number(c.req.param('id')), str((await body(c)).reason)), done()))
adminRoutes.post('/admin/listings/:id/assured', async (c) =>
  (await adminService.setAssured(admin(c), Number(c.req.param('id')), (await body(c)).assured === true), done()))
adminRoutes.post('/admin/listings/:id/management', async (c) =>
  (await adminService.setManagement(admin(c), Number(c.req.param('id')), str((await body(c)).management)), done()))
adminRoutes.post('/admin/listings/:id/feature', async (c) => {
  const rank = (await body(c)).rank
  await adminService.featureListing(admin(c), Number(c.req.param('id')), rank === null ? null : Number(rank))
  return done()
})

// ─── Bookings ────────────────────────────────────────────────────────────────
adminRoutes.get('/admin/bookings', async (c) => {
  await bookingService.sweepSoon()
  return c.json({ bookings: await adminService.listBookings(q(c.req.query('q')), q(c.req.query('status'))) })
})
adminRoutes.post('/admin/bookings/:code/cancel', async (c) => (await bookingService.cancelByAdmin(admin(c), c.req.param('code')), done()))
adminRoutes.post('/admin/bookings/:code/refund', async (c) => (await bookingService.retryRefund(admin(c), c.req.param('code')), done()))

// ─── Coupons ─────────────────────────────────────────────────────────────────
adminRoutes.get('/admin/coupons', async (c) => c.json({ coupons: await couponService.list() }))
adminRoutes.post('/admin/coupons', async (c) => c.json({ coupon: await couponService.save(admin(c), await body(c)) }, 201))
adminRoutes.put('/admin/coupons/:code', async (c) => c.json({ coupon: await couponService.save(admin(c), await body(c), c.req.param('code')) }))
adminRoutes.delete('/admin/coupons/:code', async (c) => (await couponService.remove(admin(c), c.req.param('code')), done()))

// ─── Users ───────────────────────────────────────────────────────────────────
adminRoutes.get('/admin/users', async (c) =>
  c.json({ users: await usersRepo.list({ q: q(c.req.query('q')), role: oneOf<UserRole>(c.req.query('role'), ['guest', 'host', 'admin']) }) }))
adminRoutes.patch('/admin/users/:id', async (c) => {
  const b = await body(c)
  await adminService.updateUser(admin(c), Number(c.req.param('id')), {
    role: b.role === undefined ? undefined : (str(b.role) as UserRole),
    suspended: typeof b.suspended === 'boolean' ? b.suspended : undefined,
  })
  return done()
})

// ─── Reviews ─────────────────────────────────────────────────────────────────
adminRoutes.get('/admin/reviews', async (c) => c.json({ reviews: await reviewsRepo.listForAdmin(q(c.req.query('q'))) }))
adminRoutes.post('/admin/reviews/:id/hide', async (c) => (await reviewService.setHidden(admin(c), Number(c.req.param('id')), true), done()))
adminRoutes.post('/admin/reviews/:id/restore', async (c) => (await reviewService.setHidden(admin(c), Number(c.req.param('id')), false), done()))

// ─── Messages ────────────────────────────────────────────────────────────────
adminRoutes.get('/admin/messages', async (c) =>
  c.json({ messages: await messagesRepo.list(oneOf<MessageStatus>(c.req.query('status'), ['new', 'read', 'closed'])) }))
adminRoutes.patch('/admin/messages/:id', async (c) => (await adminService.setMessageStatus(admin(c), Number(c.req.param('id')), str((await body(c)).status)), done()))

// ─── Website content ─────────────────────────────────────────────────────────
adminRoutes.get('/admin/settings', async (c) => c.json(await contentRepo.settings()))
adminRoutes.put('/admin/settings/:key', async (c) => {
  const key = c.req.param('key')
  return c.json({ [key]: await contentService.saveSetting(admin(c), key, await body(c)) })
})
adminRoutes.get('/admin/homepage', async (c) => c.json({ layout: await homepageService.layout() }))
adminRoutes.put('/admin/homepage', async (c) => c.json({ layout: await homepageService.save(admin(c), await body(c)) }))
/** Which stays a "Stays" section would show, for the editor's preview. */
adminRoutes.post('/admin/homepage/preview', async (c) => {
  const b = (await body(c)) as Partial<HomeBlock>
  const properties = await staysFor({ ...newBlock('stays', 'preview'), ...b, maxPrice: b.maxPrice == null ? null : Number(b.maxPrice), limit: Number(b.limit) || 6 })
  return c.json({ properties })
})
adminRoutes.get('/admin/about', async (c) => c.json({ page: await contentRepo.about(), stats: await statsRepo.forAbout() }))
adminRoutes.put('/admin/about', async (c) => c.json({ page: await contentService.saveAbout(admin(c), await body(c)) }))
adminRoutes.get('/admin/pages', async (c) => c.json({ pages: await contentRepo.allPages() }))
adminRoutes.put('/admin/pages/:slug', async (c) => (await contentService.savePage(admin(c), c.req.param('slug'), await body(c)), done()))
adminRoutes.delete('/admin/pages/:slug', async (c) => (await contentService.deletePage(admin(c), c.req.param('slug')), done()))

// ─── Activity log ────────────────────────────────────────────────────────────
adminRoutes.get('/admin/audit', async (c) => c.json({ entries: await auditLogRepo.list() }))

// ─── Settings → Integrations ─────────────────────────────────────────────────
adminRoutes.get('/admin/integrations', async (c) => c.json(await integrationsService.status()))

// ─── Settings → Payments (Razorpay). Secrets are write-only. ─────────────────
const publicBase = (c: { req: { url: string; header: (k: string) => string | undefined } }) => {
  const url = new URL(c.req.url)
  const host = c.req.header('x-forwarded-host') ?? url.host
  const proto = c.req.header('x-forwarded-proto') ?? url.protocol.replace(':', '')
  return `${proto}://${host}`
}
adminRoutes.get('/admin/payments', async (c) => c.json(await paymentsService.view(publicBase(c))))
adminRoutes.put('/admin/payments', async (c) => {
  await paymentsService.save(admin(c), await body(c))
  return c.json(await paymentsService.view(publicBase(c)))
})
adminRoutes.post('/admin/payments/test', async (c) => c.json(await paymentsService.testConnection()))

// ─── Demo data (client previews only) ────────────────────────────────────────
adminRoutes.get('/admin/demo', (c) => c.json({ resetAllowed: demoResetAllowed() }))
adminRoutes.post('/admin/demo/reset', async (c) => {
  if (!demoResetAllowed()) throw new AppError(403, 'Demo reset is only available while SEED_DEMO_DATA is true.')
  const who = admin(c)
  await resetDemo()
  await auditLogRepo.record(who, 'demo.reset', 'settings', 'demo')
  return done()
})

// ─── Database screen ─────────────────────────────────────────────────────────
const rowKey = (raw: string | undefined) => {
  try {
    const key = JSON.parse(raw ?? '')
    if (key && typeof key === 'object' && !Array.isArray(key)) return key as Record<string, unknown>
  } catch {
    // fall through
  }
  throw new AppError(400, 'Missing row key.')
}

adminRoutes.get('/admin/db/tables', async (c) => c.json({ tables: await explorerService.listTables() }))
adminRoutes.get('/admin/db/tables/:table', async (c) => {
  const p = c.req.query()
  return c.json(await explorerService.browse(c.req.param('table'), {
    page: Number(p.page) || 1, pageSize: Number(p.pageSize) || 25, q: p.q, sort: p.sort, dir: p.dir,
  }))
})
adminRoutes.post('/admin/db/tables/:table/rows', async (c) => c.json({ row: await explorerService.insert(admin(c), c.req.param('table'), await body(c)) }, 201))
adminRoutes.patch('/admin/db/tables/:table/rows', async (c) => {
  const b = await body(c)
  const changes = (b.changes && typeof b.changes === 'object' ? b.changes : {}) as Record<string, unknown>
  return c.json({ row: await explorerService.update(admin(c), c.req.param('table'), rowKey(JSON.stringify(b.key)), changes) })
})
adminRoutes.delete('/admin/db/tables/:table/rows', async (c) => (await explorerService.remove(admin(c), c.req.param('table'), rowKey(c.req.query('key'))), done()))
