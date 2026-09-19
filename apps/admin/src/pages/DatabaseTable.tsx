import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router'
import { ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import type { DbBrowseResult, DbColumn, DbRow } from '@meridian/shared'
import { ApiError, adminApi } from '@meridian/shared/client'
import { Toolbar } from '../components/Toolbar'

const PAGE_SIZE = 25

/** Shows a cell value compactly in the table. */
function preview(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  const s = String(value)
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : s
}

/** The value as it appears in an input. */
const toInput = (value: unknown, col: DbColumn) =>
  value === null || value === undefined ? '' : col.type === 'jsonb' || col.type === 'json' ? JSON.stringify(value, null, 2) : String(value)

export function DatabaseTable() {
  const { table = '' } = useParams()
  const [data, setData] = useState<DbBrowseResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useState({ page: 1, q: '', sort: '', dir: 'desc' as 'asc' | 'desc' })
  const [open, setOpen] = useState<{ row: DbRow; key: DbRow | null } | 'new' | null>(null)

  const load = useCallback(() => {
    setError(null)
    adminApi
      .dbBrowse(table, { page: params.page, pageSize: PAGE_SIZE, q: params.q || undefined, sort: params.sort || undefined, dir: params.dir })
      .then(setData)
      .catch((e) => setError(e.message))
  }, [table, params])
  useEffect(load, [load])

  if (error && !data) return <ErrorNote message={error} onRetry={load} />
  if (!data) return <Spinner />

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize))
  const sortBy = (name: string) =>
    setParams((p) => ({ ...p, page: 1, sort: name, dir: data.sort === name && data.dir === 'desc' ? 'asc' : 'desc' }))

  return (
    <>
      <Link to="/database" className="text-xs font-bold text-slate-600 hover:text-slate-900 inline-flex items-center space-x-2 mb-4">
        <i className="fa-solid fa-arrow-left" aria-hidden="true"></i><span>All tables</span>
      </Link>
      <PageHeader
        title={data.table.label}
        description={`${data.table.description} ${data.total.toLocaleString('en-IN')} rows · table ${data.table.name}`}
        action={data.table.canInsert ? (
          <button type="button" onClick={() => setOpen('new')} className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-3 px-5 rounded-2xl">
            <i className="fa-solid fa-plus mr-1.5" aria-hidden="true"></i>Add row
          </button>
        ) : undefined}
      />
      {data.table.note && (
        <p className="mb-6 text-xs text-slate-600 bg-slate-100 rounded-xl p-3"><i className="fa-solid fa-circle-info mr-1.5 text-slate-400" aria-hidden="true"></i>{data.table.note}</p>
      )}
      <Panel>
        <Toolbar placeholder="Search every column" onSearch={(q) => setParams((p) => ({ ...p, q, page: 1 }))} />
        {error && <div className="mb-4"><ErrorNote message={error} /></div>}
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {data.columns.map((c) => (
                  <th key={c.name} className="p-2 whitespace-nowrap">
                    <button type="button" onClick={() => sortBy(c.name)} className="font-bold uppercase text-slate-400 hover:text-slate-900 inline-flex items-center gap-1">
                      {c.isKey && <i className="fa-solid fa-key text-[9px] text-brand-yellow-600" aria-label="key"></i>}
                      {c.name}
                      {data.sort === c.name && <i className={`fa-solid fa-arrow-${data.dir === 'asc' ? 'up' : 'down'} text-[9px]`} aria-hidden="true"></i>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.map((row, i) => (
                <tr key={i} onClick={() => setOpen({ row, key: data.keys[i] })} className="hover:bg-brand-50/50 cursor-pointer">
                  {data.columns.map((c) => (
                    <td key={c.name} className="p-2 max-w-[240px] truncate font-mono text-[11px]" title={preview(row[c.name])}>
                      {preview(row[c.name])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length === 0 && <p className="text-sm text-slate-500 p-4">No rows{params.q ? ' match your search' : ''}.</p>}
        </div>
        <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
          <span>Page {data.page} of {pages}</span>
          <span className="flex gap-2">
            <button type="button" disabled={data.page <= 1} onClick={() => setParams((p) => ({ ...p, page: p.page - 1 }))} className="px-3 py-1.5 rounded-lg bg-slate-100 font-bold disabled:opacity-40">Previous</button>
            <button type="button" disabled={data.page >= pages} onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))} className="px-3 py-1.5 rounded-lg bg-slate-100 font-bold disabled:opacity-40">Next</button>
          </span>
        </div>
      </Panel>

      {open && (
        <RowEditor
          table={data.table}
          columns={data.columns}
          target={open}
          onClose={() => setOpen(null)}
          onSaved={() => { setOpen(null); load() }}
        />
      )}
    </>
  )
}

function RowEditor({ table, columns, target, onClose, onSaved }: {
  table: DbBrowseResult['table']
  columns: DbColumn[]
  target: { row: DbRow; key: DbRow | null } | 'new'
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = target === 'new'
  const original = isNew ? {} : target.row
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(columns.map((c) => [c.name, isNew ? '' : toInput(original[c.name], c)])))
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const canEdit = (c: DbColumn) => (isNew ? c.insertable : c.editable && !!(target as { key: DbRow | null }).key)
  const changed = columns.filter((c) => canEdit(c) && values[c.name] !== (isNew ? '' : toInput(original[c.name], c)))

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    setFields({})
    try {
      await fn()
      onSaved()
    } catch (err) {
      setFields((err as ApiError).fields ?? {})
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const save = () =>
    run(() => isNew
      ? adminApi.dbInsert(table.name, Object.fromEntries(columns.filter((c) => c.insertable).map((c) => [c.name, values[c.name]])))
      : adminApi.dbUpdate(table.name, (target as { key: DbRow }).key, Object.fromEntries(changed.map((c) => [c.name, values[c.name]]))))

  const remove = () => {
    if (!window.confirm('Delete this row permanently? This can’t be undone.')) return
    run(() => adminApi.dbDelete(table.name, (target as { key: DbRow }).key))
  }

  const inputClass = (name: string) =>
    `w-full bg-slate-50 border rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:border-brand-500 ${fields[name] ? 'border-rose-400' : 'border-slate-200'}`

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-sm flex justify-end animate-fade-in" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={isNew ? `Add ${table.label} row` : `${table.label} row`}
        className="bg-white w-full max-w-xl h-full overflow-y-auto shadow-2xl focus:outline-none animate-slide-up sm:animate-scale-in">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">{table.label}</p>
            <h2 className="font-bold text-slate-900">{isNew ? 'Add a row' : 'Row details'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full hover:bg-slate-100 text-slate-500"><i className="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
        <div className="p-6 space-y-4">
          {!isNew && !(target as { key: DbRow | null }).key && (
            <p className="text-xs text-slate-600 bg-slate-100 rounded-xl p-3">This row’s key is secret, so it can only be viewed here.</p>
          )}
          {columns.filter((c) => !isNew || c.insertable).map((c) => {
            const id = `col-${c.name}`
            const editable = canEdit(c)
            return (
              <div key={c.name}>
                <label htmlFor={id} className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1">
                  <span className="font-mono">{c.name}</span>
                  <span className="font-normal text-slate-400">{c.type}{c.nullable ? ' · optional' : ''}{editable ? '' : ' · read-only'}</span>
                </label>
                {!editable ? (
                  <pre id={id} className="w-full bg-slate-50 rounded-xl p-2.5 text-xs font-mono text-slate-700 whitespace-pre-wrap break-all">{toInput(original[c.name], c) || '—'}</pre>
                ) : c.options ? (
                  <select id={id} className={inputClass(c.name)} value={values[c.name]} onChange={(e) => setValues({ ...values, [c.name]: e.target.value })}>
                    {c.nullable && <option value="">—</option>}
                    {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : c.type === 'boolean' ? (
                  <select id={id} className={inputClass(c.name)} value={values[c.name]} onChange={(e) => setValues({ ...values, [c.name]: e.target.value })}>
                    <option value="true">true</option><option value="false">false</option>
                  </select>
                ) : c.type === 'text' && (values[c.name].length > 60 || ['description', 'comment', 'message', 'special_requests'].includes(c.name)) || c.type === 'jsonb' ? (
                  <textarea id={id} rows={5} className={inputClass(c.name)} value={values[c.name]} onChange={(e) => setValues({ ...values, [c.name]: e.target.value })} />
                ) : (
                  <input id={id} className={inputClass(c.name)} value={values[c.name]} placeholder={isNew && c.hasDefault ? 'Leave empty for the default' : ''}
                    inputMode={['integer', 'smallint', 'bigint', 'numeric'].includes(c.type) ? 'decimal' : undefined}
                    onChange={(e) => setValues({ ...values, [c.name]: e.target.value })} />
                )}
                {fields[c.name] && <p className="text-xs text-rose-600 font-semibold mt-1">{fields[c.name]}</p>}
              </div>
            )
          })}
          {error && <ErrorNote message={error} />}
        </div>
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-100 px-6 py-4 flex items-center gap-3">
          {(isNew || changed.length > 0) && (
            <button type="button" onClick={save} disabled={busy} className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white text-sm font-bold py-2.5 px-6 rounded-xl">
              {busy ? 'Saving…' : isNew ? 'Add row' : `Save ${changed.length} change${changed.length === 1 ? '' : 's'}`}
            </button>
          )}
          <button type="button" onClick={onClose} className="text-sm font-bold text-slate-600 px-3">Close</button>
          {!isNew && table.canDelete && (target as { key: DbRow | null }).key && (
            <button type="button" onClick={remove} disabled={busy} className="ml-auto text-sm font-bold text-rose-600 hover:underline">Delete row</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
