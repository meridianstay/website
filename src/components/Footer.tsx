const columns = [
  { heading: 'About Meridian', links: ['How it works', 'Newsroom & Press', 'Investors', 'Eco-Sustainability'] },
  { heading: 'Hosting', links: ['List your property', 'Host protection cover', 'Explore hosting resources', 'Community guidelines'] },
  { heading: 'Support', links: ['Help Center', 'Cancellation options', 'Trust & Safety', 'Contact Us'] },
]

export function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-[1180px] mx-auto px-5 pt-12 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-xs text-slate-600">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white">
                <i className="fa-solid fa-seedling" aria-hidden="true"></i>
              </div>
              <span className="text-sm font-extrabold text-slate-900">Meridian Stay</span>
            </div>
            <p className="text-slate-500 font-light max-w-[240px]">
              Your premium ecosystem for farmstays, boutique resorts, woodland cottages, and luxury villas.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.heading}>
              <h4 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-4">{col.heading}</h4>
              <ul className="space-y-2.5 font-light">
                {col.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="hover:text-brand-600 transition">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <p>© 2026 Meridian Stay Inc. All rights reserved.</p>
          <div className="flex items-center space-x-6">
            <a href="#" className="hover:text-slate-700">Privacy</a>
            <a href="#" className="hover:text-slate-700">Terms</a>
            <a href="#" className="hover:text-slate-700">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
