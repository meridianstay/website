import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultBranding, defaultFooter, defaultHeader } from '@meridian/shared'
import { appearanceService } from '../services/appearance'
import { contentRepo } from '../repositories'
import { appError, createUser, resetDatabase } from './helpers'

const body = (value: unknown) => value as Record<string, unknown>

describe('Logos, header and footer', () => {
  beforeEach(resetDatabase)

  test('each app keeps its own logo and name', async () => {
    const admin = await createUser('admin')
    assert.equal((await contentRepo.settings()).branding.host.subtitle, defaultBranding.host.subtitle)

    const branding = structuredClone(defaultBranding)
    branding.website.logoUrl = 'https://cdn.example.com/website.png'
    branding.host.logoUrl = 'https://cdn.example.com/host.png'
    branding.host.name = 'Meridian Partners'
    branding.host.showName = false
    await appearanceService.saveBranding(admin.me, body(branding))

    const saved = (await contentRepo.settings()).branding
    assert.equal(saved.website.logoUrl, 'https://cdn.example.com/website.png')
    assert.equal(saved.host.name, 'Meridian Partners')
    assert.equal(saved.host.showName, false)
    assert.equal(saved.admin.logoUrl, '', 'the control centre keeps its own (empty) logo')
  })

  test('refuses a logo that is not an image and a name that is missing', async () => {
    const admin = await createUser('admin')
    const branding = structuredClone(defaultBranding)
    branding.website.logoUrl = 'javascript:alert(1)'
    branding.account.name = ''
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
