import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Logo } from '@meridian/ui'
import { formatDate } from '@meridian/shared'
import { appLink } from '@meridian/shared/client'
import { guestLabel, readSearch } from '../lib/search'
import { AccountMenu } from './AccountMenu'
import { Modal } from './Modal'
import { SearchForm } from './SearchForm'

export function Header() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [regionOpen, setRegionOpen] = useState(false)
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const current = pathname === '/search' ? readSearch(params) : null

  const whereText = current?.where || 'Anywhere'
  const weekText = current?.checkIn ? `${formatDate(current.checkIn)} – ${formatDate(current.checkOut)}` : 'Any week'
  const guestText = current?.guests ? guestLabel(current.guests) : 'Add guests'

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-[1180px] mx-auto px-5 h-20 flex items-center justify-between gap-3">
        <Link to="/" className="shrink-0" aria-label="Meridian Stay home">
          <Logo href={null} />
        </Link>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden md:flex items-center bg-white border border-slate-200 rounded-full py-1.5 pl-5 pr-1.5 shadow-sm hover:shadow-md transition divide-x divide-slate-200"
        >
          <span className="pr-4 text-[13px] font-semibold text-slate-800 max-w-[160px] truncate">{whereText}</span>
          <span className="px-4 text-[13px] font-semibold text-slate-800">{weekText}</span>
          <span className="pl-4 flex items-center space-x-3">
            <span className={`text-[13px] ${current?.guests ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>{guestText}</span>
            <span className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center">
              <i className="fa-solid fa-magnifying-glass text-xs" aria-hidden="true"></i>
            </span>
          </span>
        </button>

        <div className="flex items-center space-x-1 sm:space-x-2">
          <button type="button" onClick={() => setSearchOpen(true)} aria-label="Search stays" className="md:hidden w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center">
            <i className="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
          </button>
          <a href={appLink('host', '/new')} className="hidden sm:flex items-center space-x-2 text-[13px] font-semibold text-slate-800 hover:bg-slate-100 py-2.5 px-4 rounded-full transition">
            <i className="fa-solid fa-house-chimney text-brand-500" aria-hidden="true"></i>
            <span>Meridian your home</span>
          </a>
          <button type="button" onClick={() => setRegionOpen(true)} aria-label="Language and currency" className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-700 transition">
            <i className="fa-solid fa-globe text-sm" aria-hidden="true"></i>
          </button>
          <AccountMenu />
        </div>
      </div>

      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title="Find a stay" size="lg">
        <SearchForm layout="stacked" initial={current ?? {}} onSubmitted={() => setSearchOpen(false)} />
      </Modal>

      <Modal open={regionOpen} onClose={() => setRegionOpen(false)} title="Language and currency">
        <div className="space-y-5 text-sm">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500 mb-2">Language</p>
            <div className="border-2 border-brand-500 bg-brand-50/60 rounded-2xl p-3 font-semibold text-slate-900 flex items-center justify-between">
              English (India) <i className="fa-solid fa-check text-brand-600" aria-hidden="true"></i>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500 mb-2">Currency</p>
            <div className="border-2 border-brand-500 bg-brand-50/60 rounded-2xl p-3 font-semibold text-slate-900 flex items-center justify-between">
              Indian rupee (₹) <i className="fa-solid fa-check text-brand-600" aria-hidden="true"></i>
            </div>
          </div>
          <p className="text-slate-500">All prices are shown in Indian rupees.</p>
        </div>
      </Modal>
    </header>
  )
}
