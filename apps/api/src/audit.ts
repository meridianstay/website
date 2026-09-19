import { query, type Queryable } from './db/pool'
import { pool } from './db/pool'

/** Records an admin action in admin_audit_log. */
export function audit(
  adminId: number,
  action: string,
  targetType: string,
  targetId: string | number | null,
  details: Record<string, unknown> = {},
  db: Queryable = pool,
) {
  return query(
    'INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
    [adminId, action, targetType, targetId === null ? null : String(targetId), JSON.stringify(details)],
    db,
  )
}
