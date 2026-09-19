import { Hono } from 'hono'
import { isISODate, todayISO, type PropertyType } from '@meridian/shared'
import { query, queryOne, transaction, type Queryable } from '../db/pool'
import { requireUser, type AppEnv } from '../auth'
import { BOOKING_SELECT, PROPERTY_COLUMNS, toBooking, toPropertySummary, type BookingRow, type PropertyRow } from '../mappers'
import { checkLength, collect, str } from '../validate'
import { PROPERTY_TYPES } from './properties'

// Anyone signed in can host: creating a first listing turns a guest into a host.
export const hostRoutes = new Hono<AppEnv>()
hostRoutes.use('/host/*', requireUser)

hostRoutes.get('/amenities', async (c) => {
  const rows = await query<{ name: string; icon: string }>('SELECT name, icon FROM amenities ORDER BY id')
  return c.json({ amenities: rows })
})

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'stay'
const isUrl = (s: string) => /^https?:\/\/\S+$/.test(s)

interface ListingInput {
  title: string; type: PropertyType; description: string; city: string; region: string; country: string
  price: number; beds: number; baths: number; maxGuests: number; lat: number; lng: number
  coverImage: string; photos: string[]; amenities: string[]
}

function parseListing(body: Record<string, unknown>): ListingInput {
  const input = {
    title: str(body.title), type: str(body.type) as PropertyType, description: str(body.description),
    city: str(body.city), region: str(body.region), country: str(body.country) || 'India',
    price: Number(body.price), beds: Number(body.beds), baths: Number(body.baths), maxGuests: Number(body.maxGuests),
    lat: Number(body.lat), lng: Number(body.lng), coverImage: str(body.coverImage),
    photos: Array.isArray(body.photos) ? body.photos.map(str).filter(Boolean).slice(0, 12) : [],
    amenities: Array.isArray(body.amenities) ? body.amenities.map(str).filter(Boolean) : [],
  }
  const whole = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max
  collect({
    title: checkLength(input.title, 'Title', 3, 120),
    type: PROPERTY_TYPES.includes(input.type) ? null : 'Choose a property type.',
    description: checkLength(input.description, 'Description', 20, 4000),
    city: checkLength(input.city, 'City or town', 2, 80),
    region: checkLength(input.region, 'State or region', 2, 80),
    price: Number.isFinite(input.price) && input.price >= 1 && input.price <= 100000 ? null : 'Enter a nightly price between 1 and 100,000.',
    beds: whole(input.beds, 0, 50) ? null : 'Enter the number of bedrooms.',
    baths: whole(input.baths, 0, 50) ? null : 'Enter the number of bathrooms.',
    maxGuests: whole(input.maxGuests, 1, 50) ? null : 'Enter how many guests can stay.',
    location: Number.isFinite(input.lat) && Number.isFinite(input.lng) && Math.abs(input.lat) <= 90 && Math.abs(input.lng) <= 180
      ? null : 'Drop a pin on the map to set the location.',
    coverImage: isUrl(input.coverImage) ? null : 'Add a cover photo link starting with https://',
    photos: input.photos.every(isUrl) ? null : 'Every photo link must start with https://',
  })
  return input
}

async function saveDetails(db: Queryable, propertyId: number, input: ListingInput) {
  await query('DELETE FROM property_photos WHERE property_id = $1', [propertyId], db)
  for (const [i, url] of input.photos.entries()) {
    await query('INSERT INTO property_photos (property_id, url, position) VALUES ($1, $2, $3)', [propertyId, url, i], db)
  }
  await query('DELETE FROM property_amenities WHERE property_id = $1', [propertyId], db)
  await query(
    `INSERT INTO property_amenities (property_id, amenity_id) SELECT $1, id FROM amenities WHERE name = ANY($2::text[])`,
    [propertyId, input.amenities], db,
  )
}

hostRoutes.get('/host/listings', async (c) => {
  const rows = await query<PropertyRow & { status: string; rejection_reason: string | null }>(
    `SELECT ${PROPERTY_COLUMNS}, p.status, p.rejection_reason FROM properties p WHERE p.host_id = $1 ORDER BY p.created_at DESC`,
    [c.get('user')!.id],
  )
  return c.json({ listings: rows.map((r) => ({ ...toPropertySummary(r), status: r.status, rejectionReason: r.rejection_reason })) })
})

hostRoutes.get('/host/listings/:id', async (c) => {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT p.*, COALESCE((SELECT json_agg(url ORDER BY position) FROM property_photos WHERE property_id = p.id), '[]') AS photos,
       COALESCE((SELECT json_agg(a.name) FROM property_amenities pa JOIN amenities a ON a.id = pa.amenity_id WHERE pa.property_id = p.id), '[]') AS amenity_names
     FROM properties p WHERE p.id = $1 AND p.host_id = $2`,
    [Number(c.req.param('id')), c.get('user')!.id],
  )
  if (!row) return c.json({ error: 'We couldn’t find that listing.' }, 404)
  return c.json({
    listing: {
      id: row.id, slug: row.slug, status: row.status, rejectionReason: row.rejection_reason, title: row.title, type: row.type,
      description: row.description, city: row.city, region: row.region, country: row.country,
      price: (row.price_per_night_minor as number) / 100, beds: row.bedrooms, baths: row.bathrooms, maxGuests: row.max_guests,
      lat: Number(row.latitude), lng: Number(row.longitude), coverImage: row.cover_image_url, photos: row.photos, amenities: row.amenity_names,
    },
  })
})

hostRoutes.post('/host/listings', async (c) => {
  const user = c.get('user')!
  const input = parseListing(await c.req.json().catch(() => ({})))
  const id = await transaction(async (db) => {
    const base = slugify(input.title)
    const taken = await query<{ slug: string }>('SELECT slug FROM properties WHERE slug = $1 OR slug LIKE $2', [base, `${base}-%`], db)
    const slug = taken.length ? `${base}-${taken.length + 1}` : base
    const row = await queryOne<{ id: number }>(
      `INSERT INTO properties (slug, host_id, title, type, description, city, region, country, latitude, longitude,
         price_per_night_minor, bedrooms, bathrooms, max_guests, cover_image_url, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'Pending') RETURNING id`,
      [slug, user.id, input.title, input.type, input.description, input.city, input.region, input.country, input.lat, input.lng,
        Math.round(input.price * 100), input.beds, input.baths, input.maxGuests, input.coverImage], db,
    )
    await saveDetails(db, row!.id, input)
    if (user.role === 'guest') await query(`UPDATE users SET role = 'host' WHERE id = $1`, [user.id], db)
    return row!.id
  })
  return c.json({ id }, 201)
})

hostRoutes.put('/host/listings/:id', async (c) => {
  const user = c.get('user')!
  const input = parseListing(await c.req.json().catch(() => ({})))
  const updated = await transaction(async (db) => {
    // Any edit sends the listing back for review so changes can't skip moderation.
    const row = await queryOne<{ id: number }>(
      `UPDATE properties SET title=$3, type=$4, description=$5, city=$6, region=$7, country=$8, latitude=$9, longitude=$10,
         price_per_night_minor=$11, bedrooms=$12, bathrooms=$13, max_guests=$14, cover_image_url=$15,
         status='Pending', rejection_reason=NULL, approved_at=NULL
       WHERE id = $1 AND host_id = $2 RETURNING id`,
      [Number(c.req.param('id')), user.id, input.title, input.type, input.description, input.city, input.region, input.country,
        input.lat, input.lng, Math.round(input.price * 100), input.beds, input.baths, input.maxGuests, input.coverImage], db,
    )
    if (row) await saveDetails(db, row.id, input)
    return row
  })
  if (!updated) return c.json({ error: 'We couldn’t find that listing.' }, 404)
  return c.body(null, 204)
})

hostRoutes.get('/host/bookings', async (c) => {
  const rows = await query<BookingRow & { guest_name: string }>(
    `${BOOKING_SELECT.replace('SELECT b.*,', 'SELECT b.*, g.name AS guest_name,')} JOIN users g ON g.id = b.guest_id
     WHERE p.host_id = $1 ORDER BY b.check_in DESC`,
    [c.get('user')!.id],
  )
  const today = todayISO()
  return c.json({ bookings: rows.map((r) => ({ ...toBooking(r, today), guestName: r.guest_name })) })
})

hostRoutes.get('/host/stats', async (c) => {
  const stats = await queryOne<{ earnings: number; listings: number; live: number; rated: number; avg_rating: string | null; upcoming: number }>(
    `SELECT
       COALESCE((SELECT sum(b.total_minor - b.service_fee_minor) FROM bookings b JOIN properties p ON p.id = b.property_id
                 WHERE p.host_id = $1 AND b.status = 'Confirmed'), 0)::int AS earnings,
       (SELECT count(*) FROM properties WHERE host_id = $1)::int AS listings,
       (SELECT count(*) FROM properties WHERE host_id = $1 AND status = 'Approved')::int AS live,
       (SELECT count(*) FROM properties WHERE host_id = $1 AND review_count > 0)::int AS rated,
       (SELECT round(avg(rating_avg), 2) FROM properties WHERE host_id = $1 AND review_count > 0) AS avg_rating,
       (SELECT count(*) FROM bookings b JOIN properties p ON p.id = b.property_id
         WHERE p.host_id = $1 AND b.status = 'Confirmed' AND b.check_out > $2)::int AS upcoming`,
    [c.get('user')!.id, todayISO()],
  )
  return c.json({
    earnings: stats!.earnings / 100, listings: stats!.listings, live: stats!.live, rated: stats!.rated,
    avgRating: stats!.avg_rating ? Number(stats!.avg_rating) : null, upcoming: stats!.upcoming,
  })
})

// ─── Availability blocks ──────────────────────────────────────────────────────

async function ownListing(userId: number, id: number) {
  return queryOne<{ id: number; status: string }>('SELECT id, status FROM properties WHERE id = $1 AND host_id = $2', [id, userId])
}

hostRoutes.get('/host/listings/:id/calendar', async (c) => {
  const listing = await ownListing(c.get('user')!.id, Number(c.req.param('id')))
  if (!listing) return c.json({ error: 'We couldn’t find that listing.' }, 404)
  const today = todayISO()
  const [blocks, bookings] = await Promise.all([
    query<{ id: number; start_date: string; end_date: string; note: string | null }>(
      'SELECT id, start_date, end_date, note FROM availability_blocks WHERE property_id = $1 AND end_date > $2 ORDER BY start_date',
      [listing.id, today],
    ),
    query<{ code: string; check_in: string; check_out: string; guest_name: string }>(
      `SELECT b.code, b.check_in, b.check_out, u.name AS guest_name FROM bookings b JOIN users u ON u.id = b.guest_id
       WHERE b.property_id = $1 AND b.status = 'Confirmed' AND b.check_out > $2 ORDER BY b.check_in`,
      [listing.id, today],
    ),
  ])
  return c.json({
    blocks: blocks.map((b) => ({ id: b.id, checkIn: b.start_date, checkOut: b.end_date, note: b.note })),
    bookings: bookings.map((b) => ({ code: b.code, checkIn: b.check_in, checkOut: b.check_out, guestName: b.guest_name })),
  })
})

hostRoutes.post('/host/listings/:id/blocks', async (c) => {
  const listing = await ownListing(c.get('user')!.id, Number(c.req.param('id')))
  if (!listing) return c.json({ error: 'We couldn’t find that listing.' }, 404)
  const body = await c.req.json().catch(() => ({}))
  const start = str(body.checkIn)
  const end = str(body.checkOut)
  const note = str(body.note).slice(0, 200)
  collect({
    checkIn: isISODate(start) && start >= todayISO() ? null : 'Choose a start date from today onwards.',
    checkOut: isISODate(end) && end > start ? null : 'The end date must be after the start date.',
  })
  try {
    await transaction(async (db) => {
      await query('SELECT id FROM properties WHERE id = $1 FOR UPDATE', [listing.id], db)
      const booked = await queryOne(
        `SELECT 1 FROM bookings WHERE property_id = $1 AND status = 'Confirmed' AND daterange(check_in, check_out) && daterange($2::date, $3::date)`,
        [listing.id, start, end], db,
      )
      if (booked) throw Object.assign(new Error('booked'), { code: 'BOOKED' })
      await query('INSERT INTO availability_blocks (property_id, start_date, end_date, note) VALUES ($1, $2, $3, $4)', [listing.id, start, end, note || null], db)
    })
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'BOOKED') return c.json({ error: 'Guests have already booked some of those nights. Block other dates, or contact the guest.' }, 409)
    if (code === '23P01') return c.json({ error: 'Those dates overlap a block you’ve already added.' }, 409)
    throw err
  }
  return c.body(null, 201)
})

hostRoutes.delete('/host/listings/:id/blocks/:blockId', async (c) => {
  const listing = await ownListing(c.get('user')!.id, Number(c.req.param('id')))
  if (!listing) return c.json({ error: 'We couldn’t find that listing.' }, 404)
  await query('DELETE FROM availability_blocks WHERE id = $1 AND property_id = $2', [Number(c.req.param('blockId')), listing.id])
  return c.body(null, 204)
})

// ─── Pause / relist ───────────────────────────────────────────────────────────

hostRoutes.post('/host/listings/:id/pause', async (c) => {
  const row = await queryOne(`UPDATE properties SET status = 'Draft', featured_rank = NULL WHERE id = $1 AND host_id = $2 AND status IN ('Approved', 'Pending') RETURNING id`, [Number(c.req.param('id')), c.get('user')!.id])
  if (!row) return c.json({ error: 'Only live or pending listings can be paused.' }, 400)
  return c.body(null, 204)
})

hostRoutes.post('/host/listings/:id/relist', async (c) => {
  const row = await queryOne(`UPDATE properties SET status = 'Pending', rejection_reason = NULL WHERE id = $1 AND host_id = $2 AND status IN ('Draft', 'Rejected') RETURNING id`, [Number(c.req.param('id')), c.get('user')!.id])
  if (!row) return c.json({ error: 'Only paused or rejected listings can be sent for review.' }, 400)
  return c.body(null, 204)
})
