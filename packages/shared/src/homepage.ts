import { images, galleryImages } from './images'
import type { PropertyType } from './types'
import type { HomepageSettings } from './content'

// The homepage builder: the hero (static or slider) and an ordered list of sections the control center
// can add, remove, reorder and switch off. "Stays" sections pick listings with a rule chosen from a
// plain-language list; the API runs the rule, so the website and the editor preview always agree.

export interface HeroSlide {
  badge: string
  title: string
  highlight: string
  subtitle: string
  image: string
  buttonLabel: string
  buttonUrl: string
}

export interface HeroSettings {
  /** static: the first slide only. slider: every slide, changing automatically. */
  mode: 'static' | 'slider'
  slides: HeroSlide[]
  /** Seconds each slide shows in slider mode. */
  intervalSec: number
  /** The search box over the hero. */
  showSearch: boolean
}

export interface CategoryCard {
  type: PropertyType
  label: string
  tag: string
  text: string
  image: string
}

/** How a "Stays" section chooses its listings. */
export type StayRule = 'featured' | 'top_rated' | 'newest' | 'instant' | 'request' | 'price_low' | 'price_high' | 'type' | 'location' | 'budget' | 'nearby' | 'dayuse' | 'promoted'

export const STAY_RULES: { value: StayRule; label: string; explain: string; needs?: 'type' | 'location' | 'budget' }[] = [
  { value: 'featured', label: 'Featured by our team', explain: 'Stays you mark with “Feature” on the Listings page, in the order you set there. If none are featured, the newest live stays show instead.' },
  { value: 'top_rated', label: 'Highest rated', explain: 'Live stays with the best guest rating first (stays with more reviews win ties).' },
  { value: 'newest', label: 'Newest on Meridian', explain: 'The most recently added live stays first.' },
  { value: 'instant', label: 'Instant book (managed by Meridian)', explain: 'Only properties Meridian manages, which guests can book straight away.' },
  { value: 'request', label: 'Hosted by local families', explain: 'Only self-managed properties, where the host personally accepts each booking request.' },
  { value: 'price_low', label: 'Best value (lowest price first)', explain: 'Live stays sorted from the lowest nightly price.' },
  { value: 'price_high', label: 'Luxury (highest price first)', explain: 'Live stays sorted from the highest nightly price.' },
  { value: 'type', label: 'One property type', explain: 'Only the property type you choose, highest rated first.', needs: 'type' },
  { value: 'location', label: 'In a destination', explain: 'Only stays in the town or state you choose, highest rated first.', needs: 'location' },
  { value: 'nearby', label: 'Near the visitor', explain: 'Stays closest to the destination the visitor picked, or to them if they tap “Near me”. Until they pick one, the highest-rated stays show. Write {place} in the title to show the name, e.g. “Weekend stays near {place}”.' },
  { value: 'promoted', label: 'Promoted by hosts (paid)', explain: 'Listings hosts have paid to promote, clearly labelled “Promoted”. The row hides itself when no one is promoting.' },
  { value: 'dayuse', label: 'Day out (day use)', explain: 'Only properties that offer day use for picnics, pool days and parties, highest rated first.' },
  { value: 'budget', label: 'Under a price', explain: 'Only stays up to the nightly price you set, lowest price first.', needs: 'budget' },
]

export type HomeBlockType = 'categories' | 'stays' | 'banner'

export const HOME_BLOCK_TYPES: { value: HomeBlockType; label: string; explain: string; icon: string }[] = [
  { value: 'stays', label: 'Stays', explain: 'A row of stays chosen by a rule, e.g. featured, highest rated or in Kerala.', icon: 'house-chimney' },
  { value: 'categories', label: 'Property types', explain: 'Picture cards for farmstays, resorts, cottages and more.', icon: 'shapes' },
  { value: 'banner', label: 'Banner', explain: 'A coloured banner with text, a photo and a button.', icon: 'rectangle-ad' },
]

/** One homepage section. Each type uses some of the fields (see the editor). */
export interface HomeBlock {
  id: string
  type: HomeBlockType
  enabled: boolean
  title: string
  subtitle: string
  // stays
  rule: StayRule
  propertyType: PropertyType | ''
  location: string
  maxPrice: number | null
  limit: number
  // categories
  cards: CategoryCard[]
  // banner
  badge: string
  text: string
  image: string
  buttonLabel: string
  buttonUrl: string
  tone: 'green' | 'dark' | 'light'
}

export interface HomeLayout {
  hero: HeroSettings
  blocks: HomeBlock[]
}

export const HOME_LIMITS = { slides: 6, blocks: 12, cards: 8, minStays: 3, maxStays: 12, minInterval: 4, maxInterval: 15 }

export const blankSlide: HeroSlide = { badge: '', title: '', highlight: '', subtitle: '', image: '', buttonLabel: '', buttonUrl: '' }

export function newBlock(type: HomeBlockType, id = `b${Date.now().toString(36)}`): HomeBlock {
  const base: HomeBlock = {
    id, type, enabled: true, title: '', subtitle: '', rule: 'featured', propertyType: '', location: '', maxPrice: null, limit: 6,
    cards: [], badge: '', text: '', image: '', buttonLabel: '', buttonUrl: '', tone: 'green',
  }
  if (type === 'stays') return { ...base, title: 'Handpicked for you', subtitle: 'Stays our guests love right now' }
  if (type === 'categories') return { ...base, title: 'Explore Property Types', cards: structuredClone(defaultCategoryCards) }
  return { ...base, title: 'Your headline here', text: 'A sentence or two about what you’re promoting.', buttonLabel: 'Learn more', buttonUrl: '/search', image: galleryImages.poolDusk }
}

export const defaultCategoryCards: CategoryCard[] = [
  { type: 'Farmstay', label: 'Farmstays', tag: 'Organic Vibe', text: 'Live close to nature & orchards', image: images.farmstay },
  { type: 'Resort', label: 'Resorts', tag: 'Luxury', text: 'World-class amenities & pools', image: images.resort },
  { type: 'Cottage', label: 'Cottages', tag: 'Cozy', text: 'Woodland & hillside wooden homes', image: images.cottage },
  { type: 'Villa', label: 'Villas', tag: 'Exclusive', text: 'Private lawns & infinity pools', image: images.villa },
]

/** The homepage as it looked before the builder, using any hero and featured texts already edited. */
export function defaultHomeLayout(legacy?: HomepageSettings): HomeLayout {
  const featured = newBlock('stays', 'featured')
  return {
    hero: {
      mode: 'slider',
      intervalSec: 6,
      showSearch: true,
      slides: [
        {
          badge: legacy?.heroBadge ?? 'Curated Eco-Stays & Luxury Escapes',
          title: legacy?.heroTitle ?? 'Find your peaceful sanctuary in',
          highlight: legacy?.heroHighlight ?? 'Nature',
          subtitle: legacy?.heroSubtitle ?? 'Discover handpicked farmstays, secluded forest cottages, scenic resorts, and luxury pool villas for your next unforgettable getaway.',
          image: images.hero, buttonLabel: '', buttonUrl: '',
        },
        {
          badge: 'Kerala Backwaters', title: 'Drift through the palms on a', highlight: 'Houseboat',
          subtitle: 'Wake up on the water, with fresh Kerala meals cooked on board.',
          image: galleryImages.backwaters, buttonLabel: 'See Kerala stays', buttonUrl: '/search?where=Kerala',
        },
        {
          badge: 'Himalayan Escapes', title: 'Snow peaks, pine forests and', highlight: 'Silence',
          subtitle: 'Cottages and resorts in Himachal, Sikkim and Uttarakhand.',
          image: galleryImages.himalaya, buttonLabel: 'Explore the mountains', buttonUrl: '/search?type=Cottage',
        },
      ],
    },
    blocks: [
      newBlock('categories', 'categories'),
      { ...featured, title: legacy?.featuredTitle ?? 'Featured Meridian Stays', subtitle: legacy?.featuredSubtitle ?? 'Most loved by families and nature seekers this month' },
      { ...newBlock('stays', 'nearby'), rule: 'nearby', title: 'Weekend getaways near {place}', subtitle: 'Pick your city, or tap Near me, and we’ll show what’s closest', limit: 6 },
      { ...newBlock('stays', 'promoted'), rule: 'promoted', title: 'Promoted stays', subtitle: 'Paid placements from our hosts', limit: 6 },
      { ...newBlock('stays', 'dayouts'), rule: 'dayuse', title: 'Day outs & pool parties', subtitle: 'Book a farm or villa by the hour for picnics and celebrations', limit: 3 },
      { ...newBlock('stays', 'instant'), rule: 'instant', title: 'Book instantly', subtitle: 'Managed by Meridian: confirmed the moment you book', limit: 3 },
      {
        ...newBlock('banner', 'host'), badge: 'Meridian Hosts', title: 'Got a farmstay, cottage, or resort?', tone: 'green',
        text: 'List your property on Meridian Stay and start welcoming nature-loving guests. No listing fees: we only earn a commission when you’re booked.',
        buttonLabel: 'Become a Host', buttonUrl: '/host/new', image: images.hostBanner,
      },
    ],
  }
}

/** Fills missing fields of a saved layout (e.g. saved by an older version). */
export function withHomeDefaults(saved: Partial<HomeLayout> | null | undefined, legacy?: HomepageSettings): HomeLayout {
  const base = defaultHomeLayout(legacy)
  if (!saved) return base
  return {
    hero: { ...base.hero, ...saved.hero, slides: (saved.hero?.slides ?? base.hero.slides).map((s) => ({ ...blankSlide, ...s })) },
    blocks: (saved.blocks ?? base.blocks).map((b) => ({ ...newBlock(b.type ?? 'stays', b.id), ...b })),
  }
}
