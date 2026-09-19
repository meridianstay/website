import { isISODate, todayISO, type Me, type PropertyType } from '@meridian/shared'
import type { ListingInput } from '@meridian/shared'
import { transaction } from '../db/pool'
import { availabilityRepo, bookingsRepo, propertiesRepo, usersRepo } from '../repositories'
import { AppError, notFound } from '../http/errors'
import { checkLength, collect, isPgError, PG_EXCLUSION_VIOLATION, str } from '../http/validate'

// Host listing rules: validation, review on every change, availability blocks.

export const PROPERTY_TYPES: PropertyType[] = ['Farmstay', 'Room', 'Resort', 'Cottage', 'Villa']

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'stay'
const isUrl = (s: string) => /^https?:\/\/\S+$/.test(s)

/** Cleans and validates a listing from the request body. */
export function parseListing(body: Record<string, unknown>): ListingInput {
  const input: ListingInput = {
    title: str(body.title), type: str(body.type) as PropertyType, description: str(body.description),
    city: str(body.city), region: str(body.region), country: str(body.country) || 'India',
    price: Number(body.price), beds: Number(body.beds), baths: Number(body.baths), maxGuests: Number(body.maxGuests),
    lat: Number(body.lat), lng: Number(body.lng), coverImage: str(body.coverImage),
    photos: Array.isArray(body.photos) ? body.photos.map(str).filter(Boolean).slice(0, 12) : [],
    amenities: Array.isArray(body.amenities) ? body.amenities.map(str).filter(Boolean) : [],
  }
  const whole = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max
  collect({
    title: checkLength(input.title, 'Title', 3, 120),
    type: PROPERTY_TYPES.includes(input.type) ? null : 'Choose a property type.',
    description: checkLength(input.description, 'Description', 20, 4000),
    city: checkLength(input.city, 'City or town', 2, 80),
    region: checkLength(input.region, 'State or region', 2, 80),
    price: Number.isFinite(input.price) && input.price >= 1 && input.price <= 100000 ? null : 'Enter a nightly price between 1 and 100,000.',
    beds: whole(input.beds, 0, 50) ? null : 'Enter the number of bedrooms.',
    baths: whole(input.baths, 0, 50) ? null : 'Enter the number of bathrooms.',
    maxGuests: whole(input.maxGuests, 1, 50) ? null : 'Enter how many guests can stay.',
    location: Number.isFinite(input.lat) && Number.isFinite(input.lng) && Math.abs(input.lat) <= 90 && Math.abs(input.lng) <= 180
      ? null : 'Drop a pin on the map to set the location.',
    coverImage: isUrl(input.coverImage) ? null : 'Add a cover photo link starting with https://',
    photos: input.photos.every(isUrl) ? null : 'Every photo link must start with https://',
  })
  return input
}

async function requireOwn(host: Me, id: number) {
  const listing = await propertiesRepo.ownedBy(id, host.id)
  if (!listing) throw notFound('listing')
  return listing
}

export const listingService = {
  /** New listings wait for review. A guest's first listing makes them a host. */
  create(host: Me, input: ListingInput) {
    return transaction(async (db) => {
      const slug = await propertiesRepo.uniqueSlug(slugify(input.title), db)
      const id = await propertiesRepo.insert(host.id, slug, input, db)
      await propertiesRepo.replacePhotos(id, input.photos, db)
      await propertiesRepo.replaceAmenities(id, input.amenities, db)
      await usersRepo.promoteGuestToHost(host.id, db)
      return id
    })
  },

  /** Any edit sends the listing back for review, so changes can't skip moderation. */
  async update(host: Me, id: number, input: ListingInput) {
    const ok = await transaction(async (db) => {
      if (!(await propertiesRepo.update(id, host.id, input, db))) return false
      await propertiesRepo.replacePhotos(id, input.photos, db)
      await propertiesRepo.replaceAmenities(id, input.amenities, db)
      return true
    })
    if (!ok) throw notFound('listing')
  },

  async getForEditing(host: Me, id: number) {
    const listing = await propertiesRepo.findForEditing(id, host.id)
    if (!listing) throw notFound('listing')
    return listing
  },

  async pause(host: Me, id: number) {
    if (!(await propertiesRepo.pause(id, host.id))) throw new AppError(400, 'Only live or pending listings can be paused.')
  },

  async relist(host: Me, id: number) {
    if (!(await propertiesRepo.relist(id, host.id))) throw new AppError(400, 'Only paused or rejected listings can be sent for review.')
  },

  async calendar(host: Me, id: number) {
    const listing = await requireOwn(host, id)
    const today = todayISO()
    const [blocks, bookings] = await Promise.all([
      availabilityRepo.upcomingBlocks(listing.id, today),
      bookingsRepo.upcomingForProperty(listing.id, today),
    ])
    return { blocks, bookings: bookings.map((b) => ({ code: b.code, checkIn: b.check_in, checkOut: b.check_out, guestName: b.guest_name })) }
  },

  /** Hosts can close nights, but not nights guests have already booked. */
  async addBlock(host: Me, id: number, input: { checkIn: string; checkOut: string; note: string }) {
    const listing = await requireOwn(host, id)
    const { checkIn, checkOut } = input
    collect({
      checkIn: isISODate(checkIn) && checkIn >= todayISO() ? null : 'Choose a start date from today onwards.',
      checkOut: isISODate(checkOut) && checkOut > checkIn ? null : 'The end date must be after the start date.',
    })
    try {
      await transaction(async (db) => {
        await propertiesRepo.lock(listing.id, db)
        if (await bookingsRepo.overlapsConfirmed(listing.id, checkIn, checkOut, db)) {
          throw new AppError(409, 'Guests have already booked some of those nights. Block other dates, or contact the guest.')
        }
        await availabilityRepo.insertBlock(listing.id, checkIn, checkOut, input.note.slice(0, 200) || null, db)
      })
    } catch (err) {
      if (isPgError(err, PG_EXCLUSION_VIOLATION)) throw new AppError(409, 'Those dates overlap a block you’ve already added.')
      throw err
    }
  },

  async removeBlock(host: Me, id: number, blockId: number) {
    const listing = await requireOwn(host, id)
    await availabilityRepo.deleteBlock(blockId, listing.id)
  },
}
