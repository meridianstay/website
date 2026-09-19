import type { Amenity, BookingDetail, Me, PaymentMethod, PropertyDetail, PropertySummary, SearchQuery } from '../api-types'
import type { ListingStatus, PropertyType, UserRole } from '../types'
import type { AnnouncementSettings, ContentPage, HomepageSettings, SiteSettings } from '../content'
import { request } from './http'

const qs = (params: object) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== null) search.set(key, String(value))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

export const api = {
  me: () => request<{ user: Me | null }>('/auth/me'),
  login: (email: string, password: string) => request<{ user: Me }>('/auth/login', { method: 'POST', json: { email, password } }),
  signup: (name: string, email: string, password: string) =>
    request<{ user: Me }>('/auth/signup', { method: 'POST', json: { name, email, password } }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  updateMe: (data: { name: string; phone: string }) => request<{ user: Me }>('/me', { method: 'PATCH', json: data }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('/me/password', { method: 'POST', json: { currentPassword, newPassword } }),

  site: () => request<SiteSettings>('/site'),
  pages: () => request<{ pages: { slug: string; title: string }[] }>('/pages'),
  page: (slug: string) => request<{ page: ContentPage }>(`/pages/${encodeURIComponent(slug)}`),

  locations: () => request<{ locations: string[] }>('/locations'),
  searchProperties: (query: SearchQuery) => request<{ properties: PropertySummary[] }>(`/properties${qs(query)}`),
  property: (slug: string) => request<{ property: PropertyDetail }>(`/properties/${encodeURIComponent(slug)}`),
  addReview: (slug: string, data: { bookingCode: string; rating: number; comment: string }) =>
    request<void>(`/properties/${encodeURIComponent(slug)}/reviews`, { method: 'POST', json: data }),

  createBooking: (data: {
    propertyId: number
    checkIn: string
    checkOut: string
    guests: number
    paymentMethod: PaymentMethod
    contactPhone: string
    specialRequests: string
  }) => request<{ booking: BookingDetail }>('/bookings', { method: 'POST', json: data }),
  myBookings: () => request<{ bookings: BookingDetail[] }>('/bookings'),
  booking: (code: string) => request<{ booking: BookingDetail }>(`/bookings/${encodeURIComponent(code)}`),
  cancelBooking: (code: string) => request<{ booking: BookingDetail }>(`/bookings/${encodeURIComponent(code)}/cancel`, { method: 'POST' }),

  wishlist: () => request<{ properties: PropertySummary[] }>('/wishlist'),
  addToWishlist: (propertyId: number) => request<void>(`/wishlist/${propertyId}`, { method: 'PUT' }),
  removeFromWishlist: (propertyId: number) => request<void>(`/wishlist/${propertyId}`, { method: 'DELETE' }),

  contact: (data: { name: string; email: string; topic: string; message: string }) =>
    request<void>('/contact', { method: 'POST', json: data }),
}

// ─── Host portal ──────────────────────────────────────────────────────────────

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

export const hostApi = {
  amenities: () => request<{ amenities: Amenity[] }>('/amenities'),
  listings: () => request<{ listings: HostListing[] }>('/host/listings'),
  listing: (id: number) => request<{ listing: ListingInput & { id: number; slug: string; status: ListingStatus; rejectionReason: string | null } }>(`/host/listings/${id}`),
  createListing: (data: ListingInput) => request<{ id: number }>('/host/listings', { method: 'POST', json: data }),
  updateListing: (id: number, data: ListingInput) => request<void>(`/host/listings/${id}`, { method: 'PUT', json: data }),
  bookings: () => request<{ bookings: HostBooking[] }>('/host/bookings'),
  stats: () => request<HostStats>('/host/stats'),
  calendar: (id: number) => request<HostCalendar>(`/host/listings/${id}/calendar`),
  addBlock: (id: number, data: { checkIn: string; checkOut: string; note: string }) =>
    request<void>(`/host/listings/${id}/blocks`, { method: 'POST', json: data }),
  removeBlock: (id: number, blockId: number) => request<void>(`/host/listings/${id}/blocks/${blockId}`, { method: 'DELETE' }),
  pause: (id: number) => request<void>(`/host/listings/${id}/pause`, { method: 'POST' }),
  relist: (id: number) => request<void>(`/host/listings/${id}/relist`, { method: 'POST' }),
}

export interface HostCalendar {
  blocks: { id: number; checkIn: string; checkOut: string; note: string | null }[]
  bookings: { code: string; checkIn: string; checkOut: string; guestName: string }[]
}

// ─── Admin panel ──────────────────────────────────────────────────────────────

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

export const adminApi = {
  stats: () => request<AdminStats>('/admin/stats'),
  listings: (params: { status?: ListingStatus; q?: string } = {}) => request<{ listings: AdminListing[] }>(`/admin/listings${qs(params)}`),
  approve: (id: number) => request<void>(`/admin/listings/${id}/approve`, { method: 'POST' }),
  reject: (id: number, reason: string) => request<void>(`/admin/listings/${id}/reject`, { method: 'POST', json: { reason } }),
  feature: (id: number, rank: number | null) => request<void>(`/admin/listings/${id}/feature`, { method: 'POST', json: { rank } }),

  bookings: (q?: string) => request<{ bookings: AdminBooking[] }>(`/admin/bookings${qs({ q })}`),
  cancelBooking: (code: string) => request<void>(`/admin/bookings/${encodeURIComponent(code)}/cancel`, { method: 'POST' }),

  users: (params: { q?: string; role?: UserRole } = {}) => request<{ users: AdminUser[] }>(`/admin/users${qs(params)}`),
  updateUser: (id: number, data: { role?: UserRole; suspended?: boolean }) => request<void>(`/admin/users/${id}`, { method: 'PATCH', json: data }),

  reviews: (q?: string) => request<{ reviews: AdminReview[] }>(`/admin/reviews${qs({ q })}`),
  hideReview: (id: number) => request<void>(`/admin/reviews/${id}/hide`, { method: 'POST' }),
  restoreReview: (id: number) => request<void>(`/admin/reviews/${id}/restore`, { method: 'POST' }),

  messages: (status?: string) => request<{ messages: ContactMessage[] }>(`/admin/messages${qs({ status })}`),
  setMessageStatus: (id: number, status: 'new' | 'read' | 'closed') => request<void>(`/admin/messages/${id}`, { method: 'PATCH', json: { status } }),

  settings: () => request<SiteSettings>('/admin/settings'),
  saveHomepage: (value: HomepageSettings) => request<void>('/admin/settings/homepage', { method: 'PUT', json: value }),
  saveAnnouncement: (value: AnnouncementSettings) => request<void>('/admin/settings/announcement', { method: 'PUT', json: value }),
  pages: () => request<{ pages: ContentPage[] }>('/admin/pages'),
  savePage: (page: ContentPage) => request<void>(`/admin/pages/${encodeURIComponent(page.slug)}`, { method: 'PUT', json: page }),
  deletePage: (slug: string) => request<void>(`/admin/pages/${encodeURIComponent(slug)}`, { method: 'DELETE' }),

  audit: () => request<{ entries: AuditEntry[] }>('/admin/audit'),
}
