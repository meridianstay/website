import { Hono } from 'hono'
import { todayISO } from '@meridian/shared'
import { amenitiesRepo, propertiesRepo, statsRepo } from '../repositories'
import { bookingService } from '../services/bookings'
import { promotionService } from '../services/promotions'
import { listingService, parseListing } from '../services/listings'
import { body, currentUid, currentUser, requireUser, type AppEnv } from '../http/auth'
import { str } from '../http/validate'

// Anyone signed in can host: creating a first listing turns a guest into a host.
export const hostRoutes = new Hono<AppEnv>()
hostRoutes.use('/host/*', requireUser)

const id = (c: { req: { param: (k: string) => string } }, key = 'id') => Number(c.req.param(key))

hostRoutes.get('/amenities', async (c) => c.json({ amenities: await amenitiesRepo.list() }))

hostRoutes.get('/host/stats', async (c) => {
  await bookingService.sweepSoon()
  return c.json(await statsRepo.forHost(currentUser(c).id, todayISO()))
})
hostRoutes.get('/host/listings', async (c) => c.json({ listings: await propertiesRepo.listForHost(currentUser(c).id) }))
hostRoutes.get('/host/listings/:id', async (c) => c.json({ listing: await listingService.getForEditing(currentUser(c), id(c)) }))
hostRoutes.get('/host/bookings', async (c) => c.json({ bookings: await bookingService.listForHost(currentUser(c)) }))
hostRoutes.post('/host/bookings/:code/accept', async (c) => c.json({ booking: await bookingService.accept(currentUser(c), c.req.param('code')) }))
hostRoutes.post('/host/bookings/:code/decline', async (c) =>
  c.json({ booking: await bookingService.decline(currentUser(c), c.req.param('code'), str((await body(c)).reason)) }))

// ── Promotions ───────────────────────────────────────────────────────────────
hostRoutes.get('/host/promotions', async (c) => c.json({ campaigns: await promotionService.forHost(currentUser(c)), settings: await promotionService.settings() }))
hostRoutes.post('/host/promotions', async (c) => c.json(await promotionService.create(currentUser(c), promotionService.parse(await body(c))), 201))
hostRoutes.post('/host/promotions/:id/pay', async (c) => {
  const b = await body(c)
  const campaign = await promotionService.confirmPayment(currentUser(c), id(c), {
    orderId: str(b.razorpay_order_id), paymentId: str(b.razorpay_payment_id), signature: str(b.razorpay_signature),
  })
  return c.json({ campaign })
})
hostRoutes.post('/host/promotions/:id/cancel', async (c) => c.json({ campaign: await promotionService.cancel(currentUser(c), id(c)) }))

hostRoutes.post('/host/listings', async (c) => c.json({ id: await listingService.create(currentUser(c), currentUid(c), parseListing(await body(c))) }, 201))

hostRoutes.put('/host/listings/:id', async (c) => {
  await listingService.update(currentUser(c), id(c), parseListing(await body(c)))
  return c.body(null, 204)
})

hostRoutes.post('/host/listings/:id/pause', async (c) => {
  await listingService.pause(currentUser(c), id(c))
  return c.body(null, 204)
})

hostRoutes.post('/host/listings/:id/relist', async (c) => {
  await listingService.relist(currentUser(c), id(c))
  return c.body(null, 204)
})

hostRoutes.get('/host/listings/:id/calendar', async (c) => c.json(await listingService.calendar(currentUser(c), id(c))))

hostRoutes.post('/host/listings/:id/blocks', async (c) => {
  const b = await body(c)
  await listingService.addBlock(currentUser(c), id(c), { checkIn: str(b.checkIn), checkOut: str(b.checkOut), note: str(b.note) })
  return c.body(null, 201)
})

hostRoutes.delete('/host/listings/:id/blocks/:blockId', async (c) => {
  await listingService.removeBlock(currentUser(c), id(c), id(c, 'blockId'))
  return c.body(null, 204)
})
