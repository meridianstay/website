import { addDays, commissionMinor, defaultDayUse, defaultHouseRules, publicTitle, quoteStay, todayISO, type ListingInput, type Management, type Me, type UserRole } from '@meridian/shared'
import { col, nextId, nowISO, C } from '../store/db'
import { projectId } from '../store/firebase'
import { bookingsRepo, contentRepo, propertiesRepo, toMe, usersRepo, type UserDoc } from '../repositories'
import { listingService } from '../services/listings'
import { newBookingCode } from '../services/bookings'
import { AppError } from '../http/errors'

// Tests run against their own Firebase emulators (see firebase.test.json and `npm test`).
if (!projectId.endsWith('-test') || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run tests with `npm test`, which starts separate test emulators. Refusing to touch another project.')
}

export const today = todayISO()
export const day = (offset: number) => addDays(today, offset)

/** Wipes the test emulators and adds the default site content. */
export async function resetDatabase() {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' })
  await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${projectId}/accounts`, { method: 'DELETE' })
  await contentRepo.ensureDefaults()
  await col(C.amenities).doc('Wifi').set({ name: 'Wifi', icon: 'wifi', order: 0 })
  await col(C.amenities).doc('Garden').set({ name: 'Garden', icon: 'seedling', order: 1 })
}

export interface TestUser { me: Me; uid: string; doc: UserDoc }

export async function createUser(role: UserRole = 'guest'): Promise<TestUser> {
  const id = await nextId('users')
  const doc: UserDoc = {
    id, uid: `test-${id}`, name: `Test User${id}`, email: `user${id}@example.test`, phone: null, role, avatarUrl: null,
    createdAt: nowISO(), suspendedAt: null, sessionsRevokedAt: null,
  }
  await col(C.users).doc(doc.uid).set(doc)
  return { me: toMe(doc), uid: doc.uid, doc }
}

export const listingInput = (overrides: Partial<ListingInput> = {}): ListingInput => ({
  title: 'Test Cottage', type: 'Cottage', description: 'A quiet test cottage with a garden view.', city: 'Coorg', region: 'Karnataka',
  country: 'India', price: 100, beds: 1, baths: 1, maxGuests: 2, lat: 12.4, lng: 75.7,
  coverImage: 'https://example.com/cover.jpg', photos: [], amenities: ['Wifi'], areaSqft: null, gatheringCapacity: null,
  checkInTime: '14:00', checkOutTime: '11:00', houseRules: { ...defaultHouseRules }, securityDeposit: 0, address: '12 Test Road, Coorg',
  overnight: true, dayUse: { ...defaultDayUse }, discountPct: 0, videoUrl: '', ...overrides,
})

/** A live listing owned by `host`: self-managed (request to book) unless `management` is 'managed' (instant). */
export async function createLiveListing(host: TestUser, overrides: Partial<ListingInput> = {}, management: Management = 'managed') {
  const id = await listingService.create(host.me, host.uid, listingInput(overrides))
  await propertiesRepo.setFields(id, { status: 'Approved', management, approvedAt: nowISO() })
  return id
}

/** The name guests see for a listing: its real name stays private until they book and pay. */
export const shownTitle = async (id: number) => publicTitle((await propertiesRepo.get(id))!)

/** Writes a booking directly (e.g. one in the past, which the booking service would refuse). */
export async function insertBooking(propertyId: number, guest: TestUser, checkIn: string, checkOut: string) {
  const property = (await propertiesRepo.get(propertyId))!
  const q = quoteStay(property.pricePerNightMinor / 100, checkIn, checkOut, 2)
  const code = newBookingCode()
  await bookingsRepo.create({
    code, propertyId, guestId: guest.me.id, checkIn, checkOut, nights: q.nights, guests: 2, currency: 'INR',
    pricePerNightMinor: property.pricePerNightMinor, baseMinor: q.baseAmount * 100, extraGuestMinor: 0, serviceFeeMinor: 0,
    totalMinor: q.total * 100, commissionPct: 30, commissionMinor: commissionMinor(q.total * 100, 30), hostPayoutMinor: q.total * 100 - commissionMinor(q.total * 100, 30),
    paymentMethod: 'upi', contactPhone: '+91 90000 00000', specialRequests: null, status: 'Confirmed', paymentStatus: 'test', expiresAt: null,
    kind: 'stay', startTime: null, endTime: null, hours: null, guestBreakdown: { adults: 2, children: 0, infants: 0, pets: 0 },
    securityDepositMinor: 0, checkInTime: '14:00', checkOutTime: '11:00', couponCode: null, discountMinor: 0, cancellationFeePct: 30,
  }, property, (await usersRepo.findByUid(guest.uid))!, await usersRepo.findById(property.hostId))
  return code
}

/** Signs in a phone number through the Auth emulator's OTP flow and returns a Firebase ID token. */
export async function phoneIdToken(phoneNumber: string) {
  const base = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`
  const post = async (path: string, body: object) =>
    (await (await fetch(`${base}/identitytoolkit.googleapis.com/v1/${path}?key=test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json()) as Record<string, string>
  const { sessionInfo } = await post('accounts:sendVerificationCode', { phoneNumber, recaptchaToken: 'test' })
  const codes = (await (await fetch(`${base}/emulator/v1/projects/${projectId}/verificationCodes`)).json()) as { verificationCodes: { sessionInfo: string; code: string }[] }
  const code = codes.verificationCodes.find((c) => c.sessionInfo === sessionInfo)!.code
  const { idToken } = await post('accounts:signInWithPhoneNumber', { sessionInfo, code })
  return idToken as string
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
