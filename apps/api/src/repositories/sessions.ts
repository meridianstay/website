import { pool, query, queryOne, type Queryable } from '../db/pool'
import { toMe, type UserRow } from './users'

// Table: sessions. Only a hash of each session token is stored.

export const sessionsRepo = {
  create(tokenHash: string, userId: number, expiresAt: Date) {
    return query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, userId, expiresAt])
  },

  /** The signed-in user for a session, or null if expired, unknown or suspended. */
  async findUser(tokenHash: string) {
    const row = await queryOne<UserRow>(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now() AND u.suspended_at IS NULL`,
      [tokenHash],
    )
    return row ? toMe(row) : null
  },

  delete(tokenHash: string) {
    return query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash])
  },

  /** Signs a user out everywhere (e.g. when suspended). */
  deleteAllForUser(userId: number, db: Queryable = pool) {
    return query('DELETE FROM sessions WHERE user_id = $1', [userId], db)
  },

  deleteExpired() {
    return query('DELETE FROM sessions WHERE expires_at <= now()')
  },
}
