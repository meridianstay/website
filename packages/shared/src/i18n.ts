// Reading the site in your own language. English is always there; the control centre chooses which
// of the Indian languages appear in the picker, and a visitor's browser decides which one they get
// the first time. Anything not yet translated falls back to English, so a page is never blank.

export interface Language {
  /** ISO code, also used as the `lang` attribute and for number formatting. */
  code: string
  /** The language's name in that language, which is what people recognise in a picker. */
  name: string
  /** The English name, for the control centre. */
  english: string
  /** Where it is mostly spoken, to help an admin choose. */
  where: string
}

/** English plus the Indian languages with the most speakers. Right-to-left scripts aren't styled yet. */
export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', english: 'English', where: 'All India' },
  { code: 'hi', name: 'हिन्दी', english: 'Hindi', where: 'North and central India' },
  { code: 'bn', name: 'বাংলা', english: 'Bengali', where: 'West Bengal, Tripura' },
  { code: 'mr', name: 'मराठी', english: 'Marathi', where: 'Maharashtra' },
  { code: 'te', name: 'తెలుగు', english: 'Telugu', where: 'Andhra Pradesh, Telangana' },
  { code: 'ta', name: 'தமிழ்', english: 'Tamil', where: 'Tamil Nadu, Puducherry' },
  { code: 'gu', name: 'ગુજરાતી', english: 'Gujarati', where: 'Gujarat' },
  { code: 'kn', name: 'ಕನ್ನಡ', english: 'Kannada', where: 'Karnataka' },
  { code: 'ml', name: 'മലയാളം', english: 'Malayalam', where: 'Kerala' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', english: 'Punjabi', where: 'Punjab' },
  { code: 'or', name: 'ଓଡ଼ିଆ', english: 'Odia', where: 'Odisha' },
]

export const languageByCode = (code: string) => LANGUAGES.find((l) => l.code === code)

export interface LanguageSettings {
  /** Codes offered in the picker. English is always included, whatever is stored. */
  enabled: string[]
  /** Used when a visitor's browser asks for something we don't offer. */
  fallback: string
  /** Switch off to show everyone the fallback language and hide the picker. */
  autoDetect: boolean
}

export const defaultLanguages: LanguageSettings = {
  enabled: ['en', 'hi', 'mr', 'gu', 'bn', 'ta', 'te', 'kn', 'ml', 'pa'],
  fallback: 'en',
  autoDetect: true,
}

/** The languages actually shown, in the order above, with English always first. */
export function offeredLanguages(settings: LanguageSettings | undefined): Language[] {
  const wanted = new Set([...(settings?.enabled ?? defaultLanguages.enabled), 'en'])
  return LANGUAGES.filter((l) => wanted.has(l.code))
}

/**
 * Which language to show: what the visitor chose before, else the best match from their browser,
 * else the fallback. Browser codes look like "mr-IN" or "hi", so only the part before the dash counts.
 */
export function pickLanguage(saved: string | null, browser: readonly string[], settings: LanguageSettings | undefined): string {
  const offered = offeredLanguages(settings).map((l) => l.code)
  if (saved && offered.includes(saved)) return saved
  const fallback = offered.includes(settings?.fallback ?? 'en') ? (settings?.fallback ?? 'en') : 'en'
  if (settings && settings.autoDetect === false) return fallback
  for (const tag of browser) {
    const code = tag.toLowerCase().split('-')[0]
    if (offered.includes(code)) return code
  }
  return fallback
}

/** One screen's worth of text, keyed by the English wording's short name (e.g. `nav.trips`). */
export type Dictionary = Record<string, string>

/** Fills `{name}` style placeholders, e.g. t('search.results', { count: 12 }). */
export function fill(text: string, values?: Record<string, string | number>): string {
  if (!values) return text
  return text.replace(/\{(\w+)\}/g, (whole, key) => (key in values ? String(values[key]) : whole))
}
