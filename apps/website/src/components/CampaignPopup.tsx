import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { useAuth, useT } from '@meridian/ui'
import { popupSeenKey, type CampaignContent } from '@meridian/shared'
import { api } from '@meridian/shared/client'
import { usePlace } from '../lib/place'
import { SiteLink } from './SiteLink'

// Offers written in the control centre, shown over the page after someone has had a moment to read
// it. What they have already seen is remembered in their own browser, so the same card doesn't
// follow them around.

interface LivePopup {
  id: number
  content: CampaignContent
  afterSeconds: number
  frequency: 'once' | 'daily' | 'always'
}

/** Whether this popup may show again, given what this browser remembers. */
function mayShow(popup: LivePopup): boolean {
  if (popup.frequency === 'always') return true
  try {
    const seen = localStorage.getItem(popupSeenKey(popup.id))
    if (!seen) return true
    if (popup.frequency === 'once') return false
    return Date.now() - Number(seen) > 24 * 60 * 60 * 1000
  } catch {
    // A browser with storage switched off sees it once per page, which is the safe way to be wrong.
    return true
  }
}

const remember = (id: number) => {
  try {
    localStorage.setItem(popupSeenKey(id), String(Date.now()))
  } catch {
    // Nothing to do: it will show again, which is better than never showing.
  }
}

const pageKind = (pathname: string) =>
  pathname === '/' ? 'home' : /^\/(search|stays|destinations)/.test(pathname) ? 'stays' : 'other'

export function CampaignPopup() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { place } = usePlace()
  const t = useT()
  const [popup, setPopup] = useState<LivePopup | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let live = true
    const installed = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as { standalone?: boolean }).standalone === true
    api.livePopup({ page: pageKind(pathname), installed, place: place?.name })
      .then((r) => { if (live) setPopup(r.popup) })
      .catch(() => {})
    return () => { live = false }
    // Refetched when someone signs in or changes destination, since both change who they are.
  }, [pathname, user?.id, place?.name])

  useEffect(() => {
    if (!popup || !mayShow(popup)) return
    const timer = setTimeout(() => {
      setOpen(true)
      remember(popup.id)
      api.countCampaign(popup.id, 'shown').catch(() => {})
    }, Math.max(0, popup.afterSeconds) * 1000)
    return () => clearTimeout(timer)
  }, [popup])

  if (!popup || !open) return null
  const { content } = popup

  const close = () => {
    setOpen(false)
    api.countCampaign(popup.id, 'dismissed').catch(() => {})
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 pb-24 sm:pb-4" role="dialog" aria-modal="true" aria-labelledby="popup-title">
      <button type="button" aria-label={t('common.close')} onClick={close} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm cursor-default" />
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
        {content.imageUrl && <img src={content.imageUrl} alt="" className="w-full h-40 object-cover" />}
        <button type="button" onClick={close} aria-label={t('common.close')}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 text-slate-700 hover:bg-white shadow flex items-center justify-center">
          <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
        </button>
        <div className="p-6">
          <h2 id="popup-title" className="text-xl font-extrabold text-slate-900 text-balance">{content.title}</h2>
          <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">{content.body}</p>
          {content.buttonLabel && content.buttonUrl && (
            <SiteLink
              url={content.buttonUrl}
              className="mt-5 inline-flex items-center justify-center w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-6 rounded-2xl text-sm"
            >
              <span onClick={() => { api.countCampaign(popup.id, 'clicked').catch(() => {}); setOpen(false) }}>{content.buttonLabel}</span>
            </SiteLink>
          )}
        </div>
      </div>
    </div>
  )
}
