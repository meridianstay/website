export function Logo() {
  return (
    <a href="/" className="flex items-center space-x-3" aria-label="Meridian Stay home">
      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-yellow-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
        <i className="fa-solid fa-seedling text-xl" aria-hidden="true"></i>
      </div>
      <div className="leading-tight">
        <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-brand-700 to-brand-600 bg-clip-text text-transparent">Meridian</span>{' '}
        <span className="text-xl font-bold text-brand-yellow-600 tracking-tight">Stay</span>
        <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Nature &amp; Luxury</span>
      </div>
    </a>
  )
}
