import { daysBetween, isISODate, MAX_NIGHTS, quoteStay, todayISO, type BookingDetail, type Me, type PaymentMethod } from '@meridian/shared'
import { transaction } from '../db/pool'
import { availabilityRepo, bookingsRepo, propertiesRepo, usersRepo } from '../repositories'
import { newBookingCode } from '../lib/bookingCode'
import { AppError, notFound } from '../http/errors'
import { checkPhone, collect, isPgError, PG_EXCLUSION_VIOLATION } from '../http/validate'

// Booking rules: valid dates, capacity, availability and server-side pricing.

export const PAYMENT_METHODS: PaymentMethod[] = ['upi', 'card', 'netbanking']

export interface BookingRequest {
  propertyId: number
  checkIn: string
  checkOut: string
  guests: number
  paymentMethod: string
  contactPhone: string
  specialRequests: string
}

const datesTaken = () =>
  new AppError(409, 'Some of those nights were just booked. Please choose different dates.', { checkIn: 'Those dates are no longer available.' })

export const bookingService = {
  async create(guest: Me, req: BookingRequest): Promise<BookingDetail> {
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

    const property = await propertiesRepo.findBookable(req.propertyId)
    if (!property) throw new AppError(404, 'This stay isn’t available for booking.')
    if (property.host_id === guest.id) throw new AppError(400, 'You can’t book your own listing.')
    if (guests > property.max_guests) collect({ guests: `This stay fits up to ${property.max_guests} guests.` })

    // The browser shows a preview; the price charged is always recalculated here.
    const q = quoteStay(property.price_per_night_minor / 100, checkIn, checkOut, guests)
    const code = newBookingCode()
    try {
      await transaction(async (db) => {
        await propertiesRepo.lock(property.id, db)
        if (await availabilityRepo.overlapsBlock(property.id, checkIn, checkOut, db)) throw datesTaken()
        // The bookings_no_overlap constraint rejects overlapping confirmed bookings (see catch below).
        await bookingsRepo.insert({
          code, propertyId: property.id, guestId: guest.id, checkIn, checkOut, nights: q.nights, guests, currency: property.currency,
          pricePerNightMinor: property.price_per_night_minor, baseMinor: Math.round(q.baseAmount * 100),
          extraGuestMinor: Math.round(q.extraGuestAmount * 100), serviceFeeMinor: Math.round(q.serviceFee * 100),
          totalMinor: Math.round(q.total * 100), paymentMethod: req.paymentMethod as PaymentMethod, contactPhone,
          specialRequests: specialRequests || null,
        }, db)
        await usersRepo.setPhoneIfEmpty(guest.id, contactPhone, db)
      })
    } catch (err) {
      if (isPgError(err, PG_EXCLUSION_VIOLATION)) throw datesTaken()
      throw err
    }
    return (await bookingsRepo.findByCode(code, today))!.booking
  },

  /** A booking the user may see: their own, one at their listing, or any for admins. */
  async get(user: Me, code: string) {
    const found = await bookingsRepo.findByCode(code, todayISO())
    const allowed = found && (found.guestId === user.id || found.hostId === user.id || user.role === 'admin')
    if (!allowed) throw notFound('booking')
    return found.booking
  },

  listForGuest(guest: Me) {
    return bookingsRepo.listForGuest(guest.id, todayISO())
  },

  async cancelByGuest(guest: Me, code: string) {
    const today = todayISO()
    if (!(await bookingsRepo.cancelByGuest(code, guest.id, today))) {
      throw new AppError(400, 'This booking can’t be cancelled. Stays can be cancelled until the day before check-in.')
    }
    return (await bookingsRepo.findByCode(code, today))!.booking
  },
}
