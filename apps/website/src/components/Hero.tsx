import { images } from '@meridian/shared'

const fields = [
  { label: 'Where', value: 'Search destinations', muted: true },
  { label: 'Check in / out', value: 'Select dates' },
  { label: 'Who', value: 'Add guests' },
]

export function Hero() {
  return (
    <section className="relative bg-slate-900 text-white overflow-hidden py-28 lg:py-32">
      <img src={images.hero} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/50 to-slate-900/30"></div>

      <div className="relative max-w-[1180px] mx-auto px-5 text-center">
        <span className="inline-flex items-center bg-brand-yellow-500/20 border border-brand-yellow-400/40 text-brand-yellow-400 px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider mb-7">
          <i className="fa-solid fa-crown mr-2" aria-hidden="true"></i> Curated Eco-Stays &amp; Luxury Escapes
        </span>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-3xl mx-auto leading-[1.08] mb-6">
          Find your peaceful sanctuary in{' '}
          <span className="bg-gradient-to-r from-brand-yellow-400 to-brand-500 bg-clip-text text-transparent">Nature</span>
        </h1>
        <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto mb-10 font-light">
          Discover handpicked farmstays, secluded forest cottages, scenic resorts, and luxury pool villas for your next unforgettable getaway.
        </p>

        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className="max-w-[840px] mx-auto bg-white p-3 rounded-2xl shadow-2xl text-slate-800 grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center"
        >
          {fields.map((field, i) => (
            <button
              type="button"
              key={field.label}
              className={`text-left px-4 py-2 rounded-xl hover:bg-slate-50 transition ${i > 0 ? 'border-t sm:border-t-0 border-slate-100' : ''}`}
            >
              <span className="block text-[10px] font-bold uppercase text-slate-500 tracking-wide">{field.label}</span>
              <span className={`block text-[13px] mt-0.5 ${field.muted ? 'text-slate-400' : 'font-semibold text-slate-800'}`}>{field.value}</span>
            </button>
          ))}
          <button
            type="submit"
            className="bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-bold text-sm py-3.5 px-10 rounded-xl shadow-lg shadow-brand-500/30 flex items-center justify-center space-x-2 transition"
          >
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            <span>Search Stays</span>
          </button>
        </form>
      </div>
    </section>
  )
}
