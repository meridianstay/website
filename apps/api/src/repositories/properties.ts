import type { Amenity, ListingStatus, PropertySummary, PropertyType, SearchQuery } from '@meridian/shared'
import type { ListingInput } from '@meridian/shared'
import { pool, query, queryOne, type Queryable } from '../db/pool'

// Tables: properties, property_photos, property_amenities

export interface PropertyRow {
  id: number; slug: string; title: string; type: PropertyType; description: string; city: string; region: string
  latitude: string; longitude: string; price_per_night_minor: number; bedrooms: number; bathrooms: number; max_guests: number
  cover_image_url: string; rating_avg: string; review_count: number
}

const COLUMNS = `p.id, p.slug, p.title, p.type, p.description, p.city, p.region, p.latitude, p.longitude,
  p.price_per_night_minor, p.bedrooms, p.bathrooms, p.max_guests, p.cover_image_url, p.rating_avg, p.review_count`

/** Money leaves the data layer in major units (e.g. dollars); the table stores minor units. */
export const toPropertySummary = (r: PropertyRow): PropertySummary => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  type: r.type,
  location: `${r.city}, ${r.region}`,
  price: r.price_per_night_minor / 100,
  rating: Number(r.rating_avg),
  reviewCount: r.review_count,
  beds: r.bedrooms,
  baths: r.bathrooms,
  maxGuests: r.max_guests,
  image: r.cover_image_url,
  description: r.description,
  lat: Number(r.latitude),
  lng: Number(r.longitude),
})

const SORTS: Record<string, string> = {
  recommended: 'p.id',
  price_asc: 'p.price_per_night_minor, p.id',
  price_desc: 'p.price_per_night_minor DESC, p.id',
  rating: 'p.rating_avg DESC, p.review_count DESC',
}

export interface HostListing extends PropertySummary { status: ListingStatus; rejectionReason: string | null }
export interface AdminListing extends HostListing { featuredRank: number | null; hostName: string; hostEmail: string; createdAt: string }

export interface BookableProperty { id: number; host_id: number; price_per_night_minor: number; max_guests: number; currency: string }

type Filters = Required<Pick<SearchQuery, 'limit'>> & Omit<SearchQuery, 'limit'>

export const propertiesRepo = {
  /** Live listings matching the filters. With dates, only stays free for the whole range. */
  async search(f: Filters) {
    const rows = await query<PropertyRow>(
      `SELECT ${COLUMNS} FROM properties p
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
       ORDER BY ${f.featured ? 'p.featured_rank, p.id' : SORTS[f.sort ?? 'recommended'] ?? SORTS.recommended}
       LIMIT $8`,
      [f.where ? `%${f.where}%` : null, f.type ?? null, f.guests ?? null,
        f.minPrice == null ? null : f.minPrice * 100, f.maxPrice == null ? null : f.maxPrice * 100,
        f.checkIn ?? null, f.checkOut ?? null, f.limit, !!f.featured],
    )
    return rows.map(toPropertySummary)
  },

  async locations() {
    const rows = await query<{ location: string }>(
      `SELECT DISTINCT city || ', ' || region AS location FROM properties WHERE status = 'Approved' ORDER BY 1`,
    )
    return rows.map((r) => r.location)
  },

  /** Any listing by address, with its host, regardless of status (callers decide who may see it). */
  findBySlug(slug: string) {
    return queryOne<PropertyRow & { host_id: number; status: ListingStatus; host_name: string; host_joined: Date; host_avatar: string | null }>(
      `SELECT ${COLUMNS}, p.host_id, p.status, u.name AS host_name, u.created_at AS host_joined, u.avatar_url AS host_avatar
       FROM properties p JOIN users u ON u.id = p.host_id WHERE p.slug = $1`,
      [slug],
    )
  },

  async photos(propertyId: number) {
    return (await query<{ url: string }>('SELECT url FROM property_photos WHERE property_id = $1 ORDER BY position', [propertyId])).map((r) => r.url)
  },

  amenities(propertyId: number) {
    return query<Amenity>(
      'SELECT a.name, a.icon FROM property_amenities pa JOIN amenities a ON a.id = pa.amenity_id WHERE pa.property_id = $1 ORDER BY a.id',
      [propertyId],
    )
  },

  /** A live listing that can be booked. */
  findBookable(id: number, db: Queryable = pool) {
    return queryOne<BookableProperty>(
      `SELECT id, host_id, price_per_night_minor, max_guests, currency FROM properties WHERE id = $1 AND status = 'Approved'`,
      [id], db,
    )
  },

  async isLive(id: number) {
    return !!(await queryOne(`SELECT 1 FROM properties WHERE id = $1 AND status = 'Approved'`, [id]))
  },

  /** Row lock so bookings and host blocks for one listing happen one at a time. */
  lock(id: number, db: Queryable) {
    return query('SELECT id FROM properties WHERE id = $1 FOR UPDATE', [id], db)
  },

  /** Adds (+1) or removes (-1) one review's rating from the running average. */
  adjustRating(id: number, rating: number, direction: 1 | -1, db: Queryable = pool) {
    return query(
      direction === 1
        ? `UPDATE properties SET rating_avg = round((rating_avg * review_count + $2) / (review_count + 1), 2), review_count = review_count + 1 WHERE id = $1`
        : `UPDATE properties SET rating_avg = CASE WHEN review_count <= 1 THEN 0 ELSE round((rating_avg * review_count - $2) / (review_count - 1), 2) END,
             review_count = GREATEST(review_count - 1, 0) WHERE id = $1`,
      [id, rating], db,
    )
  },

  // ── Host side ──────────────────────────────────────────────────────────────

  async listForHost(hostId: number): Promise<HostListing[]> {
    const rows = await query<PropertyRow & { status: ListingStatus; rejection_reason: string | null }>(
      `SELECT ${COLUMNS}, p.status, p.rejection_reason FROM properties p WHERE p.host_id = $1 ORDER BY p.created_at DESC`,
      [hostId],
    )
    return rows.map((r) => ({ ...toPropertySummary(r), status: r.status, rejectionReason: r.rejection_reason }))
  },

  ownedBy(id: number, hostId: number) {
    return queryOne<{ id: number; status: ListingStatus }>('SELECT id, status FROM properties WHERE id = $1 AND host_id = $2', [id, hostId])
  },

  /** Everything the listing editor needs. */
  async findForEditing(id: number, hostId: number) {
    const row = await queryOne<Record<string, unknown>>(
      `SELECT p.*, COALESCE((SELECT json_agg(url ORDER BY position) FROM property_photos WHERE property_id = p.id), '[]') AS photos,
         COALESCE((SELECT json_agg(a.name) FROM property_amenities pa JOIN amenities a ON a.id = pa.amenity_id WHERE pa.property_id = p.id), '[]') AS amenity_names
       FROM properties p WHERE p.id = $1 AND p.host_id = $2`,
      [id, hostId],
    )
    if (!row) return null
    return {
      id: row.id as number, slug: row.slug as string, status: row.status as ListingStatus, rejectionReason: row.rejection_reason as string | null,
      title: row.title as string, type: row.type as PropertyType, description: row.description as string,
      city: row.city as string, region: row.region as string, country: row.country as string,
      price: (row.price_per_night_minor as number) / 100, beds: row.bedrooms as number, baths: row.bathrooms as number,
      maxGuests: row.max_guests as number, lat: Number(row.latitude), lng: Number(row.longitude),
      coverImage: row.cover_image_url as string, photos: row.photos as string[], amenities: row.amenity_names as string[],
    }
  },

  /** A free address based on `base`, e.g. "misty-cottage" or "misty-cottage-2". */
  async uniqueSlug(base: string, db: Queryable) {
    const taken = await query<{ slug: string }>('SELECT slug FROM properties WHERE slug = $1 OR slug LIKE $2', [base, `${base}-%`], db)
    return taken.length ? `${base}-${taken.length + 1}` : base
  },

  async insert(hostId: number, slug: string, input: ListingInput, db: Queryable) {
    const row = await queryOne<{ id: number }>(
      `INSERT INTO properties (slug, host_id, title, type, description, city, region, country, latitude, longitude,
         price_per_night_minor, bedrooms, bathrooms, max_guests, cover_image_url, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'Pending') RETURNING id`,
      [slug, hostId, input.title, input.type, input.description, input.city, input.region, input.country, input.lat, input.lng,
        Math.round(input.price * 100), input.beds, input.baths, input.maxGuests, input.coverImage], db,
    )
    return row!.id
  },

  /** Updates a host's listing and sends it back for review. Returns false if not theirs. */
  async update(id: number, hostId: number, input: ListingInput, db: Queryable) {
    const row = await queryOne(
      `UPDATE properties SET title=$3, type=$4, description=$5, city=$6, region=$7, country=$8, latitude=$9, longitude=$10,
         price_per_night_minor=$11, bedrooms=$12, bathrooms=$13, max_guests=$14, cover_image_url=$15,
         status='Pending', rejection_reason=NULL, approved_at=NULL, featured_rank=NULL
       WHERE id = $1 AND host_id = $2 RETURNING id`,
      [id, hostId, input.title, input.type, input.description, input.city, input.region, input.country,
        input.lat, input.lng, Math.round(input.price * 100), input.beds, input.baths, input.maxGuests, input.coverImage], db,
    )
    return !!row
  },

  async replacePhotos(id: number, urls: string[], db: Queryable) {
    await query('DELETE FROM property_photos WHERE property_id = $1', [id], db)
    for (const [i, url] of urls.entries()) {
      await query('INSERT INTO property_photos (property_id, url, position) VALUES ($1, $2, $3)', [id, url, i], db)
    }
  },

  async replaceAmenities(id: number, names: string[], db: Queryable) {
    await query('DELETE FROM property_amenities WHERE property_id = $1', [id], db)
    await query(
      'INSERT INTO property_amenities (property_id, amenity_id) SELECT $1, id FROM amenities WHERE name = ANY($2::text[])',
      [id, names], db,
    )
  },

  async pause(id: number, hostId: number) {
    return !!(await queryOne(
      `UPDATE properties SET status = 'Draft', featured_rank = NULL WHERE id = $1 AND host_id = $2 AND status IN ('Approved', 'Pending') RETURNING id`,
      [id, hostId],
    ))
  },

  async relist(id: number, hostId: number) {
    return !!(await queryOne(
      `UPDATE properties SET status = 'Pending', rejection_reason = NULL WHERE id = $1 AND host_id = $2 AND status IN ('Draft', 'Rejected') RETURNING id`,
      [id, hostId],
    ))
  },

  // ── Admin side ─────────────────────────────────────────────────────────────

  async listForAdmin(filters: { status?: ListingStatus | null; q?: string | null }): Promise<AdminListing[]> {
    const rows = await query<PropertyRow & { status: ListingStatus; rejection_reason: string | null; featured_rank: number | null; host_name: string; host_email: string; created_at: Date }>(
      `SELECT ${COLUMNS}, p.status, p.rejection_reason, p.featured_rank, p.created_at, u.name AS host_name, u.email AS host_email
       FROM properties p JOIN users u ON u.id = p.host_id
       WHERE ($1::listing_status IS NULL OR p.status = $1)
         AND ($2::text IS NULL OR p.title ILIKE $2 OR p.city ILIKE $2 OR u.name ILIKE $2 OR u.email ILIKE $2)
       ORDER BY (p.status = 'Pending') DESC, p.created_at DESC`,
      [filters.status ?? null, filters.q ? `%${filters.q}%` : null],
    )
    return rows.map((r) => ({
      ...toPropertySummary(r), status: r.status, rejectionReason: r.rejection_reason, featuredRank: r.featured_rank,
      hostName: r.host_name, hostEmail: r.host_email, createdAt: r.created_at.toISOString(),
    }))
  },

  async approve(id: number, db: Queryable = pool) {
    return !!(await queryOne(`UPDATE properties SET status = 'Approved', rejection_reason = NULL, approved_at = now() WHERE id = $1 RETURNING id`, [id], db))
  },

  async reject(id: number, reason: string, db: Queryable = pool) {
    return !!(await queryOne(
      `UPDATE properties SET status = 'Rejected', rejection_reason = $2, approved_at = NULL, featured_rank = NULL WHERE id = $1 RETURNING id`,
      [id, reason], db,
    ))
  },

  /** Features a live listing at `rank`, or removes it from the homepage with null. */
  async setFeatured(id: number, rank: number | null, db: Queryable = pool) {
    return !!(await queryOne(
      `UPDATE properties SET featured_rank = $2 WHERE id = $1 AND (status = 'Approved' OR $2::smallint IS NULL) RETURNING id`,
      [id, rank], db,
    ))
  },
}
