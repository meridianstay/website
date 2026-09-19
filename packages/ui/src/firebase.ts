import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'

// Browser-side Firebase, used only to sign in (Google or phone OTP). Everything else goes through the API.
// Production: set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID.
// Without them (local development) it uses the Auth emulator.
const env = import.meta.env

export const usingEmulator = !env.VITE_FIREBASE_API_KEY
export const firebaseProjectId: string = env.VITE_FIREBASE_PROJECT_ID ?? 'demo-meridianstay'

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'demo-api-key',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? `${firebaseProjectId}.firebaseapp.com`,
  projectId: firebaseProjectId,
  appId: env.VITE_FIREBASE_APP_ID,
})

export const firebaseAuth = getAuth(app)
firebaseAuth.useDeviceLanguage()

export const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099'
if (usingEmulator) {
  connectAuthEmulator(firebaseAuth, AUTH_EMULATOR_URL, { disableWarnings: true })
  // The emulator doesn't run reCAPTCHA; this flag is only honoured by emulators and test projects.
  firebaseAuth.settings.appVerificationDisabledForTesting = true
}

/** Development helper: the latest OTP the Auth emulator "sent" to a number. */
export async function emulatorCodeFor(phone: string): Promise<string | null> {
  const res = await fetch(`${AUTH_EMULATOR_URL}/emulator/v1/projects/${firebaseProjectId}/verificationCodes`)
  const { verificationCodes = [] } = (await res.json()) as { verificationCodes?: { phoneNumber: string; code: string }[] }
  return verificationCodes.filter((c) => c.phoneNumber === phone).at(-1)?.code ?? null
}
