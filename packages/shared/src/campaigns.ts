// Messages the control centre writes itself, rather than ones the platform sends because something
// happened. An offer, a festival discount, a new destination — shown as a popup to people browsing
// the site, pushed to phones that allowed notifications, or both. They can go out now or on a date.
//
// The twelve booking messages in notifications.ts are the other kind: fixed events whose wording is
// editable. These are fully custom, audience-picked, and scheduled.

export type CampaignChannel = 'popup' | 'push'

export const CAMPAIGN_CHANNELS: { value: CampaignChannel; label: string; explain: string; icon: string }[] = [
  { value: 'popup', label: 'Popup on the website', explain: 'A card over the page while someone is browsing. Everyone sees it — no permission needed.', icon: 'rectangle-ad' },
  { value: 'push', label: 'Push to phones', explain: 'A notification on the phone or desktop, even with the site closed. Only reaches people who allowed it.', icon: 'bell' },
]

export type CampaignAudience = 'signedOut' | 'signedIn' | 'guests' | 'hosts' | 'pastGuests' | 'neverBooked' | 'appUsers'

/** Tick as many as apply: someone in *any* of them counts. Tick none and it goes to everyone. */
export const CAMPAIGN_AUDIENCES: { value: CampaignAudience; label: string; explain: string; icon: string }[] = [
  { value: 'signedOut', label: 'Not signed in', explain: 'Browsing without an account — good for a sign-up offer.', icon: 'user' },
  { value: 'signedIn', label: 'Signed in', explain: 'Anyone with an account, guest or host.', icon: 'circle-check' },
  { value: 'guests', label: 'Guests', explain: 'People who book, not the ones who host.', icon: 'suitcase-rolling' },
  { value: 'hosts', label: 'Hosts', explain: 'Useful for hosting offers and promotion discounts.', icon: 'house-chimney' },
  { value: 'pastGuests', label: 'Have stayed before', explain: 'At least one finished booking — your best audience for a repeat offer.', icon: 'star' },
  { value: 'neverBooked', label: 'Signed up, never booked', explain: 'Have an account but have not stayed yet.', icon: 'clock' },
  { value: 'appUsers', label: 'Have the app installed', explain: 'Opened from the home-screen icon rather than a browser tab.', icon: 'bell' },
]

export interface CampaignContent {
  title: string
  /** A sentence or two. Keep it short for push, where phones cut it off. */
  body: string
  /** Optional picture for the popup. Push notifications show it where the phone allows. */
  imageUrl: string
  buttonLabel: string
  /** A page on this site (/search?type=Villa) or a full https:// link. */
  buttonUrl: string
}

export interface PopupRules {
  /** Seconds of reading before it appears, so it doesn't interrupt the moment the page opens. */
  afterSeconds: number
  frequency: 'once' | 'daily' | 'always'
  where: 'everywhere' | 'home' | 'stays'
}

export const POPUP_FREQUENCIES: { value: PopupRules['frequency']; label: string }[] = [
  { value: 'once', label: 'Once per person' },
  { value: 'daily', label: 'Once a day' },
  { value: 'always', label: 'Every visit' },
]

export const POPUP_PLACES: { value: PopupRules['where']; label: string }[] = [
  { value: 'everywhere', label: 'Every page' },
  { value: 'home', label: 'The homepage only' },
  { value: 'stays', label: 'Search and stay pages' },
]

/** Draft → Scheduled (waiting for its date) → Live → Finished. Stopped ends it early. */
export type CampaignStatus = 'Draft' | 'Scheduled' | 'Live' | 'Finished' | 'Stopped'

export interface CampaignStats {
  shown: number
  clicked: number
  dismissed: number
  pushSent: number
  pushFailed: number
}

export interface Campaign {
  id: number
  /** What your team calls it. Never shown to anyone outside.  */
  name: string
  channels: CampaignChannel[]
  /** Anyone in *any* of these sees it. Empty means everyone. */
  audiences: CampaignAudience[]
  /** Narrows it further to people looking at these towns or states. Empty means anywhere. */
  places: string[]
  content: CampaignContent
  popup: PopupRules
  status: CampaignStatus
  /** When it starts. Empty means as soon as it is published. */
  startsAt: string | null
  /** When it stops showing. Empty means it runs until you stop it. */
  endsAt: string | null
  /** Set once the push has actually gone out, so it can never be sent twice. */
  pushedAt: string | null
  stats: CampaignStats
  createdAt: string
  updatedAt: string
}

export const CAMPAIGN_LIMITS = { title: 80, body: 300, buttonLabel: 30, name: 60 }

export const blankCampaign = (): Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: 'New campaign',
  channels: ['popup'],
  audiences: [],
  places: [],
  content: { title: '', body: '', imageUrl: '', buttonLabel: '', buttonUrl: '' },
  popup: { afterSeconds: 8, frequency: 'once', where: 'everywhere' },
  status: 'Draft',
  startsAt: null,
  endsAt: null,
  pushedAt: null,
  stats: { shown: 0, clicked: 0, dismissed: 0, pushSent: 0, pushFailed: 0 },
})

/** Who is looking, as far as the website can tell. */
export interface CampaignViewer {
  role: 'guest' | 'host' | 'admin' | null
  /** Opened from the home-screen icon rather than a browser tab. */
  installed: boolean
  /** Has at least one finished stay. */
  hasStayed: boolean
  /** Which page they are on, for the `where` rule. */
  page: 'home' | 'stays' | 'other'
  /** The town or state they picked, for a place-targeted campaign. */
  place?: string | null
}

function inCategory(audience: CampaignAudience, viewer: CampaignViewer): boolean {
  switch (audience) {
    case 'signedOut': return viewer.role === null
    case 'signedIn': return viewer.role !== null
    case 'guests': return viewer.role === 'guest'
    case 'hosts': return viewer.role === 'host'
    case 'pastGuests': return viewer.hasStayed
    case 'neverBooked': return viewer.role !== null && !viewer.hasStayed
    case 'appUsers': return viewer.installed
  }
}

/**
 * Someone in *any* of the ticked categories counts, and no categories means everyone. A place
 * filter narrows it further: they have to be in one of the categories *and* looking at one of the
 * places.
 */
export function matchesAudience(campaign: Pick<Campaign, 'audiences' | 'places'>, viewer: CampaignViewer): boolean {
  const category = campaign.audiences.length === 0 || campaign.audiences.some((a) => inCategory(a, viewer))
  if (!category) return false
  if (!campaign.places.length) return true
  const looking = (viewer.place ?? '').toLowerCase()
  return !!looking && campaign.places.some((p) => {
    const want = p.trim().toLowerCase()
    return !!want && (looking.includes(want) || want.includes(looking))
  })
}

const onPage = (where: PopupRules['where'], page: CampaignViewer['page']) =>
  where === 'everywhere' || (where === 'home' ? page === 'home' : page === 'stays')

/** Running right now, by its own dates. Status is what an admin set; this is what the clock says. */
export function isRunning(c: Pick<Campaign, 'status' | 'startsAt' | 'endsAt'>, now = new Date().toISOString()): boolean {
  if (c.status === 'Draft' || c.status === 'Stopped' || c.status === 'Finished') return false
  if (c.startsAt && c.startsAt > now) return false
  if (c.endsAt && c.endsAt < now) return false
  return true
}

/** The popup this visitor should see, if any: the newest running campaign that fits them. */
export function popupFor(campaigns: Campaign[], viewer: CampaignViewer, now?: string): Campaign | null {
  const fits = campaigns.filter((c) =>
    c.channels.includes('popup')
    && isRunning(c, now)
    && matchesAudience(c, viewer)
    && onPage(c.popup.where, viewer.page))
  return fits.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
}

/** How often a popup may come back, as a key and a lifetime the browser can remember. */
export const popupSeenKey = (id: number) => `meridian.popup.${id}`
