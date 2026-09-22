import type { Dictionary } from '../i18n'
import en from './en'

// English ships with the app so there is always something to fall back to; the others are fetched
// only when someone actually picks them, which keeps the first page load small.

export const loaders: Record<string, () => Promise<{ default: Dictionary }>> = {
  hi: () => import('./hi'),
  bn: () => import('./bn'),
  mr: () => import('./mr'),
  te: () => import('./te'),
  ta: () => import('./ta'),
  gu: () => import('./gu'),
  kn: () => import('./kn'),
  ml: () => import('./ml'),
  pa: () => import('./pa'),
  or: () => import('./or'),
}

export { en }
export { starterContent, withStarterContent } from './content'
