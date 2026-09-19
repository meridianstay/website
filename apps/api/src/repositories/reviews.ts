import type { Review } from '@meridian/shared'
import { pool, query, queryOne, type Queryable } from '../db/pool'

// Table: reviews. Hidden reviews stay stored but aren't shown or counted.

interface ReviewRow { id: number; author_name: string; rating: number; comment: string; created_at: Date }
const toReview = (r: ReviewRow): Review => ({ id: r.id, authorName: r.author_name, rating: r.rating, comment: r.comment, createdAt: r.created_at.toISOString() })

export interface AdminReview extends Review { hidden: boolean; property: { slug: string; title: string } }

export const reviewsRepo = {
  async visibleForProperty(propertyId: number, limit = 30) {
    return (await query<ReviewRow>('SELECT * FROM reviews WHERE property_id = $1 AND hidden_at IS NULL ORDER BY created_at DESC LIMIT $2', [propertyId, limit])).map(toReview)
  },

  insert(r: { propertyId: number; userId: number; bookingId: number; authorName: string; rating: number; comment: string }, db: Queryable) {
    return query(
      'INSERT INTO reviews (property_id, user_id, booking_id, author_name, rating, comment) VALUES ($1, $2, $3, $4, $5, $6)',
      [r.propertyId, r.userId, r.bookingId, r.authorName, r.rating, r.comment], db,
    )
  },

  /** Hides or restores a review. Returns its listing and rating, or null if nothing changed. */
  setHidden(id: number, hidden: boolean, db: Queryable = pool) {
    return queryOne<{ property_id: number; rating: number }>(
      hidden
        ? 'UPDATE reviews SET hidden_at = now() WHERE id = $1 AND hidden_at IS NULL RETURNING property_id, rating'
        : 'UPDATE reviews SET hidden_at = NULL WHERE id = $1 AND hidden_at IS NOT NULL RETURNING property_id, rating',
      [id], db,
    )
  },

  async listForAdmin(q: string | null): Promise<AdminReview[]> {
    const rows = await query<ReviewRow & { hidden_at: Date | null; slug: string; title: string }>(
      `SELECT r.*, p.slug, p.title FROM reviews r JOIN properties p ON p.id = r.property_id
       WHERE ($1::text IS NULL OR r.comment ILIKE $1 OR r.author_name ILIKE $1 OR p.title ILIKE $1)
       ORDER BY r.created_at DESC LIMIT 300`,
      [q ? `%${q}%` : null],
    )
    return rows.map((r) => ({ ...toReview(r), hidden: !!r.hidden_at, property: { slug: r.slug, title: r.title } }))
  },
}
