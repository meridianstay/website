import { createHash, randomBytes } from 'node:crypto'
import type { Me } from '@meridian/shared'
import { hashPassword, verifyPassword } from '../lib/passwords'
import { sessionsRepo, usersRepo } from '../repositories'
import { AppError } from '../http/errors'
import { checkEmail, checkLength, checkPhone, collect } from '../http/validate'

// Accounts, passwords and sessions.

export const SESSION_DAYS = 30
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export const authService = {
  async signup(name: string, email: string, password: string): Promise<Me> {
    collect({
      name: checkLength(name, 'Name', 1, 80),
      email: checkEmail(email),
      password: checkLength(password, 'Password', 8, 200),
    })
    if (await usersRepo.emailExists(email)) {
      throw new AppError(409, 'An account with this email already exists. Log in instead.', { email: 'This email is already registered.' })
    }
    return usersRepo.create({ name, email, passwordHash: hashPassword(password) })
  },

  async login(email: string, password: string): Promise<Me> {
    const row = await usersRepo.findForLogin(email)
    if (!row || !verifyPassword(password, row.password_hash)) throw new AppError(401, 'That email and password don’t match an account.')
    if (row.suspended_at) throw new AppError(403, 'This account has been suspended. Contact us if you think this is a mistake.')
    return (await usersRepo.findById(row.id))!
  },

  /** Creates a session and returns the raw token for the cookie. */
  async startSession(userId: number) {
    const token = randomBytes(32).toString('base64url')
    const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000)
    await sessionsRepo.create(hashToken(token), userId, expires)
    return { token, expires }
  },

  userForToken(token: string) {
    return sessionsRepo.findUser(hashToken(token))
  },

  endSession(token: string) {
    return sessionsRepo.delete(hashToken(token))
  },

  updateProfile(userId: number, name: string, phone: string) {
    collect({ name: checkLength(name, 'Name', 1, 80), phone: phone ? checkPhone(phone) : null })
    return usersRepo.updateProfile(userId, { name, phone: phone || null })
  },

  async changePassword(userId: number, current: string, next: string) {
    const hash = await usersRepo.passwordHash(userId)
    collect({
      currentPassword: hash && verifyPassword(current, hash) ? null : 'Your current password isn’t right.',
      newPassword: checkLength(next, 'New password', 8, 200) ?? (next === current ? 'Choose a password you haven’t used here.' : null),
    })
    await usersRepo.setPasswordHash(userId, hashPassword(next))
  },
}
