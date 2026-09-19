import type {
  AdminBooking, AdminListing, AdminReview, AdminStats, AdminUser, Amenity, AuditEntry, BookingDetail, ContactMessage,
  DbBrowseResult, DbRow, DbTableSummary, IntegrationStatus, SignInPortal,
  HostBooking, HostCalendar, HostListing, HostStats, ListingInput, Me, PaymentMethod, PaymentRequest, PaymentSettingsView, PropertyDetail, PropertySummary, SearchQuery,
} from '../api-types'
import type { ListingStatus, UserRole } from '../types'
import type { AnnouncementSettings, ContentPage, HomepageSettings, PublicSite, SignInSettings, SiteSettings, UploadSettings } from '../content'
import type { CommissionRates, Management } from '../pricing'
import type { AboutPage, AboutStats } from '../about'
import type { HomeBlock, HomeLayout } from '../homepage'
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
  /** Exchanges a Firebase ID token for a Meridian Stay session on one of the three portals. */
  session: (idToken: string, portal: SignInPortal) => request<{ user: Me }>('/auth/session', { method: 'POST', json: { idToken, portal } }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  updateMe: (data: { name: string; phone: string }) => request<{ user: Me }>('/me', { method: 'PATCH', json: data }),
  /** Uploads a photo to Firebase Storage and returns its link. */
  upload: (file: File, purpose: 'listing' | 'avatar' | 'content') => {
    const form = new FormData()
    form.append('file', file)
    form.append('purpose', purpose)
    return request<{ url: string }>('/uploads', { method: 'POST', body: form })
  },

  site: () => request<PublicSite>('/site'),
  /** The homepage layout and the stays for each switched-on "Stays" section. */
  home: () => request<{ layout: HomeLayout; stays: Record<string, PropertySummary[]> }>('/home'),
  about: () => request<{ page: AboutPage; stats: AboutStats }>('/about'),
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
  }) => request<{ booking: BookingDetail; payment: PaymentRequest | null }>('/bookings', { method: 'POST', json: data }),
  /** Razorpay Checkout details again, for a checkout that wasn't finished. */
  bookingPayment: (code: string) => request<{ payment: PaymentRequest }>(`/bookings/${encodeURIComponent(code)}/payment`),
  /** Sends Razorpay Checkout's signed result so the server can verify it. */
  confirmPayment: (code: string, result: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    request<{ booking: BookingDetail }>(`/bookings/${encodeURIComponent(code)}/pay`, { method: 'POST', json: result }),
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

export const hostApi = {
  amenities: () => request<{ amenities: Amenity[] }>('/amenities'),
  listings: () => request<{ listings: HostListing[] }>('/host/listings'),
  listing: (id: number) => request<{ listing: ListingInput & { id: number; slug: string; status: ListingStatus; rejectionReason: string | null; management: Management } }>(`/host/listings/${id}`),
  createListing: (data: ListingInput) => request<{ id: number }>('/host/listings', { method: 'POST', json: data }),
  updateListing: (id: number, data: ListingInput) => request<void>(`/host/listings/${id}`, { method: 'PUT', json: data }),
  bookings: () => request<{ bookings: HostBooking[] }>('/host/bookings'),
  acceptBooking: (code: string) => request<{ booking: BookingDetail }>(`/host/bookings/${encodeURIComponent(code)}/accept`, { method: 'POST' }),
  declineBooking: (code: string, reason: string) =>
    request<{ booking: BookingDetail }>(`/host/bookings/${encodeURIComponent(code)}/decline`, { method: 'POST', json: { reason } }),
  stats: () => request<HostStats>('/host/stats'),
  calendar: (id: number) => request<HostCalendar>(`/host/listings/${id}/calendar`),
  addBlock: (id: number, data: { checkIn: string; checkOut: string; note: string }) =>
    request<void>(`/host/listings/${id}/blocks`, { method: 'POST', json: data }),
  removeBlock: (id: number, blockId: number) => request<void>(`/host/listings/${id}/blocks/${blockId}`, { method: 'DELETE' }),
  pause: (id: number) => request<void>(`/host/listings/${id}/pause`, { method: 'POST' }),
  relist: (id: number) => request<void>(`/host/listings/${id}/relist`, { method: 'POST' }),
}

// ─── Admin panel ──────────────────────────────────────────────────────────────

export const adminApi = {
  stats: () => request<AdminStats>('/admin/stats'),
  listings: (params: { status?: ListingStatus; q?: string } = {}) => request<{ listings: AdminListing[] }>(`/admin/listings${qs(params)}`),
  approve: (id: number) => request<void>(`/admin/listings/${id}/approve`, { method: 'POST' }),
  reject: (id: number, reason: string) => request<void>(`/admin/listings/${id}/reject`, { method: 'POST', json: { reason } }),
  feature: (id: number, rank: number | null) => request<void>(`/admin/listings/${id}/feature`, { method: 'POST', json: { rank } }),

  setManagement: (id: number, management: Management) => request<void>(`/admin/listings/${id}/management`, { method: 'POST', json: { management } }),
  bookings: (params: { q?: string; status?: string } = {}) => request<{ bookings: AdminBooking[] }>(`/admin/bookings${qs(params)}`),
  cancelBooking: (code: string) => request<void>(`/admin/bookings/${encodeURIComponent(code)}/cancel`, { method: 'POST' }),
  retryRefund: (code: string) => request<void>(`/admin/bookings/${encodeURIComponent(code)}/refund`, { method: 'POST' }),

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
  saveSignIn: (value: SignInSettings) => request<void>('/admin/settings/signIn', { method: 'PUT', json: value }),
  saveUploads: (value: UploadSettings) => request<void>('/admin/settings/uploads', { method: 'PUT', json: value }),
  saveCommission: (value: CommissionRates) => request<void>('/admin/settings/commission', { method: 'PUT', json: value }),
  integrations: () => request<IntegrationStatus>('/admin/integrations'),
  payments: () => request<PaymentSettingsView>('/admin/payments'),
  /** Blank secrets keep the saved ones. */
  savePayments: (value: { enabled: boolean; keyId: string; keySecret?: string; webhookSecret?: string; clearWebhookSecret?: boolean }) =>
    request<PaymentSettingsView>('/admin/payments', { method: 'PUT', json: value }),
  testPayments: () => request<{ ok: boolean; mode: string }>('/admin/payments/test', { method: 'POST' }),
  demo: () => request<{ resetAllowed: boolean }>('/admin/demo'),
  resetDemo: () => request<void>('/admin/demo/reset', { method: 'POST' }),
  homepage: () => request<{ layout: HomeLayout }>('/admin/homepage'),
  saveHomeLayout: (layout: HomeLayout) => request<{ layout: HomeLayout }>('/admin/homepage', { method: 'PUT', json: layout }),
  previewStays: (block: HomeBlock) => request<{ properties: PropertySummary[] }>('/admin/homepage/preview', { method: 'POST', json: block }),
  about: () => request<{ page: AboutPage; stats: AboutStats }>('/admin/about'),
  saveAbout: (page: AboutPage) => request<{ page: AboutPage }>('/admin/about', { method: 'PUT', json: page }),
  pages: () => request<{ pages: ContentPage[] }>('/admin/pages'),
  savePage: (page: ContentPage) => request<void>(`/admin/pages/${encodeURIComponent(page.slug)}`, { method: 'PUT', json: page }),
  deletePage: (slug: string) => request<void>(`/admin/pages/${encodeURIComponent(slug)}`, { method: 'DELETE' }),

  audit: () => request<{ entries: AuditEntry[] }>('/admin/audit'),

  dbTables: () => request<{ tables: DbTableSummary[] }>('/admin/db/tables'),
  dbBrowse: (table: string, params: { page?: number; pageSize?: number; q?: string; sort?: string; dir?: 'asc' | 'desc' } = {}) =>
    request<DbBrowseResult>(`/admin/db/tables/${encodeURIComponent(table)}${qs(params)}`),
  dbUpdate: (table: string, key: DbRow, changes: DbRow) =>
    request<{ row: DbRow }>(`/admin/db/tables/${encodeURIComponent(table)}/rows`, { method: 'PATCH', json: { key, changes } }),
  dbInsert: (table: string, values: DbRow) =>
    request<{ row: DbRow }>(`/admin/db/tables/${encodeURIComponent(table)}/rows`, { method: 'POST', json: values }),
  dbDelete: (table: string, key: DbRow) =>
    request<void>(`/admin/db/tables/${encodeURIComponent(table)}/rows${qs({ key: JSON.stringify(key) })}`, { method: 'DELETE' }),
}
