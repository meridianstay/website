import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ErrorNote, PageHeader, PhotoUpload, Spinner } from '@meridian/ui'
import { commissionMinor, commissionPct, defaultCommission, formatPrice, quoteStay, addDays, todayISO, type Amenity, type Management, type PropertyType } from '@meridian/shared'
import { ApiError, api, hostApi, type ListingInput } from '@meridian/shared/client'

const LocationPicker = lazy(() => import('../components/LocationPicker'))

const propertyTypes: { type: PropertyType; icon: string; blurb: string }[] = [
  { type: 'Farmstay', icon: 'seedling', blurb: 'A working farm, estate or orchard' },
  { type: 'Room', icon: 'door-open', blurb: 'A private room in your home' },
  { type: 'Cottage', icon: 'house-chimney', blurb: 'A standalone woodland or hillside home' },
  { type: 'Villa', icon: 'hotel', blurb: 'A large private home, often with a pool' },
  { type: 'Resort', icon: 'umbrella-beach', blurb: 'Several units with shared amenities' },
]

const steps = ['Property type', 'Location', 'Rooms & amenities', 'Photos & description', 'Price', 'Review']

// Which step each server-side field error belongs to.
const fieldStep: Record<string, number> = {
  type: 0, title: 1, city: 1, region: 1, location: 1, beds: 2, baths: 2, maxGuests: 2,
  coverImage: 3, photos: 3, description: 3, price: 4,
}

type Draft = Omit<ListingInput, 'type' | 'lat' | 'lng'> & { type: PropertyType | null; lat: number | null; lng: number | null; photoText: string }

const emptyDraft: Draft = {
  type: null, title: '', description: '', city: '', region: '', country: 'India', price: 100, beds: 1, baths: 1, maxGuests: 2,
  lat: null, lng: null, coverImage: '', photos: [], photoText: '', amenities: [],
}

const inputClass = 'w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500'
const isUrl = (s: string) => /^https?:\/\/\S+$/.test(s.trim())

export function ListingEditor() {
  const { id } = useParams()
  const editingId = id ? Number(id) : null
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft | null>(editingId ? null : emptyDraft)
  const [amenities, setAmenities] = useState<Amenity[]>([])
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [management, setManagement] = useState<Management>('self')
  const [rates, setRates] = useState(defaultCommission)

  useEffect(() => {
    hostApi.amenities().then((r) => setAmenities(r.amenities)).catch(() => {})
    api.site().then((s) => setRates(s.commission)).catch(() => {})
    if (editingId) {
      hostApi
        .listing(editingId)
        .then(({ listing }) => {
          setManagement(listing.management)
          setDraft({ ...listing, photoText: listing.photos.join('\n') })
        })
        .catch((e) => setError(e.message))
    }
  }, [editingId])

  if (error && !draft) return <ErrorNote message={error} />
  if (!draft) return <Spinner />

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => d && { ...d, [key]: value })
  const photos = draft.photoText.split('\n').map((s) => s.trim()).filter(Boolean)

  const stepValid = [
    draft.type !== null,
    draft.title.trim().length >= 3 && draft.city.trim().length >= 2 && draft.region.trim().length >= 2 && draft.lat !== null,
    draft.maxGuests >= 1,
    isUrl(draft.coverImage) && photos.every(isUrl) && draft.description.trim().length >= 20,
    draft.price >= 1,
    true,
  ][step]

  const submit = async () => {
    setSaving(true)
    setError(null)
    setFields({})
    const payload: ListingInput = { ...draft, type: draft.type!, lat: draft.lat!, lng: draft.lng!, photos }
    try {
      if (editingId) await hostApi.updateListing(editingId, payload)
      else await hostApi.createListing(payload)
      navigate('/listings', { replace: true })
    } catch (err) {
      const e = err as ApiError
      setFields(e.fields)
      setError(e.message)
      const first = Object.keys(e.fields).map((k) => fieldStep[k]).filter((n) => n !== undefined).sort()[0]
      if (first !== undefined) setStep(first)
      setSaving(false)
    }
  }

  const sample = quoteStay(draft.price, todayISO(), addDays(todayISO(), 2), 2)
  const pct = commissionPct(management, rates)
  const payout = (Math.round(sample.total * 100) - commissionMinor(Math.round(sample.total * 100), pct)) / 100

  return (
    <>
      <PageHeader
        eyebrow="Meridian Host Portal"
        title={editingId ? 'Edit listing' : 'List your property'}
        description={editingId ? 'Saving changes sends the listing back for a quick review before it goes live again.' : 'Share your farmstay, room, resort, cottage or villa with travellers.'}
      />

      <ol className="flex flex-wrap gap-2 mb-8" aria-label="Steps">
        {steps.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              aria-current={i === step ? 'step' : undefined}
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${i === step ? 'bg-brand-600 text-white' : i < step ? 'bg-brand-100 text-brand-700 hover:bg-brand-200' : 'bg-slate-100 text-slate-500'}`}
            >
              {i < step && <i className="fa-solid fa-check mr-1.5" aria-hidden="true"></i>}
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm max-w-3xl space-y-5">
        {error && <ErrorNote message={error} />}

        {step === 0 && (
          <fieldset>
            <legend className="text-lg font-bold text-slate-900 mb-4">What kind of place are you listing?</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {propertyTypes.map((t) => (
                <button key={t.type} type="button" onClick={() => update('type', t.type)} aria-pressed={draft.type === t.type}
                  className={`text-left p-4 rounded-2xl border-2 transition flex items-start space-x-3 ${draft.type === t.type ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200 hover:border-slate-300'}`}>
                  <i className={`fa-solid fa-${t.icon} text-brand-600 text-lg mt-0.5 w-6 text-center`} aria-hidden="true"></i>
                  <span><span className="block font-bold text-sm text-slate-900">{t.type}</span><span className="block text-xs text-slate-500">{t.blurb}</span></span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Field label="Listing title" id="title" error={fields.title}>
              <input id="title" className={inputClass} value={draft.title} maxLength={120} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Whispering Pines Woodland Cottage" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="City or town" id="city" error={fields.city}>
                <input id="city" className={inputClass} value={draft.city} onChange={(e) => update('city', e.target.value)} placeholder="Coorg" />
              </Field>
              <Field label="State or region" id="region" error={fields.region}>
                <input id="region" className={inputClass} value={draft.region} onChange={(e) => update('region', e.target.value)} placeholder="Karnataka" />
              </Field>
              <Field label="Country" id="country">
                <input id="country" className={inputClass} value={draft.country} onChange={(e) => update('country', e.target.value)} />
              </Field>
            </div>
            <div>
              <p className="block text-xs font-bold uppercase text-slate-500 mb-1">Map location</p>
              <p className="text-xs text-slate-400 mb-2">Click the map to drop a pin on your property, then drag it to adjust. Guests see the area, not the exact address.</p>
              <Suspense fallback={<div className="h-72 rounded-2xl bg-slate-100" />}>
                <LocationPicker lat={draft.lat} lng={draft.lng} onChange={(lat, lng) => setDraft((d) => d && { ...d, lat, lng })} />
              </Suspense>
              <p className={`text-xs mt-2 ${fields.location ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
                {fields.location ?? (draft.lat !== null ? `Pin set at ${draft.lat}, ${draft.lng}` : 'No pin yet.')}
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Counter label="Bedrooms" value={draft.beds} min={0} onChange={(v) => update('beds', v)} />
              <Counter label="Bathrooms" value={draft.baths} min={0} onChange={(v) => update('baths', v)} />
              <Counter label="Max guests" value={draft.maxGuests} min={1} onChange={(v) => update('maxGuests', v)} />
            </div>
            <fieldset>
              <legend className="block text-xs font-bold uppercase text-slate-500 mb-3">Amenities</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {amenities.map((a) => {
                  const on = draft.amenities.includes(a.name)
                  return (
                    <label key={a.name} className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer text-sm ${on ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200'}`}>
                      <input type="checkbox" className="accent-brand-600" checked={on} onChange={() => update('amenities', on ? draft.amenities.filter((x) => x !== a.name) : [...draft.amenities, a.name])} />
                      <i className={`fa-solid fa-${a.icon} w-4 text-brand-600`} aria-hidden="true"></i>
                      <span>{a.name}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <p className="block text-xs font-bold uppercase text-slate-500 mb-2">Cover photo</p>
              {isUrl(draft.coverImage) ? (
                <div className="relative">
                  <img src={draft.coverImage} alt="Cover preview" className="h-48 w-full object-cover rounded-2xl border border-slate-200 animate-fade-in" />
                  <button type="button" onClick={() => update('coverImage', '')} className="absolute top-3 right-3 bg-white/90 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow">Replace</button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center space-y-3">
                  <PhotoUpload purpose="listing" label="Upload cover photo" onUploaded={(url) => update('coverImage', url)} />
                  <details className="text-xs text-slate-500">
                    <summary className="cursor-pointer">or paste a photo link</summary>
                    <input aria-label="Cover photo link" type="url" className={`${inputClass} mt-2`} value={draft.coverImage} onChange={(e) => update('coverImage', e.target.value)} placeholder="https://…" />
                  </details>
                </div>
              )}
              {fields.coverImage && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.coverImage}</p>}
            </div>

            <div>
              <p className="block text-xs font-bold uppercase text-slate-500 mb-2">More photos ({photos.length}/12)</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photos.map((src, i) => (
                  <div key={src + i} className="relative group">
                    <img src={src} alt="" className="h-20 w-full object-cover rounded-xl animate-fade-in" />
                    <button type="button" aria-label="Remove photo" onClick={() => update('photoText', photos.filter((_, j) => j !== i).join('\n'))}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 text-rose-600 text-xs shadow opacity-80 group-hover:opacity-100">
                      <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                    </button>
                  </div>
                ))}
              </div>
              {photos.length < 12 && (
                <PhotoUpload className="mt-3" purpose="listing" label="Add photo" onUploaded={(url) => update('photoText', [...photos, url].join('\n'))} />
              )}
              {fields.photos && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.photos}</p>}
            </div>

            <Field label="Description" id="description" error={fields.description} hint={`At least 20 characters. Leave a blank line between paragraphs. (${draft.description.trim().length})`}>
              <textarea id="description" rows={6} maxLength={4000} className={inputClass} value={draft.description} onChange={(e) => update('description', e.target.value)} />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <Field label="Price per night (₹)" id="price" error={fields.price} hint="This price covers 2 guests. Each extra guest adds 15%.">
              <input id="price" type="number" min={1} max={100000} className={inputClass} value={draft.price} onChange={(e) => update('price', Number(e.target.value))} />
            </Field>
            <div className="bg-slate-50 rounded-2xl p-4 text-sm text-slate-600">
              A 2-night stay for 2 guests costs guests <span className="font-bold text-slate-900">{formatPrice(sample.total)}</span>, with no booking fee added.
              After Meridian’s {pct}% commission you receive <span className="font-bold text-slate-900">{formatPrice(payout)}</span>.
              <p className="text-xs text-slate-500 mt-2">
                {management === 'managed'
                  ? 'This property is managed by Meridian Stay: guests book instantly, and we handle upkeep and guest care.'
                  : 'You manage this property yourself: guests send booking requests, which you accept or decline within 24 hours.'}
              </p>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Check your listing</h2>
            {isUrl(draft.coverImage) && <img src={draft.coverImage} alt="" className="h-48 w-full object-cover rounded-2xl mb-4" />}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <Row label="Type" value={draft.type ?? ''} />
              <Row label="Title" value={draft.title} />
              <Row label="Location" value={`${draft.city}, ${draft.region}, ${draft.country}`} />
              <Row label="Size" value={`${draft.beds} bedrooms · ${draft.baths} bathrooms · up to ${draft.maxGuests} guests`} />
              <Row label="Price" value={`${formatPrice(draft.price)} / night`} />
              <Row label="Photos" value={`${1 + photos.length}`} />
              <Row label="Amenities" value={draft.amenities.join(', ') || 'None'} />
            </dl>
            <p className="text-sm text-slate-600 mt-4 whitespace-pre-line">{draft.description}</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-6 border-t border-slate-100">
          {step === 0 ? (
            <Link to="/listings" className="text-sm font-bold text-slate-600 hover:text-slate-900">Cancel</Link>
          ) : (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="text-sm font-bold text-slate-600 hover:text-slate-900">Back</button>
          )}
          {step < steps.length - 1 ? (
            <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!stepValid} className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-bold py-3 px-8 rounded-2xl text-sm transition">
              Continue
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={saving} className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-400 text-white font-bold py-3 px-8 rounded-2xl text-sm shadow-lg shadow-brand-500/25 transition">
              {saving ? 'Submitting…' : editingId ? 'Save and send for review' : 'Submit for review'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function Field({ label, id, hint, error, children }: { label: string; id: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold uppercase text-slate-500 mb-1">{label}</label>
      {children}
      {(error || hint) && <p className={`text-xs mt-1 ${error ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>{error ?? hint}</p>}
    </div>
  )
}

function Counter({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (v: number) => void }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
      <span className="block text-[10px] font-bold uppercase text-slate-500 mb-2">{label}</span>
      <div className="flex items-center justify-between">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="w-7 h-7 rounded-full bg-white border border-slate-200 font-bold disabled:opacity-30">−</button>
        <span className="font-bold text-sm tabular-nums">{value}</span>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(Math.min(50, value + 1))} className="w-7 h-7 rounded-full bg-white border border-slate-200 font-bold">+</button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase text-slate-400">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  )
}
