import { AppError } from '../http/errors'

// Address search for the host's map, proxied through us so OpenStreetMap sees one well-behaved
// caller (their policy asks for an identifying User-Agent and at most one request a second).
// Answers are cached for an hour, which covers the repeated searches of someone adjusting a pin.

const ENDPOINT = 'https://nominatim.openstreetmap.org'
const AGENT = 'MeridianStay/1.0 (https://meridianstay.com; listings map)'
const CACHE_MS = 60 * 60_000
const MIN_GAP_MS = 1100

export interface Place {
  label: string
  lat: number
  lng: number
  city: string
  region: string
  country: string
  /** A street-level address when OpenStreetMap has one, for the host to edit. */
  address: string
}

const cache = new Map<string, { at: number; value: Place[] }>()
let lastCall = 0

/** One request at a time, at most one a second, as OpenStreetMap asks. */
let queue: Promise<unknown> = Promise.resolve()
function polite<T>(run: () => Promise<T>): Promise<T> {
  const next = queue.then(async () => {
    const wait = lastCall + MIN_GAP_MS - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    lastCall = Date.now()
    return run()
  })
  queue = next.catch(() => {})
  return next
}

interface NominatimPlace {
  lat: string
  lon: string
  display_name?: string
  name?: string
  address?: Record<string, string>
}

/** OpenStreetMap spreads the town across half a dozen fields; take the most specific one. */
function toPlace(raw: NominatimPlace): Place {
  const a = raw.address ?? {}
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.suburb ?? a.county ?? ''
  const street = [a.house_number, a.road, a.neighbourhood ?? a.suburb, a.village ?? a.town].filter(Boolean).join(', ')
  return {
    label: raw.display_name ?? raw.name ?? city,
    lat: Number(raw.lat),
    lng: Number(raw.lon),
    city,
    region: a.state ?? a.region ?? '',
    country: a.country ?? '',
    address: [street, a.postcode].filter(Boolean).join(' - '),
  }
}

async function ask(path: string, params: Record<string, string>): Promise<NominatimPlace[]> {
  const url = new URL(`${ENDPOINT}/${path}`)
  for (const [k, v] of Object.entries({ format: 'jsonv2', addressdetails: '1', ...params })) url.searchParams.set(k, v)
  const res = await polite(() => fetch(url, { headers: { 'User-Agent': AGENT, 'Accept-Language': 'en' } }))
  if (!res.ok) throw new AppError(502, 'The map service isn’t answering right now. Drop the pin by hand and try the search again later.')
  const body = await res.json()
  return Array.isArray(body) ? (body as NominatimPlace[]) : [body as NominatimPlace]
}

export const geocodeService = {
  /** Places matching what the host typed, best match first. */
  async search(query: string, country = 'in'): Promise<Place[]> {
    const q = query.trim()
    if (q.length < 3) throw new AppError(400, 'Type at least three letters of the address.')
    const key = `q:${country}:${q.toLowerCase()}`
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value
    const places = (await ask('search', { q, limit: '6', countrycodes: country })).map(toPlace).filter((p) => Number.isFinite(p.lat))
    cache.set(key, { at: Date.now(), value: places })
    return places
  },

  /** The address at a point, used after the host drags the pin or taps "use my location". */
  async reverse(lat: number, lng: number): Promise<Place | null> {
    if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) throw new AppError(400, 'That isn’t a place on the map.')
    const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value[0] ?? null
    const places = (await ask('reverse', { lat: String(lat), lon: String(lng), zoom: '18' })).map(toPlace)
    cache.set(key, { at: Date.now(), value: places })
    return places[0] ?? null
  },
}
