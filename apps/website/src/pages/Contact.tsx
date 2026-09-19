import { useState } from 'react'
import { useAuth } from '@meridian/ui'
import { ApiError, api } from '@meridian/shared/client'
import { useDocumentTitle } from '../lib/useDocumentTitle'

const TOPICS = ['Booking help', 'Hosting', 'Payments & refunds', 'Trust & safety', 'Press', 'Partnerships & investors', 'Other']

export function Contact() {
  const { user } = useAuth()
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', topic: 'Booking help', message: '' })
  const [fields, setFields] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)
  useDocumentTitle('Contact us')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    setError(null)
    setFields({})
    try {
      await api.contact(form)
      setStatus('sent')
    } catch (err) {
      setFields((err as ApiError).fields)
      setError((err as ApiError).message)
      setStatus('idle')
    }
  }

  const input = (key: string) =>
    `w-full bg-slate-50 border rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500 ${fields[key] ? 'border-rose-400' : 'border-slate-200'}`
  const hint = (key: string) => fields[key] && <p className="text-xs text-rose-600 font-semibold mt-1">{fields[key]}</p>

  return (
    <div className="max-w-2xl mx-auto px-5 py-12">
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Contact us</h1>
      <p className="text-slate-600 mt-2">Questions about a booking, hosting or anything else. We reply by email within two working days.</p>

      {status === 'sent' ? (
        <div role="status" className="mt-8 bg-brand-50 border border-brand-100 rounded-3xl p-8 text-center">
          <i className="fa-solid fa-paper-plane text-3xl text-brand-600 mb-3" aria-hidden="true"></i>
          <h2 className="text-xl font-bold text-slate-900">Message sent</h2>
          <p className="text-sm text-slate-600 mt-1">Thanks, {form.name.split(' ')[0]}. We’ll reply to {form.email}.</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-8 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="c-name" className="block text-xs font-bold uppercase text-slate-500 mb-1">Name</label>
              <input id="c-name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input('name')} />
              {hint('name')}
            </div>
            <div>
              <label htmlFor="c-email" className="block text-xs font-bold uppercase text-slate-500 mb-1">Email</label>
              <input id="c-email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input('email')} />
              {hint('email')}
            </div>
          </div>
          <div>
            <label htmlFor="c-topic" className="block text-xs font-bold uppercase text-slate-500 mb-1">Topic</label>
            <select id="c-topic" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className={input('topic')}>
              {TOPICS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="c-message" className="block text-xs font-bold uppercase text-slate-500 mb-1">Message</label>
            <textarea id="c-message" rows={5} maxLength={5000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={input('message')} />
            {hint('message')}
          </div>
          {error && !Object.keys(fields).length && <p role="alert" className="text-sm text-rose-600 font-semibold">{error}</p>}
          <button type="submit" disabled={status === 'sending'} className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white font-bold py-3.5 px-8 rounded-2xl text-sm">
            {status === 'sending' ? 'Sending…' : 'Send message'}
          </button>
        </form>
      )}
    </div>
  )
}
