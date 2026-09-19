import { PageHeader, Panel } from '@meridian/ui'
import { sampleUsers } from '@meridian/shared'

const roleTone = {
  admin: 'bg-amber-100 text-amber-800',
  host: 'bg-brand-100 text-brand-800',
  guest: 'bg-slate-100 text-slate-700',
}

export function Users() {
  return (
    <>
      <PageHeader title="Users" description="Guests, hosts and administrators." />
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 uppercase font-bold text-slate-400 border-b border-slate-200">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sampleUsers.map((u) => (
                <tr key={u.id}>
                  <td className="p-3 font-semibold text-slate-900">{u.name}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${roleTone[u.role]}`}>{u.role}</span>
                  </td>
                  <td className="p-3 tabular-nums">{u.joinedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
