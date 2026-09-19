import { images } from '../data/images'

export function HostBanner() {
  return (
    <section id="host" className="max-w-[1180px] mx-auto px-5 pt-12 pb-16">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-700 via-brand-600 via-60% to-brand-yellow-600 px-8 sm:px-12 py-12 shadow-2xl shadow-brand-700/25 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
        <div className="text-white">
          <span className="inline-block bg-brand-yellow-500 text-slate-900 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full">Meridian Hosts</span>
          <h2 className="text-3xl font-extrabold tracking-tight mt-4 max-w-md">Got a farmstay, cottage, or resort?</h2>
          <p className="text-sm text-brand-50/90 mt-4 max-w-lg font-light leading-relaxed">
            Join thousands of successful hosts. List your property on Meridian Stay today and start welcoming nature-loving guests from around the globe.
          </p>
          <button type="button" className="mt-6 bg-white hover:bg-brand-50 text-brand-700 font-bold text-sm py-3.5 px-12 rounded-xl shadow-lg transition">
            Become a Host
          </button>
        </div>
        <div className="flex justify-center lg:justify-end">
          <img
            src={images.hostBanner}
            alt="Resort pool at dusk"
            className="w-full max-w-[350px] h-[236px] object-cover rounded-2xl border-4 border-white/25 shadow-2xl"
          />
        </div>
      </div>
    </section>
  )
}
