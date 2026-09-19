import type { ContactMessage } from '@meridian/shared'
import { C, all, col, nextId, nowISO } from '../store/db'

// Collection: contactMessages/{id}

export type MessageStatus = 'new' | 'read' | 'closed'

export const messagesRepo = {
  async insert(m: { name: string; email: string; topic: string; message: string }) {
    const id = await nextId('messages')
    await col(C.messages).doc(String(id)).set({ ...m, id, status: 'new', createdAt: nowISO() })
  },

  async list(status: MessageStatus | null): Promise<ContactMessage[]> {
    const rows = await all<ContactMessage>(status ? col(C.messages).where('status', '==', status) : col(C.messages))
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 300)
  },

  async setStatus(id: number, status: MessageStatus) {
    const ref = col(C.messages).doc(String(id))
    if (!(await ref.get()).exists) return false
    await ref.update({ status })
    return true
  },
}
