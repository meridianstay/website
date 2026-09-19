import { addDays, type Amenity, type Management, type DateRange, type ListingInput, type ListingStatus, type PropertySummary, type PropertyType, type SearchQuery } from '@meridian/shared'
import type { Transaction } from 'firebase-admin/firestore'
import { C, all, col, firestore, nextId, nightsOf, nowISO } from '../store/db'
import { amenitiesRepo } from './amenities'

// Collection: properties/{id}, with properties/{id}/nights/{date} marking each booked or blocked night.

export interface PropertyDoc {
  id: number; slug: string; hostId: number; title: string; type: PropertyType; description: string
  city: string; region: string; country: string; lat: number; lng: number; currency: string
  pricePerNightMinor: number; bedrooms: number; bathrooms: number; maxGuests: number
  status: ListingStatus; rejectionReason: string | null; coverImageUrl: string; photos: string[]; amenities: string[]
  ratingAvg: number; reviewCount: number; featuredRank: number | null
  /** managed: run by Meridian, instant booking. self: host-managed, request to book. Set by admins. */
  management: Management
  approvedAt: string | null; createdAt: string; updatedAt: string
}

/** Money leaves the data layer in major units (rupees); documents store minor units (paise). */
export const toPropertySummary = (p: PropertyDoc): PropertySummary => ({
  id: p.id, slug: p.slug, title: p.title, type: p.type, location: `${p.city}, ${p.region}`, price: p.pricePerNightMinor / 100,
  rating: p.ratingAvg, reviewCount: p.reviewCount, beds: p.bedrooms, baths: p.bathrooms, maxGuests: p.maxGuests,
  image: p.coverImageUrl, description: p.description, lat: p.lat, lng: p.lng, management: p.management ?? 'self',
})

export interface HostListing extends PropertySummary { status: ListingStatus; rejectionReason: string | null }
export interface AdminListing extends HostListing { featuredRank: number | null; hostName: string; hostEmail: string; createdAt: string }

const ref = (id: number) => col(C.properties).doc(String(id))

/** Every date from checkIn up to (not including) checkOut. */
export function datesIn(checkIn: string, checkOut: string) {
  const out: string[] = []
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) out.push(d)
  return out
}

const SORTS: Record<string, (a: PropertyDoc, b: PropertyDoc) => number> = {
  recommended: (a, b) => a.id - b.id,
  price_asc: (a, b) => a.pricePerNightMinor - b.pricePerNightMinor || a.id - b.id,
  price_desc: (a, b) => b.pricePerNightMinor - a.pricePerNightMinor || a.id - b.id,
  rating: (a, b) => b.ratingAvg - a.ratingAvg || b.reviewCount - a.reviewCount,
}

type Filters = Required<Pick<SearchQuery, 'limit'>> & Omit<SearchQuery, 'limit'>

export const propertiesRepo = {
  async get(id: number, tx?: Transaction) {
    const snap = tx ? await tx.get(ref(id)) : await ref(id).get()
    return snap.exists ? (snap.data() as PropertyDoc) : null
  },

  ref,

  /** True when no night in [checkIn, checkOut) is booked, blocked or held by an unexpired payment or request. */
  async isFree(id: number, checkIn: string, checkOut: string) {
    const snap = await nightsOf(id).where('__name__', '>=', checkIn).where('__name__', '<', checkOut).get()
    const now = nowISO()
    return snap.docs.every((d) => { const h = d.data().holdUntil as string | null | undefined; return !!h && h < now })
  },

  /** Live listings matching the filters; with dates, only stays free for the whole range. */
  async search(f: Filters): Promise<PropertySummary[]> {
    let rows = await all<PropertyDoc>(col(C.properties).where('status', '==', 'Approved'))
    const where = f.where?.toLowerCase()
    rows = rows.filter((p) =>
      (!where || `${p.title} ${p.city}, ${p.region}, ${p.country}`.toLowerCase().includes(where)) &&
      (!f.type || p.type === f.type) &&
      (!f.guests || p.maxGuests >= f.guests) &&
      (f.minPrice == null || p.pricePerNightMinor >= f.minPrice * 100) &&
      (f.maxPrice == null || p.pricePerNightMinor <= f.maxPrice * 100) &&
      (!f.featured || p.featuredRank != null))
    if (f.checkIn && f.checkOut) {
      const free = await Promise.all(rows.map((p) => this.isFree(p.id, f.checkIn!, f.checkOut!)))
      rows = rows.filter((_, i) => free[i])
    }
    rows.sort(f.featured ? (a, b) => a.featuredRank! - b.featuredRank! || a.id - b.id : SORTS[f.sort ?? 'recommended'] ?? SORTS.recommended)
    return rows.slice(0, f.limit).map(toPropertySummary)
  },

  async locations() {
    const rows = await all<PropertyDoc>(col(C.properties).where('status', '==', 'Approved'))
    return [...new Set(rows.map((p) => `${p.city}, ${p.region}`))].sort()
  },

  async findBySlug(slug: string) {
    const snap = await col(C.properties).where('slug', '==', slug).limit(1).get()
    return snap.empty ? null : (snap.docs[0].data() as PropertyDoc)
  },

  async amenitiesOf(p: PropertyDoc): Promise<Amenity[]> {
    const icons = await amenitiesRepo.iconMap()
    return p.amenities.filter((n) => icons.has(n)).map((name) => ({ name, icon: icons.get(name)! }))
  },

  /** Future booked or blocked ranges, for calendars. */
  async unavailableRanges(id: number, today: string): Promise<DateRange[]> {
    const [bookings, blocks] = await Promise.all([
      all<{ checkIn: string; checkOut: string; status: string; expiresAt?: string | null }>(col(C.bookings).where('propertyId', '==', id)),
      all<{ checkIn: string; checkOut: string }>(col(C.blocks).where('propertyId', '==', id)),
    ])
    const now = nowISO()
    const holds = (b: { status: string; expiresAt?: string | null }) =>
      b.status === 'Confirmed' || ((b.status === 'Requested' || b.status === 'AwaitingPayment') && !!b.expiresAt && b.expiresAt > now)
    return [...bookings.filter(holds), ...blocks]
      .filter((r) => r.checkOut > today)
      .map(({ checkIn, checkOut }) => ({ checkIn, checkOut }))
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
  },

  /** Adds (+1) or removes (-1) one review's rating from the running average, inside a transaction. */
  adjustRating(tx: Transaction, p: PropertyDoc, rating: number, direction: 1 | -1) {
    const count = p.reviewCount + direction
    const avg = count <= 0 ? 0 : Math.round(((p.ratingAvg * p.reviewCount + direction * rating) / count) * 100) / 100
    tx.update(ref(p.id), { ratingAvg: avg, reviewCount: Math.max(count, 0) })
  },

  // ── Host side ──────────────────────────────────────────────────────────────

  async listForHost(hostId: number): Promise<HostListing[]> {
    const rows = await all<PropertyDoc>(col(C.properties).where('hostId', '==', hostId))
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => ({ ...toPropertySummary(p), status: p.status, rejectionReason: p.rejectionReason }))
  },

  async ownedBy(id: number, hostId: number) {
    const p = await this.get(id)
    return p && p.hostId === hostId ? p : null
  },

  toEditor(p: PropertyDoc) {
    return {
      id: p.id, slug: p.slug, status: p.status, rejectionReason: p.rejectionReason, title: p.title, type: p.type,
      description: p.description, city: p.city, region: p.region, country: p.country, price: p.pricePerNightMinor / 100,
      beds: p.bedrooms, baths: p.bathrooms, maxGuests: p.maxGuests, lat: p.lat, lng: p.lng, coverImage: p.coverImageUrl,
      photos: p.photos, amenities: p.amenities, management: p.management ?? 'self',
    }
  },

  /** A free address based on `base`, e.g. "misty-cottage" or "misty-cottage-2". */
  async uniqueSlug(base: string) {
    const rows = await all<{ slug: string }>(col(C.properties).select('slug'))
    const taken = new Set(rows.map((r) => r.slug))
    if (!taken.has(base)) return base
    let n = 2
    while (taken.has(`${base}-${n}`)) n++
    return `${base}-${n}`
  },

  async insert(hostId: number, slug: string, input: ListingInput): Promise<number> {
    return firestore.runTransaction(async (tx) => {
      const id = await nextId('properties', tx)
      const now = nowISO()
      const doc: PropertyDoc = {
        id, slug, hostId, title: input.title, type: input.type, description: input.description, city: input.city, region: input.region,
        country: input.country, lat: input.lat, lng: input.lng, currency: 'INR', pricePerNightMinor: Math.round(input.price * 100),
        bedrooms: input.beds, bathrooms: input.baths, maxGuests: input.maxGuests, status: 'Pending', rejectionReason: null,
        coverImageUrl: input.coverImage, photos: input.photos, amenities: input.amenities, ratingAvg: 0, reviewCount: 0,
        featuredRank: null, management: 'self', approvedAt: null, createdAt: now, updatedAt: now,
      }
      tx.set(ref(id), doc)
      return id
    })
  },

  /** Saves a host's edits and sends the listing back for review. */
  async update(id: number, input: ListingInput) {
    await ref(id).update({
      title: input.title, type: input.type, description: input.description, city: input.city, region: input.region,
      country: input.country, lat: input.lat, lng: input.lng, pricePerNightMinor: Math.round(input.price * 100),
      bedrooms: input.beds, bathrooms: input.baths, maxGuests: input.maxGuests, coverImageUrl: input.coverImage,
      photos: input.photos, amenities: input.amenities, status: 'Pending', rejectionReason: null, approvedAt: null,
      featuredRank: null, updatedAt: nowISO(),
    })
  },

  setFields(id: number, patch: Partial<PropertyDoc>) {
    return ref(id).update({ ...patch, updatedAt: nowISO() })
  },

  // ── Admin side ─────────────────────────────────────────────────────────────

  async listForAdmin(filters: { status?: ListingStatus | null; q?: string | null }, hosts: Map<number, { name: string; email: string | null; phone: string | null }>): Promise<AdminListing[]> {
    let rows = await all<PropertyDoc>(filters.status ? col(C.properties).where('status', '==', filters.status) : col(C.properties))
    const q = filters.q?.toLowerCase()
    if (q) rows = rows.filter((p) => [p.title, p.city, hosts.get(p.hostId)?.name, hosts.get(p.hostId)?.email].some((v) => v?.toLowerCase().includes(q)))
    rows.sort((a, b) => Number(b.status === 'Pending') - Number(a.status === 'Pending') || b.createdAt.localeCompare(a.createdAt))
    return rows.map((p) => ({
      ...toPropertySummary(p), status: p.status, rejectionReason: p.rejectionReason, featuredRank: p.featuredRank,
      hostName: hosts.get(p.hostId)?.name ?? 'Unknown', hostEmail: hosts.get(p.hostId)?.email ?? hosts.get(p.hostId)?.phone ?? '',
      createdAt: p.createdAt,
    }))
  },

  datesIn,
}
