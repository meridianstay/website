// A client's own website. Each host (the client) gets a landing page carrying their logo and their
// wording, at their own domain or at <business-name>.meridianstay.com, with Meridian credited
// alongside. The same listings that appear on the marketplace are what the page sells; a client with
// more than one branch shows the others below.
//
// The page is the client's shopfront, so unlike the marketplace it names them and gives their phone
// and email. Bookings still run through Meridian, which is what keeps dates, payments and payouts in
// one place.

export type ClientSiteStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected'

/** Where a custom domain has got to. Until it is `live`, the subdomain is what works. */
export type DomainStatus = 'none' | 'pending' | 'live' | 'failed'

export interface ClientPolicies {
  /** House rules and terms for staying at the property. */
  terms: string
  /** What is taken when, and how. */
  payment: string
  /** What a guest gets back, and by when. */
  cancellation: string
}

export interface ClientContact {
  phone: string
  email: string
  /** The address shown on the page — the client's own office or main property. */
  address: string
  whatsapp: string
}

/** Everything the client writes. Edited freely; only a copy your team has approved goes public. */
export interface ClientSiteContent {
  businessName: string
  /** Used for <slug>.meridianstay.com and for /c/<slug> while a domain is being set up. */
  slug: string
  logoUrl: string
  tagline: string
  /** Who the client is, in their own words. */
  about: string
  contact: ClientContact
  policies: ClientPolicies
  /** The listing shown at the top of the landing page. Null means the newest approved one. */
  featuredPropertyId: number | null
}

export interface ClientSite {
  /** The host this site belongs to. One client, one site, however many branches. */
  hostId: number
  /** What the client is working on. */
  content: ClientSiteContent
  /**
   * The copy visitors see. Null until your team approves it for the first time. An edit after that
   * never takes the live site down: it waits here until the new copy is approved in its turn.
   */
  published: ClientSiteContent | null
  domain: {
    /** The client's own domain, without https:// — empty when they haven't got one. */
    name: string
    status: DomainStatus
    /** Why it failed, or what your team noted. */
    note: string
    checkedAt: string | null
  }
  status: ClientSiteStatus
  /** Why your team sent it back, shown to the client. */
  rejectionReason: string
  createdAt: string
  updatedAt: string
}

export const CLIENT_SITE_LIMITS = {
  businessName: 60,
  slug: 40,
  tagline: 120,
  about: 2000,
  policy: 4000,
  address: 200,
}

/** The base every client subdomain hangs off. The control centre can change it. */
export const DEFAULT_SITE_DOMAIN = 'meridianstay.com'

/**
 * A business name turned into something that can live in a domain: lower case, words joined by
 * hyphens, nothing else. "Green Valley Farmstays & Resorts" becomes "green-valley-farmstays-resorts".
 */
export function siteSlug(businessName: string): string {
  return businessName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, CLIENT_SITE_LIMITS.slug)
    .replace(/-+$/, '')
}

/** Names that would collide with the platform's own addresses, so no client may have them. */
export const RESERVED_SLUGS = [
  'www', 'api', 'admin', 'host', 'account', 'app', 'mail', 'blog', 'help', 'support',
  'book', 'booking', 'stays', 'search', 'login', 'static', 'assets', 'cdn', 'meridian', 'meridianstay',
]

/** The address a client's site answers on: their own domain once it is live, otherwise the subdomain. */
export function siteAddress(slug: string, domain: ClientSite['domain'], base = DEFAULT_SITE_DOMAIN): string {
  return domain.status === 'live' && domain.name ? domain.name : `${slug}.${base}`
}

export const siteUrl = (slug: string, domain: ClientSite['domain'], base?: string) => `https://${siteAddress(slug, domain, base)}`

/** A domain someone typed, tidied: no scheme, no path, no www, lower case. */
export function cleanDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/[^a-z0-9.-]/g, '')
}

/** Looks like a domain at all: something.something, no spaces, a real top level. */
export const looksLikeDomain = (d: string) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d) && d.includes('.')

/**
 * What the client has to add at their domain registrar. An apex domain (example.com) needs an A
 * record; anything in front of it (www, stay) needs a CNAME.
 */
export function dnsRecords(domain: string): { type: 'A' | 'CNAME'; name: string; value: string }[] {
  const apex = domain.split('.').length <= 2
  return apex
    ? [
        { type: 'A', name: '@', value: '76.76.21.21' },
        { type: 'CNAME', name: 'www', value: 'cname.vercel-dns.com' },
      ]
    : [{ type: 'CNAME', name: domain.split('.')[0], value: 'cname.vercel-dns.com' }]
}

export const blankContent = (): ClientSiteContent => ({
  businessName: '',
  slug: '',
  logoUrl: '',
  tagline: '',
  about: '',
  contact: { phone: '', email: '', address: '', whatsapp: '' },
  policies: { terms: '', payment: '', cancellation: '' },
  featuredPropertyId: null,
})

export const blankClientSite = (hostId: number): Omit<ClientSite, 'createdAt' | 'updatedAt'> => ({
  hostId,
  content: blankContent(),
  published: null,
  domain: { name: '', status: 'none', note: '', checkedAt: null },
  status: 'Draft',
  rejectionReason: '',
})

/** True when the client has changed something since the copy visitors are being served. */
export const hasUnpublishedChanges = (site: ClientSite) =>
  !!site.published && JSON.stringify(site.content) !== JSON.stringify(site.published)

/** Default wording, so a client's page is never blank while they write their own. */
export const starterPolicies = (businessName: string): ClientPolicies => ({
  terms: `Check-in and check-out times are shown with each stay. Please bring a government photo ID for every adult guest.\n\nThe number of guests may not exceed what the stay is booked for. ${businessName || 'We'} may refuse entry where it does.\n\nPlease treat the property and its surroundings with care. Any damage is charged at cost.`,
  payment: 'Payment is taken in full at the time of booking, through Meridian Stay, by UPI, card or net banking.\n\nA booking is only held once payment has gone through. Prices include taxes unless the stay says otherwise.',
  cancellation: 'Cancel more than 7 days before check-in and you are refunded in full, less the platform convenience fee.\n\nCancel within 7 days of check-in and 50% is refunded.\n\nCancel within 48 hours of check-in, or do not arrive, and the booking is not refunded.',
})

/**
 * What a visitor to a client's site is served: the approved wording, plus the client's stays. The
 * page names the business and gives its phone and email — it is a shopfront, not a listing.
 */
export interface ClientSiteView extends ClientSiteContent {
  /** The address this site answers on, for links and sharing. */
  address: string
  /** Every approved stay this client runs, the featured one first. */
  stays: ClientStay[]
}

/** One of the client's stays, as the landing page lists it. */
export interface ClientStay {
  id: number
  slug: string
  title: string
  type: string
  city: string
  region: string
  image: string
  price: number
  priceNow: number
  rating: number
  reviewCount: number
  maxGuests: number
  beds: number
  baths: number
}
