import { contentRepo } from './repositories'
import { seed } from './store/seed'

let ready: Promise<void> | null = null

/**
 * Adds default site content once per process (safe to call on every cold start).
 * Demo data is added only in development, or when SEED_DEMO_DATA=true (e.g. a client preview).
 */
export function ensureReady(): Promise<void> {
  ready ??= (async () => {
    await contentRepo.ensureDefaults()
    if (process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO_DATA === 'true') await seed()
  })().catch((err) => {
    ready = null
    throw err
  })
  return ready
}
