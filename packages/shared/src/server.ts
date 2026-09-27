// What the control centre shows on its Server page: where the API is running, what it is configured
// with, what it is holding in memory, and how big the database has grown. None of it is a secret —
// an environment variable is reported as set or not set, never by value.

/** Server behaviour the control centre can change without a redeploy. */
export interface ServerSettings {
  cache: CacheSettings
  retention: RetentionSettings
}

export interface CacheSettings {
  /** Off means every request reads Firestore directly: slower, but always the newest word. */
  enabled: boolean
  /** How long a cached answer may be reused. Seconds. */
  ttlSeconds: number
}

/** How long the two logs that grow forever are kept. Nothing else is ever deleted by age. */
export interface RetentionSettings {
  /** Activity-log entries older than this may be cleared. 0 keeps everything. */
  auditDays: number
  /** Sent-message records older than this may be cleared. 0 keeps everything. */
  notificationDays: number
}

export const CACHE_TTL_CHOICES = [15, 30, 60, 120, 300, 600] as const

export const defaultServerSettings: ServerSettings = {
  cache: { enabled: true, ttlSeconds: 60 },
  retention: { auditDays: 365, notificationDays: 180 },
}

export interface RuntimeDetails {
  node: string
  platform: string
  arch: string
  /** How long this instance has been answering requests. Short is normal: they come and go. */
  uptimeSeconds: number
  memoryMb: { rss: number; heapUsed: number; heapTotal: number }
  /** The server's own clock and zone, which is what every booking date is worked out from. */
  serverTime: string
  timezone: string
}

export interface HostingDetails {
  /** 'vercel' when the API is running as a Vercel function, 'local' in development. */
  platform: 'vercel' | 'local'
  /** production, preview or development. */
  environment: string
  /** The data centre, e.g. bom1 (Mumbai). Empty when running locally. */
  region: string
  url: string
  commit: string
  branch: string
}

export interface EnvVarCheck {
  name: string
  purpose: string
  /** Something important stops working without it. */
  required: boolean
  set: boolean
  /** What to do about it when it isn't set. */
  fix: string
}

export interface CacheGroupReport {
  name: string
  label: string
  explain: string
  entries: number
  hits: number
  misses: number
  /** Rough size of what is held, in kilobytes. */
  kb: number
  /** Age of the oldest answer still being reused. */
  oldestSeconds: number | null
}

export interface CacheReport {
  enabled: boolean
  ttlSeconds: number
  groups: CacheGroupReport[]
  hits: number
  misses: number
  /** Bumped every time anything is cleared, so other instances drop what they hold too. */
  epoch: number
  clearedAt: string | null
}

export interface CollectionSize {
  name: string
  label: string
  docs: number
  /** True for the two logs that only ever grow, which Housekeeping can trim. */
  trimmable: boolean
}

export interface StorageUsage {
  files: number
  mb: number
  measuredAt: string
}

/** The last time a scheduled job ran, whoever or whatever started it. */
export interface CronRun {
  at: string
  ok: boolean
  /** A short human summary: "2 reminders, 1 review invitation". */
  summary: string
  /** 'schedule' when the hosting called it, 'admin' when someone pressed Run now. */
  by: 'schedule' | 'admin'
}

export interface CronJobReport {
  name: string
  label: string
  explain: string
  /** The cron line in vercel.json, if the platform is set to call it. */
  schedule: string
  path: string
  lastRun: CronRun | null
}

export interface ServerReport {
  runtime: RuntimeDetails
  hosting: HostingDetails
  versions: { platform: string; apps: Record<string, string> }
  env: EnvVarCheck[]
  cache: CacheReport
  collections: CollectionSize[]
  totalDocs: number
  jobs: CronJobReport[]
  settings: ServerSettings
  /** Measured only when asked for: counting every file costs a listing of the whole bucket. */
  storage: StorageUsage | null
}

/** "4.2 MB", "812 KB" — for sizes the page shows. */
export function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${Math.round(mb * 1024)} KB`
}

/** "3 days", "4 hours", "12 minutes" — for uptime and ages. */
export function formatDuration(seconds: number): string {
  if (seconds >= 172800) return `${Math.floor(seconds / 86400)} days`
  if (seconds >= 7200) return `${Math.floor(seconds / 3600)} hours`
  if (seconds >= 120) return `${Math.floor(seconds / 60)} minutes`
  return `${Math.max(0, Math.round(seconds))} seconds`
}

/** Share of reads answered from memory, as a whole percentage. Null until anything has been asked for. */
export function hitRate(hits: number, misses: number): number | null {
  const total = hits + misses
  return total === 0 ? null : Math.round((hits / total) * 100)
}
