import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import {
  collectContentStrings, defaultLanguages, offeredLanguages, translationProgress,
  type ContentStringGroup, type Language, type TranslationBook,
} from '@meridian/shared'
import { adminApi, appLink } from '@meridian/shared/client'

// Website content → Translations. The headings and blurbs on the homepage, in the footer and on the
// About us page are written here, not in the code, so no built-in dictionary can reach them. This is
// where each of those sentences gets its Hindi, Marathi or Gujarati version. Anything left empty
// simply shows in the original wording, so a half-finished language is still safe to offer.

const input = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-brand-500'

export function Translations() {
  const [groups, setGroups] = useState<ContentStringGroup[] | null>(null)
  const [languages, setLanguages] = useState<Language[]>([])
  const [book, setBook] = useState<TranslationBook>({})
  const [lang, setLang] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [onlyMissing, setOnlyMissing] = useState(false)

  useEffect(() => {
    Promise.all([adminApi.settings(), adminApi.homepage(), adminApi.about(), adminApi.translations()])
      .then(([settings, home, about, saved]) => {
        setGroups(collectContentStrings({
          home: home.layout,
          footer: settings.footer,
          header: settings.header,
          announcement: settings.announcement,
          about: about.page,
        }))
        const offered = offeredLanguages(settings.languages ?? defaultLanguages).filter((l) => l.code !== 'en')
        setLanguages(offered)
        setLang((current) => current || offered[0]?.code || '')
        setBook(saved.translations ?? {})
      })
      .catch((e) => setError(e.message))
  }, [])

  const map = book[lang] ?? {}
  const progress = useMemo(() => translationProgress(groups ?? [], map), [groups, map])

  if (error && !groups) return <ErrorNote message={error} />
  if (!groups) return <Spinner />

  const set = (source: string, value: string) => {
    setBook({ ...book, [lang]: { ...map, [source]: value } })
    if (state === 'saved') setState('idle')
  }

  const save = async () => {
    setState('saving')
    setError(null)
    try {
      setBook((await adminApi.saveTranslations(book)).translations)
      setState('saved')
    } catch (err) {
      setError((err as Error).message)
      setState('idle')
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Website content"
        title="Translations"
        description="The words you write on the homepage, in the footer and on the About us page, in each language you offer. Buttons and menus are already translated; these are your own sentences."
        action={<a href={appLink('website', '/')} target="_blank" rel="noreferrer" className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-3 px-5 rounded-2xl"><i className="fa-solid fa-arrow-up-right-from-square mr-2" aria-hidden="true"></i>View website</a>}
      />
      <Link to="/website" className="inline-block text-xs font-bold text-slate-600 hover:text-slate-900 mb-6"><i className="fa-solid fa-arrow-left mr-1.5" aria-hidden="true"></i>Website content</Link>

      {languages.length === 0 ? (
        <Panel title="No other languages yet">
          <p className="text-sm text-slate-500">
            Turn on the languages you want to offer in <Link to="/website/branding" className="font-semibold underline">Logos, colours, languages &amp; footer</Link>, then come back here to translate your words into them.
          </p>
        </Panel>
      ) : (
        <>
          <Panel title="Language">
            <div className="flex flex-wrap gap-2">
              {languages.map((l) => {
                const done = translationProgress(groups, book[l.code] ?? {})
                const on = l.code === lang
                return (
                  <button key={l.code} type="button" onClick={() => setLang(l.code)}
                    className={`px-4 py-2.5 rounded-2xl border-2 text-left transition ${on ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200 hover:border-slate-300'}`}>
                    <span className="block text-sm font-bold text-slate-900" lang={l.code}>{l.name}</span>
                    <span className="block text-[11px] text-slate-500 tabular-nums">{done.done} of {done.total} done</span>
                  </button>
                )
              })}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
                </div>
                <p className="text-xs text-slate-500 mt-1.5 tabular-nums">{progress.done} of {progress.total} sentences translated. The rest show in English.</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} className="w-4 h-4 accent-brand-600" />
                Only show what’s left
              </label>
            </div>
          </Panel>

          <div className="space-y-6 mt-6">
            {groups.map((group) => {
              const rows = group.strings.filter((s) => !onlyMissing || !(map[s] ?? '').trim())
              if (!rows.length) return null
              return (
                <Panel key={group.label} title={group.label} subtitle={group.where}>
                  <ul className="divide-y divide-slate-100">
                    {rows.map((source) => (
                      <li key={source} className="py-4 grid md:grid-cols-2 gap-3 md:gap-6 items-start">
                        <p className="text-sm text-slate-700">
                          {source}
                          {!(map[source] ?? '').trim() && <span className="ml-2 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 align-middle">Not translated</span>}
                        </p>
                        <textarea
                          aria-label={`Translation of “${source}”`}
                          lang={lang}
                          rows={source.length > 90 ? 3 : 1}
                          value={map[source] ?? ''}
                          onChange={(e) => set(source, e.target.value)}
                          className={input}
                        />
                      </li>
                    ))}
                  </ul>
                </Panel>
              )
            })}
          </div>

          {error && <div className="mt-6"><ErrorNote message={error} /></div>}
          <div className="sticky bottom-0 mt-6 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 bg-white/95 backdrop-blur border-t border-slate-200 flex items-center gap-4">
            <button type="button" onClick={save} disabled={state === 'saving'}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-bold py-3 px-6 rounded-2xl">
              {state === 'saving' ? 'Saving…' : 'Save translations'}
            </button>
            {state === 'saved' && <span className="text-sm font-bold text-brand-700"><i className="fa-solid fa-check mr-1.5" aria-hidden="true"></i>Saved</span>}
            <span className="text-xs text-slate-500">Visitors see the change the next time they open a page.</span>
          </div>
        </>
      )}
    </>
  )
}
