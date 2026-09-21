import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { BrandLoader } from '@meridian/ui'
import { appLink, safeNext } from '@meridian/shared/client'

/**
 * Hosts and guests share one login on the website, so this old address just forwards there,
 * keeping any page the person was heading for.
 */
export function HostLogin() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const target = next === '/' ? appLink('host', '/') : next.startsWith('/host') ? next : appLink('host', next)

  useEffect(() => {
    window.location.replace(appLink('website', `/login?as=host&next=${encodeURIComponent(target)}`))
  }, [target])

  return <BrandLoader fullPage />
}
