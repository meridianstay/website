// Meridian Stay service worker: makes the website installable as an app and shows a friendly page when offline.
// It deliberately caches nothing else, so people always get the latest version of every page, price and booking.
const CACHE = 'meridian-offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  // Only page loads get the offline fallback; everything else goes straight to the network.
  if (event.request.mode !== 'navigate') return
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)))
})

// ─── Push notifications ──────────────────────────────────────────────────────
// Offers and announcements sent from the control centre. The payload is already decrypted by the
// browser by the time it reaches here.

self.addEventListener('push', (event) => {
  if (!event.data) return
  let message = {}
  try {
    message = event.data.json()
  } catch {
    message = { title: 'Meridian Stay', body: event.data.text() }
  }
  event.waitUntil(self.registration.showNotification(message.title || 'Meridian Stay', {
    body: message.body || '',
    icon: message.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    image: message.image,
    data: { url: message.url || '/', campaignId: message.campaignId },
    tag: message.campaignId ? `campaign-${message.campaignId}` : undefined,
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/'
  const campaignId = event.notification.data?.campaignId
  event.waitUntil((async () => {
    if (campaignId) {
      // Tell the site it was opened, so the control centre can see what worked.
      await fetch(`/api/campaigns/${campaignId}/clicked`, { method: 'POST', keepalive: true }).catch(() => {})
    }
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    // Reuse a tab that is already open rather than piling up new ones.
    const open = windows.find((w) => new URL(w.url).origin === self.location.origin)
    if (open) {
      await open.focus()
      if ('navigate' in open) await open.navigate(target).catch(() => {})
    } else {
      await self.clients.openWindow(target)
    }
  })())
})
