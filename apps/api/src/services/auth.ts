import type { Me } from '@meridian/shared'
import { auth } from '../store/firebase'
import { contentRepo, toMe, usersRepo, type UserDoc } from '../repositories'
import { nowISO } from '../store/db'
import { AppError } from '../http/errors'
import { checkLength, checkPhone, collect } from '../http/validate'

// Sign-in with Firebase (Google or phone OTP) and Meridian Stay sessions.

/** Where the person is signing in. Guests and hosts share one login page; the control centre has its own. */
export type Portal = 'guest' | 'host' | 'admin'

/** Firebase session cookies can last at most 14 days. */
export const SESSION_MS = 14 * 86_400_000

const providerSetting = { 'google.com': 'google', phone: 'phone' } as const

export interface SignedInUser { me: Me; uid: string }

export const authService = {
  /**
   * Exchanges a fresh Firebase ID token for a session cookie.
   * Creates the account on first sign-in (as a guest) and applies the portal's rules.
   */
  async signIn(idToken: string, portal: Portal) {
    let decoded
    try {
      decoded = await auth.verifyIdToken(idToken)
    } catch {
      throw new AppError(401, 'Your sign-in expired. Please try again.')
    }
    const provider = decoded.firebase?.sign_in_provider as keyof typeof providerSetting
    if (!(provider in providerSetting)) throw new AppError(403, 'Please sign in with Google or your phone number.')

    // Admins can always sign in, so turning a method off can't lock the team out.
    if (portal !== 'admin') {
      const { signIn } = await contentRepo.settings()
      if (!signIn[providerSetting[provider]]) throw new AppError(403, 'That sign-in method is currently turned off.')
    }

    const user = await usersRepo.upsertFromSignIn({
      uid: decoded.uid,
      name: (decoded.name as string | undefined) ?? null,
      email: decoded.email ?? null,
      phone: decoded.phone_number ?? null,
      avatarUrl: decoded.picture ?? null,
    })
    if (user.suspendedAt) throw new AppError(403, 'This account has been suspended. Contact us if you think this is a mistake.')
    if (portal === 'admin' && user.role !== 'admin') throw new AppError(403, 'This account doesn’t have access to the control center.')

    const cookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_MS })
    return { user: toMe(user), cookie, expires: new Date(Date.now() + SESSION_MS) }
  },

  /** The signed-in user for a session cookie, or null if invalid, signed out or suspended. */
  async userForCookie(cookie: string): Promise<SignedInUser | null> {
    try {
      const decoded = await auth.verifySessionCookie(cookie)
      const user = await usersRepo.findByUid(decoded.uid)
      if (!user || user.suspendedAt) return null
      if (user.sessionsRevokedAt && decoded.iat * 1000 < Date.parse(user.sessionsRevokedAt)) return null
      return { me: toMe(user), uid: user.uid }
    } catch {
      return null
    }
  },

  /** Signs the user out on every device. */
  async signOutEverywhere(uid: string) {
    await usersRepo.update(uid, { sessionsRevokedAt: nowISO() })
    await auth.revokeRefreshTokens(uid).catch(() => {})
  },

  async updateProfile(uid: string, name: string, phone: string) {
    collect({ name: checkLength(name, 'Name', 1, 80), phone: phone ? checkPhone(phone) : null })
    return toMe(await usersRepo.update(uid, { name, phone: phone || null }))
  },
}

export type { UserDoc }
