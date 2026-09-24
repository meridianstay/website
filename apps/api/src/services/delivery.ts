import { createHmac } from 'node:crypto'
import { connect } from 'node:net'
import { connect as tlsConnect, type TLSSocket } from 'node:tls'
import { AppError } from '../http/errors'

// Sending the actual email and SMS. Email goes over plain SMTP, which every Indian host — Zoho,
// Google Workspace, a cPanel mailbox — can give you; SMS goes over MSG91 or Twilio's HTTP APIs.
// Both are spoken directly, so the API keeps no mail dependency and starts as fast as it did.

export interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
  /** True for port 465 (TLS from the first byte); false means STARTTLS, which is what 587 uses. */
  secure: boolean
  /** The name we introduce ourselves with; some servers check it looks like a host. */
  fromHost?: string
}

export interface EmailMessage {
  fromName: string
  fromEmail: string
  replyTo?: string
  to: string
  subject: string
  /** Plain text. Blank lines are paragraphs. */
  text: string
}

/** One SMTP conversation, kept deliberately small: connect, authenticate, send, quit. */
class SmtpSession {
  private socket: TLSSocket | ReturnType<typeof connect>
  private buffer = ''
  private waiting: { resolve: (line: string) => void; reject: (err: Error) => void } | null = null

  constructor(socket: TLSSocket | ReturnType<typeof connect>) {
    this.socket = socket
    socket.setEncoding('utf8')
    socket.on('data', (chunk: string) => {
      this.buffer += chunk
      // A reply ends with "250 text\r\n"; "250-text" means more lines follow.
      const match = /^\d{3} [^\r\n]*\r\n/m.exec(this.buffer.split(/(?<=\r\n)/).slice(-1)[0] ?? '')
      if (!match || !this.waiting) return
      const reply = this.buffer
      this.buffer = ''
      const waiting = this.waiting
      this.waiting = null
      waiting.resolve(reply)
    })
    socket.on('error', (err: Error) => {
      this.waiting?.reject(err)
      this.waiting = null
    })
  }

  /** Sends a command (when given) and waits for the reply, checking it starts with `expect`. */
  say(command: string | null, expect: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('The mail server stopped responding.')), 20_000)
      this.waiting = {
        resolve: (reply) => {
          clearTimeout(timer)
          if (!reply.trimStart().startsWith(expect)) {
            reject(new Error(`The mail server said: ${reply.trim().split('\r\n')[0]}`))
          } else resolve(reply)
        },
        reject: (err) => { clearTimeout(timer); reject(err) },
      }
      if (command !== null) this.socket.write(`${command}\r\n`)
    })
  }

  upgrade(host: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const plain = this.socket as ReturnType<typeof connect>
      plain.removeAllListeners('data')
      const secure = tlsConnect({ socket: plain, servername: host }, () => {
        this.socket = secure
        this.buffer = ''
        secure.setEncoding('utf8')
        secure.on('data', (chunk: string) => {
          this.buffer += chunk
          if (/^\d{3} [^\r\n]*\r\n/m.test(this.buffer.split(/(?<=\r\n)/).slice(-1)[0] ?? '') && this.waiting) {
            const reply = this.buffer
            this.buffer = ''
            const waiting = this.waiting
            this.waiting = null
            waiting.resolve(reply)
          }
        })
        secure.on('error', (err) => { this.waiting?.reject(err); this.waiting = null })
        resolve()
      })
      secure.on('error', reject)
    })
  }

  end() {
    try {
      this.socket.write('QUIT\r\n')
      this.socket.end()
    } catch {
      // Already gone; nothing to clean up.
    }
  }
}

/** Escapes a line so a lone "." can't end the message early, as SMTP requires. */
const dotStuff = (text: string) => text.split('\n').map((l) => (l.startsWith('.') ? `.${l}` : l)).join('\r\n')

const encodeHeader = (value: string) =>
  // Anything outside ASCII has to be encoded, which matters for Hindi subjects.
  /^[\x20-\x7E]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`

export async function sendEmail(cfg: SmtpConfig, message: EmailMessage): Promise<void> {
  const socket = cfg.secure
    ? tlsConnect({ host: cfg.host, port: cfg.port, servername: cfg.host })
    : connect({ host: cfg.host, port: cfg.port })
  const session = new SmtpSession(socket)
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once('connect' in socket ? 'connect' : 'secureConnect', () => resolve())
      socket.once('error', reject)
      setTimeout(() => reject(new Error('Could not reach the mail server.')), 20_000)
    }).catch((err) => { throw new AppError(502, `Could not reach ${cfg.host}:${cfg.port}. ${(err as Error).message}`) })

    await session.say(null, '220')
    await session.say(`EHLO ${cfg.fromHost ?? 'meridianstay.com'}`, '250')
    if (!cfg.secure) {
      await session.say('STARTTLS', '220')
      await session.upgrade(cfg.host)
      await session.say(`EHLO ${cfg.fromHost ?? 'meridianstay.com'}`, '250')
    }
    await session.say('AUTH LOGIN', '334')
    await session.say(Buffer.from(cfg.user, 'utf8').toString('base64'), '334')
    await session.say(Buffer.from(cfg.pass, 'utf8').toString('base64'), '235')
    await session.say(`MAIL FROM:<${message.fromEmail}>`, '250')
    await session.say(`RCPT TO:<${message.to}>`, '250')
    await session.say('DATA', '354')

    const headers = [
      `From: ${encodeHeader(message.fromName)} <${message.fromEmail}>`,
      `To: <${message.to}>`,
      message.replyTo ? `Reply-To: <${message.replyTo}>` : '',
      `Subject: ${encodeHeader(message.subject)}`,
      `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
    ].filter(Boolean).join('\r\n')

    await session.say(`${headers}\r\n\r\n${dotStuff(message.text)}\r\n.`, '250')
  } finally {
    session.end()
  }
}

export interface SmsConfig {
  provider: 'msg91' | 'twilio'
  /** MSG91: the auth key. Twilio: the account SID. */
  key: string
  /** MSG91: the flow or template id. Twilio: the auth token. */
  secret: string
  /** MSG91: the six-character sender id. Twilio: the sending number. */
  sender: string
}

/** An Indian mobile number in the form gateways expect: 10 digits, no plus, no spaces. */
export function indianMobile(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  const local = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits
  return /^[6-9]\d{9}$/.test(local) ? local : null
}

export async function sendSms(cfg: SmsConfig, to: string, text: string): Promise<void> {
  const number = indianMobile(to)
  if (!number) throw new AppError(400, `${to} doesn’t look like an Indian mobile number.`)

  if (cfg.provider === 'msg91') {
    const res = await fetch('https://control.msg91.com/api/v2/sendsms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authkey: cfg.key },
      body: JSON.stringify({ sender: cfg.sender, route: '4', country: '91', sms: [{ message: text, to: [number] }] }),
    })
    const body = await res.text()
    if (!res.ok || /error/i.test(body)) throw new AppError(502, `MSG91 refused the message: ${body.slice(0, 200)}`)
    return
  }

  const auth = Buffer.from(`${cfg.key}:${cfg.secret}`, 'utf8').toString('base64')
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.key)}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: cfg.sender, To: `+91${number}`, Body: text }),
  })
  if (!res.ok) throw new AppError(502, `Twilio refused the message: ${(await res.text()).slice(0, 200)}`)
}

/** Used by the webhook check, kept here so the crypto import has one home. */
export const signBody = (secret: string, body: string) => createHmac('sha256', secret).update(body).digest('hex')
