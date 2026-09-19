import { daysBetween, isISODate, MAX_NIGHTS, quoteStay, todayISO, type BookingDetail, type Me, type PaymentMethod } from '@meridian/shared'
import { randomInt } from 'node:crypto'
import { bookingsRepo, NightsTakenError, propertiesRepo, toBooking, usersRepo } from '../repositories'
import { AppError, notFound } from '../http/errors'
import { checkPhone, collect } from '../http/validate'

// Booking rules: valid dates, capacity, availability and server-side pricing.

export const PAYMENT_METHODS: PaymentMethod[] = ['upi', 'card', 'netbanking']

// No 0/O or 1/I so codes are easy to read out over the phone.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const newBookingCode = () => `MS-${Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')}`

export interface BookingRequest {
  propertyId: number; checkIn: string; checkOut: string; guests: number
  paymentMethod: string; contactPhone: string; specialRequests: string
}

const datesTaken = () =>
  new AppError(409, 'Some of those nights were just booked. Please choose different dates.', { checkIn: 'Those dates are no longer available.' })

export const bookingService = {
  async create(guest: Me, uid: string, req: BookingRequest): Promise<BookingDetail> {
    const today = todayISO()
    const { checkIn, checkOut, guests, contactPhone, specialRequests } = req
    const datesValid = isISODate(checkIn) && isISODate(checkOut)
    collect({
      checkIn: !datesValid ? 'Choose your check-in and check-out dates.' : checkIn < today ? 'Check-in can’t be in the past.' : null,
      checkOut: datesValid && checkOut <= checkIn ? 'Check-out must be after check-in.'
        : datesValid && daysBetween(checkIn, checkOut) > MAX_NIGHTS ? `Stays can be at most ${MAX_NIGHTS} nights.` : null,
      guests: Number.isInteger(guests) && guests >= 1 ? null : 'Add at least one guest.',
      paymentMethod: PAYMENT_METHODS.includes(req.paymentMethod as PaymentMethod) ? null : 'Choose a payment method.',
      contactPhone: checkPhone(contactPhone),
      specialRequests: specialRequests.length > 500 ? 'Keep special requests under 500 characters.' : null,
    })

    const property = await propertiesRepo.get(req.propertyId)
    if (!property || property.status !== 'Approved') throw new AppError(404, 'This stay isn’t available for booking.')
    if (property.hostId === guest.id) throw new AppError(400, 'You can’t book your own listing.')
    if (guests > property.maxGuests) collect({ guests: `This stay fits up to ${property.maxGuests} guests.` })

    // The browser shows a preview; the price charged is always recalculated here.
    const q = quoteStay(property.pricePerNightMinor / 100, checkIn, checkOut, guests)
    const code = newBookingCode()
    const guestDoc = (await usersRepo.findByUid(uid))!
    try {
      await bookingsRepo.create({
        code, propertyId: property.id, guestId: guest.id, checkIn, checkOut, nights: q.nights, guests, currency: property.currency,
        pricePerNightMinor: property.pricePerNightMinor, baseMinor: Math.round(q.baseAmount * 100),
        extraGuestMinor: Math.round(q.extraGuestAmount * 100), serviceFeeMinor: Math.round(q.serviceFee * 100),
        totalMinor: Math.round(q.total * 100), paymentMethod: req.paymentMethod as PaymentMethod, contactPhone,
        specialRequests: specialRequests || null,
      }, property, guestDoc)
    } catch (err) {
      if (err instanceof NightsTakenError) throw datesTaken()
      throw err
    }
    return toBooking((await bookingsRepo.find(code))!, today)
  },

  /** A booking the user may see: their own, one at their listing, or any for admins. */
  async get(user: Me, code: string) {
    const b = await bookingsRepo.find(code)
    if (!b || !(b.guestId === user.id || b.hostId === user.id || user.role === 'admin')) throw notFound('booking')
    return toBooking(b, todayISO())
  },

  listForGuest: (guest: Me) => bookingsRepo.listForGuest(guest.id, todayISO()),

  /** Guests can cancel their own confirmed bookings until the day before check-in. */
  async cancelByGuest(guest: Me, code: string) {
    const today = todayISO()
    if (!(await bookingsRepo.cancel(code, (b) => b.guestId === guest.id && b.checkIn > today))) {
      throw new AppError(400, 'This booking can’t be cancelled. Stays can be cancelled until the day before check-in.')
    }
    return toBooking((await bookingsRepo.find(code))!, today)
  },

  /** The guest's latest finished, unreviewed stay at a listing, if any. */
  async reviewableCode(propertyId: number, guestId: number) {
    const today = todayISO()
    const rows = (await bookingsRepo.forProperty(propertyId))
      .filter((b) => b.guestId === guestId && b.status === 'Confirmed' && b.checkOut <= today && !b.reviewed)
      .sort((a, b) => b.checkOut.localeCompare(a.checkOut))
    return rows[0]?.code ?? null
  },
}
