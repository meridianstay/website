import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '@meridian/ui'
import { api } from '@meridian/shared/client'

interface WishlistState {
  has: (propertyId: number) => boolean
  toggle: (propertyId: number) => void
  /** How many stays are saved, for the badge on the bottom bar. */
  count: number
}

const WishlistContext = createContext<WishlistState | null>(null)

/** Saved stays for the signed-in guest. Logged-out visitors are sent to log in first. */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [ids, setIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!user) {
      setIds(new Set())
      return
    }
    api.wishlist().then((r) => setIds(new Set(r.properties.map((p) => p.id)))).catch(() => {})
  }, [user])

  const toggle = useCallback(
    (propertyId: number) => {
      if (!user) {
        navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`)
        return
      }
      const saved = ids.has(propertyId)
      const next = new Set(ids)
      if (saved) next.delete(propertyId)
      else next.add(propertyId)
      setIds(next) // optimistic; roll back if the request fails
      const call = saved ? api.removeFromWishlist(propertyId) : api.addToWishlist(propertyId)
      call.catch(() => setIds(ids))
    },
    [user, ids, navigate, location],
  )

  return <WishlistContext.Provider value={{ has: (id) => ids.has(id), toggle, count: ids.size }}>{children}</WishlistContext.Provider>
}

export function useWishlist() {
  const ctx = useContext(WishlistContext)
  if (!ctx) throw new Error('useWishlist must be used inside <WishlistProvider>')
  return ctx
}
