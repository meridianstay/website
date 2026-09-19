import { query } from '../db/pool'
import { toPropertySummary, type PropertyRow } from './properties'

// Table: wishlist_items

export const wishlistRepo = {
  async list(userId: number) {
    const rows = await query<PropertyRow>(
      `SELECT p.id, p.slug, p.title, p.type, p.description, p.city, p.region, p.latitude, p.longitude, p.price_per_night_minor,
         p.bedrooms, p.bathrooms, p.max_guests, p.cover_image_url, p.rating_avg, p.review_count
       FROM wishlist_items w JOIN properties p ON p.id = w.property_id
       WHERE w.user_id = $1 AND p.status = 'Approved' ORDER BY w.created_at DESC`,
      [userId],
    )
    return rows.map(toPropertySummary)
  },

  add(userId: number, propertyId: number) {
    return query('INSERT INTO wishlist_items (user_id, property_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, propertyId])
  },

  remove(userId: number, propertyId: number) {
    return query('DELETE FROM wishlist_items WHERE user_id = $1 AND property_id = $2', [userId, propertyId])
  },
}
