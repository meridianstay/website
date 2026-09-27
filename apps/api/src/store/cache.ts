import type { CacheReport, CacheSettings } from '@meridian/shared'
import { C, col, increment, nowISO } from './db'
import { projectId } from './firebase'

// A handful of reads happen on *every* page load and change a few times a week: the site settings,
// the translated wording, the homepage layout, the amenity list, the running offers. Site settings
// alone was read three times over while answering a single booking request, each time fetching the
// whole siteSettings collection. Holding those answers in memory for a minute turns all of it into
// no Firestore reads at all.
//
// Nothing that belongs to one person is ever cached: a booking, a guest, a host's earnings and a
// property are always read fresh.

export type CacheGroup = 'settings' | 'translations' | 'content' | 'amenities' | 'campaigns' | 'stats'

export const CACHE_GROUPS: { name: CacheGroup; label: string; explain: string }[] = [
  { name: 'settings', label: 'Site settings', explain: 'Everything on the Settings pages: commission, theme, logos, notification wording. Read on every request.' },
  { name: 'translations', label: 'Translated wording', explain: 'One entry per language, holding every translated phrase.' },
  { name: 'content', label: 'Website content', explain: 'The homepage layout, the About page and the published pages.' },
  { name: 'amenities', label: 'Amenity list', explain: 'The list every listing and search filter is built from.' },
  { name: 'campaigns', label: 'Offers & alerts', explain: 'Running campaigns, so deciding whether to show a popup costs nothing.' },
  { name: 'stats', label: 'About-page figures', explain: 'How many stays, hosts and guest nights — counted across every listing and booking.' },
]

interface Entry {
  at: number
  epoch: number
  value: Promise<unknown>
  kb: number
}

const entries = new Map<CacheGroup, Map<string, Entry>>()
const tally = new Map<CacheGroup, { hits: number; misses: number }>()

// Tests wipe Firestore behind the repositories' back, so a cache would hand them yesterday's
// answers. The cache's own tests switch it on deliberately, through resetForTests.
let allowed = !projectId.endsWith('-test')
let config: CacheSettings = { enabled: allowed, ttlSeconds: 60 }

/**
 * Applied from the stored settings each time they are loaded, so a change in the control centre
 * takes effect on the next request without a redeploy.
 */
export function configure(settings: CacheSettings | undefined) {
  if (!settings) return
  const enabled = settings.enabled && allowed
  if (config.enabled && !enabled) forget()
  config = { enabled, ttlSeconds: Math.min(Math.max(settings.ttlSeconds, 1), 3600) }
}

// ─── Keeping instances in step ───────────────────────────────────────────────
// The API runs as more than one instance, each with its own memory, so clearing one would leave the
// others serving what they already hold. Every clear bumps a counter in the database; each instance
// re-reads that counter at most every few seconds and drops everything when it has moved. An admin
// edit is therefore immediate on the instance that saved it, and a few seconds behind on the rest.

const EPOCH_RECHECK_MS = 5000
let epoch = 0
let epochAt = 0
let clearedAt: string | null = null

const stateDoc = () => col(C.serverState).doc('cache')

async function currentEpoch(): Promise<number> {
  if (epochAt && Date.now() - epochAt < EPOCH_RECHECK_MS) return epoch
  try {
    const data = (await stateDoc().get()).data()
    const next = Number(data?.epoch ?? 0)
    clearedAt = (data?.clearedAt as string | undefined) ?? null
    if (next !== epoch) {
      forget()
      epoch = next
    }
  } catch {
    // Keep what we have. A cache that is briefly stale is better than a page that fails.
  }
  epochAt = Date.now()
  return epoch
}

/** Empties this instance's memory. Other instances keep theirs until the epoch tells them not to. */
export function forget(group?: CacheGroup) {
  if (group) entries.get(group)?.clear()
  else entries.clear()
}

/**
 * Empties every instance: clears here, and bumps the counter the others watch. Called by hand from
 * the Server page, and on every write to something that is cached.
 */
export async function clear(group?: CacheGroup) {
  forget(group)
  epochAt = 0
  await stateDoc().set({ epoch: increment(1), clearedAt: nowISO() }, { merge: true }).catch(() => {})
}

/**
 * The cached answer, or `load()` and keep it. Two requests arriving together share one load rather
 * than both asking Firestore.
 */
export async function cached<T>(group: CacheGroup, key: string, load: () => Promise<T>): Promise<T> {
  if (!config.enabled) return load()
  const now = Date.now()
  const at = await currentEpoch()
  const bucket = entries.get(group) ?? new Map<string, Entry>()
  entries.set(group, bucket)
  const counts = tally.get(group) ?? { hits: 0, misses: 0 }
  tally.set(group, counts)

  const hit = bucket.get(key)
  if (hit && hit.epoch === at && now - hit.at < config.ttlSeconds * 1000) {
    counts.hits++
    return hit.value as Promise<T>
  }

  counts.misses++
  const value = load()
  const entry: Entry = { at: now, epoch: at, value, kb: 0 }
  bucket.set(key, entry)
  // A load that fails is not worth keeping: the next request should try again.
  value.then(
    (resolved) => { entry.kb = Math.round(JSON.stringify(resolved ?? null).length / 1024) },
    () => { if (bucket.get(key) === entry) bucket.delete(key) },
  )
  return value
}

export function report(): CacheReport {
  const now = Date.now()
  const groups = CACHE_GROUPS.map((g) => {
    const bucket = entries.get(g.name)
    const counts = tally.get(g.name) ?? { hits: 0, misses: 0 }
    const ages = [...(bucket?.values() ?? [])].map((e) => e.at)
    return {
      ...g,
      entries: bucket?.size ?? 0,
      hits: counts.hits,
      misses: counts.misses,
      kb: [...(bucket?.values() ?? [])].reduce((s, e) => s + e.kb, 0),
      oldestSeconds: ages.length ? Math.round((now - Math.min(...ages)) / 1000) : null,
    }
  })
  return {
    enabled: config.enabled,
    ttlSeconds: config.ttlSeconds,
    groups,
    hits: groups.reduce((s, g) => s + g.hits, 0),
    misses: groups.reduce((s, g) => s + g.misses, 0),
    epoch,
    clearedAt,
  }
}

/** Only for the cache's own tests, which must start from a known state. */
export function resetForTests(settings: CacheSettings) {
  allowed = settings.enabled
  forget()
  tally.clear()
  epoch = 0
  epochAt = 0
  config = { enabled: settings.enabled, ttlSeconds: settings.ttlSeconds }
}
