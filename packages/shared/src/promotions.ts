// Paid promotions: hosts pay by the day to have a listing promoted, and see how it performed.
// Meridian keeps the whole amount (it isn't a booking, so there's no commission).

export type AdPlacement = 'search' | 'home' | 'destination'

export const AD_PLACEMENTS: { value: AdPlacement; label: string; explain: string; icon: string; slots: number }[] = [
  { value: 'search', label: 'Top of search', explain: 'Shown first when guests search, above the other results.', icon: 'magnifying-glass', slots: 3 },
  { value: 'home', label: 'Homepage row', explain: 'In the “Promoted stays” row on the Meridian Stay homepage.', icon: 'house', slots: 6 },
  { value: 'destination', label: 'Destination page', explain: 'First on the page for your town or state, e.g. “Stays in Coorg”.', icon: 'map-location-dot', slots: 2 },
]

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
  placement: AdPlacement
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

export interface PromotionSettings {
  /** Hosts can buy promotions. */
  enabled: boolean
  searchPerDay: number
  homePerDay: number
  destinationPerDay: number
  /** Longest campaign, in days. */
  maxDays: number
}

export const defaultPromotions: PromotionSettings = { enabled: true, searchPerDay: 499, homePerDay: 999, destinationPerDay: 299, maxDays: 30 }

export const ratePerDay = (p: PromotionSettings, placement: AdPlacement) =>
  placement === 'search' ? p.searchPerDay : placement === 'home' ? p.homePerDay : p.destinationPerDay

/** Clicks ÷ impressions, as a percentage with one decimal. */
export const clickRate = (c: Pick<AdCampaign, 'impressions' | 'clicks'>) =>
  c.impressions > 0 ? Math.round((c.clicks / c.impressions) * 1000) / 10 : 0

/** A campaign is showing to guests today. */
export const isLiveToday = (c: Pick<AdCampaign, 'status' | 'startDate' | 'endDate'>, today: string) =>
  (c.status === 'Scheduled' || c.status === 'Running') && c.startDate <= today && c.endDate >= today
