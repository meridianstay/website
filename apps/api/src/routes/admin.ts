import { Hono } from 'hono'
import { todayISO, type PageSection } from '@meridian/shared'
import { query, queryOne, transaction } from '../db/pool'
import { requireRole, type AppEnv } from '../auth'
import { audit } from '../audit'
import { BOOKING_SELECT, PROPERTY_COLUMNS, toBooking, toMe, toPropertySummary, type BookingRow, type PropertyRow, type UserRow } from '../mappers'
import { checkLength, collect, str } from '../validate'
import { loadSiteSettings, toPage, type PageRow } from './site'

export const adminRoutes = new Hono<AppEnv>()
adminRoutes.use('/admin/*', requireRole('admin'))

const adminId = (c: { get: (k: 'user') => { id: number } | null }) => c.get('user')!.id
const like = (s: string | undefined) => (s && s.trim() ? `%${s.trim()}%` : null)

// ─── Overview ────────────────────────────────────────────────────────────────

adminRoutes.get('/admin/stats', async (c) => {
  const s = await queryOne<Record<string, string | number>>(`SELECT
    (SELECT count(*) FROM properties)::int AS listings,
    (SELECT count(*) FROM properties WHERE status = 'Approved')::int AS live,
    (SELECT count(*) FROM properties WHERE status = 'Pending')::int AS pending,
    (SELECT count(*) FROM users)::int AS users,
    (SELECT count(*) FROM users WHERE role = 'host')::int AS hosts,
    (SELECT count(*) FROM users WHERE suspended_at IS NOT NULL)::int AS suspended,
    (SELECT count(*) FROM bookings WHERE status = 'Confirmed')::int AS bookings,
    (SELECT count(*) FROM bookings WHERE status = 'Confirmed' AND check_out > $1)::int AS upcoming,
    COALESCE((SELECT sum(total_minor) FROM bookings WHERE status = 'Confirmed'), 0)::bigint AS gbv_minor,
    COALESCE((SELECT sum(service_fee_minor) FROM bookings WHERE status = 'Confirmed'), 0)::bigint AS fees_minor,
    (SELECT count(*) FROM contact_messages WHERE status = 'new')::int AS new_messages,
    (SELECT count(*) FROM reviews WHERE hidden_at IS NULL)::int AS reviews`, [todayISO()])
  const { gbv_minor, fees_minor, ...rest } = s!
  return c.json({ ...rest, gbv: Number(gbv_minor) / 100, fees: Number(fees_minor) / 100 })
})

// ─── Listings ────────────────────────────────────────────────────────────────

adminRoutes.get('/admin/listings', async (c) => {
  const status = c.req.query('status')
  const rows = await query<PropertyRow & { status: string; rejection_reason: string | null; featured_rank: number | null; host_name: string; host_email: string; created_at: Date }>(
    `SELECT ${PROPERTY_COLUMNS}, p.status, p.rejection_reason, p.featured_rank, p.created_at, u.name AS host_name, u.email AS host_email
     FROM properties p JOIN users u ON u.id = p.host_id
     WHERE ($1::listing_status IS NULL OR p.status = $1)
       AND ($2::text IS NULL OR p.title ILIKE $2 OR p.city ILIKE $2 OR u.name ILIKE $2 OR u.email ILIKE $2)
     ORDER BY (p.status = 'Pending') DESC, p.created_at DESC`,
    [['Draft', 'Pending', 'Approved', 'Rejected'].includes(status ?? '') ? status : null, like(c.req.query('q'))],
  )
  return c.json({
    listings: rows.map((r) => ({
      ...toPropertySummary(r), status: r.status, rejectionReason: r.rejection_reason, featuredRank: r.featured_rank,
      hostName: r.host_name, hostEmail: r.host_email, createdAt: r.created_at.toISOString(),
    })),
  })
})

adminRoutes.post('/admin/listings/:id/approve', async (c) => {
  const id = Number(c.req.param('id'))
  const row = await queryOne(`UPDATE properties SET status = 'Approved', rejection_reason = NULL, approved_at = now() WHERE id = $1 RETURNING id`, [id])
  if (!row) return c.json({ error: 'We couldn’t find that listing.' }, 404)
  await audit(adminId(c), 'listing.approve', 'property', id)
  return c.body(null, 204)
})

adminRoutes.post('/admin/listings/:id/reject', async (c) => {
  const id = Number(c.req.param('id'))
  const reason = str((await c.req.json().catch(() => ({}))).reason)
  collect({ reason: checkLength(reason, 'Reason', 5, 500) })
  const row = await queryOne(`UPDATE properties SET status = 'Rejected', rejection_reason = $2, approved_at = NULL, featured_rank = NULL WHERE id = $1 RETURNING id`, [id, reason])
  if (!row) return c.json({ error: 'We couldn’t find that listing.' }, 404)
  await audit(adminId(c), 'listing.reject', 'property', id, { reason })
  return c.body(null, 204)
})

/** Set rank (1 = first) to feature a live listing on the homepage, or null to remove it. */
adminRoutes.post('/admin/listings/:id/feature', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json().catch(() => ({}))
  const rank = body.rank === null ? null : Number(body.rank)
  collect({ rank: rank === null || (Number.isInteger(rank) && rank >= 1 && rank <= 99) ? null : 'Rank must be between 1 and 99.' })
  const row = await queryOne(`UPDATE properties SET featured_rank = $2 WHERE id = $1 AND (status = 'Approved' OR $2::smallint IS NULL) RETURNING id`, [id, rank])
  if (!row) return c.json({ error: 'Only live listings can be featured.' }, 400)
  await audit(adminId(c), rank === null ? 'listing.unfeature' : 'listing.feature', 'property', id, { rank })
  return c.body(null, 204)
})

// ─── Bookings ────────────────────────────────────────────────────────────────

adminRoutes.get('/admin/bookings', async (c) => {
  const rows = await query<BookingRow & { guest_name: string; guest_email: string }>(
    `${BOOKING_SELECT.replace('SELECT b.*,', 'SELECT b.*, g.name AS guest_name, g.email AS guest_email,')} JOIN users g ON g.id = b.guest_id
     WHERE ($1::text IS NULL OR b.code ILIKE $1 OR g.name ILIKE $1 OR g.email ILIKE $1 OR p.title ILIKE $1)
     ORDER BY b.created_at DESC LIMIT 300`,
    [like(c.req.query('q'))],
  )
  const today = todayISO()
  return c.json({ bookings: rows.map((r) => ({ ...toBooking(r, today), guestName: r.guest_name, guestEmail: r.guest_email })) })
})

adminRoutes.post('/admin/bookings/:code/cancel', async (c) => {
  const code = c.req.param('code')
  const row = await queryOne(`UPDATE bookings SET status = 'Cancelled', cancelled_at = now() WHERE code = $1 AND status = 'Confirmed' AND check_out > $2 RETURNING id`, [code, todayISO()])
  if (!row) return c.json({ error: 'Only upcoming or current confirmed bookings can be cancelled.' }, 400)
  await audit(adminId(c), 'booking.cancel', 'booking', code)
  return c.body(null, 204)
})

// ─── Users ───────────────────────────────────────────────────────────────────

adminRoutes.get('/admin/users', async (c) => {
  const rows = await query<UserRow & { suspended_at: Date | null; listings: number; bookings: number }>(
    `SELECT u.*, (SELECT count(*) FROM properties p WHERE p.host_id = u.id)::int AS listings,
       (SELECT count(*) FROM bookings b WHERE b.guest_id = u.id)::int AS bookings
     FROM users u WHERE ($1::text IS NULL OR u.name ILIKE $1 OR u.email::text ILIKE $1)
       AND ($2::user_role IS NULL OR u.role = $2)
     ORDER BY u.created_at DESC LIMIT 500`,
    [like(c.req.query('q')), ['guest', 'host', 'admin'].includes(c.req.query('role') ?? '') ? c.req.query('role') : null],
  )
  return c.json({ users: rows.map((r) => ({ ...toMe(r), suspended: !!r.suspended_at, listings: r.listings, bookings: r.bookings })) })
})

adminRoutes.patch('/admin/users/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (id === adminId(c)) return c.json({ error: 'You can’t change your own role or suspend yourself.' }, 400)
  const body = await c.req.json().catch(() => ({}))
  const role = body.role === undefined ? undefined : str(body.role)
  if (role !== undefined && !['guest', 'host', 'admin'].includes(role)) collect({ role: 'Choose guest, host or admin.' })
  const suspended = typeof body.suspended === 'boolean' ? body.suspended : undefined

  const ok = await transaction(async (db) => {
    const row = await queryOne(
      `UPDATE users SET role = COALESCE($2::user_role, role),
         suspended_at = CASE WHEN $3::boolean IS NULL THEN suspended_at WHEN $3 THEN COALESCE(suspended_at, now()) ELSE NULL END
       WHERE id = $1 RETURNING id`,
      [id, role ?? null, suspended ?? null], db,
    )
    if (!row) return false
    if (suspended) await query('DELETE FROM sessions WHERE user_id = $1', [id], db)
    if (role) await audit(adminId(c), 'user.role', 'user', id, { role }, db)
    if (suspended !== undefined) await audit(adminId(c), suspended ? 'user.suspend' : 'user.restore', 'user', id, {}, db)
    return true
  })
  if (!ok) return c.json({ error: 'We couldn’t find that user.' }, 404)
  return c.body(null, 204)
})

// ─── Reviews ─────────────────────────────────────────────────────────────────

adminRoutes.get('/admin/reviews', async (c) => {
  const rows = await query<{ id: number; author_name: string; rating: number; comment: string; created_at: Date; hidden_at: Date | null; slug: string; title: string }>(
    `SELECT r.*, p.slug, p.title FROM reviews r JOIN properties p ON p.id = r.property_id
     WHERE ($1::text IS NULL OR r.comment ILIKE $1 OR r.author_name ILIKE $1 OR p.title ILIKE $1)
     ORDER BY r.created_at DESC LIMIT 300`,
    [like(c.req.query('q'))],
  )
  return c.json({
    reviews: rows.map((r) => ({
      id: r.id, authorName: r.author_name, rating: r.rating, comment: r.comment, createdAt: r.created_at.toISOString(),
      hidden: !!r.hidden_at, property: { slug: r.slug, title: r.title },
    })),
  })
})

/** Hiding or restoring a review adjusts the listing's rating by that one review. */
async function setReviewHidden(id: number, hide: boolean) {
  return transaction(async (db) => {
    const r = await queryOne<{ property_id: number; rating: number }>(
      `UPDATE reviews SET hidden_at = ${hide ? 'now()' : 'NULL'} WHERE id = $1 AND hidden_at IS ${hide ? 'NULL' : 'NOT NULL'} RETURNING property_id, rating`,
      [id], db,
    )
    if (!r) return false
    await query(
      hide
        ? `UPDATE properties SET rating_avg = CASE WHEN review_count <= 1 THEN 0 ELSE round((rating_avg * review_count - $2) / (review_count - 1), 2) END,
             review_count = GREATEST(review_count - 1, 0) WHERE id = $1`
        : `UPDATE properties SET rating_avg = round((rating_avg * review_count + $2) / (review_count + 1), 2), review_count = review_count + 1 WHERE id = $1`,
      [r.property_id, r.rating], db,
    )
    return true
  })
}

adminRoutes.post('/admin/reviews/:id/hide', async (c) => {
  const id = Number(c.req.param('id'))
  if (!(await setReviewHidden(id, true))) return c.json({ error: 'That review is already hidden.' }, 400)
  await audit(adminId(c), 'review.hide', 'review', id)
  return c.body(null, 204)
})

adminRoutes.post('/admin/reviews/:id/restore', async (c) => {
  const id = Number(c.req.param('id'))
  if (!(await setReviewHidden(id, false))) return c.json({ error: 'That review is already visible.' }, 400)
  await audit(adminId(c), 'review.restore', 'review', id)
  return c.body(null, 204)
})

// ─── Messages ────────────────────────────────────────────────────────────────

adminRoutes.get('/admin/messages', async (c) => {
  const rows = await query<{ id: number; name: string; email: string; topic: string; message: string; status: string; created_at: Date }>(
    `SELECT * FROM contact_messages WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at DESC LIMIT 300`,
    [['new', 'read', 'closed'].includes(c.req.query('status') ?? '') ? c.req.query('status') : null],
  )
  return c.json({ messages: rows.map(({ created_at, ...m }) => ({ ...m, createdAt: created_at.toISOString() })) })
})

adminRoutes.patch('/admin/messages/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const status = str((await c.req.json().catch(() => ({}))).status)
  collect({ status: ['new', 'read', 'closed'].includes(status) ? null : 'Choose new, read or closed.' })
  const row = await queryOne('UPDATE contact_messages SET status = $2 WHERE id = $1 RETURNING id', [id, status])
  if (!row) return c.json({ error: 'We couldn’t find that message.' }, 404)
  await audit(adminId(c), 'message.status', 'message', id, { status })
  return c.body(null, 204)
})

// ─── Website content ─────────────────────────────────────────────────────────

adminRoutes.get('/admin/settings', async (c) => c.json(await loadSiteSettings()))

adminRoutes.put('/admin/settings/:key', async (c) => {
  const key = c.req.param('key')
  const current = await loadSiteSettings()
  if (!(key in current)) return c.json({ error: 'Unknown setting.' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const template = current[key as keyof typeof current] as unknown as Record<string, unknown>
  // Keep only known fields, with the same types as the defaults.
  const value: Record<string, unknown> = {}
  const fields: Record<string, string> = {}
  for (const [field, def] of Object.entries(template)) {
    const v = body[field]
    if (typeof def === 'boolean') value[field] = v === true
    else {
      value[field] = str(v)
      if ((value[field] as string).length > 400) fields[field] = 'Keep this under 400 characters.'
    }
  }
  if (key === 'homepage') for (const f of ['heroTitle', 'heroHighlight', 'featuredTitle']) if (!value[f]) fields[f] = 'This can’t be empty.'
  if (key === 'announcement' && value.enabled && !value.text) fields.text = 'Write the announcement text.'
  collect(Object.fromEntries(Object.entries(fields)))
  await query(
    `INSERT INTO site_settings (key, value, updated_by) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, JSON.stringify(value), adminId(c)],
  )
  await audit(adminId(c), 'settings.update', 'settings', key)
  return c.json({ [key]: value })
})

adminRoutes.get('/admin/pages', async (c) => {
  const rows = await query<PageRow>('SELECT * FROM content_pages ORDER BY title')
  return c.json({ pages: rows.map(toPage) })
})

adminRoutes.put('/admin/pages/:slug', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json().catch(() => ({}))
  const title = str(body.title)
  const intro = str(body.intro)
  const sections: PageSection[] = Array.isArray(body.sections)
    ? body.sections
        .map((s: { heading?: unknown; body?: unknown }) => ({
          heading: str(s.heading),
          body: Array.isArray(s.body) ? s.body.map(str).filter(Boolean) : [],
        }))
        .filter((s: PageSection) => s.heading || s.body.length)
    : []
  collect({
    slug: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length <= 60 ? null : 'Use lowercase letters, numbers and dashes for the address.',
    title: checkLength(title, 'Title', 2, 120),
    intro: intro.length > 600 ? 'Keep the introduction under 600 characters.' : null,
  })
  const reserved = ['search', 'stays', 'book', 'booking', 'login', 'signup', 'contact', 'sitemap', 'api', 'admin', 'host', 'account']
  if (reserved.includes(slug)) collect({ slug: 'That address is used by another part of the site.' })
  await query(
    `INSERT INTO content_pages (slug, title, intro, sections, is_draft, published, updated_by) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title, intro = EXCLUDED.intro, sections = EXCLUDED.sections,
       is_draft = EXCLUDED.is_draft, published = EXCLUDED.published, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [slug, title, intro, JSON.stringify(sections), body.draft === true, body.published !== false, adminId(c)],
  )
  await audit(adminId(c), 'page.save', 'page', slug, { title })
  return c.body(null, 204)
})

adminRoutes.delete('/admin/pages/:slug', async (c) => {
  const slug = c.req.param('slug')
  const row = await queryOne('DELETE FROM content_pages WHERE slug = $1 RETURNING slug', [slug])
  if (!row) return c.json({ error: 'We couldn’t find that page.' }, 404)
  await audit(adminId(c), 'page.delete', 'page', slug)
  return c.body(null, 204)
})

// ─── Audit log ───────────────────────────────────────────────────────────────

adminRoutes.get('/admin/audit', async (c) => {
  const rows = await query<{ id: number; action: string; target_type: string; target_id: string | null; details: Record<string, unknown>; created_at: Date; admin_name: string | null }>(
    `SELECT l.*, u.name AS admin_name FROM admin_audit_log l LEFT JOIN users u ON u.id = l.admin_id ORDER BY l.created_at DESC LIMIT 300`,
  )
  return c.json({
    entries: rows.map((r) => ({ id: r.id, action: r.action, targetType: r.target_type, targetId: r.target_id, details: r.details, adminName: r.admin_name, createdAt: r.created_at.toISOString() })),
  })
})
