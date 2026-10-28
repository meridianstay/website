import type { ClientSite } from '@meridian/shared'
import { C, all, col, nowISO } from '../store/db'
import { cached, clear } from '../store/cache'

// Collection: clientSites/{hostId} — one client's own website. Looked up by host, by subdomain slug
// and by custom domain; every page load of a client site starts with one of those lookups, so they
// are cached like the rest of the site's settings.

export const clientSitesRepo = {
  async find(hostId: number): Promise<ClientSite | null> {
    const snap = await col(C.clientSites).doc(String(hostId)).get()
    return snap.exists ? (snap.data() as ClientSite) : null
  },

  /** Every site, newest first. The control centre's approval queue. */
  async list(): Promise<ClientSite[]> {
    const rows = await all<ClientSite>(col(C.clientSites))
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  /**
   * The approved site answering on this address, by custom domain first and then by subdomain.
   * Cached: this runs before anything else on every visit to a client's site.
   */
  async byAddress(hostname: string, baseDomain: string): Promise<ClientSite | null> {
    return cached('clientSites', `host:${hostname}`, async () => {
      const name = hostname.toLowerCase().replace(/^www\./, '').split(':')[0]
      const live = (await this.list()).filter((s) => !!s.published)
      const byDomain = live.find((s) => s.domain.status === 'live' && s.domain.name && s.domain.name === name)
      if (byDomain) return byDomain
      const suffix = `.${baseDomain.toLowerCase()}`
      if (!name.endsWith(suffix)) return null
      const slug = name.slice(0, -suffix.length)
      return live.find((s) => s.published!.slug === slug) ?? null
    })
  },

  /** The approved site with this subdomain slug, for previewing at /c/<slug> before DNS is set up. */
  async bySlug(slug: string): Promise<ClientSite | null> {
    return cached('clientSites', `slug:${slug}`, async () =>
      (await this.list()).find((s) => s.published?.slug === slug.toLowerCase()) ?? null)
  },

  /** Whether anyone else already has this slug or domain. */
  async taken(hostId: number, slug: string, domain: string) {
    const others = (await this.list()).filter((s) => s.hostId !== hostId)
    return {
      // A slug is spoken for whether the other client's site is live yet or not.
      slug: others.some((s) => s.content.slug === slug || s.published?.slug === slug),
      domain: !!domain && others.some((s) => s.domain.name === domain),
    }
  },

  async save(hostId: number, patch: Partial<ClientSite>): Promise<ClientSite> {
    const ref = col(C.clientSites).doc(String(hostId))
    const existing = (await ref.get()).data() as ClientSite | undefined
    const now = nowISO()
    const next = { ...existing, ...patch, hostId, createdAt: existing?.createdAt ?? now, updatedAt: now } as ClientSite
    await ref.set(next)
    await clear('clientSites')
    return next
  },

  async remove(hostId: number) {
    await col(C.clientSites).doc(String(hostId)).delete()
    await clear('clientSites')
  },
}
