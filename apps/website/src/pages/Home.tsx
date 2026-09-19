import { Hero } from '../components/Hero'
import { CategoryGrid } from '../components/CategoryGrid'
import { FeaturedStays } from '../components/FeaturedStays'
import { HostBanner } from '../components/HostBanner'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export function Home() {
  useDocumentTitle(null)
  return (
    <>
      <Hero />
      <CategoryGrid />
      <FeaturedStays />
      <HostBanner />
    </>
  )
}
