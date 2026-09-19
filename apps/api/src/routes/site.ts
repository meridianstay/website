import { Hono } from 'hono'
import { contentRepo, statsRepo } from '../repositories'
import { paymentConfigRepo } from '../repositories/paymentConfig'
import { homepageService } from '../services/homepage'
import type { AppEnv } from '../http/auth'
import { notFound } from '../http/errors'

// Public website content edited in the control center.
export const siteRoutes = new Hono<AppEnv>()

siteRoutes.get('/site', async (c) => {
  const [settings, payments] = await Promise.all([contentRepo.settings(), paymentConfigRepo.get()])
  return c.json({ ...settings, paymentsOnline: !!(payments?.enabled && payments.keyId && payments.keySecretEnc) })
})

siteRoutes.get('/home', async (c) => c.json(await homepageService.forWebsite()))

siteRoutes.get('/about', async (c) => {
  const [page, stats] = await Promise.all([contentRepo.about(), statsRepo.forAbout()])
  return c.json({ page, stats })
})

siteRoutes.get('/pages', async (c) => c.json({ pages: await contentRepo.publishedPageTitles() }))

siteRoutes.get('/pages/:slug', async (c) => {
  const page = await contentRepo.publishedPage(c.req.param('slug'))
  if (!page) throw notFound('page')
  return c.json({ page })
})
