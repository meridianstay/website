import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { AuthProvider, BrandProvider } from '@meridian/ui'
import '@meridian/ui/icons.css'
import '@meridian/ui/motion.css'
import './index.css'
import App from './App'
import { WishlistProvider } from './lib/wishlist'
import { SiteProvider } from './lib/site'
import { PlaceProvider } from './lib/place'
import { ClientSiteProvider, detectClientRequest } from './lib/clientSite'
import { initInstall } from './lib/install'

initInstall()

// Worked out before the router is built, because a client previewing at /c/<name> needs that as the
// base of every link on the page.
const { slug, basename } = detectClientRequest()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <AuthProvider>
        <BrandProvider app="website">
        <SiteProvider>
          <WishlistProvider>
            <PlaceProvider>
              <ClientSiteProvider slug={slug}>
                <App />
              </ClientSiteProvider>
            </PlaceProvider>
          </WishlistProvider>
        </SiteProvider>
        </BrandProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
