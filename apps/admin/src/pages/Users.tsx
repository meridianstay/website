import { useCallback, useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner, useAuth } from '@meridian/ui'
import { formatDate, type UserRole } from '@meridian/shared'
import { adminApi, type AdminUser } from '@meridian/shared/client'
import { Chip, Toolbar, tableClass, th, theadClass } from '../components/Toolbar'

const roles: (UserRole | 'all')[] = ['all', 'guest', 'host', 'admin']

export function Users() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [q, setQ] = useState('')
  const [role, setRole] = useState<(typeof roles)[number]>('all')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    adminApi.users({ q: q || undefined, role: role === 'all' ? undefined : role }).then((r) => setUsers(r.users)).catch((e) => setError(e.message))
  }, [q, role])
  useEffect(load, [load])

  const update = async (id: number, data: { role?: UserRole; suspended?: boolean }) => {
    setError(null)
    try {
      await adminApi.updateUser(id, data)
      load()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <>
      <PageHeader title="Users" description="Change roles and suspend accounts. Suspended users are signed out everywhere and can’t log in." />
      <Panel>
        <Toolbar placeholder="Search name, email or phone" onSearch={setQ}>
          {roles.map((r) => <Chip key={r} active={role === r} onClick={() => setRole(r)}>{r === 'all' ? 'Everyone' : `${r[0].toUpperCase()}${r.slice(1)}s`}</Chip>)}
        </Toolbar>
        {error && <div className="mb-4"><ErrorNote message={error} /></div>}
        {!users ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead className={theadClass}>
                <tr><th className={th}>Name</th><th className={th}>Role</th><th className={th}>Activity</th><th className={th}>Joined</th><th className={th}>Status</th><th className={`${th} text-right`}>Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const self = u.id === me?.id
                  return (
                    <tr key={u.id} className={u.suspended ? 'bg-rose-50/40' : ''}>
                      <td className="p-3"><span className="font-semibold text-slate-900">{u.name}</span>{self && <span className="text-slate-400"> (you)</span>}<br /><span className="text-slate-400">{[u.email, u.phone].filter(Boolean).join(' · ')}</span></td>
                      <td className="p-3">
                        <label className="sr-only" htmlFor={`role-${u.id}`}>Role for {u.name}</label>
                        <select id={`role-${u.id}`} value={u.role} disabled={self} onChange={(e) => update(u.id, { role: e.target.value as UserRole })} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-semibold disabled:opacity-50">
                          <option value="guest">Guest</option><option value="host">Host</option><option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="p-3">{u.bookings} bookings · {u.listings} listings</td>
                      <td className="p-3 whitespace-nowrap">{formatDate(u.createdAt.slice(0, 10), { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td className="p-3">{u.suspended ? <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-700">Suspended</span> : <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-brand-100 text-brand-700">Active</span>}</td>
                      <td className="p-3 text-right">
                        {!self && (u.suspended ? (
                          <button type="button" onClick={() => update(u.id, { suspended: false })} className="text-brand-700 font-bold hover:underline">Restore</button>
                        ) : (
                          <button type="button" onClick={() => window.confirm(`Suspend ${u.name}? They’ll be signed out immediately.`) && update(u.id, { suspended: true })} className="text-rose-600 font-bold hover:underline">Suspend</button>
                        ))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
