import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fill, offeredLanguages, pickLanguage, type Dictionary, type Language, type LanguageSettings } from '@meridian/shared'
import { en, loaders } from '@meridian/shared/locales'

// Reading the site in your own language. The choice is remembered in this browser; without one we
// use the browser's own languages. English is bundled, the rest arrive when someone picks them, and
// any wording not yet translated quietly falls back to English.

const STORAGE_KEY = 'meridian.language'

const read = () => {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

interface Value {
  lang: string
  /** Translate a key, filling `{name}` placeholders: t('search.results', { count: 12 }). */
  t: (key: string, values?: Record<string, string | number>) => string
  setLang: (code: string) => void
  /** The languages the control centre offers, for the picker. */
  languages: Language[]
  /** False in the control centre, which stays in English. */
  enabled: boolean
}

const fallback: Value = {
  lang: 'en',
  t: (key, values) => fill(en[key] ?? key, values),
  setLang: () => {},
  languages: [],
  enabled: false,
}

const LanguageContext = createContext<Value>(fallback)

export function LanguageProvider({ settings, enabled = true, children }: { settings?: LanguageSettings; enabled?: boolean; children: ReactNode }) {
  const [lang, setLangState] = useState('en')
  const [dict, setDict] = useState<Dictionary>(en)

  const load = useCallback(async (code: string) => {
    const loader = loaders[code]
    if (!loader) return setDict(en)
    try {
      const mod = await loader()
      // English underneath, so a key that isn't translated yet still reads properly.
      setDict({ ...en, ...mod.default })
    } catch {
      setDict(en)
    }
  }, [])

  // Which language to show: what this browser chose before, else what the browser asks for.
  useEffect(() => {
    if (!enabled) return
    const code = pickLanguage(read(), navigator.languages ?? [navigator.language], settings)
    setLangState(code)
    load(code)
  }, [enabled, settings, load])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((code: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch {
      // A browser with storage switched off still gets the language for this page.
    }
    setLangState(code)
    load(code)
  }, [load])

  const value = useMemo<Value>(() => ({
    lang,
    t: (key, values) => fill(dict[key] ?? en[key] ?? key, values),
    setLang,
    languages: enabled ? offeredLanguages(settings) : [],
    enabled,
  }), [lang, dict, setLang, settings, enabled])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export const useLanguage = () => useContext(LanguageContext)

/** The usual way to reach translations: `const t = useT()`, then `t('nav.trips')`. */
export const useT = () => useContext(LanguageContext).t
