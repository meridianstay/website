import { AppError } from './errors'

// Small input validators. Each check returns an error message or null.

export class ValidationError extends AppError {
  constructor(fields: Record<string, string>) {
    super(400, Object.values(fields)[0] ?? 'Please check the highlighted fields.', fields)
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Throws a ValidationError listing every failed check. */
export function collect(checks: Record<string, string | null>) {
  const fields = Object.fromEntries(Object.entries(checks).filter(([, v]) => v !== null)) as Record<string, string>
  if (Object.keys(fields).length) throw new ValidationError(fields)
}

export const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export const checkEmail = (v: string) => (EMAIL.test(v) ? null : 'Enter a valid email address.')
export const checkLength = (v: string, label: string, min: number, max: number) =>
  v.length < min ? `${label} must be at least ${min} characters.` : v.length > max ? `${label} must be at most ${max} characters.` : null
export const checkPhone = (v: string) => (/^\+?[\d\s-]{8,20}$/.test(v) ? null : 'Enter a valid phone number, e.g. +91 98765 43210.')

/** Postgres error code for an exclusion-constraint violation (overlapping date ranges). */
export const PG_EXCLUSION_VIOLATION = '23P01'
export const isPgError = (err: unknown, code: string) => (err as { code?: string })?.code === code
