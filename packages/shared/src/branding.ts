// Logos, header and footer, edited in the control centre. Each app has its own logo and name,
// so the website, host portal, guest account and control centre can look different if the client wants.

export type BrandApp = 'website' | 'host' | 'account' | 'admin'

export interface AppBrand {
  /** An uploaded logo. Empty uses the built-in sprout mark. */
  logoUrl: string
  /** Show the name beside the logo (turn off when the logo already includes it). */
  showName: boolean
  name: string
  /** The second word, in the accent colour. */
  accent: string
  /** The small line under the name, e.g. "Host Portal". */
  subtitle: string
}

export type BrandingSettings = Record<BrandApp, AppBrand>

export const BRAND_APPS: { app: BrandApp; label: string; where: string }[] = [
  { app: 'website', label: 'Website', where: 'The public site guests see, and the shared login page.' },
  { app: 'host', label: 'Host portal', where: 'The panel hosts use to manage listings and bookings.' },
  { app: 'account', label: 'Guest account', where: 'Where guests see their trips and wishlist.' },
  { app: 'admin', label: 'Control centre', where: 'This panel.' },
]

export const defaultBranding: BrandingSettings = {
  website: { logoUrl: '', showName: true, name: 'Meridian', accent: 'Stay', subtitle: 'Nature & Luxury' },
  host: { logoUrl: '', showName: true, name: 'Meridian', accent: 'Stay', subtitle: 'Host Portal' },
  account: { logoUrl: '', showName: true, name: 'Meridian', accent: 'Stay', subtitle: 'My Account' },
  admin: { logoUrl: '', showName: true, name: 'Meridian', accent: 'Stay', subtitle: 'Control Center' },
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
}

export const BRAND_LIMITS = { headerLinks: 3, columns: 4, columnLinks: 8, legal: 5 }
