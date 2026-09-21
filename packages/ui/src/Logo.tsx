import { useBrand } from './brand'

interface LogoProps {
  /** Overrides the small caps line under the wordmark (normally set in the control centre). */
  subtitle?: string
  /** Link target; pass null when the caller wraps the logo in its own link. */
  href?: string | null
}

/** The app's logo and name, as set in the control centre (Branding). */
export function Logo({ subtitle, href = '/' }: LogoProps) {
  const brand = useBrand()
  const Wrapper = href === null ? 'span' : 'a'
  const line = subtitle ?? brand.subtitle
  return (
    <Wrapper href={href ?? undefined} className="flex items-center space-x-2 sm:space-x-3" aria-label={href === null ? undefined : `${brand.name} ${brand.accent} home`.trim()}>
      <LogoMark />
      {(brand.showName || !brand.logoUrl) && (
        <div className="leading-tight">
          <span className="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-brand-700 to-brand-600 bg-clip-text text-transparent">{brand.name}</span>
          {brand.accent && <> <span className="text-lg sm:text-xl font-bold text-brand-yellow-600 tracking-tight">{brand.accent}</span></>}
          {line && <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{line}</span>}
        </div>
      )}
    </Wrapper>
  )
}

/** The square mark: an uploaded logo when there is one, otherwise the sprout. */
export function LogoMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const brand = useBrand()
  const box = size === 'sm' ? 'w-8 h-8 rounded-xl' : 'w-11 h-11 rounded-2xl shadow-md shadow-brand-500/20'
  if (brand.logoUrl) return <img src={brand.logoUrl} alt="" className={`${box} object-cover shrink-0 bg-white`} />
  const icon = size === 'sm' ? '' : 'text-xl'
  return (
    <div className={`${box} bg-gradient-to-tr from-brand-600 to-brand-yellow-500 flex items-center justify-center text-white shrink-0`}>
      <i className={`fa-solid fa-seedling ${icon}`} aria-hidden="true"></i>
    </div>
  )
}
