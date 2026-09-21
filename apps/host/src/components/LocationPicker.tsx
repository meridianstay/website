import { useEffect, useRef, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { hostApi } from '@meridian/shared/client'
import type { Place } from '@meridian/shared'

// Setting the location is the step hosts get stuck on, so it does the work for them: search for the
// address, or tap "use my location", and the pin, town, state, country and address all follow. The
// pin can still be dragged or the map clicked for the last few metres.

const pin = L.divIcon({
  className: '',
  html: '<span style="display:block;transform:translate(-50%,-100%);color:#059669;font-size:36px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))"><i class="fa-solid fa-location-dot"></i></span>',
})

function ClickToPlace({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onChange(round(e.latlng.lat), round(e.latlng.lng)) })
  return null
}

/** Moves the map when the pin is set from the search box or the browser's location. */
function FollowPin({ lat, lng, zoom }: { lat: number | null; lng: number | null; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    if (lat !== null && lng !== null) map.setView([lat, lng], Math.max(map.getZoom(), zoom))
  }, [lat, lng, zoom, map])
  return null
}

const round = (n: number) => Number(n.toFixed(6))

export interface PickedLocation {
  lat: number
  lng: number
  /** Only sent when the address search or the browser knew them, so nothing the host typed is lost. */
  city?: string
  region?: string
  country?: string
  address?: string
}

interface Props {
  lat: number | null
  lng: number | null
  onChange: (picked: PickedLocation) => void
}

/** Search for an address, use your location, or drop the pin by hand. */
export default function LocationPicker({ lat, lng, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[] | null>(null)
  const [busy, setBusy] = useState<'search' | 'locate' | 'address' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [found, setFound] = useState<string | null>(null)
  const [zoom, setZoom] = useState(lat !== null ? 15 : 4)
  const latest = useRef(0)
  const has = lat !== null && lng !== null

  const search = async () => {
    setError(null)
    setBusy('search')
    try {
      setResults((await hostApi.places(query)).places)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const use = (p: Place) => {
    setResults(null)
    setQuery('')
    setFound(p.label)
    setZoom(16)
    onChange({ lat: round(p.lat), lng: round(p.lng), city: p.city, region: p.region, country: p.country, address: p.address })
  }

  /** After the pin moves, fill in the town and state from wherever it landed. */
  const describe = async (la: number, ln: number) => {
    const ticket = ++latest.current
    onChange({ lat: la, lng: ln })
    setBusy('address')
    try {
      const { place } = await hostApi.placeAt(la, ln)
      if (ticket !== latest.current) return
      if (place) {
        setFound(place.label)
        onChange({ lat: la, lng: ln, city: place.city, region: place.region, country: place.country })
      }
    } catch {
      // The map service is optional: the pin is already set.
    } finally {
      if (ticket === latest.current) setBusy(null)
    }
  }

  const locate = () => {
    setError(null)
    if (!navigator.geolocation) return setError('This browser can’t share your location. Search for the address instead.')
    setBusy('locate')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setZoom(17)
        describe(round(pos.coords.latitude), round(pos.coords.longitude))
      },
      () => {
        setBusy(null)
        setError('We couldn’t get your location. Allow location for this site, or search for the address.')
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" aria-hidden="true"></i>
          <input
            aria-label="Search for your property’s address"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (query.trim().length >= 3) search() } }}
            placeholder="Search: village, road, landmark or PIN code"
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 pl-10 text-sm focus:outline-none focus:border-brand-500"
          />
        </div>
        <button type="button" onClick={search} disabled={query.trim().length < 3 || busy === 'search'}
          className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-bold py-3 px-5 rounded-2xl shrink-0">
          {busy === 'search' ? 'Searching…' : 'Search'}
        </button>
        <button type="button" onClick={locate} disabled={busy === 'locate'}
          className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 text-sm font-bold py-3 px-5 rounded-2xl shrink-0">
          <i className="fa-solid fa-location-crosshairs mr-2" aria-hidden="true"></i>{busy === 'locate' ? 'Finding…' : 'I’m there now'}
        </button>
      </div>

      {results && (
        results.length === 0
          ? <p className="text-xs text-slate-500">Nothing found. Try the nearest village, road or landmark, then drag the pin the rest of the way.</p>
          : (
            <ul className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
              {results.map((p) => (
                <li key={`${p.lat},${p.lng}`}>
                  <button type="button" onClick={() => use(p)} className="w-full text-left p-3 text-sm hover:bg-brand-50">
                    <i className="fa-solid fa-location-dot text-brand-600 mr-2" aria-hidden="true"></i>{p.label}
                  </button>
                </li>
              ))}
            </ul>
          )
      )}

      <MapContainer center={has ? [lat, lng] : [20.59, 78.96]} zoom={zoom} scrollWheelZoom className="h-96 w-full rounded-2xl z-0">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickToPlace onChange={(la, ln) => describe(la, ln)} />
        <FollowPin lat={lat} lng={lng} zoom={zoom} />
        {has && (
          <Marker
            position={[lat, lng]}
            icon={pin}
            draggable
            eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); describe(round(p.lat), round(p.lng)) } }}
          />
        )}
      </MapContainer>

      {error && <p role="alert" className="text-xs text-rose-600 font-semibold">{error}</p>}
      {busy === 'address' && <p className="text-xs text-slate-500"><i className="fa-solid fa-spinner fa-spin mr-1.5" aria-hidden="true"></i>Looking up the address…</p>}
      {found && busy !== 'address' && <p className="text-xs text-slate-600"><i className="fa-solid fa-circle-check text-brand-600 mr-1.5" aria-hidden="true"></i>{found}</p>}
    </div>
  )
}
