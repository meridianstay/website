import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router'
import { ErrorNote, ImageField, PageHeader, Panel, Spinner } from '@meridian/ui'
import {
  blankSlide, formatPrice, HOME_BLOCK_TYPES, HOME_LIMITS, newBlock, PROPERTY_TYPE_LIST, STAY_RULES,
  type CategoryCard, type HeroSlide, type HomeBlock, type HomeBlockType, type HomeLayout, type PropertySummary,
} from '@meridian/shared'
import { ApiError, adminApi, api, appLink } from '@meridian/shared/client'

const input = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-brand-500'

/** Control center → Website content → Homepage: the hero (static or slider) and the sections below it. */
export function HomepageEditor() {
  const [layout, setLayout] = useState<HomeLayout | null>(null)
  const [locations, setLocations] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    adminApi.homepage().then((r) => setLayout(r.layout)).catch((e) => setError(e.message))
    api.locations().then((r) => setLocations(r.locations)).catch(() => {})
  }, [])

  if (error && !layout) return <ErrorNote message={error} />
  if (!layout) return <Spinner />

  const touch = (next: HomeLayout) => {
    setLayout(next)
    if (state === 'saved') setState('idle')
  }
  const hero = layout.hero
  const setHero = (patch: Partial<HomeLayout['hero']>) => touch({ ...layout, hero: { ...hero, ...patch } })
  const setSlide = (i: number, patch: Partial<HeroSlide>) => setHero({ slides: hero.slides.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const setBlock = (i: number, patch: Partial<HomeBlock>) => touch({ ...layout, blocks: layout.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) })
  const moveBlock = (i: number, by: -1 | 1) => touch({ ...layout, blocks: move(layout.blocks, i, by) })
  const addBlock = (type: HomeBlockType) => {
    const b = newBlock(type)
    touch({ ...layout, blocks: [...layout.blocks, b] })
    setOpen(b.id)
  }

  const err = (key: string) => fields[key] && <p className="text-xs text-rose-600 font-semibold mt-1">{fields[key]}</p>
  const has = (prefix: string) => Object.keys(fields).some((k) => k.startsWith(prefix))

  const save = async () => {
    setState('saving')
    setError(null)
    setFields({})
    try {
      setLayout((await adminApi.saveHomeLayout(layout)).layout)
      setState('saved')
    } catch (e) {
      setFields((e as ApiError).fields ?? {})
      setError((e as Error).message)
      setState('idle')
    }
  }

  const visibleSlides = hero.mode === 'slider' ? hero.slides : hero.slides.slice(0, 1)

  return (
    <>
      <PageHeader
        eyebrow="Website content"
        title="Homepage"
        description="Choose a static hero or a slider, then arrange the sections below it. Changes go live when you save."
        action={<a href={appLink('website', '/')} target="_blank" rel="noreferrer" className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-3 px-5 rounded-2xl"><i className="fa-solid fa-arrow-up-right-from-square mr-2" aria-hidden="true"></i>View homepage</a>}
      />
      <Link to="/website" className="inline-block text-xs font-bold text-slate-600 hover:text-slate-900 mb-6"><i className="fa-solid fa-arrow-left mr-1.5" aria-hidden="true"></i>Website content</Link>

      <div className="space-y-8">
        {/* Hero */}
        <Panel title="Top of the homepage (hero)">
          <div className="space-y-5">
            <fieldset>
              <legend className="text-xs font-bold uppercase text-slate-500 mb-2">Style</legend>
              <div className="grid sm:grid-cols-2 gap-3">
                {([
                  ['static', 'Static', 'One headline and photo that stay put.', 'image'],
                  ['slider', 'Slider', 'Several slides that change automatically. Visitors can also swipe through them with arrows and dots.', 'images'],
                ] as const).map(([value, label, text, icon]) => (
                  <label key={value} className={`cursor-pointer rounded-2xl border-2 p-4 flex gap-3 ${hero.mode === value ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input type="radio" name="hero-mode" className="sr-only" checked={hero.mode === value} onChange={() => setHero({ mode: value })} />
                    <i className={`fa-solid fa-${icon} text-brand-600 mt-0.5`} aria-hidden="true"></i>
                    <span><span className="block font-bold text-sm text-slate-900">{label}</span><span className="block text-xs text-slate-500">{text}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-6 items-end">
              {hero.mode === 'slider' && (
                <div>
                  <label htmlFor="interval" className="block text-xs font-bold uppercase text-slate-500 mb-1">Each slide shows for</label>
                  <select id="interval" value={hero.intervalSec} onChange={(e) => setHero({ intervalSec: Number(e.target.value) })} className={`${input} w-40`}>
                    {Array.from({ length: HOME_LIMITS.maxInterval - HOME_LIMITS.minInterval + 1 }, (_, i) => i + HOME_LIMITS.minInterval).map((n) => <option key={n} value={n}>{n} seconds</option>)}
                  </select>
                  {err('hero.intervalSec')}
                </div>
              )}
              <Toggle label="Show the search box on the hero" checked={hero.showSearch} onChange={(showSearch) => setHero({ showSearch })} />
            </div>

            <ol className="space-y-4">
              {visibleSlides.map((s, i) => {
                const at = (f: string) => `hero.slides.${i}.${f}`
                return (
                  <li key={i} className={`rounded-2xl border p-4 ${has(`hero.slides.${i}.`) ? 'border-rose-300' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold uppercase text-slate-600">{hero.mode === 'slider' ? `Slide ${i + 1}` : 'Hero'}</p>
                      {hero.mode === 'slider' && (
                        <span className="flex gap-1">
                          <IconButton label="Move up" icon="arrow-up" disabled={i === 0} onClick={() => setHero({ slides: move(hero.slides, i, -1) })} />
                          <IconButton label="Move down" icon="arrow-down" disabled={i === hero.slides.length - 1} onClick={() => setHero({ slides: move(hero.slides, i, 1) })} />
                          <IconButton label="Remove slide" icon="trash" danger disabled={hero.slides.length === 1} onClick={() => setHero({ slides: hero.slides.filter((_, j) => j !== i) })} />
                        </span>
                      )}
                    </div>
                    <div className="grid lg:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <Field label="Small badge (optional)" value={s.badge} onChange={(v) => setSlide(i, { badge: v })} error={err(at('badge'))} />
                        <div className="grid grid-cols-3 gap-2">
                          <div className="col-span-2"><Field label="Headline" value={s.title} onChange={(v) => setSlide(i, { title: v })} error={err(at('title'))} /></div>
                          <Field label="Coloured word" value={s.highlight} onChange={(v) => setSlide(i, { highlight: v })} error={err(at('highlight'))} />
                        </div>
                        <Field label="Text under the headline" multiline value={s.subtitle} onChange={(v) => setSlide(i, { subtitle: v })} error={err(at('subtitle'))} />
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Button text (optional)" value={s.buttonLabel} onChange={(v) => setSlide(i, { buttonLabel: v })} error={err(at('buttonLabel'))} />
                          <Field label="Button goes to" value={s.buttonUrl} placeholder="/search?type=Villa" onChange={(v) => setSlide(i, { buttonUrl: v })} error={err(at('buttonUrl'))} />
                        </div>
                      </div>
                      <ImageField label="Background photo" value={s.image} onChange={(v) => setSlide(i, { image: v })} error={err(at('image'))} />
                    </div>
                  </li>
                )
              })}
            </ol>
            {hero.mode === 'slider' && hero.slides.length < HOME_LIMITS.slides && (
              <button type="button" onClick={() => setHero({ slides: [...hero.slides, { ...blankSlide }] })} className="text-xs font-bold text-brand-700 hover:underline">
                <i className="fa-solid fa-plus mr-1" aria-hidden="true"></i>Add a slide
              </button>
            )}
            {hero.mode === 'static' && hero.slides.length > 1 && (
              <p className="text-xs text-slate-500">You have {hero.slides.length - 1} more slide{hero.slides.length === 2 ? '' : 's'} saved. They show again if you switch back to Slider.</p>
            )}
          </div>
        </Panel>

        {/* Sections */}
        <Panel title="Sections below the hero">
          <p className="text-sm text-slate-500 mb-4">Shown in this order. Switch a section off to hide it without losing its settings.</p>
          <ol className="space-y-3">
            {layout.blocks.map((b, i) => {
              const type = HOME_BLOCK_TYPES.find((t) => t.value === b.type)!
              const isOpen = open === b.id || has(`blocks.${i}.`)
              return (
                <li key={b.id} className={`rounded-2xl border ${has(`blocks.${i}.`) ? 'border-rose-300' : 'border-slate-200'} ${b.enabled ? 'bg-white' : 'bg-slate-50'}`}>
                  <div className="flex items-center gap-3 p-4">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${b.enabled ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-400'}`}>
                      <i className={`fa-solid fa-${type.icon}`} aria-hidden="true"></i>
                    </span>
                    <button type="button" onClick={() => setOpen(isOpen ? null : b.id)} aria-expanded={isOpen} className="flex-1 min-w-0 text-left">
                      <span className="block font-bold text-sm text-slate-900 truncate">{b.title || 'Untitled section'}{!b.enabled && <span className="ml-2 text-[10px] font-bold uppercase bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Hidden</span>}</span>
                      <span className="block text-xs text-slate-500 truncate">{type.label}{b.type === 'stays' ? ` · ${STAY_RULES.find((r) => r.value === b.rule)?.label ?? ''} · ${b.limit} stays` : ''}</span>
                    </button>
                    <Toggle label="Show" compact checked={b.enabled} onChange={(enabled) => setBlock(i, { enabled })} />
                    <span className="flex gap-1">
                      <IconButton label="Move up" icon="arrow-up" disabled={i === 0} onClick={() => moveBlock(i, -1)} />
                      <IconButton label="Move down" icon="arrow-down" disabled={i === layout.blocks.length - 1} onClick={() => moveBlock(i, 1)} />
                      <IconButton label="Delete section" icon="trash" danger onClick={() => touch({ ...layout, blocks: layout.blocks.filter((_, j) => j !== i) })} />
                      <IconButton label={isOpen ? 'Close' : 'Edit'} icon={isOpen ? 'chevron-up' : 'pen'} onClick={() => setOpen(isOpen ? null : b.id)} />
                    </span>
                  </div>
                  {isOpen && (
                    <div className="border-t border-slate-100 p-4 space-y-4">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field label="Title" value={b.title} onChange={(v) => setBlock(i, { title: v })} error={err(`blocks.${i}.title`)} />
                        <Field label="Subtitle (optional)" value={b.subtitle} onChange={(v) => setBlock(i, { subtitle: v })} error={err(`blocks.${i}.subtitle`)} />
                      </div>
                      {b.type === 'stays' && <StaysEditor block={b} locations={locations} onChange={(p) => setBlock(i, p)} err={(f) => err(`blocks.${i}.${f}`)} />}
                      {b.type === 'categories' && <CategoriesEditor block={b} onChange={(p) => setBlock(i, p)} err={(f) => err(`blocks.${i}.${f}`)} />}
                      {b.type === 'banner' && <BannerEditor block={b} onChange={(p) => setBlock(i, p)} err={(f) => err(`blocks.${i}.${f}`)} />}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>

          {layout.blocks.length < HOME_LIMITS.blocks && (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase text-slate-500 mb-2">Add a section</p>
              <div className="grid sm:grid-cols-3 gap-3">
                {HOME_BLOCK_TYPES.map((t) => (
                  <button key={t.value} type="button" onClick={() => addBlock(t.value)} className="text-left rounded-2xl border-2 border-dashed border-slate-200 hover:border-brand-400 hover:bg-brand-50/50 p-4 transition">
                    <i className={`fa-solid fa-${t.icon} text-brand-600`} aria-hidden="true"></i>
                    <span className="block font-bold text-sm text-slate-900 mt-2">{t.label}</span>
                    <span className="block text-xs text-slate-500">{t.explain}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>

      <SaveBar state={state} error={error} hasFieldErrors={Object.keys(fields).length > 0} onSave={save} />
    </>
  )
}

/** "Which stays to show?" in plain language, with a live preview of what the rule picks today. */
function StaysEditor({ block, locations, onChange, err }: { block: HomeBlock; locations: string[]; onChange: (p: Partial<HomeBlock>) => void; err: (f: string) => React.ReactNode }) {
  const rule = STAY_RULES.find((r) => r.value === block.rule) ?? STAY_RULES[0]
  const [preview, setPreview] = useState<PropertySummary[] | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const listId = useId()

  useEffect(() => {
    setPreview(null)
    setPreviewError(null)
    const timer = window.setTimeout(() => {
      adminApi.previewStays(block).then((r) => setPreview(r.properties)).catch((e) => setPreviewError(e.message))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [block.rule, block.propertyType, block.location, block.maxPrice, block.limit]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-3">
        <div>
          <label htmlFor={`${listId}-rule`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Which stays to show?</label>
          <select id={`${listId}-rule`} value={block.rule} onChange={(e) => onChange({ rule: e.target.value as HomeBlock['rule'] })} className={input}>
            {STAY_RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <p className="text-xs text-slate-500 mt-1.5 bg-slate-50 rounded-lg p-2"><i className="fa-solid fa-circle-info text-brand-600 mr-1.5" aria-hidden="true"></i>{rule.explain}</p>
          {err('rule')}
        </div>
        {rule.needs === 'type' && (
          <div>
            <label htmlFor={`${listId}-type`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Property type</label>
            <select id={`${listId}-type`} value={block.propertyType} onChange={(e) => onChange({ propertyType: e.target.value as HomeBlock['propertyType'] })} className={input}>
              <option value="">Choose…</option>
              {PROPERTY_TYPE_LIST.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {err('propertyType')}
          </div>
        )}
        {rule.needs === 'location' && (
          <div>
            <label htmlFor={`${listId}-loc`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Town, city or state</label>
            <input id={`${listId}-loc`} list={`${listId}-locs`} value={block.location} onChange={(e) => onChange({ location: e.target.value })} placeholder="e.g. Kerala or Coorg" className={input} />
            <datalist id={`${listId}-locs`}>{locations.map((l) => <option key={l} value={l} />)}</datalist>
            {err('location')}
          </div>
        )}
        {rule.needs === 'budget' && (
          <div>
            <label htmlFor={`${listId}-max`} className="block text-xs font-bold uppercase text-slate-500 mb-1">Highest nightly price (₹)</label>
            <input id={`${listId}-max`} type="number" min={100} step={100} value={block.maxPrice ?? ''} onChange={(e) => onChange({ maxPrice: e.target.value ? Number(e.target.value) : null })} placeholder="5000" className={input} />
            {err('maxPrice')}
          </div>
        )}
        <div>
          <label htmlFor={`${listId}-limit`} className="block text-xs font-bold uppercase text-slate-500 mb-1">How many stays</label>
          <select id={`${listId}-limit`} value={block.limit} onChange={(e) => onChange({ limit: Number(e.target.value) })} className={`${input} w-32`}>
            {Array.from({ length: HOME_LIMITS.maxStays - HOME_LIMITS.minStays + 1 }, (_, i) => i + HOME_LIMITS.minStays).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          {err('limit')}
        </div>
      </div>
      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
        <p className="text-xs font-bold uppercase text-slate-500 mb-3">Shows right now</p>
        {previewError ? <p className="text-xs text-rose-600">{previewError}</p> : !preview ? <Spinner /> : preview.length === 0 ? (
          <p className="text-sm text-slate-600">No live stays match yet, so this section is hidden on the website until some do.</p>
        ) : (
          <ul className="space-y-2">
            {preview.map((p) => (
              <li key={p.id} className="flex items-center gap-3 text-sm">
                <img src={p.image} alt="" className="w-12 h-9 rounded-lg object-cover shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-900 truncate">{p.title}</span>
                  <span className="block text-xs text-slate-500 truncate">{p.location} · {formatPrice(p.price)}/night{p.reviewCount ? ` · ★ ${p.rating.toFixed(2)}` : ''}{p.management === 'managed' ? ' · Instant' : ''}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function CategoriesEditor({ block, onChange, err }: { block: HomeBlock; onChange: (p: Partial<HomeBlock>) => void; err: (f: string) => React.ReactNode }) {
  const setCard = (j: number, patch: Partial<CategoryCard>) => onChange({ cards: block.cards.map((c, k) => (k === j ? { ...c, ...patch } : c)) })
  return (
    <div>
      <p className="text-xs font-bold uppercase text-slate-500 mb-2">Cards ({block.cards.length}/{HOME_LIMITS.cards})</p>
      {err('cards')}
      <ol className="grid lg:grid-cols-2 gap-3">
        {block.cards.map((c, j) => (
          <li key={j} className="rounded-2xl border border-slate-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Card {j + 1}</span>
              <span className="flex gap-1">
                <IconButton label="Move up" icon="arrow-up" disabled={j === 0} onClick={() => onChange({ cards: move(block.cards, j, -1) })} />
                <IconButton label="Move down" icon="arrow-down" disabled={j === block.cards.length - 1} onClick={() => onChange({ cards: move(block.cards, j, 1) })} />
                <IconButton label="Remove card" icon="trash" danger onClick={() => onChange({ cards: block.cards.filter((_, k) => k !== j) })} />
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Opens stays of type
                  <select value={c.type} onChange={(e) => setCard(j, { type: e.target.value as CategoryCard['type'] })} className={`${input} mt-1 normal-case font-normal`}>
                    {PROPERTY_TYPE_LIST.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                {err(`cards.${j}.type`)}
              </div>
              <Field small label="Label" value={c.label} onChange={(v) => setCard(j, { label: v })} error={err(`cards.${j}.label`)} />
              <Field small label="Tag" value={c.tag} onChange={(v) => setCard(j, { tag: v })} error={err(`cards.${j}.tag`)} />
              <Field small label="Short text" value={c.text} onChange={(v) => setCard(j, { text: v })} error={err(`cards.${j}.text`)} />
            </div>
            <ImageField small shape="square" label="Photo" value={c.image} onChange={(v) => setCard(j, { image: v })} error={err(`cards.${j}.image`)} />
          </li>
        ))}
      </ol>
      {block.cards.length < HOME_LIMITS.cards && (
        <button type="button" onClick={() => onChange({ cards: [...block.cards, { type: 'Room', label: 'Rooms', tag: '', text: '', image: '' }] })} className="mt-3 text-xs font-bold text-brand-700 hover:underline">
          <i className="fa-solid fa-plus mr-1" aria-hidden="true"></i>Add a card
        </button>
      )}
    </div>
  )
}

function BannerEditor({ block, onChange, err }: { block: HomeBlock; onChange: (p: Partial<HomeBlock>) => void; err: (f: string) => React.ReactNode }) {
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <Field label="Small badge (optional)" value={block.badge} onChange={(v) => onChange({ badge: v })} error={err('badge')} />
        <Field label="Text" multiline value={block.text} onChange={(v) => onChange({ text: v })} error={err('text')} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Button text" value={block.buttonLabel} onChange={(v) => onChange({ buttonLabel: v })} error={err('buttonLabel')} />
          <Field label="Button goes to" value={block.buttonUrl} placeholder="/host/new" onChange={(v) => onChange({ buttonUrl: v })} error={err('buttonUrl')} />
        </div>
        <fieldset>
          <legend className="text-xs font-bold uppercase text-slate-500 mb-1">Colour</legend>
          <div className="flex gap-2">
            {([['green', 'Green', 'bg-gradient-to-r from-brand-700 to-brand-yellow-600'], ['dark', 'Dark', 'bg-slate-900'], ['light', 'Light', 'bg-brand-50 border border-brand-100']] as const).map(([v, label, swatch]) => (
              <label key={v} className={`cursor-pointer flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-bold ${block.tone === v ? 'border-brand-500' : 'border-slate-200'}`}>
                <input type="radio" className="sr-only" checked={block.tone === v} onChange={() => onChange({ tone: v })} />
                <span className={`w-5 h-5 rounded-md ${swatch}`} aria-hidden="true" />{label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <ImageField label="Photo (optional)" value={block.image} onChange={(v) => onChange({ image: v })} error={err('image')} />
    </div>
  )
}

function move<T>(list: T[], i: number, by: -1 | 1): T[] {
  const next = [...list]
  const [it] = next.splice(i, 1)
  next.splice(i + by, 0, it)
  return next
}

function Field({ label, value, onChange, multiline = false, small = false, placeholder, error }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; small?: boolean; placeholder?: string; error?: React.ReactNode
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className={`block font-bold uppercase text-slate-500 mb-1 ${small ? 'text-[10px]' : 'text-xs'}`}>{label}</label>
      {multiline
        ? <textarea id={id} rows={2} className={input} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        : <input id={id} className={input} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
      {error}
    </div>
  )
}

function Toggle({ label, checked, onChange, compact = false }: { label: string; checked: boolean; onChange: (v: boolean) => void; compact?: boolean }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-700">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" aria-label={compact ? label : undefined} />
      <span className={`relative w-10 h-6 rounded-full transition shrink-0 ${checked ? 'bg-brand-600' : 'bg-slate-300'}`} aria-hidden="true">
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {!compact && <span className="font-semibold">{label}</span>}
    </label>
  )
}

function IconButton({ label, icon, onClick, disabled = false, danger = false }: { label: string; icon: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs disabled:opacity-30 ${danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-600 hover:bg-slate-100'}`}>
      <i className={`fa-solid fa-${icon}`} aria-hidden="true"></i>
    </button>
  )
}

function SaveBar({ state, error, hasFieldErrors, onSave }: { state: 'idle' | 'saving' | 'saved'; error: string | null; hasFieldErrors: boolean; onSave: () => void }) {
  return (
    <div className="sticky bottom-4 z-10 mt-8">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {error
            ? <span role="alert" className="text-rose-300 font-semibold">{hasFieldErrors ? 'Some fields need attention: they’re marked in red.' : error}</span>
            : state === 'saved'
              ? <span role="status" className="text-brand-300 font-semibold"><i className="fa-solid fa-check mr-1.5" aria-hidden="true"></i>Saved. Live on the website.</span>
              : <span className="text-slate-300">Saves the hero and every section at once.</span>}
        </p>
        <button type="button" onClick={onSave} disabled={state === 'saving'} className="bg-brand-500 hover:bg-brand-400 disabled:bg-slate-500 text-white font-bold py-2.5 px-6 rounded-xl text-sm">{state === 'saving' ? 'Saving…' : 'Save changes'}</button>
      </div>
    </div>
  )
}
