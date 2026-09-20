import type { Me, PaymentMethod, PaymentRequest } from '@meridian/shared'

// Razorpay Checkout (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/).
// The script is loaded only when a guest pays. Card and UPI details go straight to Razorpay, never to us.

export interface CheckoutResult { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }

interface RazorpayInstance { open(): void; on(event: string, fn: (r: { error?: { description?: string } }) => void): void }
declare global {
  interface Window { Razorpay?: new (options: object) => RazorpayInstance }
}

let loading: Promise<void> | null = null
function loadScript() {
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve()
    s.onerror = () => {
      loading = null
      reject(new Error('Couldn’t load the payment window. Check your connection and try again.'))
    }
    document.head.appendChild(s)
  })
  return loading
}

export class CheckoutDismissed extends Error {}

/** Opens Razorpay Checkout and resolves with the signed result, or rejects if the guest closes it. */
export async function payWithRazorpay(payment: PaymentRequest, info: { title: string; user?: Me | null; phone?: string; method?: PaymentMethod }) {
  await loadScript()
  return new Promise<CheckoutResult>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: payment.keyId,
      order_id: payment.orderId,
      amount: payment.amount,
      currency: payment.currency,
      name: 'Meridian Stay',
      description: info.title,
      prefill: { name: info.user?.name ?? '', email: info.user?.email ?? '', contact: (info.phone ?? '').replace(/[^\d+]/g, ''), method: info.method },
      theme: { color: '#059669' },
      handler: (r: CheckoutResult) => resolve(r),
      modal: { ondismiss: () => reject(new CheckoutDismissed('Payment window closed.')), confirm_close: true },
    })
    rzp.on('payment.failed', () => {
      // Checkout shows the failure itself and lets the guest retry; nothing to do here.
    })
    rzp.open()
  })
}
