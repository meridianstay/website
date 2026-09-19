import { Logo } from '@meridian/ui'
import { images } from '@meridian/shared'

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-[1180px] mx-auto px-5 h-20 flex items-center justify-between">
        <Logo />

        <button
          type="button"
          className="hidden md:flex items-center bg-white border border-slate-200 rounded-full py-1.5 pl-5 pr-1.5 shadow-sm hover:shadow-md transition divide-x divide-slate-200"
        >
          <span className="pr-4 text-[13px] font-semibold text-slate-800">Anywhere</span>
          <span className="px-4 text-[13px] font-semibold text-slate-800">Any week</span>
          <span className="pl-4 flex items-center space-x-3">
            <span className="text-[13px] text-slate-400">Add guests</span>
            <span className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center">
              <i className="fa-solid fa-magnifying-glass text-xs" aria-hidden="true"></i>
            </span>
          </span>
        </button>

        <div className="flex items-center space-x-2">
          <a href="#host" className="hidden sm:flex items-center space-x-2 text-[13px] font-semibold text-slate-800 hover:bg-slate-100 py-2.5 px-4 rounded-full transition">
            <i className="fa-solid fa-house-chimney text-brand-500" aria-hidden="true"></i>
            <span>Meridian your home</span>
          </a>
          <button type="button" aria-label="Language and currency" className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700 transition">
            <i className="fa-solid fa-globe text-sm" aria-hidden="true"></i>
          </button>
          <button type="button" aria-label="Account menu" className="flex items-center space-x-3 border border-slate-200 bg-white hover:shadow-md py-1 pl-3.5 pr-1 rounded-full transition">
            <i className="fa-solid fa-bars text-slate-600 text-sm" aria-hidden="true"></i>
            <img src={images.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-brand-yellow-400" />
          </button>
        </div>
      </div>
    </header>
  )
}
