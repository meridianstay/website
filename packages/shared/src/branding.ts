// Logos, header and footer, edited in the control centre. Each app has its own logo and name,
// so the website, host portal, guest account and control centre can look different if the client wants.

export type BrandApp = 'website' | 'host' | 'account' | 'admin'

export interface AppBrand {
  /** An uploaded logo. Empty uses the built-in sprout mark. */
  logoUrl: string
  /** The little icon on the browser tab. A square PNG or SVG works best. */
  faviconUrl: string
  /** Shown while the app is starting, in place of the growing sprout. */
  splashUrl: string
  /** Show the name beside the logo (turn off when the logo already includes it). */
  showName: boolean
  name: string
  /** The second word, in the accent colour. */
  accent: string
  /** The small line under the name, e.g. "Host Portal". */
  subtitle: string
}

export interface BrandingSettings {
  /** One logo, tab icon and preloader per app. */
  apps: Record<BrandApp, AppBrand>
  /** Stands in for a photo that is missing or fails to load, anywhere on the site. */
  placeholderUrl: string
}

export const BRAND_APPS: { app: BrandApp; label: string; where: string }[] = [
  { app: 'website', label: 'Website', where: 'The public site guests see, and the shared login page.' },
  { app: 'host', label: 'Host portal', where: 'The panel hosts use to manage listings and bookings.' },
  { app: 'account', label: 'Guest account', where: 'Where guests see their trips and wishlist.' },
  { app: 'admin', label: 'Control centre', where: 'This panel.' },
]

const blank = { logoUrl: '', faviconUrl: '', splashUrl: '', showName: true, name: 'Meridian', accent: 'Stay' }

export const defaultBranding: BrandingSettings = {
  apps: {
    website: { ...blank, subtitle: 'Nature & Luxury' },
    host: { ...blank, subtitle: 'Host Portal' },
    account: { ...blank, subtitle: 'My Account' },
    admin: { ...blank, subtitle: 'Control Center' },
  },
  placeholderUrl: '',
}

/** Fills in anything missing, and understands settings saved before each app had its own icons. */
export function withBrandingDefaults(saved: Partial<BrandingSettings> | Record<string, unknown> | null | undefined): BrandingSettings {
  const base = structuredClone(defaultBranding)
  if (!saved) return base
  // Before 0.23.0 the four apps sat at the top level, with no placeholder or icons.
  const apps = ('apps' in saved ? saved.apps : saved) as Partial<Record<BrandApp, Partial<AppBrand>>> | undefined
  for (const { app } of BRAND_APPS) base.apps[app] = { ...base.apps[app], ...(apps?.[app] ?? {}) }
  const placeholder = (saved as Partial<BrandingSettings>).placeholderUrl
  if (typeof placeholder === 'string') base.placeholderUrl = placeholder
  return base
}

export interface NavItemLink {
  label: string
  /** A page on this site (starting with /) or a full https:// link. */
  url: string
}

export interface HeaderSettings {
  /** The search pill in the middle of the header. */
  showSearch: boolean
  /** The "Select city" destination picker. */
  showDestinations: boolean
  /** The "Download app" button. */
  showInstallApp: boolean
  /** The language and currency button. */
  showCurrency: boolean
  /** The hosting link, e.g. "List your property". Empty hides it. */
  hostLinkLabel: string
  /** Extra links, shown on wide screens. */
  links: NavItemLink[]
}

export const defaultHeader: HeaderSettings = {
  showSearch: true, showDestinations: true, showInstallApp: true, showCurrency: true,
  hostLinkLabel: 'List your property', links: [],
}

export interface FooterColumn {
  heading: string
  links: NavItemLink[]
}

export interface SocialLinks {
  instagram: string
  facebook: string
  whatsapp: string
  x: string
  youtube: string
}

export const SOCIAL_NETWORKS: { key: keyof SocialLinks; label: string; icon: string; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram', icon: 'camera', placeholder: 'https://instagram.com/…' },
  { key: 'facebook', label: 'Facebook', icon: 'thumbs-up', placeholder: 'https://facebook.com/…' },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'comment', placeholder: 'https://wa.me/91…' },
  { key: 'x', label: 'X (Twitter)', icon: 'hashtag', placeholder: 'https://x.com/…' },
  { key: 'youtube', label: 'YouTube', icon: 'play', placeholder: 'https://youtube.com/@…' },
]

export interface FooterSettings {
  tagline: string
  columns: FooterColumn[]
  social: SocialLinks
  /** The automatic "Popular searches" row built from live listings. */
  showPopularSearches: boolean
  legal: NavItemLink[]
  /** "{year}" is replaced with the current year. */
  copyright: string
  /** The line crediting whoever built the site. Leave the label empty to hide it. */
  credit: { label: string; url: string }
}

export const defaultFooter: FooterSettings = {
  tagline: 'Your premium ecosystem for farmstays, boutique resorts, woodland cottages, and luxury villas.',
  columns: [
    {
      heading: 'About Meridian',
      links: [
        { label: 'About us', url: '/about' },
        { label: 'How it works', url: '/how-it-works' },
        { label: 'Newsroom & Press', url: '/newsroom' },
        { label: 'Investors', url: '/investors' },
        { label: 'Eco-Sustainability', url: '/sustainability' },
      ],
    },
    {
      heading: 'Hosting',
      links: [
        { label: 'List your property', url: '/host/new' },
        { label: 'Host protection cover', url: '/host-protection' },
        { label: 'Explore hosting resources', url: '/hosting-resources' },
        { label: 'Community guidelines', url: '/community-guidelines' },
      ],
    },
    {
      heading: 'Support',
      links: [
        { label: 'Help Center', url: '/help' },
        { label: 'Cancellation options', url: '/cancellation-policy' },
        { label: 'Trust & Safety', url: '/trust-safety' },
        { label: 'Contact Us', url: '/contact' },
      ],
    },
  ],
  social: { instagram: '', facebook: '', whatsapp: '', x: '', youtube: '' },
  showPopularSearches: true,
  legal: [
    { label: 'Privacy', url: '/privacy' },
    { label: 'Terms', url: '/terms' },
    { label: 'Sitemap', url: '/sitemap' },
  ],
  copyright: '© {year} Meridian Stay Inc. All rights reserved.',
  credit: { label: 'Designed and developed by Digitech Miner', url: 'https://digitechminer.com' },
}

/** One tab in the bar along the bottom of a phone or tablet. */
export interface BottomTab {
  /** Stable name, so the code knows which tab does what: home, search, saved, trips, account. */
  key: string
  label: string
  /** Font Awesome icon name, without the prefix. */
  icon: string
  /** A page on this site (/search) or a panel path (/account/wishlist). */
  url: string
  enabled: boolean
}

export interface BottomNavSettings {
  /** Off hides the bar everywhere; the header still works. */
  enabled: boolean
  tabs: BottomTab[]
}

export const defaultBottomNav: BottomNavSettings = {
  enabled: true,
  tabs: [
    { key: 'home', label: 'Home', icon: 'house', url: '/', enabled: true },
    { key: 'search', label: 'Explore', icon: 'magnifying-glass', url: '/search', enabled: true },
    { key: 'saved', label: 'Saved', icon: 'heart', url: '/account/wishlist', enabled: true },
    { key: 'trips', label: 'Trips', icon: 'suitcase-rolling', url: '/account', enabled: true },
    { key: 'account', label: 'Account', icon: 'user', url: '/account/profile', enabled: true },
  ],
}

export const BRAND_LIMITS = { headerLinks: 3, columns: 4, columnLinks: 8, legal: 5, bottomTabs: 5 }
