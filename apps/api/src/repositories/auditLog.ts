import type { AuditEntry } from '@meridian/shared'
import { C, col, firestore, nowISO } from '../store/db'

// Collection: auditLog/{auto} — every action taken in the control center, plus automatic payment events (admin null).

export const auditLogRepo = {
  record: (admin: { id: number; name: string } | null, action: string, targetType: string, targetId: string | number | null, details: Record<string, unknown> = {}) =>
    col(C.audit).add({
      adminId: admin?.id ?? null, adminName: admin?.name ?? 'System', action, targetType, targetId: targetId === null ? null : String(targetId),
      details: JSON.parse(JSON.stringify(details)), createdAt: nowISO(),
    }),

  /** How many entries are older than the cut-off, without reading them. */
  async countBefore(cutoff: string): Promise<number> {
    return (await col(C.audit).where('createdAt', '<', cutoff).count().get()).data().count
  },

  /** Deletes entries older than the cut-off. Returns how many went. */
  async deleteBefore(cutoff: string): Promise<number> {
    const snap = await col(C.audit).where('createdAt', '<', cutoff).limit(2000).get()
    const writer = firestore.bulkWriter()
    snap.docs.forEach((d) => writer.delete(d.ref))
    await writer.close()
    return snap.size
  },

  async list(limit = 300): Promise<AuditEntry[]> {
    const snap = await col(C.audit).orderBy('createdAt', 'desc').limit(limit).get()
    return snap.docs.map((d) => {
      const e = d.data()
      return { id: d.id as unknown as number, action: e.action, targetType: e.targetType, targetId: e.targetId, details: e.details, adminName: e.adminName, createdAt: e.createdAt }
    })
  },
}
