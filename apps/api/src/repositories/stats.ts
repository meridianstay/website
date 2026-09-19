import type { AdminStats, HostStats } from '@meridian/shared'
import { queryOne } from '../db/pool'

// Read-only dashboard figures, aggregated across tables.

export const statsRepo = {
  async forHost(hostId: number, today: string): Promise<HostStats> {
    const s = await queryOne<{ earnings: number; listings: number; live: number; rated: number; avg_rating: string | null; upcoming: number }>(
      `SELECT
         COALESCE((SELECT sum(b.total_minor - b.service_fee_minor) FROM bookings b JOIN properties p ON p.id = b.property_id
                   WHERE p.host_id = $1 AND b.status = 'Confirmed'), 0)::int AS earnings,
         (SELECT count(*) FROM properties WHERE host_id = $1)::int AS listings,
         (SELECT count(*) FROM properties WHERE host_id = $1 AND status = 'Approved')::int AS live,
         (SELECT count(*) FROM properties WHERE host_id = $1 AND review_count > 0)::int AS rated,
         (SELECT round(avg(rating_avg), 2) FROM properties WHERE host_id = $1 AND review_count > 0) AS avg_rating,
         (SELECT count(*) FROM bookings b JOIN properties p ON p.id = b.property_id
           WHERE p.host_id = $1 AND b.status = 'Confirmed' AND b.check_out > $2)::int AS upcoming`,
      [hostId, today],
    )
    return { earnings: s!.earnings / 100, listings: s!.listings, live: s!.live, rated: s!.rated, avgRating: s!.avg_rating ? Number(s!.avg_rating) : null, upcoming: s!.upcoming }
  },

  async forAdmin(today: string): Promise<AdminStats> {
    const s = await queryOne<Record<string, string | number>>(`SELECT
      (SELECT count(*) FROM properties)::int AS listings,
      (SELECT count(*) FROM properties WHERE status = 'Approved')::int AS live,
      (SELECT count(*) FROM properties WHERE status = 'Pending')::int AS pending,
      (SELECT count(*) FROM users)::int AS users,
      (SELECT count(*) FROM users WHERE role = 'host')::int AS hosts,
      (SELECT count(*) FROM users WHERE suspended_at IS NOT NULL)::int AS suspended,
      (SELECT count(*) FROM bookings WHERE status = 'Confirmed')::int AS bookings,
      (SELECT count(*) FROM bookings WHERE status = 'Confirmed' AND check_out > $1)::int AS upcoming,
      COALESCE((SELECT sum(total_minor) FROM bookings WHERE status = 'Confirmed'), 0)::bigint AS gbv_minor,
      COALESCE((SELECT sum(service_fee_minor) FROM bookings WHERE status = 'Confirmed'), 0)::bigint AS fees_minor,
      (SELECT count(*) FROM contact_messages WHERE status = 'new')::int AS new_messages,
      (SELECT count(*) FROM reviews WHERE hidden_at IS NULL)::int AS reviews`, [today])
    const { gbv_minor, fees_minor, ...rest } = s!
    return { ...(rest as unknown as Omit<AdminStats, 'gbv' | 'fees'>), gbv: Number(gbv_minor) / 100, fees: Number(fees_minor) / 100 }
  },
}
