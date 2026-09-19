import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import { formatDateRange, todayISO } from '@meridian/shared'
import { ApiError, hostApi, type HostCalendar, type HostListing } from '@meridian/shared/client'

const inputClass = 'w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500'

/** Upcoming bookings and host-blocked nights for one listing. */
export function ListingCalendar() {
  const id = Number(useParams().id)
  const [listing, setListing] = useState<HostListing | null>(null)
  const [calendar, setCalendar] = useState<HostCalendar | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ checkIn: '', checkOut: '', note: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    Promise.all([hostApi.listings(), hostApi.calendar(id)])
      .then(([l, c]) => {
        setListing(l.listings.find((x) => x.id === id) ?? null)
        setCalendar(c)
      })
      .catch((e) => setError(e.message))
  }
  useEffect(load, [id])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError(null)
    try {
      await hostApi.addBlock(id, form)
      setForm({ checkIn: '', checkOut: '', note: '' })
      load()
    } catch (err) {
      setFormError((err as ApiError).message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (blockId: number) => {
    await hostApi.removeBlock(id, blockId).catch((e) => setFormError(e.message))
    load()
  }

  if (error) return <ErrorNote message={error} onRetry={load} />
  if (!calendar) return <Spinner />

  return (
    <>
      <Link to="/listings" className="text-xs font-bold text-slate-600 hover:text-slate-900 inline-flex items-center space-x-2 mb-4">
        <i className="fa-solid fa-arrow-left" aria-hidden="true"></i><span>My listings</span>
      </Link>
      <PageHeader title="Calendar" description={listing ? `${listing.title} · block nights when the place isn’t available.` : undefined} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <Panel title="Block dates">
          <form onSubmit={add} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="b-start" className="block text-xs font-bold uppercase text-slate-500 mb-1">First night</label>
                <input id="b-start" type="date" min={todayISO()} className={inputClass} value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
              </div>
              <div>
                <label htmlFor="b-end" className="block text-xs font-bold uppercase text-slate-500 mb-1">Available again</label>
                <input id="b-end" type="date" min={form.checkIn || todayISO()} className={inputClass} value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
              </div>
            </div>
            <div>
              <label htmlFor="b-note" className="block text-xs font-bold uppercase text-slate-500 mb-1">Note (only you see this)</label>
              <input id="b-note" maxLength={200} className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Maintenance" />
            </div>
            {formError && <p role="alert" className="text-xs text-rose-600 font-semibold">{formError}</p>}
            <button type="submit" disabled={saving || !form.checkIn || !form.checkOut} className="bg-slate-900 disabled:bg-slate-300 text-white font-bold py-3 px-6 rounded-2xl text-sm">
              {saving ? 'Saving…' : 'Block these dates'}
            </button>
          </form>

          <h3 className="font-bold text-slate-900 mt-8 mb-3">Blocked</h3>
          {calendar.blocks.length === 0 ? <p className="text-sm text-slate-500">No blocked dates.</p> : (
            <ul className="divide-y divide-slate-100">
              {calendar.blocks.map((b) => (
                <li key={b.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                  <span><span className="font-semibold text-slate-900">{formatDateRange(b.checkIn, b.checkOut)}</span>{b.note && <span className="text-slate-500"> · {b.note}</span>}</span>
                  <button type="button" onClick={() => remove(b.id)} className="text-xs font-bold text-rose-600 hover:underline">Unblock</button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Booked by guests">
          {calendar.bookings.length === 0 ? <p className="text-sm text-slate-500">No upcoming bookings.</p> : (
            <ul className="divide-y divide-slate-100">
              {calendar.bookings.map((b) => (
                <li key={b.code} className="py-3 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-900">{formatDateRange(b.checkIn, b.checkOut)}</span>
                  <span className="text-slate-500">{b.guestName} · <span className="font-mono text-xs">{b.code}</span></span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}
