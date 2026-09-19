import { Hono } from 'hono'
import { bookingService } from '../services/bookings'
import { body, currentUser, requireUser, type AppEnv } from '../http/auth'
import { str } from '../http/validate'

export const bookingRoutes = new Hono<AppEnv>()
bookingRoutes.use('/bookings', requireUser)
bookingRoutes.use('/bookings/*', requireUser)

bookingRoutes.post('/bookings', async (c) => {
  const b = await body(c)
  const booking = await bookingService.create(currentUser(c), {
    propertyId: Number(b.propertyId), checkIn: str(b.checkIn), checkOut: str(b.checkOut), guests: Number(b.guests),
    paymentMethod: str(b.paymentMethod), contactPhone: str(b.contactPhone), specialRequests: str(b.specialRequests),
  })
  return c.json({ booking }, 201)
})

bookingRoutes.get('/bookings', async (c) => c.json({ bookings: await bookingService.listForGuest(currentUser(c)) }))

bookingRoutes.get('/bookings/:code', async (c) => c.json({ booking: await bookingService.get(currentUser(c), c.req.param('code')) }))

bookingRoutes.post('/bookings/:code/cancel', async (c) =>
  c.json({ booking: await bookingService.cancelByGuest(currentUser(c), c.req.param('code')) }))
