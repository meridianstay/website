import {
  CLIENT_SITE_LIMITS, DEFAULT_SITE_DOMAIN, RESERVED_SLUGS, blankClientSite, blankContent, cleanDomain,
  looksLikeDomain, siteAddress, siteSlug, starterPolicies,
  type ClientSite, type ClientSiteContent, type ClientSiteView, type ClientStay, type Me,
} from '@meridian/shared'
import { auditLogRepo, clientSitesRepo, propertiesRepo } from '../repositories'
import { AppError, notFound } from '../http/errors'
import { collect, isImageUrl, str } from '../http/validate'

// A client's own website: the client writes it, your team approves it, and visitors arriving at
// their domain are served the approved copy. Editing after that never takes the live site down —
// the change waits for its own approval while the last approved copy keeps being served.

const baseDomain = () => process.env.CLIENT_SITE_DOMAIN?.trim() || DEFAULT_SITE_DOMAIN

/** Reads what the client sent into content we are willing to store. */
function parse(body: Record<string, unknown>, existing: ClientSiteContent): ClientSiteContent {
  const fields: Record<string, string> = {}
  const businessName = str(body.businessName).slice(0, CLIENT_SITE_LIMITS.businessName)
  if (!businessName) fields.businessName = 'What is the business called?'

  // The client may set the address themselves; left blank it follows the name.
  const slug = siteSlug(str(body.slug) || businessName)
  if (!slug) fields.slug = 'This needs letters or numbers in it.'
  else if (slug.length < 3) fields.slug = 'A little longer, please — at least 3 characters.'
  else if (RESERVED_SLUGS.includes(slug)) fields.slug = 'That address is kept for Meridian itself. Choose another.'

  const logoUrl = str(body.logoUrl)
  if (logoUrl && !isImageUrl(logoUrl)) fields.logoUrl = 'Upload a logo, or use an image link starting with https://'

  const contactIn = (body.contact ?? {}) as Record<string, unknown>
  const email = str(contactIn.email).toLowerCase()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields['contact.email'] = 'That email doesn’t look right.'
  const phone = str(contactIn.phone).slice(0, 20)
  // The page exists to be contacted through, so it needs at least one way to do it.
  if (!phone && !email) fields['contact.phone'] = 'Give a phone number or an email, so guests can reach you.'

  const policiesIn = (body.policies ?? {}) as Record<string, unknown>
  const policies = {
    terms: str(policiesIn.terms).slice(0, CLIENT_SITE_LIMITS.policy),
    payment: str(policiesIn.payment).slice(0, CLIENT_SITE_LIMITS.policy),
    cancellation: str(policiesIn.cancellation).slice(0, CLIENT_SITE_LIMITS.policy),
  }

  const featured = body.featuredPropertyId
  collect(fields)

  return {
    businessName,
    slug,
    logoUrl,
    tagline: str(body.tagline).slice(0, CLIENT_SITE_LIMITS.tagline),
    about: str(body.about).slice(0, CLIENT_SITE_LIMITS.about),
    contact: {
      phone,
      email,
      address: str(contactIn.address).slice(0, CLIENT_SITE_LIMITS.address),
      whatsapp: str(contactIn.whatsapp).slice(0, 20),
    },
    policies,
    featuredPropertyId: featured === null || featured === undefined || featured === '' ? existing.featuredPropertyId : Number(featured) || null,
  }
}

/** The client's approved stays, the featured one first, as the landing page lists them. */
async function staysOf(hostId: number, featuredId: number | null): Promise<ClientStay[]> {
  const listings = await propertiesRepo.listForHost(hostId)
  const live = listings.filter((l) => l.status === 'Approved')
  const stays: ClientStay[] = live.map((l) => ({
    id: l.id, slug: l.slug, title: l.title, type: l.type,
    city: l.location.split(',')[0].trim(), region: l.location.split(',').slice(1).join(',').trim(),
    image: l.image, price: l.price, priceNow: l.priceNow, rating: l.rating, reviewCount: l.reviewCount,
    maxGuests: l.maxGuests, beds: l.beds, baths: l.baths,
  }))
  const featured = stays.findIndex((s) => s.id === featuredId)
  if (featured > 0) stays.unshift(...stays.splice(featured, 1))
  return stays
}

const viewOf = async (site: ClientSite): Promise<ClientSiteView> => {
  const content = site.published!
  return {
    ...content,
    address: siteAddress(content.slug, site.domain, baseDomain()),
    stays: await staysOf(site.hostId, content.featuredPropertyId),
  }
}

export const clientSiteService = {
  baseDomain,

  /** The client's own site, started from a blank one the first time they open the page. */
  async mine(host: Me): Promise<ClientSite> {
    const existing = await clientSitesRepo.find(host.id)
    if (existing) return existing
    const blank = blankClientSite(host.id)
    return {
      ...blank,
      content: {
        ...blankContent(),
        businessName: host.name,
        slug: siteSlug(host.name),
        contact: { phone: host.phone ?? '', email: host.email ?? '', address: '', whatsapp: '' },
        // Sensible wording from the start, so the page is never blank while they write their own.
        policies: starterPolicies(host.name),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  },

  /** Saves what the client has written. The live copy, if there is one, keeps being served. */
  async save(host: Me, body: Record<string, unknown>) {
    const current = await this.mine(host)
    const content = parse(body, current.content)
    const taken = await clientSitesRepo.taken(host.id, content.slug, current.domain.name)
    if (taken.slug) collect({ slug: 'Another client already has that address. Choose another.' })
    // A change after approval waits its turn; the approved copy is what visitors keep seeing.
    const status = current.status === 'Approved' ? 'Pending' : current.status
    return clientSitesRepo.save(host.id, { ...current, content, status, rejectionReason: '' })
  },

  /** Sends it to your team to look at. */
  async submit(host: Me) {
    const site = await clientSitesRepo.find(host.id)
    if (!site) throw new AppError(400, 'Write your website first.')
    if (!site.content.businessName) throw new AppError(400, 'Give the business a name before sending it in.')
    const next = await clientSitesRepo.save(host.id, { status: 'Pending', rejectionReason: '' })
    await auditLogRepo.record(null, 'clientSite.submit', 'clientSite', host.id, { businessName: site.content.businessName })
    return next
  },

  /** The client asks for their own domain. Your team adds it to the hosting and marks it live. */
  async setDomain(host: Me, input: string) {
    const site = await this.mine(host)
    const name = cleanDomain(input)
    if (name && !looksLikeDomain(name)) collect({ domain: 'That doesn’t look like a domain. Try something like greenvalleystays.com' })
    if (name) {
      const taken = await clientSitesRepo.taken(host.id, site.content.slug, name)
      if (taken.domain) collect({ domain: 'Another client is already using that domain.' })
    }
    const domain: ClientSite['domain'] = name
      ? { name, status: 'pending', note: '', checkedAt: null }
      : { name: '', status: 'none', note: '', checkedAt: null }
    const next = await clientSitesRepo.save(host.id, { ...site, domain })
    await auditLogRepo.record(null, 'clientSite.domain', 'clientSite', host.id, { domain: name || '(removed)' })
    return next
  },

  // ─── Your team ─────────────────────────────────────────────────────────────

  list: () => clientSitesRepo.list(),

  async get(hostId: number) {
    const site = await clientSitesRepo.find(hostId)
    if (!site) throw notFound('client site')
    return site
  },

  /** Approves what the client wrote: this copy is what visitors are served from now on. */
  async approve(admin: Me, hostId: number) {
    const site = await this.get(hostId)
    if (!site.content.businessName) throw new AppError(400, 'There is nothing to approve yet.')
    const next = await clientSitesRepo.save(hostId, {
      ...site,
      published: { ...site.content },
      status: 'Approved',
      rejectionReason: '',
    })
    await auditLogRepo.record(admin, 'clientSite.approve', 'clientSite', hostId, { businessName: site.content.businessName })
    return next
  },

  /** Sends it back with a reason. Anything already approved keeps being served. */
  async reject(admin: Me, hostId: number, reason: string) {
    const site = await this.get(hostId)
    if (!str(reason)) throw new AppError(400, 'Say what needs changing, so the client can fix it.')
    const next = await clientSitesRepo.save(hostId, { ...site, status: 'Rejected', rejectionReason: str(reason).slice(0, 500) })
    await auditLogRepo.record(admin, 'clientSite.reject', 'clientSite', hostId, { reason })
    return next
  },

  /** Takes a site off the air: the domain stops resolving to anything of the client's. */
  async unpublish(admin: Me, hostId: number) {
    const site = await this.get(hostId)
    const next = await clientSitesRepo.save(hostId, { ...site, published: null, status: 'Draft' })
    await auditLogRepo.record(admin, 'clientSite.unpublish', 'clientSite', hostId, {})
    return next
  },

  /** Your team marks the custom domain live once it has been added to the hosting and DNS answers. */
  async setDomainStatus(admin: Me, hostId: number, status: string, note: string) {
    const site = await this.get(hostId)
    if (!['none', 'pending', 'live', 'failed'].includes(status)) throw new AppError(400, 'Unknown domain status.')
    if (status === 'live' && !site.domain.name) throw new AppError(400, 'There is no domain to make live.')
    const next = await clientSitesRepo.save(hostId, {
      ...site,
      domain: { ...site.domain, status: status as ClientSite['domain']['status'], note: str(note).slice(0, 300), checkedAt: new Date().toISOString() },
    })
    await auditLogRepo.record(admin, 'clientSite.domainStatus', 'clientSite', hostId, { status, domain: site.domain.name })
    return next
  },

  // ─── The public site ───────────────────────────────────────────────────────

  /** The site answering on this address, or nothing — in which case the marketplace is served. */
  async forAddress(hostname: string): Promise<ClientSiteView | null> {
    const site = await clientSitesRepo.byAddress(hostname, baseDomain())
    return site ? viewOf(site) : null
  },

  /** The same page by its address name, so a client can see it before DNS is set up. */
  async forSlug(slug: string): Promise<ClientSiteView | null> {
    const site = await clientSitesRepo.bySlug(slug)
    return site ? viewOf(site) : null
  },

  /**
   * The business behind a listing, for the marketplace. Only ever the approved copy, so nothing a
   * client is still writing appears anywhere.
   */
  async brandOf(hostId: number) {
    const site = await clientSitesRepo.find(hostId)
    if (!site?.published) return null
    const { businessName, slug, logoUrl } = site.published
    return { businessName, logoUrl, url: `https://${siteAddress(slug, site.domain, baseDomain())}` }
  },
}
