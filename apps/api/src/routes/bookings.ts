import { Hono } from 'hono'
import { bookingService, parsePaymentConfirmation } from '../services/bookings'
import { couponService } from '../services/coupons'
import { body, currentUid, currentUser, requireUser, type AppEnv } from '../http/auth'
import { AppError } from '../http/errors'
import { str } from '../http/validate'
import { runJob } from '../services/jobs'

export const bookingRoutes = new Hono<AppEnv>()
bookingRoutes.use('/bookings', requireUser)
bookingRoutes.use('/bookings/*', requireUser)

/** Returns the booking, plus `payment` (Razorpay Checkout details) when payment is needed. */
bookingRoutes.post('/bookings', async (c) => {
  const b = await body(c)
  const result = await bookingService.create(currentUser(c), currentUid(c), {
    propertyId: Number(b.propertyId), checkIn: str(b.checkIn), checkOut: str(b.checkOut), guests: Number(b.guests),
    paymentMethod: str(b.paymentMethod), contactPhone: str(b.contactPhone), contactEmail: str(b.contactEmail), specialRequests: str(b.specialRequests),
    kind: str(b.kind) || 'stay', startTime: str(b.startTime) || undefined, hours: b.hours === undefined ? undefined : Number(b.hours),
    adults: b.adults === undefined ? undefined : Number(b.adults), children: b.children === undefined ? undefined : Number(b.children),
    infants: b.infants === undefined ? undefined : Number(b.infants), pets: b.pets === undefined ? undefined : Number(b.pets),
    couponCode: str(b.couponCode) || undefined,
  })
  return c.json(result, 201)
})

/** Checks a coupon code before booking. */
bookingRoutes.post('/bookings/coupon', async (c) => {
  const b = await body(c)
  return c.json(await couponService.check(str(b.code), Number(b.total), b.kind === 'dayuse' ? 'dayuse' : 'stay'))
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

/** Only the hosting may call these: Vercel Cron sends the secret automatically once it is set. */
const fromScheduler = (c: { req: { header: (k: string) => string | undefined } }) => {
  const secret = process.env.CRON_SECRET
  if (!secret || c.req.header('authorization') !== `Bearer ${secret}`) throw new AppError(401, 'Not allowed.')
}

/** Releases dates held by an unpaid checkout or an unanswered request. Scheduled in vercel.json. */
paymentRoutes.get('/cron/expire', async (c) => {
  fromScheduler(c)
  const { result } = await runJob('expire', 'schedule')
  return c.json(result)
})

/** Check-in reminders, review invitations, and starting or finishing scheduled offers. */
paymentRoutes.get('/cron/daily', async (c) => {
  fromScheduler(c)
  const { result } = await runJob('daily', 'schedule')
  return c.json(result)
})
