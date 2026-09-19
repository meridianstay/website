import { Hono } from 'hono'
import { query, queryOne } from '../db/pool'
import { requireUser, type AppEnv } from '../auth'
import { PROPERTY_COLUMNS, toPropertySummary, type PropertyRow } from '../mappers'

export const wishlistRoutes = new Hono<AppEnv>()
wishlistRoutes.use('/wishlist', requireUser)
wishlistRoutes.use('/wishlist/*', requireUser)

wishlistRoutes.get('/wishlist', async (c) => {
  const rows = await query<PropertyRow>(
    `SELECT ${PROPERTY_COLUMNS} FROM wishlist_items w JOIN properties p ON p.id = w.property_id
     WHERE w.user_id = $1 AND p.status = 'Approved' ORDER BY w.created_at DESC`,
    [c.get('user')!.id],
  )
  return c.json({ properties: rows.map(toPropertySummary) })
})

wishlistRoutes.put('/wishlist/:propertyId', async (c) => {
  const propertyId = Number(c.req.param('propertyId'))
  const exists = await queryOne(`SELECT 1 FROM properties WHERE id = $1 AND status = 'Approved'`, [propertyId])
  if (!exists) return c.json({ error: 'We couldn’t find that stay.' }, 404)
  await query('INSERT INTO wishlist_items (user_id, property_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [c.get('user')!.id, propertyId])
  return c.body(null, 204)
})

wishlistRoutes.delete('/wishlist/:propertyId', async (c) => {
  await query('DELETE FROM wishlist_items WHERE user_id = $1 AND property_id = $2', [c.get('user')!.id, Number(c.req.param('propertyId'))])
  return c.body(null, 204)
})
