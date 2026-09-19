interface LogoProps {
  /** Small caps line under the wordmark, e.g. "Admin Console". */
  subtitle?: string
  /** Link target; pass null when the caller wraps the logo in its own link. */
  href?: string | null
}

export function Logo({ subtitle = 'Nature & Luxury', href = '/' }: LogoProps) {
  const Wrapper = href === null ? 'span' : 'a'
  return (
    <Wrapper href={href ?? undefined} className="flex items-center space-x-2 sm:space-x-3" aria-label={href === null ? undefined : 'Meridian Stay home'}>
      <LogoMark />
      <div className="leading-tight">
        <span className="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-brand-700 to-brand-600 bg-clip-text text-transparent">Meridian</span>{' '}
        <span className="text-lg sm:text-xl font-bold text-brand-yellow-600 tracking-tight">Stay</span>
        <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{subtitle}</span>
      </div>
    </Wrapper>
  )
}

export function LogoMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'w-8 h-8 rounded-xl' : 'w-11 h-11 rounded-2xl shadow-md shadow-brand-500/20'
  const icon = size === 'sm' ? '' : 'text-xl'
  return (
    <div className={`${box} bg-gradient-to-tr from-brand-600 to-brand-yellow-500 flex items-center justify-center text-white shrink-0`}>
      <i className={`fa-solid fa-seedling ${icon}`} aria-hidden="true"></i>
    </div>
  )
}
