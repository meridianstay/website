import type { NotificationLogEntry } from '@meridian/shared'
import { C, all, col, firestore, nowISO } from '../store/db'

// A record of every message the platform tried to send, so an admin can see what went out, what
// bounced, and why — without the messages themselves becoming a copy of everyone's inbox.

export interface NotificationDoc extends NotificationLogEntry {}

const LOG_LIMIT = 500

export const notificationsRepo = {
  async record(entry: Omit<NotificationLogEntry, 'id' | 'createdAt'>): Promise<void> {
    const id = await firestore.runTransaction(async (tx) => {
      const ref = col(C.counters).doc('notifications')
      const snap = await tx.get(ref)
      const next = ((snap.data()?.value as number | undefined) ?? 0) + 1
      tx.set(ref, { value: next })
      return next
    })
    await col(C.notifications).doc(String(id)).set({ ...entry, id, createdAt: nowISO() })
  },

  /** The newest messages first, for the control centre. */
  async recent(event: string | null, status: string | null): Promise<NotificationLogEntry[]> {
    const rows = await all<NotificationDoc>(col(C.notifications))
    return rows
      .filter((r) => (!event || r.event === event) && (!status || r.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, LOG_LIMIT)
  },

  /** Keeps the log from growing for ever; called after each send. */
  async trim(): Promise<void> {
    const rows = await all<NotificationDoc>(col(C.notifications))
    if (rows.length <= LOG_LIMIT) return
    const old = rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, rows.length - LOG_LIMIT)
    await Promise.all(old.map((r) => col(C.notifications).doc(String(r.id)).delete().catch(() => {})))
  },
}
