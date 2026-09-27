import { createECDH, createHmac, createSign, createCipheriv, randomBytes, generateKeyPairSync, createPublicKey } from 'node:crypto'

// Web push, spoken directly. A push notification is a message encrypted so that only the browser
// that subscribed can read it (RFC 8291), delivered to whichever push service that browser uses,
// with a signed token proving it came from us (RFC 8292). Both are done here with Node's own
// crypto, so the API keeps no dependency for it.

export interface PushSubscription {
  endpoint: string
  /** The browser's public key, base64url. */
  p256dh: string
  /** A shared secret the browser generated, base64url. */
  auth: string
}

export interface VapidKeys {
  publicKey: string
  privateKey: string
}

const b64url = (b: Buffer) => b.toString('base64url')
const fromB64url = (s: string) => Buffer.from(s, 'base64url')

/** A fresh application key pair. The public half goes to browsers; the private half stays here. */
export function generateVapidKeys(): VapidKeys {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return {
    publicKey: b64url(ecdh.getPublicKey()),
    privateKey: b64url(ecdh.getPrivateKey()),
  }
}

/** HKDF, which both the encryption and the key derivation below are built from. */
function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, length: number): Buffer {
  const prk = createHmac('sha256', salt).update(ikm).digest()
  const output = createHmac('sha256', prk).update(Buffer.concat([info, Buffer.from([1])])).digest()
  return output.subarray(0, length)
}

/**
 * The signed token that proves the message is from us. Push services check it against the public
 * key the browser subscribed with.
 */
function vapidHeader(endpoint: string, keys: VapidKeys, subject: string): string {
  const audience = new URL(endpoint).origin
  const header = b64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64url(Buffer.from(JSON.stringify({
    aud: audience,
    // Twelve hours: long enough for a retry, short enough that a leaked token expires.
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  })))

  // Node signs with a PEM key, so the raw private scalar is wrapped into one.
  const ecdh = createECDH('prime256v1')
  ecdh.setPrivateKey(fromB64url(keys.privateKey))
  const pem = privateKeyPem(fromB64url(keys.privateKey), ecdh.getPublicKey())
  const der = createSign('SHA256').update(`${header}.${claims}`).sign(pem)
  return `${header}.${claims}.${b64url(derToRaw(der))}`
}

/** Wraps a raw P-256 private scalar in the DER structure Node's signer expects. */
function privateKeyPem(privateKey: Buffer, publicKey: Buffer): string {
  const der = Buffer.concat([
    Buffer.from('308187020100301306072a8648ce3d020106082a8648ce3d030107046d306b0201010420', 'hex'),
    privateKey,
    Buffer.from('a144034200', 'hex'),
    publicKey,
  ])
  return `-----BEGIN PRIVATE KEY-----\n${der.toString('base64').match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n`
}

/** ECDSA signatures come back as DER; JWT wants the two numbers side by side. */
function derToRaw(der: Buffer): Buffer {
  let offset = 3
  if (der[offset] === 0x00) offset++
  const rLength = der[offset - 1] === 0x00 ? der[2] - 1 : der[2]
  const r = der.subarray(offset, offset + rLength)
  offset += rLength + 2
  if (der[offset] === 0x00) offset++
  const s = der.subarray(offset)
  const out = Buffer.alloc(64)
  r.copy(out, 32 - r.length)
  s.copy(out, 64 - s.length)
  return out
}

/**
 * Encrypts the message for one subscriber, as aes128gcm. Only the browser holding the private half
 * of `p256dh` can read the result — the push service in between cannot.
 */
export function encrypt(subscription: PushSubscription, payload: string): Buffer {
  const clientPublic = fromB64url(subscription.p256dh)
  const authSecret = fromB64url(subscription.auth)

  // A one-off key pair for this message, so the same text never encrypts the same way twice.
  const local = createECDH('prime256v1')
  local.generateKeys()
  const shared = local.computeSecret(clientPublic)
  const salt = randomBytes(16)

  const prkInfo = Buffer.concat([
    Buffer.from('WebPush: info\0'),
    clientPublic,
    local.getPublicKey(),
  ])
  const ikm = hkdf(authSecret, shared, prkInfo, 32)
  const contentKey = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16)
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12)

  const cipher = createCipheriv('aes-128-gcm', contentKey, nonce)
  // A single record, so the padding delimiter is 2 and nothing follows.
  const body = Buffer.concat([Buffer.from(payload, 'utf8'), Buffer.from([2])])
  const encrypted = Buffer.concat([cipher.update(body), cipher.final(), cipher.getAuthTag()])

  const header = Buffer.alloc(21)
  salt.copy(header, 0)
  header.writeUInt32BE(4096, 16)
  header.writeUInt8(local.getPublicKey().length, 20)

  return Buffer.concat([header, local.getPublicKey(), encrypted])
}

export interface PushResult {
  ok: boolean
  /** 404 and 410 mean the browser is gone for good and the subscription should be deleted. */
  gone: boolean
  status: number
  detail: string
}

/** Sends one notification. Never throws: a dead subscription is an ordinary outcome. */
export async function sendPush(subscription: PushSubscription, payload: string, keys: VapidKeys, subject: string): Promise<PushResult> {
  try {
    const body = encrypt(subscription, payload)
    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${vapidHeader(subscription.endpoint, keys, subject)}, k=${keys.publicKey}`,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
        Urgency: 'normal',
      },
      body: new Uint8Array(body),
    })
    return {
      ok: res.ok,
      gone: res.status === 404 || res.status === 410,
      status: res.status,
      detail: res.ok ? '' : (await res.text()).slice(0, 200),
    }
  } catch (err) {
    return { ok: false, gone: false, status: 0, detail: (err as Error).message }
  }
}

/** Only used by the tests, to prove a message we encrypt can actually be read back. */
export function testKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const raw = createPublicKey(publicKey).export({ type: 'spki', format: 'der' })
  return { privateKey, publicKey: Buffer.from(raw.subarray(raw.length - 65)) }
}
