import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ErrorNote, PageHeader, Panel, PhotoUpload, Spinner } from '@meridian/ui'
import {
  ACCENT_CHOICES, CLIENT_SECTIONS, dropSection, moveSection, newSection, sectionKind, siteAddress, withPageDefaults,
  type ClientPageDesign, type ClientSection, type ClientSectionType, type ClientSite,
} from '@meridian/shared'
import { hostApi } from '@meridian/shared/client'

// The landing-page editor, part of the Everything plan. The client drags the sections of their page
// into the order they want, switches the ones they don't want off, and writes their own headings.
//
// Dragging is not the only way to do it: every section also has up and down buttons, so the page can
// be arranged from a keyboard or a phone, where dragging is awkward or impossible.

export function PageEditor() {
  const [site, setSite] = useState<ClientSite | null>(null)
  const [design, setDesign] = useState<ClientPageDesign | null>(null)
  const [base, setBase] = useState('meridianstay.com')
  const [error, setError] = useState<string | null>(null)
  const [locked, setLocked] = useState(false)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [open, setOpen] = useState<string | null>(null)
  // The index being dragged is kept in a ref as well as state: the drop handler needs it the
  // instant it fires, and a state update from dragstart may not have been applied by then.
  const dragFrom = useRef<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  const load = () => {
    setError(null)
    hostApi
      .website()
      .then((r) => {
        setSite(r.site)
        setDesign(withPageDefaults(r.site.content.design))
        setBase(r.baseDomain)
      })
      .catch((e) => setError(e.message))
  }
  useEffect(load, [])

  // Whether this client's plan includes the editor at all.
  useEffect(() => {
    hostApi.subscription().then((r) => setLocked(!r.entitlements.pageEditor)).catch(() => {})
  }, [])

  if (error && !design) return <ErrorNote message={error} onRetry={load} />
  if (!site || !design) return <Spinner />

  if (locked) {
    return (
      <>
        <PageHeader title="Design your page" description="Arrange your landing page the way you want it." />
        <Panel title="Part of the Everything plan">
          <p className="text-sm text-slate-500">
            Dragging your page into the order you want — and switching sections off, writing your own headings and choosing your colours — comes with the
            Everything plan. Your website keeps working exactly as it is in the meantime.
          </p>
          <Link to="/plan" className="inline-block mt-5 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 px-6 rounded-2xl text-sm">
            See the plans
          </Link>
        </Panel>
      </>
    )
  }

  const touch = (next: ClientPageDesign) => {
    setDesign(next)
    setState('idle')
  }
  const patch = (id: string, change: Partial<ClientSection>) =>
    touch({ ...design, sections: design.sections.map((s) => (s.id === id ? { ...s, ...change } : s)) })

  const save = async () => {
    setState('saving')
    setError(null)
    try {
      const { site: next } = await hostApi.saveWebsiteDesign(design)
      setSite(next)
      setState('saved')
    } catch (e) {
      setError((e as Error).message)
      setState('idle')
    }
  }

  const reset = async () => {
    setState('saving')
    try {
      const { site: next } = await hostApi.resetWebsiteDesign()
      setSite(next)
      setDesign(withPageDefaults(next.content.design))
      setState('saved')
    } catch (e) {
      setError((e as Error).message)
      setState('idle')
    }
  }

  const add = (type: ClientSectionType) => touch({ ...design, sections: [...design.sections, newSection(type)] })
  const remove = (id: string) => touch({ ...design, sections: design.sections.filter((s) => s.id !== id) })

  const drop = (to: number) => {
    const from = dragFrom.current
    if (from !== null) touch({ ...design, sections: dropSection(design.sections, from, to) })
    dragFrom.current = null
    setDragging(null)
    setOver(null)
  }

  const address = siteAddress(site.published?.slug || site.content.slug, site.domain, base)
  const preview = `https://${address}`

  return (
    <>
      <PageHeader
        title="Design your page"
        description="Drag the sections into the order you want, switch off the ones you don't, and write your own headings. Your changes go to the Meridian team to check, the same as the rest of your website."
      />

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <button type="button" onClick={save} disabled={state === 'saving'} className="bg-slate-900 disabled:bg-slate-400 text-white font-bold py-2.5 px-6 rounded-2xl text-sm">
          {state === 'saving' ? 'Saving…' : 'Save arrangement'}
        </button>
        {state === 'saved' && <p role="status" className="text-sm font-semibold text-brand-700"><i className="fa-solid fa-check mr-1" aria-hidden="true"></i>Saved — your team will check it</p>}
        <a href={preview} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-brand-700">
          <i className="fa-solid fa-arrow-up-right-from-square mr-1.5" aria-hidden="true"></i>See your live page
        </a>
        <button type="button" onClick={reset} className="text-sm font-bold text-slate-500 hover:text-rose-600 ml-auto">Put it back the way it was</button>
      </div>
      {error && <p role="alert" className="rounded-2xl p-4 mb-8 text-sm bg-rose-50 text-rose-700 font-semibold">{error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-4">
          <ol className="space-y-3">
            {design.sections.map((section, i) => (
              <li
                key={section.id}
                draggable
                onDragStart={(e) => { dragFrom.current = i; setDragging(i); e.dataTransfer.effectAllowed = 'move' }}
                onDragEnd={() => { dragFrom.current = null; setDragging(null); setOver(null) }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== i) setOver(i) }}
                onDrop={(e) => { e.preventDefault(); drop(i) }}
                className={`bg-white rounded-2xl border transition ${
                  over === i && dragging !== null && dragging !== i ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-200'
                } ${dragging === i ? 'opacity-40' : ''} ${section.enabled ? '' : 'bg-slate-50'}`}
              >
                <SectionRow
                  section={section}
                  index={i}
                  total={design.sections.length}
                  expanded={open === section.id}
                  onToggleOpen={() => setOpen(open === section.id ? null : section.id)}
                  onMove={(by) => touch({ ...design, sections: moveSection(design.sections, i, by) })}
                  onChange={(change) => patch(section.id, change)}
                  onRemove={() => remove(section.id)}
                />
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-8">
          <Panel title="Add a section">
            <p className="text-sm text-slate-500 mb-4">Your own words, or a banner for an offer. Add as many as you like.</p>
            <div className="flex flex-wrap gap-3">
              {CLIENT_SECTIONS.filter((k) => k.repeatable).map((kind) => (
                <button key={kind.value} type="button" onClick={() => add(kind.value)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-5 rounded-xl text-xs">
                  <i className={`fa-solid fa-${kind.icon} mr-1.5`} aria-hidden="true"></i>{kind.label}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="The look of it">
            <div className="space-y-5">
              <div>
                <span className="block text-xs font-bold uppercase text-slate-500 mb-2">Where the booking box sits</span>
                <div className="grid grid-cols-2 gap-3">
                  {([['sidebar', 'Beside the page', 'Follows the guest down as they read.'], ['stacked', 'In the page', 'Wherever you drag it.']] as const).map(([value, label, hint]) => (
                    <label key={value} className={`cursor-pointer rounded-2xl border-2 p-3 ${design.layout === value ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                      <input type="radio" name="layout" value={value} checked={design.layout === value}
                        onChange={() => touch({ ...design, layout: value })} className="sr-only" />
                      <span className="block font-bold text-sm text-slate-900">{label}</span>
                      <span className="block text-xs text-slate-500 mt-0.5">{hint}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold uppercase text-slate-500 mb-2">The top of the page</span>
                <div className="grid grid-cols-2 gap-3">
                  {([['photo', 'Your photo'], ['plain', 'Plain colour']] as const).map(([value, label]) => (
                    <label key={value} className={`cursor-pointer rounded-2xl border-2 p-3 text-center ${design.heroStyle === value ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                      <input type="radio" name="hero" value={value} checked={design.heroStyle === value}
                        onChange={() => touch({ ...design, heroStyle: value })} className="sr-only" />
                      <span className="font-bold text-sm text-slate-900">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold uppercase text-slate-500 mb-2">Your colour</span>
                <div className="flex flex-wrap gap-2.5">
                  {ACCENT_CHOICES.map((choice) => (
                    <button
                      key={choice.value || 'default'}
                      type="button"
                      onClick={() => touch({ ...design, accent: choice.value })}
                      aria-label={choice.label}
                      aria-pressed={design.accent === choice.value}
                      title={choice.label}
                      className={`w-9 h-9 rounded-full border-2 ${design.accent === choice.value ? 'border-slate-900 scale-110' : 'border-white'} shadow transition`}
                      style={{ background: choice.value || '#059669' }}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-2">Used for the buttons and the highlights on your page.</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}

interface RowProps {
  section: ClientSection
  index: number
  total: number
  expanded: boolean
  onToggleOpen: () => void
  onMove: (by: -1 | 1) => void
  onChange: (change: Partial<ClientSection>) => void
  onRemove: () => void
}

function SectionRow({ section, index, total, expanded, onToggleOpen, onMove, onChange, onRemove }: RowProps) {
  const kind = sectionKind(section.type)
  const field = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-brand-500'
  const titleRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (expanded) titleRef.current?.focus()
  }, [expanded])

  return (
    <>
      <div className="flex items-center gap-3 p-3.5">
        <span className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 px-1" aria-hidden="true" title="Drag to reorder">
          <i className="fa-solid fa-grip"></i>
        </span>
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${section.enabled ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400'}`}>
          <i className={`fa-solid fa-${kind.icon} text-sm`} aria-hidden="true"></i>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-sm text-slate-900 truncate">
            {section.title || kind.label}
            {!section.enabled && <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">Hidden</span>}
          </span>
          <span className="block text-xs text-slate-500 truncate">{kind.explain}</span>
        </span>

        <span className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up"
            className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">
            <i className="fa-solid fa-arrow-up text-xs" aria-hidden="true"></i>
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move down"
            className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">
            <i className="fa-solid fa-arrow-down text-xs" aria-hidden="true"></i>
          </button>
          <button type="button" onClick={() => onChange({ enabled: !section.enabled })}
            aria-label={section.enabled ? 'Hide this section' : 'Show this section'} aria-pressed={!section.enabled}
            className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <i className={`fa-solid fa-${section.enabled ? 'eye' : 'ban'} text-xs`} aria-hidden="true"></i>
          </button>
          <button type="button" onClick={onToggleOpen} aria-expanded={expanded}
            className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Edit the wording">
            <i className={`fa-solid fa-${expanded ? 'chevron-up' : 'pen'} text-xs`} aria-hidden="true"></i>
          </button>
        </span>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-3">
          <div>
            <label htmlFor={`t-${section.id}`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Heading</label>
            <input ref={titleRef} id={`t-${section.id}`} value={section.title} onChange={(e) => onChange({ title: e.target.value })}
              className={field} placeholder={kind.automatic ? kind.label : ''} />
            {kind.automatic && <p className="text-xs text-slate-500 mt-1">Leave it empty to keep the usual heading.</p>}
          </div>
          <div>
            <label htmlFor={`s-${section.id}`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Line underneath</label>
            <input id={`s-${section.id}`} value={section.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} className={field} />
          </div>

          {!kind.automatic && (
            <>
              <div>
                <label htmlFor={`b-${section.id}`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Your words</label>
                <textarea id={`b-${section.id}`} rows={4} value={section.body} onChange={(e) => onChange({ body: e.target.value })} className={field} />
              </div>
              {section.type === 'banner' && (
                <>
                  <div className="flex items-center gap-4">
                    {section.image
                      ? <img src={section.image} alt="" className="w-20 h-14 rounded-xl object-cover border border-slate-200" />
                      : <span className="w-20 h-14 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400"><i className="fa-solid fa-image" aria-hidden="true"></i></span>}
                    <div className="flex-1">
                      <PhotoUpload purpose="listing" onUploaded={(url) => onChange({ image: url })} label="Upload a photo" />
                      {section.image && <button type="button" onClick={() => onChange({ image: '' })} className="text-xs font-bold text-slate-500 hover:text-rose-600 mt-2">Remove</button>}
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={`bl-${section.id}`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Button</label>
                      <input id={`bl-${section.id}`} value={section.buttonLabel} onChange={(e) => onChange({ buttonLabel: e.target.value })} className={field} />
                    </div>
                    <div>
                      <label htmlFor={`bu-${section.id}`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Goes to</label>
                      <input id={`bu-${section.id}`} value={section.buttonUrl} onChange={(e) => onChange({ buttonUrl: e.target.value })} className={field} placeholder="#book" />
                    </div>
                  </div>
                </>
              )}
              <button type="button" onClick={onRemove} className="text-xs font-bold text-slate-500 hover:text-rose-600">
                <i className="fa-solid fa-trash mr-1.5" aria-hidden="true"></i>Remove this section
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
