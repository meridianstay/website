import { useState } from 'react'
import { Avatar, PageHeader, Panel, PhotoUpload, useAuth } from '@meridian/ui'
import { formatDate } from '@meridian/shared'
import { ApiError, api, appLink } from '@meridian/shared/client'

const inputClass = 'w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500'

export function Profile() {
  const { user, setUser, logout } = useAuth()
  const [form, setForm] = useState({ name: user!.name, phone: user!.phone ?? '' })
  const [fields, setFields] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('saving')
    setFields({})
    try {
      setUser((await api.updateMe(form)).user)
      setStatus('saved')
    } catch (err) {
      setFields((err as ApiError).fields)
      setStatus('idle')
    }
  }

  return (
    <>
      <PageHeader title="Profile" description={`Member since ${formatDate(user!.createdAt.slice(0, 10), { month: 'long', year: 'numeric' })}.`} />
      <div className="max-w-2xl space-y-8">
        <Panel title="Your details" subtitle="The name an owner sees on a booking, and the number they call if they need to reach you.">
          <div className="flex items-center gap-4 pb-6 mb-6 border-b border-slate-100">
            <div className="scale-150 origin-left mr-4"><Avatar user={user!} /></div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Profile photo</p>
              <PhotoUpload className="mt-2" purpose="avatar" label={user!.avatar ? 'Change photo' : 'Upload photo'}
                onUploaded={() => api.me().then((r) => r.user && setUser(r.user))} />
            </div>
          </div>
          <form className="space-y-4" onSubmit={save} noValidate>
            <div>
              <label htmlFor="name" className="block text-xs font-bold uppercase text-slate-500 mb-1">Full name</label>
              <input id="name" autoComplete="name" className={inputClass} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setStatus('idle') }} />
              {fields.name && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.name}</p>}
            </div>
            {user!.email && (
              <div>
                <label htmlFor="email" className="block text-xs font-bold uppercase text-slate-500 mb-1">Email</label>
                <input id="email" type="email" className={`${inputClass} text-slate-500`} value={user!.email} readOnly />
                <p className="text-xs text-slate-400 mt-1">From your Google account.</p>
              </div>
            )}
            <div>
              <label htmlFor="phone" className="block text-xs font-bold uppercase text-slate-500 mb-1">Contact phone</label>
              <input id="phone" type="tel" autoComplete="tel" className={inputClass} placeholder="+91 98765 43210" value={form.phone} onChange={(e) => { setForm({ ...form, phone: e.target.value }); setStatus('idle') }} />
              {fields.phone && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.phone}</p>}
            </div>
            <div className="flex items-center gap-4">
              <button type="submit" disabled={status === 'saving'} className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-bold py-3 px-8 rounded-2xl text-sm">
                {status === 'saving' ? 'Saving…' : 'Save changes'}
              </button>
              {status === 'saved' && <p role="status" className="text-sm font-semibold text-brand-700"><i className="fa-solid fa-check mr-1" aria-hidden="true"></i>Saved</p>}
            </div>
          </form>
        </Panel>

        <Panel title="How you sign in" subtitle="There is no password on a Book My Get Away account, so there is none to be stolen.">
          <dl className="divide-y divide-slate-100 text-sm">
            <Row label="Method" value={user!.email ? 'Google' : 'A code sent to your phone'} />
            <Row label={user!.email ? 'Google account' : 'Phone number'} value={user!.email ?? user!.phone ?? '—'} />
            <Row label="Member since" value={formatDate(user!.createdAt.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' })} />
          </dl>
          <button
            type="button"
            onClick={logout}
            className="mt-6 text-xs font-bold text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-100 py-3 px-5 rounded-2xl"
          >
            <i className="fa-solid fa-right-from-bracket mr-2" aria-hidden="true"></i>Sign out on this device
          </button>
        </Panel>

        <Panel title="Your data">
          <p className="text-sm text-slate-600">
            Book My Get Away keeps your name, how you sign in, your bookings and the reviews you have written. Owners see your name
            and your contact number only once a booking of theirs is confirmed. Nothing is sold to anyone.
          </p>
          <p className="text-xs text-slate-500 mt-3">
            <a href={appLink('website', '/privacy')} className="font-semibold text-brand-700">Read the privacy notice →</a>
          </p>
          <p className="text-xs text-slate-500 mt-4">
            To have your account and its history deleted, ask us from the Help page. Bookings already invoiced have to be
            kept for as long as tax law requires.
          </p>
        </Panel>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3 flex items-center justify-between gap-4 first:pt-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900 text-right break-all">{value}</dd>
    </div>
  )
}
