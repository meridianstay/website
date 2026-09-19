import type { ListingStatus, PropertyType, UserRole } from './types'

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
}

export interface Review {
  id: number
  authorName: string
  rating: number
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
  gallery: string[]
  amenities: Amenity[]
  host: { name: string; joinedAt: string; avatar: string | null }
  reviews: Review[]
  bookedRanges: DateRange[]
  /** Code of the signed-in guest's finished, unreviewed stay here, if any. */
  reviewableBookingCode: string | null
}

export type PaymentMethod = 'upi' | 'card' | 'netbanking'

export type BookingState = 'Confirmed' | 'Completed' | 'Cancelled'

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
  contactPhone: string
  specialRequests: string | null
  createdAt: string
  reviewed: boolean
}

export interface SearchQuery {
  where?: string
  type?: PropertyType
  checkIn?: string
  checkOut?: string
  guests?: number
  minPrice?: number
  maxPrice?: number
  sort?: 'recommended' | 'price_asc' | 'price_desc' | 'rating'
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
}

export type HostBooking = BookingDetail & { guestName: string }

export interface HostStats {
  earnings: number
  listings: number
  live: number
  rated: number
  avgRating: number | null
  upcoming: number
}

export interface HostCalendar {
  blocks: { id: number; checkIn: string; checkOut: string; note: string | null }[]
  bookings: { code: string; checkIn: string; checkOut: string; guestName: string }[]
}

export interface AdminListing extends HostListing {
  hostName: string
  hostEmail: string
  createdAt: string
  featuredRank: number | null
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
  gbv: number
  fees: number
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
