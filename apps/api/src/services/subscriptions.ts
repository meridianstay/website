import {
  FREE_PLAN_ID, RENEWAL_WARNING_DAYS, daysLeft, defaultSubscriptionSettings, entitlements, freePlan, nextExpiry,
  planById, withPlanDefaults,
  subscriptionActive, type ClientPlan, type Me, type PlanId, type SubscriptionSettings, type SubscriptionTerm,
} from '@meridian/shared'
import { auditLogRepo, contentRepo, subscriptionsRepo, usersRepo } from '../repositories'
import { paymentGateway, paymentsService } from './payments'
import { AppError, notFound } from '../http/errors'
import { collect, str } from '../http/validate'

// A client pays Book My Get Away once a year to be here. The plan decides how much of a website of their own
// comes with it; everything else in the portal works the same whichever they are on.
//
// Money is taken through the same Razorpay account bookings use. A payment that never finishes
// leaves the subscription exactly as it was — nothing is given away on an order alone.

export const subscriptionSettings = async (): Promise<SubscriptionSettings> => {
  const { subscriptions } = await contentRepo.settings()
  return {
    required: subscriptions?.required ?? defaultSubscriptionSettings.required,
    plans: withPlanDefaults(subscriptions?.plans),
  }
}

const planOrFail = (plans: ClientPlan[], id: string): ClientPlan => {
  const plan = planById(plans, id as PlanId)
  if (!plan) throw new AppError(400, 'Choose one of the plans.')
  if (plan.id === FREE_PLAN_ID) throw new AppError(400, 'Free is what everyone starts on — there is nothing to pay or record.')
  return plan
}

export const subscriptionService = {
  /** What this client has, with the plans on offer and what they are allowed to do today. */
  async mine(host: Me) {
    const [settings, subscription] = await Promise.all([subscriptionSettings(), subscriptionsRepo.get(host.id)])
    const left = daysLeft(subscription)
    return {
      subscription,
      plans: settings.plans,
      required: settings.required,
      active: subscriptionActive(subscription),
      entitlements: entitlements(settings.plans, subscription),
      /** The plan in force right now — the one they bought, or Free. */
      currentPlanId: subscriptionActive(subscription) ? subscription.planId : freePlan(settings.plans).id,
      daysLeft: left,
      /** True when it is worth telling them to renew. */
      renewSoon: left !== null && left <= RENEWAL_WARNING_DAYS,
    }
  },

  /** What a host may do, for anything that has to decide quietly. */
  async entitlementsOf(hostId: number) {
    const [settings, subscription] = await Promise.all([subscriptionSettings(), subscriptionsRepo.get(hostId)])
    // With the requirement switched off, everyone gets everything: that is what it is for.
    if (!settings.required) return { ownWebsite: true, maxStaysOnSite: 0, pageEditor: true, customDomain: true, commissionFree: false }
    return entitlements(settings.plans, subscription)
  },

  /** Stops a request in its tracks when the client hasn't paid for that part. */
  async require(hostId: number, feature: 'ownWebsite' | 'pageEditor' | 'customDomain') {
    const has = await this.entitlementsOf(hostId)
    if (!has[feature]) {
      throw new AppError(402, {
        pageEditor: 'Rearranging your page is part of the Everything plan.',
        customDomain: 'Your own domain comes with a paid plan. Your Book My Get Away address keeps working either way.',
        ownWebsite: 'Choose a plan to set up your own website.',
      }[feature])
    }
    return has
  },

  /**
   * Starts a payment for a year. Returns what Razorpay Checkout needs; nothing changes on the
   * client's account until the payment is confirmed.
   */
  async startCheckout(host: Me, planId: string) {
    const settings = await subscriptionSettings()
    const plan = planOrFail(settings.plans, planId)
    const cfg = await paymentsService.activeConfig()
    const current = await subscriptionsRepo.get(host.id)

    if (!cfg) {
      // Payments switched off: the plan is given on trust, the same way bookings run in test mode.
      const term = await this.grant(host.id, plan, 'manual', 'test-mode', plan.pricePerYear)
      return { testMode: true as const, subscription: term }
    }

    const order = await paymentGateway().createOrder(cfg, {
      amountMinor: Math.round(plan.pricePerYear * 100),
      receipt: `sub-${host.id}-${Date.now()}`,
      capture: true,
      notes: { kind: 'subscription', hostId: String(host.id), planId: plan.id },
    })
    await subscriptionsRepo.save(host.id, { pendingOrderId: order.id })
    return {
      testMode: false as const,
      orderId: order.id,
      keyId: cfg.keyId,
      amount: plan.pricePerYear,
      planName: plan.name,
      renewal: !!current.expiresAt,
    }
  },

  /** Confirms a payment the client's browser just finished, and gives them the year. */
  async confirm(host: Me, body: Record<string, unknown>) {
    const orderId = str(body.orderId)
    const paymentId = str(body.paymentId)
    const signature = str(body.signature)
    collect({
      orderId: orderId ? null : 'Missing the order.',
      paymentId: paymentId ? null : 'Missing the payment.',
    })
    const cfg = await paymentsService.storedConfig()
    if (!cfg) throw new AppError(400, 'Online payments are not set up.')
    if (!paymentsService.verifyCheckout(cfg, orderId, paymentId, signature)) {
      throw new AppError(400, 'That payment could not be verified. Nothing has been charged twice — please try again.')
    }
    const current = await subscriptionsRepo.get(host.id)
    if (current.pendingOrderId !== orderId) throw new AppError(400, 'That order does not belong to this account.')
    if (current.terms.some((t) => t.paymentId === paymentId)) return subscriptionsRepo.get(host.id)

    const settings = await subscriptionSettings()
    const planId = str(body.planId) || current.planId || 'single'
    const plan = planOrFail(settings.plans, planId)
    return this.grant(host.id, plan, 'razorpay', paymentId, plan.pricePerYear)
  },

  /** Writes the year onto the account. A renewal adds onto what is left rather than replacing it. */
  async grant(hostId: number, plan: ClientPlan, via: SubscriptionTerm['via'], paymentId: string, amount: number) {
    const current = await subscriptionsRepo.get(hostId)
    const expiresAt = nextExpiry(current.expiresAt)
    const term: SubscriptionTerm = {
      planId: plan.id, amount, startedAt: current.expiresAt ?? new Date().toISOString(), expiresAt, paymentId, via,
      at: new Date().toISOString(),
    }
    const next = await subscriptionsRepo.save(hostId, {
      planId: plan.id,
      status: 'active',
      startedAt: current.startedAt ?? new Date().toISOString(),
      expiresAt,
      terms: [...current.terms, term],
      pendingOrderId: null,
    })
    await auditLogRepo.record(null, 'subscription.paid', 'subscription', hostId, { plan: plan.id, amount, via })
    return next
  },

  // ─── Your team ─────────────────────────────────────────────────────────────

  async list() {
    const [subs, settings] = await Promise.all([subscriptionsRepo.list(), subscriptionSettings()])
    const hosts = new Map((await Promise.all(subs.map((s) => usersRepo.findById(s.hostId)))).filter(Boolean).map((u) => [u!.id, u!]))
    return {
      subscriptions: subs.map((s) => ({
        ...s,
        hostName: hosts.get(s.hostId)?.name ?? 'Unknown',
        hostEmail: hosts.get(s.hostId)?.email ?? hosts.get(s.hostId)?.phone ?? '',
        active: subscriptionActive(s),
        daysLeft: daysLeft(s),
      })),
      plans: settings.plans,
      required: settings.required,
    }
  },

  /** Your team records a year paid for another way — a bank transfer, or a deal struck by hand. */
  async grantByAdmin(admin: Me, hostId: number, planId: string, note: string) {
    const settings = await subscriptionSettings()
    const plan = planOrFail(settings.plans, planId)
    if (!(await usersRepo.findById(hostId))) throw notFound('host')
    const next = await this.grant(hostId, plan, 'manual', str(note).slice(0, 100) || 'recorded by your team', plan.pricePerYear)
    await auditLogRepo.record(admin, 'subscription.grant', 'subscription', hostId, { plan: plan.id, note })
    return next
  },

  /** Ends one now: the client's website stops being served and the portal asks them to choose a plan. */
  async cancel(admin: Me, hostId: number) {
    const next = await subscriptionsRepo.save(hostId, { status: 'cancelled', expiresAt: new Date().toISOString() })
    await auditLogRepo.record(admin, 'subscription.cancel', 'subscription', hostId, {})
    return next
  },

  /** Marks the ones whose year has quietly run out. Runs from the daily job. */
  async expireLapsed() {
    const now = new Date().toISOString()
    const lapsed = await subscriptionsRepo.lapsed(now)
    for (const s of lapsed) await subscriptionsRepo.save(s.hostId, { status: 'expired' })
    return { expired: lapsed.length }
  },
}
