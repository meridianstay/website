import {
  APP_VERSIONS, PLATFORM_VERSION, defaultServerSettings,
  type CollectionSize, type CronJobReport, type EnvVarCheck, type Me, type ServerReport, type ServerSettings, type StorageUsage,
} from '@meridian/shared'
import { C, col } from '../store/db'
import { bucket, emulated, projectId } from '../store/firebase'
import { CACHE_GROUPS, clear, report as cacheReport, type CacheGroup } from '../store/cache'
import { auditLogRepo, contentRepo, notificationsRepo, serverStateRepo } from '../repositories'
import { AppError } from '../http/errors'
import { collect } from '../http/validate'

// What the Server page in the control centre is built from: where this instance is running, what it
// has been given to work with, what it is holding in memory, and how big things have grown.
//
// Nothing here returns a secret. An environment variable is reported as set or not set — never by
// value — so the page is safe to look at over someone's shoulder.

const MB = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10

/**
 * Every environment variable the platform reads, why it is there, and whether the hosting has it.
 * Keep this beside the code that reads them: a variable missing from here is one nobody discovers
 * is missing until something quietly stops working.
 */
function environment(): EnvVarCheck[] {
  const vars: Omit<EnvVarCheck, 'set'>[] = [
    {
      name: 'FIREBASE_SERVICE_ACCOUNT', required: true,
      purpose: 'The key that lets the API read and write the database, sign people in and store photos.',
      fix: 'Firebase console → Project settings → Service accounts → Generate new private key, then paste the whole file into Vercel.',
    },
    {
      name: 'SETTINGS_ENCRYPTION_KEY', required: true,
      purpose: 'Encrypts the secrets kept in the database: Razorpay keys, mail and SMS passwords, host bank details, push keys.',
      fix: 'Add any long random text in Vercel and redeploy. Changing it later makes everything already encrypted unreadable.',
    },
    {
      name: 'CRON_SECRET', required: true,
      purpose: 'Proves a scheduled call really came from the hosting. Without it the daily jobs refuse to run at all.',
      fix: 'Add any long random text in Vercel. Vercel Cron then sends it automatically.',
    },
    {
      name: 'PUBLIC_SITE_URL', required: false,
      purpose: 'The address used in emails, texts and the sitemap. Guessed from the request when unset, which is wrong behind a proxy.',
      fix: 'Set it to the live address, e.g. https://meridianstay.com',
    },
    {
      name: 'FIREBASE_STORAGE_BUCKET', required: false,
      purpose: 'Where photos are stored. Only needed when the bucket is not the project default.',
      fix: `Leave unset unless the bucket is named something other than ${projectId}.firebasestorage.app`,
    },
    {
      name: 'COOKIE_DOMAIN', required: false,
      purpose: 'Lets one sign-in work across the website, account, host and admin panels on the same domain.',
      fix: 'Set it to the shared domain, e.g. .meridianstay.com',
    },
    {
      name: 'SEED_DEMO_DATA', required: false,
      purpose: 'Turns on the "Reset demo data" button, for client previews.',
      fix: 'Set to true only on a preview deployment. Never on the live site.',
    },
  ]
  return vars.map((v) => ({ ...v, set: !!process.env[v.name]?.trim() }))
}

/**
 * The jobs the hosting is meant to call. The schedules must match the `crons` block in vercel.json —
 * a test checks that they do, because a schedule that drifts is invisible until a message is missed.
 */
const JOBS: Omit<CronJobReport, 'lastRun'>[] = [
  {
    name: 'daily', label: 'Daily messages and campaigns', path: '/api/cron/daily', schedule: '30 2 * * *',
    explain: 'Check-in reminders, review invitations, and starting or finishing scheduled offers. Without this they are never sent.',
  },
  {
    name: 'expire', label: 'Expire lapsed bookings', path: '/api/cron/expire', schedule: '0 3 * * *',
    explain: 'Releases dates held by an unpaid checkout or an unanswered request. Also runs opportunistically as people browse.',
  },
]

const LABELS: Record<string, string> = {
  [C.users]: 'Guests, hosts and admins',
  [C.properties]: 'Listings',
  [C.bookings]: 'Bookings',
  [C.reviews]: 'Reviews',
  [C.blocks]: 'Blocked dates',
  [C.wishlists]: 'Saved stays',
  [C.amenities]: 'Amenities',
  [C.settings]: 'Settings and website content',
  [C.pages]: 'Website pages',
  [C.messages]: 'Contact messages',
  [C.audit]: 'Activity log',
  [C.coupons]: 'Coupons',
  [C.promotions]: 'Host promotions',
  [C.counters]: 'Id counters',
  [C.notifications]: 'Sent messages',
  [C.payouts]: 'Host payouts',
  [C.campaigns]: 'Offers and alerts',
  [C.pushSubscriptions]: 'Push subscriptions',
  [C.secrets]: 'Encrypted secrets',
  [C.serverState]: 'Server state',
}

/** The two logs that only ever grow, and so are the only ones Housekeeping offers to trim. */
const TRIMMABLE = [C.audit, C.notifications]

async function collections(): Promise<CollectionSize[]> {
  return Promise.all(Object.values(C).map(async (name) => ({
    name,
    label: LABELS[name] ?? name,
    // A count costs one read however many documents there are.
    docs: await col(name).count().get().then((s) => s.data().count).catch(() => 0),
    trimmable: TRIMMABLE.includes(name as (typeof TRIMMABLE)[number]),
  })))
}

const cutoff = (days: number) => new Date(Date.now() - days * 86400_000).toISOString()

function parse(body: Record<string, unknown>): ServerSettings {
  const cache = { ...defaultServerSettings.cache, ...((body.cache ?? {}) as Partial<ServerSettings['cache']>) }
  const retention = { ...defaultServerSettings.retention, ...((body.retention ?? {}) as Partial<ServerSettings['retention']>) }
  const fields: Record<string, string> = {}
  const ttl = Number(cache.ttlSeconds)
  if (!(ttl >= 5 && ttl <= 3600)) fields['cache.ttlSeconds'] = 'Between 5 seconds and an hour.'
  for (const [key, value] of Object.entries(retention)) {
    const days = Number(value)
    if (!(days === 0 || (days >= 7 && days <= 3650))) fields[`retention.${key}`] = 'Either 0 to keep everything, or between 7 and 3,650 days.'
  }
  collect(fields)
  return {
    cache: { enabled: cache.enabled === true, ttlSeconds: ttl },
    retention: { auditDays: Number(retention.auditDays), notificationDays: Number(retention.notificationDays) },
  }
}

export const serverService = {
  async report(): Promise<ServerReport> {
    const memory = process.memoryUsage()
    const [settings, sizes, runs, storage] = await Promise.all([
      contentRepo.settings(),
      collections(),
      serverStateRepo.jobRuns(),
      serverStateRepo.storage(),
    ])
    return {
      runtime: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        uptimeSeconds: Math.round(process.uptime()),
        memoryMb: { rss: MB(memory.rss), heapUsed: MB(memory.heapUsed), heapTotal: MB(memory.heapTotal) },
        serverTime: new Date().toISOString(),
        timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      },
      hosting: {
        platform: process.env.VERCEL ? 'vercel' : 'local',
        environment: process.env.VERCEL_ENV ?? (emulated ? 'development (emulator)' : 'development'),
        region: process.env.VERCEL_REGION ?? '',
        url: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
        commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7),
        branch: process.env.VERCEL_GIT_COMMIT_REF ?? '',
      },
      versions: { platform: PLATFORM_VERSION, apps: { ...APP_VERSIONS } },
      env: environment(),
      cache: cacheReport(),
      collections: sizes,
      totalDocs: sizes.reduce((s, c) => s + c.docs, 0),
      jobs: JOBS.map((j) => ({ ...j, lastRun: runs[j.name] ?? null })),
      settings: settings.server ?? defaultServerSettings,
      storage,
    }
  },

  async clearCache(admin: Me, group?: string) {
    const name = CACHE_GROUPS.find((g) => g.name === group)?.name
    if (group && !name) throw new AppError(400, 'No such cache.')
    await clear(name as CacheGroup | undefined)
    await auditLogRepo.record(admin, 'server.cache.clear', 'server', name ?? 'all', {})
    return cacheReport()
  },

  async saveSettings(admin: Me, body: Record<string, unknown>) {
    const next = parse(body)
    await contentRepo.saveSetting('server', next, admin.id)
    await auditLogRepo.record(admin, 'server.settings', 'server', 'server', { ...next.cache, ...next.retention })
    return next
  },

  /**
   * Counts every photo in storage. It is a listing of the whole bucket, so it only happens when
   * someone asks for it, and the answer is remembered until they ask again.
   */
  async measureStorage(admin: Me): Promise<StorageUsage> {
    if (emulated) throw new AppError(400, 'The storage emulator can’t be measured. This works on the live project.')
    let files = 0
    let bytes = 0
    let token: string | undefined
    do {
      const [batch, next] = (await bucket.getFiles({ maxResults: 1000, pageToken: token })) as unknown as [
        { metadata: { size?: string | number } }[], { pageToken?: string } | undefined,
      ]
      files += batch.length
      for (const f of batch) bytes += Number(f.metadata?.size ?? 0)
      token = next?.pageToken
      // A bucket with a million files is not worth blocking a page load for.
    } while (token && files < 50_000)
    const usage: StorageUsage = { files, mb: MB(bytes), measuredAt: new Date().toISOString() }
    await serverStateRepo.saveStorage(usage)
    await auditLogRepo.record(admin, 'server.storage.measure', 'server', 'storage', { ...usage })
    return usage
  },

  /**
   * Clears out the two logs that only ever grow, by the retention set in Settings. Everything else
   * in the database is business records and is never deleted by age.
   */
  async housekeeping(admin: Me, what: string) {
    const { retention } = (await contentRepo.settings()).server ?? defaultServerSettings
    const jobs: Record<string, () => Promise<number>> = {
      audit: () => (retention.auditDays ? auditLogRepo.deleteBefore(cutoff(retention.auditDays)) : Promise.resolve(0)),
      notifications: () => (retention.notificationDays ? notificationsRepo.deleteBefore(cutoff(retention.notificationDays)) : Promise.resolve(0)),
    }
    const run = what === 'all' ? Object.keys(jobs) : [what]
    if (run.some((k) => !jobs[k])) throw new AppError(400, 'Nothing here goes by that name.')
    const deleted: Record<string, number> = {}
    for (const key of run) deleted[key] = await jobs[key]()
    await auditLogRepo.record(admin, 'server.housekeeping', 'server', what, deleted)
    return { deleted, retention }
  },

  /** What Housekeeping would delete right now, so the page can say so before anything is pressed. */
  async pending() {
    const { retention } = (await contentRepo.settings()).server ?? defaultServerSettings
    const [audit, notifications] = await Promise.all([
      retention.auditDays ? auditLogRepo.countBefore(cutoff(retention.auditDays)) : Promise.resolve(0),
      retention.notificationDays ? notificationsRepo.countBefore(cutoff(retention.notificationDays)) : Promise.resolve(0),
    ])
    return { audit, notifications }
  },
}
