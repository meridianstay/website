import type { AuditEntry } from '@meridian/shared'
import { C, col, nowISO } from '../store/db'

// Collection: auditLog/{auto} — every action taken in the control center.

export const auditLogRepo = {
  record: (admin: { id: number; name: string }, action: string, targetType: string, targetId: string | number | null, details: Record<string, unknown> = {}) =>
    col(C.audit).add({
      adminId: admin.id, adminName: admin.name, action, targetType, targetId: targetId === null ? null : String(targetId),
      details: JSON.parse(JSON.stringify(details)), createdAt: nowISO(),
    }),

  async list(limit = 300): Promise<AuditEntry[]> {
    const snap = await col(C.audit).orderBy('createdAt', 'desc').limit(limit).get()
    return snap.docs.map((d) => {
      const e = d.data()
      return { id: d.id as unknown as number, action: e.action, targetType: e.targetType, targetId: e.targetId, details: e.details, adminName: e.adminName, createdAt: e.createdAt }
    })
  },
}
