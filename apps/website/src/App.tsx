import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { CategoryGrid } from './components/CategoryGrid'
import { FeaturedStays } from './components/FeaturedStays'
import { HostBanner } from './components/HostBanner'
import { Footer } from './components/Footer'

export default function App() {
  return (
    <div className="bg-slate-50 text-slate-800 antialiased min-h-screen flex flex-col selection:bg-brand-500 selection:text-white">
      <Header />
      <main className="flex-grow">
        <Hero />
        <CategoryGrid />
        <FeaturedStays />
        <HostBanner />
      </main>
      <Footer />
    </div>
  )
}
