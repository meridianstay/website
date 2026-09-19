import {
  addDays, countedGuests, dayUseRefundMinor, formatTime, isTime, minutesOf, quoteDayUse, type GuestBreakdown,
  commissionMinor, commissionPct, daysBetween, guestRefundMinor, isISODate, MAX_NIGHTS, PAYMENT_HOLD_MINUTES, quoteStay, REQUEST_HOURS,
  todayISO, type BookingDetail, type Me, type PaymentMethod, type PaymentRequest,
} from '@meridian/shared'
import { randomInt } from 'node:crypto'
import { auditLogRepo, bookingsRepo, contentRepo, keptMinor, NightsTakenError, propertiesRepo, toBooking, usersRepo, type BookingDoc } from '../repositories'
import { nowISO } from '../store/db'
import { AppError, notFound } from '../http/errors'
import { checkPhone, collect, str } from '../http/validate'
import { paymentGateway, paymentsService, type GatewayConfig, type GatewayPayment } from './payments'

// Booking rules: valid dates, capacity, availability, server-side pricing, commission, and the two booking modes:
//   managed listings book instantly (paid in full at checkout);
//   self-managed listings send a request the host accepts within REQUEST_HOURS (payment authorised, charged on accept).
// Without Razorpay keys the same flows run in test mode, without taking money.

export const PAYMENT_METHODS: PaymentMethod[] = ['upi', 'card', 'netbanking']

// No 0/O or 1/I so codes are easy to read out over the phone.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const newBookingCode = () => `MS-${Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')}`

export interface BookingRequest {
  propertyId: number; checkIn: string; checkOut: string; guests: number
  paymentMethod: string; contactPhone: string; specialRequests: string
  /** stay (default) or dayuse. Day use books `hours` from `startTime` on `checkIn`. */
  kind?: string; startTime?: string; hours?: number
  adults?: number; children?: number; infants?: number; pets?: number
}

const toHHMM = (mins: number) => (mins >= 24 * 60 ? '' : `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`)

const datesTaken = () =>
  new AppError(409, 'Some of those nights were just booked. Please choose different dates.', { checkIn: 'Those dates are no longer available.' })

const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString()

/** When a host must answer by: 24 hours, but never after noon on check-in day (or a day-use start time, IST), and at least an hour. */
export function requestDeadline(checkIn: string, now = Date.now(), startTime = '12:00') {
  const checkInNoon = Date.parse(`${checkIn}T${startTime}:00+05:30`)
  return new Date(Math.max(now + 3_600_000, Math.min(now + REQUEST_HOURS * 3_600_000, checkInNoon))).toISOString()
}

/** Splits what the platform keeps into commission and host payout. */
const split = (b: Pick<BookingDoc, 'commissionPct'>, keptMinor: number) => {
  const commission = commissionMinor(keptMinor, b.commissionPct)
  return { commissionMinor: commission, hostPayoutMinor: keptMinor - commission }
}

function paymentRequest(cfg: GatewayConfig, b: BookingDoc): PaymentRequest {
  return { provider: 'razorpay', keyId: cfg.keyId, orderId: b.razorpayOrderId!, amount: b.totalMinor, currency: 'INR', captureNow: b.instantBook }
}

/**
 * Returns money to the guest. Test bookings and uncaptured authorisations need no call (Razorpay releases
 * those itself). If Razorpay refuses, the amount is recorded as pending so an admin can retry.
 */
async function refund(b: BookingDoc, amountMinor: number) {
  if (amountMinor <= 0 || b.paymentStatus === 'test' || !b.razorpayPaymentId) return
  const cfg = await paymentsService.storedConfig()
  try {
    if (!cfg) throw new Error('Razorpay keys are missing')
    const payment = await paymentGateway().fetchPayment(cfg, b.razorpayPaymentId)
    if (payment.status === 'authorized') return // never captured: released automatically
    await paymentGateway().refund(cfg, b.razorpayPaymentId, amountMinor)
  } catch (err) {
    await bookingsRepo.setFields(b.code, { refundPendingMinor: amountMinor })
    await auditLogRepo.record(null, 'payment.refund_failed', 'booking', b.code, { amountMinor, reason: err instanceof Error ? err.message : 'unknown' })
  }
}

/** Status for a payment that's being given back in full. */
const returnedStatus = (b: BookingDoc) =>
  b.paymentStatus === 'test' ? 'test' as const : b.paymentStatus === 'paid' ? 'refunded' as const : b.paymentStatus === 'authorized' ? 'released' as const : b.paymentStatus

let lastSweep = 0

export const bookingService = {
  async create(guest: Me, uid: string, req: BookingRequest): Promise<{ booking: BookingDetail; payment: PaymentRequest | null }> {
    const today = todayISO()
    const kind = req.kind === 'dayuse' ? 'dayuse' : 'stay'
    const { checkIn, contactPhone, specialRequests } = req
    const party: GuestBreakdown = {
      adults: Number(req.adults ?? req.guests), children: Number(req.children ?? 0), infants: Number(req.infants ?? 0), pets: Number(req.pets ?? 0),
    }
    const guests = countedGuests(party)
    const whole = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max
    collect({
      guests: whole(party.adults, 1, 100) ? (whole(party.children, 0, 50) ? null : 'Check the number of children.') : 'Add at least one adult.',
      infants: whole(party.infants, 0, 5) ? null : 'At most 5 infants.',
      pets: whole(party.pets, 0, 3) ? null : 'At most 3 pets.',
      paymentMethod: PAYMENT_METHODS.includes(req.paymentMethod as PaymentMethod) ? null : 'Choose a payment method.',
      contactPhone: checkPhone(contactPhone),
      specialRequests: specialRequests.length > 500 ? 'Keep special requests under 500 characters.' : null,
    })

    const property = await propertiesRepo.get(req.propertyId)
    if (!property || property.status !== 'Approved') throw new AppError(404, 'This stay isn’t available for booking.')
    if (property.hostId === guest.id) throw new AppError(400, 'You can’t book your own listing.')
    if (party.pets > 0 && !property.houseRules.pets) collect({ pets: 'This property doesn’t allow pets.' })

    let slot: { checkOut: string; nights: number; startTime: string | null; endTime: string | null; hours: number | null
      pricePerNightMinor: number; baseMinor: number; extraMinor: number; totalMinor: number; deadline: string }
    if (kind === 'dayuse') {
      const d = property.dayUse
      if (!d.enabled) throw new AppError(400, 'This property doesn’t offer day use.')
      const hours = Number(req.hours)
      const start = req.startTime ?? ''
      const end = isTime(start) && Number.isInteger(hours) ? toHHMM(minutesOf(start) + hours * 60) : ''
      const capacity = property.gatheringCapacity ?? property.maxGuests
      const nowIST = new Date(Date.now() + 5.5 * 3_600_000).toISOString()
      collect({
        checkIn: !isISODate(checkIn) ? 'Choose a date.' : checkIn < today ? 'The date can’t be in the past.'
          : checkIn === today && isTime(start) && `${checkIn}T${start}` <= nowIST.slice(0, 16) ? 'Choose a start time later today.' : null,
        startTime: !isTime(start) ? 'Choose a start time.' : minutesOf(start) < minutesOf(d.opensAt) ? `Day use starts from ${formatTime(d.opensAt)}.` : null,
        hours: !Number.isInteger(hours) || hours < d.blockHours ? `Book at least ${d.blockHours} hours.`
          : !end || minutesOf(start) + hours * 60 > minutesOf(d.closesAt) ? `Day use ends by ${formatTime(d.closesAt)}.` : null,
        guests: guests > capacity ? `Up to ${capacity} people for day use.` : null,
      })
      const q = quoteDayUse({ blockHours: d.blockHours, price: d.priceMinor / 100, extraHourPrice: d.extraHourMinor / 100 }, hours)
      slot = {
        checkOut: addDays(checkIn, 1), nights: 0, startTime: start, endTime: end, hours,
        pricePerNightMinor: d.priceMinor, baseMinor: d.priceMinor, extraMinor: Math.round(q.extraAmount * 100), totalMinor: Math.round(q.total * 100),
        deadline: requestDeadline(checkIn, Date.now(), start),
      }
    } else {
      const checkOut = req.checkOut
      const datesValid = isISODate(checkIn) && isISODate(checkOut)
      if (!property.overnight) throw new AppError(400, 'This property only offers day use.')
      collect({
        checkIn: !datesValid ? 'Choose your check-in and check-out dates.' : checkIn < today ? 'Check-in can’t be in the past.' : null,
        checkOut: datesValid && checkOut <= checkIn ? 'Check-out must be after check-in.'
          : datesValid && daysBetween(checkIn, checkOut) > MAX_NIGHTS ? `Stays can be at most ${MAX_NIGHTS} nights.` : null,
        guests: guests > property.maxGuests ? `This stay fits up to ${property.maxGuests} guests.` : null,
      })
      // The browser shows a preview; the price charged is always recalculated here.
      const q = quoteStay(property.pricePerNightMinor / 100, checkIn, checkOut, guests)
      slot = {
        checkOut, nights: q.nights, startTime: null, endTime: null, hours: null, pricePerNightMinor: property.pricePerNightMinor,
        baseMinor: Math.round(q.baseAmount * 100), extraMinor: Math.round(q.extraGuestAmount * 100), totalMinor: Math.round(q.total * 100),
        deadline: requestDeadline(checkIn),
      }
    }

    const totalMinor = slot.totalMinor
    const instant = (property.management ?? 'self') === 'managed'
    const pct = commissionPct(property.management ?? 'self', (await contentRepo.settings()).commission)
    const cfg = await paymentsService.activeConfig()
    const status = cfg ? 'AwaitingPayment' : instant ? 'Confirmed' : 'Requested'
    const code = newBookingCode()
    const guestDoc = (await usersRepo.findByUid(uid))!
    try {
      await bookingsRepo.create({
        code, propertyId: property.id, guestId: guest.id, checkIn, checkOut: slot.checkOut, nights: slot.nights, guests, currency: 'INR',
        pricePerNightMinor: slot.pricePerNightMinor, baseMinor: slot.baseMinor,
        // For day use this is the extra hours; for stays, the extra-guest charge.
        extraGuestMinor: slot.extraMinor, serviceFeeMinor: 0, totalMinor,
        commissionPct: pct, ...split({ commissionPct: pct }, totalMinor),
        paymentMethod: req.paymentMethod as PaymentMethod, contactPhone, specialRequests: specialRequests || null,
        status, paymentStatus: cfg ? 'created' : 'test',
        expiresAt: status === 'AwaitingPayment' ? inMinutes(PAYMENT_HOLD_MINUTES) : status === 'Requested' ? slot.deadline : null,
        kind, startTime: slot.startTime, endTime: slot.endTime, hours: slot.hours, guestBreakdown: party,
        securityDepositMinor: property.securityDepositMinor, checkInTime: property.checkInTime, checkOutTime: property.checkOutTime,
      }, property, guestDoc)
    } catch (err) {
      if (err instanceof NightsTakenError) throw kind === 'dayuse'
        ? new AppError(409, err.message || 'Those hours were just booked. Please choose another time.', { startTime: err.message || 'Those hours are no longer available.' })
        : datesTaken()
      throw err
    }

    let booking = (await bookingsRepo.find(code))!
    if (cfg) {
      try {
        const order = await paymentGateway().createOrder(cfg, {
          amountMinor: totalMinor, receipt: code, capture: instant, notes: { booking: code, listing: property.title.slice(0, 200) },
        })
        await bookingsRepo.setFields(code, { razorpayOrderId: order.id })
        booking = { ...booking, razorpayOrderId: order.id }
      } catch (err) {
        // Free the dates straight away if the payment can't start.
        await bookingsRepo.transition(code, ['AwaitingPayment'], () => ({ status: 'Cancelled', cancelledAt: nowISO(), paymentStatus: 'failed' }))
        throw err
      }
    }
    return { booking: toBooking(booking, today), payment: cfg ? paymentRequest(cfg, booking) : null }
  },

  /** Payment details again, for a guest who closed the payment window before finishing. */
  async resumePayment(guest: Me, code: string): Promise<PaymentRequest> {
    const b = await bookingsRepo.find(code)
    if (!b || b.guestId !== guest.id) throw notFound('booking')
    if (b.status !== 'AwaitingPayment' || !b.razorpayOrderId || (b.expiresAt && b.expiresAt < nowISO())) {
      throw new AppError(400, 'This checkout has expired. Please start the booking again.')
    }
    const cfg = await paymentsService.storedConfig()
    if (!cfg) throw new AppError(503, 'Online payments are switched off right now.')
    return paymentRequest(cfg, b)
  },

  /** Called by the browser after Razorpay Checkout succeeds. The signature proves the payment is genuine. */
  async confirmPayment(guest: Me, code: string, input: { orderId: string; paymentId: string; signature: string }) {
    const b = await bookingsRepo.find(code)
    if (!b || b.guestId !== guest.id) throw notFound('booking')
    const cfg = await paymentsService.storedConfig()
    if (!cfg || !b.razorpayOrderId) throw new AppError(400, 'This booking doesn’t take online payment.')
    if (input.orderId !== b.razorpayOrderId || !paymentsService.verifyCheckout(cfg, input.orderId, input.paymentId, input.signature)) {
      throw new AppError(400, 'We couldn’t verify that payment. If money was taken, it will be returned automatically.')
    }
    const payment = await paymentGateway().fetchPayment(cfg, input.paymentId)
    await this.applyPayment(cfg, b, payment)
    return toBooking((await bookingsRepo.find(code))!, todayISO())
  },

  /**
   * Moves a booking on once its payment is authorised or captured. Safe to run more than once for the same
   * payment (the browser and the webhook both call it).
   */
  async applyPayment(cfg: GatewayConfig, b: BookingDoc, payment: GatewayPayment) {
    if (payment.order_id !== b.razorpayOrderId) return
    if (payment.status === 'failed') {
      if (b.status === 'AwaitingPayment') await bookingsRepo.setFields(b.code, { paymentStatus: 'failed' })
      return
    }
    if (payment.status !== 'authorized' && payment.status !== 'captured') return
    if (b.status !== 'AwaitingPayment') {
      // Already handled, or the booking lapsed before payment arrived: give the money back.
      if (b.razorpayPaymentId !== payment.id) {
        if (payment.status === 'captured') await paymentGateway().refund(cfg, payment.id, payment.amount).catch(() => {})
        await auditLogRepo.record(null, 'payment.returned', 'booking', b.code, { paymentId: payment.id, reason: `booking ${b.status}` })
      }
      return
    }
    if (payment.amount !== b.totalMinor) throw new AppError(400, 'The amount paid doesn’t match this booking. It will be refunded.')

    let status = payment.status
    if (b.instantBook && status === 'authorized') {
      await paymentGateway().capture(cfg, payment.id, b.totalMinor).catch(async (err) => {
        if ((await paymentGateway().fetchPayment(cfg, payment.id)).status !== 'captured') throw err
      })
      status = 'captured'
    }
    const now = nowISO()
    const moved = await bookingsRepo.transition(b.code, ['AwaitingPayment'], () => b.instantBook
      ? { status: 'Confirmed', paymentStatus: 'paid', razorpayPaymentId: payment.id, confirmedAt: now, expiresAt: null }
      : { status: 'Requested', paymentStatus: status === 'captured' ? 'paid' : 'authorized', razorpayPaymentId: payment.id, expiresAt: requestDeadline(b.checkIn) })
    if (!moved && status === 'captured') {
      const current = await bookingsRepo.find(b.code)
      if (current?.razorpayPaymentId !== payment.id) await paymentGateway().refund(cfg, payment.id, payment.amount).catch(() => {})
    }
  },

  /** Razorpay webhook: finishes bookings whose browser closed before confirming. */
  async handleWebhook(rawBody: string, signature: string) {
    const cfg = await paymentsService.storedConfig()
    if (!cfg || !paymentsService.verifyWebhook(cfg, rawBody, signature)) throw new AppError(400, 'Invalid signature.')
    const event = JSON.parse(rawBody) as { event?: string; payload?: { payment?: { entity?: GatewayPayment } } }
    const payment = event.payload?.payment?.entity
    if (!payment?.order_id) return
    const b = await bookingsRepo.findByOrder(payment.order_id)
    if (b) await this.applyPayment(cfg, b, payment)
  },

  /** A booking the user may see: their own, one at their listing, or any for admins. */
  async get(user: Me, code: string) {
    await this.sweepSoon()
    const b = await bookingsRepo.find(code)
    if (!b || !(b.guestId === user.id || b.hostId === user.id || user.role === 'admin')) throw notFound('booking')
    return toBooking(b, todayISO())
  },

  async listForGuest(guest: Me) {
    await this.sweepSoon()
    return bookingsRepo.listForGuest(guest.id, todayISO())
  },

  async listForHost(host: Me) {
    await this.sweepSoon()
    return bookingsRepo.listForHost(host.id, todayISO())
  },

  /**
   * Guests can cancel until the day before check-in. Paid stays are refunded in full up to 48 hours before
   * check-in, otherwise minus the first night; paid day use in full up to 48 hours before, half up to 24 hours
   * before, nothing later. Requests and unpaid checkouts are cancelled free.
   */
  async cancelByGuest(guest: Me, code: string) {
    const today = todayISO()
    let refundMinor = 0
    const before = await bookingsRepo.transition(code, ['AwaitingPayment', 'Requested', 'Confirmed'], (b) => {
      if (b.guestId !== guest.id || b.checkIn <= today) return null
      refundMinor = b.status === 'Confirmed'
        ? (b.kind === 'dayuse' ? dayUseRefundMinor(b.totalMinor, b.checkIn, b.startTime ?? '12:00') : guestRefundMinor(b.totalMinor, b.pricePerNightMinor, b.checkIn))
        : b.status === 'Requested' ? b.totalMinor : 0
      const kept = b.status === 'Confirmed' ? b.totalMinor - refundMinor : 0
      return {
        status: 'Cancelled', cancelledAt: nowISO(), refundedMinor: refundMinor, ...split(b, kept),
        paymentStatus: b.status === 'AwaitingPayment' ? b.paymentStatus : b.paymentStatus === 'test' ? 'test'
          : refundMinor === 0 ? b.paymentStatus : refundMinor < b.totalMinor ? 'partially_refunded' : returnedStatus(b),
      }
    })
    if (!before) throw new AppError(400, 'This booking can’t be cancelled. Stays can be cancelled until the day before check-in.')
    await refund(before, refundMinor)
    return toBooking((await bookingsRepo.find(code))!, today)
  },

  /** The host accepts a request: the payment is captured and the stay confirmed. */
  async accept(host: Me, code: string) {
    const b = await bookingsRepo.find(code)
    if (!b || b.hostId !== host.id) throw notFound('booking')
    if (b.status !== 'Requested') throw new AppError(400, 'This request has already been answered or has expired.')
    if (b.expiresAt && b.expiresAt < nowISO()) {
      await this.expire(b)
      throw new AppError(400, `This request expired: requests must be answered within ${REQUEST_HOURS} hours.`)
    }
    let paymentStatus = b.paymentStatus
    if (b.paymentStatus === 'authorized') {
      const cfg = await paymentsService.storedConfig()
      if (!cfg) throw new AppError(503, 'Razorpay keys are missing, so the payment can’t be collected. Ask an admin to check Settings → Payments.')
      await paymentGateway().capture(cfg, b.razorpayPaymentId!, b.totalMinor).catch(async (err) => {
        if ((await paymentGateway().fetchPayment(cfg, b.razorpayPaymentId!)).status !== 'captured') throw err
      })
      paymentStatus = 'paid'
    }
    const now = nowISO()
    const moved = await bookingsRepo.transition(code, ['Requested'], () => ({ status: 'Confirmed', paymentStatus, confirmedAt: now, decidedAt: now, expiresAt: null }))
    if (!moved) {
      // The guest withdrew at the same moment: return what was just captured.
      if (paymentStatus === 'paid' && b.paymentStatus === 'authorized') await refund({ ...b, paymentStatus: 'paid' }, b.totalMinor)
      throw new AppError(409, 'The guest withdrew this request.')
    }
    return toBooking((await bookingsRepo.find(code))!, todayISO())
  },

  /** The host declines a request: the guest's payment is released in full. */
  async decline(host: Me, code: string, reason: string) {
    if (reason.length > 300) collect({ reason: 'Keep the message under 300 characters.' })
    const before = await bookingsRepo.transition(code, ['Requested'], (b) => b.hostId !== host.id ? null : ({
      status: 'Declined', decidedAt: nowISO(), declineReason: reason || null, expiresAt: null, paymentStatus: returnedStatus(b),
      refundedMinor: b.paymentStatus === 'paid' ? b.totalMinor : 0, ...split(b, 0),
    }))
    if (!before) throw new AppError(400, 'This request has already been answered or has expired.')
    await refund(before, before.totalMinor)
    return toBooking((await bookingsRepo.find(code))!, todayISO())
  },

  /** Admins can cancel any upcoming booking, request or checkout; the guest gets everything back. */
  async cancelByAdmin(admin: Me, code: string) {
    const today = todayISO()
    const before = await bookingsRepo.transition(code, ['AwaitingPayment', 'Requested', 'Confirmed'], (b) => b.checkOut <= today ? null : ({
      status: 'Cancelled', cancelledAt: nowISO(), paymentStatus: returnedStatus(b), refundedMinor: b.paymentStatus === 'paid' ? b.totalMinor : 0, ...split(b, 0),
    }))
    if (!before) throw new AppError(400, 'Only upcoming or current bookings can be cancelled.')
    await refund(before, before.totalMinor)
    await auditLogRepo.record(admin, 'booking.cancel', 'booking', code, { refundMinor: before.paymentStatus === 'paid' ? before.totalMinor : 0 })
  },

  /** Retries a refund Razorpay refused earlier. */
  async retryRefund(admin: Me, code: string) {
    const b = await bookingsRepo.find(code)
    if (!b?.refundPendingMinor) throw new AppError(400, 'This booking has no refund waiting.')
    const amount = b.refundPendingMinor
    await bookingsRepo.setFields(code, { refundPendingMinor: 0 })
    await refund(b, amount)
    await auditLogRepo.record(admin, 'payment.refund_retry', 'booking', code, { amountMinor: amount })
  },

  /** Ends one lapsed checkout or request. */
  async expire(b: BookingDoc) {
    const before = await bookingsRepo.transition(b.code, ['AwaitingPayment', 'Requested'], (cur) => cur.expiresAt && cur.expiresAt < nowISO() ? ({
      status: 'Expired', decidedAt: nowISO(), ...split(cur, 0),
      ...(cur.status === 'Requested' ? { paymentStatus: returnedStatus(cur), refundedMinor: cur.paymentStatus === 'paid' ? cur.totalMinor : 0 } : {}),
    }) : null)
    if (before?.status === 'Requested') await refund(before, before.totalMinor)
    return !!before
  },

  /** Expires every lapsed checkout and request. Runs from the cron route and, at most once a minute, on reads. */
  async expireStale() {
    let expired = 0
    for (const b of await bookingsRepo.stale(nowISO())) if (await this.expire(b)) expired++
    return expired
  },

  async sweepSoon() {
    if (Date.now() - lastSweep < 60_000) return
    lastSweep = Date.now()
    await this.expireStale().catch((err) => console.error('[bookings] expiry sweep failed', err))
  },

  /** The guest's latest finished, unreviewed stay at a listing, if any. */
  async reviewableCode(propertyId: number, guestId: number) {
    const today = todayISO()
    const rows = (await bookingsRepo.forProperty(propertyId))
      .filter((b) => b.guestId === guestId && b.status === 'Confirmed' && b.checkOut <= today && !b.reviewed)
      .sort((a, b) => b.checkOut.localeCompare(a.checkOut))
    return rows[0]?.code ?? null
  },
}

export { keptMinor }
export const parsePaymentConfirmation = (b: Record<string, unknown>) => ({
  orderId: str(b.razorpay_order_id), paymentId: str(b.razorpay_payment_id), signature: str(b.razorpay_signature),
})
/** For tests: lets the next read run the expiry sweep immediately. */
export const resetSweepTimer = () => {
  lastSweep = 0
}
