import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ErrorNote, PageHeader, Spinner } from '@meridian/ui'
import type { DbTableSummary } from '@meridian/shared'
import { adminApi } from '@meridian/shared/client'

export function Database() {
  const [tables, setTables] = useState<DbTableSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    adminApi.dbTables().then((r) => setTables(r.tables)).catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorNote message={error} />
  if (!tables) return <Spinner />

  return (
    <>
      <PageHeader
        title="Database"
        description="Browse every table and fix data directly. Passwords and session tokens are never shown, the database’s own rules still apply, and every change is recorded in the activity log."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {tables.map((t, i) => (
          <Link
            key={t.name}
            to={`/database/${t.name}`}
            style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
            className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:-translate-y-0.5 transition animate-fade-up"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900">{t.label}</p>
                <p className="font-mono text-[11px] text-slate-400">{t.name}</p>
              </div>
              <span className="text-2xl font-extrabold text-slate-900 tabular-nums">{t.rows.toLocaleString('en-IN')}</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">{t.description}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {!t.canEdit && !t.canInsert && !t.canDelete && <Tag tone="slate">Read-only</Tag>}
              {t.canEdit && <Tag tone="brand">Edit</Tag>}
              {t.canInsert && <Tag tone="brand">Add</Tag>}
              {t.canDelete && <Tag tone="rose">Delete</Tag>}
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}

function Tag({ tone, children }: { tone: 'slate' | 'brand' | 'rose'; children: string }) {
  const tones = { slate: 'bg-slate-100 text-slate-600', brand: 'bg-brand-100 text-brand-700', rose: 'bg-rose-100 text-rose-700' }
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${tones[tone]}`}>{children}</span>
}
