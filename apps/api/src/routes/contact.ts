import { Hono } from 'hono'
import { messagesRepo } from '../repositories'
import { body, type AppEnv } from '../http/auth'
import { rateLimit } from '../http/rateLimit'
import { checkEmail, checkLength, collect, str } from '../http/validate'

export const CONTACT_TOPICS = ['Booking help', 'Hosting', 'Payments & refunds', 'Trust & safety', 'Press', 'Partnerships & investors', 'Other']

export const contactRoutes = new Hono<AppEnv>()

contactRoutes.post('/contact', rateLimit('contact', 5), async (c) => {
  const b = await body(c)
  const m = { name: str(b.name), email: str(b.email), topic: str(b.topic), message: str(b.message) }
  collect({
    name: checkLength(m.name, 'Name', 1, 80),
    email: checkEmail(m.email),
    topic: CONTACT_TOPICS.includes(m.topic) ? null : 'Choose a topic.',
    message: checkLength(m.message, 'Message', 10, 5000),
  })
  await messagesRepo.insert(m)
  return c.body(null, 201)
})
