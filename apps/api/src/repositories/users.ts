import type { Me, UserRole } from '@meridian/shared'
import { C, all, col, firestore, nextId, nowISO } from '../store/db'

// Collection: users/{firebaseUid}. Each user also has a short numeric `id` used across the platform.

export interface UserDoc {
  id: number
  uid: string
  name: string
  email: string | null
  phone: string | null
  role: UserRole
  avatarUrl: string | null
  createdAt: string
  suspendedAt: string | null
  /** Session cookies issued before this moment are rejected (log-out and suspension). */
  sessionsRevokedAt: string | null
}

export const toMe = (u: UserDoc): Me => ({
  id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, avatar: u.avatarUrl, createdAt: u.createdAt,
})

export type AdminUser = Me & { suspended: boolean; listings: number; bookings: number }

const ref = (uid: string) => col(C.users).doc(uid)

export const usersRepo = {
  async findByUid(uid: string) {
    const snap = await ref(uid).get()
    return snap.exists ? (snap.data() as UserDoc) : null
  },

  async findById(id: number) {
    const snap = await col(C.users).where('id', '==', id).limit(1).get()
    return snap.empty ? null : (snap.docs[0].data() as UserDoc)
  },

  /** First sign-in creates the account as a guest; later sign-ins fill in missing details. */
  async upsertFromSignIn(profile: { uid: string; name: string | null; email: string | null; phone: string | null; avatarUrl: string | null }) {
    return firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref(profile.uid))
      if (snap.exists) {
        const u = snap.data() as UserDoc
        const patch: Partial<UserDoc> = {}
        if (!u.email && profile.email) patch.email = profile.email
        if (!u.phone && profile.phone) patch.phone = profile.phone
        if (!u.avatarUrl && profile.avatarUrl) patch.avatarUrl = profile.avatarUrl
        if (!u.name && profile.name) patch.name = profile.name
        if (Object.keys(patch).length) tx.update(ref(profile.uid), patch)
        return { ...u, ...patch }
      }
      const user: UserDoc = {
        id: await nextId('users', tx), uid: profile.uid, name: profile.name ?? '', email: profile.email, phone: profile.phone,
        role: 'guest', avatarUrl: profile.avatarUrl, createdAt: nowISO(), suspendedAt: null, sessionsRevokedAt: null,
      }
      tx.set(ref(profile.uid), user)
      return user
    })
  },

  async update(uid: string, patch: Partial<UserDoc>) {
    await ref(uid).update(patch)
    return (await this.findByUid(uid))!
  },

  async list(filters: { q?: string | null; role?: UserRole | null }): Promise<AdminUser[]> {
    const [users, properties, bookings] = await Promise.all([
      all<UserDoc>(col(C.users)),
      all<{ hostId: number }>(col(C.properties).select('hostId')),
      all<{ guestId: number }>(col(C.bookings).select('guestId')),
    ])
    const q = filters.q?.toLowerCase()
    return users
      .filter((u) => (!filters.role || u.role === filters.role) && (!q || [u.name, u.email, u.phone].some((v) => v?.toLowerCase().includes(q))))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 500)
      .map((u) => ({
        ...toMe(u), suspended: !!u.suspendedAt,
        listings: properties.filter((p) => p.hostId === u.id).length,
        bookings: bookings.filter((b) => b.guestId === u.id).length,
      }))
  },
}
