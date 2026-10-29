import { Hono } from 'hono'
import { todayISO } from '@meridian/shared'
import { reviewsRepo } from '../repositories'
import { invoiceService } from '../services/invoices'
import { currentUser, requireUser, type AppEnv } from '../http/auth'

// The guest's own account panel. Bookings and the wishlist have their own routes already; these are
// the two things a guest could not see anywhere before — every tax document they have been given,
// and every review they have written.

export const accountRoutes = new Hono<AppEnv>()
accountRoutes.use('/account/*', requireUser)

accountRoutes.get('/account/invoices', async (c) =>
  c.json(await invoiceService.forGuest(currentUser(c).id, todayISO())))

accountRoutes.get('/account/reviews', async (c) =>
  c.json({ reviews: await reviewsRepo.byAuthor(currentUser(c).id) }))
