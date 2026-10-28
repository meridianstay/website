// How a client arranges their own landing page: which sections appear, in what order, and what each
// one says. Part of the Everything plan.
//
// The sections are the parts the page already knows how to draw — the stay, the booking box, the
// branches, the policies — plus two the client fills in themselves. Dragging reorders them; the
// renderer walks the list and draws what it finds, so the editor and the live page can never
// disagree about what the page looks like.

export type ClientSectionType =
  | 'gallery' | 'booking' | 'details' | 'amenities' | 'rules' | 'map'
  | 'branches' | 'about' | 'policies' | 'reviews' | 'contact'
  | 'text' | 'banner'

export interface SectionKind {
  value: ClientSectionType
  label: string
  explain: string
  icon: string
  /** The client may add as many of these as they like; the rest appear once. */
  repeatable?: boolean
  /** Drawn from the stay's own details, so there is nothing to write. */
  automatic?: boolean
}

export const CLIENT_SECTIONS: SectionKind[] = [
  { value: 'gallery', label: 'Photos', explain: 'The stay’s photos, laid out as a mosaic.', icon: 'image', automatic: true },
  { value: 'details', label: 'About this stay', explain: 'The description, how many it sleeps, bedrooms, check-in time.', icon: 'circle-info', automatic: true },
  { value: 'booking', label: 'Booking box', explain: 'Dates, guests, the price and the button that takes the booking.', icon: 'calendar-check', automatic: true },
  { value: 'amenities', label: 'What’s here', explain: 'Wifi, pool, kitchen and the rest, with their icons.', icon: 'wifi', automatic: true },
  { value: 'rules', label: 'House rules', explain: 'Smoking, pets, parties, check-in and check-out times.', icon: 'circle-check', automatic: true },
  { value: 'map', label: 'Where you’ll be', explain: 'A map of the area, without giving the exact door away.', icon: 'map-location-dot', automatic: true },
  { value: 'reviews', label: 'Guest reviews', explain: 'What guests said after staying. Hides itself until there are some.', icon: 'star', automatic: true },
  { value: 'branches', label: 'Your other stays', explain: 'Your other properties, each opening as its own page. Needs a plan that covers more than one stay.', icon: 'house-chimney', automatic: true },
  { value: 'about', label: 'About your business', explain: 'The words you wrote on the My website page.', icon: 'users', automatic: true },
  { value: 'policies', label: 'Terms & policies', explain: 'Your property terms, payment and cancellation policies, as three cards.', icon: 'book-open', automatic: true },
  { value: 'contact', label: 'Talk to us', explain: 'Your phone, email and WhatsApp, on a dark panel.', icon: 'phone', automatic: true },
  { value: 'text', label: 'Your own words', explain: 'A heading and a paragraph, wherever you want them.', icon: 'pen', repeatable: true },
  { value: 'banner', label: 'Banner', explain: 'A photo with a headline and a button over it.', icon: 'rectangle-ad', repeatable: true },
]

export const sectionKind = (type: ClientSectionType) => CLIENT_SECTIONS.find((s) => s.value === type)!

export interface ClientSection {
  id: string
  type: ClientSectionType
  enabled: boolean
  /** Replaces the built-in heading. Empty keeps the one the page would use. */
  title: string
  subtitle: string
  /** For "Your own words" and "Banner". */
  body: string
  image: string
  buttonLabel: string
  buttonUrl: string
}

/**
 * sidebar: the booking box rides alongside the page as the visitor scrolls, which is how most
 * people book. stacked: everything in one column, in exactly the order the client dragged them.
 */
export type ClientPageLayout = 'sidebar' | 'stacked'

export interface ClientPageDesign {
  layout: ClientPageLayout
  /** The colour of the buttons and headings. Empty uses Meridian's green. */
  accent: string
  /** A photo behind the client's name at the top, or a plain band of colour. */
  heroStyle: 'photo' | 'plain'
  sections: ClientSection[]
}

export const ACCENT_CHOICES: { value: string; label: string }[] = [
  { value: '', label: 'Meridian green' },
  { value: '#0f766e', label: 'Deep teal' },
  { value: '#b45309', label: 'Amber' },
  { value: '#9d174d', label: 'Plum' },
  { value: '#1d4ed8', label: 'Blue' },
  { value: '#3f6212', label: 'Olive' },
  { value: '#7c2d12', label: 'Terracotta' },
  { value: '#1f2937', label: 'Charcoal' },
]

export const newSection = (type: ClientSectionType, id = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`): ClientSection => {
  const base: ClientSection = { id, type, enabled: true, title: '', subtitle: '', body: '', image: '', buttonLabel: '', buttonUrl: '' }
  if (type === 'text') return { ...base, title: 'A heading of your own', body: 'Anything you want guests to read — how to find you, what the season is like, what to bring.' }
  if (type === 'banner') return { ...base, title: 'Stay three nights, pay for two', body: 'All through the monsoon.', buttonLabel: 'See the dates', buttonUrl: '#book' }
  return base
}

/** The order a page starts in, which is the one the page had before anyone could rearrange it. */
export const defaultPageDesign = (): ClientPageDesign => ({
  layout: 'sidebar',
  accent: '',
  heroStyle: 'photo',
  sections: (['gallery', 'details', 'booking', 'amenities', 'rules', 'reviews', 'map', 'branches', 'about', 'policies', 'contact'] as ClientSectionType[])
    .map((type, i) => newSection(type, `d${i}-${type}`)),
})

/**
 * Fills in anything a stored design has never heard of, so a section added in a later release shows
 * up on pages that were arranged before it existed — at the end, switched off, for the client to
 * place where they want it.
 */
export function withPageDefaults(stored: ClientPageDesign | null | undefined): ClientPageDesign {
  const base = defaultPageDesign()
  if (!stored?.sections?.length) return base
  const known = new Set(stored.sections.map((s) => s.type))
  const missing = base.sections
    .filter((s) => !known.has(s.type))
    .map((s) => ({ ...s, enabled: false }))
  return {
    layout: stored.layout === 'stacked' ? 'stacked' : 'sidebar',
    accent: typeof stored.accent === 'string' ? stored.accent : '',
    heroStyle: stored.heroStyle === 'plain' ? 'plain' : 'photo',
    sections: [...stored.sections.map((s) => ({ ...newSection(s.type, s.id), ...s })), ...missing],
  }
}

/** Moves one section up or down the page. */
export function moveSection(sections: ClientSection[], index: number, by: -1 | 1): ClientSection[] {
  const to = index + by
  if (to < 0 || to >= sections.length) return sections
  const next = [...sections]
  const [row] = next.splice(index, 1)
  next.splice(to, 0, row)
  return next
}

/** Drops the section being dragged into the place it was let go. */
export function dropSection(sections: ClientSection[], from: number, to: number): ClientSection[] {
  if (from === to || from < 0 || to < 0 || from >= sections.length || to >= sections.length) return sections
  const next = [...sections]
  const [row] = next.splice(from, 1)
  next.splice(to, 0, row)
  return next
}
