import { addDays, defaultDayUse, defaultHouseRules, discountedPrice, distanceKm, parsePropertyCode, placeSlug, type Destination, type Amenity, type HouseRules, type Management, type DateRange, type ListingInput, type ListingStatus, type PropertySummary, type PropertyType, type SearchQuery } from '@meridian/shared'
import type { Transaction } from 'firebase-admin/firestore'
import { C, all, col, daysOf, firestore, nextId, nightsOf, nowISO } from '../store/db'
import { busyPeriods, type DaySlot, type NightLock } from './schedule'
import { amenitiesRepo } from './amenities'

// Collection: properties/{id}, with properties/{id}/nights/{date} marking each booked or blocked night.

export interface PropertyDoc {
  id: number; slug: string; hostId: number; title: string; type: PropertyType; description: string
  city: string; region: string; country: string; lat: number; lng: number; currency: string
  pricePerNightMinor: number; bedrooms: number; bathrooms: number; maxGuests: number
  status: ListingStatus; rejectionReason: string | null; coverImageUrl: string; photos: string[]; videoUrl: string; amenities: string[]
  ratingAvg: number; reviewCount: number; featuredRank: number | null
  /** managed: run by Meridian, instant booking. self: host-managed, request to book. Set by admins. */
  management: Management
  areaSqft: number | null; gatheringCapacity: number | null; checkInTime: string; checkOutTime: string
  houseRules: HouseRules; securityDepositMinor: number
  /** Exact address; only shown to guests with a confirmed booking. */
  address: string
  /** Offers overnight stays at pricePerNightMinor. */
  overnight: boolean
  /** "Meridian Assured": inspected and verified by the team. Set by admins. */
  assured: boolean
  /** Host discount in percent (0–70), applied to nightly and day-use prices. */
  discountPct: number
  dayUse: { enabled: boolean; blockHours: number; priceMinor: number; extraHourMinor: number; opensAt: string; closesAt: string }
  approvedAt: string | null; createdAt: string; updatedAt: string
}

/** Fills fields added after a listing was stored (older listings), so every reader sees a complete document. */
export function withPropDefaults(p: PropertyDoc): PropertyDoc {
  return {
    ...p,
    management: p.management ?? 'self', areaSqft: p.areaSqft ?? null, gatheringCapacity: p.gatheringCapacity ?? null,
    checkInTime: p.checkInTime ?? '14:00', checkOutTime: p.checkOutTime ?? '11:00',
    houseRules: { ...defaultHouseRules, ...p.houseRules }, securityDepositMinor: p.securityDepositMinor ?? 0, address: p.address ?? '',
    overnight: p.overnight ?? true, assured: p.assured ?? false, discountPct: p.discountPct ?? 0, videoUrl: p.videoUrl ?? '',
    dayUse: p.dayUse ?? { enabled: false, blockHours: defaultDayUse.blockHours, priceMinor: defaultDayUse.price * 100, extraHourMinor: defaultDayUse.extraHourPrice * 100, opensAt: defaultDayUse.opensAt, closesAt: defaultDayUse.closesAt },
  }
}

const readProps = async (q: FirebaseFirestore.Query): Promise<PropertyDoc[]> => (await all<PropertyDoc>(q)).map(withPropDefaults)

/** Public map positions are rounded to about 1 km; the exact address is shared once a booking is confirmed. */
const approx = (n: number) => Math.round(n * 100) / 100

/** Money leaves the data layer in major units (rupees); documents store minor units (paise). */
export const toPropertySummary = (p: PropertyDoc): PropertySummary => ({
  id: p.id, slug: p.slug, title: p.title, type: p.type, location: `${p.city}, ${p.region}`, price: p.pricePerNightMinor / 100,
  rating: p.ratingAvg, reviewCount: p.reviewCount, beds: p.bedrooms, baths: p.bathrooms, maxGuests: p.maxGuests,
  image: p.coverImageUrl, description: p.description, lat: approx(p.lat), lng: approx(p.lng), management: p.management ?? 'self',
  overnight: p.overnight ?? true,
  dayUse: p.dayUse?.enabled ? { price: discountedPrice(p.dayUse.priceMinor / 100, p.discountPct ?? 0), blockHours: p.dayUse.blockHours } : null,
  assured: p.assured ?? false,
  discountPct: p.discountPct ?? 0,
  priceNow: discountedPrice(p.pricePerNightMinor / 100, p.discountPct ?? 0),
  isNew: !!p.approvedAt && Date.now() - Date.parse(p.approvedAt) < 30 * 86_400_000,
})

export interface HostListing extends PropertySummary { status: ListingStatus; rejectionReason: string | null; promoted: boolean }
export interface AdminListing extends HostListing { featuredRank: number | null; hostName: string; hostEmail: string; createdAt: string }

const ref = (id: number) => col(C.properties).doc(String(id))

/** The newer listing fields, converted for storage (rupees → paise). */
const detailFields = (input: ListingInput) => ({
  discountPct: input.discountPct, areaSqft: input.areaSqft, gatheringCapacity: input.gatheringCapacity, checkInTime: input.checkInTime, checkOutTime: input.checkOutTime,
  houseRules: input.houseRules, securityDepositMinor: Math.round(input.securityDeposit * 100), address: input.address, overnight: input.overnight,
  dayUse: {
    enabled: input.dayUse.enabled, blockHours: input.dayUse.blockHours, priceMinor: Math.round(input.dayUse.price * 100),
    extraHourMinor: Math.round(input.dayUse.extraHourPrice * 100), opensAt: input.dayUse.opensAt, closesAt: input.dayUse.closesAt,
  },
})

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
  newest: (a, b) => (b.approvedAt ?? b.createdAt).localeCompare(a.approvedAt ?? a.createdAt) || b.id - a.id,
}

type Filters = Required<Pick<SearchQuery, 'limit'>> & Omit<SearchQuery, 'limit'>

export const propertiesRepo = {
  async get(id: number, tx?: Transaction) {
    const snap = tx ? await tx.get(ref(id)) : await ref(id).get()
    return snap.exists ? withPropDefaults(snap.data() as PropertyDoc) : null
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
    let rows = await readProps(col(C.properties).where('status', '==', 'Approved'))
    const where = f.where?.toLowerCase()
    // "MS007" finds the listing with that code.
    const codeId = f.where ? parsePropertyCode(f.where) : null
    rows = rows.filter((p) =>
      (codeId !== null ? p.id === codeId : !where || `${p.title} ${p.city}, ${p.region}, ${p.country}`.toLowerCase().includes(where)) &&
      (!f.type || p.type === f.type) &&
      (!f.guests || p.maxGuests >= f.guests) &&
      (f.minPrice == null || discountedPrice(p.pricePerNightMinor, p.discountPct ?? 0) >= f.minPrice * 100) &&
      (f.maxPrice == null || discountedPrice(p.pricePerNightMinor, p.discountPct ?? 0) <= f.maxPrice * 100) &&
      (!f.featured || p.featuredRank != null) &&
      (!f.management || (p.management ?? 'self') === f.management))
    if (f.checkIn && f.checkOut) {
      const free = await Promise.all(rows.map((p) => this.isFree(p.id, f.checkIn!, f.checkOut!)))
      rows = rows.filter((_, i) => free[i])
    }
    const near = f.lat !== undefined && f.lng !== undefined ? { lat: f.lat, lng: f.lng } : null
    rows.sort(f.featured ? (a, b) => a.featuredRank! - b.featuredRank! || a.id - b.id
      : f.sort === 'nearest' && near ? (a, b) => distanceKm(near, a) - distanceKm(near, b)
      : SORTS[f.sort ?? 'recommended'] ?? SORTS.recommended)
    return rows.slice(0, f.limit).map(toPropertySummary)
  },

  /** Towns and states with live stays, most stays first. */
  async destinations(): Promise<Destination[]> {
    const rows = (await readProps(col(C.properties).where('status', '==', 'Approved'))).sort((a, b) => b.ratingAvg - a.ratingAvg)
    const groups = new Map<string, { d: Destination; pts: PropertyDoc[] }>()
    const add = (key: string, make: () => Destination, p: PropertyDoc) => {
      const g = groups.get(key) ?? { d: make(), pts: [] }
      g.pts.push(p)
      groups.set(key, g)
    }
    for (const p of rows) {
      add(`city:${p.city}|${p.region}`, () => ({ slug: placeSlug(p.city), name: p.city, kind: 'city', region: p.region, stays: 0, image: p.coverImageUrl, lat: 0, lng: 0, types: [] }), p)
      add(`state:${p.region}`, () => ({ slug: placeSlug(p.region), name: p.region, kind: 'state', region: null, stays: 0, image: p.coverImageUrl, lat: 0, lng: 0, types: [] }), p)
    }
    const out = [...groups.values()].map(({ d, pts }) => ({
      ...d, stays: pts.length, types: [...new Set(pts.map((p) => p.type))],
      lat: Math.round((pts.reduce((n, p) => n + p.lat, 0) / pts.length) * 100) / 100,
      lng: Math.round((pts.reduce((n, p) => n + p.lng, 0) / pts.length) * 100) / 100,
    }))
    // A city and its state can share a slug (e.g. Goa); keep the state then.
    const seen = new Set<string>()
    return out.sort((a, b) => Number(a.kind === 'city') - Number(b.kind === 'city') || b.stays - a.stays || a.name.localeCompare(b.name))
      .filter((d) => !seen.has(d.slug) && seen.add(d.slug))
      .sort((a, b) => b.stays - a.stays || a.name.localeCompare(b.name))
  },

  async locations() {
    const rows = await readProps(col(C.properties).where('status', '==', 'Approved'))
    return [...new Set(rows.map((p) => `${p.city}, ${p.region}`))].sort()
  },

  async findBySlug(slug: string) {
    const snap = await col(C.properties).where('slug', '==', slug).limit(1).get()
    return snap.empty ? null : withPropDefaults(snap.docs[0].data() as PropertyDoc)
  },

  async amenitiesOf(p: PropertyDoc): Promise<Amenity[]> {
    const icons = await amenitiesRepo.iconMap()
    return p.amenities.filter((n) => icons.has(n)).map((name) => ({ name, icon: icons.get(name)! }))
  },

  /**
   * Future booked or blocked ranges, for the overnight calendar. A day-use booking only closes that
   * night when it runs past the check-in time.
   */
  async unavailableRanges(id: number, today: string, checkInTime = '14:00'): Promise<DateRange[]> {
    const [allBookings, blocks] = await Promise.all([
      all<{ checkIn: string; checkOut: string; status: string; expiresAt?: string | null; kind?: string; endTime?: string | null }>(col(C.bookings).where('propertyId', '==', id)),
      all<{ checkIn: string; checkOut: string }>(col(C.blocks).where('propertyId', '==', id)),
    ])
    const bookings = allBookings.filter((b) => b.kind !== 'dayuse' || (b.endTime ?? '23:59') > checkInTime)
    const now = nowISO()
    const holds = (b: { status: string; expiresAt?: string | null }) =>
      b.status === 'Confirmed' || ((b.status === 'Requested' || b.status === 'AwaitingPayment') && !!b.expiresAt && b.expiresAt > now)
    return [...bookings.filter(holds), ...blocks]
      .filter((r) => r.checkOut > today)
      .map(({ checkIn, checkOut }) => ({ checkIn, checkOut }))
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
  },

  /** Up to 4 live stays to suggest: the same type nearby first, then anything nearby. */
  async similar(p: PropertyDoc): Promise<PropertySummary[]> {
    const rows = (await readProps(col(C.properties).where('status', '==', 'Approved'))).filter((o) => o.id !== p.id)
    const score = (o: PropertyDoc) => distanceKm(p, o) + (o.type === p.type ? 0 : 400)
    return rows.sort((a, b) => score(a) - score(b)).slice(0, 4).map(toPropertySummary)
  },

  /** Busy periods on a date for day use: overnight guests arriving or leaving, and other day-use bookings. */
  async dayBusy(p: PropertyDoc, date: string) {
    const [night, before, day] = await Promise.all([
      nightsOf(p.id).doc(date).get(), nightsOf(p.id).doc(addDays(date, -1)).get(), daysOf(p.id).doc(date).get(),
    ])
    return busyPeriods({
      night: (night.data() as NightLock | undefined) ?? null, nightBefore: (before.data() as NightLock | undefined) ?? null,
      slots: (day.data()?.slots ?? []) as DaySlot[], opensAt: p.dayUse.opensAt, closesAt: p.dayUse.closesAt,
      checkInTime: p.checkInTime, checkOutTime: p.checkOutTime, now: nowISO(),
    })
  },

  /** Adds (+1) or removes (-1) one review's rating from the running average, inside a transaction. */
  adjustRating(tx: Transaction, p: PropertyDoc, rating: number, direction: 1 | -1) {
    const count = p.reviewCount + direction
    const avg = count <= 0 ? 0 : Math.round(((p.ratingAvg * p.reviewCount + direction * rating) / count) * 100) / 100
    tx.update(ref(p.id), { ratingAvg: avg, reviewCount: Math.max(count, 0) })
  },

  // ── Host side ──────────────────────────────────────────────────────────────

  async listForHost(hostId: number, promotedIds = new Set<number>()): Promise<HostListing[]> {
    const rows = await readProps(col(C.properties).where('hostId', '==', hostId))
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => ({ ...toPropertySummary(p), status: p.status, rejectionReason: p.rejectionReason, promoted: promotedIds.has(p.id) }))
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
      photos: p.photos, videoUrl: p.videoUrl ?? '', amenities: p.amenities, management: p.management ?? 'self', discountPct: p.discountPct ?? 0,
      areaSqft: p.areaSqft, gatheringCapacity: p.gatheringCapacity, checkInTime: p.checkInTime, checkOutTime: p.checkOutTime,
      houseRules: p.houseRules, securityDeposit: p.securityDepositMinor / 100, address: p.address, overnight: p.overnight,
      dayUse: { enabled: p.dayUse.enabled, blockHours: p.dayUse.blockHours, price: p.dayUse.priceMinor / 100, extraHourPrice: p.dayUse.extraHourMinor / 100, opensAt: p.dayUse.opensAt, closesAt: p.dayUse.closesAt },
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
        coverImageUrl: input.coverImage, photos: input.photos, videoUrl: input.videoUrl, amenities: input.amenities, ratingAvg: 0, reviewCount: 0,
        featuredRank: null, management: 'self', assured: false, approvedAt: null, createdAt: now, updatedAt: now, ...detailFields(input),
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
      photos: input.photos, videoUrl: input.videoUrl, amenities: input.amenities, status: 'Pending', rejectionReason: null, approvedAt: null,
      featuredRank: null, updatedAt: nowISO(), ...detailFields(input),
    })
  },

  setFields(id: number, patch: Partial<PropertyDoc>) {
    return ref(id).update({ ...patch, updatedAt: nowISO() })
  },

  // ── Admin side ─────────────────────────────────────────────────────────────

  async listForAdmin(filters: { status?: ListingStatus | null; q?: string | null }, hosts: Map<number, { name: string; email: string | null; phone: string | null }>, promotedIds = new Set<number>()): Promise<AdminListing[]> {
    let rows = await readProps(filters.status ? col(C.properties).where('status', '==', filters.status) : col(C.properties))
    const q = filters.q?.toLowerCase()
    if (q) rows = rows.filter((p) => [p.title, p.city, hosts.get(p.hostId)?.name, hosts.get(p.hostId)?.email].some((v) => v?.toLowerCase().includes(q)))
    rows.sort((a, b) => Number(b.status === 'Pending') - Number(a.status === 'Pending') || b.createdAt.localeCompare(a.createdAt))
    return rows.map((p) => ({
      ...toPropertySummary(p), status: p.status, rejectionReason: p.rejectionReason, featuredRank: p.featuredRank, promoted: promotedIds.has(p.id),
      hostName: hosts.get(p.hostId)?.name ?? 'Unknown', hostEmail: hosts.get(p.hostId)?.email ?? hosts.get(p.hostId)?.phone ?? '',
      createdAt: p.createdAt,
    }))
  },

  datesIn,
}
