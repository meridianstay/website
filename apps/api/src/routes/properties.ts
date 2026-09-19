import { Hono } from 'hono'
import { isISODate, todayISO, type PropertyType } from '@meridian/shared'
import { query, queryOne, transaction } from '../db/pool'
import { requireUser, type AppEnv } from '../auth'
import { PROPERTY_COLUMNS, toPropertySummary, toReview, type PropertyRow, type ReviewRow } from '../mappers'
import { checkLength, collect, str } from '../validate'

export const propertyRoutes = new Hono<AppEnv>()

export const PROPERTY_TYPES: PropertyType[] = ['Farmstay', 'Room', 'Resort', 'Cottage', 'Villa']

const SORTS: Record<string, string> = {
  recommended: 'p.id',
  price_asc: 'p.price_per_night_minor, p.id',
  price_desc: 'p.price_per_night_minor DESC, p.id',
  rating: 'p.rating_avg DESC, p.review_count DESC',
}

const intOrNull = (v: string | undefined) => {
  const n = Number(v)
  return v && Number.isFinite(n) ? Math.floor(n) : null
}

propertyRoutes.get('/locations', async (c) => {
  const rows = await query<{ location: string }>(
    `SELECT DISTINCT city || ', ' || region AS location FROM properties WHERE status = 'Approved' ORDER BY 1`,
  )
  return c.json({ locations: rows.map((r) => r.location) })
})

propertyRoutes.get('/properties', async (c) => {
  const q = c.req.query()
  const where = str(q.where)
  const type = PROPERTY_TYPES.includes(q.type as PropertyType) ? q.type : null
  const checkIn = isISODate(q.checkIn) ? q.checkIn : null
  const checkOut = isISODate(q.checkOut) && checkIn && q.checkOut > checkIn ? q.checkOut : null
  const minPrice = intOrNull(q.minPrice)
  const maxPrice = intOrNull(q.maxPrice)
  const limit = Math.min(intOrNull(q.limit) ?? 50, 100)
  const featured = q.featured === '1' || q.featured === 'true'

  const rows = await query<PropertyRow>(
    `SELECT ${PROPERTY_COLUMNS} FROM properties p
     WHERE p.status = 'Approved'
       AND ($1::text IS NULL OR p.title ILIKE $1 OR (p.city || ', ' || p.region || ', ' || p.country) ILIKE $1)
       AND ($2::property_type IS NULL OR p.type = $2)
       AND ($3::int IS NULL OR p.max_guests >= $3)
       AND ($4::int IS NULL OR p.price_per_night_minor >= $4)
       AND ($5::int IS NULL OR p.price_per_night_minor <= $5)
       AND ($6::date IS NULL OR $7::date IS NULL OR (
         NOT EXISTS (SELECT 1 FROM bookings b WHERE b.property_id = p.id AND b.status = 'Confirmed'
           AND daterange(b.check_in, b.check_out) && daterange($6::date, $7::date))
         AND NOT EXISTS (SELECT 1 FROM availability_blocks ab WHERE ab.property_id = p.id
           AND daterange(ab.start_date, ab.end_date) && daterange($6::date, $7::date))))
       AND (NOT $9::boolean OR p.featured_rank IS NOT NULL)
     ORDER BY ${featured ? 'p.featured_rank, p.id' : SORTS[q.sort] ?? SORTS.recommended}
     LIMIT $8`,
    [where ? `%${where}%` : null, type, intOrNull(q.guests), minPrice === null ? null : minPrice * 100,
      maxPrice === null ? null : maxPrice * 100, checkIn, checkOut, limit, featured],
  )
  return c.json({ properties: rows.map(toPropertySummary) })
})

propertyRoutes.get('/properties/:slug', async (c) => {
  const user = c.get('user')
  const row = await queryOne<PropertyRow & { host_id: number; status: string; host_name: string; host_joined: Date; host_avatar: string | null }>(
    `SELECT ${PROPERTY_COLUMNS}, p.host_id, p.status, u.name AS host_name, u.created_at AS host_joined, u.avatar_url AS host_avatar
     FROM properties p JOIN users u ON u.id = p.host_id WHERE p.slug = $1`,
    [c.req.param('slug')],
  )
  // Hosts and admins can preview listings that aren't live yet.
  const canPreview = user && (user.role === 'admin' || user.id === row?.host_id)
  if (!row || (row.status !== 'Approved' && !canPreview)) return c.json({ error: 'We couldn’t find that stay.' }, 404)

  const today = todayISO()
  const [photos, amenities, reviews, booked, reviewable] = await Promise.all([
    query<{ url: string }>('SELECT url FROM property_photos WHERE property_id = $1 ORDER BY position', [row.id]),
    query<{ name: string; icon: string }>(
      'SELECT a.name, a.icon FROM property_amenities pa JOIN amenities a ON a.id = pa.amenity_id WHERE pa.property_id = $1 ORDER BY a.id',
      [row.id],
    ),
    query<ReviewRow>('SELECT * FROM reviews WHERE property_id = $1 AND hidden_at IS NULL ORDER BY created_at DESC LIMIT 30', [row.id]),
    // Unavailable nights: confirmed bookings plus the host's own blocks.
    query<{ check_in: string; check_out: string }>(
      `SELECT check_in, check_out FROM bookings WHERE property_id = $1 AND status = 'Confirmed' AND check_out > $2
       UNION ALL
       SELECT start_date, end_date FROM availability_blocks WHERE property_id = $1 AND end_date > $2
       ORDER BY 1`,
      [row.id, today],
    ),
    user
      ? queryOne<{ code: string }>(
          `SELECT b.code FROM bookings b WHERE b.property_id = $1 AND b.guest_id = $2 AND b.status = 'Confirmed'
             AND b.check_out <= $3 AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id)
           ORDER BY b.check_out DESC LIMIT 1`,
          [row.id, user.id, today],
        )
      : null,
  ])

  return c.json({
    property: {
      ...toPropertySummary(row),
      gallery: photos.map((p) => p.url),
      amenities,
      host: { name: row.host_name, joinedAt: row.host_joined.toISOString(), avatar: row.host_avatar },
      reviews: reviews.map(toReview),
      bookedRanges: booked.map((b) => ({ checkIn: b.check_in, checkOut: b.check_out })),
      reviewableBookingCode: reviewable?.code ?? null,
      status: row.status,
    },
  })
})

propertyRoutes.post('/properties/:slug/reviews', requireUser, async (c) => {
  const user = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const rating = Number(body.rating)
  const comment = str(body.comment)
  collect({
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? null : 'Choose a rating from 1 to 5 stars.',
    comment: checkLength(comment, 'Your review', 10, 2000),
  })

  const booking = await queryOne<{ id: number; property_id: number }>(
    `SELECT b.id, b.property_id FROM bookings b JOIN properties p ON p.id = b.property_id
     WHERE b.code = $1 AND p.slug = $2 AND b.guest_id = $3 AND b.status = 'Confirmed' AND b.check_out <= $4
       AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id)`,
    [str(body.bookingCode), c.req.param('slug'), user.id, todayISO()],
  )
  if (!booking) return c.json({ error: 'You can review a stay after your check-out, once per booking.' }, 403)

  const [first, ...rest] = user.name.split(' ')
  const authorName = rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first
  await transaction(async (db) => {
    await query(
      'INSERT INTO reviews (property_id, user_id, booking_id, author_name, rating, comment) VALUES ($1, $2, $3, $4, $5, $6)',
      [booking.property_id, user.id, booking.id, authorName, rating, comment], db,
    )
    await query(
      `UPDATE properties SET rating_avg = round((rating_avg * review_count + $2) / (review_count + 1), 2),
         review_count = review_count + 1 WHERE id = $1`,
      [booking.property_id, rating], db,
    )
  })
  return c.body(null, 201)
})
