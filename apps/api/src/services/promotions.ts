import {
  addDays, distanceKm, findPlan, formatDate, formatPrice, isISODate, isLiveToday, reaches, todayISO, withPromotionDefaults,
  type AdCampaign, type AdPlacement, type Me, type PaymentRequest, type PromotionPlan, type PropertySummary, type Viewer,
} from '@meridian/shared'
import { auditLogRepo, contentRepo, promotionsRepo, propertiesRepo, toPropertySummary, usersRepo } from '../repositories'
import { notifyService } from './notify'
import { siteOrigin } from '../http/origin'
import type { CampaignDoc } from '../repositories/promotions'
import { AppError, notFound } from '../http/errors'
import { collect, str } from '../http/validate'
import { paymentGateway, paymentsService } from './payments'

// Hosts pay by the day to promote a listing. Our team approves each campaign before it runs.

const publicFields = (c: CampaignDoc): AdCampaign => {
  const { razorpayOrderId: _o, razorpayPaymentId: _p, ...rest } = c
  return rest
}

let lastRefresh = 0
async function refreshSoon(today: string) {
  if (Date.now() - lastRefresh < 60_000) return
  lastRefresh = Date.now()
  await promotionsRepo.refreshStatuses(today).catch((err) => console.error('[promotions] status refresh failed', err))
}

export const promotionService = {
  async settings() {
    return withPromotionDefaults((await contentRepo.settings()).promotions)
  },

  /**
   * How many listings can still run on a plan over these dates. Slots are what the host is really
   * buying, so we check them at the moment of purchase rather than only when showing.
   */
  async slotsLeft(plan: PromotionPlan, startDate: string, endDate: string) {
    const overlapping = (await promotionsRepo.listAll(null))
      .filter((c) => c.planId === plan.id
        && ['AwaitingPayment', 'PendingReview', 'Scheduled', 'Running'].includes(c.status)
        && c.startDate <= endDate && c.endDate >= startDate)
    return Math.max(0, plan.slots - overlapping.length)
  },

  /** The plans a host can buy right now, with how many slots are free over the dates they picked. */
  async plansFor(startDate: string, days: number) {
    const settings = await this.settings()
    if (!settings.enabled) return []
    const from = isISODate(startDate) ? startDate : todayISO()
    return Promise.all(settings.plans.filter((p) => p.enabled).map(async (plan) => ({
      ...plan,
      slotsLeft: await this.slotsLeft(plan, from, addDays(from, Math.max(1, days) - 1)),
    })))
  },

  async forHost(host: Me) {
    await refreshSoon(todayISO())
    return (await promotionsRepo.forHost(host.id)).map(publicFields)
  },

  /** Books a promotion and starts its payment. */
  async create(host: Me, input: { propertyId: number; planId: string; startDate: string; days: number }): Promise<{ campaign: AdCampaign; payment: PaymentRequest | null }> {
    const settings = await this.settings()
    if (!settings.enabled) throw new AppError(400, 'Promotions are switched off at the moment.')
    const today = todayISO()
    const plan = findPlan(settings, input.planId)
    const days = Math.round(Number(input.days))
    collect({
      planId: plan?.enabled ? null : 'Choose one of the plans on offer.',
      startDate: isISODate(input.startDate) && input.startDate >= today ? null : 'Choose a start date from today onwards.',
      days: plan && days >= 1 && days <= plan.maxDays ? null : `Promote for 1 to ${plan?.maxDays ?? 30} days.`,
    })
    const endDate = addDays(input.startDate, days - 1)
    if (await this.slotsLeft(plan!, input.startDate, endDate) < 1) {
      collect({ startDate: `All ${plan!.slots} slots on ${plan!.name} are taken for those dates. Try different dates, or another plan.` })
    }

    const property = await propertiesRepo.ownedBy(input.propertyId, host.id)
    if (!property) throw notFound('listing')
    if (property.status !== 'Approved') throw new AppError(400, 'Only live listings can be promoted. This one isn’t live yet.')

    const rate = plan!.pricePerDay
    const total = rate * days
    const cfg = await paymentsService.activeConfig()
    const campaign = await promotionsRepo.create({
      hostId: host.id, propertyId: property.id,
      property: { slug: property.slug, title: property.title, image: property.coverImageUrl, location: `${property.city}, ${property.region}` },
      planId: plan!.id, planName: plan!.name, placement: plan!.placement, reach: plan!.reach,
      startDate: input.startDate, endDate, days,
      ratePerDay: rate, total, status: cfg ? 'AwaitingPayment' : 'PendingReview', paymentStatus: cfg ? 'created' : 'test',
      impressions: 0, clicks: 0, createdAt: promotionsRepo.now(), reviewedAt: null, rejectionReason: null, refunded: 0,
      razorpayOrderId: null, razorpayPaymentId: null,
    })

    if (!cfg) return { campaign: publicFields(campaign), payment: null }
    try {
      const order = await paymentGateway().createOrder(cfg, {
        amountMinor: total * 100, receipt: `AD-${campaign.id}`, capture: true,
        notes: { promotion: String(campaign.id), listing: property.title.slice(0, 200) },
      })
      await promotionsRepo.update(campaign.id, { razorpayOrderId: order.id })
      return {
        campaign: publicFields({ ...campaign, razorpayOrderId: order.id }),
        payment: { provider: 'razorpay', keyId: cfg.keyId, orderId: order.id, amount: total * 100, currency: 'INR', captureNow: true },
      }
    } catch (err) {
      await promotionsRepo.update(campaign.id, { status: 'Cancelled', paymentStatus: 'failed' })
      throw err
    }
  },

  /** Called after Razorpay Checkout: verifies the payment, then sends the campaign for review. */
  async confirmPayment(host: Me, id: number, result: { orderId: string; paymentId: string; signature: string }) {
    const campaign = await promotionsRepo.find(id)
    if (!campaign || campaign.hostId !== host.id) throw notFound('promotion')
    const cfg = await paymentsService.storedConfig()
    if (!cfg || !campaign.razorpayOrderId) throw new AppError(400, 'This promotion doesn’t take online payment.')
    if (result.orderId !== campaign.razorpayOrderId || !paymentsService.verifyCheckout(cfg, result.orderId, result.paymentId, result.signature)) {
      throw new AppError(400, 'We couldn’t verify that payment. If money was taken, it will be returned automatically.')
    }
    const payment = await paymentGateway().fetchPayment(cfg, result.paymentId)
    if (payment.status === 'authorized') await paymentGateway().capture(cfg, payment.id, campaign.total * 100).catch(() => {})
    if (payment.status === 'failed') {
      await promotionsRepo.update(id, { paymentStatus: 'failed' })
      throw new AppError(400, 'That payment didn’t go through. Please try again.')
    }
    await promotionsRepo.update(id, { paymentStatus: 'paid', razorpayPaymentId: payment.id, status: 'PendingReview' })
    return publicFields((await promotionsRepo.find(id))!)
  },

  /** Hosts can stop a campaign; anything not yet shown is refunded. */
  async cancel(host: Me, id: number) {
    const c = await promotionsRepo.find(id)
    if (!c || c.hostId !== host.id) throw notFound('promotion')
    if (c.status === 'Finished' || c.status === 'Cancelled' || c.status === 'Rejected') throw new AppError(400, 'This promotion has already ended.')
    const today = todayISO()
    const daysLeft = c.startDate > today ? c.days : Math.max(0, Math.round((Date.parse(c.endDate) - Date.parse(today)) / 86_400_000))
    const refund = Math.min(c.total, daysLeft * c.ratePerDay)
    await promotionsRepo.update(id, { status: 'Cancelled', refunded: refund, paymentStatus: c.paymentStatus === 'paid' && refund >= c.total ? 'refunded' : c.paymentStatus })
    if (refund > 0 && c.paymentStatus === 'paid' && c.razorpayPaymentId) {
      const cfg = await paymentsService.storedConfig()
      if (cfg) await paymentGateway().refund(cfg, c.razorpayPaymentId, refund * 100).catch((err) => console.error('[promotions] refund failed', err))
    }
    return publicFields((await promotionsRepo.find(id))!)
  },

  // ── Control center ─────────────────────────────────────────────────────────

  async listForAdmin(status: string | null) {
    await refreshSoon(todayISO())
    return (await promotionsRepo.listAll(status as never)).map(publicFields)
  },

  async review(admin: Me, id: number, approve: boolean, reason = '') {
    const c = await promotionsRepo.find(id)
    if (!c) throw notFound('promotion')
    if (c.status !== 'PendingReview') throw new AppError(400, 'Only promotions waiting for review can be answered.')
    if (approve) {
      await promotionsRepo.update(id, { status: c.startDate <= todayISO() ? 'Running' : 'Scheduled', reviewedAt: promotionsRepo.now(), rejectionReason: null })
    } else {
      collect({ reason: reason.trim().length >= 5 ? null : 'Tell the host why, in at least 5 characters.' })
      await promotionsRepo.update(id, { status: 'Rejected', reviewedAt: promotionsRepo.now(), rejectionReason: reason.trim(), refunded: c.total })
      if (c.paymentStatus === 'paid' && c.razorpayPaymentId) {
        const cfg = await paymentsService.storedConfig()
        if (cfg) await paymentGateway().refund(cfg, c.razorpayPaymentId, c.total * 100).catch((err) => console.error('[promotions] refund failed', err))
        await promotionsRepo.update(id, { paymentStatus: 'refunded' })
      }
    }
    await auditLogRepo.record(admin, approve ? 'promotion.approve' : 'promotion.reject', 'promotion', id, approve ? {} : { reason })

    const host = await usersRepo.findById(c.hostId)
    if (host) {
      await notifyService.send(approve ? 'promotion.approved' : 'promotion.rejected',
        { name: host.name, email: host.email, phone: host.phone }, {
          property: c.property.title,
          dates: `${formatDate(c.startDate, { day: 'numeric', month: 'short' })} – ${formatDate(c.endDate, { day: 'numeric', month: 'short' })}`,
          total: formatPrice(c.total),
          reason,
          link: `${siteOrigin()}/host/promotions`,
        })
    }
    return publicFields((await promotionsRepo.find(id))!)
  },

  // ── Showing promotions ─────────────────────────────────────────────────────

  /**
   * Promoted listings for a placement, newest campaigns rotated so everyone gets a turn.
   * Counts one impression for each campaign returned.
   */
  async promoted(placement: AdPlacement, viewer: Viewer & { type?: string } = {}): Promise<(PropertySummary & { promotionId: number })[]> {
    const today = todayISO()
    await refreshSoon(today)
    const live = (await promotionsRepo.liveFor(placement, today)).filter((c) => isLiveToday(c, today))
    if (!live.length) return []
    const settings = await this.settings()
    const chosen: { campaign: CampaignDoc; property: PropertySummary }[] = []
    // Shuffled, so every host on a plan gets a turn rather than the oldest always winning.
    for (const c of live.sort(() => Math.random() - 0.5)) {
      const plan = findPlan(settings, c.planId)
      // Slots cap each plan separately, so a cheap local plan can't crowd out an all-India one.
      const taken = chosen.filter((x) => x.campaign.planId === c.planId).length
      if (taken >= (plan?.slots ?? 1)) continue
      const p = await propertiesRepo.get(c.propertyId)
      if (!p || p.status !== 'Approved') continue
      if (viewer.type && p.type !== viewer.type) continue
      const target = { city: p.city, region: p.region, lat: p.lat, lng: p.lng }
      if (!reaches(c.reach ?? 'everywhere', target, viewer, (a, b) => distanceKm(a, b))) continue
      chosen.push({ campaign: c, property: toPropertySummary(p) })
    }
    await promotionsRepo.countImpressions(chosen.map((x) => x.campaign.id))
    return chosen.map((x) => ({ ...x.property, promotionId: x.campaign.id }))
  },

  click: (id: number) => promotionsRepo.countClick(id),

  parse: (b: Record<string, unknown>) => ({
    propertyId: Number(b.propertyId), planId: str(b.planId), startDate: str(b.startDate), days: Number(b.days),
  }),
}
