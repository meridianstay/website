import { defaultBranding, defaultFooter, defaultHeader, type BrandingSettings, type FooterSettings, type HeaderSettings } from './branding'
import { defaultPromotions, type PromotionSettings } from './promotions'
import { defaultCommission, type CommissionRates } from './pricing'
import { defaultTheme, type ThemeSettings } from './theme'
// Default website content. The API copies it into the database on first start; after that
// the admin control center edits it. Legal pages start as drafts for a lawyer to review.

export interface PageSection {
  heading: string
  body: string[]
}

export interface ContentPage {
  slug: string
  title: string
  intro: string
  draft: boolean
  sections: PageSection[]
  published?: boolean
  updatedAt?: string
}

export interface HomepageSettings {
  heroBadge: string
  heroTitle: string
  heroHighlight: string
  heroSubtitle: string
  featuredTitle: string
  featuredSubtitle: string
}

export interface AnnouncementSettings {
  enabled: boolean
  text: string
  linkLabel: string
  linkUrl: string
}

/** Which Firebase sign-in methods the website and host login offer. The admin login always allows both. */
export interface SignInSettings {
  google: boolean
  phone: boolean
}

export interface UploadSettings {
  /** Largest photo a host or guest can upload, in MB (at most 4). */
  maxMb: number
}

export interface SiteSettings {
  homepage: HomepageSettings
  announcement: AnnouncementSettings
  signIn: SignInSettings
  uploads: UploadSettings
  /** Meridian's commission by management type, and the convenience fee kept on a cancellation. */
  commission: CommissionRates
  /** Paid promotions hosts can buy (daily rates in ₹). */
  promotions: PromotionSettings
  /** Logos and names, per app. */
  /** The colour palette every app uses. */
  theme: ThemeSettings
  branding: BrandingSettings
  /** The website's header and footer. */
  header: HeaderSettings
  footer: FooterSettings
}

export const defaultSiteSettings: SiteSettings = {
  homepage: {
    heroBadge: 'Curated Eco-Stays & Luxury Escapes',
    heroTitle: 'Find your peaceful sanctuary in',
    heroHighlight: 'Nature',
    heroSubtitle: 'Discover handpicked farmstays, secluded forest cottages, scenic resorts, and luxury pool villas for your next unforgettable getaway.',
    featuredTitle: 'Featured Meridian Stays',
    featuredSubtitle: 'Most loved by families and nature seekers this month',
  },
  announcement: {
    enabled: false,
    text: 'Meridian Stay is in testing: bookings are confirmed without taking payment.',
    linkLabel: 'Learn more',
    linkUrl: '/help',
  },
  signIn: { google: true, phone: true },
  uploads: { maxMb: 4 },
  commission: { ...defaultCommission },
  promotions: { ...defaultPromotions },
  theme: { ...defaultTheme },
  branding: structuredClone(defaultBranding),
  header: structuredClone(defaultHeader),
  footer: structuredClone(defaultFooter),
}

type DefaultPage = Omit<ContentPage, 'slug' | 'draft'> & { draft?: boolean }

const pages: Record<string, DefaultPage> = {
  'how-it-works': {
    title: 'How Meridian Stay works',
    intro: 'Meridian Stay connects travellers with independent hosts of farmstays, private rooms, cottages, resorts and villas.',
    sections: [
      { heading: 'For guests', body: ['Search by destination, dates and number of guests. Only stays that are free on your dates are shown.', 'Open a stay to see photos, amenities, the location and reviews from guests who stayed there. Pick your dates and reserve.', 'After booking, your trip appears under Trips in your account, where you can also cancel if your plans change.'] },
      { heading: 'For hosts', body: ['Anyone with an account can list a property. Add photos, a description, amenities, a nightly price and the location.', 'Our team reviews every new listing, and every edit, before it goes live. You’ll see the status in your host dashboard.', 'Bookings and earnings for your listings appear in the host portal as soon as a guest books.'] },
      { heading: 'Reviews you can trust', body: ['Only guests who completed a stay can review it, and only once per booking.'] },
    ],
  },
  newsroom: {
    title: 'Newsroom & Press',
    intro: 'Meridian Stay is an early-stage platform for nature-first stays.',
    sections: [{ heading: 'Press enquiries', body: ['For interviews, images or information about Meridian Stay, send us a message using the contact form and choose the “Press” topic. We reply within two working days.'] }],
  },
  investors: {
    title: 'Investors',
    intro: 'We’re building a trusted marketplace for local, nature-first stays.',
    sections: [{ heading: 'Get in touch', body: ['If you’d like to learn more about Meridian Stay, use the contact form and choose “Partnerships & investors”.'] }],
  },
  sustainability: {
    title: 'Eco-Sustainability',
    intro: 'Many of our hosts farm, conserve water and run on renewable energy. We want travel to support that.',
    sections: [
      { heading: 'What we look for', body: ['Stays that work with their surroundings: organic farms, solar power, rainwater harvesting, local food and local staff.'] },
      { heading: 'Travelling lightly', body: ['Choose longer stays over many short trips, travel by train where you can, and follow your host’s guidance on water and waste.'] },
    ],
  },
  'host-protection': {
    title: 'Host protection cover',
    intro: 'We’re putting a protection programme in place for hosts before bookings with real payments begin.',
    draft: true,
    sections: [
      { heading: 'What’s planned', body: ['Cover for accidental damage caused by guests during a confirmed stay, with a clear claims process through the host portal.'] },
      { heading: 'Until then', body: ['Agree house rules with guests before arrival and report any problem to us through the contact form under “Trust & safety”.'] },
    ],
  },
  'hosting-resources': {
    title: 'Hosting resources',
    intro: 'Practical tips to get your listing approved quickly and booked often.',
    sections: [
      { heading: 'Photos', body: ['Use bright, horizontal photos. Start with the view or the space guests will love most, then bedrooms, bathrooms and the kitchen.'] },
      { heading: 'Description', body: ['Say what makes your place special in the first sentence. Mention how to get there, what’s nearby and what’s included.'] },
      { heading: 'Pricing', body: ['Check similar stays in your area. The nightly price covers two guests; each extra guest adds 15%. Meridian’s commission is deducted from your payout: 15% for properties you manage yourself.'] },
    ],
  },
  'community-guidelines': {
    title: 'Community guidelines',
    intro: 'Meridian Stay works because guests and hosts treat each other, and each place, with respect.',
    sections: [
      { heading: 'Be honest', body: ['Listings must show the real place. Reviews must describe a real stay.'] },
      { heading: 'Be safe and fair', body: ['No discrimination, harassment or unsafe conditions. Hosts must provide what the listing promises.'] },
      { heading: 'Respect the place', body: ['Follow house rules, local laws and the host’s guidance on the environment.'] },
    ],
  },
  help: {
    title: 'Help Center',
    intro: 'Answers to the most common questions. Can’t find yours? Contact us.',
    sections: [
      { heading: 'How do I book a stay?', body: ['Search for a destination, open a stay, choose your dates and guests, then select Reserve (or Request to book for stays whose hosts approve each booking). You’ll sign in with Google or your phone number to confirm.'] },
      { heading: 'How is the price worked out?', body: ['The nightly price covers two guests. Each extra guest adds 15% to the nightly total. There are no extra booking or service fees.'] },
      { heading: 'How do I cancel?', body: ['Go to Trips in your account and choose Cancel booking. You can cancel until the day before check-in. See the cancellation policy for details.'] },
      { heading: 'When am I charged?', body: ['Stays managed by Meridian are booked instantly and charged when you pay. For stays run by their owners, you send a request: the amount is held on your card or UPI and only charged if the host accepts within 24 hours. Otherwise the hold is released.'] },
      { heading: 'How do I list my property?', body: ['Choose “List your property” at the top of any page. Your listing is reviewed by our team before it goes live.'] },
    ],
  },
  'cancellation-policy': {
    title: 'Cancellation policy',
    intro: 'Plans change. Here’s how cancellations work on Meridian Stay.',
    draft: true,
    sections: [
      { heading: 'Guests', body: ['You can cancel a confirmed booking from Trips in your account until the day before check-in.', 'Cancellations made at least 48 hours before check-in (by noon on the check-in date) are refunded in full. Later cancellations are refunded except for the first night. Requests that the host hasn’t accepted yet can be cancelled at no cost.'] },
      { heading: 'Hosts', body: ['Hosts should honour every confirmed booking. If a host must cancel, contact us straight away so we can help the guest rebook.'] },
    ],
  },
  'trust-safety': {
    title: 'Trust & Safety',
    intro: 'How we keep Meridian Stay safe for guests and hosts.',
    sections: [
      { heading: 'Reviewed listings', body: ['Every new listing, and every edit to a live listing, is checked by our team before guests can book it.'] },
      { heading: 'Verified reviews', body: ['Only guests who completed a stay can leave a review.'] },
      { heading: 'Your account', body: ['You sign in with Google or a one-time code sent to your phone, so there’s no password to steal. Never share a sign-in code with anyone, including people claiming to be from Meridian Stay.'] },
      { heading: 'Report a problem', body: ['Use the contact form and choose “Trust & safety”. For emergencies, contact local services first.'] },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    intro: 'What we collect, why, and your choices.',
    draft: true,
    sections: [
      { heading: 'What we collect', body: ['Account details (name, email, phone), bookings, saved stays, reviews and messages you send us. Hosts also provide listing details.'] },
      { heading: 'How we use it', body: ['To run bookings, show your trips and listings, contact you about your stays, keep the platform safe and improve it.'] },
      { heading: 'Sharing', body: ['Your host sees your name, dates and phone number for bookings at their property. We don’t sell personal data.'] },
      { heading: 'Your choices', body: ['You can update your profile at any time. To delete your account, contact us.'] },
    ],
  },
  terms: {
    title: 'Terms of service',
    intro: 'The rules for using Meridian Stay.',
    draft: true,
    sections: [
      { heading: 'Accounts', body: ['You must give accurate information and keep access to your Google account or phone number secure. You’re responsible for activity on your account.'] },
      { heading: 'Bookings', body: ['A booking is an agreement between the guest and the host. Meridian Stay provides the platform and support.'] },
      { heading: 'Listings', body: ['Hosts must have the right to rent their property and must describe it accurately. We may remove listings that break these terms.'] },
      { heading: 'Testing period', body: ['During testing, no payments are processed and bookings may be cleared.'] },
    ],
  },
}

export const defaultPages: ContentPage[] = Object.entries(pages).map(([slug, p]) => ({ slug, draft: false, ...p }))

/** What GET /api/site returns: the settings plus whether online payment (Razorpay) is switched on. */
export type PublicSite = SiteSettings & { paymentsOnline: boolean }
export const defaultPublicSite: PublicSite = { ...defaultSiteSettings, paymentsOnline: false }
