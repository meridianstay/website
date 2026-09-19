import { Hono } from 'hono'
import { contentRepo } from '../repositories'
import type { AppEnv } from '../http/auth'
import { notFound } from '../http/errors'

// Public website content edited in the control center.
export const siteRoutes = new Hono<AppEnv>()

siteRoutes.get('/site', async (c) => c.json(await contentRepo.settings()))

siteRoutes.get('/pages', async (c) => c.json({ pages: await contentRepo.publishedPageTitles() }))

siteRoutes.get('/pages/:slug', async (c) => {
  const page = await contentRepo.publishedPage(c.req.param('slug'))
  if (!page) throw notFound('page')
  return c.json({ page })
})
