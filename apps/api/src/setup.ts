import { migrate } from './db/migrate'
import { seed } from './db/seed'
import { contentRepo } from './repositories'

let ready: Promise<void> | null = null

/**
 * Brings the database up to date once per process (safe to call on every cold start).
 * Demo data is added only in development, or when SEED_DEMO_DATA=true (e.g. a test deployment).
 */
export function ensureDatabase(): Promise<void> {
  ready ??= (async () => {
    await migrate()
    await contentRepo.ensureDefaults()
    if (process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO_DATA === 'true') await seed()
  })().catch((err) => {
    ready = null
    throw err
  })
  return ready
}
