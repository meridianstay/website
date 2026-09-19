import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { emulated } from './firebase'
import { AppError } from '../http/errors'

// Encrypts secrets the admin enters (Razorpay key secret, webhook secret) before they're stored in Firestore.
// The master key lives only in the hosting environment (SETTINGS_ENCRYPTION_KEY), so a copy of the
// database alone can't reveal them. Local development uses a fixed development key.

const master = process.env.SETTINGS_ENCRYPTION_KEY ?? (emulated ? 'meridian-local-development-only' : '')
const key = master ? createHash('sha256').update(master).digest() : null

export const encryptionReady = !!key

export function encryptSecret(plain: string): string {
  if (!key) throw new AppError(503, 'Add SETTINGS_ENCRYPTION_KEY in Vercel before saving payment keys.')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':')
}

export function decryptSecret(stored: string): string {
  if (!key) throw new AppError(503, 'SETTINGS_ENCRYPTION_KEY is missing, so saved payment keys can’t be read.')
  const [version, iv, tag, data] = stored.split(':')
  if (version !== 'v1') throw new Error('Unknown secret format')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  try {
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    throw new AppError(503, 'Saved payment keys can’t be read: SETTINGS_ENCRYPTION_KEY has changed. Enter the Razorpay keys again in Settings.')
  }
}
