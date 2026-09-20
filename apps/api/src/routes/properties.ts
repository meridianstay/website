import { Hono } from 'hono'
import { isISODate, todayISO, type PropertyType } from '@meridian/shared'
import { propertiesRepo, reviewsRepo, toPropertySummary, usersRepo } from '../repositories'
import { bookingService } from '../services/bookings'
import { reviewService } from '../services/reviews'
import { PROPERTY_TYPES } from '../services/listings'
import { body, currentUser, requireUser, type AppEnv } from '../http/auth'
import { AppError, notFound } from '../http/errors'
import { str } from '../http/validate'

export const propertyRoutes = new Hono<AppEnv>()

const intOrUndefined = (v: string | undefined) => {
  const n = Number(v)
  return v && Number.isFinite(n) ? Math.floor(n) : undefined
}

propertyRoutes.get('/locations', async (c) => c.json({ locations: await propertiesRepo.locations() }))

propertyRoutes.get('/properties', async (c) => {
  const q = c.req.query()
  const checkIn = isISODate(q.checkIn) ? q.checkIn : undefined
  const properties = await propertiesRepo.search({
    where: str(q.where) || undefined,
    type: PROPERTY_TYPES.includes(q.type as PropertyType) ? (q.type as PropertyType) : undefined,
    guests: intOrUndefined(q.guests),
    minPrice: intOrUndefined(q.minPrice),
    maxPrice: intOrUndefined(q.maxPrice),
    checkIn,
    checkOut: checkIn && isISODate(q.checkOut) && q.checkOut > checkIn ? q.checkOut : undefined,
    sort: q.sort as never,
    featured: q.featured === '1' || q.featured === 'true',
    management: q.management === 'managed' || q.management === 'self' ? q.management : undefined,
    lat: Number.isFinite(Number(q.lat)) && q.lat ? Number(q.lat) : undefined,
    lng: Number.isFinite(Number(q.lng)) && q.lng ? Number(q.lng) : undefined,
    limit: Math.min(intOrUndefined(q.limit) ?? 50, 100),
  })
  return c.json({ properties })
})

propertyRoutes.get('/destinations', async (c) => c.json({ destinations: await propertiesRepo.destinations() }))

propertyRoutes.get('/properties/:slug', async (c) => {
  const user = c.get('user')
  const p = await propertiesRepo.findBySlug(c.req.param('slug'))
  // Hosts and admins can preview listings that aren't live yet.
  const canPreview = user && (user.role === 'admin' || user.id === p?.hostId)
  if (!p || (p.status !== 'Approved' && !canPreview)) throw notFound('stay')

  const [host, amenities, reviews, bookedRanges, reviewableBookingCode, ratingBreakdown, similar] = await Promise.all([
    usersRepo.findById(p.hostId),
    propertiesRepo.amenitiesOf(p),
    reviewsRepo.visibleForProperty(p.id),
    propertiesRepo.unavailableRanges(p.id, todayISO(), p.checkInTime),
    user ? bookingService.reviewableCode(p.id, user.id) : null,
    reviewsRepo.breakdown(p.id),
    propertiesRepo.similar(p),
  ])
  return c.json({
    property: {
      ...toPropertySummary(p), gallery: p.photos, amenities, reviews, bookedRanges, reviewableBookingCode, status: p.status, ratingBreakdown, similar,
      areaSqft: p.areaSqft, gatheringCapacity: p.gatheringCapacity, checkInTime: p.checkInTime, checkOutTime: p.checkOutTime,
      houseRules: p.houseRules, securityDeposit: p.securityDepositMinor / 100,
      dayUseSettings: p.dayUse.enabled ? {
        enabled: true, blockHours: p.dayUse.blockHours, price: p.dayUse.priceMinor / 100, extraHourPrice: p.dayUse.extraHourMinor / 100,
        opensAt: p.dayUse.opensAt, closesAt: p.dayUse.closesAt,
      } : null,
      host: { name: host?.name ?? 'Host', joinedAt: host?.createdAt ?? p.createdAt, avatar: host?.avatarUrl ?? null },
    },
  })
})

/** Busy hours on a date, for the day-use time picker. */
propertyRoutes.get('/properties/:slug/day', async (c) => {
  const date = c.req.query('date') ?? ''
  if (!isISODate(date)) throw new AppError(400, 'Choose a date.')
  const p = await propertiesRepo.findBySlug(c.req.param('slug'))
  if (!p || p.status !== 'Approved' || !p.dayUse.enabled) throw notFound('stay')
  return c.json({ date, opensAt: p.dayUse.opensAt, closesAt: p.dayUse.closesAt, busy: await propertiesRepo.dayBusy(p, date) })
})

propertyRoutes.post('/properties/:slug/reviews', requireUser, async (c) => {
  const b = await body(c)
  await reviewService.post(currentUser(c), c.req.param('slug'), {
    bookingCode: str(b.bookingCode), rating: b.rating === undefined ? undefined : Number(b.rating),
    propertyRating: b.propertyRating === undefined ? undefined : Number(b.propertyRating), serviceRating: b.serviceRating === undefined ? undefined : Number(b.serviceRating),
    comment: str(b.comment),
  })
  return c.body(null, 201)
})
