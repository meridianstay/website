import { useEffect, useState } from 'react'
import { ErrorNote, ImageField, PageHeader, Panel, Spinner } from '@meridian/ui'
import {
  BRAND_APPS, BRAND_LIMITS, LANGUAGES, SOCIAL_NETWORKS, THEME_PRESETS,
  defaultBranding, defaultFooter, defaultHeader, defaultLanguages, defaultTheme, themeVariables,
  type BrandingSettings, type FooterColumn, type FooterSettings, type HeaderSettings, type LanguageSettings, type NavItemLink, type ThemeSettings,
} from '@meridian/shared'
import { ApiError, adminApi, appLink } from '@meridian/shared/client'

const input = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-brand-500'
const label = 'block text-xs font-bold uppercase text-slate-500 mb-1'
const blankLink: NavItemLink = { label: '', url: '' }

function Toggle({ on, onChange, title, hint }: { on: boolean; onChange: (v: boolean) => void; title: string; hint: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="mt-1 w-4 h-4 accent-brand-600" />
      <span>
        <span className="block text-sm font-bold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  )
}

/** Rows of label + link, used by the header, the footer columns and the legal line. */
function LinkRows({ links, max, onChange }: { links: NavItemLink[]; max: number; onChange: (next: NavItemLink[]) => void }) {
  const set = (i: number, patch: Partial<NavItemLink>) => onChange(links.map((l, n) => (n === i ? { ...l, ...patch } : l)))
  return (
    <div className="space-y-2">
      {links.map((l, i) => (
        <div key={i} className="flex gap-2">
          <input value={l.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Link text" className={`${input} flex-1`} />
          <input value={l.url} onChange={(e) => set(i, { url: e.target.value })} placeholder="/help or https://…" className={`${input} flex-1`} />
          <button type="button" onClick={() => onChange(links.filter((_, n) => n !== i))} aria-label="Remove link"
            className="w-10 shrink-0 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50">
            <i className="fa-solid fa-trash text-xs" aria-hidden="true"></i>
          </button>
        </div>
      ))}
      {links.length < max && (
        <button type="button" onClick={() => onChange([...links, { ...blankLink }])} className="text-xs font-bold text-brand-700 hover:underline">
          <i className="fa-solid fa-plus mr-1.5" aria-hidden="true"></i>Add a link
        </button>
      )}
    </div>
  )
}

function ColorField({ id, label: name, hint, value, onChange, error }: { id: string; label: string; hint: string; value: string; onChange: (v: string) => void; error?: React.ReactNode }) {
  return (
    <div>
      <label className={label} htmlFor={id}>{name}</label>
      <div className="flex items-center gap-3">
        <input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#10b981'} onChange={(e) => onChange(e.target.value)}
          className="w-12 h-12 rounded-xl border border-slate-200 bg-white cursor-pointer p-1" />
        <input aria-label={`${name} hex code`} value={value} onChange={(e) => onChange(e.target.value)} className={`${input} font-mono uppercase`} placeholder="#10B981" />
      </div>
      <p className="text-xs text-slate-500 mt-1">{hint}</p>
      {error}
    </div>
  )
}

/** Control center → Website content → Logos, colours, header & footer. */
export function Branding() {
  const [branding, setBranding] = useState<BrandingSettings | null>(null)
  const [header, setHeader] = useState<HeaderSettings>(defaultHeader)
  const [footer, setFooter] = useState<FooterSettings>(defaultFooter)
  const [theme, setTheme] = useState<ThemeSettings>(defaultTheme)
  const [languages, setLanguages] = useState<LanguageSettings>(defaultLanguages)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')

  useEffect(() => {
    adminApi.settings().then((s) => {
      setBranding(s.branding ?? defaultBranding)
      setHeader(s.header ?? defaultHeader)
      setFooter(s.footer ?? defaultFooter)
      setTheme(s.theme ?? defaultTheme)
      setLanguages(s.languages ?? defaultLanguages)
    }).catch((e) => setError(e.message))
  }, [])

  if (error && !branding) return <ErrorNote message={error} />
  if (!branding) return <Spinner />

  const touched = () => { if (state === 'saved') setState('idle') }
  const setApp = (app: keyof BrandingSettings, patch: Partial<BrandingSettings[typeof app]>) => {
    setBranding({ ...branding, [app]: { ...branding[app], ...patch } })
    touched()
  }
  const setColumn = (i: number, patch: Partial<FooterColumn>) => {
    setFooter({ ...footer, columns: footer.columns.map((c, n) => (n === i ? { ...c, ...patch } : c)) })
    touched()
  }

  const save = async () => {
    setState('saving')
    setError(null)
    setFields({})
    try {
      await adminApi.saveTheme(theme)
      await adminApi.saveLanguages(languages)
      await adminApi.saveBranding(branding)
      await adminApi.saveHeader(header)
      await adminApi.saveFooter(footer)
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
        title="Logos, colours, languages, header & footer"
        description="Each panel has its own logo and name, so the website, host portal, guest account and this control centre can look different. Changes appear the next time a page is opened."
        action={<a href={appLink('website', '/')} target="_blank" rel="noreferrer" className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-3 px-5 rounded-2xl"><i className="fa-solid fa-arrow-up-right-from-square mr-2" aria-hidden="true"></i>View website</a>}
      />

      <div className="space-y-6">
        <Panel title="Languages" subtitle="Which languages visitors can read the site in. English is always offered; a visitor's browser decides which one they see first, and they can change it from the globe in the header.">
          <Toggle on={languages.autoDetect} onChange={(autoDetect) => { setLanguages({ ...languages, autoDetect }); touched() }}
            title="Match the visitor's browser" hint="Off means everyone starts in the default language below and can still switch by hand." />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-5">
            {LANGUAGES.map((l) => {
              const always = l.code === 'en'
              const on = always || languages.enabled.includes(l.code)
              return (
                <label key={l.code} className={`flex items-start gap-3 p-3 rounded-2xl border-2 transition ${on ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200'} ${always ? 'opacity-70' : 'cursor-pointer hover:border-slate-300'}`}>
                  <input type="checkbox" checked={on} disabled={always} className="mt-1 w-4 h-4 accent-brand-600"
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...languages.enabled, l.code]
                        : languages.enabled.filter((c) => c !== l.code)
                      setLanguages({ ...languages, enabled: next, fallback: next.includes(languages.fallback) ? languages.fallback : 'en' })
                      touched()
                    }} />
                  <span>
                    <span className="block text-sm font-bold text-slate-900" lang={l.code}>{l.name}</span>
                    <span className="block text-xs text-slate-500">{l.english} · {l.where}</span>
                  </span>
                </label>
              )
            })}
          </div>
          <div className="mt-5 max-w-xs">
            <label className={label} htmlFor="fallback-language">Default language</label>
            <select id="fallback-language" value={languages.fallback} onChange={(e) => { setLanguages({ ...languages, fallback: e.target.value }); touched() }} className={input}>
              {LANGUAGES.filter((l) => l.code === 'en' || languages.enabled.includes(l.code)).map((l) => (
                <option key={l.code} value={l.code}>{l.english} — {l.name}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">Used when a visitor's browser asks for a language you don't offer.</p>
            {fieldError('fallback')}
          </div>
          <p className="text-xs text-slate-500 mt-4">
            Menus, search, the stay page, checkout, trips and the host portal are translated. Listing titles, descriptions and website pages stay in the language they were written in.
          </p>
        </Panel>

        <Panel title="Colours" subtitle="One main colour and one accent. Every lighter and darker shade is mixed from them, so the whole site — website, host portal, guest account and this panel — changes together.">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {THEME_PRESETS.map((p) => {
              const on = theme.brand.toLowerCase() === p.theme.brand && theme.accent.toLowerCase() === p.theme.accent
              return (
                <button key={p.name} type="button" onClick={() => { setTheme({ ...p.theme }); touched() }}
                  className={`text-left p-4 rounded-2xl border-2 transition ${on ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200 hover:border-slate-300'}`}>
                  <span className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full border border-black/10" style={{ background: p.theme.brand }} />
                    <span className="w-6 h-6 rounded-full border border-black/10" style={{ background: p.theme.accent }} />
                    <span className="text-sm font-bold text-slate-900">{p.name}</span>
                  </span>
                  <span className="block text-xs text-slate-500">{p.blurb}</span>
                </button>
              )
            })}
          </div>

          <div className="grid sm:grid-cols-2 gap-5 mt-6">
            <ColorField id="brand-colour" label="Main colour" hint="Buttons, links and the logo mark." value={theme.brand}
              onChange={(brand) => { setTheme({ ...theme, brand }); touched() }} error={fieldError('brand')} />
            <ColorField id="accent-colour" label="Accent colour" hint="The second word in the logo, badges and highlights." value={theme.accent}
              onChange={(accent) => { setTheme({ ...theme, accent }); touched() }} error={fieldError('accent')} />
          </div>

          <div className="mt-6">
            <p className={label}>Every shade, mixed from those two</p>
            <div className="flex flex-wrap gap-4">
              {(['--brand-', '--brand-yellow-'] as const).map((prefix) => (
                <div key={prefix} className="flex rounded-xl overflow-hidden border border-slate-200">
                  {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((step) => (
                    <span key={step} className="w-7 h-9" title={`${prefix}${step}`} style={{ background: `rgb(${themeVariables(theme)[`${prefix}${step}`]})` }} />
                  ))}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">Colours change everywhere the next time a page is opened. Reload this panel after saving to see it here.</p>
          </div>
        </Panel>

        <Panel title="Logos" subtitle="Upload a square logo (PNG with a transparent background looks best). Leave it empty to keep the Meridian sprout.">
          <div className="grid md:grid-cols-2 gap-8">
            {BRAND_APPS.map(({ app, label: name, where }) => {
              const b = branding[app]
              return (
                <div key={app} className="space-y-3 border border-slate-100 rounded-2xl p-4">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">{name}</h4>
                    <p className="text-xs text-slate-500">{where}</p>
                  </div>
                  <ImageField label="Logo" value={b.logoUrl} onChange={(url) => setApp(app, { logoUrl: url })} shape="square" small
                    error={fieldError(`${app}.logoUrl`)} />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={label} htmlFor={`${app}-name`}>Name</label>
                      <input id={`${app}-name`} value={b.name} onChange={(e) => setApp(app, { name: e.target.value })} className={input} />
                      {fieldError(`${app}.name`)}
                    </div>
                    <div>
                      <label className={label} htmlFor={`${app}-accent`}>Second word (yellow)</label>
                      <input id={`${app}-accent`} value={b.accent} onChange={(e) => setApp(app, { accent: e.target.value })} className={input} />
                    </div>
                  </div>
                  <div>
                    <label className={label} htmlFor={`${app}-subtitle`}>Small line underneath</label>
                    <input id={`${app}-subtitle`} value={b.subtitle} onChange={(e) => setApp(app, { subtitle: e.target.value })} className={input} placeholder="Nature & Luxury" />
                  </div>
                  <Toggle on={b.showName} onChange={(v) => setApp(app, { showName: v })} title="Show the name beside the logo"
                    hint="Turn this off when your logo already has the name in it." />
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel title="Website header" subtitle="What appears in the bar at the top of the public website.">
          <div className="grid md:grid-cols-2 gap-5">
            <Toggle on={header.showSearch} onChange={(v) => { setHeader({ ...header, showSearch: v }); touched() }} title="Search box" hint="The “Anywhere · Any week · Add guests” pill." />
            <Toggle on={header.showDestinations} onChange={(v) => { setHeader({ ...header, showDestinations: v }); touched() }} title="Destination picker" hint="The “Select city” button with the pin." />
            <Toggle on={header.showInstallApp} onChange={(v) => { setHeader({ ...header, showInstallApp: v }); touched() }} title="Download app button" hint="Lets guests add the site to their phone’s home screen." />
            <Toggle on={header.showCurrency} onChange={(v) => { setHeader({ ...header, showCurrency: v }); touched() }} title="Language & currency" hint="The globe button." />
          </div>
          <div className="mt-5 max-w-sm">
            <label className={label} htmlFor="hostLink">Hosting link text</label>
            <input id="hostLink" value={header.hostLinkLabel} onChange={(e) => { setHeader({ ...header, hostLinkLabel: e.target.value }); touched() }} className={input} placeholder="List your property" />
            <p className="text-xs text-slate-500 mt-1">Leave empty to hide it. It always opens the “add a listing” page.</p>
            {fieldError('hostLinkLabel')}
          </div>
          <div className="mt-5">
            <p className={label}>Extra links (up to {BRAND_LIMITS.headerLinks}, shown on large screens)</p>
            <LinkRows links={header.links} max={BRAND_LIMITS.headerLinks} onChange={(links) => { setHeader({ ...header, links }); touched() }} />
            {fieldError('links')}
          </div>
        </Panel>

        <Panel title="Website footer" subtitle="The columns of links at the bottom of every page.">
          <div className="max-w-xl">
            <label className={label} htmlFor="tagline">Sentence under the logo</label>
            <textarea id="tagline" rows={2} value={footer.tagline} onChange={(e) => { setFooter({ ...footer, tagline: e.target.value }); touched() }} className={input} />
            {fieldError('tagline')}
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            {footer.columns.map((col, i) => (
              <div key={i} className="border border-slate-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <input value={col.heading} onChange={(e) => setColumn(i, { heading: e.target.value })} placeholder="Column heading" className={`${input} font-bold`} />
                  <button type="button" onClick={() => { setFooter({ ...footer, columns: footer.columns.filter((_, n) => n !== i) }); touched() }}
                    aria-label="Remove column" className="w-10 shrink-0 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                    <i className="fa-solid fa-trash text-xs" aria-hidden="true"></i>
                  </button>
                </div>
                <LinkRows links={col.links} max={BRAND_LIMITS.columnLinks} onChange={(links) => setColumn(i, { links })} />
                {fieldError(`columns.${i}`)}
              </div>
            ))}
          </div>
          {footer.columns.length < BRAND_LIMITS.columns && (
            <button type="button" onClick={() => { setFooter({ ...footer, columns: [...footer.columns, { heading: 'New column', links: [] }] }); touched() }}
              className="mt-4 text-xs font-bold text-brand-700 hover:underline"><i className="fa-solid fa-plus mr-1.5" aria-hidden="true"></i>Add a column</button>
          )}
          {fieldError('columns')}

          <div className="mt-8 grid md:grid-cols-2 gap-5">
            {SOCIAL_NETWORKS.map((n) => (
              <div key={n.key}>
                <label className={label} htmlFor={`social-${n.key}`}>{n.label}</label>
                <input id={`social-${n.key}`} value={footer.social[n.key]} placeholder={n.placeholder}
                  onChange={(e) => { setFooter({ ...footer, social: { ...footer.social, [n.key]: e.target.value } }); touched() }} className={input} />
                {fieldError(`social.${n.key}`)}
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-5">
            <Toggle on={footer.showPopularSearches} onChange={(v) => { setFooter({ ...footer, showPopularSearches: v }); touched() }}
              title="“Popular searches” row" hint="Built automatically from your live destinations. Good for Google." />
            <div>
              <p className={label}>Small print links (up to {BRAND_LIMITS.legal})</p>
              <LinkRows links={footer.legal} max={BRAND_LIMITS.legal} onChange={(legal) => { setFooter({ ...footer, legal }); touched() }} />
              {fieldError('legal')}
            </div>
            <div className="max-w-md">
              <label className={label} htmlFor="copyright">Copyright line</label>
              <input id="copyright" value={footer.copyright} onChange={(e) => { setFooter({ ...footer, copyright: e.target.value }); touched() }} className={input} />
              <p className="text-xs text-slate-500 mt-1">Write <code>{'{year}'}</code> where the year should go.</p>
              {fieldError('copyright')}
            </div>
          </div>
        </Panel>
      </div>

      {error && <div className="mt-6"><ErrorNote message={error} /></div>}
      <div className="sticky bottom-0 mt-6 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 bg-white/95 backdrop-blur border-t border-slate-200 flex items-center gap-4">
        <button type="button" onClick={save} disabled={state === 'saving'}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-bold py-3 px-6 rounded-2xl">
          {state === 'saving' ? 'Saving…' : 'Save changes'}
        </button>
        {state === 'saved' && <span className="text-sm font-bold text-brand-700"><i className="fa-solid fa-check mr-1.5" aria-hidden="true"></i>Saved</span>}
      </div>
    </>
  )
}
