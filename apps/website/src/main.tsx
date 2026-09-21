import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { AuthProvider, BrandProvider } from '@meridian/ui'
import '@fortawesome/fontawesome-free/css/fontawesome.min.css'
import '@fortawesome/fontawesome-free/css/solid.min.css'
import '@meridian/ui/motion.css'
import './index.css'
import App from './App'
import { WishlistProvider } from './lib/wishlist'
import { SiteProvider } from './lib/site'
import { PlaceProvider } from './lib/place'
import { initInstall } from './lib/install'

initInstall()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
      <AuthProvider>
        <BrandProvider app="website">
        <SiteProvider>
          <WishlistProvider>
            <PlaceProvider>
              <App />
            </PlaceProvider>
          </WishlistProvider>
        </SiteProvider>
        </BrandProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
