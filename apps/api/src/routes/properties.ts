import { Hono } from 'hono'
import { isISODate, todayISO, type PropertyType } from '@meridian/shared'
import { availabilityRepo, bookingsRepo, propertiesRepo, reviewsRepo, toPropertySummary } from '../repositories'
import { reviewService } from '../services/reviews'
import { PROPERTY_TYPES } from '../services/listings'
import { body, currentUser, requireUser, type AppEnv } from '../http/auth'
import { notFound } from '../http/errors'
import { str } from '../http/validate'

export const propertyRoutes = new Hono<AppEnv>()

const intOrNull = (v: string | undefined) => {
  const n = Number(v)
  return v && Number.isFinite(n) ? Math.floor(n) : null
}

propertyRoutes.get('/locations', async (c) => c.json({ locations: await propertiesRepo.locations() }))

propertyRoutes.get('/properties', async (c) => {
  const q = c.req.query()
  const checkIn = isISODate(q.checkIn) ? q.checkIn : undefined
  const properties = await propertiesRepo.search({
    where: str(q.where) || undefined,
    type: PROPERTY_TYPES.includes(q.type as PropertyType) ? (q.type as PropertyType) : undefined,
    guests: intOrNull(q.guests) ?? undefined,
    minPrice: intOrNull(q.minPrice) ?? undefined,
    maxPrice: intOrNull(q.maxPrice) ?? undefined,
    checkIn,
    checkOut: checkIn && isISODate(q.checkOut) && q.checkOut > checkIn ? q.checkOut : undefined,
    sort: q.sort as never,
    featured: q.featured === '1' || q.featured === 'true',
    limit: Math.min(intOrNull(q.limit) ?? 50, 100),
  })
  return c.json({ properties })
})

propertyRoutes.get('/properties/:slug', async (c) => {
  const user = c.get('user')
  const row = await propertiesRepo.findBySlug(c.req.param('slug'))
  // Hosts and admins can preview listings that aren't live yet.
  const canPreview = user && (user.role === 'admin' || user.id === row?.host_id)
  if (!row || (row.status !== 'Approved' && !canPreview)) throw notFound('stay')

  const today = todayISO()
  const [gallery, amenities, reviews, bookedRanges, reviewableBookingCode] = await Promise.all([
    propertiesRepo.photos(row.id),
    propertiesRepo.amenities(row.id),
    reviewsRepo.visibleForProperty(row.id),
    availabilityRepo.unavailableRanges(row.id, today),
    user ? bookingsRepo.reviewableAt(row.id, user.id, today) : null,
  ])
  return c.json({
    property: {
      ...toPropertySummary(row), gallery, amenities, reviews, bookedRanges, reviewableBookingCode, status: row.status,
      host: { name: row.host_name, joinedAt: row.host_joined.toISOString(), avatar: row.host_avatar },
    },
  })
})

propertyRoutes.post('/properties/:slug/reviews', requireUser, async (c) => {
  const b = await body(c)
  await reviewService.post(currentUser(c), c.req.param('slug'), { bookingCode: str(b.bookingCode), rating: Number(b.rating), comment: str(b.comment) })
  return c.body(null, 201)
})
