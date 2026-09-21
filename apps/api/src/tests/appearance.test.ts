import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultBranding, defaultFooter, defaultHeader, defaultTheme, hexToRgb, themeVariables, withBrandingDefaults } from '@meridian/shared'
import { appearanceService } from '../services/appearance'
import { contentRepo } from '../repositories'
import { appError, createUser, resetDatabase } from './helpers'

const body = (value: unknown) => value as Record<string, unknown>

describe('Logos, header and footer', () => {
  beforeEach(resetDatabase)

  test('each app keeps its own logo and name', async () => {
    const admin = await createUser('admin')
    assert.equal((await contentRepo.settings()).branding.apps.host.subtitle, defaultBranding.apps.host.subtitle)

    const branding = structuredClone(defaultBranding)
    branding.apps.website.logoUrl = 'https://cdn.example.com/website.png'
    branding.apps.host.logoUrl = 'https://cdn.example.com/host.png'
    branding.apps.host.name = 'Meridian Partners'
    branding.apps.host.showName = false
    await appearanceService.saveBranding(admin.me, body(branding))

    const saved = (await contentRepo.settings()).branding
    assert.equal(saved.apps.website.logoUrl, 'https://cdn.example.com/website.png')
    assert.equal(saved.apps.host.name, 'Meridian Partners')
    assert.equal(saved.apps.host.showName, false)
    assert.equal(saved.apps.admin.logoUrl, '', 'the control centre keeps its own (empty) logo')
  })

  test('each app also gets its own tab icon and preloader, plus one stand-in photo', async () => {
    const admin = await createUser('admin')
    const branding = structuredClone(defaultBranding)
    branding.apps.website.faviconUrl = 'https://cdn.example.com/icon.png'
    branding.apps.host.splashUrl = 'https://cdn.example.com/host-splash.png'
    branding.placeholderUrl = 'https://cdn.example.com/placeholder.jpg'
    const saved = await appearanceService.saveBranding(admin.me, body(branding))
    assert.equal(saved.apps.website.faviconUrl, 'https://cdn.example.com/icon.png')
    assert.equal(saved.apps.host.splashUrl, 'https://cdn.example.com/host-splash.png')
    assert.equal(saved.placeholderUrl, 'https://cdn.example.com/placeholder.jpg')

    const bad = structuredClone(defaultBranding)
    bad.apps.admin.faviconUrl = 'javascript:alert(1)'
    bad.placeholderUrl = 'not-a-link'
    const err = await appError(() => appearanceService.saveBranding(admin.me, body(bad)))
    assert.ok(err.fields['admin.faviconUrl'])
    assert.ok(err.fields.placeholderUrl)
  })

  test('settings saved before each app had its own icons still load', () => {
    // 0.22.0 and earlier stored the four apps at the top level with no icons.
    const old = { website: { logoUrl: 'https://cdn.example.com/old.png', name: 'Old', accent: 'Name', subtitle: '', showName: true } }
    const filled = withBrandingDefaults(old)
    assert.equal(filled.apps.website.logoUrl, 'https://cdn.example.com/old.png')
    assert.equal(filled.apps.website.faviconUrl, '')
    assert.equal(filled.apps.host.name, 'Meridian')
    assert.equal(filled.placeholderUrl, '')
  })

  test('refuses a logo that is not an image and a name that is missing', async () => {
    const admin = await createUser('admin')
    const branding = structuredClone(defaultBranding)
    branding.apps.website.logoUrl = 'javascript:alert(1)'
    branding.apps.account.name = ''
    const err = await appError(() => appearanceService.saveBranding(admin.me, body(branding)))
    assert.ok(err.fields['website.logoUrl'])
    assert.ok(err.fields['account.name'])
  })

  test('header switches and extra links are saved, empty rows are dropped', async () => {
    const admin = await createUser('admin')
    const header = {
      ...defaultHeader, showCurrency: false, hostLinkLabel: 'Become a host',
      links: [{ label: 'Day outs', url: '/search?dayuse=1' }, { label: '', url: '' }],
    }
    const saved = await appearanceService.saveHeader(admin.me, body(header))
    assert.equal(saved.showCurrency, false)
    assert.equal(saved.showSearch, true)
    assert.equal(saved.hostLinkLabel, 'Become a host')
    assert.deepEqual(saved.links, [{ label: 'Day outs', url: '/search?dayuse=1' }])
  })

  test('a link with no destination is reported instead of silently vanishing', async () => {
    const admin = await createUser('admin')
    const err = await appError(() => appearanceService.saveHeader(admin.me, body({ ...defaultHeader, links: [{ label: 'Offers', url: '' }] })))
    assert.ok(err.fields['links.0.url'])
  })

  test('footer columns, socials and the copyright year token are saved', async () => {
    const admin = await createUser('admin')
    const footer = structuredClone(defaultFooter)
    footer.columns = [{ heading: 'Company', links: [{ label: 'About us', url: '/about' }] }]
    footer.social.instagram = 'https://instagram.com/meridianstay'
    footer.copyright = '© {year} Meridian Stay'
    const saved = await appearanceService.saveFooter(admin.me, body(footer))
    assert.equal(saved.columns.length, 1)
    assert.equal(saved.social.instagram, 'https://instagram.com/meridianstay')
    assert.equal(saved.credit.label, defaultFooter.credit.label, 'the studio credit is kept')
    assert.equal(saved.copyright, '© {year} Meridian Stay')

    const bad = structuredClone(defaultFooter)
    bad.columns[0].heading = ''
    bad.columns[1].links[0].url = 'ftp://example.com'
    bad.social.facebook = 'facebook.com/meridian'
    const err = await appError(() => appearanceService.saveFooter(admin.me, body(bad)))
    assert.ok(err.fields['columns.0.heading'])
    assert.ok(err.fields['columns.1.links.0.url'])
    assert.ok(err.fields['social.facebook'])
  })
})

describe('the colour palette', () => {
  beforeEach(resetDatabase)

  test('saves two colours and builds every shade from them', async () => {
    const admin = await createUser('admin')
    assert.deepEqual((await contentRepo.settings()).theme, defaultTheme)

    const saved = await appearanceService.saveTheme(admin.me, body({ brand: '#0D9488', accent: '#FB7185' }))
    assert.deepEqual(saved, { brand: '#0D9488', accent: '#FB7185' })
    assert.deepEqual((await contentRepo.settings()).theme, saved)

    const vars = themeVariables(saved)
    assert.equal(vars['--brand-500'], hexToRgb('#0D9488').join(' '), '500 is the colour itself')
    assert.equal(vars['--brand-50'], '243 250 249', 'the lightest shade is mostly white')
    assert.equal(vars['--brand-900'], '6 71 65', 'the darkest shade is mostly black')
    assert.equal(vars['--brand-yellow-500'], hexToRgb('#FB7185').join(' '))
  })

  test('refuses anything that isn’t a colour', async () => {
    const admin = await createUser('admin')
    const err = await appError(() => appearanceService.saveTheme(admin.me, body({ brand: 'green', accent: '' })))
    assert.ok(err.fields.brand)
    assert.ok(err.fields.accent)
  })
})
