import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { APP_VERSIONS, PLATFORM_VERSION } from '@meridian/shared'

// The number in every footer comes from one file, and that file is edited by hand at every
// release. These guard the two ways it goes wrong: a release that forgets to bump it, and an app
// whose number wanders away from the platform's.

const root = join(import.meta.dirname, '../../../..')
const parts = (v: string) => v.split('.').map(Number)

/** a is newer than b. */
const newer = (a: string, b: string) => {
  const [x, y, z] = parts(a)
  const [p, q, r] = parts(b)
  return x !== p ? x > p : y !== q ? y > q : z > r
}

describe('version numbers', () => {
  test('the platform version is the newest release in the changelog', () => {
    const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')
    const top = /^## (\d+\.\d+\.\d+)/m.exec(changelog)?.[1]
    assert.ok(top, 'the changelog has no version headings')
    assert.equal(PLATFORM_VERSION, top,
      `PLATFORM_VERSION is ${PLATFORM_VERSION} but the changelog's newest entry is ${top}. Bump one or the other.`)
  })

  test('every number is a real version', () => {
    for (const [app, version] of Object.entries(APP_VERSIONS)) {
      assert.match(version, /^\d+\.\d+\.\d+$/, `${app} has ${version}, which is not a version`)
    }
    assert.match(PLATFORM_VERSION, /^\d+\.\d+\.\d+$/)
  })

  test('no app claims to be newer than the platform it is part of', () => {
    for (const [app, version] of Object.entries(APP_VERSIONS)) {
      assert.ok(!newer(version, PLATFORM_VERSION),
        `${app} says ${version}, which is ahead of the platform's ${PLATFORM_VERSION}`)
    }
  })

  test('an app has not been left behind for a dozen releases', () => {
    // A panel that genuinely hasn't changed may lag; one stuck ten minor versions back is a
    // forgotten bump, which is exactly how the website sat on 0.37.0 while the platform reached 0.46.
    const [, platformMinor] = parts(PLATFORM_VERSION)
    for (const [app, version] of Object.entries(APP_VERSIONS)) {
      const [, minor] = parts(version)
      assert.ok(platformMinor - minor <= 8,
        `${app} is on ${version} while the platform is on ${PLATFORM_VERSION}. If it really hasn't changed, raise this limit; otherwise bump it.`)
    }
  })
})
