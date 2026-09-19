import { useState } from 'react'
import { Avatar, PageHeader, Panel, PhotoUpload, useAuth } from '@meridian/ui'
import { formatDate } from '@meridian/shared'
import { ApiError, api } from '@meridian/shared/client'

const inputClass = 'w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500'

export function Profile() {
  const { user, setUser } = useAuth()
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
      <div className="max-w-2xl">
        <Panel>
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
      </div>
    </>
  )
}
