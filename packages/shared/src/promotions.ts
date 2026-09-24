// Paid promotions: hosts pay by the day to have a listing promoted, and see how it performed.
// Meridian keeps the whole amount (it isn't a booking, so there's no commission).
//
// What a host can buy is a *plan*, written in the control centre: where the listing appears, how far
// away guests have to be for it to count, how many listings can run on it at once, and what a day
// costs. A farm outside Nashik can pay a little to be seen by people nearby, or a lot to be seen
// across India, and the price for each is yours to set.

export type AdPlacement = 'search' | 'home' | 'destination'

export const AD_PLACEMENTS: { value: AdPlacement; label: string; explain: string; icon: string }[] = [
  { value: 'search', label: 'Top of search', explain: 'Shown first when guests search, above the other results.', icon: 'magnifying-glass' },
  { value: 'home', label: 'Homepage row', explain: 'In the “Promoted stays” row on the Meridian Stay homepage.', icon: 'house' },
  { value: 'destination', label: 'Destination page', explain: 'First on the page for a town or state, e.g. “Stays in Coorg”.', icon: 'map-location-dot' },
]

/** How far from the property a guest can be for the promotion to count. */
export type AdReach = 'nearby' | 'city' | 'district' | 'state' | 'everywhere'

export const AD_REACH: { value: AdReach; label: string; explain: string; km: number | null; icon: string }[] = [
  { value: 'nearby', label: 'Nearby', explain: 'Guests within about 25 km of the property — weekenders looking close to home.', km: 25, icon: 'location-crosshairs' },
  { value: 'city', label: 'Town or city', explain: 'Guests looking at the property’s own town, or within 15 km of it.', km: 15, icon: 'location-dot' },
  { value: 'district', label: 'District', explain: 'Guests within about 75 km, which is roughly a district.', km: 75, icon: 'map-pin' },
  { value: 'state', label: 'Whole state', explain: 'Guests looking anywhere in the property’s state.', km: null, icon: 'map' },
  { value: 'everywhere', label: 'All of India', explain: 'Every guest, wherever they are looking. The only reach that shows to someone whose location we don’t know.', km: null, icon: 'earth-asia' },
]

export const reachLabel = (reach: AdReach) => AD_REACH.find((r) => r.value === reach)?.label ?? reach

/**
 * Draft → AwaitingPayment → PendingReview (paid, waiting for our team) → Scheduled → Running → Finished.
 * Rejected and Cancelled end a campaign; paid money is refunded.
 */
export type AdStatus = 'AwaitingPayment' | 'PendingReview' | 'Scheduled' | 'Running' | 'Finished' | 'Rejected' | 'Cancelled'

export interface AdCampaign {
  id: number
  hostId: number
  propertyId: number
  property: { slug: string; title: string; image: string; location: string }
  /** The plan bought, and what it was called and cost at the time. */
  planId: string
  planName: string
  placement: AdPlacement
  reach: AdReach
  startDate: string
  endDate: string
  days: number
  /** What the host paid, in rupees. */
  ratePerDay: number
  total: number
  status: AdStatus
  paymentStatus: 'test' | 'created' | 'paid' | 'refunded' | 'failed'
  impressions: number
  clicks: number
  createdAt: string
  reviewedAt: string | null
  rejectionReason: string | null
  refunded: number
}

/** One thing a host can buy, written in the control centre. */
export interface PromotionPlan {
  /** Stable id, kept on campaigns so a renamed plan doesn't lose its history. */
  id: string
  name: string
  /** One line for the host, under the name. */
  blurb: string
  placement: AdPlacement
  reach: AdReach
  /** How many listings can run on this plan at the same time. */
  slots: number
  pricePerDay: number
  maxDays: number
  enabled: boolean
}

export interface PromotionSettings {
  /** Hosts can buy promotions at all. */
  enabled: boolean
  plans: PromotionPlan[]
}

export const PLAN_LIMITS = { plans: 12, slots: 50, maxDays: 365, pricePerDay: 100000 }

export const defaultPromotions: PromotionSettings = {
  enabled: true,
  plans: [
    { id: 'home-local', name: 'Local spotlight', blurb: 'Your homepage row, for guests within about 25 km.', placement: 'home', reach: 'nearby', slots: 6, pricePerDay: 299, maxDays: 30, enabled: true },
    { id: 'home-city', name: 'City homepage', blurb: 'The homepage row for everyone looking at your town.', placement: 'home', reach: 'city', slots: 6, pricePerDay: 599, maxDays: 30, enabled: true },
    { id: 'home-state', name: 'Statewide homepage', blurb: 'The homepage row across your whole state.', placement: 'home', reach: 'state', slots: 6, pricePerDay: 999, maxDays: 30, enabled: true },
    { id: 'home-india', name: 'All-India homepage', blurb: 'The homepage row for every guest in the country.', placement: 'home', reach: 'everywhere', slots: 6, pricePerDay: 1999, maxDays: 30, enabled: true },
    { id: 'search-city', name: 'Top of search', blurb: 'Above the other results when guests search your area.', placement: 'search', reach: 'city', slots: 3, pricePerDay: 499, maxDays: 30, enabled: true },
    { id: 'destination-district', name: 'Destination page', blurb: 'First on the page for your town, for guests within about 75 km.', placement: 'destination', reach: 'district', slots: 2, pricePerDay: 299, maxDays: 30, enabled: true },
  ],
}

/** Understands settings saved before plans existed, when there were three fixed placements. */
export function withPromotionDefaults(saved: Partial<PromotionSettings> | Record<string, unknown> | null | undefined): PromotionSettings {
  if (!saved) return structuredClone(defaultPromotions)
  const raw = saved as Partial<PromotionSettings>
  if (Array.isArray(raw.plans)) return { enabled: raw.enabled !== false, plans: raw.plans }

  // Before 0.28.0: one price per placement, no reach, slots fixed in the code.
  const old = saved as { searchPerDay?: number; homePerDay?: number; destinationPerDay?: number; maxDays?: number }
  const maxDays = old.maxDays ?? 30
  const plans = structuredClone(defaultPromotions.plans)
    .filter((p) => ['home-india', 'search-city', 'destination-district'].includes(p.id))
    .map((p) => ({
      ...p,
      reach: 'everywhere' as AdReach,
      maxDays,
      pricePerDay: p.placement === 'search' ? old.searchPerDay ?? p.pricePerDay
        : p.placement === 'home' ? old.homePerDay ?? p.pricePerDay
        : old.destinationPerDay ?? p.pricePerDay,
    }))
  return { enabled: raw.enabled !== false, plans }
}

export const findPlan = (settings: PromotionSettings, id: string) => settings.plans.find((p) => p.id === id)

/** Clicks ÷ impressions, as a percentage with one decimal. */
export const clickRate = (c: Pick<AdCampaign, 'impressions' | 'clicks'>) =>
  c.impressions > 0 ? Math.round((c.clicks / c.impressions) * 1000) / 10 : 0

/** A campaign is showing to guests today. */
export const isLiveToday = (c: Pick<AdCampaign, 'status' | 'startDate' | 'endDate'>, today: string) =>
  (c.status === 'Scheduled' || c.status === 'Running') && c.startDate <= today && c.endDate >= today

/** Where a guest is looking, as far as we can tell. Everything is optional. */
export interface Viewer {
  /** What they typed or picked: a town, a state, or a stay name. */
  where?: string
  lat?: number
  lng?: number
}

/** The property a campaign points at, as far as reach cares. */
export interface AdTarget {
  city: string
  region: string
  lat: number
  lng: number
}

/**
 * Whether a promotion on `reach` should be shown to this viewer. When we don't know where they are,
 * only "All of India" counts — a local plan showing to someone on the other side of the country
 * would be the host's money wasted.
 */
export function reaches(reach: AdReach, target: AdTarget, viewer: Viewer, distanceKm: (a: AdTarget, b: { lat: number; lng: number }) => number): boolean {
  if (reach === 'everywhere') return true
  const said = (viewer.where ?? '').trim().toLowerCase()
  const near = viewer.lat !== undefined && viewer.lng !== undefined
    ? distanceKm(target, { lat: viewer.lat, lng: viewer.lng })
    : null

  if (reach === 'state') {
    return !!said && (said.includes(target.region.toLowerCase()) || target.region.toLowerCase().includes(said))
  }
  if (reach === 'city') {
    if (said && (said.includes(target.city.toLowerCase()) || target.city.toLowerCase().includes(said))) return true
    return near !== null && near <= 15
  }
  const limit = reach === 'nearby' ? 25 : 75
  return near !== null && near <= limit
}
