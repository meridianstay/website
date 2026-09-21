import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { LANGUAGES, defaultLanguages, fill, offeredLanguages, pickLanguage } from '@meridian/shared'
import { en, loaders } from '@meridian/shared/locales'
import { appearanceService } from '../services/appearance'
import { contentRepo } from '../repositories'
import { appError, createUser, resetDatabase } from './helpers'

const body = (value: unknown) => value as Record<string, unknown>

describe('languages', () => {
  beforeEach(resetDatabase)

  test('a visitor gets their browser’s language when we offer it', () => {
    const settings = defaultLanguages
    assert.equal(pickLanguage(null, ['mr-IN', 'en-IN'], settings), 'mr')
    assert.equal(pickLanguage(null, ['ta'], settings), 'ta')
    // Not offered, so they get the default instead.
    assert.equal(pickLanguage(null, ['fr-FR'], settings), 'en')
    // What they picked themselves always wins.
    assert.equal(pickLanguage('gu', ['mr-IN'], settings), 'gu')
    // …unless it has since been switched off in the control centre.
    assert.equal(pickLanguage('gu', ['mr-IN'], { ...settings, enabled: ['en', 'mr'] }), 'mr')
  })

  test('automatic detection can be switched off', () => {
    const settings = { enabled: ['en', 'hi'], fallback: 'hi', autoDetect: false }
    assert.equal(pickLanguage(null, ['ta-IN'], settings), 'hi')
    assert.equal(pickLanguage('en', ['ta-IN'], settings), 'en', 'a deliberate choice is still kept')
  })

  test('English is always offered, whatever is saved', async () => {
    const admin = await createUser('admin')
    const saved = await appearanceService.saveLanguages(admin.me, body({ enabled: ['mr', 'gu'], fallback: 'mr', autoDetect: true }))
    assert.deepEqual(saved.enabled, ['en', 'mr', 'gu'])
    assert.deepEqual((await contentRepo.settings()).languages, saved)
    assert.deepEqual(offeredLanguages(saved).map((l) => l.code), ['en', 'mr', 'gu'])
  })

  test('the default language has to be one that is offered', async () => {
    const admin = await createUser('admin')
    const err = await appError(() => appearanceService.saveLanguages(admin.me, body({ enabled: ['mr'], fallback: 'ta' })))
    assert.ok(err.fields.fallback)
  })

  test('every language has a dictionary with the same keys as English', async () => {
    const keys = Object.keys(en)
    for (const { code } of LANGUAGES.filter((l) => l.code !== 'en')) {
      const loader = loaders[code]
      assert.ok(loader, `${code} has no dictionary`)
      const dict = (await loader()).default
      assert.deepEqual(Object.keys(dict), keys, `${code} does not match the English keys`)
      for (const key of keys) assert.ok(dict[key].trim(), `${code}.${key} is empty`)
    }
  })

  test('placeholders survive translation', async () => {
    assert.equal(fill(en['search.results'], { count: 12 }), '12 stays')
    for (const { code } of LANGUAGES.filter((l) => l.code !== 'en')) {
      const dict = (await loaders[code]()).default
      for (const key of ['search.results', 'stay.showAllPhotos', 'stay.hostedBy', 'booking.checkInFrom']) {
        const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()
        assert.deepEqual(placeholders(dict[key]), placeholders(en[key]), `${code}.${key} lost a placeholder`)
      }
    }
  })
})
