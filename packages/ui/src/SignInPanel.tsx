import { useEffect, useRef, useState } from 'react'
import { GoogleAuthProvider, RecaptchaVerifier, signInWithPhoneNumber, signInWithPopup, signOut, type ConfirmationResult, type User } from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { defaultSiteSettings, type Me, type SignInPortal, type SignInSettings } from '@meridian/shared'
import { ApiError, api } from '@meridian/shared/client'
import { emulatorCodeFor, firebaseAuth, usingEmulator } from './firebase'
import { useAuth } from './auth'

/** Demo accounts use Firebase test phone numbers (code 123456) — see docs/deployment.md. */
const DEMO_NUMBERS: Record<SignInPortal, [label: string, phone: string][]> = {
  guest: [['Guest · Priya', '9000000011'], ['Guest · Siddharth', '9000000012']],
  host: [['Host · Meera', '9000000003'], ['Host · Farhan (rejected listing)', '9000000007']],
  admin: [['Admin · Aarav', '9000000001']],
}
const showDemo = usingEmulator || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true'

const FIREBASE_MESSAGES: Record<string, string | null> = {
  'auth/invalid-phone-number': 'Enter a valid mobile number, e.g. 98765 43210.',
  'auth/missing-phone-number': 'Enter your mobile number.',
  'auth/invalid-verification-code': 'That code isn’t right. Check the SMS and try again.',
  'auth/code-expired': 'That code has expired. Send a new one.',
  'auth/user-disabled': 'This account has been suspended. Contact us if you think this is a mistake.',
  'auth/too-many-requests': 'Too many attempts. Please wait a few minutes and try again.',
  'auth/popup-blocked': 'Your browser blocked the Google window. Allow pop-ups for this site and try again.',
  'auth/operation-not-allowed': 'This sign-in method isn’t switched on in Firebase yet (Authentication → Sign-in method).',
  'auth/unauthorized-domain': 'This website address isn’t authorised in Firebase yet (Authentication → Settings → Authorized domains).',
  'auth/popup-closed-by-user': null,
  'auth/cancelled-popup-request': null,
}

function describe(err: unknown): string | null {
  if (import.meta.env.DEV) console.error('[sign-in]', err)
  if (err instanceof ApiError) return err.message
  if (err instanceof FirebaseError) {
    // Firebase uses the same code when SMS to a country is blocked by the project's SMS region policy.
    if (err.code === 'auth/operation-not-allowed' && /region/i.test(err.message)) {
      return 'Text messages to this country aren’t enabled yet (Firebase → Authentication → Settings → SMS region policy).'
    }
    if (err.code === 'auth/billing-not-enabled') return 'Phone sign-in needs the Firebase project on the Blaze plan.'
    return err.code in FIREBASE_MESSAGES ? FIREBASE_MESSAGES[err.code] : 'Sign-in didn’t work. Please try again.'
  }
  return 'Sign-in didn’t work. Please try again.'
}

/** "98765 43210" → "+919876543210"; numbers already starting with + are kept. */
const toE164 = (raw: string) => {
  const digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.length === 10) return `+91${digits}`
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
  return digits
}

interface Props {
  portal: SignInPortal
  /** Called once signed in (and named). */
  onSignedIn: (user: Me) => void
}

type Step = 'choose' | 'code' | 'name'

/** Google and phone-OTP sign-in, shared by the guest, host and admin login pages. */
export function SignInPanel({ portal, onSignedIn }: Props) {
  const { setUser } = useAuth()
  const [methods, setMethods] = useState<SignInSettings>(defaultSiteSettings.signIn)
  const [step, setStep] = useState<Step>('choose')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<'google' | 'phone' | 'code' | 'name' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const confirmation = useRef<ConfirmationResult | null>(null)
  const verifier = useRef<RecaptchaVerifier | null>(null)
  const signedIn = useRef<Me | null>(null)

  useEffect(() => {
    // The admin login always offers both methods so the team can't be locked out.
    if (portal !== 'admin') api.site().then((s) => setMethods(s.signIn)).catch(() => {})
    return () => verifier.current?.clear()
  }, [portal])

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(describe(err))
    } finally {
      setBusy(null)
    }
  }

  /** Hands the Firebase sign-in to our API, which sets the session cookie. */
  const finish = async (firebaseUser: User) => {
    const idToken = await firebaseUser.getIdToken()
    try {
      const { user } = await api.session(idToken, portal)
      setUser(user)
      if (!user.name) {
        signedIn.current = user
        setStep('name')
      } else onSignedIn(user)
    } finally {
      // The API session cookie is what keeps people signed in; the browser's Firebase session isn't needed.
      await signOut(firebaseAuth).catch(() => {})
    }
  }

  const google = () => run('google', async () => {
    const result = await signInWithPopup(firebaseAuth, new GoogleAuthProvider())
    await finish(result.user)
  })

  const sendCode = (e: React.FormEvent) => {
    e.preventDefault()
    run('phone', async () => {
      verifier.current ??= new RecaptchaVerifier(firebaseAuth, 'ms-recaptcha', { size: 'invisible' })
      confirmation.current = await signInWithPhoneNumber(firebaseAuth, toE164(phone), verifier.current)
      setCode('')
      setStep('code')
    })
  }

  const verifyCode = (e: React.FormEvent) => {
    e.preventDefault()
    run('code', async () => {
      const result = await confirmation.current!.confirm(code.trim())
      await finish(result.user)
    })
  }

  const saveName = (e: React.FormEvent) => {
    e.preventDefault()
    run('name', async () => {
      const { user } = await api.updateMe({ name: name.trim(), phone: signedIn.current?.phone ?? '' })
      setUser(user)
      onSignedIn(user)
    })
  }

  const input = 'w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500'
  const primary = 'w-full bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white font-bold py-3.5 rounded-2xl text-sm shadow-lg shadow-brand-500/20 transition'
  const noMethods = portal !== 'admin' && !methods.google && !methods.phone

  return (
    <div className="space-y-4">
      {step === 'choose' && (
        <>
          {noMethods && <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3">Sign-in is temporarily unavailable. Please try again later.</p>}
          {(portal === 'admin' || methods.google) && (
            <button type="button" onClick={google} disabled={!!busy} className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-800 font-semibold py-3 rounded-2xl text-sm transition">
              <GoogleMark />
              {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
            </button>
          )}
          {(portal === 'admin' || methods.google) && (portal === 'admin' || methods.phone) && (
            <div className="flex items-center gap-3 text-xs text-slate-400"><span className="flex-1 h-px bg-slate-200" />or<span className="flex-1 h-px bg-slate-200" /></div>
          )}
          {(portal === 'admin' || methods.phone) && (
            <form onSubmit={sendCode} className="space-y-3" noValidate>
              <label htmlFor="ms-phone" className="block text-xs font-bold uppercase text-slate-500">Mobile number</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-2xl border border-r-0 border-slate-200 bg-slate-100 text-sm text-slate-600">+91</span>
                <input id="ms-phone" type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="98765 43210" className={`${input} rounded-l-none`} />
              </div>
              <button type="submit" disabled={!!busy || phone.replace(/\D/g, '').length < 8} className={primary}>
                {busy === 'phone' ? 'Sending code…' : 'Send code'}
              </button>
              <p className="text-xs text-slate-400">We’ll text you a 6-digit code. Standard SMS rates may apply.</p>
            </form>
          )}
        </>
      )}

      {step === 'code' && (
        <form onSubmit={verifyCode} className="space-y-3" noValidate>
          <p className="text-sm text-slate-600">Enter the 6-digit code sent to <span className="font-semibold text-slate-900">{toE164(phone)}</span>.</p>
          <label htmlFor="ms-code" className="sr-only">Verification code</label>
          <input id="ms-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456" className={`${input} text-center text-2xl tracking-[0.5em] font-mono`} autoFocus />
          <button type="submit" disabled={!!busy || code.length !== 6} className={primary}>{busy === 'code' ? 'Checking…' : 'Verify and continue'}</button>
          <div className="flex justify-between text-xs font-bold">
            <button type="button" onClick={() => { setStep('choose'); setError(null) }} className="text-slate-600 hover:underline">Change number</button>
            {usingEmulator && (
              <button type="button" onClick={async () => setCode((await emulatorCodeFor(toE164(phone))) ?? '')} className="text-brand-700 hover:underline">
                Fill code from emulator
              </button>
            )}
          </div>
        </form>
      )}

      {step === 'name' && (
        <form onSubmit={saveName} className="space-y-3" noValidate>
          <p className="text-sm text-slate-600">Welcome! What should we call you?</p>
          <label htmlFor="ms-name" className="sr-only">Full name</label>
          <input id="ms-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className={input} autoFocus />
          <button type="submit" disabled={!!busy || !name.trim()} className={primary}>{busy === 'name' ? 'Saving…' : 'Continue'}</button>
        </form>
      )}

      {error && <p role="alert" className="text-sm text-rose-600 font-semibold animate-fade-in">{error}</p>}
      <div id="ms-recaptcha" />

      {showDemo && step === 'choose' && (portal === 'admin' || methods.phone) && (
        <div className="pt-4 border-t border-dashed border-slate-200 text-xs text-slate-500">
          <p className="font-bold uppercase text-slate-400 mb-2">Demo accounts {usingEmulator ? '(local emulator)' : '(code 123456)'}</p>
          <ul className="space-y-1">
            {DEMO_NUMBERS[portal].map(([label, number]) => (
              <li key={number}><button type="button" onClick={() => setPhone(number)} className="underline hover:text-slate-900">{label}: {number}</button></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Google's "G" mark, as required on Google sign-in buttons. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
