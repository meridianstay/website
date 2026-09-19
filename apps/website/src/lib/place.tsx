import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { formatKm, distanceKm, type GeoPoint } from '@meridian/shared'

// The visitor's chosen destination (or their location, via "Near me"), remembered on this device.
// Used for distances on cards, "nearest first" search and "near you" homepage rows.

export interface Place extends GeoPoint {
  /** e.g. "Coorg" or "your location". */
  name: string
  slug: string | null
}

const KEY = 'ms_place'
const read = (): Place | null => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lng) && typeof v.name === 'string' ? v : null
  } catch {
    return null
  }
}

const PlaceContext = createContext<{ place: Place | null; setPlace: (p: Place | null) => void; distanceTo: (p: GeoPoint) => string | null }>({
  place: null, setPlace: () => {}, distanceTo: () => null,
})

export function PlaceProvider({ children }: { children: ReactNode }) {
  const [place, set] = useState<Place | null>(read)
  const setPlace = useCallback((p: Place | null) => {
    set(p)
    try {
      if (p) localStorage.setItem(KEY, JSON.stringify(p))
      else localStorage.removeItem(KEY)
    } catch {
      // storage unavailable (private mode): keep it for this visit only
    }
  }, [])
  const distanceTo = useCallback((p: GeoPoint) => (place ? formatKm(distanceKm(place, p)) : null), [place])
  return <PlaceContext.Provider value={{ place, setPlace, distanceTo }}>{children}</PlaceContext.Provider>
}

export const usePlace = () => useContext(PlaceContext)

/** Asks the browser for the visitor's position. */
export function locateMe(): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Your browser can’t share your location.'))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ name: 'you', slug: null, lat: Math.round(pos.coords.latitude * 100) / 100, lng: Math.round(pos.coords.longitude * 100) / 100 }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'Location access was blocked. Allow it in your browser settings, or pick a destination.' : 'We couldn’t find your location. Please pick a destination.')),
      { timeout: 10000, maximumAge: 10 * 60_000 },
    )
  })
}
