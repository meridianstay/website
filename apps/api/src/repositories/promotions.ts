import type { AdCampaign, AdPlacement, AdStatus } from '@meridian/shared'
import { C, all, col, firestore, increment, nextId, nowISO } from '../store/db'

// Collection: adCampaigns/{id}. Money is kept in rupees here (it's what the host paid, not a booking price).

export interface CampaignDoc extends AdCampaign {
  razorpayOrderId: string | null
  razorpayPaymentId: string | null
}

const ref = (id: number) => col(C.promotions).doc(String(id))

export const promotionsRepo = {
  async create(input: Omit<CampaignDoc, 'id'>) {
    const id = await nextId('promotions')
    const doc: CampaignDoc = { ...input, id }
    await ref(id).set(doc)
    return doc
  },

  async find(id: number) {
    const snap = await ref(id).get()
    return snap.exists ? (snap.data() as CampaignDoc) : null
  },

  async findByOrder(orderId: string) {
    const snap = await col(C.promotions).where('razorpayOrderId', '==', orderId).limit(1).get()
    return snap.empty ? null : (snap.docs[0].data() as CampaignDoc)
  },

  update: (id: number, patch: Partial<CampaignDoc>) => ref(id).update(patch),

  async forHost(hostId: number) {
    return (await all<CampaignDoc>(col(C.promotions).where('hostId', '==', hostId))).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async listAll(status?: AdStatus | null) {
    const rows = (await all<CampaignDoc>(col(C.promotions))).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return status ? rows.filter((c) => c.status === status) : rows
  },

  /** Campaigns that should be showing today, for one placement. */
  async liveFor(placement: AdPlacement, today: string) {
    const rows = await all<CampaignDoc>(col(C.promotions).where('placement', '==', placement).where('status', 'in', ['Scheduled', 'Running']))
    return rows.filter((c) => c.startDate <= today && c.endDate >= today)
  },

  /** Marks campaigns Running or Finished as their dates pass. */
  async refreshStatuses(today: string) {
    const rows = await all<CampaignDoc>(col(C.promotions).where('status', 'in', ['Scheduled', 'Running']))
    const writer = firestore.bulkWriter()
    let changed = 0
    for (const c of rows) {
      const next: AdStatus | null = c.endDate < today ? 'Finished' : c.startDate <= today && c.status === 'Scheduled' ? 'Running' : null
      if (next) {
        writer.update(ref(c.id), { status: next })
        changed++
      }
    }
    await writer.close()
    return changed
  },

  countImpressions: (ids: number[]) => {
    if (!ids.length) return Promise.resolve()
    const writer = firestore.bulkWriter()
    for (const id of ids) writer.update(ref(id), { impressions: increment(1) })
    return writer.close()
  },

  countClick: (id: number) => ref(id).update({ clicks: increment(1) }).catch(() => {}),

  async spendTotal() {
    const rows = await all<CampaignDoc>(col(C.promotions))
    return rows.filter((c) => c.paymentStatus === 'paid' || c.paymentStatus === 'test').reduce((n, c) => n + c.total - c.refunded, 0)
  },

  now: nowISO,
}
