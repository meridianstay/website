// What a client pays Meridian for, once a year. Listing on the marketplace is what they came for;
// the plan decides how much of a website of their own they get with it.
//
//   Free          — a website at <business-name>.meridianstay.com, one stay. Nobody pays for this.
//   Single stay   — the same, at the client's own domain.
//   Multiple      — every branch they run on that one website.
//   Everything    — the above, plus rearranging the page themselves.
//
// Everyone is on Free from the moment they register, so a client always has somewhere to send
// guests. A plan that lapses falls back to Free rather than taking their website away.

export type PlanId = 'free' | 'single' | 'multi' | 'pro'

export interface PlanFeatures {
  /** How many stays may appear on the client's own website. 0 means as many as they have. */
  maxStaysOnSite: number
  /** Whether they may rearrange their landing page themselves. */
  pageEditor: boolean
  /** Whether they may point their own domain at it. Free sites live on the Meridian subdomain. */
  customDomain: boolean
  /**
   * Whether Meridian takes no commission on their bookings. A paid plan is bought instead of the
   * commission, not as well as it; Free clients pay per booking as they always have.
   */
  commissionFree: boolean
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
    id: 'free',
    name: 'Free',
    pricePerYear: 0,
    tagline: 'A website on us, from the day you join.',
    features: { maxStaysOnSite: 1, pageEditor: false, customDomain: false, commissionFree: false },
    perks: [
      'Your stay listed on the Meridian marketplace',
      'Your own website at your-business-name.meridianstay.com',
      'Bookings, calendar, guests and payouts in your portal',
      'Meridian’s commission is taken from each booking, as it always has been',
    ],
  },
  {
    id: 'single',
    name: 'Single stay',
    pricePerYear: 999,
    tagline: 'Keep your commission. Keep your address.',
    features: { maxStaysOnSite: 1, pageEditor: false, customDomain: true, commissionFree: true },
    perks: [
      'Everything in Free',
      'No commission on your bookings — you keep the whole booking value',
      'Your own domain — yourbusiness.com instead of our subdomain',
      'A secure certificate, issued and renewed for you',
      'Your name on the address guests remember',
    ],
  },
  {
    id: 'multi',
    name: 'Multiple stays',
    pricePerYear: 1999,
    tagline: 'Every branch on the same website.',
    features: { maxStaysOnSite: 0, pageEditor: false, customDomain: true, commissionFree: true },
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
    features: { maxStaysOnSite: 0, pageEditor: true, customDomain: true, commissionFree: true },
    perks: [
      'Everything in Multiple stays',
      'Rearrange your landing page yourself — drag the sections into the order you want',
      'Choose which sections appear, and what each one says',
      'Your own colours across the page',
    ],
  },
]

/**
 * Stored plans filled in from the defaults. Settings are written once and then belong to the
 * control centre, and a stored list replaces the default list whole — so a site set up before a
 * plan existed would never see it, and one set up before a feature existed would have that feature
 * read as `undefined`, which is the same as off. The prices, names and wording stay the client's;
 * what each plan *unlocks* always comes from here, because the platform decides entitlements from it.
 */
export function withPlanDefaults(stored: ClientPlan[] | undefined | null): ClientPlan[] {
  const saved = Array.isArray(stored) ? stored : []
  return defaultClientPlans.map((def) => {
    const mine = saved.find((p) => p.id === def.id)
    return mine ? { ...def, ...mine, id: def.id, features: def.features } : def
  })
}

/** The plan everybody has without paying. Never sold, never expires. */
export const FREE_PLAN_ID: PlanId = 'free'

export const freePlan = (plans: ClientPlan[]) => plans.find((p) => p.id === FREE_PLAN_ID) ?? defaultClientPlans[0]

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

/**
 * What this client may actually do right now. Everyone has a website: without a plan that is paid
 * up, they fall back to Free, which is a real website on a Meridian subdomain rather than nothing.
 */
export function entitlements(plans: ClientPlan[], s: Pick<Subscription, 'status' | 'expiresAt' | 'planId'>, now?: string): PlanFeatures & { ownWebsite: boolean } {
  const paid = subscriptionActive(s, now) ? planById(plans, s.planId) : null
  const plan = paid ?? freePlan(plans)
  return {
    ownWebsite: true,
    maxStaysOnSite: plan.features.maxStaysOnSite,
    pageEditor: plan.features.pageEditor,
    customDomain: plan.features.customDomain,
    commissionFree: plan.features.commissionFree,
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
