import { useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import { adminApi, type AuditEntry } from '@meridian/shared/client'
import { tableClass, th, theadClass } from '../components/Toolbar'

const labels: Record<string, string> = {
  'listing.approve': 'Approved listing', 'listing.reject': 'Rejected listing', 'listing.feature': 'Featured listing', 'listing.unfeature': 'Removed from homepage',
  'booking.cancel': 'Cancelled booking', 'user.role': 'Changed role', 'user.suspend': 'Suspended user', 'user.restore': 'Restored user',
  'review.hide': 'Hid review', 'review.restore': 'Restored review', 'message.status': 'Updated message',
  'settings.update': 'Edited website settings', 'page.save': 'Saved page', 'page.delete': 'Deleted page',
  'db.update': 'Edited a database record', 'db.insert': 'Added a database record', 'db.delete': 'Deleted a database record',
}

export function Activity() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    adminApi.audit().then((r) => setEntries(r.entries)).catch((e) => setError(e.message))
  }, [])

  return (
    <>
      <PageHeader title="Activity log" description="Every action taken in the control center, newest first." />
      <Panel>
        {error ? <ErrorNote message={error} /> : !entries ? <Spinner /> : entries.length === 0 ? <p className="text-sm text-slate-500">No admin actions yet.</p> : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={theadClass}><tr><th className={th}>When</th><th className={th}>Admin</th><th className={th}>Action</th><th className={th}>Target</th><th className={th}>Details</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="p-3 whitespace-nowrap">{new Date(e.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td className="p-3 font-semibold text-slate-900">{e.adminName ?? 'Deleted user'}</td>
                    <td className="p-3">{labels[e.action] ?? e.action}</td>
                    <td className="p-3 font-mono">{e.targetType} {e.targetId}</td>
                    <td className="p-3 text-slate-500 max-w-xs truncate">{Object.keys(e.details).length ? Object.entries(e.details).map(([k, v]) => `${k}: ${v}`).join(', ') : '—'}</td>
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
