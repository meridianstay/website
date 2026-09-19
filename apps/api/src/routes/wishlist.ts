import { Hono } from 'hono'
import { propertiesRepo, wishlistRepo } from '../repositories'
import { currentUser, requireUser, type AppEnv } from '../http/auth'
import { notFound } from '../http/errors'

export const wishlistRoutes = new Hono<AppEnv>()
wishlistRoutes.use('/wishlist', requireUser)
wishlistRoutes.use('/wishlist/*', requireUser)

wishlistRoutes.get('/wishlist', async (c) => c.json({ properties: await wishlistRepo.list(currentUser(c).id) }))

wishlistRoutes.put('/wishlist/:propertyId', async (c) => {
  const propertyId = Number(c.req.param('propertyId'))
  if ((await propertiesRepo.get(propertyId))?.status !== 'Approved') throw notFound('stay')
  await wishlistRepo.add(currentUser(c).id, propertyId)
  return c.body(null, 204)
})

wishlistRoutes.delete('/wishlist/:propertyId', async (c) => {
  await wishlistRepo.remove(currentUser(c).id, Number(c.req.param('propertyId')))
  return c.body(null, 204)
})
