import { addDays, quoteStay, todayISO, type Me, type UserRole } from '@meridian/shared'
import type { ListingInput } from '@meridian/shared'
import { pool, query, queryOne, transaction } from '../db/pool'
import { migrate } from '../db/migrate'
import { contentRepo, bookingsRepo, usersRepo } from '../repositories'
import { hashPassword } from '../lib/passwords'
import { newBookingCode } from '../lib/bookingCode'
import { listingService } from '../services/listings'
import { AppError } from '../http/errors'

// Tests run against a throwaway database. Refuse anything that doesn't look like one.
if (!/_test(\?|$)/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('Tests need DATABASE_URL pointing at a database whose name ends in _test (run `npm test`).')
}

export const today = todayISO()
export const day = (offset: number) => addDays(today, offset)

/** Empties the test database and rebuilds the schema from the migrations. */
export async function resetDatabase() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  await migrate(() => {})
  await contentRepo.ensureDefaults()
  await query(`INSERT INTO amenities (name, icon) VALUES ('Wifi', 'wifi'), ('Garden', 'seedling')`)
}

let userCount = 0
export async function createUser(role: UserRole = 'guest', password = 'password123'): Promise<Me> {
  userCount++
  const row = await queryOne<{ id: number }>(
    'INSERT INTO users (name, email, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id',
    [`Test User${userCount}`, `user${userCount}@example.test`, role, hashPassword(password)],
  )
  return (await usersRepo.findById(row!.id))!
}

export const listingInput = (overrides: Partial<ListingInput> = {}): ListingInput => ({
  title: 'Test Cottage', type: 'Cottage', description: 'A quiet test cottage with a garden view.', city: 'Coorg', region: 'Karnataka',
  country: 'India', price: 100, beds: 1, baths: 1, maxGuests: 2, lat: 12.4, lng: 75.7,
  coverImage: 'https://example.com/cover.jpg', photos: [], amenities: ['Wifi'], ...overrides,
})

/** A live listing owned by `host`. */
export async function createLiveListing(host: Me, overrides: Partial<ListingInput> = {}) {
  const id = await listingService.create(host, listingInput(overrides))
  await query(`UPDATE properties SET status = 'Approved' WHERE id = $1`, [id])
  return id
}

/** Inserts a booking directly (e.g. one in the past, which the booking service would refuse). */
export async function insertBooking(propertyId: number, guestId: number, checkIn: string, checkOut: string, price = 100) {
  const code = newBookingCode()
  const q = quoteStay(price, checkIn, checkOut, 2)
  await transaction((db) =>
    bookingsRepo.insert({
      code, propertyId, guestId, checkIn, checkOut, nights: q.nights, guests: 2, currency: 'USD', pricePerNightMinor: price * 100,
      baseMinor: q.baseAmount * 100, extraGuestMinor: 0, serviceFeeMinor: q.serviceFee * 100, totalMinor: q.total * 100,
      paymentMethod: 'upi', contactPhone: '+91 90000 00000', specialRequests: null,
    }, db),
  )
  return code
}

/** Runs fn and returns the AppError it throws (fails if it doesn't throw one). */
export async function appError(fn: () => Promise<unknown>): Promise<AppError> {
  try {
    await fn()
  } catch (err) {
    if (err instanceof AppError) return err
    throw err
  }
  throw new Error('Expected an AppError, but nothing was thrown')
}
