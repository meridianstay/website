import { Link } from 'react-router'
import type { ReactNode } from 'react'
import { appLink, isPanelPath, type AppName } from '@meridian/shared/client'

// Links typed into the control centre are plain paths ("/about", "/host/new") or full https:// links.
// Website paths use the router; the panels and outside links are ordinary anchors.

const panels: [string, AppName][] = [['/host', 'host'], ['/account', 'account'], ['/admin', 'admin']]

/** Turns a stored link into a real href (panel paths follow VITE_HOST_URL and friends). */
export function siteHref(url: string): string {
  if (/^https?:\/\//.test(url)) return url
  const panel = panels.find(([prefix]) => url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`))
  return panel ? appLink(panel[1], url.slice(panel[0].length) || '/') : url
}

export function SiteLink({ url, className, children }: { url: string; className?: string; children: ReactNode }) {
  if (isPanelPath(url)) return <a href={siteHref(url)} className={className}>{children}</a>
  return <Link to={url} className={className}>{children}</Link>
}
