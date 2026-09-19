import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { PropertySummary } from '@meridian/shared'
import { api, appLink } from '@meridian/shared/client'
import { PROPERTY_TYPES, searchUrl } from '../lib/search'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export function Sitemap() {
  const [stays, setStays] = useState<PropertySummary[]>([])
  const [pages, setPages] = useState<{ slug: string; title: string }[]>([])
  useDocumentTitle('Sitemap')
  useEffect(() => {
    api.searchProperties({ limit: 100 }).then((r) => setStays(r.properties)).catch(() => {})
    api.pages().then((r) => setPages(r.pages)).catch(() => {})
  }, [])

  const col = 'space-y-2 text-sm'
  const link = 'text-slate-600 hover:text-brand-700 hover:underline'
  return (
    <div className="max-w-[1180px] mx-auto px-5 py-12">
      <h1 className="text-3xl font-extrabold text-slate-900 mb-8">Sitemap</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <section>
          <h2 className="font-bold text-slate-900 mb-3">Explore</h2>
          <ul className={col}>
            <li><Link to="/" className={link}>Home</Link></li>
            <li><Link to="/search" className={link}>All stays</Link></li>
            {PROPERTY_TYPES.map((t) => <li key={t.type}><Link to={searchUrl({ type: t.type })} className={link}>{t.label}</Link></li>)}
          </ul>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 mb-3">Stays</h2>
          <ul className={col}>{stays.map((s) => <li key={s.id}><Link to={`/stays/${s.slug}`} className={link}>{s.title}</Link></li>)}</ul>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 mb-3">Information</h2>
          <ul className={col}>
            {pages.map((p) => <li key={p.slug}><Link to={`/${p.slug}`} className={link}>{p.title}</Link></li>)}
            <li><Link to="/about" className={link}>About us</Link></li>
            <li><Link to="/contact" className={link}>Contact us</Link></li>
          </ul>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 mb-3">Your account</h2>
          <ul className={col}>
            <li><Link to="/login" className={link}>Log in</Link></li>
            <li><Link to="/signup" className={link}>Sign up</Link></li>
            <li><a href={appLink('account', '/')} className={link}>Trips</a></li>
            <li><a href={appLink('account', '/wishlist')} className={link}>Wishlist</a></li>
            <li><a href={appLink('host', '/')} className={link}>Host portal</a></li>
          </ul>
        </section>
      </div>
    </div>
  )
}
