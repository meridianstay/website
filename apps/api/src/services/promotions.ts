import {
  addDays, AD_PLACEMENTS, formatDate, formatPrice, isISODate, isLiveToday, ratePerDay, todayISO,
  type AdCampaign, type AdPlacement, type Me, type PaymentRequest, type PropertySummary,
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
    return (await contentRepo.settings()).promotions
  },

  async forHost(host: Me) {
    await refreshSoon(todayISO())
    return (await promotionsRepo.forHost(host.id)).map(publicFields)
  },

  /** Books a promotion and starts its payment. */
  async create(host: Me, input: { propertyId: number; placement: string; startDate: string; days: number }): Promise<{ campaign: AdCampaign; payment: PaymentRequest | null }> {
    const settings = await this.settings()
    if (!settings.enabled) throw new AppError(400, 'Promotions are switched off at the moment.')
    const today = todayISO()
    const placement = AD_PLACEMENTS.find((p) => p.value === input.placement)?.value
    const days = Math.round(Number(input.days))
    collect({
      placement: placement ? null : 'Choose where your listing should appear.',
      startDate: isISODate(input.startDate) && input.startDate >= today ? null : 'Choose a start date from today onwards.',
      days: days >= 1 && days <= settings.maxDays ? null : `Promote for 1 to ${settings.maxDays} days.`,
    })

    const property = await propertiesRepo.ownedBy(input.propertyId, host.id)
    if (!property) throw notFound('listing')
    if (property.status !== 'Approved') throw new AppError(400, 'Only live listings can be promoted. This one isn’t live yet.')

    const rate = ratePerDay(settings, placement!)
    const total = rate * days
    const cfg = await paymentsService.activeConfig()
    const campaign = await promotionsRepo.create({
      hostId: host.id, propertyId: property.id,
      property: { slug: property.slug, title: property.title, image: property.coverImageUrl, location: `${property.city}, ${property.region}` },
      placement: placement!, startDate: input.startDate, endDate: addDays(input.startDate, days - 1), days,
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
  async promoted(placement: AdPlacement, filter: { where?: string; type?: string } = {}): Promise<(PropertySummary & { promotionId: number })[]> {
    const today = todayISO()
    await refreshSoon(today)
    const live = (await promotionsRepo.liveFor(placement, today)).filter((c) => isLiveToday(c, today))
    if (!live.length) return []
    const slots = AD_PLACEMENTS.find((p) => p.value === placement)!.slots
    const where = filter.where?.toLowerCase()
    const chosen: { campaign: CampaignDoc; property: PropertySummary }[] = []
    for (const c of live.sort(() => Math.random() - 0.5)) {
      if (chosen.length >= slots) break
      const p = await propertiesRepo.get(c.propertyId)
      if (!p || p.status !== 'Approved') continue
      if (filter.type && p.type !== filter.type) continue
      if (where && !`${p.title} ${p.city}, ${p.region}, ${p.country}`.toLowerCase().includes(where)) continue
      chosen.push({ campaign: c, property: toPropertySummary(p) })
    }
    await promotionsRepo.countImpressions(chosen.map((x) => x.campaign.id))
    return chosen.map((x) => ({ ...x.property, promotionId: x.campaign.id }))
  },

  click: (id: number) => promotionsRepo.countClick(id),

  parse: (b: Record<string, unknown>) => ({
    propertyId: Number(b.propertyId), placement: str(b.placement), startDate: str(b.startDate), days: Number(b.days),
  }),
}
