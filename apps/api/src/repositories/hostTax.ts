import { blankHostGst, type HostGst } from '@meridian/shared'
import { C, all, col, nowISO } from '../store/db'

// Collection: hostTax/{hostId} — a client's own GST registration. Kept apart from their user
// record and their website: a client may have one and neither of the others.

interface HostTaxDoc extends HostGst { hostId: number }

export const hostTaxRepo = {
  async find(hostId: number): Promise<HostGst | null> {
    const snap = await col(C.hostTax).doc(String(hostId)).get()
    return snap.exists ? (snap.data() as HostTaxDoc) : null
  },

  get: async (hostId: number): Promise<HostGst> => (await hostTaxRepo.find(hostId)) ?? blankHostGst(),

  async save(hostId: number, patch: Partial<HostGst>): Promise<HostGst> {
    const current = await hostTaxRepo.get(hostId)
    const next: HostTaxDoc = { ...current, ...patch, hostId, updatedAt: nowISO() }
    await col(C.hostTax).doc(String(hostId)).set(next)
    return next
  },

  /** Every client who has entered one, for your team to look over. */
  list: () => all<HostTaxDoc>(col(C.hostTax)),
}
