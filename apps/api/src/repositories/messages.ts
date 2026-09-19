import type { ContactMessage } from '@meridian/shared'
import { query, queryOne } from '../db/pool'

// Table: contact_messages

export type MessageStatus = 'new' | 'read' | 'closed'

export const messagesRepo = {
  insert(m: { name: string; email: string; topic: string; message: string }) {
    return query('INSERT INTO contact_messages (name, email, topic, message) VALUES ($1, $2, $3, $4)', [m.name, m.email, m.topic, m.message])
  },

  async list(status: MessageStatus | null): Promise<ContactMessage[]> {
    const rows = await query<{ id: number; name: string; email: string; topic: string; message: string; status: string; created_at: Date }>(
      'SELECT * FROM contact_messages WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at DESC LIMIT 300',
      [status],
    )
    return rows.map(({ created_at, ...m }) => ({ ...m, createdAt: created_at.toISOString() }))
  },

  async setStatus(id: number, status: MessageStatus) {
    return !!(await queryOne('UPDATE contact_messages SET status = $2 WHERE id = $1 RETURNING id', [id, status]))
  },
}
