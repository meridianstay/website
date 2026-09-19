import type { BookingDetail, BookingState, Me, PaymentMethod, PropertySummary, PropertyType, Review, UserRole } from '@meridian/shared'

// Row shapes as they come out of Postgres, and their conversion to API responses.
// Money leaves the API in major units (e.g. dollars); the database keeps minor units.

export interface UserRow {
  id: number; name: string; email: string; phone: string | null; role: UserRole; avatar_url: string | null; created_at: Date
}

export const toMe = (r: UserRow): Me => ({
  id: r.id, name: r.name, email: r.email, phone: r.phone, role: r.role, avatar: r.avatar_url, createdAt: r.created_at.toISOString(),
})

export interface PropertyRow {
  id: number; slug: string; title: string; type: PropertyType; description: string; city: string; region: string
  latitude: string; longitude: string; price_per_night_minor: number; bedrooms: number; bathrooms: number; max_guests: number
  cover_image_url: string; rating_avg: string; review_count: number
}

export const PROPERTY_COLUMNS = `p.id, p.slug, p.title, p.type, p.description, p.city, p.region, p.latitude, p.longitude,
  p.price_per_night_minor, p.bedrooms, p.bathrooms, p.max_guests, p.cover_image_url, p.rating_avg, p.review_count`

export const toPropertySummary = (r: PropertyRow): PropertySummary => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  type: r.type,
  location: `${r.city}, ${r.region}`,
  price: r.price_per_night_minor / 100,
  rating: Number(r.rating_avg),
  reviewCount: r.review_count,
  beds: r.bedrooms,
  baths: r.bathrooms,
  maxGuests: r.max_guests,
  image: r.cover_image_url,
  description: r.description,
  lat: Number(r.latitude),
  lng: Number(r.longitude),
})

export interface ReviewRow { id: number; author_name: string; rating: number; comment: string; created_at: Date }

export const toReview = (r: ReviewRow): Review => ({
  id: r.id, authorName: r.author_name, rating: r.rating, comment: r.comment, createdAt: r.created_at.toISOString(),
})

export interface BookingRow {
  id: number; code: string; check_in: string; check_out: string; nights: number; guests: number
  price_per_night_minor: number; base_amount_minor: number; extra_guest_amount_minor: number; service_fee_minor: number
  total_minor: number; status: 'Confirmed' | 'Cancelled'; payment_method: PaymentMethod; contact_phone: string
  special_requests: string | null; created_at: Date; reviewed: boolean
  property_slug: string; property_title: string; property_type: PropertyType; property_city: string; property_region: string
  property_image: string
}

/** Joins every BookingRow needs. Callers append WHERE/ORDER BY. */
export const BOOKING_SELECT = `
  SELECT b.*, EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS reviewed,
    p.slug AS property_slug, p.title AS property_title, p.type AS property_type, p.city AS property_city,
    p.region AS property_region, p.cover_image_url AS property_image
  FROM bookings b JOIN properties p ON p.id = b.property_id`

export function toBooking(r: BookingRow, today: string): BookingDetail {
  const status: BookingState = r.status === 'Cancelled' ? 'Cancelled' : r.check_out <= today ? 'Completed' : 'Confirmed'
  return {
    id: r.id,
    code: r.code,
    property: { slug: r.property_slug, title: r.property_title, type: r.property_type, location: `${r.property_city}, ${r.property_region}`, image: r.property_image },
    checkIn: r.check_in,
    checkOut: r.check_out,
    nights: r.nights,
    guests: r.guests,
    pricePerNight: r.price_per_night_minor / 100,
    baseAmount: r.base_amount_minor / 100,
    extraGuestAmount: r.extra_guest_amount_minor / 100,
    serviceFee: r.service_fee_minor / 100,
    total: r.total_minor / 100,
    status,
    paymentMethod: r.payment_method,
    contactPhone: r.contact_phone,
    specialRequests: r.special_requests,
    createdAt: r.created_at.toISOString(),
    reviewed: r.reviewed,
  }
}
