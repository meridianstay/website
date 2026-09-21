import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import { formatDate, type AnnouncementSettings, type ContentPage } from '@meridian/shared'
import { ApiError, adminApi, appLink } from '@meridian/shared/client'

const input = 'w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500'

export function Website() {
  const [announcement, setAnnouncement] = useState<AnnouncementSettings | null>(null)
  const [pages, setPages] = useState<ContentPage[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([adminApi.settings(), adminApi.pages()])
      .then(([s, p]) => {
        setAnnouncement(s.announcement)
        setPages(p.pages)
      })
      .catch((e) => setError(e.message))
  }, [])

  if (error) return <ErrorNote message={error} />
  if (!announcement || !pages) return <Spinner />

  return (
    <>
      <PageHeader
        title="Website content"
        description="Edit what visitors see on the public website. Changes go live as soon as you save."
        action={<a href={appLink('website', '/')} target="_blank" rel="noreferrer" className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-3 px-5 rounded-2xl"><i className="fa-solid fa-arrow-up-right-from-square mr-2" aria-hidden="true"></i>Open website</a>}
      />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        <Panel title="Homepage" action={<Link to="/website/homepage" className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl"><i className="fa-solid fa-pen mr-1.5" aria-hidden="true"></i>Edit homepage</Link>}>
          <p className="text-sm text-slate-500">
            The hero (a static banner or a slider) and every section below it: property types, rows of stays chosen by simple rules (featured, highest rated, instant book, a destination, a budget…) and banners. Add, reorder, hide or remove sections.
          </p>
        </Panel>

        <SettingsForm title="Announcement banner" save={() => adminApi.saveAnnouncement(announcement)}>
          <label className="flex items-center space-x-3 text-sm font-semibold text-slate-800">
            <input type="checkbox" className="accent-brand-600 w-4 h-4" checked={announcement.enabled} onChange={(e) => setAnnouncement({ ...announcement, enabled: e.target.checked })} />
            <span>Show a banner at the top of every page</span>
          </label>
          <Text label="Message" value={announcement.text} onChange={(v) => setAnnouncement({ ...announcement, text: v })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Text label="Link text (optional)" value={announcement.linkLabel} onChange={(v) => setAnnouncement({ ...announcement, linkLabel: v })} />
            <Text label="Link address, e.g. /search" value={announcement.linkUrl} onChange={(v) => setAnnouncement({ ...announcement, linkUrl: v })} />
          </div>
          {announcement.enabled && announcement.text && (
            <div className="bg-slate-900 text-white text-xs text-center rounded-xl px-4 py-2.5">
              <i className="fa-solid fa-bullhorn text-brand-yellow-400 mr-2" aria-hidden="true"></i>{announcement.text}
              {announcement.linkLabel && <span className="ml-2 font-bold underline text-brand-yellow-400">{announcement.linkLabel}</span>}
            </div>
          )}
        </SettingsForm>
      </div>

      <div className="mb-8"><Panel title="Logos, colours, languages & footer" action={<Link to="/website/branding" className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl"><i className="fa-solid fa-pen mr-1.5" aria-hidden="true"></i>Edit</Link>}>
        <p className="text-sm text-slate-500">
          The languages the site is offered in, the colour palette, a separate logo and name for the website, the host portal, the guest account and this control centre, and what shows in the header bar and every footer column.
        </p>
      </Panel></div>

      <div className="mb-8"><Panel title="About us page" action={<Link to="/website/about" className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl"><i className="fa-solid fa-pen mr-1.5" aria-hidden="true"></i>Edit</Link>}>
        <p className="text-sm text-slate-500">
          Mission, vision, company story, journey, founder, team, goals, global and local impact, and why travellers choose Meridian, at{' '}
          <a href={appLink('website', '/about')} target="_blank" rel="noreferrer" className="font-semibold underline">/about</a>.
        </p>
      </Panel></div>

      <Panel title="Pages" action={<Link to="/website/pages/new" className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl"><i className="fa-solid fa-plus mr-1.5" aria-hidden="true"></i>New page</Link>}>
        <p className="text-sm text-slate-500 mb-4">Help, policies and other information pages. Footer links point to these addresses.</p>
        <ul className="divide-y divide-slate-100">
          {pages.map((p) => (
            <li key={p.slug} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-bold text-sm text-slate-900">
                  {p.title}
                  {!p.published && <span className="ml-2 text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Unpublished</span>}
                  {p.draft && <span className="ml-2 text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">Draft notice</span>}
                </p>
                <p className="text-xs text-slate-400">/{p.slug}{p.updatedAt && ` · updated ${formatDate(p.updatedAt.slice(0, 10), { month: 'short', day: 'numeric', year: 'numeric' })}`}</p>
              </div>
              <span className="flex gap-3 text-xs font-bold shrink-0">
                {p.published && <a href={appLink('website', `/${p.slug}`)} target="_blank" rel="noreferrer" className="text-slate-600 hover:underline">View</a>}
                <Link to={`/website/pages/${p.slug}`} className="text-brand-700 hover:underline">Edit</Link>
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}

function SettingsForm({ title, save, children }: { title: string; save: () => Promise<void>; children: ReactNode }) {
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)
  return (
    <Panel title={title}>
      <form
        className="space-y-4"
        onChange={() => state === 'saved' && setState('idle')}
        onSubmit={async (e) => {
          e.preventDefault()
          setState('saving')
          setError(null)
          try {
            await save()
            setState('saved')
          } catch (err) {
            const fields = (err as ApiError).fields
            setError(Object.keys(fields).length ? Object.values(fields).join(' ') : (err as Error).message)
            setState('idle')
          }
        }}
      >
        {children}
        {error && <p role="alert" className="text-xs text-rose-600 font-semibold">{error}</p>}
        <div className="flex items-center gap-4">
          <button type="submit" disabled={state === 'saving'} className="bg-slate-900 disabled:bg-slate-400 text-white font-bold py-3 px-6 rounded-2xl text-sm">{state === 'saving' ? 'Saving…' : 'Save'}</button>
          {state === 'saved' && <p role="status" className="text-sm font-semibold text-brand-700"><i className="fa-solid fa-check mr-1" aria-hidden="true"></i>Live on the website</p>}
        </div>
      </form>
    </Panel>
  )
}

export function Text({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  const id = `f-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold uppercase text-slate-500 mb-1">{label}</label>
      {multiline ? (
        <textarea id={id} rows={3} maxLength={400} className={input} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} maxLength={400} className={input} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}
