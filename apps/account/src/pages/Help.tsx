import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader, Panel, useAuth } from '@meridian/ui'
import { ApiError, api, appLink } from '@meridian/shared/client'

// Where a guest goes when something has gone wrong. The form is the same one the website carries,
// with the topics a guest actually needs, filled in from who they are so there is less to type.

const TOPICS = ['Booking help', 'Payments & refunds', 'Stay request', 'Trust & safety', 'Other']

const ANSWERS: { q: string; a: string; to?: { label: string; href: string } }[] = [
  {
    q: 'How do I cancel a booking?',
    a: 'Open the booking under Trips and choose Cancel. The page shows exactly what you would get back before you confirm — cancel at least 48 hours before check-in and it is the whole amount, less the convenience fee, which is never returned. A request an owner has not accepted yet costs nothing to withdraw.',
    to: { label: 'Go to your trips', href: '/trips' },
  },
  {
    q: 'When is my refund back in my account?',
    a: 'Meridian sends it the moment a cancellation goes through. Your bank then takes three to seven working days to show it, and it goes back to whatever you paid with — the same card, account or UPI handle.',
    to: { label: 'See your refunds', href: '/payments' },
  },
  {
    q: 'I have paid but the booking still says it is waiting.',
    a: 'Stays run by their owners are requests, not instant bookings: the money is held and only taken if the owner accepts, which they have 24 hours to do. If they do not, the hold is released on its own and nothing is charged.',
  },
  {
    q: 'Where is the exact address and the owner’s number?',
    a: 'On the booking page, as soon as the booking is confirmed and paid for. Until then only the area is shown, which is how we protect owners from a flood of enquiries that never become stays.',
  },
  {
    q: 'Can I have a GST invoice for my company?',
    a: 'Every paid booking has one, with the GST shown separately and raised by whoever owns the property. Open it from Payments and print or save it.',
    to: { label: 'Open your invoices', href: '/payments' },
  },
  {
    q: 'What about the security deposit?',
    a: 'Where a stay asks for one it is settled with the owner at check-in and returned by them when you leave. It never passes through Meridian and is not part of what you pay online.',
  },
]

const POLICIES: { label: string; slug: string; blurb: string }[] = [
  { label: 'Cancellation policy', slug: 'cancellation-policy', blurb: 'What comes back, and by when' },
  { label: 'Help centre', slug: 'help', blurb: 'Every answer, not just these' },
  { label: 'Trust and safety', slug: 'trust-safety', blurb: 'How stays and reviews are checked' },
  { label: 'How Meridian works', slug: 'how-it-works', blurb: 'Bookings, requests and reviews' },
  { label: 'Terms of service', slug: 'terms', blurb: 'The rules of using Meridian' },
  { label: 'Privacy', slug: 'privacy', blurb: 'What we keep, and why' },
]

export function Help() {
  const { user } = useAuth()
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', topic: TOPICS[0], message: '' })
  const [fields, setFields] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    setFields({})
    setError(null)
    try {
      await api.contact(form)
      setStatus('sent')
    } catch (err) {
      const apiError = err as ApiError
      setFields(apiError.fields ?? {})
      setError(Object.keys(apiError.fields ?? {}).length ? null : apiError.message)
      setStatus('idle')
    }
  }

  const field = 'w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500'

  return (
    <>
      <PageHeader title="Help" description="The questions guests ask most, and a line straight to our team." />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        <div className="xl:col-span-2 space-y-8">
          <Panel title="Quick answers">
            <dl className="divide-y divide-slate-100">
              {ANSWERS.map((item) => (
                <div key={item.q} className="py-4 first:pt-0 last:pb-0">
                  <dt className="font-bold text-sm text-slate-900">{item.q}</dt>
                  <dd className="text-sm text-slate-600 mt-1.5">
                    {item.a}
                    {item.to && <Link to={item.to.href} className="block mt-2 text-xs font-bold text-brand-600">{item.to.label} →</Link>}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Policies and guides" subtitle="The full wording, kept on the main site.">
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {POLICIES.map((p) => (
                <li key={p.slug}>
                  <a
                    href={appLink('website', `/${p.slug}`)}
                    className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200 hover:border-brand-300 hover:bg-slate-50 transition"
                  >
                    <span className="min-w-0">
                      <span className="block font-bold text-sm text-slate-900 truncate">{p.label}</span>
                      <span className="block text-xs text-slate-500 truncate">{p.blurb}</span>
                    </span>
                    <i className="fa-solid fa-chevron-right text-xs text-slate-400" aria-hidden="true"></i>
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel title="Ask us" subtitle="We answer by email, usually the same working day.">
          {status === 'sent' ? (
            <div className="text-center py-6">
              <i className="fa-solid fa-paper-plane text-3xl text-brand-600" aria-hidden="true"></i>
              <p className="font-bold text-slate-900 mt-4">Message sent</p>
              <p className="text-sm text-slate-500 mt-1">We have it, and we will reply to {form.email}.</p>
              <button type="button" onClick={() => { setForm({ ...form, message: '' }); setStatus('idle') }} className="mt-5 text-xs font-bold text-brand-600">
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={send} className="space-y-4" noValidate>
              <div>
                <label htmlFor="help-name" className="block text-xs font-bold uppercase text-slate-500 mb-1">Your name</label>
                <input id="help-name" autoComplete="name" className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                {fields.name && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.name}</p>}
              </div>
              <div>
                <label htmlFor="help-email" className="block text-xs font-bold uppercase text-slate-500 mb-1">Where to reply</label>
                <input id="help-email" type="email" autoComplete="email" className={field} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                {fields.email && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.email}</p>}
              </div>
              <div>
                <label htmlFor="help-topic" className="block text-xs font-bold uppercase text-slate-500 mb-1">What is it about</label>
                <select id="help-topic" className={field} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })}>
                  {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {fields.topic && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.topic}</p>}
              </div>
              <div>
                <label htmlFor="help-message" className="block text-xs font-bold uppercase text-slate-500 mb-1">Your message</label>
                <textarea
                  id="help-message"
                  rows={5}
                  className={field}
                  placeholder="Include the booking code if there is one — it is the quickest way for us to find it."
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
                {fields.message && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.message}</p>}
              </div>
              {error && <p role="alert" className="text-xs font-semibold text-rose-600">{error}</p>}
              <button type="submit" disabled={status === 'sending'} className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-bold py-3 rounded-2xl text-sm">
                {status === 'sending' ? 'Sending…' : 'Send message'}
              </button>
              <p className="text-xs text-slate-400">
                In an emergency during a stay, call local services first, then tell us.
              </p>
            </form>
          )}
        </Panel>
      </div>
    </>
  )
}
