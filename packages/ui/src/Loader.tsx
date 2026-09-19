import { useEffect } from 'react'

/** The seedling mark that "grows" while something loads. Same design as the page preloader. */
export function BrandLoader({ label = 'Loading…', fullPage = false }: { label?: string; fullPage?: boolean }) {
  return (
    <div role="status" className={`flex flex-col items-center justify-center gap-4 text-slate-400 text-sm animate-fade-in ${fullPage ? 'min-h-screen bg-slate-50' : 'py-16'}`}>
      <div className="ms-loader-mark" aria-hidden="true">
        <SeedlingPath />
      </div>
      <div className="ms-loader-bar" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

function SeedlingPath() {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 28V16c0-4-3-8-10-8 0 5 3 9 10 9M16 16c0-5 3-9 10-9 0 5-3 9-10 9" />
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
