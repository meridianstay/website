import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Me, PaymentSettingsView } from '@meridian/shared'
import { auditLogRepo } from '../repositories'
import { paymentConfigRepo } from '../repositories/paymentConfig'
import { decryptSecret, encryptSecret, encryptionReady } from '../store/secrets'
import { AppError } from '../http/errors'
import { collect, str } from '../http/validate'

// Razorpay: orders, capture, refunds and signature checks. Keys are managed in admin Settings.

export interface GatewayConfig { keyId: string; keySecret: string; webhookSecret: string | null }

export interface GatewayPayment {
  id: string
  order_id: string
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed'
  amount: number
}

/** Everything the platform needs from a payment provider. Tests swap in a fake. */
export interface PaymentGateway {
  createOrder(cfg: GatewayConfig, order: { amountMinor: number; receipt: string; capture: boolean; notes: Record<string, string> }): Promise<{ id: string }>
  fetchPayment(cfg: GatewayConfig, paymentId: string): Promise<GatewayPayment>
  capture(cfg: GatewayConfig, paymentId: string, amountMinor: number): Promise<void>
  refund(cfg: GatewayConfig, paymentId: string, amountMinor: number): Promise<void>
  ping(cfg: GatewayConfig): Promise<void>
}

async function razorpay<T>(cfg: GatewayConfig, method: string, path: string, body?: object): Promise<T> {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64')}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => {
    throw new AppError(502, 'Couldn’t reach Razorpay. Please try again.')
  })
  const data = (await res.json().catch(() => ({}))) as { error?: { description?: string } }
  if (!res.ok) {
    if (res.status === 401) throw new AppError(502, 'Razorpay rejected the API keys. Check them in Settings → Payments.')
    throw new AppError(502, `Razorpay: ${data.error?.description ?? `request failed (${res.status})`}`)
  }
  return data as T
}

export const razorpayGateway: PaymentGateway = {
  createOrder: (cfg, o) =>
    razorpay(cfg, 'POST', '/orders', { amount: o.amountMinor, currency: 'INR', receipt: o.receipt, payment_capture: o.capture ? 1 : 0, notes: o.notes }),
  fetchPayment: (cfg, id) => razorpay(cfg, 'GET', `/payments/${encodeURIComponent(id)}`),
  capture: async (cfg, id, amountMinor) => {
    await razorpay(cfg, 'POST', `/payments/${encodeURIComponent(id)}/capture`, { amount: amountMinor, currency: 'INR' })
  },
  refund: async (cfg, id, amountMinor) => {
    await razorpay(cfg, 'POST', `/payments/${encodeURIComponent(id)}/refund`, { amount: amountMinor })
  },
  ping: async (cfg) => {
    await razorpay(cfg, 'GET', '/orders?count=1')
  },
}

let gateway: PaymentGateway = razorpayGateway
/** For tests only. */
export const setPaymentGateway = (g: PaymentGateway) => {
  gateway = g
}
export const paymentGateway = () => gateway

const hmacHex = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('hex')
const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export const paymentsService = {
  /** Keys to use for new payments, or null when online payments are off. */
  async activeConfig(): Promise<GatewayConfig | null> {
    const doc = await paymentConfigRepo.get()
    if (!doc?.enabled || !doc.keyId || !doc.keySecretEnc) return null
    return this.configFrom(doc)
  },

  /** Keys even when payments are switched off (to finish payments already under way). */
  async storedConfig(): Promise<GatewayConfig | null> {
    const doc = await paymentConfigRepo.get()
    return doc?.keyId && doc.keySecretEnc ? this.configFrom(doc) : null
  },

  configFrom(doc: NonNullable<Awaited<ReturnType<typeof paymentConfigRepo.get>>>): GatewayConfig {
    return { keyId: doc.keyId, keySecret: decryptSecret(doc.keySecretEnc!), webhookSecret: doc.webhookSecretEnc ? decryptSecret(doc.webhookSecretEnc) : null }
  },

  async view(publicBaseUrl: string): Promise<PaymentSettingsView> {
    const doc = await paymentConfigRepo.get()
    const keyId = doc?.keyId ?? ''
    return {
      enabled: !!doc?.enabled,
      keyId,
      keySecretLast4: doc?.keySecretLast4 ?? null,
      webhookSecretSet: !!doc?.webhookSecretEnc,
      mode: keyId.startsWith('rzp_live_') ? 'live' : keyId.startsWith('rzp_test_') ? 'test' : 'unset',
      webhookUrl: `${publicBaseUrl}/api/payments/razorpay/webhook`,
      encryptionReady,
      updatedAt: doc?.updatedAt ?? null,
    }
  },

  /** Saves Razorpay settings. Blank secret fields keep the stored value. */
  async save(admin: Me, body: Record<string, unknown>) {
    const current = await paymentConfigRepo.get()
    const keyId = str(body.keyId)
    const keySecret = str(body.keySecret)
    const webhookSecret = str(body.webhookSecret)
    const enabled = body.enabled === true
    const hasSecret = !!keySecret || !!current?.keySecretEnc
    collect({
      keyId: !keyId && !enabled ? null : /^rzp_(test|live)_[A-Za-z0-9]{6,}$/.test(keyId) ? null : 'Enter the Key ID from Razorpay (it starts with rzp_test_ or rzp_live_).',
      keySecret: keySecret && keySecret.length < 10 ? 'That doesn’t look like a Razorpay key secret.' : enabled && !hasSecret ? 'Enter the key secret to switch payments on.' : null,
    })
    const patch: Record<string, unknown> = { keyId, enabled }
    if (keySecret) {
      patch.keySecretEnc = encryptSecret(keySecret)
      patch.keySecretLast4 = keySecret.slice(-4)
    }
    if (webhookSecret) patch.webhookSecretEnc = encryptSecret(webhookSecret)
    if (body.clearWebhookSecret === true) patch.webhookSecretEnc = null
    await paymentConfigRepo.save(patch, admin.id)
    // Never log secrets, only what changed.
    await auditLogRepo.record(admin, 'payments.update', 'settings', 'razorpay', {
      enabled, keyId, keySecretChanged: !!keySecret, webhookSecretChanged: !!webhookSecret || body.clearWebhookSecret === true,
    })
  },

  async testConnection() {
    const cfg = await this.storedConfig()
    if (!cfg) throw new AppError(400, 'Save a Key ID and key secret first.')
    await gateway.ping(cfg)
    return { ok: true, mode: cfg.keyId.startsWith('rzp_live_') ? 'live' : 'test' }
  },

  /** Razorpay Checkout's signature: HMAC-SHA256(order_id|payment_id) with the key secret. */
  verifyCheckout(cfg: GatewayConfig, orderId: string, paymentId: string, signature: string) {
    return safeEqual(hmacHex(cfg.keySecret, `${orderId}|${paymentId}`), signature)
  },

  /** Webhook signature: HMAC-SHA256 of the raw request body with the webhook secret. */
  verifyWebhook(cfg: GatewayConfig, rawBody: string, signature: string) {
    return !!cfg.webhookSecret && safeEqual(hmacHex(cfg.webhookSecret, rawBody), signature)
  },
}
