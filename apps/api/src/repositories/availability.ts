import type { DateRange } from '@meridian/shared'
import { pool, query, queryOne, type Queryable } from '../db/pool'

// Table: availability_blocks (nights a host has closed), plus the combined "unavailable" view.

export const availabilityRepo = {
  async upcomingBlocks(propertyId: number, today: string) {
    const rows = await query<{ id: number; start_date: string; end_date: string; note: string | null }>(
      'SELECT id, start_date, end_date, note FROM availability_blocks WHERE property_id = $1 AND end_date > $2 ORDER BY start_date',
      [propertyId, today],
    )
    return rows.map((b) => ({ id: b.id, checkIn: b.start_date, checkOut: b.end_date, note: b.note }))
  },

  /** Every future range a guest can't book: confirmed bookings and host blocks. */
  async unavailableRanges(propertyId: number, today: string): Promise<DateRange[]> {
    const rows = await query<{ check_in: string; check_out: string }>(
      `SELECT check_in, check_out FROM bookings WHERE property_id = $1 AND status = 'Confirmed' AND check_out > $2
       UNION ALL
       SELECT start_date, end_date FROM availability_blocks WHERE property_id = $1 AND end_date > $2
       ORDER BY 1`,
      [propertyId, today],
    )
    return rows.map((r) => ({ checkIn: r.check_in, checkOut: r.check_out }))
  },

  async overlapsBlock(propertyId: number, checkIn: string, checkOut: string, db: Queryable = pool) {
    return !!(await queryOne(
      'SELECT 1 FROM availability_blocks WHERE property_id = $1 AND daterange(start_date, end_date) && daterange($2::date, $3::date)',
      [propertyId, checkIn, checkOut], db,
    ))
  },

  insertBlock(propertyId: number, checkIn: string, checkOut: string, note: string | null, db: Queryable) {
    return query('INSERT INTO availability_blocks (property_id, start_date, end_date, note) VALUES ($1, $2, $3, $4)', [propertyId, checkIn, checkOut, note], db)
  },

  deleteBlock(blockId: number, propertyId: number) {
    return query('DELETE FROM availability_blocks WHERE id = $1 AND property_id = $2', [blockId, propertyId])
  },
}
