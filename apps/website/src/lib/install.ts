import { useEffect, useState } from 'react'

// "Download app": installs the website as an app with its own home-screen icon (a Progressive Web App).
// Chrome, Edge and Samsung Internet (Android, Windows, macOS) offer a one-tap install prompt, which we capture here.
// iPhone and iPad have no prompt: people add it from Safari's Share menu, so we show them how.

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((fn) => fn())

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** iPhone, iPod, or an iPad (which reports itself as a Mac with a touch screen). */
export const isIOS = () =>
  !/android/i.test(navigator.userAgent) &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/** Instagram, Facebook and similar in-app browsers can't install apps. */
export const isInAppBrowser = () => /FBAN|FBAV|Instagram|Line\/|LinkedInApp|Snapchat|wv\)/i.test(navigator.userAgent)

/** Call once at start-up, before React renders: the browser may offer installation straight away. */
export function initInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    notify()
  })
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
  }
}

export type InstallResult = 'installed' | 'dismissed' | 'instructions'

export function useInstall() {
  const [, force] = useState(0)
  useEffect(() => {
    const fn = () => force((n) => n + 1)
    listeners.add(fn)
    return () => void listeners.delete(fn)
  }, [])

  return {
    /** Hide the button once the app is installed or we're already running as the app. */
    available: !installed && !isStandalone(),
    canPrompt: !!deferred,
    async install(): Promise<InstallResult> {
      if (!deferred) return 'instructions'
      const prompt = deferred
      await prompt.prompt()
      const { outcome } = await prompt.userChoice
      deferred = null
      notify()
      return outcome === 'accepted' ? 'installed' : 'dismissed'
    },
  }
}
