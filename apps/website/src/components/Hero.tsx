import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { HeroSettings, HeroSlide } from '@meridian/shared'
import { SearchForm } from './SearchForm'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Homepage hero: one static slide, or a slider that changes automatically (paused while hovered or focused). */
export function Hero({ hero }: { hero: HeroSettings }) {
  const slides = hero.mode === 'slider' ? hero.slides : hero.slides.slice(0, 1)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = slides.length
  const current = slides[Math.min(index, count - 1)] ?? slides[0]

  useEffect(() => {
    if (count < 2 || paused || reducedMotion()) return
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % count), Math.max(hero.intervalSec, 4) * 1000)
    return () => window.clearTimeout(timer)
  }, [index, count, paused, hero.intervalSec])

  // Warm the next photos so slides don't flash.
  useEffect(() => {
    slides.forEach((s) => { const img = new Image(); img.src = s.image })
  }, [slides])

  if (!current) return null

  return (
    <section
      className="relative bg-slate-900 text-white py-28 lg:py-32"
      aria-roledescription={count > 1 ? 'carousel' : undefined}
      aria-label="Featured"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {slides.map((s, i) => (
          <img key={i} src={s.image} alt="" fetchPriority={i === 0 ? 'high' : 'low'}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${i === index ? 'opacity-60 animate-ken-burns' : 'opacity-0'}`} />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/50 to-slate-900/30"></div>
      </div>

      <div className="relative max-w-[1180px] mx-auto px-5 text-center">
        <SlideText key={index} slide={current} />
        {hero.showSearch && (
          <div className="animate-fade-up [animation-delay:240ms] relative z-20 mt-10">
            <SearchForm />
          </div>
        )}
        {count > 1 && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <button type="button" aria-label="Previous slide" onClick={() => setIndex((index - 1 + count) % count)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center">
              <i className="fa-solid fa-chevron-left text-xs" aria-hidden="true"></i>
            </button>
            <div className="flex gap-2" role="tablist" aria-label="Slides">
              {slides.map((s, i) => (
                <button key={i} type="button" role="tab" aria-selected={i === index} aria-label={`Slide ${i + 1}: ${s.title} ${s.highlight}`} onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all ${i === index ? 'w-8 bg-brand-yellow-400' : 'w-2 bg-white/40 hover:bg-white/70'}`} />
              ))}
            </div>
            <button type="button" aria-label="Next slide" onClick={() => setIndex((index + 1) % count)} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center">
              <i className="fa-solid fa-chevron-right text-xs" aria-hidden="true"></i>
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

function SlideText({ slide }: { slide: HeroSlide }) {
  const external = /^https?:/.test(slide.buttonUrl)
  const button = 'inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 backdrop-blur text-white font-bold py-3 px-6 rounded-2xl text-sm transition'
  return (
    <div aria-live="polite">
      {slide.badge && (
        <span className="animate-fade-up inline-flex items-center bg-brand-yellow-500/20 border border-brand-yellow-400/40 text-brand-yellow-400 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider mb-7">
          <i className="fa-solid fa-crown mr-2" aria-hidden="true"></i> {slide.badge}
        </span>
      )}
      <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-3xl mx-auto leading-[1.08] mb-6 animate-fade-up [animation-delay:80ms]">
        {slide.title}{' '}
        {slide.highlight && <span className="bg-gradient-to-r from-brand-yellow-400 to-brand-500 bg-clip-text text-transparent">{slide.highlight}</span>}
      </h1>
      {slide.subtitle && <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto font-light animate-fade-up [animation-delay:160ms]">{slide.subtitle}</p>}
      {slide.buttonLabel && slide.buttonUrl && (
        <div className="mt-7 animate-fade-up [animation-delay:200ms]">
          {external
            ? <a href={slide.buttonUrl} className={button}>{slide.buttonLabel}<i className="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i></a>
            : <Link to={slide.buttonUrl} className={button}>{slide.buttonLabel}<i className="fa-solid fa-arrow-right text-xs" aria-hidden="true"></i></Link>}
        </div>
      )}
    </div>
  )
}
