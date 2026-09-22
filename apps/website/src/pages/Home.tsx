import { useCallback, useEffect, useState } from 'react'
import { usePlace } from '../lib/place'
import { defaultHomeLayout, type HomeLayout, type PropertySummary } from '@meridian/shared'
import { api } from '@meridian/shared/client'
import { ErrorNote, useLanguage } from '@meridian/ui'
import { Hero } from '../components/Hero'
import { HomeSection } from '../components/HomeSections'
import { useDocumentTitle } from '../lib/useDocumentTitle'

/** The homepage, arranged in the control center (Website content → Homepage). */
export function Home() {
  const { lang } = useLanguage()
  useDocumentTitle(null)
  const [data, setData] = useState<{ layout: HomeLayout; stays: Record<string, PropertySummary[]> } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { place } = usePlace()
  const [nearby, setNearby] = useState<Record<string, PropertySummary[]>>({})
  const [promoted, setPromoted] = useState<(PropertySummary & { promotionId: number })[]>([])

  // "Near the visitor" rows: re-fetch nearest-first once we know where they are.
  useEffect(() => {
    if (!data || !place) return setNearby({})
    const blocks = data.layout.blocks.filter((b) => b.type === 'stays' && b.rule === 'nearby')
    Promise.all(blocks.map((b) => api.searchProperties({ sort: 'nearest', lat: place.lat, lng: place.lng, limit: b.limit }).then((r) => [b.id, r.properties] as const)))
      .then((rows) => setNearby(Object.fromEntries(rows)))
      .catch(() => {})
  }, [data, place])

  // Paid placements: fetched here so each view counts once.
  useEffect(() => {
    if (!data?.layout.blocks.some((b) => b.enabled && b.rule === 'promoted')) return
    api.promoted('home').then((r) => setPromoted(r.properties)).catch(() => {})
  }, [data])

  // Refetched when the reader changes language, because the headings are written in the control centre.
  const load = useCallback(() => {
    setError(null)
    api.home(lang).then(setData).catch((e) => setError(e.message))
  }, [lang])
  useEffect(load, [load])

  // Until the layout arrives, show the hero's first slide and placeholder rows.
  const layout = data?.layout ?? { ...defaultHomeLayout(), hero: { ...defaultHomeLayout().hero, mode: 'static' as const } }

  return (
    <>
      <Hero key={data ? 'live' : 'loading'} hero={layout.hero} />
      {error && <div className="max-w-[1180px] mx-auto px-5 pt-10"><ErrorNote message={error} onRetry={load} /></div>}
      {layout.blocks.filter((b) => b.enabled).map((b) => (
        <HomeSection key={b.id} block={{ ...b, title: b.title.replace('{place}', place ? (place.name === 'you' ? 'you' : place.name) : 'you') }}
          stays={data ? (b.rule === 'promoted' ? promoted : nearby[b.id] ?? data.stays[b.id] ?? []) : null}
          promoted={b.rule === 'promoted'} />
      ))}
    </>
  )
}
