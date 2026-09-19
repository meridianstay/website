import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router'
import { ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import { ABOUT_TOKENS, aboutSchema, fillStats, type AboutItem, type AboutPage, type AboutSection, type AboutStats } from '@meridian/shared'
import { ApiError, adminApi, appLink } from '@meridian/shared/client'

const input = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-brand-500'
const blankItem: AboutItem = { icon: '', title: '', meta: '', text: '', image: '' }

/** Control center → Website content → About us page. */
export function AboutEditor() {
  const [page, setPage] = useState<AboutPage | null>(null)
  const [stats, setStats] = useState<AboutStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    adminApi.about().then((r) => {
      setPage(r.page)
      setStats(r.stats)
    }).catch((e) => setError(e.message))
  }, [])

  if (error && !page) return <ErrorNote message={error} />
  if (!page) return <Spinner />

  const touch = (next: AboutPage) => {
    setPage(next)
    if (state === 'saved') setState('idle')
  }
  const setSection = (key: keyof AboutPage['sections'], patch: Partial<AboutSection>) =>
    touch({ ...page, sections: { ...page.sections, [key]: { ...page.sections[key], ...patch } } })

  const save = async () => {
    setState('saving')
    setError(null)
    setFields({})
    try {
      setPage((await adminApi.saveAbout(page)).page)
      setState('saved')
    } catch (err) {
      setFields((err as ApiError).fields ?? {})
      setError((err as Error).message)
      setState('idle')
    }
  }

  const fieldError = (key: string) => fields[key] && <p className="text-xs text-rose-600 font-semibold mt-1">{fields[key]}</p>

  return (
    <>
      <PageHeader
        eyebrow="Website content"
        title="About us page"
        description="Every section of the public About us page. Changes go live as soon as you save."
        action={<a href={appLink('website', '/about')} target="_blank" rel="noreferrer" className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-3 px-5 rounded-2xl"><i className="fa-solid fa-arrow-up-right-from-square mr-2" aria-hidden="true"></i>View page</a>}
      />
      <Link to="/website" className="inline-block text-xs font-bold text-slate-600 hover:text-slate-900 mb-6"><i className="fa-solid fa-arrow-left mr-1.5" aria-hidden="true"></i>Website content</Link>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          <Panel title="Top of the page">
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Small label" value={page.hero.eyebrow} onChange={(v) => touch({ ...page, hero: { ...page.hero, eyebrow: v } })} error={fieldError('hero.eyebrow')} />
              <Field label="Headline" value={page.hero.title} onChange={(v) => touch({ ...page, hero: { ...page.hero, title: v } })} error={fieldError('hero.title')} />
              <Field label="Highlighted word" value={page.hero.highlight} onChange={(v) => touch({ ...page, hero: { ...page.hero, highlight: v } })} error={fieldError('hero.highlight')} />
            </div>
            <div className="mt-3 space-y-3">
              <Field label="Tagline" multiline value={page.hero.tagline} onChange={(v) => touch({ ...page, hero: { ...page.hero, tagline: v } })} error={fieldError('hero.tagline')} />
              <Field label="Background photo link" value={page.hero.image} onChange={(v) => touch({ ...page, hero: { ...page.hero, image: v } })} error={fieldError('hero.image')} placeholder="https://…" />
            </div>
          </Panel>

          {aboutSchema.map((def) => {
            const s = page.sections[def.key]
            const at = (f: string) => `${def.key}.${f}`
            const hasError = Object.keys(fields).some((k) => k.startsWith(`${def.key}.`))
            const setItem = (i: number, patch: Partial<AboutItem>) => setSection(def.key, { items: s.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) })
            const move = (i: number, by: -1 | 1) => {
              const items = [...s.items]
              const [it] = items.splice(i, 1)
              items.splice(i + by, 0, it)
              setSection(def.key, { items })
            }
            return (
              <details key={def.key} open={hasError || undefined} className="group bg-white rounded-3xl border border-slate-200 shadow-sm">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 p-5">
                  <span>
                    <span className="block font-extrabold text-slate-900">{def.label}{hasError && <i className="fa-solid fa-circle-exclamation text-rose-500 ml-2" aria-label="Has errors"></i>}</span>
                    <span className="block text-xs text-slate-500">{fillStats(s.title, stats)}</span>
                  </span>
                  <i className="fa-solid fa-chevron-down text-slate-400 group-open:rotate-180 transition" aria-hidden="true"></i>
                </summary>
                <div className="px-5 pb-5 space-y-3 border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-500">{def.hint}</p>
                  <Field label="Title" value={s.title} onChange={(v) => setSection(def.key, { title: v })} error={fieldError(at('title'))} />
                  <Field label="Tagline" multiline value={s.tagline} onChange={(v) => setSection(def.key, { tagline: v })} error={fieldError(at('tagline'))} />
                  <Field label="Text (leave a blank line between paragraphs)" multiline rows={5} value={s.body} onChange={(v) => setSection(def.key, { body: v })} error={fieldError(at('body'))} />

                  {def.fields && (
                    <div className="pt-2">
                      <p className="text-xs font-bold uppercase text-slate-500 mb-2">{def.itemLabel}s ({s.items.length}/{def.maxItems})</p>
                      <ol className="space-y-3">
                        {s.items.map((it, i) => (
                          <li key={i} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-slate-600">
                                {def.fields!.icon !== undefined && it.icon && <i className={`fa-solid fa-${it.icon} text-brand-600 mr-2`} aria-hidden="true"></i>}
                                {def.itemLabel} {i + 1}
                              </span>
                              <span className="flex gap-1 text-xs">
                                <IconButton label="Move up" icon="arrow-up" disabled={i === 0} onClick={() => move(i, -1)} />
                                <IconButton label="Move down" icon="arrow-down" disabled={i === s.items.length - 1} onClick={() => move(i, 1)} />
                                <IconButton label="Remove" icon="trash" danger onClick={() => setSection(def.key, { items: s.items.filter((_, j) => j !== i) })} />
                              </span>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-2">
                              {(Object.entries(def.fields!) as [keyof AboutItem, string][]).map(([f, label]) => (
                                <div key={f} className={f === 'text' ? 'sm:col-span-2' : ''}>
                                  <Field label={label} small multiline={f === 'text'} value={it[f]} onChange={(v) => setItem(i, { [f]: v })}
                                    placeholder={f === 'icon' ? 'e.g. leaf, star, handshake' : f === 'image' ? 'https://…' : undefined}
                                    error={fieldError(at(`items.${i}.${f}`))} />
                                </div>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ol>
                      {s.items.length < (def.maxItems ?? 8) && (
                        <button type="button" onClick={() => setSection(def.key, { items: [...s.items, { ...blankItem }] })} className="mt-3 text-xs font-bold text-brand-700 hover:underline">
                          <i className="fa-solid fa-plus mr-1" aria-hidden="true"></i>Add {def.itemLabel?.toLowerCase()}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </details>
            )
          })}
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 self-start">
          <Panel title="Sample content">
            <p className="text-sm text-slate-600">
              The page starts with <span className="font-semibold">sample text</span>, including a sample founder story and photo. Replace it with your own before launch.
            </p>
          </Panel>
          <Panel title="Live numbers">
            <p className="text-sm text-slate-500 mb-3">Type these anywhere to show figures that update automatically:</p>
            <ul className="space-y-1.5 text-xs">
              {ABOUT_TOKENS.map(({ token, label }) => (
                <li key={token} className="flex justify-between gap-2">
                  <code className="font-mono bg-slate-100 rounded px-1.5 py-0.5 select-all">{`{{${token}}}`}</code>
                  <span className="text-slate-500 text-right">{label}: <span className="font-bold text-slate-800">{stats?.[token].toLocaleString('en-IN') ?? '—'}</span></span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Icons">
            <p className="text-sm text-slate-500">Icons use Font Awesome names without the “fa-” prefix, e.g. <code className="font-mono">leaf</code>, <code className="font-mono">seedling</code>, <code className="font-mono">handshake</code>. Browse them at <a href="https://fontawesome.com/search?o=r&m=free&s=solid" target="_blank" rel="noreferrer" className="underline font-semibold">fontawesome.com</a> (free, solid).</p>
          </Panel>
        </aside>
      </div>

      {/* Always-visible save bar */}
      <div className="sticky bottom-4 z-10 mt-8">
        <div className="bg-slate-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            {error
              ? <span role="alert" className="text-rose-300 font-semibold">{Object.keys(fields).length ? 'Some fields need attention: the sections with errors are opened and marked.' : error}</span>
              : state === 'saved'
                ? <span role="status" className="text-brand-300 font-semibold"><i className="fa-solid fa-check mr-1.5" aria-hidden="true"></i>Saved. Live on the website.</span>
                : <span className="text-slate-300">Saves every section at once. Visitors see changes straight away.</span>}
          </p>
          <button type="button" onClick={save} disabled={state === 'saving'} className="bg-brand-500 hover:bg-brand-400 disabled:bg-slate-500 text-white font-bold py-2.5 px-6 rounded-xl text-sm">{state === 'saving' ? 'Saving…' : 'Save changes'}</button>
        </div>
      </div>
    </>
  )
}

function Field({ label, value, onChange, multiline = false, rows = 2, small = false, placeholder, error }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; rows?: number; small?: boolean; placeholder?: string; error?: React.ReactNode
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className={`block font-bold uppercase text-slate-500 mb-1 ${small ? 'text-[10px]' : 'text-xs'}`}>{label}</label>
      {multiline ? (
        <textarea id={id} rows={rows} className={input} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} className={input} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {error}
    </div>
  )
}

function IconButton({ label, icon, onClick, disabled = false, danger = false }: { label: string; icon: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}
      className={`w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 ${danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-600 hover:bg-slate-200'}`}>
      <i className={`fa-solid fa-${icon}`} aria-hidden="true"></i>
    </button>
  )
}
