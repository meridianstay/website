import { useEffect, useState } from 'react'
import { useAuth } from '@meridian/ui'
import { canAskForPush, refreshPushSubscription, subscribeToPush } from '../lib/push'

// Our own quiet ask, before the browser's. Shown once, to people who have signed in — they have
// shown they mean to come back, and the browser's own prompt can only be answered once ever.

export function PushPrompt() {
  const { user } = useAuth()
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // A browser that already agreed may have been given a new subscription; keep ours current.
    refreshPushSubscription()
  }, [user?.id])

  useEffect(() => {
    if (!user || !canAskForPush()) return
    // Late enough that it never lands on top of what someone came to do.
    const timer = setTimeout(() => setShow(true), 25_000)
    return () => clearTimeout(timer)
  }, [user])

  if (!show) return null

  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 left-4 sm:left-auto sm:w-80 z-50 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 animate-fade-up">
      <p className="text-sm font-bold text-slate-900">Hear about new stays and offers?</p>
      <p className="text-xs text-slate-500 mt-1">We’ll send a notification when something good comes up. No more than a few a month.</p>
      <div className="flex items-center gap-2 mt-3">
        <button
          type="button"
          disabled={busy}
          onClick={async () => { setBusy(true); await subscribeToPush(); setShow(false) }}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-xs font-bold py-2.5 px-4 rounded-xl"
        >
          Yes, keep me posted
        </button>
        <button type="button" onClick={() => setShow(false)} className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2">Not now</button>
      </div>
    </div>
  )
}
