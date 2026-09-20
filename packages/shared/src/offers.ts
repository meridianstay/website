// Discounts on listings and coupon codes guests type at checkout.

/** A listing's price after its discount, rounded to whole rupees. */
export const discountedPrice = (price: number, discountPct: number) =>
  discountPct > 0 ? Math.round((price * (100 - discountPct)) / 100) : price

export type CouponKind = 'percent' | 'flat'
export type CouponApplies = 'all' | 'stay' | 'dayuse'

export interface Coupon {
  /** Uppercase, e.g. MONSOON20. */
  code: string
  kind: CouponKind
  /** Percent off (1–50) or rupees off. */
  value: number
  /** Most rupees a percent coupon can take off; 0 for no cap. */
  maxDiscount: number
  /** Smallest booking total it works on (₹). */
  minTotal: number
  applies: CouponApplies
  /** Empty means no limit. */
  startsAt: string
  endsAt: string
  /** 0 = unlimited. */
  usageLimit: number
  usedCount: number
  enabled: boolean
  description: string
  createdAt?: string
}

export const COUPON_LIMITS = { maxPercent: 50, maxFlat: 100000, codeLength: 24 }

export const blankCoupon: Coupon = {
  code: '', kind: 'percent', value: 10, maxDiscount: 2000, minTotal: 0, applies: 'all',
  startsAt: '', endsAt: '', usageLimit: 0, usedCount: 0, enabled: true, description: '',
}

/** What a coupon takes off a total (in rupees), or why it doesn't apply. */
export function couponDiscount(coupon: Coupon, opts: { total: number; kind: 'stay' | 'dayuse'; today: string }): { discount: number } | { reason: string } {
  if (!coupon.enabled) return { reason: 'This code isn’t active.' }
  if (coupon.startsAt && opts.today < coupon.startsAt) return { reason: `This code starts on ${coupon.startsAt}.` }
  if (coupon.endsAt && opts.today > coupon.endsAt) return { reason: 'This code has expired.' }
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) return { reason: 'This code has been fully used.' }
  if (coupon.applies !== 'all' && coupon.applies !== opts.kind) {
    return { reason: coupon.applies === 'dayuse' ? 'This code works on day-out bookings only.' : 'This code works on overnight stays only.' }
  }
  if (opts.total < coupon.minTotal) return { reason: `This code needs a total of at least ₹${coupon.minTotal.toLocaleString('en-IN')}.` }
  const raw = coupon.kind === 'percent' ? (opts.total * coupon.value) / 100 : coupon.value
  const capped = coupon.kind === 'percent' && coupon.maxDiscount > 0 ? Math.min(raw, coupon.maxDiscount) : raw
  const discount = Math.min(Math.round(capped), opts.total)
  return discount > 0 ? { discount } : { reason: 'This code takes nothing off this booking.' }
}

/** "20% off, up to ₹2,000" / "₹500 off". */
export const couponLabel = (c: Coupon) =>
  c.kind === 'percent'
    ? `${c.value}% off${c.maxDiscount > 0 ? `, up to ₹${c.maxDiscount.toLocaleString('en-IN')}` : ''}`
    : `₹${c.value.toLocaleString('en-IN')} off`
