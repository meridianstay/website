import dns from 'node:dns/promises'
import {
  CLIENT_SECTIONS, CLIENT_SITE_LIMITS, DEFAULT_APEX_IP, DEFAULT_DNS_CNAME, DEFAULT_SITE_DOMAIN, RESERVED_SLUGS, blankClientSite, blankContent,
  cleanDomain, defaultPageDesign, dnsRecords, looksLikeDomain, newSection, siteAddress, siteSlug, starterPolicies, withPageDefaults,
  type ClientPageDesign, type ClientSection, type ClientSectionType, type ClientSite, type ClientSiteContent,
  type ClientSiteView, type ClientStay, type DnsTarget, type DomainCheck, type Me,
} from '@meridian/shared'
import { auditLogRepo, clientSitesRepo, propertiesRepo } from '../repositories'
import { subscriptionService } from './subscriptions'
import { AppError, notFound } from '../http/errors'
import { collect, isImageUrl, str } from '../http/validate'

// A client's own website: the client writes it, your team approves it, and visitors arriving at
// their domain are served the approved copy. Editing after that never takes the live site down —
// the change waits for its own approval while the last approved copy keeps being served.

const baseDomain = () => process.env.CLIENT_SITE_DOMAIN?.trim() || DEFAULT_SITE_DOMAIN

/**
 * What a client's DNS has to point at. Vercel gives each project its own CNAME value, shown in
 * Settings → Domains, so it is set here rather than guessed — the old shared `cname.vercel-dns.com`
 * is the fallback for an installation that hasn't set it.
 */
const dnsTarget = (): DnsTarget => ({
  apexIp: process.env.CLIENT_DNS_APEX_IP?.trim() || DEFAULT_APEX_IP,
  cname: process.env.CLIENT_DNS_CNAME?.trim() || DEFAULT_DNS_CNAME,
})

const SECTION_TYPES = new Set(CLIENT_SECTIONS.map((s) => s.value))
const MAX_SECTIONS = 30

/**
 * Reads an arranged page back. Anything we don't recognise is dropped rather than stored, so a page
 * is always something the renderer can actually draw.
 */
function parseDesign(raw: unknown, existing: ClientPageDesign): ClientPageDesign {
  if (!raw || typeof raw !== 'object') return existing
  const body = raw as Record<string, unknown>
  const sections = Array.isArray(body.sections) ? body.sections : null
  if (!sections) return withPageDefaults({ ...existing, ...body } as ClientPageDesign)

  const seen = new Set<string>()
  const cleaned: ClientSection[] = []
  for (const item of sections.slice(0, MAX_SECTIONS)) {
    const s = (item ?? {}) as Record<string, unknown>
    const type = str(s.type) as ClientSectionType
    if (!SECTION_TYPES.has(type)) continue
    const kind = CLIENT_SECTIONS.find((k) => k.value === type)!
    // Only the two free-form kinds may appear more than once.
    if (!kind.repeatable && seen.has(type)) continue
    seen.add(type)
    const id = str(s.id).slice(0, 40) || newSection(type).id
    cleaned.push({
      ...newSection(type, id),
      enabled: s.enabled !== false,
      title: str(s.title).slice(0, 120),
      subtitle: str(s.subtitle).slice(0, 200),
      body: str(s.body).slice(0, 2000),
      image: isImageUrl(str(s.image)) ? str(s.image) : '',
      buttonLabel: str(s.buttonLabel).slice(0, 40),
      buttonUrl: str(s.buttonUrl).slice(0, 300),
    })
  }
  if (!cleaned.length) return existing
  return withPageDefaults({
    layout: body.layout === 'stacked' ? 'stacked' : 'sidebar',
    accent: /^#[0-9a-f]{6}$/i.test(str(body.accent)) ? str(body.accent) : '',
    heroStyle: body.heroStyle === 'plain' ? 'plain' : 'photo',
    sections: cleaned,
  })
}

/** Reads what the client sent into content we are willing to store. */
function parse(body: Record<string, unknown>, existing: ClientSiteContent): ClientSiteContent {
  const fields: Record<string, string> = {}
  const businessName = str(body.businessName).slice(0, CLIENT_SITE_LIMITS.businessName)
  if (!businessName) fields.businessName = 'What is the business called?'

  // The client may set the address themselves; left blank it follows the name.
  const slug = siteSlug(str(body.slug) || businessName)
  if (!slug) fields.slug = 'This needs letters or numbers in it.'
  else if (slug.length < 3) fields.slug = 'A little longer, please — at least 3 characters.'
  else if (RESERVED_SLUGS.includes(slug)) fields.slug = 'That address is kept for Book My Get Away itself. Choose another.'

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
    // The arrangement is only changed through its own call, which checks the plan first.
    design: withPageDefaults(existing.design),
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
  const allowed = await subscriptionService.entitlementsOf(site.hostId)
  const stays = await staysOf(site.hostId, content.featuredPropertyId)
  return {
    ...content,
    address: siteAddress(content.slug, site.domain, baseDomain()),
    // On the single-stay plan the website shows one stay; the others need the plan that covers them.
    stays: allowed.maxStaysOnSite > 0 ? stays.slice(0, allowed.maxStaysOnSite) : stays,
    // A client who has stopped paying for the editor keeps their site, in the standard arrangement.
    design: allowed.pageEditor ? withPageDefaults(content.design) : defaultPageDesign(),
  }
}

/**
 * Looks up what a domain actually publishes, and whether it reaches us. Vercel issues a free
 * certificate for a client's own domain on its own once DNS points here (Let's Encrypt over the
 * HTTP-01 challenge), so reaching us over HTTPS is the whole proof: DNS, routing and certificate.
 */
async function checkDomain(domain: string, target: DnsTarget): Promise<DomainCheck> {
  const wanted = dnsRecords(domain, target)
  const apex = domain.split('.').length <= 2

  const records = await Promise.all(wanted.map(async (want) => {
    // The apex is looked up as itself; a named record as that name in front of the domain.
    const host = want.name === '@' ? domain : apex ? `${want.name}.${domain}` : domain
    let found: string[] = []
    try {
      found = want.type === 'A' ? await dns.resolve4(host) : await dns.resolveCname(host)
    } catch {
      // No such record published yet, which is the ordinary answer while they are setting it up.
      found = []
    }
    const expected = want.value.replace(/\.$/, '')
    return { type: want.type, name: want.name, expected, found, ok: found.some((v) => v.replace(/\.$/, '') === expected) }
  }))

  // The www CNAME is a convenience, not a requirement: an apex that resolves is enough.
  const required = apex ? records.filter((r) => r.type === 'A') : records
  const dnsOk = required.every((r) => r.ok)

  let reachable = false
  let detail = ''
  try {
    const res = await fetch(`https://${domain}/api/health`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    })
    const body = (await res.json().catch(() => null)) as { ok?: boolean } | null
    reachable = res.ok && body?.ok === true
    if (!reachable) detail = `The domain answered ${res.status}, but not as this platform. Check it is added to the hosting.`
  } catch (err) {
    detail = dnsOk
      ? 'The records are right, but the domain does not reach us yet. It usually needs adding to the hosting, and a certificate takes a few minutes after that.'
      : 'The records are not published yet. They can take anything from a few minutes to a day to spread.'
    // The message from fetch itself is rarely useful to a client, so it is left out.
    void err
  }

  return { domain, records, dnsOk, reachable, detail: reachable ? '' : detail, checkedAt: new Date().toISOString() }
}

export const clientSiteService = {
  baseDomain,
  dnsTarget,

  /**
   * Checks a client's domain and, when it plainly works, switches it on without waiting for anyone:
   * a domain that serves this platform over HTTPS has already been added to the hosting and has its
   * certificate, so there is nothing left for a person to decide.
   */
  async checkDomain(hostId: number): Promise<{ check: DomainCheck; site: ClientSite }> {
    const site = await this.get(hostId)
    if (!site.domain.name) throw new AppError(400, 'There is no domain to check yet.')
    const check = await checkDomain(site.domain.name, dnsTarget())

    const status: ClientSite['domain']['status'] = check.reachable ? 'live' : site.domain.status === 'live' ? 'live' : 'pending'
    const next = await clientSitesRepo.save(hostId, {
      ...site,
      domain: { ...site.domain, status, note: check.reachable ? '' : check.detail, checkedAt: check.checkedAt },
    })
    return { check, site: next }
  },

  /**
   * The client's stays, for the picker. On the single-stay plan this is the choice that decides
   * which one the website — and their own domain — is for.
   */
  async staysForPicker(hostId: number) {
    const listings = await propertiesRepo.listForHost(hostId)
    return listings
      .filter((l) => l.status === 'Approved' || l.status === 'Pending')
      .map((l) => ({ id: l.id, title: l.title, location: l.location, status: l.status }))
  },

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
    await subscriptionService.require(host.id, 'ownWebsite')
    const current = await this.mine(host)
    const content = parse(body, current.content)
    if (content.featuredPropertyId && !(await propertiesRepo.ownedBy(content.featuredPropertyId, host.id))) {
      collect({ featuredPropertyId: 'Choose one of your own stays.' })
    }
    const taken = await clientSitesRepo.taken(host.id, content.slug, current.domain.name)
    if (taken.slug) collect({ slug: 'Another client already has that address. Choose another.' })
    // A change after approval waits its turn; the approved copy is what visitors keep seeing.
    const status = current.status === 'Approved' ? 'Pending' : current.status
    return clientSitesRepo.save(host.id, { ...current, content, status, rejectionReason: '' })
  },

  /**
   * Saves how the client has arranged their page. Part of the plan that includes the editor, so the
   * check happens before anything is written.
   */
  async saveDesign(host: Me, body: Record<string, unknown>) {
    await subscriptionService.require(host.id, 'pageEditor')
    const current = await this.mine(host)
    const design = parseDesign(body.design ?? body, withPageDefaults(current.content.design))
    const status = current.status === 'Approved' ? 'Pending' : current.status
    return clientSitesRepo.save(host.id, { ...current, content: { ...current.content, design }, status, rejectionReason: '' })
  },

  /** Puts the page back the way it came, for a client who has rearranged themselves into a corner. */
  async resetDesign(host: Me) {
    await subscriptionService.require(host.id, 'pageEditor')
    const current = await this.mine(host)
    return clientSitesRepo.save(host.id, { ...current, content: { ...current.content, design: defaultPageDesign() } })
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
    // Removing a domain is always allowed; adding one is what the first paid plan buys.
    if (name) await subscriptionService.require(host.id, 'customDomain')
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
    return site && (await subscriptionService.entitlementsOf(site.hostId)).ownWebsite ? viewOf(site) : null
  },

  /** The same page by its address name, so a client can see it before DNS is set up. */
  async forSlug(slug: string): Promise<ClientSiteView | null> {
    const site = await clientSitesRepo.bySlug(slug)
    return site && (await subscriptionService.entitlementsOf(site.hostId)).ownWebsite ? viewOf(site) : null
  },

  /**
   * Fills in each stay's client website, where there is one. Done in one pass over the cached list
   * rather than a lookup per stay, so a page of search results costs nothing extra.
   */
  async withBrands<T extends { hostId: number; site: unknown }>(stays: T[]): Promise<T[]> {
    if (!stays.length) return stays
    const sites = (await clientSitesRepo.list()).filter((s) => !!s.published)
    if (!sites.length) return stays
    const allowed = await Promise.all(sites.map(async (s) => ((await subscriptionService.entitlementsOf(s.hostId)).ownWebsite ? s : null)))
    const byHost = new Map(allowed.filter(Boolean).map((s) => [s!.hostId, s!]))
    return stays.map((stay) => {
      const site = byHost.get(stay.hostId)
      return site
        ? { ...stay, site: { businessName: site.published!.businessName, url: `https://${siteAddress(site.published!.slug, site.domain, baseDomain())}` } }
        : stay
    })
  },

  /**
   * The business behind a listing, for the marketplace. Only ever the approved copy, so nothing a
   * client is still writing appears anywhere.
   */
  async brandOf(hostId: number) {
    const site = await clientSitesRepo.find(hostId)
    if (!site?.published || !(await subscriptionService.entitlementsOf(hostId)).ownWebsite) return null
    const { businessName, slug, logoUrl } = site.published
    return { businessName, logoUrl, url: `https://${siteAddress(slug, site.domain, baseDomain())}` }
  },
}
