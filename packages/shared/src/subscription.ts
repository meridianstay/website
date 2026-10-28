// What a client pays Meridian for, once a year. Listing on the marketplace is what they came for;
// the plan decides how much of a website of their own they get with it.
//
//   Single stay   — the portal and one stay's own website.
//   Multiple      — every branch they run on that one website.
//   Everything    — the above, plus rearranging the page themselves.

export type PlanId = 'single' | 'multi' | 'pro'

export interface PlanFeatures {
  /** How many stays may appear on the client's own website. 0 means as many as they have. */
  maxStaysOnSite: number
  /** Whether they may rearrange their landing page themselves. */
  pageEditor: boolean
}

export interface ClientPlan {
  id: PlanId
  name: string
  /** Rupees a year. Set in the control centre; what is shown here is only the starting point. */
  pricePerYear: number
  tagline: string
  features: PlanFeatures
  /** The lines shown on the plan card, in the client's language rather than ours. */
  perks: string[]
}

export const defaultClientPlans: ClientPlan[] = [
  {
    id: 'single',
    name: 'Single stay',
    pricePerYear: 999,
    tagline: 'One stay, one website.',
    features: { maxStaysOnSite: 1, pageEditor: false },
    perks: [
      'Your stay listed on the Meridian marketplace',
      'Your own website at your-name.meridianstay.com',
      'Your own domain, if you have one',
      'Bookings, calendar, guests and payouts in your portal',
    ],
  },
  {
    id: 'multi',
    name: 'Multiple stays',
    pricePerYear: 1999,
    tagline: 'Every branch on the same website.',
    features: { maxStaysOnSite: 0, pageEditor: false },
    perks: [
      'Everything in Single stay',
      'All your stays and branches on one website',
      'Guests move between your properties without leaving your site',
      'One address for your whole business',
    ],
  },
  {
    id: 'pro',
    name: 'Everything',
    pricePerYear: 4999,
    tagline: 'Your website, arranged your way.',
    features: { maxStaysOnSite: 0, pageEditor: true },
    perks: [
      'Everything in Multiple stays',
      'Rearrange your landing page yourself — drag the sections into the order you want',
      'Choose which sections appear, and what each one says',
      'Your own colours across the page',
    ],
  },
]

export type SubscriptionStatus = 'none' | 'active' | 'expired' | 'cancelled'

/** One year a client paid for. Kept so the control centre can see what was charged and when. */
export interface SubscriptionTerm {
  planId: PlanId
  /** Rupees actually charged, which may differ from today's price. */
  amount: number
  startedAt: string
  expiresAt: string
  /** Razorpay's payment id, or how your team recorded it when taken another way. */
  paymentId: string
  /** 'razorpay' when the client paid online, 'manual' when your team recorded it. */
  via: 'razorpay' | 'manual'
  at: string
}

export interface Subscription {
  hostId: number
  planId: PlanId | null
  status: SubscriptionStatus
  startedAt: string | null
  expiresAt: string | null
  /** Every year paid for, newest last. */
  terms: SubscriptionTerm[]
  /** An order waiting to be paid, so a half-finished payment can be picked up again. */
  pendingOrderId: string | null
  updatedAt: string
}

export const blankSubscription = (hostId: number): Subscription => ({
  hostId, planId: null, status: 'none', startedAt: null, expiresAt: null, terms: [], pendingOrderId: null,
  updatedAt: new Date().toISOString(),
})

/** Paid for and not yet run out. */
export function subscriptionActive(s: Pick<Subscription, 'status' | 'expiresAt'>, now = new Date().toISOString()): boolean {
  return s.status === 'active' && !!s.expiresAt && s.expiresAt > now
}

/** Days left, or null when there is no subscription. Negative once it has run out. */
export function daysLeft(s: Pick<Subscription, 'expiresAt'>, now = Date.now()): number | null {
  if (!s.expiresAt) return null
  return Math.ceil((Date.parse(s.expiresAt) - now) / 86_400_000)
}

/** A year from today, or from when the current one ends if it is still running — renewals add on. */
export function nextExpiry(current: string | null, now = new Date()): string {
  const from = current && Date.parse(current) > now.getTime() ? new Date(current) : now
  const end = new Date(from)
  end.setFullYear(end.getFullYear() + 1)
  return end.toISOString()
}

export const planById = (plans: ClientPlan[], id: PlanId | null) => plans.find((p) => p.id === id) ?? null

/** What this client may actually do right now. Nothing without a plan that is paid up. */
export function entitlements(plans: ClientPlan[], s: Pick<Subscription, 'status' | 'expiresAt' | 'planId'>, now?: string): PlanFeatures & { ownWebsite: boolean } {
  const plan = subscriptionActive(s, now) ? planById(plans, s.planId) : null
  return {
    ownWebsite: !!plan,
    maxStaysOnSite: plan?.features.maxStaysOnSite ?? 1,
    pageEditor: !!plan?.features.pageEditor,
  }
}

/** How long before it runs out a client starts being told. */
export const RENEWAL_WARNING_DAYS = 30

export interface SubscriptionSettings {
  /** Off lets clients use the portal without paying — for the first clients, or while testing. */
  required: boolean
  plans: ClientPlan[]
}

export const defaultSubscriptionSettings: SubscriptionSettings = {
  required: true,
  plans: defaultClientPlans,
}
