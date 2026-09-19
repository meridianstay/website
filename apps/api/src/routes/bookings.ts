import { Hono } from 'hono'
import { daysBetween, isISODate, MAX_NIGHTS, quoteStay, todayISO, type PaymentMethod } from '@meridian/shared'
import { query, queryOne, transaction } from '../db/pool'
import { requireUser, type AppEnv } from '../auth'
import { BOOKING_SELECT, toBooking, type BookingRow } from '../mappers'
import { checkPhone, collect, str } from '../validate'
import { newBookingCode } from '../bookingCode'

export const bookingRoutes = new Hono<AppEnv>()
bookingRoutes.use('/bookings', requireUser)
bookingRoutes.use('/bookings/*', requireUser)

const PAYMENT_METHODS: PaymentMethod[] = ['upi', 'card', 'netbanking']

bookingRoutes.post('/bookings', async (c) => {
  const user = c.get('user')!
  const body = await c.req.json().catch(() => ({}))
  const today = todayISO()
  const checkIn = str(body.checkIn)
  const checkOut = str(body.checkOut)
  const guests = Number(body.guests)
  const contactPhone = str(body.contactPhone)
  const specialRequests = str(body.specialRequests)

  const datesValid = isISODate(checkIn) && isISODate(checkOut)
  collect({
    checkIn: !datesValid ? 'Choose your check-in and check-out dates.' : checkIn < today ? 'Check-in can’t be in the past.' : null,
    checkOut: datesValid && checkOut <= checkIn ? 'Check-out must be after check-in.'
      : datesValid && daysBetween(checkIn, checkOut) > MAX_NIGHTS ? `Stays can be at most ${MAX_NIGHTS} nights.` : null,
    guests: Number.isInteger(guests) && guests >= 1 ? null : 'Add at least one guest.',
    paymentMethod: PAYMENT_METHODS.includes(body.paymentMethod) ? null : 'Choose a payment method.',
    contactPhone: checkPhone(contactPhone),
    specialRequests: specialRequests.length > 500 ? 'Keep special requests under 500 characters.' : null,
  })

  const property = await queryOne<{ id: number; host_id: number; price_per_night_minor: number; max_guests: number; currency: string }>(
    `SELECT id, host_id, price_per_night_minor, max_guests, currency FROM properties WHERE id = $1 AND status = 'Approved'`,
    [Number(body.propertyId)],
  )
  if (!property) return c.json({ error: 'This stay isn’t available for booking.' }, 404)
  if (property.host_id === user.id) return c.json({ error: 'You can’t book your own listing.' }, 400)
  if (guests > property.max_guests) {
    collect({ guests: `This stay fits up to ${property.max_guests} guests.` })
  }

  // Prices are always recomputed here; the browser's numbers are only a preview.
  const q = quoteStay(property.price_per_night_minor / 100, checkIn, checkOut, guests)
  try {
    const code = await transaction(async (db) => {
      // Lock the property row so a booking and a host block can't race each other.
      await query('SELECT id FROM properties WHERE id = $1 FOR UPDATE', [property.id], db)
      const blocked = await queryOne(
        'SELECT 1 FROM availability_blocks WHERE property_id = $1 AND daterange(start_date, end_date) && daterange($2::date, $3::date)',
        [property.id, checkIn, checkOut], db,
      )
      if (blocked) throw Object.assign(new Error('blocked'), { code: '23P01' })
      const row = await queryOne<{ code: string }>(
        `INSERT INTO bookings (code, property_id, guest_id, check_in, check_out, nights, guests, currency, price_per_night_minor,
           base_amount_minor, extra_guest_amount_minor, service_fee_minor, total_minor, payment_method, payment_status,
           contact_phone, special_requests)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'test',$15,$16) RETURNING code`,
        [newBookingCode(), property.id, user.id, checkIn, checkOut, q.nights, guests, property.currency,
          property.price_per_night_minor, Math.round(q.baseAmount * 100), Math.round(q.extraGuestAmount * 100),
          Math.round(q.serviceFee * 100), Math.round(q.total * 100), body.paymentMethod, contactPhone, specialRequests || null],
        db,
      )
      await query('UPDATE users SET phone = $1 WHERE id = $2 AND phone IS NULL', [contactPhone, user.id], db)
      return row!.code
    })
    const booking = await queryOne<BookingRow>(`${BOOKING_SELECT} WHERE b.code = $1`, [code])
    return c.json({ booking: toBooking(booking!, today) }, 201)
  } catch (err) {
    // 23P01 = exclusion violation: another confirmed booking overlaps these dates.
    if ((err as { code?: string }).code === '23P01') {
      return c.json({ error: 'Some of those nights were just booked. Please choose different dates.', fields: { checkIn: 'Those dates are no longer available.' } }, 409)
    }
    throw err
  }
})

bookingRoutes.get('/bookings', async (c) => {
  const rows = await query<BookingRow>(`${BOOKING_SELECT} WHERE b.guest_id = $1 ORDER BY b.check_in DESC`, [c.get('user')!.id])
  const today = todayISO()
  return c.json({ bookings: rows.map((r) => toBooking(r, today)) })
})

bookingRoutes.get('/bookings/:code', async (c) => {
  const user = c.get('user')!
  const row = await queryOne<BookingRow & { guest_id: number; host_id: number }>(
    `${BOOKING_SELECT.replace('SELECT b.*,', 'SELECT b.*, p.host_id,')} WHERE b.code = $1`,
    [c.req.param('code')],
  )
  const allowed = row && (row.guest_id === user.id || row.host_id === user.id || user.role === 'admin')
  if (!allowed) return c.json({ error: 'We couldn’t find that booking.' }, 404)
  return c.json({ booking: toBooking(row, todayISO()) })
})

bookingRoutes.post('/bookings/:code/cancel', async (c) => {
  const user = c.get('user')!
  const today = todayISO()
  const updated = await queryOne<{ code: string }>(
    `UPDATE bookings SET status = 'Cancelled', cancelled_at = now()
     WHERE code = $1 AND guest_id = $2 AND status = 'Confirmed' AND check_in > $3 RETURNING code`,
    [c.req.param('code'), user.id, today],
  )
  if (!updated) return c.json({ error: 'This booking can’t be cancelled. Stays can be cancelled until the day before check-in.' }, 400)
  const row = await queryOne<BookingRow>(`${BOOKING_SELECT} WHERE b.code = $1`, [updated.code])
  return c.json({ booking: toBooking(row!, today) })
})
