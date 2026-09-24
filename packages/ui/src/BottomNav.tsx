import { defaultBottomNav, type BottomTab } from '@meridian/shared'
import { appLink, isPanelPath } from '@meridian/shared/client'
import { useAuth } from './auth'
import { useSiteSettings } from './brand'
import { useT } from './i18n'

// On a phone or tablet the header's controls are squeezed into icons, so the things people reach
// for most sit in a bar along the bottom instead, where a thumb lands. It follows visitors into
// their account so they never lose their way back, and hides on desktop where the header has room.
// Which tabs appear is set in the control centre.

interface Props {
  /** Where the page lives, so the current tab can be marked. Panels pass their own path. */
  pathname: string
  /** How many stays are saved, for the badge. Only the website knows this. */
  savedCount?: number
  /** Website pages navigate in place; panels reload, which the website overrides. */
  link?: (url: string, className: string, current: boolean, children: React.ReactNode) => React.ReactNode
}

/** Panel paths (/account/wishlist) become real links; site paths stay as they are. */
export function tabHref(url: string): string {
  if (/^https?:\/\//.test(url)) return url
  for (const [prefix, app] of [['/account', 'account'], ['/host', 'host'], ['/admin', 'admin']] as const) {
    if (url === prefix || url.startsWith(`${prefix}/`)) return appLink(app, url.slice(prefix.length) || '/')
  }
  return appLink('website', url)
}

export function BottomNav({ pathname, savedCount = 0, link }: Props) {
  const { bottomNav } = useSiteSettings()
  const { user } = useAuth()
  const t = useT()
  const settings = bottomNav ?? defaultBottomNav
  if (!settings.enabled) return null

  const tabs = settings.tabs.filter((tab) => tab.enabled)
  if (!tabs.length) return null

  /** Signed-out visitors get "Sign in" where the account tab would be. */
  const resolve = (tab: BottomTab) => {
    if (tab.key === 'account' && !user) return { ...tab, label: t('common.signIn'), url: '/login' }
    if (tab.key === 'trips' && user?.role === 'host') return { ...tab, label: t('tab.host'), icon: 'house-chimney', url: '/host' }
    return tab
  }

  /** The default labels are translated; anything renamed in the control centre is shown as written. */
  const label = (tab: BottomTab) => {
    const key = { home: 'nav.home', search: 'tab.explore', saved: 'tab.saved', trips: 'tab.trips', account: 'tab.account' }[tab.key]
    const original = defaultBottomNav.tabs.find((d) => d.key === tab.key)?.label
    return key && tab.label === original ? t(key) : tab.label
  }

  return (
    <nav
      aria-label={t('tab.explore')}
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="flex items-stretch">
        {tabs.map(resolve).map((tab) => {
          const href = tabHref(tab.url)
          const current = !isPanelPath(tab.url)
            ? (tab.url === '/' ? pathname === '/' : pathname.startsWith(tab.url))
            : pathname.startsWith(tab.url)
          const className = `flex flex-col items-center justify-center gap-1.5 py-2.5 w-full transition ${current ? 'text-brand-600' : 'text-slate-500 hover:text-slate-800'}`
          const body = (
            <>
              <span className="relative">
                <i className={`fa-solid fa-${tab.icon} text-[17px]`} aria-hidden="true"></i>
                {tab.key === 'saved' && savedCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold leading-4 tabular-nums">{savedCount}</span>
                )}
              </span>
              <span className="text-[10px] font-semibold leading-none">{label(tab)}</span>
            </>
          )
          return (
            <li key={tab.key} className="flex-1">
              {link ? link(href, className, current, body) : <a href={href} className={className} aria-current={current ? 'page' : undefined}>{body}</a>}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
