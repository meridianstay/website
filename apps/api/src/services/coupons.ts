import { blankCoupon, COUPON_LIMITS, couponDiscount, couponLabel, isISODate, todayISO, type Coupon, type Me } from '@meridian/shared'
import { auditLogRepo, couponsRepo } from '../repositories'
import { AppError, notFound } from '../http/errors'
import { collect, str } from '../http/validate'

// Coupon codes: created in the control center, typed by guests at checkout.

export const couponService = {
  list: () => couponsRepo.list(),

  /** Checks a code against a booking total, for the checkout box. */
  async check(code: string, total: number, kind: 'stay' | 'dayuse') {
    const coupon = await couponsRepo.find(code)
    if (!coupon) throw new AppError(404, 'We don’t know that code.', { couponCode: 'We don’t know that code.' })
    const result = couponDiscount(coupon, { total, kind, today: todayISO() })
    if ('reason' in result) throw new AppError(400, result.reason, { couponCode: result.reason })
    return { code: coupon.code, discount: result.discount, label: couponLabel(coupon), description: coupon.description }
  },

  async save(admin: Me, body: Record<string, unknown>, existingCode?: string) {
    const code = (str(body.code) || existingCode || '').toUpperCase().replace(/\s+/g, '')
    const kind = body.kind === 'flat' ? 'flat' : 'percent'
    const applies = ['all', 'stay', 'dayuse'].includes(str(body.applies)) ? (str(body.applies) as Coupon['applies']) : 'all'
    const num = (v: unknown) => Math.round(Number(v ?? 0))
    const coupon: Coupon = {
      ...blankCoupon, code, kind, applies,
      value: num(body.value), maxDiscount: num(body.maxDiscount), minTotal: num(body.minTotal),
      startsAt: str(body.startsAt), endsAt: str(body.endsAt), usageLimit: num(body.usageLimit),
      usedCount: num(body.usedCount), enabled: body.enabled !== false, description: str(body.description),
    }
    const existing = existingCode ? await couponsRepo.find(existingCode) : null
    if (existing) coupon.usedCount = existing.usedCount ?? 0
    else if (await couponsRepo.find(code)) collect({ code: 'A coupon with that code already exists.' })

    collect({
      code: /^[A-Z0-9]{3,24}$/.test(code) ? null : `Use 3–${COUPON_LIMITS.codeLength} letters and numbers, e.g. MONSOON20.`,
      value: kind === 'percent'
        ? (coupon.value >= 1 && coupon.value <= COUPON_LIMITS.maxPercent ? null : `A percentage between 1 and ${COUPON_LIMITS.maxPercent}.`)
        : (coupon.value >= 1 && coupon.value <= COUPON_LIMITS.maxFlat ? null : 'Enter the rupees off, e.g. 500.'),
      maxDiscount: coupon.maxDiscount >= 0 && coupon.maxDiscount <= COUPON_LIMITS.maxFlat ? null : 'Enter a cap in rupees, or 0 for none.',
      minTotal: coupon.minTotal >= 0 && coupon.minTotal <= COUPON_LIMITS.maxFlat ? null : 'Enter a smallest total in rupees, or 0.',
      usageLimit: coupon.usageLimit >= 0 && coupon.usageLimit <= 100000 ? null : 'Enter how many times it can be used, or 0 for unlimited.',
      startsAt: !coupon.startsAt || isISODate(coupon.startsAt) ? null : 'Use a date like 2026-10-01, or leave it empty.',
      endsAt: !coupon.endsAt || isISODate(coupon.endsAt) ? null : 'Use a date like 2026-10-31, or leave it empty.',
      dates: coupon.startsAt && coupon.endsAt && coupon.endsAt < coupon.startsAt ? 'The end date is before the start date.' : null,
      description: coupon.description.length > 200 ? 'Keep the description under 200 characters.' : null,
    })
    await couponsRepo.save(coupon)
    await auditLogRepo.record(admin, existing ? 'coupon.update' : 'coupon.create', 'coupon', coupon.code, { kind, value: coupon.value, enabled: coupon.enabled })
    return coupon
  },

  async remove(admin: Me, code: string) {
    if (!(await couponsRepo.remove(code))) throw notFound('coupon')
    await auditLogRepo.record(admin, 'coupon.delete', 'coupon', code.toUpperCase())
  },
}
