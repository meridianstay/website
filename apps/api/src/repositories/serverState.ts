import type { CronRun, StorageUsage } from '@meridian/shared'
import { C, col, nowISO } from '../store/db'

// Collection: serverState/{doc} — how the server itself is running, rather than anything about the
// business. `cache` holds the counter every instance watches (see store/cache.ts); `jobs` remembers
// when each scheduled job last ran; `storage` remembers the last time the bucket was measured.

export const serverStateRepo = {
  async jobRuns(): Promise<Record<string, CronRun>> {
    const snap = await col(C.serverState).doc('jobs').get()
    return (snap.data() ?? {}) as Record<string, CronRun>
  },

  /** Remembered so the Server page can say whether the scheduler is actually calling us. */
  async recordJobRun(job: string, run: Omit<CronRun, 'at'>): Promise<CronRun> {
    const entry: CronRun = { ...run, at: nowISO() }
    await col(C.serverState).doc('jobs').set({ [job]: entry }, { merge: true })
    return entry
  },

  async storage(): Promise<StorageUsage | null> {
    const snap = await col(C.serverState).doc('storage').get()
    return snap.exists ? (snap.data() as StorageUsage) : null
  },

  async saveStorage(usage: StorageUsage) {
    await col(C.serverState).doc('storage').set(usage)
  },
}
