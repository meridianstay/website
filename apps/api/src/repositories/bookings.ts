import type { BookingDetail, BookingState, PaymentMethod, PropertyType } from '@meridian/shared'
import { pool, query, queryOne, type Queryable } from '../db/pool'

// Table: bookings. "Completed" isn't stored: a confirmed booking whose check-out has passed is completed.

interface BookingRow {
  id: number; code: string; check_in: string; check_out: string; nights: number; guests: number
  price_per_night_minor: number; base_amount_minor: number; extra_guest_amount_minor: number; service_fee_minor: number
  total_minor: number; status: 'Confirmed' | 'Cancelled'; payment_method: PaymentMethod; contact_phone: string
  special_requests: string | null; created_at: Date; reviewed: boolean; guest_id: number; host_id: number
  property_slug: string; property_title: string; property_type: PropertyType; property_city: string; property_region: string
  property_image: string; guest_name: string; guest_email: string
}

const SELECT = `
  SELECT b.*, p.host_id, g.name AS guest_name, g.email AS guest_email,
    EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS reviewed,
    p.slug AS property_slug, p.title AS property_title, p.type AS property_type, p.city AS property_city,
    p.region AS property_region, p.cover_image_url AS property_image
  FROM bookings b JOIN properties p ON p.id = b.property_id JOIN users g ON g.id = b.guest_id`

function toBooking(r: BookingRow, today: string): BookingDetail {
  const status: BookingState = r.status === 'Cancelled' ? 'Cancelled' : r.check_out <= today ? 'Completed' : 'Confirmed'
  return {
    id: r.id,
    code: r.code,
    property: { slug: r.property_slug, title: r.property_title, type: r.property_type, location: `${r.property_city}, ${r.property_region}`, image: r.property_image },
    checkIn: r.check_in,
    checkOut: r.check_out,
    nights: r.nights,
    guests: r.guests,
    pricePerNight: r.price_per_night_minor / 100,
    baseAmount: r.base_amount_minor / 100,
    extraGuestAmount: r.extra_guest_amount_minor / 100,
    serviceFee: r.service_fee_minor / 100,
    total: r.total_minor / 100,
    status,
    paymentMethod: r.payment_method,
    contactPhone: r.contact_phone,
    specialRequests: r.special_requests,
    createdAt: r.created_at.toISOString(),
    reviewed: r.reviewed,
  }
}

/** Booking plus the people involved, for host and admin lists. */
export type BookingWithGuest = BookingDetail & { guestName: string; guestEmail: string }
const withGuest = (r: BookingRow, today: string): BookingWithGuest => ({ ...toBooking(r, today), guestName: r.guest_name, guestEmail: r.guest_email })

export interface NewBooking {
  code: string; propertyId: number; guestId: number; checkIn: string; checkOut: string; nights: number; guests: number
  currency: string; pricePerNightMinor: number; baseMinor: number; extraGuestMinor: number; serviceFeeMinor: number; totalMinor: number
  paymentMethod: PaymentMethod; contactPhone: string; specialRequests: string | null
}

export const bookingsRepo = {
  async insert(b: NewBooking, db: Queryable) {
    await query(
      `INSERT INTO bookings (code, property_id, guest_id, check_in, check_out, nights, guests, currency, price_per_night_minor,
         base_amount_minor, extra_guest_amount_minor, service_fee_minor, total_minor, payment_method, payment_status,
         contact_phone, special_requests)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'test',$15,$16)`,
      [b.code, b.propertyId, b.guestId, b.checkIn, b.checkOut, b.nights, b.guests, b.currency, b.pricePerNightMinor,
        b.baseMinor, b.extraGuestMinor, b.serviceFeeMinor, b.totalMinor, b.paymentMethod, b.contactPhone, b.specialRequests],
      db,
    )
  },

  /** A booking with who is allowed to see it (guest, host). */
  async findByCode(code: string, today: string, db: Queryable = pool) {
    const row = await queryOne<BookingRow>(`${SELECT} WHERE b.code = $1`, [code], db)
    return row ? { booking: toBooking(row, today), guestId: row.guest_id, hostId: row.host_id } : null
  },

  async listForGuest(guestId: number, today: string) {
    return (await query<BookingRow>(`${SELECT} WHERE b.guest_id = $1 ORDER BY b.check_in DESC`, [guestId])).map((r) => toBooking(r, today))
  },

  async listForHost(hostId: number, today: string) {
    return (await query<BookingRow>(`${SELECT} WHERE p.host_id = $1 ORDER BY b.check_in DESC`, [hostId])).map((r) => withGuest(r, today))
  },

  async listAll(q: string | null, today: string) {
    const rows = await query<BookingRow>(
      `${SELECT} WHERE ($1::text IS NULL OR b.code ILIKE $1 OR g.name ILIKE $1 OR g.email ILIKE $1 OR p.title ILIKE $1)
       ORDER BY b.created_at DESC LIMIT 300`,
      [q ? `%${q}%` : null],
    )
    return rows.map((r) => withGuest(r, today))
  },

  /** Confirmed stays for one listing that haven't ended yet. */
  upcomingForProperty(propertyId: number, today: string) {
    return query<{ code: string; check_in: string; check_out: string; guest_name: string }>(
      `SELECT b.code, b.check_in, b.check_out, u.name AS guest_name FROM bookings b JOIN users u ON u.id = b.guest_id
       WHERE b.property_id = $1 AND b.status = 'Confirmed' AND b.check_out > $2 ORDER BY b.check_in`,
      [propertyId, today],
    )
  },

  async overlapsConfirmed(propertyId: number, checkIn: string, checkOut: string, db: Queryable = pool) {
    return !!(await queryOne(
      `SELECT 1 FROM bookings WHERE property_id = $1 AND status = 'Confirmed' AND daterange(check_in, check_out) && daterange($2::date, $3::date)`,
      [propertyId, checkIn, checkOut], db,
    ))
  },

  /** Guests can cancel their own confirmed bookings until the day before check-in. */
  async cancelByGuest(code: string, guestId: number, today: string) {
    return !!(await queryOne(
      `UPDATE bookings SET status = 'Cancelled', cancelled_at = now() WHERE code = $1 AND guest_id = $2 AND status = 'Confirmed' AND check_in > $3 RETURNING id`,
      [code, guestId, today],
    ))
  },

  /** Admins can cancel any confirmed booking that hasn't ended. */
  async cancelByAdmin(code: string, today: string, db: Queryable = pool) {
    return !!(await queryOne(
      `UPDATE bookings SET status = 'Cancelled', cancelled_at = now() WHERE code = $1 AND status = 'Confirmed' AND check_out > $2 RETURNING id`,
      [code, today], db,
    ))
  },

  /** The guest's latest finished, unreviewed stay at a listing (by id), if any. */
  reviewableAt(propertyId: number, guestId: number, today: string) {
    return queryOne<{ code: string }>(
      `SELECT b.code FROM bookings b WHERE b.property_id = $1 AND b.guest_id = $2 AND b.status = 'Confirmed'
         AND b.check_out <= $3 AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id)
       ORDER BY b.check_out DESC LIMIT 1`,
      [propertyId, guestId, today],
    ).then((r) => r?.code ?? null)
  },

  /** The booking a review is for, if it belongs to this guest, is finished and not yet reviewed. */
  findReviewable(code: string, slug: string, guestId: number, today: string) {
    return queryOne<{ id: number; property_id: number }>(
      `SELECT b.id, b.property_id FROM bookings b JOIN properties p ON p.id = b.property_id
       WHERE b.code = $1 AND p.slug = $2 AND b.guest_id = $3 AND b.status = 'Confirmed' AND b.check_out <= $4
         AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = b.id)`,
      [code, slug, guestId, today],
    )
  },
}
