import type { ReactNode } from 'react'
import { BrandLoader } from './Loader'

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return <BrandLoader label={label} />
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="animate-fade-in bg-rose-50 border border-rose-100 text-rose-700 text-sm rounded-2xl p-4 flex items-center justify-between gap-4">
      <span><i className="fa-solid fa-circle-exclamation mr-2" aria-hidden="true"></i>{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className="font-bold underline shrink-0">Try again</button>}
    </div>
  )
}

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-14 px-6 animate-fade-up">
      <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto text-xl mb-4">
        <i className={`fa-solid fa-${icon}`} aria-hidden="true"></i>
      </div>
      <h3 className="font-bold text-slate-900">{title}</h3>
      {body && <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
