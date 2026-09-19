import { useCallback, useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner, StatusBadge } from '@meridian/ui'
import { formatDateRange, formatPrice } from '@meridian/shared'
import { adminApi, appLink, type AdminBooking } from '@meridian/shared/client'
import { Toolbar, tableClass, th, theadClass } from '../components/Toolbar'

export function Bookings() {
  const [bookings, setBookings] = useState<AdminBooking[] | null>(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const load = useCallback(() => {
    adminApi.bookings(q || undefined).then((r) => setBookings(r.bookings)).catch((e) => setError(e.message))
  }, [q])
  useEffect(load, [load])

  const cancel = async (code: string) => {
    setError(null)
    try {
      await adminApi.cancelBooking(code)
      setConfirming(null)
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <>
      <PageHeader title="Bookings" description="Every reservation on the platform. Cancel on a guest’s or host’s behalf when needed." />
      <Panel>
        <Toolbar placeholder="Search code, guest or stay" onSearch={setQ} />
        {error && <div className="mb-4"><ErrorNote message={error} /></div>}
        {!bookings ? <Spinner /> : bookings.length === 0 ? <p className="text-sm text-slate-500 p-3">No bookings match.</p> : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr><th className={th}>Code</th><th className={th}>Guest</th><th className={th}>Stay</th><th className={th}>Dates</th><th className={th}>Guests</th><th className={th}>Total</th><th className={th}>Status</th><th className={`${th} text-right`}>Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b.code}>
                    <td className="p-3 font-mono text-slate-500">{b.code}</td>
                    <td className="p-3"><span className="font-semibold text-slate-900">{b.guestName}</span><br /><span className="text-slate-400">{b.guestEmail} · {b.contactPhone}</span></td>
                    <td className="p-3"><a href={appLink('website', `/stays/${b.property.slug}`)} target="_blank" rel="noreferrer" className="hover:underline">{b.property.title}</a></td>
                    <td className="p-3 whitespace-nowrap">{formatDateRange(b.checkIn, b.checkOut)}</td>
                    <td className="p-3 tabular-nums">{b.guests}</td>
                    <td className="p-3 font-bold text-slate-900 tabular-nums">{formatPrice(b.total)}</td>
                    <td className="p-3"><StatusBadge status={b.status} /></td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {b.status === 'Confirmed' && (confirming === b.code ? (
                        <span className="inline-flex gap-2">
                          <button type="button" onClick={() => setConfirming(null)} className="text-slate-500 font-bold">Keep</button>
                          <button type="button" onClick={() => cancel(b.code)} className="bg-rose-600 text-white px-3 py-1.5 rounded-xl font-bold">Confirm cancel</button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirming(b.code)} className="text-rose-600 font-bold hover:underline">Cancel</button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
