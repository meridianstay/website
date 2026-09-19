import type { PropertyType, UserRole } from './types'

// Shapes returned by @meridian/api. Shared by the API and every frontend.

export interface Me {
  id: number
  name: string
  email: string
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
