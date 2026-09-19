import type { PropertyType } from './types'

// Destinations, distances and property codes.

export interface GeoPoint { lat: number; lng: number }

/** Straight-line distance in km (haversine). */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

/** "Under 1 km", "3.4 km", "48 km", "1,240 km". */
export const formatKm = (km: number) => (km < 1 ? 'Under 1 km' : km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km).toLocaleString('en-IN')} km`)

/** Short code guests can search for and quote on the phone, e.g. MS007. */
export const propertyCode = (id: number) => `MS${String(id).padStart(3, '0')}`

/** "MS007", "ms-7", "MS 07" → 7. */
export function parsePropertyCode(q: string): number | null {
  const m = /^\s*ms[\s-]?0*(\d{1,6})\s*$/i.exec(q)
  return m ? Number(m[1]) : null
}

/** "Coorg" → "coorg", "Himachal Pradesh" → "himachal-pradesh". */
export const placeSlug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** URL words for property types on landing pages: /destinations/goa/villas. */
export const TYPE_SLUGS: Record<PropertyType, string> = { Farmstay: 'farmstays', Room: 'rooms', Resort: 'resorts', Cottage: 'cottages', Villa: 'villas' }
export const typeFromSlug = (slug: string) => (Object.entries(TYPE_SLUGS).find(([, s]) => s === slug)?.[0] as PropertyType | undefined)

/** A town or state with live stays. */
export interface Destination {
  slug: string
  name: string
  /** city: a town or city ("Coorg, Karnataka"). state: a whole state or region. */
  kind: 'city' | 'state'
  /** For cities, the state they're in. */
  region: string | null
  stays: number
  image: string
  lat: number
  lng: number
  types: PropertyType[]
}
