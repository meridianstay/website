import type { ReactNode } from 'react'

/** White rounded container used for tables and grouped content. */
export function Panel({ title, subtitle, action, children }: { title?: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 mb-6">
          {title && (
            <div>
              <h2 className="text-lg font-bold text-slate-900">{title}</h2>
              {subtitle && <p className="text-sm text-slate-500 mt-1 max-w-2xl">{subtitle}</p>}
            </div>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
