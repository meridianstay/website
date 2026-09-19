import { Link } from 'react-router'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export function NotFound({ what = 'page' }: { what?: string }) {
  useDocumentTitle(`${what === 'page' ? 'Page' : 'Stay'} not found`)
  return (
    <div className="max-w-md mx-auto my-20 px-5 text-center">
      <p className="text-6xl font-extrabold text-brand-600 mb-2">404</p>
      <h1 className="text-2xl font-extrabold text-slate-900">We couldn’t find that {what}</h1>
      <p className="text-sm text-slate-500 mt-2">It may have moved, or the link may be wrong.</p>
      <div className="flex justify-center gap-3 mt-6">
        <Link to="/" className="bg-slate-900 text-white text-xs font-bold py-3 px-6 rounded-2xl">Go home</Link>
        <Link to="/search" className="bg-slate-100 text-slate-800 text-xs font-bold py-3 px-6 rounded-2xl">Browse stays</Link>
      </div>
    </div>
  )
}
