import { images } from '@meridian/shared'
import { SearchForm } from './SearchForm'
import { useSite } from '../lib/site'

export function Hero() {
  const { homepage: h } = useSite()
  return (
    <section className="relative bg-slate-900 text-white py-28 lg:py-32">
      <div className="absolute inset-0 overflow-hidden">
        <img src={images.hero} alt="" fetchPriority="high" className="w-full h-full object-cover opacity-60 animate-ken-burns" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/50 to-slate-900/30"></div>
      </div>

      <div className="relative max-w-[1180px] mx-auto px-5 text-center">
        {h.heroBadge && <span className="animate-fade-up inline-flex items-center bg-brand-yellow-500/20 border border-brand-yellow-400/40 text-brand-yellow-400 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider mb-7">
          <i className="fa-solid fa-crown mr-2" aria-hidden="true"></i> {h.heroBadge}
        </span>}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-3xl mx-auto leading-[1.08] mb-6 animate-fade-up [animation-delay:80ms]">
          {h.heroTitle}{' '}
          <span className="bg-gradient-to-r from-brand-yellow-400 to-brand-500 bg-clip-text text-transparent">{h.heroHighlight}</span>
        </h1>
        <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto mb-10 font-light animate-fade-up [animation-delay:160ms]">
          {h.heroSubtitle}
        </p>
        <div className="animate-fade-up [animation-delay:240ms] relative z-20">
          <SearchForm />
        </div>
      </div>
    </section>
  )
}
