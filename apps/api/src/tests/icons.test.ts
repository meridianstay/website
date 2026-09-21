import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// @ts-expect-error - a plain build script, deliberately untyped
import { buildIcons, codepointsOf, usedIcons } from '../../../../scripts/build-icons.mjs'

// The icon stylesheet and the cut-down web font are generated and committed, so nothing has to run
// at deploy time. These guard against them drifting from the icons the apps actually use — without
// them, adding an icon would silently show nothing.

const root = join(import.meta.dirname, '../../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('icon stylesheet and font', () => {
  test('icons.css covers exactly the icons the apps use', () => {
    const expected = buildIcons(usedIcons()) as string
    assert.equal(read('packages/ui/src/icons.css'), expected, 'Run "npm run icons" and commit packages/ui/src/icons.css')
  })

  test('the cut-down font was built for the icons in the stylesheet', () => {
    const css = read('packages/ui/src/icons.css')
    const manifest = JSON.parse(read('packages/ui/src/fa-subset.json')) as { codepoints: string[] }
    assert.deepEqual(manifest.codepoints, codepointsOf(css), 'Run "npm run icons" and follow the pyftsubset command it prints')
  })

  test('every icon written in the apps has a rule', () => {
    const css = read('packages/ui/src/icons.css')
    // Names that are Font Awesome's own layout helpers, not icons.
    const helpers = /^(solid|regular|brands|spin|pulse|fw|xs|sm|lg|xl|2xl|[1-9]x|beat|fade|flip|shake|bounce|stack|ul|li|border|pull-left|pull-right|inverse|rotate|classic|sharp|style|display|animation|counter|width|primary|secondary|inverse-opacity|li-width|li-margin|stack-z-index|beat-scale|fade-opacity|beat-fade-opacity|beat-fade-scale|flip-x|flip-y|flip-z|flip-angle|bounce-.*|shake-.*|spin-.*|rotate-.*|border-.*|pull|font-.*|family-.*|inverse.*|2x|1x)$/
    const missing: string[] = []
    for (const name of usedIcons() as Set<string>) {
      if (helpers.test(name) || css.includes(`.fa-${name},`) || css.includes(`.fa-${name}{`)) continue
      missing.push(name)
    }
    assert.deepEqual(missing, [], 'These icons have no rule; check the spelling or run "npm run icons"')
  })
})
