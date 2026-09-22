// What is shown in the corner of every footer, so anyone can say exactly which build they are
// looking at when they report something. Each app carries its own number, bumped in the same
// commit as a change to that app; `PLATFORM_VERSION` is the release in CHANGELOG.md.

import type { BrandApp } from './branding'

export const PLATFORM_VERSION = '0.25.0'

export const APP_VERSIONS: Record<BrandApp, string> = {
  website: '0.25.0',
  host: '0.24.0',
  account: '0.24.0',
  admin: '0.25.0',
}

/** "v0.23.0", for the small grey line in the footer. Never a link. */
export const versionLabel = (app: BrandApp) => `v${APP_VERSIONS[app]}`
