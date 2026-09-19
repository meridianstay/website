import { Hono } from 'hono'
import { bookingService, parsePaymentConfirmation } from '../services/bookings'
import { body, currentUid, currentUser, requireUser, type AppEnv } from '../http/auth'
import { AppError } from '../http/errors'
import { str } from '../http/validate'

export const bookingRoutes = new Hono<AppEnv>()
bookingRoutes.use('/bookings', requireUser)
bookingRoutes.use('/bookings/*', requireUser)

/** Returns the booking, plus `payment` (Razorpay Checkout details) when payment is needed. */
bookingRoutes.post('/bookings', async (c) => {
  const b = await body(c)
  const result = await bookingService.create(currentUser(c), currentUid(c), {
    propertyId: Number(b.propertyId), checkIn: str(b.checkIn), checkOut: str(b.checkOut), guests: Number(b.guests),
    paymentMethod: str(b.paymentMethod), contactPhone: str(b.contactPhone), specialRequests: str(b.specialRequests),
    kind: str(b.kind) || 'stay', startTime: str(b.startTime) || undefined, hours: b.hours === undefined ? undefined : Number(b.hours),
    adults: b.adults === undefined ? undefined : Number(b.adults), children: b.children === undefined ? undefined : Number(b.children),
    infants: b.infants === undefined ? undefined : Number(b.infants), pets: b.pets === undefined ? undefined : Number(b.pets),
  })
  return c.json(result, 201)
})

bookingRoutes.get('/bookings', async (c) => c.json({ bookings: await bookingService.listForGuest(currentUser(c)) }))

bookingRoutes.get('/bookings/:code', async (c) => c.json({ booking: await bookingService.get(currentUser(c), c.req.param('code')) }))

bookingRoutes.get('/bookings/:code/payment', async (c) => c.json({ payment: await bookingService.resumePayment(currentUser(c), c.req.param('code')) }))

bookingRoutes.post('/bookings/:code/pay', async (c) =>
  c.json({ booking: await bookingService.confirmPayment(currentUser(c), c.req.param('code'), parsePaymentConfirmation(await body(c))) }))

bookingRoutes.post('/bookings/:code/cancel', async (c) =>
  c.json({ booking: await bookingService.cancelByGuest(currentUser(c), c.req.param('code')) }))

// ─── Razorpay webhook and scheduled expiry (no sign-in; verified by signature / secret) ─────
export const paymentRoutes = new Hono<AppEnv>()

paymentRoutes.post('/payments/razorpay/webhook', async (c) => {
  const raw = await c.req.text()
  await bookingService.handleWebhook(raw, c.req.header('x-razorpay-signature') ?? '')
  return c.json({ ok: true })
})

/** Expires lapsed checkouts and requests. Call with `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends it). */
paymentRoutes.get('/cron/expire', async (c) => {
  const secret = process.env.CRON_SECRET
  if (!secret || c.req.header('authorization') !== `Bearer ${secret}`) throw new AppError(401, 'Not allowed.')
  return c.json({ expired: await bookingService.expireStale() })
})
