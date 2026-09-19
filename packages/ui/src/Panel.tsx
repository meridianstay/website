import type { ReactNode } from 'react'

/** White rounded container used for tables and grouped content. */
export function Panel({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
      {(title || action) && (
        <div className="flex items-center justify-between mb-6">
          {title && <h2 className="text-lg font-bold text-slate-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
