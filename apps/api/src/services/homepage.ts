import {
  HOME_BLOCK_TYPES, HOME_LIMITS, STAY_RULES, withHomeDefaults, type HomeBlock, type HomeLayout, type PropertySummary, type PropertyType, type SearchQuery,
} from '@meridian/shared'
import { auditLogRepo, contentRepo, propertiesRepo } from '../repositories'
import { collect, isImageUrl, str } from '../http/validate'
import { PROPERTY_TYPES } from './listings'

// Homepage builder: stores the layout and runs each "Stays" section's rule.

/** The listings a "Stays" section shows. */
export async function staysFor(block: HomeBlock): Promise<PropertySummary[]> {
  const limit = Math.min(Math.max(block.limit || 6, HOME_LIMITS.minStays), HOME_LIMITS.maxStays)
  const q: SearchQuery & { limit: number } = { limit, sort: 'rating' }
  switch (block.rule) {
    case 'featured': {
      const featured = await propertiesRepo.search({ featured: true, limit })
      return featured.length ? featured : propertiesRepo.search({ sort: 'newest', limit })
    }
    case 'top_rated': break
    case 'newest': q.sort = 'newest'; break
    case 'instant': q.management = 'managed'; break
    case 'request': q.management = 'self'; break
    case 'price_low': q.sort = 'price_asc'; break
    case 'price_high': q.sort = 'price_desc'; break
    case 'type': q.type = block.propertyType || undefined; break
    case 'location': q.where = block.location || undefined; break
    case 'budget': q.maxPrice = block.maxPrice ?? undefined; q.sort = 'price_asc'; break
    // The website fills these in itself: "nearby" needs the visitor's location, "promoted" counts ad views.
    case 'nearby': break
    case 'promoted': return []
    case 'dayuse': return (await propertiesRepo.search({ ...q, limit: 100 })).filter((p) => p.dayUse).slice(0, limit)
  }
  return propertiesRepo.search(q)
}

const isLink = (v: string) => !v || /^https:\/\/\S+$/.test(v) || /^\/[^\s]*$/.test(v)
const isImage = (v: string) => !v || isImageUrl(v)

export const homepageService = {
  async layout(): Promise<HomeLayout> {
    return contentRepo.home()
  },

  /** The layout plus the stays for every switched-on "Stays" section, for the website. */
  async forWebsite() {
    const layout = await contentRepo.home()
    const blocks = layout.blocks.filter((b) => b.enabled)
    const stays: Record<string, PropertySummary[]> = {}
    await Promise.all(blocks.filter((b) => b.type === 'stays').map(async (b) => { stays[b.id] = await staysFor(b) }))
    return { layout: { ...layout, blocks }, stays }
  },

  /** Checks and saves the whole layout. Returns it as saved. */
  async save(admin: { id: number; name: string }, body: Record<string, unknown>): Promise<HomeLayout> {
    const raw = withHomeDefaults(body as Partial<HomeLayout>)
    const fields: Record<string, string> = {}
    const text = (v: unknown, max: number, at: string, required = false) => {
      const t = str(v)
      if (t.length > max) fields[at] = `Keep this under ${max} characters.`
      if (required && !t) fields[at] = 'This can’t be empty.'
      return t
    }
    const image = (v: unknown, at: string) => {
      const t = str(v)
      if (!isImage(t)) fields[at] = 'Upload a photo, or use an image link starting with https://'
      return t
    }
    const link = (v: unknown, at: string) => {
      const t = str(v)
      if (!isLink(t)) fields[at] = 'Use a page on this site (starting with /) or a link starting with https://'
      return t
    }

    const h = raw.hero
    const slides = h.slides.slice(0, HOME_LIMITS.slides).map((s, i) => {
      const at = (f: string) => `hero.slides.${i}.${f}`
      const slide = {
        badge: text(s.badge, 60, at('badge')), title: text(s.title, 120, at('title'), true), highlight: text(s.highlight, 40, at('highlight')),
        subtitle: text(s.subtitle, 300, at('subtitle')), image: image(s.image, at('image')),
        buttonLabel: text(s.buttonLabel, 40, at('buttonLabel')), buttonUrl: link(s.buttonUrl, at('buttonUrl')),
      }
      if (!slide.image) fields[at('image')] = 'Add a background photo.'
      if (slide.buttonLabel && !slide.buttonUrl) fields[at('buttonUrl')] = 'Where should the button go?'
      return slide
    })
    if (!slides.length) fields['hero.slides'] = 'Add at least one slide.'
    const intervalSec = Math.round(Number(h.intervalSec))
    if (!(intervalSec >= HOME_LIMITS.minInterval && intervalSec <= HOME_LIMITS.maxInterval)) fields['hero.intervalSec'] = `Choose ${HOME_LIMITS.minInterval}–${HOME_LIMITS.maxInterval} seconds.`

    const seen = new Set<string>()
    const blocks = raw.blocks.slice(0, HOME_LIMITS.blocks).map((b, i): HomeBlock => {
      const at = (f: string) => `blocks.${i}.${f}`
      let id = str(b.id).replace(/[^\w-]/g, '').slice(0, 40) || `b${i}`
      while (seen.has(id)) id = `${id}x`
      seen.add(id)
      if (!HOME_BLOCK_TYPES.some((t) => t.value === b.type)) fields[at('type')] = 'Unknown section type.'
      const block: HomeBlock = {
        id, type: b.type, enabled: b.enabled !== false,
        title: text(b.title, 120, at('title'), true), subtitle: text(b.subtitle, 200, at('subtitle')),
        rule: b.rule, propertyType: '', location: '', maxPrice: null, limit: 6,
        cards: [], badge: '', text: '', image: '', buttonLabel: '', buttonUrl: '', tone: 'green',
      }
      if (b.type === 'stays') {
        const rule = STAY_RULES.find((r) => r.value === b.rule)
        if (!rule) fields[at('rule')] = 'Choose which stays to show.'
        block.limit = Math.round(Number(b.limit))
        if (!(block.limit >= HOME_LIMITS.minStays && block.limit <= HOME_LIMITS.maxStays)) fields[at('limit')] = `Show ${HOME_LIMITS.minStays}–${HOME_LIMITS.maxStays} stays.`
        if (rule?.needs === 'type') {
          block.propertyType = b.propertyType
          if (!PROPERTY_TYPES.includes(b.propertyType as PropertyType)) fields[at('propertyType')] = 'Choose a property type.'
        }
        if (rule?.needs === 'location') block.location = text(b.location, 80, at('location'), true)
        if (rule?.needs === 'budget') {
          block.maxPrice = Math.round(Number(b.maxPrice))
          if (!(block.maxPrice >= 100 && block.maxPrice <= 1_000_000)) fields[at('maxPrice')] = 'Enter a nightly price in rupees, e.g. 5000.'
        }
      }
      if (b.type === 'categories') {
        block.cards = b.cards.slice(0, HOME_LIMITS.cards).map((c, j) => {
          const cat = (f: string) => at(`cards.${j}.${f}`)
          if (!PROPERTY_TYPES.includes(c.type)) fields[cat('type')] = 'Choose a property type.'
          const card = { type: c.type, label: text(c.label, 40, cat('label'), true), tag: text(c.tag, 30, cat('tag')), text: text(c.text, 120, cat('text')), image: image(c.image, cat('image')) }
          if (!card.image) fields[cat('image')] = 'Add a photo.'
          return card
        })
        if (!block.cards.length) fields[at('cards')] = 'Add at least one property type.'
      }
      if (b.type === 'banner') {
        Object.assign(block, {
          badge: text(b.badge, 40, at('badge')), text: text(b.text, 400, at('text')), image: image(b.image, at('image')),
          buttonLabel: text(b.buttonLabel, 40, at('buttonLabel')), buttonUrl: link(b.buttonUrl, at('buttonUrl')),
          tone: ['green', 'dark', 'light'].includes(b.tone) ? b.tone : 'green',
        })
        if (block.buttonLabel && !block.buttonUrl) fields[at('buttonUrl')] = 'Where should the button go?'
      }
      return block
    })

    collect(fields)
    const layout: HomeLayout = { hero: { mode: h.mode === 'static' ? 'static' : 'slider', slides, intervalSec, showSearch: h.showSearch !== false }, blocks }
    await contentRepo.saveHome(layout, admin.id)
    await auditLogRepo.record(admin, 'settings.update', 'settings', 'homepage', { hero: layout.hero.mode, slides: slides.length, sections: blocks.map((b) => `${b.type}${b.enabled ? '' : ' (off)'}`) })
    return layout
  },
}
