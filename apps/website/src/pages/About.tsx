import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { aboutImages, defaultAbout, fillStats, type AboutItem, type AboutPage, type AboutSection, type AboutStats } from '@meridian/shared'
import { api, appLink } from '@meridian/shared/client'
import { useLanguage } from '@meridian/ui'
import { useDocumentTitle } from '../lib/useDocumentTitle'

// About us (/about). Content is edited in the control center (Website content → About page);
// {{tokens}} in any text are filled with live figures from the platform.

export function About() {
  const { lang } = useLanguage()
  const [page, setPage] = useState<AboutPage>(defaultAbout)
  const [stats, setStats] = useState<AboutStats | null>(null)
  useDocumentTitle('About us')

  useEffect(() => {
    api.about(lang).then((r) => {
      setPage(r.page)
      setStats(r.stats)
    }).catch(() => {})
  }, [lang])

  const t = (text: string) => fillStats(text, stats)
  const s = page.sections
  const founder = s.founder.items[0]

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <img src={page.hero.image || aboutImages.story} alt="" className="absolute inset-0 -z-10 w-full h-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/70 via-slate-950/55 to-slate-950/80" />
        <div className="max-w-[1180px] mx-auto px-5 py-24 sm:py-32 text-center text-white animate-fade-in">
          <span className="inline-block text-[11px] font-extrabold uppercase tracking-widest bg-white/10 border border-white/20 backdrop-blur px-4 py-1.5 rounded-full">{page.hero.eyebrow}</span>
          <h1 className="mt-6 text-4xl sm:text-6xl font-extrabold tracking-tight">
            {page.hero.title} <span className="bg-gradient-to-r from-brand-400 to-brand-yellow-400 bg-clip-text text-transparent">{page.hero.highlight}</span>
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-base sm:text-lg text-slate-200">{t(page.hero.tagline)}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/search" className="bg-brand-600 hover:bg-brand-500 text-white font-bold py-3.5 px-7 rounded-2xl text-sm shadow-lg shadow-brand-900/40 transition">Explore stays</Link>
            <a href={appLink('host', '/new')} className="bg-white/10 hover:bg-white/20 border border-white/30 backdrop-blur text-white font-bold py-3.5 px-7 rounded-2xl text-sm transition">List your property</a>
          </div>
        </div>
      </section>

      {/* Quick navigation */}
      <nav aria-label="On this page" className="sticky top-20 z-20 bg-white/90 backdrop-blur border-b border-slate-100">
        <ul className="max-w-[1180px] mx-auto px-5 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden text-xs font-bold text-slate-600 py-2">
          {([['company', 'Who we are'], ['mission', 'Mission & vision'], ['journey', 'Journey'], ['founder', 'Founder'], ['team', 'Team'], ['goals', 'Goals'], ['impact', 'Impact'], ['why-us', 'Why us']] as const).map(([id, label]) => (
            <li key={id}><a href={`#${id}`} className="block whitespace-nowrap px-3 py-2 rounded-full hover:bg-slate-100 hover:text-slate-900">{label}</a></li>
          ))}
        </ul>
      </nav>

      {/* About the company */}
      <section id="company" className="scroll-mt-36 max-w-[1180px] mx-auto px-5 py-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <Heading eyebrow="Who we are" section={s.company} t={t} />
          <Paragraphs text={t(s.company.body)} className="mt-6" />
        </div>
        <div className="relative">
          <img src={aboutImages.story} alt="" className="rounded-3xl shadow-2xl shadow-slate-300 w-full h-80 lg:h-[26rem] object-cover" />
          <div className="absolute -bottom-6 -left-4 sm:left-6 bg-white rounded-2xl shadow-xl p-4 flex items-center gap-3 border border-slate-100">
            <span className="w-11 h-11 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center"><i className="fa-solid fa-house-circle-check" aria-hidden="true"></i></span>
            <span className="text-sm"><span className="block font-extrabold text-slate-900">{t('{{liveStays}}')} stays live</span><span className="text-slate-500 text-xs">every one reviewed by our team</span></span>
          </div>
        </div>
        {s.company.items.length > 0 && (
          <ul className="lg:col-span-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {s.company.items.map((it, i) => <IconCard key={i} item={it} t={t} />)}
          </ul>
        )}
      </section>

      {/* Mission & vision */}
      <section id="mission" className="scroll-mt-36 bg-slate-50 py-20">
        <div className="max-w-[1180px] mx-auto px-5 grid lg:grid-cols-2 gap-6">
          <div className="rounded-3xl bg-gradient-to-br from-brand-700 to-brand-600 text-white p-8 sm:p-10 shadow-xl shadow-brand-900/20">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-brand-yellow-300"><i className="fa-solid fa-bullseye mr-2" aria-hidden="true"></i>Mission</p>
            <h2 className="text-3xl font-extrabold mt-3">{s.mission.title}</h2>
            <p className="text-lg text-brand-50 mt-3 font-semibold">{t(s.mission.tagline)}</p>
            <Paragraphs text={t(s.mission.body)} className="mt-4" color="text-brand-50" />
            {s.mission.items.length > 0 && (
              <ul className="mt-8 space-y-4">
                {s.mission.items.map((it, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center"><i className={`fa-solid fa-${it.icon || 'circle'}`} aria-hidden="true"></i></span>
                    <span><span className="block font-bold">{t(it.title)}</span><span className="text-sm text-brand-50/90">{t(it.text)}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="relative rounded-3xl overflow-hidden isolate p-8 sm:p-10 text-white min-h-[24rem] flex flex-col justify-end">
            <img src={aboutImages.vision} alt="" className="absolute inset-0 -z-10 w-full h-full object-cover" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-slate-950/10" />
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-brand-yellow-300"><i className="fa-solid fa-eye mr-2" aria-hidden="true"></i>Vision</p>
            <h2 className="text-3xl font-extrabold mt-3">{s.vision.title}</h2>
            <p className="text-lg mt-3 font-semibold text-slate-100">{t(s.vision.tagline)}</p>
            <Paragraphs text={t(s.vision.body)} className="mt-4" color="text-slate-200" />
          </div>
        </div>
      </section>

      {/* Journey */}
      <section id="journey" className="scroll-mt-36 max-w-[1180px] mx-auto px-5 py-20">
        <Heading eyebrow="Our story" section={s.journey} t={t} center />
        <Paragraphs text={t(s.journey.body)} className="mt-4 max-w-2xl mx-auto text-center" />
        <ol className="relative mt-12 max-w-3xl mx-auto">
          <span className="absolute left-5 sm:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-400 via-brand-300 to-brand-yellow-400 sm:-translate-x-1/2" aria-hidden="true" />
          {s.journey.items.map((it, i) => (
            <li key={i} className={`relative pl-14 pb-10 last:pb-0 sm:w-1/2 ${i % 2 ? 'sm:ml-auto sm:pl-10' : 'sm:pl-0 sm:pr-10 sm:text-right'}`}>
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white border-4 border-brand-500 shadow ${i % 2 ? 'left-2.5 sm:-left-2.5' : 'left-2.5 sm:left-auto sm:-right-2.5'}`} aria-hidden="true" />
              <span className="inline-block text-[11px] font-extrabold uppercase tracking-wider text-brand-700 bg-brand-50 px-3 py-1 rounded-full">{t(it.meta)}</span>
              <h3 className="text-lg font-extrabold text-slate-900 mt-2">{t(it.title)}</h3>
              <p className="text-sm text-slate-600 mt-1">{t(it.text)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Founder */}
      <section id="founder" className="scroll-mt-36 bg-gradient-to-br from-brand-50 via-white to-brand-yellow-50 py-20">
        <div className="max-w-[1180px] mx-auto px-5 grid lg:grid-cols-5 gap-12 items-center">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 p-8 text-center">
              {founder?.image ? (
                <img src={founder.image} alt={founder.title} className="w-32 h-32 rounded-full object-cover mx-auto ring-4 ring-brand-100" />
              ) : (
                <span className="w-32 h-32 rounded-full mx-auto flex items-center justify-center bg-gradient-to-tr from-brand-600 to-brand-yellow-500 text-white text-4xl font-extrabold">{initials(founder?.title ?? 'M')}</span>
              )}
              <p className="mt-5 text-xl font-extrabold text-slate-900">{founder?.title}</p>
              <p className="text-sm font-semibold text-brand-700">{founder?.meta}</p>
              {founder?.text && (
                <blockquote className="mt-6 text-slate-600 italic relative">
                  <i className="fa-solid fa-quote-left text-brand-200 text-3xl absolute -top-3 -left-1" aria-hidden="true"></i>
                  <p className="relative">“{t(founder.text)}”</p>
                </blockquote>
              )}
            </div>
          </div>
          <div className="lg:col-span-3">
            <Heading eyebrow="The founder" section={s.founder} t={t} />
            <Paragraphs text={t(s.founder.body)} className="mt-6" />
          </div>
        </div>
      </section>

      {/* Team */}
      <section id="team" className="scroll-mt-36 max-w-[1180px] mx-auto px-5 py-20">
        <Heading eyebrow="Our team" section={s.team} t={t} center />
        <Paragraphs text={t(s.team.body)} className="mt-4 max-w-2xl mx-auto text-center" />
        <ul className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {s.team.items.map((it, i) => (
            <li key={i} className="group bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition p-6 text-center">
              {it.image ? (
                <img src={it.image} alt={it.title} className="w-20 h-20 rounded-full object-cover mx-auto" />
              ) : (
                <span className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-yellow-500 text-white flex items-center justify-center text-2xl shadow-lg shadow-brand-500/20 group-hover:scale-105 transition">
                  <i className={`fa-solid fa-${it.icon || 'user'}`} aria-hidden="true"></i>
                </span>
              )}
              <p className="mt-4 font-extrabold text-slate-900">{t(it.title)}</p>
              {it.meta && <p className="text-xs font-semibold text-brand-700">{t(it.meta)}</p>}
              <p className="mt-2 text-sm text-slate-600">{t(it.text)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Goals */}
      <section id="goals" className="scroll-mt-36 bg-slate-50 py-20">
        <div className="max-w-[1180px] mx-auto px-5">
          <Heading eyebrow="Our aim" section={s.goals} t={t} center />
          <Paragraphs text={t(s.goals.body)} className="mt-4 max-w-2xl mx-auto text-center" />
          <ol className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {s.goals.items.map((it, i) => (
              <li key={i} className="relative bg-white rounded-3xl p-6 border border-slate-100 shadow-sm overflow-hidden">
                <span className="absolute -right-2 -top-4 text-7xl font-extrabold text-slate-100 select-none" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <span className="relative w-11 h-11 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center"><i className={`fa-solid fa-${it.icon || 'flag'}`} aria-hidden="true"></i></span>
                <p className="relative mt-4 font-extrabold text-slate-900">{t(it.title)}</p>
                <p className="relative mt-1 text-sm text-slate-600">{t(it.text)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Impact */}
      <section id="impact" className="scroll-mt-36 bg-slate-950 text-white py-20">
        <div className="max-w-[1180px] mx-auto px-5 space-y-20">
          <ImpactBlock eyebrow="Local impact" section={s.localImpact} t={t} big />
          <ImpactBlock eyebrow="Global impact" section={s.globalImpact} t={t} />
        </div>
      </section>

      {/* Why us */}
      <section id="why-us" className="scroll-mt-36 max-w-[1180px] mx-auto px-5 py-20">
        <Heading eyebrow="Why us?" section={s.whyUs} t={t} center />
        <Paragraphs text={t(s.whyUs.body)} className="mt-4 max-w-2xl mx-auto text-center" />
        <ul className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {s.whyUs.items.map((it, i) => <IconCard key={i} item={it} t={t} />)}
        </ul>
      </section>

      {/* Call to action */}
      <section className="max-w-[1180px] mx-auto px-5 pb-20">
        <div className="rounded-3xl bg-gradient-to-r from-brand-700 via-brand-600 to-brand-yellow-500 text-white p-10 sm:p-14 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-2xl shadow-brand-900/20">
          <div>
            <h2 className="text-3xl font-extrabold">Your next escape is waiting</h2>
            <p className="mt-2 text-brand-50">Find a stay that feels like home, or share your own corner of India with travellers.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link to="/search" className="bg-white text-brand-700 font-bold py-3.5 px-7 rounded-2xl text-sm text-center hover:bg-brand-50 transition">Find a stay</Link>
            <a href={appLink('host', '/new')} className="bg-slate-900/20 hover:bg-slate-900/30 border border-white/40 font-bold py-3.5 px-7 rounded-2xl text-sm text-center transition">List your property</a>
          </div>
        </div>
      </section>
    </div>
  )
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')

function Heading({ eyebrow, section, t, center = false }: { eyebrow: string; section: AboutSection; t: (s: string) => string; center?: boolean }) {
  return (
    <div className={center ? 'text-center max-w-3xl mx-auto' : ''}>
      <p className="text-[11px] font-extrabold uppercase tracking-widest text-brand-600">{eyebrow}</p>
      <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">{t(section.title)}</h2>
      {section.tagline && <p className="mt-3 text-lg text-slate-500">{t(section.tagline)}</p>}
    </div>
  )
}

/** Body text split into paragraphs at blank lines. `color` sets the text colour (dark sections pass a light one). */
function Paragraphs({ text, className = '', color = 'text-slate-600' }: { text: string; className?: string; color?: string }): ReactNode {
  const parts = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  if (!parts.length) return null
  return <div className={`space-y-4 leading-relaxed ${color} ${className}`}>{parts.map((p, i) => <p key={i}>{p}</p>)}</div>
}

function IconCard({ item, t }: { item: AboutItem; t: (s: string) => string }) {
  return (
    <li className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition">
      <span className="w-11 h-11 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-yellow-500 text-white flex items-center justify-center shadow-md shadow-brand-500/20">
        <i className={`fa-solid fa-${item.icon || 'circle-check'}`} aria-hidden="true"></i>
      </span>
      <p className="mt-4 font-extrabold text-slate-900">{t(item.title)}</p>
      <p className="mt-1 text-sm text-slate-600">{t(item.text)}</p>
    </li>
  )
}

function ImpactBlock({ eyebrow, section, t, big = false }: { eyebrow: string; section: AboutSection; t: (s: string) => string; big?: boolean }) {
  return (
    <div className="grid lg:grid-cols-5 gap-10">
      <div className="lg:col-span-2">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-brand-yellow-400">{eyebrow}</p>
        <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">{t(section.title)}</h2>
        {section.tagline && <p className="mt-3 text-lg text-slate-300">{t(section.tagline)}</p>}
        <Paragraphs text={t(section.body)} className="mt-4" color="text-slate-400" />
      </div>
      <ul className="lg:col-span-3 grid sm:grid-cols-2 gap-4">
        {section.items.map((it, i) => (
          <li key={i} className="rounded-3xl bg-white/5 border border-white/10 p-6 hover:bg-white/10 transition">
            <i className={`fa-solid fa-${it.icon || 'leaf'} text-brand-400`} aria-hidden="true"></i>
            <p className={`mt-3 font-extrabold tabular-nums ${big ? 'text-4xl bg-gradient-to-r from-brand-300 to-brand-yellow-300 bg-clip-text text-transparent' : 'text-2xl'}`}>{t(it.title)}</p>
            {it.meta && <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">{t(it.meta)}</p>}
            <p className="mt-2 text-sm text-slate-300">{t(it.text)}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
