import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const pin = L.divIcon({
  className: '',
  html: '<span style="display:block;transform:translate(-50%,-100%);color:#059669;font-size:32px;line-height:1"><i class="fa-solid fa-location-dot"></i></span>',
})

function ClickToPlace({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onChange(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))) })
  return null
}

/** Click the map to drop the listing's pin. */
export default function LocationPicker({ lat, lng, onChange }: { lat: number | null; lng: number | null; onChange: (lat: number, lng: number) => void }) {
  const has = lat !== null && lng !== null
  return (
    <MapContainer center={has ? [lat, lng] : [20.59, 78.96]} zoom={has ? 10 : 4} className="h-72 w-full rounded-2xl z-0">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ClickToPlace onChange={onChange} />
      {has && (
        <Marker
          position={[lat, lng]}
          icon={pin}
          draggable
          eventHandlers={{ dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onChange(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6))) } }}
        />
      )}
    </MapContainer>
  )
}
