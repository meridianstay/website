import { useEffect, useState, type ReactNode } from 'react'

/** Search box (debounced) plus optional filter chips, used above admin tables. */
export function Toolbar({ placeholder, onSearch, children }: { placeholder: string; onSearch: (q: string) => void; children?: ReactNode }) {
  const [q, setQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => onSearch(q.trim()), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
      <div className="relative md:w-80">
        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs" aria-hidden="true"></i>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder}
          className="w-full bg-slate-50 border border-slate-200 rounded-full pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-brand-500" />
      </div>
      {children && <div className="flex gap-2 overflow-x-auto">{children}</div>}
    </div>
  )
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
      {children}
    </button>
  )
}

export const th = 'p-3 text-left'
export const tableClass = 'w-full text-left text-xs text-slate-600'
export const theadClass = 'bg-slate-50 uppercase font-bold text-slate-400 border-b border-slate-200'
