import { after, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { bookingService } from '../services/bookings'
import { paymentsService, razorpayGateway, setPaymentGateway, type GatewayPayment, type PaymentGateway } from '../services/payments'
import { paymentConfigRepo } from '../repositories/paymentConfig'
import { bookingsRepo } from '../repositories'
import { decryptSecret, encryptSecret } from '../store/secrets'
import { appError, createLiveListing, createUser, day, resetDatabase, type TestUser } from './helpers'

// Razorpay is replaced by an in-memory fake that behaves like the real API.

const KEY = { keyId: 'rzp_test_AbCdEf123456', keySecret: 'test_secret_0123456789', webhookSecret: 'whsec_test_123' }

class FakeRazorpay implements PaymentGateway {
  orders = new Map<string, { amount: number; capture: boolean }>()
  payments = new Map<string, GatewayPayment>()
  refunds: { paymentId: string; amount: number }[] = []
  n = 0
  async createOrder(_: unknown, o: { amountMinor: number; capture: boolean }) {
    const id = `order_${++this.n}`
    this.orders.set(id, { amount: o.amountMinor, capture: o.capture })
    return { id }
  }
  async fetchPayment(_: unknown, id: string) {
    const p = this.payments.get(id)
    if (!p) throw new Error('no such payment')
    return { ...p }
  }
  async capture(_: unknown, id: string) {
    const p = this.payments.get(id)!
    if (p.status !== 'authorized') throw new Error('not authorised')
    p.status = 'captured'
  }
  async refund(_: unknown, paymentId: string, amount: number) {
    this.refunds.push({ paymentId, amount })
    this.payments.get(paymentId)!.status = 'refunded'
  }
  async ping() {}
  /** What happens in the guest's browser: they pay, and Checkout returns a signed result. */
  pay(orderId: string, status: 'authorized' | 'captured' = 'authorized') {
    const id = `pay_${++this.n}`
    this.payments.set(id, { id, order_id: orderId, status, amount: this.orders.get(orderId)!.amount })
    const signature = createHmac('sha256', KEY.keySecret).update(`${orderId}|${id}`).digest('hex')
    return { razorpay_order_id: orderId, razorpay_payment_id: id, razorpay_signature: signature }
  }
}

let rzp: FakeRazorpay
const request = (propertyId: number) => ({
  propertyId, checkIn: day(10), checkOut: day(12), guests: 2, paymentMethod: 'upi', contactPhone: '+91 98765 43210', specialRequests: '',
})
const confirm = (guest: TestUser, code: string, r: ReturnType<FakeRazorpay['pay']>) =>
  bookingService.confirmPayment(guest.me, code, { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature })

async function setup(management: 'managed' | 'self') {
  const admin = await createUser('admin')
  await paymentsService.save(admin.me, { ...KEY, enabled: true })
  const host = await createUser('host')
  const guest = await createUser()
  const id = await createLiveListing(host, { price: 1000 }, management)
  return { admin, host, guest, id }
}

describe('Razorpay payments', () => {
  beforeEach(async () => {
    await resetDatabase()
    rzp = new FakeRazorpay()
    setPaymentGateway(rzp)
  })
  after(() => setPaymentGateway(razorpayGateway))

  test('keys are stored encrypted and never returned', async () => {
    const { admin } = await setup('managed')
    const stored = (await paymentConfigRepo.get())!
    assert.ok(!JSON.stringify(stored).includes(KEY.keySecret))
    assert.equal(decryptSecret(stored.keySecretEnc!), KEY.keySecret)
    const view = await paymentsService.view('https://example.test')
    assert.equal(view.keySecretLast4, '6789')
    assert.equal(view.mode, 'test')
    assert.equal(view.webhookUrl, 'https://example.test/api/payments/razorpay/webhook')
    assert.ok(!JSON.stringify(view).includes(KEY.keySecret))
    // Saving without a secret keeps the stored one.
    await paymentsService.save(admin.me, { keyId: KEY.keyId, enabled: true })
    assert.equal(decryptSecret((await paymentConfigRepo.get())!.keySecretEnc!), KEY.keySecret)
    assert.ok((await appError(() => paymentsService.save(admin.me, { keyId: 'not-a-key', enabled: true }))).fields.keyId)
  })

  test('encryption round-trips and detects tampering', () => {
    const enc = encryptSecret('hello')
    assert.equal(decryptSecret(enc), 'hello')
    const parts = enc.split(':')
    parts[3] = Buffer.from('HELLO').toString('base64')
    assert.throws(() => decryptSecret(parts.join(':')))
  })

  test('instant booking: dates held while paying, captured and confirmed after a verified payment', async () => {
    const { guest, id } = await setup('managed')
    const { booking, payment } = await bookingService.create(guest.me, guest.uid, request(id))
    assert.equal(booking.status, 'AwaitingPayment')
    assert.equal(payment!.amount, 200000)
    assert.equal(payment!.captureNow, true)
    assert.equal(payment!.keyId, KEY.keyId)
    const paid = await confirm(guest, booking.code, rzp.pay(payment!.orderId))
    assert.equal(paid.status, 'Confirmed')
    assert.equal(paid.paymentStatus, 'paid')
    assert.equal([...rzp.payments.values()][0].status, 'captured')
  })

  test('a forged signature is refused', async () => {
    const { guest, id } = await setup('managed')
    const { booking, payment } = await bookingService.create(guest.me, guest.uid, request(id))
    const r = rzp.pay(payment!.orderId)
    const err = await appError(() => confirm(guest, booking.code, { ...r, razorpay_signature: 'f'.repeat(64) }))
    assert.equal(err.status, 400)
    assert.equal((await bookingsRepo.find(booking.code))!.status, 'AwaitingPayment')
  })

  test('request to book: authorised at checkout, captured when the host accepts', async () => {
    const { host, guest, id } = await setup('self')
    const { booking, payment } = await bookingService.create(guest.me, guest.uid, request(id))
    assert.equal(payment!.captureNow, false)
    const r = rzp.pay(payment!.orderId)
    const requested = await confirm(guest, booking.code, r)
    assert.equal(requested.status, 'Requested')
    assert.equal(requested.paymentStatus, 'authorized')
    assert.equal(rzp.payments.get(r.razorpay_payment_id)!.status, 'authorized')
    const accepted = await bookingService.accept(host.me, booking.code)
    assert.equal(accepted.paymentStatus, 'paid')
    assert.equal(rzp.payments.get(r.razorpay_payment_id)!.status, 'captured')
  })

  test('declined requests are never charged', async () => {
    const { host, guest, id } = await setup('self')
    const { booking, payment } = await bookingService.create(guest.me, guest.uid, request(id))
    const r = rzp.pay(payment!.orderId)
    await confirm(guest, booking.code, r)
    const declined = await bookingService.decline(host.me, booking.code, '')
    assert.equal(declined.paymentStatus, 'released')
    assert.equal(rzp.payments.get(r.razorpay_payment_id)!.status, 'authorized')
    assert.equal(rzp.refunds.length, 0)
  })

  test('cancelling a paid booking refunds through Razorpay', async () => {
    const { guest, id } = await setup('managed')
    const { booking, payment } = await bookingService.create(guest.me, guest.uid, request(id))
    await confirm(guest, booking.code, rzp.pay(payment!.orderId))
    const cancelled = await bookingService.cancelByGuest(guest.me, booking.code)
    assert.equal(cancelled.paymentStatus, 'refunded')
    assert.deepEqual(rzp.refunds.map((r) => r.amount), [200000])
  })

  test('the webhook confirms a booking whose browser closed after paying', async () => {
    const { guest, id } = await setup('managed')
    const { booking, payment } = await bookingService.create(guest.me, guest.uid, request(id))
    const r = rzp.pay(payment!.orderId)
    const body = JSON.stringify({ event: 'payment.authorized', payload: { payment: { entity: rzp.payments.get(r.razorpay_payment_id) } } })
    const sig = createHmac('sha256', KEY.webhookSecret).update(body).digest('hex')
    assert.equal((await appError(() => bookingService.handleWebhook(body, 'bad'))).status, 400)
    await bookingService.handleWebhook(body, sig)
    assert.equal((await bookingsRepo.find(booking.code))!.status, 'Confirmed')
    // The browser's confirmation arriving later changes nothing.
    assert.equal((await confirm(guest, booking.code, r)).status, 'Confirmed')
  })

  test('an unpaid checkout lapses and frees the dates', async () => {
    const { guest, id } = await setup('managed')
    const other = await createUser()
    const { booking } = await bookingService.create(guest.me, guest.uid, request(id))
    await bookingsRepo.transition(booking.code, ['AwaitingPayment'], () => ({ expiresAt: new Date(Date.now() - 1000).toISOString() }))
    const next = await bookingService.create(other.me, other.uid, request(id))
    assert.equal(next.booking.status, 'AwaitingPayment')
    assert.equal((await bookingsRepo.find(booking.code))!.status, 'Expired')
    // Abandoned checkouts don't show up as trips.
    assert.equal((await bookingService.listForGuest(guest.me)).length, 0)
  })
})
