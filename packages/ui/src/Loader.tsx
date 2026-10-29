import { useEffect } from 'react'

/**
 * Shown while a page or its data arrives. It sits in the middle of the space it is given rather
 * than at the top of it: a mark floating under the header reads as a half-drawn page, where one in
 * the centre reads as a page on its way.
 */
export function BrandLoader({ label = 'Loading…', fullPage = false }: { label?: string; fullPage?: boolean }) {
  return (
    <div role="status" className={`flex flex-col items-center justify-center gap-4 text-slate-400 text-sm animate-fade-in ${fullPage ? 'min-h-screen bg-slate-50' : 'min-h-[60vh] py-16'}`}>
      <div className="ms-loader-mark" aria-hidden="true">
        <RidgePath />
      </div>
      <div className="ms-loader-bar" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

/** The mark: a sun over a ridge, drawing itself. The same design as the page preloader. */
function RidgePath() {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <circle className="sun" cx="21.5" cy="10.5" r="3" />
      <path d="M4.5 23.5 11.5 14.5 16.5 20.5 20.5 16.5 27.5 23.5" />
    </svg>
  )
}

/** Fades out the index.html preloader once the app has rendered its first frame. */
export function useHideSplash() {
  useEffect(() => {
    const splash = document.getElementById('ms-splash')
    if (!splash) return
    let done = false
    const hide = () => {
      if (done) return
      done = true
      splash.classList.add('ms-splash-hide')
      setTimeout(() => splash.remove(), 400)
    }
    // Animation frames pause in background tabs, so a timer backs them up.
    requestAnimationFrame(hide)
    const timer = setTimeout(hide, 100)
    return () => clearTimeout(timer)
  }, [])
}
