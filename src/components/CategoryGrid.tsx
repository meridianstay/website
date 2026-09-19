import { categories } from '../data/categories'

export function CategoryGrid() {
  return (
    <section className="max-w-[1180px] mx-auto px-5 pt-14 pb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Explore Property Types</h2>
        <a href="#featured" className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center space-x-1">
          <span>View all properties</span>
          <i className="fa-solid fa-arrow-right text-[10px]" aria-hidden="true"></i>
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {categories.map((cat) => (
          <a
            key={cat.title}
            href="#featured"
            className="group relative rounded-2xl overflow-hidden shadow-md h-60 border border-slate-200 transition transform hover:-translate-y-1 hover:shadow-xl"
          >
            <img src={cat.image} alt={cat.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent"></div>
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <span
                className={`inline-block px-2.5 py-0.5 text-[9px] font-bold uppercase rounded-full mb-1 ${
                  cat.tagTone === 'green' ? 'bg-brand-500 text-white' : 'bg-brand-yellow-500 text-slate-900'
                }`}
              >
                {cat.tag}
              </span>
              <h3 className="text-lg font-bold">{cat.title}</h3>
              <p className="text-[11px] text-slate-300 font-light mt-0.5">{cat.description}</p>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
