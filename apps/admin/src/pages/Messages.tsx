import { useCallback, useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import { formatDate } from '@meridian/shared'
import { adminApi, type ContactMessage } from '@meridian/shared/client'
import { Chip } from '../components/Toolbar'

const statuses = ['new', 'read', 'closed', 'all'] as const
const tone: Record<string, string> = { new: 'bg-amber-100 text-amber-700', read: 'bg-slate-100 text-slate-600', closed: 'bg-brand-100 text-brand-700' }

export function Messages() {
  const [messages, setMessages] = useState<ContactMessage[] | null>(null)
  const [status, setStatus] = useState<(typeof statuses)[number]>('new')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    adminApi.messages(status === 'all' ? undefined : status).then((r) => setMessages(r.messages)).catch((e) => setError(e.message))
  }, [status])
  useEffect(load, [load])

  const set = async (id: number, s: 'new' | 'read' | 'closed') => {
    await adminApi.setMessageStatus(id, s).catch((e) => setError(e.message))
    load()
  }

  return (
    <>
      <PageHeader title="Messages" description="Questions sent through the website’s contact form. Reply by email, then close the message." />
      <Panel>
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {statuses.map((s) => <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{s[0].toUpperCase() + s.slice(1)}</Chip>)}
        </div>
        {error && <div className="mb-4"><ErrorNote message={error} /></div>}
        {!messages ? <Spinner /> : messages.length === 0 ? <p className="text-sm text-slate-500">No messages here.</p> : (
          <ul className="space-y-4">
            {messages.map((m) => (
              <li key={m.id} className="border border-slate-200 rounded-2xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-900">{m.name} <span className="font-normal text-slate-500">· {m.email}</span></p>
                    <p className="text-xs text-slate-400">{m.topic} · {formatDate(m.createdAt.slice(0, 10), { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${tone[m.status]}`}>{m.status}</span>
                </div>
                <p className="text-sm text-slate-700 mt-3 whitespace-pre-line">{m.message}</p>
                <div className="flex flex-wrap gap-3 mt-4 text-xs font-bold">
                  <a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.topic}`)}`} onClick={() => m.status === 'new' && set(m.id, 'read')} className="bg-slate-900 text-white px-3 py-2 rounded-xl">Reply by email</a>
                  {m.status !== 'read' && <button type="button" onClick={() => set(m.id, 'read')} className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200">Mark read</button>}
                  {m.status !== 'closed' && <button type="button" onClick={() => set(m.id, 'closed')} className="px-3 py-2 rounded-xl bg-brand-50 text-brand-700 hover:bg-brand-100">Close</button>}
                  {m.status === 'closed' && <button type="button" onClick={() => set(m.id, 'new')} className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200">Reopen</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}
