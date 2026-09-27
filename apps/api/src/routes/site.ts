import { Hono } from 'hono'
import { contentRepo, statsRepo } from '../repositories'
import { paymentConfigRepo } from '../repositories/paymentConfig'
import { homepageService } from '../services/homepage'
import type { AppEnv } from '../http/auth'
import { notFound } from '../http/errors'
import { str } from '../http/validate'
import { body } from '../http/auth'
import { AppError } from '../http/errors'
import { campaignService } from '../services/campaigns'
import { pushService } from '../services/push'
import { translateDeep } from '@meridian/shared'

// Public website content edited in the control center. Everything here is served in the language
// the visitor asked for (`?lang=mr`), with anything not yet translated left in its original wording.
export const siteRoutes = new Hono<AppEnv>()

const wanted = (c: { req: { query: (k: string) => string | undefined } }) => str(c.req.query('lang'))

siteRoutes.get('/site', async (c) => {
  const [settings, payments, words] = await Promise.all([contentRepo.settings(), paymentConfigRepo.get(), contentRepo.translations(wanted(c))])
  const translated = translateDeep(settings, words)
  return c.json({ ...translated, paymentsOnline: !!(payments?.enabled && payments.keyId && payments.keySecretEnc) })
})

siteRoutes.get('/home', async (c) => {
  const [home, words] = await Promise.all([homepageService.forWebsite(), contentRepo.translations(wanted(c))])
  return c.json(translateDeep(home, words))
})

siteRoutes.get('/about', async (c) => {
  const [page, stats, words] = await Promise.all([contentRepo.about(), statsRepo.forAbout(), contentRepo.translations(wanted(c))])
  return c.json({ page: translateDeep(page, words), stats })
})

/** The one popup this visitor should see, if any. */
siteRoutes.get('/campaigns/popup', async (c) => {
  const user = c.get('user')
  const page = str(c.req.query('page'))
  return c.json({
    popup: await campaignService.popupFor({
      role: user?.role ?? null,
      installed: c.req.query('installed') === '1',
      hasStayed: user ? await campaignService.hasStayed(user.id) : false,
      page: page === 'home' || page === 'stays' ? page : 'other',
      place: str(c.req.query('place')) || null,
    }),
  })
})

/** Counting a view, a click or a dismissal. Never fails the page. */
siteRoutes.post('/campaigns/:id/:event', async (c) => {
  const event = c.req.param('event')
  if (event === 'shown' || event === 'clicked' || event === 'dismissed') {
    await campaignService.count(Number(c.req.param('id')), event)
  }
  return c.body(null, 204)
})

/** The application key a browser needs before it can subscribe. */
siteRoutes.get('/push/key', async (c) => c.json({ publicKey: await pushService.publicKey() }))

siteRoutes.post('/push/subscribe', async (c) => {
  const b = await body(c)
  const user = c.get('user')
  const sub = (b.subscription ?? {}) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys.auth) throw new AppError(400, 'That subscription is incomplete.')
  await pushService.subscribe({
    endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth,
    userId: user?.id ?? null, role: user?.role ?? null,
    installed: b.installed === true, language: str(b.language) || 'en',
  })
  return c.body(null, 204)
})

siteRoutes.post('/push/unsubscribe', async (c) => {
  await pushService.unsubscribe(str((await body(c)).endpoint))
  return c.body(null, 204)
})

siteRoutes.get('/pages', async (c) => c.json({ pages: await contentRepo.publishedPageTitles() }))

siteRoutes.get('/pages/:slug', async (c) => {
  const page = await contentRepo.publishedPage(c.req.param('slug'))
  if (!page) throw notFound('page')
  return c.json({ page: translateDeep(page, await contentRepo.translations(wanted(c))) })
})
