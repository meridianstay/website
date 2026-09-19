import { galleryImages, images } from './images'

// The About us page (/about): content model, what the control center can edit, and default copy.
// Numbers such as {{liveStays}} are replaced with live figures from the platform, so impact figures stay true.
// The default copy is SAMPLE content for previews (including the founder story); admins replace it in the control center.

/** One card, milestone, stat or team entry. Each section uses the fields listed in its schema. */
export interface AboutItem {
  icon: string
  title: string
  meta: string
  text: string
  image: string
}

export interface AboutSection {
  title: string
  tagline: string
  body: string
  items: AboutItem[]
}

export type AboutSectionKey =
  | 'company' | 'mission' | 'vision' | 'journey' | 'founder' | 'team' | 'goals' | 'globalImpact' | 'localImpact' | 'whyUs'

export interface AboutPage {
  hero: { eyebrow: string; title: string; highlight: string; tagline: string; image: string }
  sections: Record<AboutSectionKey, AboutSection>
}

/** Live figures that can be written into any text as {{name}}. */
export interface AboutStats {
  liveStays: number
  hosts: number
  destinations: number
  states: number
  guestNights: number
  managedStays: number
}

export const ABOUT_TOKENS: { token: keyof AboutStats; label: string }[] = [
  { token: 'liveStays', label: 'Live stays' },
  { token: 'hosts', label: 'Hosts with live stays' },
  { token: 'destinations', label: 'Destinations (towns and cities)' },
  { token: 'states', label: 'States and regions' },
  { token: 'guestNights', label: 'Nights booked by guests' },
  { token: 'managedStays', label: 'Stays managed by Meridian' },
]

/** Replaces {{liveStays}} and friends with Indian-formatted numbers. Unknown tokens are left as they are. */
export function fillStats(text: string, stats: AboutStats | null): string {
  if (!stats) return text.replace(/\{\{(\w+)\}\}/g, '—')
  return text.replace(/\{\{(\w+)\}\}/g, (whole, key: string) =>
    key in stats ? stats[key as keyof AboutStats].toLocaleString('en-IN') : whole)
}

type ItemField = keyof AboutItem

/** Drives the control-center editor and validation: which item fields each section uses, and their labels. */
export const aboutSchema: {
  key: AboutSectionKey
  label: string
  hint: string
  itemLabel?: string
  maxItems?: number
  fields?: Partial<Record<ItemField, string>>
}[] = [
  { key: 'company', label: 'About the company', hint: 'Who Meridian Stay is.', itemLabel: 'Highlight', maxItems: 4, fields: { icon: 'Icon', title: 'Title', text: 'Text' } },
  { key: 'mission', label: 'Mission', hint: 'What you do every day.', itemLabel: 'Pillar', maxItems: 3, fields: { icon: 'Icon', title: 'Title', text: 'Text' } },
  { key: 'vision', label: 'Vision', hint: 'The future you are building.' },
  { key: 'journey', label: 'Our journey', hint: 'Milestones, oldest first.', itemLabel: 'Milestone', maxItems: 8, fields: { meta: 'Year or chapter', title: 'Title', text: 'What happened' } },
  { key: 'founder', label: 'About the founder', hint: 'Body is the founder’s story. The first entry is the founder card.', itemLabel: 'Founder card', maxItems: 1, fields: { title: 'Name', meta: 'Role', image: 'Photo', text: 'Quote' } },
  { key: 'team', label: 'Our team', hint: 'Teams or people.', itemLabel: 'Team', maxItems: 8, fields: { icon: 'Icon', title: 'Team or name', meta: 'Role or lead (optional)', image: 'Photo (optional)', text: 'What they do' } },
  { key: 'goals', label: 'Our aim and goals', hint: 'What you are working towards.', itemLabel: 'Goal', maxItems: 6, fields: { icon: 'Icon', title: 'Goal', text: 'Details' } },
  { key: 'globalImpact', label: 'Global impact', hint: 'Figures can use live numbers such as {{liveStays}}.', itemLabel: 'Impact', maxItems: 4, fields: { icon: 'Icon', title: 'Figure or headline', meta: 'Label', text: 'Details' } },
  { key: 'localImpact', label: 'Local impact', hint: 'Figures can use live numbers such as {{hosts}}.', itemLabel: 'Impact', maxItems: 4, fields: { icon: 'Icon', title: 'Figure or headline', meta: 'Label', text: 'Details' } },
  { key: 'whyUs', label: 'Why us?', hint: 'Reasons to choose Meridian Stay.', itemLabel: 'Reason', maxItems: 8, fields: { icon: 'Icon', title: 'Title', text: 'Text' } },
]

export const ABOUT_LIMITS = { title: 120, tagline: 240, body: 3000, itemTitle: 120, itemMeta: 80, itemText: 600 }

const item = (fields: Partial<AboutItem>): AboutItem => ({ icon: '', title: '', meta: '', text: '', image: '', ...fields })

export const defaultAbout: AboutPage = {
  hero: {
    eyebrow: 'About Meridian Stay',
    title: 'We bring you home to',
    highlight: 'Nature',
    tagline: 'Handpicked farmstays, forest cottages, riverside rooms and pool villas across India, run by people who love the land they live on.',
    image: galleryImages.mountainDeck,
  },
  sections: {
    company: {
      title: 'More than a place to sleep',
      tagline: 'A homegrown marketplace for stays that feel like the countryside you grew up hearing about.',
      body: 'Meridian Stay connects travellers with nature stays across India: coffee estates in Coorg, apple orchards in Himachal, houseboats on the Kerala backwaters and heritage havelis in Rajasthan.\n\nEvery listing is reviewed by our team before it goes live. Some properties we manage end to end, from upkeep to guest care, so you can book them instantly. Others are run by independent hosts who welcome each guest personally.',
      items: [
        item({ icon: 'seedling', title: 'Nature first', text: 'Stays chosen for their surroundings, not just their rooms.' }),
        item({ icon: 'magnifying-glass-location', title: 'Reviewed by people', text: 'Our team checks every listing before guests can book it.' }),
        item({ icon: 'indian-rupee-sign', title: 'Honest pricing', text: 'The price you see is the price you pay. No booking fees.' }),
        item({ icon: 'handshake', title: 'Fair to hosts', text: 'Clear commission, and payouts shown before a host accepts.' }),
      ],
    },
    mission: {
      title: 'Our mission',
      tagline: 'Make slow, meaningful travel easy to find, easy to book and good for the places it touches.',
      body: 'Travel should leave a place better than it was found. We make it simple for families, couples and solo travellers to discover stays rooted in their landscape, and we make sure the people who run those stays earn fairly from them.',
      items: [
        item({ icon: 'compass', title: 'Discover', text: 'Curated stays across farms, forests, rivers, hills and coasts.' }),
        item({ icon: 'shield-heart', title: 'Trust', text: 'Verified listings, real reviews from real stays, and clear policies.' }),
        item({ icon: 'people-roof', title: 'Belong', text: 'Hosts who share their food, their stories and their corner of India.' }),
      ],
    },
    vision: {
      title: 'Our vision',
      tagline: 'A country where every village with a view can welcome the world, sustainably.',
      body: 'We picture an India where a weekend escape means waking up to birdsong on a working farm, where rural families build lasting livelihoods from hospitality, and where the landscapes that make these stays special are protected for the next generation of travellers.',
      items: [],
    },
    journey: {
      title: 'Our journey',
      tagline: 'From a simple idea on a hill-station veranda to a platform for nature stays across India.',
      body: '',
      items: [
        item({ meta: 'Chapter 1', title: 'The spark', text: 'A simple question: why was it so hard to find a genuine farmstay, and so easy to end up in another concrete hotel?' }),
        item({ meta: 'Chapter 2', title: 'The first hosts', text: 'We visited properties in person, met the families behind them and listed our first handful of stays.' }),
        item({ meta: 'Chapter 3', title: 'Managed stays', text: 'We began managing some properties end to end, so guests could book them instantly with the same standard every time.' }),
        item({ meta: 'Chapter 4', title: 'Going digital', text: 'Meridian Stay launched online: instant booking, requests to hosts, secure payments and a portal for every host.' }),
        item({ meta: 'What’s next', title: 'Every corner of India', text: 'More regions, more host families, and tools that help small properties grow without losing their character.' }),
      ],
    },
    founder: {
      title: 'Meet our founder',
      tagline: 'The traveller who swapped city deadlines for village sunrises, and wanted everyone else to find them too.',
      body: 'Aarav grew up spending summer holidays on his grandparents’ farm in the Western Ghats: mango trees, monsoon rain on tin roofs, and dinners cooked with whatever the fields gave that day. Years later, working long hours in Bengaluru, he went looking for that feeling again and found it almost impossible to book.\n\nThe beautiful places were there, but they were hidden behind phone numbers, word of mouth and uncertain photos. The families who ran them had no easy way to reach travellers. So he started visiting them one by one, listing the ones he loved, and Meridian Stay was born.\n\nToday he still spends a week every month on the road, meeting hosts and staying in the properties himself. “If I wouldn’t bring my own family here,” he says, “it doesn’t go on Meridian.”',
      items: [item({ title: 'Aarav Sharma', meta: 'Founder & CEO', image: images.avatar, text: 'The best holidays don’t feel like a hotel. They feel like being welcomed into someone’s home, in a place you never want to leave.' })],
    },
    team: {
      title: 'The people behind your stay',
      tagline: 'Small teams, big hearts, and a shared love for the outdoors.',
      body: 'Behind every booking is a team that has walked the property, answered the host’s questions and made sure your stay is ready.',
      items: [
        item({ icon: 'house-circle-check', title: 'Listing quality', text: 'Reviews every new and edited listing, and checks photos, details and locations.' }),
        item({ icon: 'handshake-angle', title: 'Host success', text: 'Helps hosts set up, price fairly and answer booking requests on time.' }),
        item({ icon: 'headset', title: 'Guest care', text: 'Here before, during and after your trip, for questions, changes and refunds.' }),
        item({ icon: 'screwdriver-wrench', title: 'Managed properties', text: 'Looks after the stays we run: upkeep, housekeeping and local partners.' }),
      ],
    },
    goals: {
      title: 'What we’re working towards',
      tagline: 'Goals that keep us honest, with guests, with hosts and with the land.',
      body: '',
      items: [
        item({ icon: 'map-location-dot', title: 'Reach every region', text: 'Nature stays in every state, from the Himalaya to the Andamans.' }),
        item({ icon: 'hand-holding-heart', title: 'Grow rural incomes', text: 'Help host families turn spare rooms and farms into steady livelihoods.' }),
        item({ icon: 'leaf', title: 'Tread lightly', text: 'Encourage water saving, local sourcing and less plastic at every stay.' }),
        item({ icon: 'star', title: 'Earn every review', text: 'Keep standards high enough that guests come back and bring friends.' }),
      ],
    },
    globalImpact: {
      title: 'Global impact',
      tagline: 'Small stays, big picture: tourism that supports people and planet.',
      body: 'Responsible travel is one of the most direct ways visitors can support conservation and rural economies. Our work aligns with the UN Sustainable Development Goals for decent work, responsible consumption and life on land.',
      items: [
        item({ icon: 'earth-asia', title: 'SDG 8', meta: 'Decent work', text: 'Hospitality income that stays with local families and staff.' }),
        item({ icon: 'recycle', title: 'SDG 12', meta: 'Responsible consumption', text: 'Local food, less waste and stays built from what the land offers.' }),
        item({ icon: 'tree', title: 'SDG 15', meta: 'Life on land', text: 'Travel that gives farms, forests and orchards a reason to stay green.' }),
        item({ icon: 'plane-arrival', title: 'Welcoming the world', meta: 'Global guests', text: 'A window for international travellers into India beyond the big cities.' }),
      ],
    },
    localImpact: {
      title: 'Local impact',
      tagline: 'Every booking is a vote for the village, the farm and the family behind the door.',
      body: 'Guests pay no booking fee, and hosts see exactly what they earn before they accept a request. When you stay with us, most of what you pay goes straight to the people who welcome you.',
      items: [
        item({ icon: 'house-chimney', title: '{{liveStays}}', meta: 'Stays live today', text: 'Every one checked by our team before guests could book it.' }),
        item({ icon: 'people-group', title: '{{hosts}}', meta: 'Host families and partners', text: 'Earning from the homes, farms and land they care for.' }),
        item({ icon: 'location-dot', title: '{{destinations}}', meta: 'Destinations', text: 'Across {{states}} states and regions, and growing.' }),
        item({ icon: 'moon', title: '{{guestNights}}', meta: 'Nights booked', text: 'Nights guests have spent closer to nature with us.' }),
      ],
    },
    whyUs: {
      title: 'Why travellers choose Meridian',
      tagline: 'The good parts of a boutique hotel, the soul of a homestay.',
      body: '',
      items: [
        item({ icon: 'circle-check', title: 'Every stay reviewed', text: 'No listing goes live until our team has checked it.' }),
        item({ icon: 'bolt', title: 'Instant or personal', text: 'Book managed stays instantly, or send a request that hosts answer within 24 hours.' }),
        item({ icon: 'indian-rupee-sign', title: 'No booking fees', text: 'What you see per night is what you pay, in rupees.' }),
        item({ icon: 'lock', title: 'Secure payments', text: 'UPI, cards and net banking through Razorpay. Requests are only charged if accepted.' }),
        item({ icon: 'rotate-left', title: 'Fair cancellations', text: 'Full refund up to 48 hours before check-in.' }),
        item({ icon: 'star', title: 'Real reviews', text: 'Only guests who completed a stay can review it.' }),
      ],
    },
  },
}

/** A copy of the defaults with any missing sections or fields filled in (for content saved by older versions). */
export function withAboutDefaults(saved: Partial<AboutPage> | null | undefined): AboutPage {
  const page = structuredClone(defaultAbout)
  if (!saved) return page
  Object.assign(page.hero, saved.hero ?? {})
  for (const key of Object.keys(page.sections) as AboutSectionKey[]) {
    const s = saved.sections?.[key]
    if (s) page.sections[key] = { ...page.sections[key], ...s, items: (s.items ?? page.sections[key].items).map((i) => item(i)) }
  }
  return page
}

/** Pictures used on the page besides the hero. */
export const aboutImages = { story: images.farmstay, vision: galleryImages.himalaya }
