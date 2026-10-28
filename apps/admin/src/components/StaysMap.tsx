import { useEffect } from 'react'
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { formatPrice, type MapPoint } from '@meridian/shared'

// Where the live stays are. Busier places are drawn larger, and a client with a website of their
// own is marked, so the map says something at a glance rather than just plotting dots.

const pin = (point: MapPoint, busiest: number) => {
  const size = 18 + Math.round((point.bookings / Math.max(busiest, 1)) * 16)
  const shade = point.hasSite ? 'background:#0f766e' : 'background:#64748b'
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    html: `<span style="${shade};width:${size}px;height:${size}px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700;border:2px solid #fff;box-shadow:0 2px 6px rgb(15 23 42 / .35)">${point.bookings || ''}</span>`,
  })
}

function Fit({ points }: { points: MapPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 8)
    else map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [36, 36], maxZoom: 8 })
  }, [map, points])
  return null
}

/** Lazy-loaded, so the map's weight is only paid by the dashboard. */
export default function StaysMap({ points }: { points: MapPoint[] }) {
  if (!points.length) {
    return <p className="text-sm text-slate-500">No live stay has a position on the map yet.</p>
  }
  const busiest = Math.max(...points.map((p) => p.bookings))

  return (
    <>
      <div className="h-80 rounded-2xl overflow-hidden border border-slate-200">
        <MapContainer center={[20.6, 78.9]} zoom={4} scrollWheelZoom={false} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Fit points={points} />
          {points.map((p) => (
            <Marker key={p.id} position={[p.lat, p.lng]} icon={pin(p, busiest)}>
              <Tooltip direction="top" offset={[0, -8]}>
                <span className="font-bold">{p.title}</span>
                <br />{p.city}, {p.region} · {formatPrice(p.price)} a night
                <br />{p.bookings} {p.bookings === 1 ? 'booking' : 'bookings'}{p.hasSite ? ' · has its own website' : ''}
              </Tooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3 text-xs text-slate-500">
        <span><span className="inline-block w-3 h-3 rounded-full align-middle mr-1.5" style={{ background: '#0f766e' }} />Client has their own website</span>
        <span><span className="inline-block w-3 h-3 rounded-full align-middle mr-1.5" style={{ background: '#64748b' }} />On the marketplace only</span>
        <span>Larger means more bookings taken.</span>
      </div>
    </>
  )
}
