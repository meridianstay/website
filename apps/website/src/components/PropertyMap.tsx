import { useEffect } from 'react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { formatPrice, type PropertySummary } from '@meridian/shared'

type Pin = Pick<PropertySummary, 'id' | 'slug' | 'title' | 'price' | 'lat' | 'lng'>

interface Props {
  pins: Pin[]
  highlightId?: number | null
  onSelect?: (pin: Pin) => void
  /** Show a plain location pin instead of price tags (single-stay pages). */
  plain?: boolean
  zoom?: number
}

const priceIcon = (pin: Pin, active: boolean) =>
  L.divIcon({
    className: '',
    iconSize: undefined,
    html: `<span class="ms-pin${active ? ' ms-pin-active' : ''}">${formatPrice(pin.price)}</span>`,
  })

const plainIcon = L.divIcon({
  className: '',
  html: '<span class="ms-pin ms-pin-active"><i class="fa-solid fa-house"></i></span>',
})

function FitBounds({ pins, zoom }: { pins: Pin[]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    if (!pins.length) return
    if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], zoom)
    else map.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 9 })
  }, [map, pins, zoom])
  return null
}

/** OpenStreetMap map with price markers. Lazy-loaded so it doesn't weigh down other pages. */
export default function PropertyMap({ pins, highlightId, onSelect, plain = false, zoom = 11 }: Props) {
  const center: [number, number] = pins.length ? [pins[0].lat, pins[0].lng] : [20.59, 78.96]
  return (
    <MapContainer center={center} zoom={pins.length ? zoom : 4} scrollWheelZoom={false} className="h-full w-full z-0">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds pins={pins} zoom={zoom} />
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.lat, pin.lng]}
          icon={plain ? plainIcon : priceIcon(pin, pin.id === highlightId)}
          zIndexOffset={pin.id === highlightId ? 1000 : 0}
          title={pin.title}
          eventHandlers={onSelect ? { click: () => onSelect(pin) } : undefined}
        />
      ))}
    </MapContainer>
  )
}
