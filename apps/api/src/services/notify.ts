import {
  NOTIFICATION_EVENTS, defaultNotifications, fillTemplate,
  type MessageTemplate, type Me, type NotificationEvent, type NotificationSettings,
} from '@meridian/shared'
import { auditLogRepo, contentRepo, notificationsRepo } from '../repositories'
import { decryptSecret, encryptSecret, encryptionReady } from '../store/secrets'
import { C, col } from '../store/db'
import { AppError } from '../http/errors'
import { collect, str } from '../http/validate'
import { sendEmail, sendSms, type SmsConfig, type SmtpConfig } from './delivery'

// Deciding what to send, to whom, and writing down what happened. Nothing here throws into the
// caller: a booking must never fail because a mailbox was full, so every problem is logged and
// swallowed. The control centre shows the log.

const SECRET_DOC = 'notifications'

interface StoredCredentials {
  smtpHost?: string
  smtpPort?: number
  smtpUser?: string
  smtpPassEnc?: string
  smtpSecure?: boolean
  smsKeyEnc?: string
  smsSecretEnc?: string
}

export interface Recipient {
  name: string
  email?: string | null
  phone?: string | null
}

async function settings(): Promise<NotificationSettings> {
  const all = await contentRepo.settings()
  return all.notifications ?? defaultNotifications
}

async function credentials(): Promise<StoredCredentials> {
  const snap = await col(C.secrets).doc(SECRET_DOC).get()
  return snap.exists ? (snap.data() as StoredCredentials) : {}
}

function smtpFrom(stored: StoredCredentials): SmtpConfig | null {
  if (!stored.smtpHost || !stored.smtpUser || !stored.smtpPassEnc) return null
  return {
    host: stored.smtpHost,
    port: stored.smtpPort ?? 587,
    user: stored.smtpUser,
    pass: decryptSecret(stored.smtpPassEnc),
    secure: stored.smtpSecure ?? false,
  }
}

function smsFrom(config: NotificationSettings, stored: StoredCredentials): SmsConfig | null {
  if (config.sms === 'none' || !stored.smsKeyEnc) return null
  return {
    provider: config.sms,
    key: decryptSecret(stored.smsKeyEnc),
    secret: stored.smsSecretEnc ? decryptSecret(stored.smsSecretEnc) : '',
    sender: config.smsSenderId,
  }
}

export const notifyService = {
  /**
   * Tells someone that something happened. Never throws: the booking or listing change that caused
   * it has already succeeded, and a broken mailbox must not undo it.
   */
  async send(event: NotificationEvent, to: Recipient, tokens: Record<string, string | number | null | undefined>, bookingCode: string | null = null) {
    try {
      const config = await settings()
      const template = config.templates[event] ?? defaultNotifications.templates[event]
      if (!template?.enabled) return

      const values = { ...tokens, name: to.name || 'there', site: config.fromName }
      const subject = fillTemplate(template.subject, values)
      const stored = await credentials()

      if (template.email && to.email) {
        const smtp = smtpFrom(stored)
        if (!smtp || config.email === 'none' || !config.fromEmail) {
          await log(event, 'email', 'skipped', to.email, subject, 'No mail server is set up yet.', bookingCode)
        } else {
          try {
            await sendEmail(smtp, {
              fromName: config.fromName, fromEmail: config.fromEmail, replyTo: config.replyTo || undefined,
              to: to.email, subject, text: fillTemplate(template.body, values),
            })
            await log(event, 'email', 'sent', to.email, subject, '', bookingCode)
          } catch (err) {
            await log(event, 'email', 'failed', to.email, subject, (err as Error).message, bookingCode)
          }
        }
      }

      if (template.sms && to.phone) {
        const sms = smsFrom(config, stored)
        if (!sms) {
          await log(event, 'sms', 'skipped', to.phone, subject, 'No SMS gateway is set up yet.', bookingCode)
        } else {
          try {
            await sendSms(sms, to.phone, fillTemplate(template.smsText, values))
            await log(event, 'sms', 'sent', to.phone, subject, '', bookingCode)
          } catch (err) {
            await log(event, 'sms', 'failed', to.phone, subject, (err as Error).message, bookingCode)
          }
        }
      }
    } catch (err) {
      console.error('[notify] could not send', event, err)
    }
  },

  /** Sends one message to the admin who asked, so they can check the setup before going live. */
  async test(to: Recipient, channel: 'email' | 'sms') {
    const config = await settings()
    const stored = await credentials()
    const text = `This is a test message from ${config.fromName}. If you are reading it, notifications are working.`
    if (channel === 'email') {
      const smtp = smtpFrom(stored)
      if (!smtp) throw new AppError(400, 'Add the mail server details and save before sending a test.')
      if (!to.email) throw new AppError(400, 'Your account has no email address to send the test to.')
      if (!config.fromEmail) throw new AppError(400, 'Set the “from” address before sending a test.')
      await sendEmail(smtp, { fromName: config.fromName, fromEmail: config.fromEmail, to: to.email, subject: `${config.fromName}: test message`, text })
      await log('booking.confirmed', 'email', 'sent', to.email, 'Test message', 'Sent by hand from Settings', null)
      return { sentTo: to.email }
    }
    const sms = smsFrom(config, stored)
    if (!sms) throw new AppError(400, 'Choose an SMS gateway and add its key before sending a test.')
    if (!to.phone) throw new AppError(400, 'Your account has no phone number to send the test to.')
    await sendSms(sms, to.phone, text)
    await log('booking.confirmed', 'sms', 'sent', to.phone, 'Test message', 'Sent by hand from Settings', null)
    return { sentTo: to.phone }
  },

  /** What the control centre shows on the Notifications screen, with secrets replaced by a hint. */
  async view() {
    const [config, stored] = await Promise.all([settings(), credentials()])
    return {
      ...config,
      encryptionReady,
      smtpHost: stored.smtpHost ?? '',
      smtpPort: stored.smtpPort ?? 587,
      smtpUser: stored.smtpUser ?? '',
      smtpSecure: stored.smtpSecure ?? false,
      smtpPassSet: !!stored.smtpPassEnc,
      smsKeySet: !!stored.smsKeyEnc,
      events: NOTIFICATION_EVENTS,
    }
  },

  /** The wording and which events are on. Secrets go through saveCredentials instead. */
  async saveSettings(admin: Me, body: Record<string, unknown>) {
    const raw = body as Partial<NotificationSettings>
    const fields: Record<string, string> = {}
    const fromEmail = str(raw.fromEmail)
    if (fromEmail && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(fromEmail)) fields.fromEmail = 'That doesn’t look like an email address.'
    const replyTo = str(raw.replyTo)
    if (replyTo && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(replyTo)) fields.replyTo = 'That doesn’t look like an email address.'
    const email = raw.email === 'smtp' ? 'smtp' : 'none'
    const sms = raw.sms === 'msg91' || raw.sms === 'twilio' ? raw.sms : 'none'
    const senderId = str(raw.smsSenderId).toUpperCase()
    if (sms === 'msg91' && senderId && !/^[A-Z]{6}$/.test(senderId)) {
      fields.smsSenderId = 'Indian gateways want exactly six letters, e.g. MERIDN.'
    }

    const templates = {} as NotificationSettings['templates']
    for (const { event } of NOTIFICATION_EVENTS) {
      const fallback = defaultNotifications.templates[event]
      const t = ((raw.templates ?? {}) as Record<string, Partial<MessageTemplate>>)[event] ?? {}
      const subject = str(t.subject ?? fallback.subject).slice(0, 200)
      const bodyText = str(t.body ?? fallback.body).slice(0, 4000)
      const smsText = str(t.smsText ?? fallback.smsText).slice(0, 320)
      if (t.email !== false && !subject) fields[`${event}.subject`] = 'An email needs a subject line.'
      if (t.email !== false && !bodyText) fields[`${event}.body`] = 'An email needs something to say.'
      if (t.sms && !smsText) fields[`${event}.smsText`] = 'A text message needs something to say.'
      templates[event] = {
        enabled: t.enabled !== false,
        email: t.email !== false,
        sms: !!t.sms,
        subject, body: bodyText, smsText,
      }
    }
    collect(fields)

    const saved: NotificationSettings = {
      fromName: str(raw.fromName).slice(0, 60) || defaultNotifications.fromName,
      fromEmail, replyTo, email, sms, smsSenderId: senderId, templates,
    }
    await contentRepo.saveSetting('notifications', saved, admin.id)
    await auditLogRepo.record(admin, 'settings.update', 'settings', 'notifications', { email, sms })
    return saved
  },

  /** Blank secrets keep whatever is already saved, the same as the Razorpay screen. */
  async saveCredentials(input: { smtpHost: string; smtpPort: number; smtpUser: string; smtpPass?: string; smtpSecure: boolean; smsKey?: string; smsSecret?: string }) {
    const patch: StoredCredentials = {
      smtpHost: input.smtpHost.trim(),
      smtpPort: Number(input.smtpPort) || 587,
      smtpUser: input.smtpUser.trim(),
      smtpSecure: !!input.smtpSecure,
    }
    if (input.smtpPass) patch.smtpPassEnc = encryptSecret(input.smtpPass)
    if (input.smsKey) patch.smsKeyEnc = encryptSecret(input.smsKey)
    if (input.smsSecret) patch.smsSecretEnc = encryptSecret(input.smsSecret)
    await col(C.secrets).doc(SECRET_DOC).set(patch, { merge: true })
  },
}

async function log(
  event: NotificationEvent, channel: 'email' | 'sms', status: 'sent' | 'failed' | 'skipped',
  to: string, subject: string, detail: string, bookingCode: string | null,
) {
  // Shortened so the log doesn't become a copy of everyone's contact details.
  const masked = to.includes('@') ? to.replace(/^(.).*(@.*)$/, '$1•••$2') : to.replace(/\d(?=\d{4})/g, '•')
  await notificationsRepo.record({ event, channel, status, to: masked, subject, detail: detail.slice(0, 300), bookingCode })
  await notificationsRepo.trim().catch(() => {})
}
