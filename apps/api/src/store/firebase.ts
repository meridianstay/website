import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

// One Firebase connection for the whole API.
//   Development: the local emulators (FIRESTORE_EMULATOR_HOST etc., set by `npm run dev`).
//   Production:  the client's project, via FIREBASE_SERVICE_ACCOUNT (the service-account JSON).

function readServiceAccount(): (ServiceAccount & { project_id?: string }) | null {
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim()
  if (!raw) return null
  // Tolerate the value being wrapped in quotes when pasted into a dashboard.
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"') && !raw.startsWith('"{'))) raw = raw.slice(1, -1)
  // Accept the JSON itself or a base64-encoded copy (some dashboards mangle newlines).
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  let parsed: Record<string, string>
  try {
    parsed = JSON.parse(json)
  } catch {
    // Never include the value in errors: it's a secret.
    throw new Error('FIREBASE_SERVICE_ACCOUNT isn’t valid JSON. Paste the whole service-account file, starting with { and ending with }.')
  }
  const missing = ['project_id', 'client_email', 'private_key'].filter((k) => !parsed[k])
  if (missing.length) throw new Error(`FIREBASE_SERVICE_ACCOUNT is missing ${missing.join(', ')}. Use the key from Project settings → Service accounts.`)
  // Keys pasted with literal "\n" sequences need real line breaks.
  const privateKey = parsed.private_key.replace(/\\n/g, '\n')
  return { ...parsed, projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey }
}

const serviceAccount = readServiceAccount()
export const emulated = !!process.env.FIRESTORE_EMULATOR_HOST

export const firebaseMode: 'emulator' | 'live' | 'unconfigured' = emulated ? 'emulator' : serviceAccount ? 'live' : 'unconfigured'

export const projectId = serviceAccount?.project_id ?? process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? 'demo-meridianstay'

// New projects use <id>.firebasestorage.app; override with FIREBASE_STORAGE_BUCKET when different.
export const storageBucket = process.env.FIREBASE_STORAGE_BUCKET ?? (emulated ? `${projectId}.appspot.com` : `${projectId}.firebasestorage.app`)

const app =
  getApps()[0] ??
  initializeApp({ ...(serviceAccount ? { credential: cert(serviceAccount) } : {}), projectId, storageBucket })

export const firestore = getFirestore(app)
firestore.settings({ ignoreUndefinedProperties: true })
export const auth = getAuth(app)
export const bucket = getStorage(app).bucket()
