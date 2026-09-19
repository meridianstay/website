import { useEffect, useState } from 'react'
import { defaultHomeLayout, type HomeLayout, type PropertySummary } from '@meridian/shared'
import { api } from '@meridian/shared/client'
import { ErrorNote } from '@meridian/ui'
import { Hero } from '../components/Hero'
import { HomeSection } from '../components/HomeSections'
import { useDocumentTitle } from '../lib/useDocumentTitle'

/** The homepage, arranged in the control center (Website content → Homepage). */
export function Home() {
  useDocumentTitle(null)
  const [data, setData] = useState<{ layout: HomeLayout; stays: Record<string, PropertySummary[]> } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    api.home().then(setData).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  // Until the layout arrives, show the hero's first slide and placeholder rows.
  const layout = data?.layout ?? { ...defaultHomeLayout(), hero: { ...defaultHomeLayout().hero, mode: 'static' as const } }

  return (
    <>
      <Hero key={data ? 'live' : 'loading'} hero={layout.hero} />
      {error && <div className="max-w-[1180px] mx-auto px-5 pt-10"><ErrorNote message={error} onRetry={load} /></div>}
      {layout.blocks.filter((b) => b.enabled).map((b) => (
        <HomeSection key={b.id} block={b} stays={data ? data.stays[b.id] ?? [] : null} />
      ))}
    </>
  )
}
