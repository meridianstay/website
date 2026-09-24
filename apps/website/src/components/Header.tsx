import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { LanguagePicker, Logo, useT } from '@meridian/ui'
import { formatDate } from '@meridian/shared'
import { appLink } from '@meridian/shared/client'
import { guestLabel, readSearch } from '../lib/search'
import { AccountMenu } from './AccountMenu'
import { InstallAppButton } from './InstallApp'
import { DestinationPicker } from './DestinationPicker'
import { usePlace } from '../lib/place'
import { Modal } from './Modal'
import { SearchForm } from './SearchForm'
import { SiteLink } from './SiteLink'
import { useSite } from '../lib/site'

export function Header() {
  const [searchOpen, setSearchOpen] = useState(false)
  const [regionOpen, setRegionOpen] = useState(false)
  const [placeOpen, setPlaceOpen] = useState(false)
  const { place } = usePlace()
  const { header } = useSite()
  const t = useT()
  // Other parts of the page (e.g. the homepage's "near you" row) can open the picker.
  useEffect(() => {
    const open = () => setPlaceOpen(true)
    window.addEventListener('ms:pick-place', open)
    return () => window.removeEventListener('ms:pick-place', open)
  }, [])
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const current = pathname === '/search' ? readSearch(params) : null

  const whereText = current?.where || t('nav.anywhere')
  const weekText = current?.checkIn ? `${formatDate(current.checkIn)} – ${formatDate(current.checkOut)}` : t('nav.anyWeek')
  const guestText = guestLabel(current?.guests ?? 0, t)

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-5 h-20 flex items-center justify-between gap-2 sm:gap-3 min-w-0">
        <Link to="/" className="shrink-0 min-w-0" aria-label="Meridian Stay home">
          <Logo href={null} />
        </Link>

        {header.showSearch && <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="hidden lg:flex items-center bg-white border border-slate-200 rounded-full py-1.5 pl-5 pr-1.5 shadow-sm hover:shadow-md transition divide-x divide-slate-200"
        >
          <span className="pr-4 text-[13px] font-semibold text-slate-800 max-w-[160px] truncate">{whereText}</span>
          <span className="px-4 text-[13px] font-semibold text-slate-800">{weekText}</span>
          <span className="pl-4 flex items-center space-x-3">
            <span className={`text-[13px] ${current?.guests ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>{guestText}</span>
            <span className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center">
              <i className="fa-solid fa-magnifying-glass text-xs" aria-hidden="true"></i>
            </span>
          </span>
        </button>}

        <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
          {header.showSearch && <button type="button" onClick={() => setSearchOpen(true)} aria-label={t('common.search')} className="lg:hidden w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center">
            <i className="fa-solid fa-magnifying-glass text-sm" aria-hidden="true"></i>
          </button>}
          {header.showDestinations && <button type="button" onClick={() => setPlaceOpen(true)} aria-label={place ? `Destination: ${place.name === 'you' ? 'near you' : place.name}. Change` : 'Choose a destination'}
            className="hidden sm:flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold text-slate-800 hover:bg-slate-100 h-10 px-3 rounded-full transition max-w-[150px]">
            <i className="fa-solid fa-location-dot text-brand-500" aria-hidden="true"></i>
            <span className="hidden xl:inline truncate">{place ? (place.name === 'you' ? t('nav.nearMe') : place.name) : t('nav.selectCity')}</span>
          </button>}
          {header.showInstallApp && <InstallAppButton />}
          {header.links.map((link) => (
            <SiteLink key={link.url + link.label} url={link.url} className="hidden lg:flex items-center whitespace-nowrap text-[13px] font-semibold text-slate-800 hover:bg-slate-100 py-2.5 px-4 rounded-full transition">
              {link.label}
            </SiteLink>
          ))}
          {header.hostLinkLabel && <a href={appLink('host', '/new')} className="hidden sm:flex items-center space-x-2 whitespace-nowrap text-[13px] font-semibold text-slate-800 hover:bg-slate-100 py-2.5 px-4 rounded-full transition">
            <i className="fa-solid fa-house-chimney text-brand-500" aria-hidden="true"></i>
            <span className="hidden lg:inline">{header.hostLinkLabel === 'List your property' ? t('nav.listProperty') : header.hostLinkLabel}</span>
          </a>}
          {header.showCurrency && <button type="button" onClick={() => setRegionOpen(true)} aria-label={t('nav.languageAndCurrency')} className="hidden sm:flex w-10 h-10 rounded-full hover:bg-slate-100 items-center justify-center text-slate-700 transition">
            <i className="fa-solid fa-globe text-sm" aria-hidden="true"></i>
          </button>}
          <AccountMenu />
        </div>
      </div>

      <Modal open={searchOpen} onClose={() => setSearchOpen(false)} title={t('nav.findStay')} size="lg">
        <button type="button" onClick={() => { setSearchOpen(false); setPlaceOpen(true) }}
          className="w-full mb-5 flex items-center justify-between gap-3 bg-brand-50 border border-brand-100 rounded-2xl p-3 text-left">
          <span className="text-sm">
            <i className="fa-solid fa-location-dot text-brand-600 mr-2" aria-hidden="true"></i>
            <span className="font-bold text-slate-900">{place ? (place.name === 'you' ? t('nav.nearMe') : place.name) : t('nav.chooseDestination')}</span>
            <span className="block text-xs text-slate-500 ml-6">Popular places, all destinations, or near me</span>
          </span>
          <i className="fa-solid fa-chevron-right text-xs text-slate-400" aria-hidden="true"></i>
        </button>
        <SearchForm layout="stacked" initial={current ?? {}} onSubmitted={() => setSearchOpen(false)} />
      </Modal>

      <DestinationPicker open={placeOpen} onClose={() => setPlaceOpen(false)} />

      <Modal open={regionOpen} onClose={() => setRegionOpen(false)} title={t('nav.languageAndCurrency')}>
        <div className="space-y-6 text-sm">
          <LanguagePicker onPicked={() => setRegionOpen(false)} />
          <div>
            <p className="text-xs font-bold uppercase text-slate-500 mb-2">{t('nav.currency')}</p>
            <div className="border-2 border-brand-500 bg-brand-50/60 rounded-2xl p-3 font-semibold text-slate-900 flex items-center justify-between">
              Indian rupee (₹) <i className="fa-solid fa-check text-brand-600" aria-hidden="true"></i>
            </div>
            <p className="text-slate-500 mt-2 text-xs">{t('lang.pricesInRupees')}</p>
          </div>
        </div>
      </Modal>
    </header>
  )
}
