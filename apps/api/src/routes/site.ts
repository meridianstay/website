import { Hono } from 'hono'
import { contentRepo, statsRepo } from '../repositories'
import { paymentConfigRepo } from '../repositories/paymentConfig'
import { homepageService } from '../services/homepage'
import type { AppEnv } from '../http/auth'
import { notFound } from '../http/errors'
import { str } from '../http/validate'
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

siteRoutes.get('/pages', async (c) => c.json({ pages: await contentRepo.publishedPageTitles() }))

siteRoutes.get('/pages/:slug', async (c) => {
  const page = await contentRepo.publishedPage(c.req.param('slug'))
  if (!page) throw notFound('page')
  return c.json({ page: translateDeep(page, await contentRepo.translations(wanted(c))) })
})
