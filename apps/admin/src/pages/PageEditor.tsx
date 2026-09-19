import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import type { ContentPage } from '@meridian/shared'
import { ApiError, adminApi, appLink } from '@meridian/shared/client'

const input = 'w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500'

// Each section's paragraphs are edited as one text box, separated by blank lines.
type SectionDraft = { heading: string; text: string }

const blank: ContentPage = { slug: '', title: '', intro: '', draft: false, published: true, sections: [] }

export function PageEditor() {
  const { slug } = useParams()
  const isNew = !slug
  const navigate = useNavigate()
  const [page, setPage] = useState<ContentPage | null>(isNew ? blank : null)
  const [sections, setSections] = useState<SectionDraft[]>([])
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    if (isNew) return
    adminApi.pages().then((r) => {
      const found = r.pages.find((p) => p.slug === slug)
      if (!found) return setError('That page doesn’t exist.')
      setPage(found)
      setSections(found.sections.map((s) => ({ heading: s.heading, text: s.body.join('\n\n') })))
    }).catch((e) => setError(e.message))
  }, [slug, isNew])

  if (error && !page) return <ErrorNote message={error} />
  if (!page) return <Spinner />

  const edit = (patch: Partial<ContentPage>) => { setPage({ ...page, ...patch }); setState('idle') }
  const editSection = (i: number, patch: Partial<SectionDraft>) => { setSections(sections.map((s, j) => (j === i ? { ...s, ...patch } : s))); setState('idle') }
  const move = (i: number, dir: -1 | 1) => {
    const next = [...sections]
    ;[next[i], next[i + dir]] = [next[i + dir], next[i]]
    setSections(next)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('saving')
    setError(null)
    setFields({})
    try {
      await adminApi.savePage({
        ...page,
        sections: sections.map((s) => ({ heading: s.heading.trim(), body: s.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) })),
      })
      setState('saved')
      if (isNew) navigate(`/website/pages/${page.slug}`, { replace: true })
    } catch (err) {
      setFields((err as ApiError).fields)
      setError((err as Error).message)
      setState('idle')
    }
  }

  const remove = async () => {
    if (!window.confirm(`Delete “${page.title}”? Links to /${page.slug} will show “not found”.`)) return
    try {
      await adminApi.deletePage(page.slug)
      navigate('/website', { replace: true })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <>
      <Link to="/website" className="text-xs font-bold text-slate-600 hover:text-slate-900 inline-flex items-center space-x-2 mb-4">
        <i className="fa-solid fa-arrow-left" aria-hidden="true"></i><span>Website content</span>
      </Link>
      <PageHeader title={isNew ? 'New page' : `Edit “${page.title}”`} description={isNew ? 'Create an information page. Link to it from announcements or share its address.' : undefined} />
      <form onSubmit={save} className="space-y-6 max-w-3xl" noValidate>
        <Panel>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="title" className="block text-xs font-bold uppercase text-slate-500 mb-1">Title</label>
                <input id="title" className={input} value={page.title} onChange={(e) => edit({ title: e.target.value, ...(isNew ? { slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') } : {}) })} />
                {fields.title && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.title}</p>}
              </div>
              <div>
                <label htmlFor="slug" className="block text-xs font-bold uppercase text-slate-500 mb-1">Address</label>
                <div className="flex items-center">
                  <span className="text-sm text-slate-400 mr-1">/</span>
                  <input id="slug" className={input} value={page.slug} disabled={!isNew} onChange={(e) => edit({ slug: e.target.value })} />
                </div>
                {fields.slug && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.slug}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="intro" className="block text-xs font-bold uppercase text-slate-500 mb-1">Introduction</label>
              <textarea id="intro" rows={2} maxLength={600} className={input} value={page.intro} onChange={(e) => edit({ intro: e.target.value })} />
            </div>
            <div className="flex flex-wrap gap-6 text-sm font-semibold text-slate-800">
              <label className="flex items-center space-x-2"><input type="checkbox" className="accent-brand-600" checked={page.published !== false} onChange={(e) => edit({ published: e.target.checked })} /><span>Published</span></label>
              <label className="flex items-center space-x-2"><input type="checkbox" className="accent-brand-600" checked={page.draft} onChange={(e) => edit({ draft: e.target.checked })} /><span>Show “draft” notice</span></label>
            </div>
          </div>
        </Panel>

        {sections.map((s, i) => (
          <Panel key={i}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase text-slate-400">Section {i + 1}</p>
                <span className="flex gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="w-8 h-8 rounded-lg hover:bg-slate-100 disabled:opacity-30"><i className="fa-solid fa-arrow-up text-xs" aria-hidden="true"></i></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === sections.length - 1} aria-label="Move down" className="w-8 h-8 rounded-lg hover:bg-slate-100 disabled:opacity-30"><i className="fa-solid fa-arrow-down text-xs" aria-hidden="true"></i></button>
                  <button type="button" onClick={() => setSections(sections.filter((_, j) => j !== i))} aria-label="Remove section" className="w-8 h-8 rounded-lg hover:bg-rose-50 text-rose-600"><i className="fa-solid fa-trash text-xs" aria-hidden="true"></i></button>
                </span>
              </div>
              <label className="sr-only" htmlFor={`h-${i}`}>Heading</label>
              <input id={`h-${i}`} className={`${input} font-bold`} value={s.heading} placeholder="Heading" onChange={(e) => editSection(i, { heading: e.target.value })} />
              <label className="sr-only" htmlFor={`t-${i}`}>Text</label>
              <textarea id={`t-${i}`} rows={5} className={input} value={s.text} placeholder="Text. Leave a blank line between paragraphs." onChange={(e) => editSection(i, { text: e.target.value })} />
            </div>
          </Panel>
        ))}
        <button type="button" onClick={() => setSections([...sections, { heading: '', text: '' }])} className="w-full border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-3xl py-4 text-sm font-bold text-slate-600">
          <i className="fa-solid fa-plus mr-2" aria-hidden="true"></i>Add section
        </button>

        {error && <ErrorNote message={error} />}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={state === 'saving'} className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white font-bold py-3 px-8 rounded-2xl text-sm">{state === 'saving' ? 'Saving…' : 'Save page'}</button>
          {state === 'saved' && (
            <p role="status" className="text-sm font-semibold text-brand-700">
              <i className="fa-solid fa-check mr-1" aria-hidden="true"></i>Saved.{' '}
              {page.published !== false && <a href={appLink('website', `/${page.slug}`)} target="_blank" rel="noreferrer" className="underline">View page</a>}
            </p>
          )}
          {!isNew && <button type="button" onClick={remove} className="ml-auto text-sm font-bold text-rose-600 hover:underline">Delete page</button>}
        </div>
      </form>
    </>
  )
}
