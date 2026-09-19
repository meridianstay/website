import type { AuditEntry } from '@meridian/shared'
import { pool, query, type Queryable } from '../db/pool'

// Table: admin_audit_log — every action taken in the control center.

export const auditLogRepo = {
  record(adminId: number, action: string, targetType: string, targetId: string | number | null, details: Record<string, unknown> = {}, db: Queryable = pool) {
    return query(
      'INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)',
      [adminId, action, targetType, targetId === null ? null : String(targetId), JSON.stringify(details)], db,
    )
  },

  async list(limit = 300): Promise<AuditEntry[]> {
    const rows = await query<{ id: number; action: string; target_type: string; target_id: string | null; details: Record<string, unknown>; created_at: Date; admin_name: string | null }>(
      'SELECT l.*, u.name AS admin_name FROM admin_audit_log l LEFT JOIN users u ON u.id = l.admin_id ORDER BY l.created_at DESC LIMIT $1',
      [limit],
    )
    return rows.map((r) => ({ id: r.id, action: r.action, targetType: r.target_type, targetId: r.target_id, details: r.details, adminName: r.admin_name, createdAt: r.created_at.toISOString() }))
  },
}
