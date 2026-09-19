import type { Me, UserRole } from '@meridian/shared'
import { pool, query, queryOne, type Queryable } from '../db/pool'

// Table: users

export interface UserRow {
  id: number
  name: string
  email: string
  phone: string | null
  role: UserRole
  avatar_url: string | null
  created_at: Date
  suspended_at: Date | null
}

export const toMe = (r: UserRow): Me => ({
  id: r.id, name: r.name, email: r.email, phone: r.phone, role: r.role, avatar: r.avatar_url, createdAt: r.created_at.toISOString(),
})

export type AdminUser = Me & { suspended: boolean; listings: number; bookings: number }

export const usersRepo = {
  async findById(id: number, db: Queryable = pool) {
    const row = await queryOne<UserRow>('SELECT * FROM users WHERE id = $1', [id], db)
    return row ? toMe(row) : null
  },

  /** Includes the password hash and suspension, for signing in. */
  findForLogin(email: string) {
    return queryOne<UserRow & { password_hash: string }>('SELECT * FROM users WHERE email = $1', [email])
  },

  async emailExists(email: string) {
    return !!(await queryOne('SELECT 1 FROM users WHERE email = $1', [email]))
  },

  async create(input: { name: string; email: string; passwordHash: string }) {
    const row = await queryOne<UserRow>(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [input.name, input.email, input.passwordHash],
    )
    return toMe(row!)
  },

  async updateProfile(id: number, input: { name: string; phone: string | null }) {
    const row = await queryOne<UserRow>('UPDATE users SET name = $1, phone = $2 WHERE id = $3 RETURNING *', [input.name, input.phone, id])
    return toMe(row!)
  },

  passwordHash(id: number) {
    return queryOne<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [id]).then((r) => r?.password_hash ?? null)
  },

  setPasswordHash(id: number, hash: string) {
    return query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id])
  },

  /** Saves the phone from a booking if the user hasn't set one yet. */
  setPhoneIfEmpty(id: number, phone: string, db: Queryable = pool) {
    return query('UPDATE users SET phone = $1 WHERE id = $2 AND phone IS NULL', [phone, id], db)
  },

  /** A guest's first listing makes them a host. Admins keep their role. */
  promoteGuestToHost(id: number, db: Queryable = pool) {
    return query(`UPDATE users SET role = 'host' WHERE id = $1 AND role = 'guest'`, [id], db)
  },

  async list(filters: { q?: string | null; role?: UserRole | null }): Promise<AdminUser[]> {
    const rows = await query<UserRow & { listings: number; bookings: number }>(
      `SELECT u.*, (SELECT count(*) FROM properties p WHERE p.host_id = u.id)::int AS listings,
         (SELECT count(*) FROM bookings b WHERE b.guest_id = u.id)::int AS bookings
       FROM users u WHERE ($1::text IS NULL OR u.name ILIKE $1 OR u.email::text ILIKE $1)
         AND ($2::user_role IS NULL OR u.role = $2)
       ORDER BY u.created_at DESC LIMIT 500`,
      [filters.q ? `%${filters.q}%` : null, filters.role ?? null],
    )
    return rows.map((r) => ({ ...toMe(r), suspended: !!r.suspended_at, listings: r.listings, bookings: r.bookings }))
  },

  /** Changes role and/or suspension. Returns false if the user doesn't exist. */
  async updateAccess(id: number, change: { role?: UserRole; suspended?: boolean }, db: Queryable = pool) {
    const row = await queryOne(
      `UPDATE users SET role = COALESCE($2::user_role, role),
         suspended_at = CASE WHEN $3::boolean IS NULL THEN suspended_at WHEN $3 THEN COALESCE(suspended_at, now()) ELSE NULL END
       WHERE id = $1 RETURNING id`,
      [id, change.role ?? null, change.suspended ?? null], db,
    )
    return !!row
  },
}
