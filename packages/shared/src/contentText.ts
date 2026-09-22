import type { AboutPage } from './about'
import type { AnnouncementSettings } from './content'
import type { FooterSettings, HeaderSettings } from './branding'
import type { HomeLayout } from './homepage'

// The words on the homepage, in the footer and on the About page are written in the control centre,
// so no built-in dictionary can reach them. They are translated by their English wording instead:
// type the Hindi for "Featured Meridian Stays" once and it appears wherever that heading is used.

/** One language's translations, keyed by the English wording. */
export type ContentTranslations = Record<string, string>

/** Every language's translations: `{ hi: { 'Featured stays': '…' } }`. */
export type TranslationBook = Record<string, ContentTranslations>

export const CONTENT_TEXT_MAX = 600

/** Replaces any string that has a translation, anywhere in a settings object, leaving the rest alone. */
export function translateDeep<T>(value: T, map: ContentTranslations | undefined): T {
  if (!map || !Object.keys(map).length) return value
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return map[node] ?? node
    if (Array.isArray(node)) return node.map(walk)
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {}
      for (const [key, child] of Object.entries(node)) out[key] = walk(child)
      return out
    }
    return node
  }
  return walk(value) as T
}

export interface ContentStringGroup {
  label: string
  /** Where these words show up, for the person doing the translating. */
  where: string
  strings: string[]
}

interface Sources {
  home?: HomeLayout | null
  footer?: FooterSettings | null
  header?: HeaderSettings | null
  announcement?: AnnouncementSettings | null
  about?: AboutPage | null
}

/**
 * Every piece of admin-written text worth translating, grouped by where it appears. Only real
 * wording is collected — never a link, a photo, an icon name or a colour.
 */
export function collectContentStrings({ home, footer, header, announcement, about }: Sources): ContentStringGroup[] {
  const groups: ContentStringGroup[] = []
  const add = (label: string, where: string, values: (string | undefined)[]) => {
    const strings = [...new Set(values.map((v) => (v ?? '').trim()).filter((v) => v.length > 0 && v.length <= CONTENT_TEXT_MAX))]
    if (strings.length) groups.push({ label, where, strings })
  }

  if (home) {
    add('Hero', 'The banner at the top of the homepage', home.hero.slides.flatMap((s) => [s.badge, s.title, s.highlight, s.subtitle, s.buttonLabel]))
    add('Homepage sections', 'Headings and blurbs down the homepage', home.blocks.flatMap((b) => [b.title, b.subtitle, b.badge, b.text, b.buttonLabel]))
    add('Property type cards', 'The “explore by type” pictures', home.blocks.flatMap((b) => b.cards.flatMap((c) => [c.label, c.tag, c.text])))
  }
  if (announcement?.enabled) add('Announcement bar', 'The strip above the header', [announcement.text, announcement.linkLabel])
  if (header) add('Header', 'The bar at the top of every page', [header.hostLinkLabel, ...header.links.map((l) => l.label)])
  if (footer) {
    add('Footer', 'The bottom of every page', [
      footer.tagline, footer.copyright, footer.credit?.label,
      ...footer.columns.flatMap((c) => [c.heading, ...c.links.map((l) => l.label)]),
      ...footer.legal.map((l) => l.label),
    ])
  }
  if (about) {
    add('About us — banner', 'The top of the About us page', [about.hero.eyebrow, about.hero.title, about.hero.highlight, about.hero.tagline])
    add('About us — sections', 'Mission, vision, journey, team and the rest', Object.values(about.sections).flatMap((s) => [
      s.title, s.tagline, s.body, ...s.items.flatMap((it) => [it.title, it.meta, it.text]),
    ]))
  }
  return groups
}

/** How much of a language is done, for the progress line in the control centre. */
export function translationProgress(groups: ContentStringGroup[], map: ContentTranslations | undefined) {
  const all = new Set(groups.flatMap((g) => g.strings))
  const done = [...all].filter((s) => (map?.[s] ?? '').trim().length > 0).length
  return { done, total: all.size }
}
