import { useState } from 'react'
import { PageHeader, Panel, useAuth } from '@meridian/ui'
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
          <form className="space-y-4" onSubmit={save} noValidate>
            <div>
              <label htmlFor="name" className="block text-xs font-bold uppercase text-slate-500 mb-1">Full name</label>
              <input id="name" autoComplete="name" className={inputClass} value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setStatus('idle') }} />
              {fields.name && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.name}</p>}
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-bold uppercase text-slate-500 mb-1">Email</label>
              <input id="email" type="email" className={`${inputClass} text-slate-500`} value={user!.email} readOnly />
              <p className="text-xs text-slate-400 mt-1">Contact us to change the email on your account.</p>
            </div>
            <div>
              <label htmlFor="phone" className="block text-xs font-bold uppercase text-slate-500 mb-1">Phone</label>
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
        <div className="mt-8"><ChangePassword /></div>
      </div>
    </>
  )
}

function ChangePassword() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [fields, setFields] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.next !== form.confirm) return setFields({ confirm: 'The new passwords don’t match.' })
    setStatus('saving')
    setFields({})
    try {
      await api.changePassword(form.current, form.next)
      setForm({ current: '', next: '', confirm: '' })
      setStatus('saved')
    } catch (err) {
      setFields((err as ApiError).fields)
      setStatus('idle')
    }
  }

  const field = (key: 'current' | 'next' | 'confirm', label: string, apiKey: string, autoComplete: string) => (
    <div>
      <label htmlFor={`pw-${key}`} className="block text-xs font-bold uppercase text-slate-500 mb-1">{label}</label>
      <input id={`pw-${key}`} type="password" autoComplete={autoComplete} className={inputClass} value={form[key]} onChange={(e) => { setForm({ ...form, [key]: e.target.value }); setStatus('idle') }} />
      {fields[apiKey] && <p className="text-xs text-rose-600 font-semibold mt-1">{fields[apiKey]}</p>}
    </div>
  )

  return (
    <Panel title="Change password">
      <form className="space-y-4" onSubmit={save} noValidate>
        {field('current', 'Current password', 'currentPassword', 'current-password')}
        {field('next', 'New password (at least 8 characters)', 'newPassword', 'new-password')}
        {field('confirm', 'Repeat new password', 'confirm', 'new-password')}
        <div className="flex items-center gap-4">
          <button type="submit" disabled={status === 'saving' || !form.current || !form.next} className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold py-3 px-8 rounded-2xl text-sm">
            {status === 'saving' ? 'Updating…' : 'Update password'}
          </button>
          {status === 'saved' && <p role="status" className="text-sm font-semibold text-brand-700"><i className="fa-solid fa-check mr-1" aria-hidden="true"></i>Password updated</p>}
        </div>
      </form>
    </Panel>
  )
}
