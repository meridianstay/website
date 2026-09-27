import { api } from '@meridian/shared/client'

// Asking for permission to send notifications, and telling the API which browser said yes.
// We never ask on arrival: a prompt before someone knows what the site is gets refused for good,
// and a refusal can only be undone in browser settings.

const ASKED_KEY = 'meridian.push.asked'

const urlBase64ToUint8Array = (base64: string) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

const installed = () =>
  window.matchMedia('(display-mode: standalone)').matches
  || (window.navigator as { standalone?: boolean }).standalone === true

/** Whether it is worth showing our own "keep in touch" prompt at all. */
export function canAskForPush(): boolean {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false
  if (Notification.permission !== 'default') return false
  try {
    return !localStorage.getItem(ASKED_KEY)
  } catch {
    return true
  }
}

/** Asks the browser, then registers the subscription. Returns whether it worked. */
export async function subscribeToPush(): Promise<boolean> {
  try {
    localStorage.setItem(ASKED_KEY, String(Date.now()))
  } catch {
    // Not remembering that we asked is harmless; the browser refuses a second prompt anyway.
  }
  try {
    const { publicKey } = await api.pushKey()
    if (!publicKey) return false

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    const subscription = existing ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })

    await api.subscribePush(subscription.toJSON(), installed(), document.documentElement.lang || 'en')
    return true
  } catch {
    return false
  }
}

/** Keeps the stored subscription current — the browser can rotate it at any time. */
export async function refreshPushSubscription(): Promise<void> {
  try {
    if (Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) await api.subscribePush(subscription.toJSON(), installed(), document.documentElement.lang || 'en')
  } catch {
    // The site works perfectly well without push.
  }
}
