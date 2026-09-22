import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { LANGUAGES, collectContentStrings, defaultAbout, defaultHomeLayout, defaultLanguages, defaultSiteSettings, fill, offeredLanguages, pickLanguage, translateDeep, translationProgress } from '@meridian/shared'
import { en, loaders, starterContent } from '@meridian/shared/locales'
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

describe('translating the words written in the control centre', () => {
  beforeEach(resetDatabase)

  test('a translated heading replaces the English one everywhere it appears', async () => {
    const admin = await createUser('admin')
    await appearanceService.saveTranslations(admin.me, body({
      mr: { 'Featured Meridian Stays': 'निवडक मेरिडियन मुक्काम' },
      ta: { 'Featured Meridian Stays': 'தேர்ந்தெடுத்த இடங்கள்' },
    }))

    const words = await contentRepo.translations('mr')
    assert.equal(words['Featured Meridian Stays'], 'निवडक मेरिडियन मुक्काम', 'what the control centre saved wins')
    assert.equal(words['Explore Property Types'], 'मालमत्तेचे प्रकार पाहा', 'and the starter pack fills the rest')

    const layout = await contentRepo.home()
    const marathi = translateDeep(layout, words)
    const titles = marathi.blocks.map((b) => b.title)
    assert.ok(titles.includes('निवडक मेरिडियन मुक्काम'))
    assert.ok(titles.includes('मालमत्तेचे प्रकार पाहा'))

    // Tamil has no starter pack, so only the one saved sentence changes.
    const tamil = translateDeep(layout, await contentRepo.translations('ta'))
    assert.ok(tamil.blocks.map((b) => b.title).includes('தேர்ந்தெடுத்த இடங்கள்'))
    assert.ok(tamil.blocks.map((b) => b.title).includes('Promoted stays'), 'untranslated wording is left alone')
    // Links, photos and ids are left exactly as they were.
    assert.equal(marathi.blocks[0].id, layout.blocks[0].id)
    assert.equal(marathi.hero.slides[0].image, layout.hero.slides[0].image)
  })

  test('English is never stored, and a switched-off language is dropped', async () => {
    const admin = await createUser('admin')
    await appearanceService.saveLanguages(admin.me, body({ enabled: ['mr'], fallback: 'en', autoDetect: true }))
    const saved = await appearanceService.saveTranslations(admin.me, body({
      en: { 'Featured Meridian Stays': 'nope' },
      mr: { 'Featured Meridian Stays': 'निवडक' },
      ta: { 'Featured Meridian Stays': 'தேர்ந்தெடுத்த' },
    }))
    assert.deepEqual(Object.keys(saved), ['mr'])
    assert.deepEqual(await contentRepo.translations('en'), {}, 'English is the original wording')
    assert.deepEqual(await contentRepo.translations('ta'), {}, 'a language with no pack and nothing saved')
  })

  test('the control centre is offered every sentence a visitor can read', async () => {
    const groups = collectContentStrings({
      home: await contentRepo.home(),
      footer: defaultSiteSettings.footer,
      header: defaultSiteSettings.header,
      announcement: defaultSiteSettings.announcement,
      about: defaultAbout,
    })
    const all = groups.flatMap((g) => g.strings)
    assert.ok(all.includes('Featured Meridian Stays'), 'a homepage heading')
    assert.ok(all.includes(defaultSiteSettings.footer.tagline), 'the footer tagline')
    assert.ok(all.includes('About Meridian'), 'a footer column heading')
    assert.ok(all.some((s) => s === defaultAbout.hero.tagline), 'the About us tagline')
    // Never a link, a photo or a colour.
    assert.ok(!all.some((s) => s.startsWith('http') || s.startsWith('/') || /^#[0-9a-f]{6}$/i.test(s)), 'only real wording')

    const progress = translationProgress(groups, { 'Featured Meridian Stays': 'x' })
    assert.equal(progress.done, 1)
    assert.ok(progress.total > 30)
  })
})

describe('the starter translations', () => {
  test('cover the homepage, header and footer as they ship', () => {
    const groups = collectContentStrings({
      home: defaultHomeLayout(),
      footer: defaultSiteSettings.footer,
      header: defaultSiteSettings.header,
      announcement: defaultSiteSettings.announcement,
    })
    const wanted = new Set(groups.flatMap((g) => g.strings))
    for (const lang of ['hi', 'mr', 'gu']) {
      const pack = starterContent[lang]
      assert.ok(pack, `${lang} has no starter pack`)
      const missing = [...wanted].filter((s) => !(pack[s] ?? '').trim())
      assert.deepEqual(missing, [], `${lang} is missing translations for the default wording`)
      for (const [source, text] of Object.entries(pack)) {
        assert.notEqual(text, source, `${lang}.${source} was left in English`)
      }
    }
  })

  test('keep the placeholders the original wording used', () => {
    for (const lang of ['hi', 'mr', 'gu']) {
      for (const [source, text] of Object.entries(starterContent[lang])) {
        const marks = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()
        assert.deepEqual(marks(text), marks(source), `${lang}.${source} lost a placeholder`)
      }
    }
  })
})
