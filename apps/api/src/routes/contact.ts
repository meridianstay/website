import { Hono } from 'hono'
import { query } from '../db/pool'
import type { AppEnv } from '../auth'
import { rateLimit } from '../rateLimit'
import { checkEmail, checkLength, collect, str } from '../validate'

export const CONTACT_TOPICS = ['Booking help', 'Hosting', 'Payments & refunds', 'Trust & safety', 'Press', 'Partnerships & investors', 'Other']

export const contactRoutes = new Hono<AppEnv>()

contactRoutes.post('/contact', rateLimit('contact', 5), async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const name = str(body.name)
  const email = str(body.email)
  const topic = str(body.topic)
  const message = str(body.message)
  collect({
    name: checkLength(name, 'Name', 1, 80),
    email: checkEmail(email),
    topic: CONTACT_TOPICS.includes(topic) ? null : 'Choose a topic.',
    message: checkLength(message, 'Message', 10, 5000),
  })
  await query('INSERT INTO contact_messages (name, email, topic, message) VALUES ($1, $2, $3, $4)', [name, email, topic, message])
  return c.body(null, 201)
})
