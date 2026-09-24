import { useState } from 'react'
import { api } from '@meridian/shared/client'
import { useAuth, useT } from '@meridian/ui'
import { usePlace } from '../lib/place'

/** "Can't find what you're looking for?" — the guest describes their trip and our team replies. */
export function StayRequest({ defaultWhere = '' }: { defaultWhere?: string }) {
  const t = useT()
  const { user } = useAuth()
  const { place } = usePlace()
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: user?.name ?? '', email: user?.email ?? '', where: defaultWhere || (place && place.name !== 'you' ? place.name : ''),
    when: '', guests: '', budget: '', notes: '',
  })

  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setError(null)
    try {
      await api.contact({
        name: form.name.trim(), email: form.email.trim(), topic: 'Stay request',
        message: [
          `Where: ${form.where || 'anywhere'}`,
          `When: ${form.when || 'flexible'}`,
          `Guests: ${form.guests || 'not said'}`,
          `Budget: ${form.budget || 'not said'}`,
          form.notes && `Notes: ${form.notes}`,
        ].filter(Boolean).join('\n'),
      })
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  const input = 'w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-brand-500'

  if (sent) {
    return (
      <section className="bg-brand-50 border border-brand-100 rounded-3xl p-6 text-center">
        <p className="font-bold text-slate-900"><i className="fa-solid fa-circle-check text-brand-600 mr-2" aria-hidden="true"></i>{t('request.thanks')}</p>
        <p className="text-sm text-slate-600 mt-1">{t('request.reply')}</p>
      </section>
    )
  }

  return (
    <section className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold">{t('request.cantFind')}</h2>
          <p className="text-sm text-slate-300 mt-1">{t('request.intro')}</p>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="bg-brand-500 hover:bg-brand-400 text-white font-bold py-3 px-6 rounded-2xl text-sm">
            Tell us what you need
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={submit} className="mt-6 grid sm:grid-cols-2 gap-3 text-slate-900" noValidate>
          <label className="sm:col-span-2 sm:w-1/2">
            <span className="block text-[11px] font-bold uppercase text-slate-300 mb-1">{t('request.yourName')}</span>
            <input required value={form.name} onChange={(e) => set({ name: e.target.value })} className={input} />
          </label>
          <label>
            <span className="block text-[11px] font-bold uppercase text-slate-300 mb-1">Email</span>
            <input required type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} className={input} placeholder="you@example.com" />
          </label>
          <label>
            <span className="block text-[11px] font-bold uppercase text-slate-300 mb-1">Where</span>
            <input value={form.where} onChange={(e) => set({ where: e.target.value })} className={input} placeholder={t('request.wherePlaceholder')} />
          </label>
          <label>
            <span className="block text-[11px] font-bold uppercase text-slate-300 mb-1">When</span>
            <input value={form.when} onChange={(e) => set({ when: e.target.value })} className={input} placeholder={t('request.whenPlaceholder')} />
          </label>
          <label>
            <span className="block text-[11px] font-bold uppercase text-slate-300 mb-1">Guests</span>
            <input value={form.guests} onChange={(e) => set({ guests: e.target.value })} className={input} placeholder={t('request.whoPlaceholder')} />
          </label>
          <label className="sm:col-span-2">
            <span className="block text-[11px] font-bold uppercase text-slate-300 mb-1">{t('request.budget')}</span>
            <input value={form.budget} onChange={(e) => set({ budget: e.target.value })} className={input} placeholder={t('request.budgetPlaceholder')} />
          </label>
          <label className="sm:col-span-2">
            <span className="block text-[11px] font-bold uppercase text-slate-300 mb-1">{t('request.anythingElse')}</span>
            <textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} className={input} placeholder={t('request.elsePlaceholder')} />
          </label>
          {error && <p role="alert" className="sm:col-span-2 text-sm text-rose-300 font-semibold">{error}</p>}
          <div className="sm:col-span-2 flex items-center gap-4">
            <button type="submit" disabled={sending} className="bg-brand-500 hover:bg-brand-400 disabled:bg-slate-600 text-white font-bold py-3 px-6 rounded-2xl text-sm">{sending ? t('request.sending') : t('request.send')}</button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm font-bold text-slate-300">Cancel</button>
          </div>
        </form>
      )}
    </section>
  )
}
