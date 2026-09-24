import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { ContentPage } from '@meridian/shared'
import { ApiError, api } from '@meridian/shared/client'
import { ErrorNote, Spinner, useLanguage } from '@meridian/ui'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import { NotFound } from './NotFound'

/** Admin-editable information pages (help, policies, about…), served at /:slug. */
export function InfoPage() {
  const { lang } = useLanguage()
  const { slug = '' } = useParams()
  const [page, setPage] = useState<ContentPage | null>(null)
  const [error, setError] = useState<{ status: number; message: string } | null>(null)
  useDocumentTitle(page?.title)

  useEffect(() => {
    setPage(null)
    setError(null)
    let current = true
    api.page(slug, lang)
      .then((r) => { if (current) setPage(r.page) })
      .catch((e: ApiError) => { if (current) setError({ status: e.status, message: e.message }) })
    return () => { current = false }
  }, [slug, lang])

  if (error?.status === 404) return <NotFound />
  if (error) return <div className="max-w-3xl mx-auto px-5 py-12"><ErrorNote message={error.message} /></div>
  if (!page) return <Spinner />

  return (
    <article className="max-w-3xl mx-auto px-5 py-12">
      <nav className="text-xs text-slate-500 mb-4" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-slate-900">Home</Link><span className="mx-2">/</span><span className="text-slate-700">{page.title}</span>
      </nav>
      <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">{page.title}</h1>
      {page.intro && <p className="text-lg text-slate-600 mt-3 font-light">{page.intro}</p>}
      {page.draft && (
        <p className="mt-5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">
          <i className="fa-solid fa-triangle-exclamation mr-1.5" aria-hidden="true"></i>
          Draft: this page will be finalised before Meridian Stay launches.
        </p>
      )}
      <div className="mt-10 space-y-8">
        {page.sections.map((s, i) => (
          <section key={i}>
            {s.heading && <h2 className="text-lg font-bold text-slate-900 mb-2">{s.heading}</h2>}
            {s.body.map((p, j) => <p key={j} className="text-sm text-slate-600 leading-relaxed mb-2 whitespace-pre-line">{p}</p>)}
          </section>
        ))}
      </div>
      <div className="mt-12 bg-brand-50 border border-brand-100 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-slate-700">Still have a question?</p>
        <Link to="/contact" className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl text-center">Contact us</Link>
      </div>
    </article>
  )
}
