import type { ListingStatus, PropertyType, UserRole } from './types'
import type { Management } from './pricing'
import type { DayUseSettings, GuestBreakdown, HouseRules } from './listing'

// Shapes returned by @meridian/api. Shared by the API and every frontend.

export interface Me {
  id: number
  name: string
  /** Set for Google sign-ins; phone sign-ins may have no email. */
  email: string | null
  phone: string | null
  role: UserRole
  avatar: string | null
  createdAt: string
}

export interface PropertySummary {
  id: number
  slug: string
  title: string
  type: PropertyType
  location: string
  price: number
  rating: number
  reviewCount: number
  beds: number
  baths: number
  maxGuests: number
  image: string
  description: string
  lat: number
  lng: number
  /** managed: book instantly; self: the host approves each request. */
  management: Management
  /** Offers overnight stays (`price` per night). */
  overnight: boolean
  /** Day-use price for the base block of hours, when offered. */
  dayUse: { price: number; blockHours: number } | null
  /** Inspected and verified by the Meridian team. */
  assured: boolean
  /** Host discount in percent; `price` is before it, `priceNow` after. */
  discountPct: number
  priceNow: number
  /** Went live in the last 30 days. */
  isNew: boolean
}

export interface RatingBreakdown {
  count: number
  /** Number of reviews with 5, 4, 3, 2 and 1 stars (overall, rounded). */
  stars: [number, number, number, number, number]
  property: number | null
  service: number | null
}

export interface Review {
  id: number
  authorName: string
  /** Overall: the average of the property and service ratings (older reviews have only this). */
  rating: number
  propertyRating: number | null
  serviceRating: number | null
  comment: string
  createdAt: string
}

export interface Amenity {
  name: string
  /** Font Awesome icon name, e.g. "wifi". */
  icon: string
}

export interface DateRange {
  checkIn: string
  checkOut: string
}

export interface PropertyDetail extends PropertySummary {
  areaSqft: number | null
  gatheringCapacity: number | null
  checkInTime: string
  checkOutTime: string
  houseRules: HouseRules
  securityDeposit: number
  /** Day-use settings with the discount already applied to `price`. */
  dayUseSettings: DayUseSettings | null
  /** The day-use price before the discount, when discounted. */
  dayUseFullPrice: number | null
  gallery: string[]
  amenities: Amenity[]
  host: { name: string; joinedAt: string; avatar: string | null }
  reviews: Review[]
  bookedRanges: DateRange[]
  /** Code of the signed-in guest's finished, unreviewed stay here, if any. */
  reviewableBookingCode: string | null
  /** The host is paying to promote this stay right now. */
  promoted: boolean
  ratingBreakdown: RatingBreakdown
  /** Stays of the same type nearby, or other stays nearby. */
  similar: PropertySummary[]
}

export type PaymentMethod = 'upi' | 'card' | 'netbanking'

/**
 * AwaitingPayment: dates held while the guest pays.   Requested: waiting for the host (self-managed).
 * Confirmed / Completed (confirmed and checked out).  Declined / Expired / Cancelled: ended.
 */
export type BookingState = 'AwaitingPayment' | 'Requested' | 'Confirmed' | 'Completed' | 'Declined' | 'Expired' | 'Cancelled'

export type PaymentState = 'test' | 'created' | 'authorized' | 'paid' | 'refunded' | 'partially_refunded' | 'released' | 'failed'

export interface BookingDetail {
  id: number
  code: string
  property: Pick<PropertySummary, 'slug' | 'title' | 'type' | 'location' | 'image'>
  checkIn: string
  checkOut: string
  nights: number
  guests: number
  pricePerNight: number
  baseAmount: number
  extraGuestAmount: number
  serviceFee: number
  total: number
  status: BookingState
  paymentMethod: PaymentMethod
  paymentStatus: PaymentState
  /** How much has been refunded to the guest, if anything. */
  refunded: number
  /** When a pending request or payment hold lapses. */
  expiresAt: string | null
  instantBook: boolean
  /** stay: overnight (checkIn → checkOut). dayuse: one day, startTime → endTime. */
  kind: 'stay' | 'dayuse'
  /** Day use only: "HH:MM" times and length in hours. */
  startTime: string | null
  endTime: string | null
  hours: number | null
  guestBreakdown: GuestBreakdown
  /** Coupon used, and what it took off. */
  couponCode: string | null
  discount: number
  /** Refundable deposit to pay at check-in (₹). */
  securityDeposit: number
  checkInTime: string
  checkOutTime: string
  /** The property's exact address, once the booking is confirmed. */
  address: string | null
  /** The host's message when declining a request. */
  declineReason: string | null
  contactPhone: string
  specialRequests: string | null
  createdAt: string
  reviewed: boolean
}

/** Returned when a booking needs online payment: everything Razorpay Checkout needs. */
export interface PaymentRequest {
  provider: 'razorpay'
  keyId: string
  orderId: string
  amount: number
  currency: string
  /** true: charged now (instant booking). false: authorised now, charged when the host accepts. */
  captureNow: boolean
}

export interface SearchQuery {
  where?: string
  type?: PropertyType
  checkIn?: string
  checkOut?: string
  guests?: number
  minPrice?: number
  maxPrice?: number
  sort?: 'recommended' | 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'nearest'
  /** A point to measure distance from (needed for sort=nearest). */
  lat?: number
  lng?: number
  /** managed: instant book only; self: request to book only. */
  management?: Management
  limit?: number
  /** Only listings the admin has featured on the homepage, in featured order. */
  featured?: boolean
}

export interface ApiErrorBody {
  error: string
  fields?: Record<string, string>
}

// ─── Host portal and control center ─────────────────────────────────────────

export interface HostListing extends PropertySummary {
  status: ListingStatus
  rejectionReason: string | null
  /** A promotion for this listing is showing today. */
  promoted: boolean
}

export interface ListingInput {
  title: string
  type: PropertyType
  description: string
  city: string
  region: string
  country: string
  price: number
  beds: number
  baths: number
  maxGuests: number
  lat: number
  lng: number
  coverImage: string
  photos: string[]
  amenities: string[]
  /** Discount on this listing, in percent (0–70). */
  discountPct: number
  /** Built-up area in square feet, if the host gives it. */
  areaSqft: number | null
  /** Most people allowed for a day event or party (can exceed overnight guests). */
  gatheringCapacity: number | null
  /** Standard times for overnight stays, "HH:MM". */
  checkInTime: string
  checkOutTime: string
  houseRules: HouseRules
  /** Refundable deposit collected at check-in (₹); 0 for none. */
  securityDeposit: number
  /** Exact address, shared with guests only once a booking is confirmed. */
  address: string
  /** Offers overnight stays at `price` per night. */
  overnight: boolean
  dayUse: DayUseSettings
}

export type HostBooking = BookingDetail & {
  guestName: string
  guestEmail: string
  commissionPct: number
  commission: number
  payout: number
  /** A refund Razorpay refused, waiting for an admin to retry. */
  refundPending: number
}

export interface HostStats {
  /** Payouts after Meridian's commission. */
  earnings: number
  /** Requests waiting for this host's answer. */
  requests: number
  listings: number
  live: number
  rated: number
  avgRating: number | null
  upcoming: number
}

export interface HostCalendar {
  blocks: { id: number; checkIn: string; checkOut: string; note: string | null }[]
  /** Day-use bookings have start and end times (same date). */
  bookings: { code: string; checkIn: string; checkOut: string; guestName: string; requested: boolean; startTime: string | null; endTime: string | null }[]
}

export interface AdminListing extends HostListing {
  hostName: string
  hostEmail: string
  createdAt: string
  featuredRank: number | null
}

/** Razorpay settings as the admin panel sees them. Secrets are never returned, only whether they're set. */
export interface PaymentSettingsView {
  enabled: boolean
  keyId: string
  keySecretLast4: string | null
  webhookSecretSet: boolean
  mode: 'test' | 'live' | 'unset'
  webhookUrl: string
  encryptionReady: boolean
  updatedAt: string | null
}

export interface AdminStats {
  listings: number
  live: number
  pending: number
  users: number
  hosts: number
  suspended: number
  bookings: number
  upcoming: number
  requests: number
  gbv: number
  /** Meridian's commission on confirmed bookings. */
  commission: number
  /** Money hosts have paid for promotions. */
  adRevenue: number
  new_messages: number
  reviews: number
}

export type AdminUser = Me & { suspended: boolean; listings: number; bookings: number }

export type AdminBooking = HostBooking & { guestEmail: string }

export interface AdminReview {
  id: number
  authorName: string
  rating: number
  comment: string
  createdAt: string
  hidden: boolean
  property: { slug: string; title: string }
}

export interface AuditEntry {
  id: number
  action: string
  targetType: string
  targetId: string | null
  details: Record<string, unknown>
  adminName: string | null
  createdAt: string
}

export interface ContactMessage {
  id: number
  name: string
  email: string
  topic: string
  message: string
  status: string
  createdAt: string
}

// ─── Database screen (admin) ────────────────────────────────────────────────

export interface DbTableSummary {
  name: string
  label: string
  description: string
  rows: number
  canEdit: boolean
  canInsert: boolean
  canDelete: boolean
}

export interface DbColumn {
  name: string
  type: string
  nullable: boolean
  hasDefault: boolean
  editable: boolean
  insertable: boolean
  isKey: boolean
  options?: string[]
}

export type DbRow = Record<string, unknown>

export interface DbBrowseResult {
  table: { name: string; label: string; description: string; note: string | null; primaryKey: string[]; canInsert: boolean; canDelete: boolean }
  columns: DbColumn[]
  rows: DbRow[]
  /** Identifies each row for editing; null when the key is secret (e.g. sessions). */
  keys: (DbRow | null)[]
  total: number
  page: number
  pageSize: number
  sort: string
  dir: 'asc' | 'desc'
}

// ─── Firebase ────────────────────────────────────────────────────────────────

/** Which login page a sign-in comes from. The admin portal only accepts admin accounts. */
export type SignInPortal = 'guest' | 'host' | 'admin'

export interface ServiceCheck { ok: boolean; message: string }

export interface IntegrationStatus {
  mode: 'emulator' | 'live' | 'unconfigured'
  projectId: string
  storageBucket: string
  services: { firestore: ServiceCheck; auth: ServiceCheck; storage: ServiceCheck }
}
