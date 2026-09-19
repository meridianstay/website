import { daysBetween, defaultDayUse, defaultHouseRules, HOUSE_RULES, isISODate, isTime, minutesOf, todayISO, type HouseRules, type ListingInput, type Me, type PropertyType } from '@meridian/shared'
import { availabilityRepo, BlockConflictError, bookingsRepo, propertiesRepo, usersRepo } from '../repositories'
import { AppError, notFound } from '../http/errors'
import { checkLength, collect, str } from '../http/validate'

// Host listing rules: validation, review on every change, availability blocks.

export const PROPERTY_TYPES: PropertyType[] = ['Farmstay', 'Room', 'Resort', 'Cottage', 'Villa']
const MAX_BLOCK_NIGHTS = 120

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'stay'
const isUrl = (s: string) => /^https?:\/\/\S+$/.test(s)

const optionalInt = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))

function parseRules(v: unknown): HouseRules {
  const r = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const rules = { ...defaultHouseRules }
  for (const { key } of HOUSE_RULES) if (typeof r[key] === 'boolean') rules[key] = r[key] as boolean
  if (typeof r.quietAfter === 'string') rules.quietAfter = r.quietAfter.trim()
  rules.notes = str(r.notes)
  return rules
}

function parseDayUse(v: unknown): ListingInput['dayUse'] {
  const d = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return {
    enabled: d.enabled === true,
    blockHours: Number(d.blockHours ?? defaultDayUse.blockHours), price: Number(d.price ?? defaultDayUse.price),
    extraHourPrice: Number(d.extraHourPrice ?? defaultDayUse.extraHourPrice),
    opensAt: str(d.opensAt) || defaultDayUse.opensAt, closesAt: str(d.closesAt) || defaultDayUse.closesAt,
  }
}

/** Cleans and validates a listing from the request body. */
export function parseListing(body: Record<string, unknown>): ListingInput {
  const input: ListingInput = {
    title: str(body.title), type: str(body.type) as PropertyType, description: str(body.description),
    city: str(body.city), region: str(body.region), country: str(body.country) || 'India',
    price: Number(body.price), beds: Number(body.beds), baths: Number(body.baths), maxGuests: Number(body.maxGuests),
    lat: Number(body.lat), lng: Number(body.lng), coverImage: str(body.coverImage),
    photos: Array.isArray(body.photos) ? body.photos.map(str).filter(Boolean).slice(0, 12) : [],
    amenities: Array.isArray(body.amenities) ? body.amenities.map(str).filter(Boolean) : [],
    areaSqft: optionalInt(body.areaSqft), gatheringCapacity: optionalInt(body.gatheringCapacity),
    checkInTime: str(body.checkInTime) || '14:00', checkOutTime: str(body.checkOutTime) || '11:00',
    houseRules: parseRules(body.houseRules), securityDeposit: Number(body.securityDeposit ?? 0), address: str(body.address),
    overnight: body.overnight !== false,
    dayUse: parseDayUse(body.dayUse),
  }
  const whole = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max
  collect({
    title: checkLength(input.title, 'Title', 3, 120),
    type: PROPERTY_TYPES.includes(input.type) ? null : 'Choose a property type.',
    description: checkLength(input.description, 'Description', 20, 4000),
    city: checkLength(input.city, 'City or town', 2, 80),
    region: checkLength(input.region, 'State or region', 2, 80),
    price: !input.overnight || (Number.isFinite(input.price) && input.price >= 1 && input.price <= 100000) ? null : 'Enter a nightly price between 1 and 100,000.',
    beds: whole(input.beds, 0, 50) ? null : 'Enter the number of bedrooms.',
    baths: whole(input.baths, 0, 50) ? null : 'Enter the number of bathrooms.',
    maxGuests: whole(input.maxGuests, 1, 50) ? null : 'Enter how many guests can stay.',
    location: Number.isFinite(input.lat) && Number.isFinite(input.lng) && Math.abs(input.lat) <= 90 && Math.abs(input.lng) <= 180
      ? null : 'Drop a pin on the map to set the location.',
    coverImage: isUrl(input.coverImage) ? null : 'Add a cover photo.',
    photos: input.photos.every(isUrl) ? null : 'Every photo must be an uploaded photo or a link starting with https://',
    areaSqft: input.areaSqft === null || whole(input.areaSqft, 50, 1_000_000) ? null : 'Enter the area in square feet, or leave it empty.',
    gatheringCapacity: input.gatheringCapacity === null || whole(input.gatheringCapacity, 1, 5000) ? null : 'Enter how many people can gather, or leave it empty.',
    checkInTime: isTime(input.checkInTime) ? null : 'Choose a check-in time.',
    checkOutTime: isTime(input.checkOutTime) ? null : 'Choose a check-out time.',
    securityDeposit: Number.isFinite(input.securityDeposit) && input.securityDeposit >= 0 && input.securityDeposit <= 500000 ? null : 'Enter a deposit between ₹0 and ₹5,00,000.',
    address: input.address.length > 300 ? 'Keep the address under 300 characters.' : null,
    houseRulesNotes: input.houseRules.notes.length > 1000 ? 'Keep the extra rules under 1,000 characters.' : null,
    quietAfter: !input.houseRules.quietAfter || isTime(input.houseRules.quietAfter) ? null : 'Choose a time for quiet hours, or leave it empty.',
    overnight: input.overnight || input.dayUse.enabled ? null : 'Offer overnight stays, day use, or both.',
    dayUsePrice: !input.dayUse.enabled || (Number.isFinite(input.dayUse.price) && input.dayUse.price >= 1 && input.dayUse.price <= 500000) ? null : 'Enter a day-use price between ₹1 and ₹5,00,000.',
    dayUseExtra: !input.dayUse.enabled || (Number.isFinite(input.dayUse.extraHourPrice) && input.dayUse.extraHourPrice >= 0 && input.dayUse.extraHourPrice <= 100000) ? null : 'Enter a price for each extra hour (₹0 if not offered).',
    dayUseBlock: !input.dayUse.enabled || whole(input.dayUse.blockHours, 2, 16) ? null : 'The day-use block must be 2 to 16 hours.',
    dayUseHours: !input.dayUse.enabled || (isTime(input.dayUse.opensAt) && isTime(input.dayUse.closesAt) && minutesOf(input.dayUse.closesAt) - minutesOf(input.dayUse.opensAt) >= input.dayUse.blockHours * 60)
      ? null : 'Opening hours must be at least as long as the day-use block.',
  })
  // A day-use-only listing has no nightly price.
  if (!input.overnight && !(input.price >= 1)) input.price = 0
  return input
}

async function requireOwn(host: Me, id: number) {
  const listing = await propertiesRepo.ownedBy(id, host.id)
  if (!listing) throw notFound('listing')
  return listing
}

export const listingService = {
  /** New listings wait for review. A guest's first listing makes them a host. */
  async create(host: Me, uid: string, input: ListingInput) {
    const id = await propertiesRepo.insert(host.id, await propertiesRepo.uniqueSlug(slugify(input.title)), input)
    if (host.role === 'guest') await usersRepo.update(uid, { role: 'host' })
    return id
  },

  /** Any edit sends the listing back for review, so changes can't skip moderation. */
  async update(host: Me, id: number, input: ListingInput) {
    await requireOwn(host, id)
    await propertiesRepo.update(id, input)
  },

  async getForEditing(host: Me, id: number) {
    return propertiesRepo.toEditor(await requireOwn(host, id))
  },

  async pause(host: Me, id: number) {
    const p = await requireOwn(host, id)
    if (p.status !== 'Approved' && p.status !== 'Pending') throw new AppError(400, 'Only live or pending listings can be paused.')
    await propertiesRepo.setFields(id, { status: 'Draft', featuredRank: null })
  },

  async relist(host: Me, id: number) {
    const p = await requireOwn(host, id)
    if (p.status !== 'Draft' && p.status !== 'Rejected') throw new AppError(400, 'Only paused or rejected listings can be sent for review.')
    await propertiesRepo.setFields(id, { status: 'Pending', rejectionReason: null })
  },

  async calendar(host: Me, id: number) {
    const listing = await requireOwn(host, id)
    const today = todayISO()
    const [blocks, bookings] = await Promise.all([availabilityRepo.upcomingBlocks(listing.id, today), bookingsRepo.forProperty(listing.id)])
    return {
      blocks,
      bookings: bookings.filter((b) => (b.status === 'Confirmed' || b.status === 'Requested') && b.checkOut > today).sort((a, b) => a.checkIn.localeCompare(b.checkIn))
        .map((b) => ({ code: b.code, checkIn: b.checkIn, checkOut: b.checkOut, guestName: b.guest.name, requested: b.status === 'Requested', startTime: b.startTime, endTime: b.endTime })),
    }
  },

  /** Hosts can close nights, but not nights guests have already booked. */
  async addBlock(host: Me, id: number, input: { checkIn: string; checkOut: string; note: string }) {
    const listing = await requireOwn(host, id)
    const { checkIn, checkOut } = input
    collect({
      checkIn: isISODate(checkIn) && checkIn >= todayISO() ? null : 'Choose a start date from today onwards.',
      checkOut: isISODate(checkOut) && checkOut > checkIn
        ? daysBetween(checkIn, checkOut) > MAX_BLOCK_NIGHTS ? `Block at most ${MAX_BLOCK_NIGHTS} nights at a time.` : null
        : 'The end date must be after the start date.',
    })
    try {
      await availabilityRepo.addBlock(listing.id, checkIn, checkOut, input.note.slice(0, 200) || null)
    } catch (err) {
      if (err instanceof BlockConflictError) {
        throw new AppError(409, err.reason === 'booked'
          ? 'Guests have already booked some of those nights. Block other dates, or contact the guest.'
          : 'Those dates overlap a block you’ve already added.')
      }
      throw err
    }
  },

  async removeBlock(host: Me, id: number, blockId: number) {
    const listing = await requireOwn(host, id)
    await availabilityRepo.removeBlock(blockId, listing.id)
  },
}
