import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ErrorNote, PageHeader, PhotoUpload, Spinner } from '@meridian/ui'
import { commissionMinor, commissionPct, defaultCommission, defaultDayUse, defaultHouseRules, discountedPrice, embedUrl, formatPrice, formatTime, HOUSE_RULES, quoteDayUse, quoteStay, addDays, todayISO, type Amenity, type DayUseSettings, type HouseRules, type Management, type PropertyType } from '@meridian/shared'
import { ApiError, api, hostApi, type ListingInput } from '@meridian/shared/client'

const LocationPicker = lazy(() => import('../components/LocationPicker'))

const propertyTypes: { type: PropertyType; icon: string; blurb: string }[] = [
  { type: 'Farmstay', icon: 'seedling', blurb: 'A working farm, estate or orchard' },
  { type: 'Room', icon: 'door-open', blurb: 'A private room in your home' },
  { type: 'Cottage', icon: 'house-chimney', blurb: 'A standalone woodland or hillside home' },
  { type: 'Villa', icon: 'hotel', blurb: 'A large private home, often with a pool' },
  { type: 'Resort', icon: 'umbrella-beach', blurb: 'Several units with shared amenities' },
]

const steps = ['Property type', 'Location', 'Rooms & amenities', 'Photos & description', 'House rules', 'Price', 'Review']

// Which step each server-side field error belongs to.
const fieldStep: Record<string, number> = {
  type: 0, title: 1, city: 1, region: 1, location: 1, address: 1, beds: 2, baths: 2, maxGuests: 2, areaSqft: 2, gatheringCapacity: 2,
  coverImage: 3, photos: 3, description: 3, videoUrl: 3,
  checkInTime: 4, checkOutTime: 4, securityDeposit: 4, houseRulesNotes: 4, quietAfter: 4,
  price: 5, overnight: 5, discountPct: 5, dayUsePrice: 5, dayUseExtra: 5, dayUseBlock: 5, dayUseHours: 5,
}

type Draft = Omit<ListingInput, 'type' | 'lat' | 'lng'> & { type: PropertyType | null; lat: number | null; lng: number | null; photoText: string }

const emptyDraft: Draft = {
  type: null, title: '', description: '', city: '', region: '', country: 'India', price: 3000, beds: 1, baths: 1, maxGuests: 2,
  lat: null, lng: null, coverImage: '', photos: [], photoText: '', amenities: [],
  areaSqft: null, gatheringCapacity: null, checkInTime: '14:00', checkOutTime: '11:00', houseRules: { ...defaultHouseRules },
  securityDeposit: 0, address: '', overnight: true, dayUse: { ...defaultDayUse }, discountPct: 0, videoUrl: '',
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
    true,
    (draft.overnight || draft.dayUse.enabled) && (!draft.overnight || draft.price >= 1) && (!draft.dayUse.enabled || draft.dayUse.price >= 1),
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

  const setRules = (patch: Partial<HouseRules>) => setDraft((d) => d && { ...d, houseRules: { ...d.houseRules, ...patch } })
  const setDayUse = (patch: Partial<DayUseSettings>) => setDraft((d) => d && { ...d, dayUse: { ...d.dayUse, ...patch } })
  const daySample = quoteDayUse(draft.dayUse, draft.dayUse.blockHours + 2)
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
            <Field label="Full address" id="address" error={fields.address} hint="Only shared with guests once their booking is confirmed.">
              <textarea id="address" rows={2} maxLength={300} className={inputClass} value={draft.address} onChange={(e) => update('address', e.target.value)} placeholder="House / farm name, road, village, landmark, PIN code" />
            </Field>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Area in sq ft (optional)" id="areaSqft" error={fields.areaSqft}>
                <input id="areaSqft" type="number" min={50} className={inputClass} value={draft.areaSqft ?? ''} onChange={(e) => update('areaSqft', e.target.value ? Number(e.target.value) : null)} placeholder="e.g. 2400" />
              </Field>
              <Field label="Gathering capacity (optional)" id="gatheringCapacity" error={fields.gatheringCapacity} hint="Most people for a day event or party. Can be more than overnight guests.">
                <input id="gatheringCapacity" type="number" min={1} className={inputClass} value={draft.gatheringCapacity ?? ''} onChange={(e) => update('gatheringCapacity', e.target.value ? Number(e.target.value) : null)} placeholder="e.g. 25" />
              </Field>
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

            <div>
              <p className="block text-xs font-bold uppercase text-slate-500 mb-2">Video tour (optional)</p>
              <p className="text-xs text-slate-500 mb-3">
                Videos live on the <strong>Meridian Stay YouTube channel</strong>, not on this site, so pages stay fast.
                Send your clip to our team, or upload it to YouTube yourself, then paste the link here. A 30–60 second walk-through works best.
                You can leave this empty and add it later.
              </p>
              {embedUrl(draft.videoUrl) && (
                <iframe src={embedUrl(draft.videoUrl)!} title="Video preview" className="w-full aspect-video rounded-2xl mb-3" allow="encrypted-media; picture-in-picture" allowFullScreen />
              )}
              <input aria-label="YouTube or Vimeo link" type="url" className={inputClass} value={draft.videoUrl}
                onChange={(e) => update('videoUrl', e.target.value.trim())} placeholder="https://youtu.be/…" />
              {fields.videoUrl && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.videoUrl}</p>}
            </div>

            <Field label="Description" id="description" error={fields.description} hint={`At least 20 characters. Leave a blank line between paragraphs. (${draft.description.trim().length})`}>
              <textarea id="description" rows={6} maxLength={4000} className={inputClass} value={draft.description} onChange={(e) => update('description', e.target.value)} />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Check-in time" id="checkInTime" error={fields.checkInTime}>
                <TimeSelect id="checkInTime" value={draft.checkInTime} onChange={(v) => update('checkInTime', v)} />
              </Field>
              <Field label="Check-out time" id="checkOutTime" error={fields.checkOutTime}>
                <TimeSelect id="checkOutTime" value={draft.checkOutTime} onChange={(v) => update('checkOutTime', v)} />
              </Field>
            </div>
            <fieldset>
              <legend className="block text-xs font-bold uppercase text-slate-500 mb-3">What guests may do</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {HOUSE_RULES.map((r) => {
                  const on = draft.houseRules[r.key]
                  return (
                    <label key={r.key} className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer text-sm ${on ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200'}`}>
                      <span className="flex items-center gap-3">
                        <i className={`fa-solid fa-${r.icon} w-4 text-brand-600`} aria-hidden="true"></i>
                        <span><span className="block font-semibold text-slate-900">{r.label}</span><span className="block text-xs text-slate-500">{on ? r.yes : r.no}</span></span>
                      </span>
                      <input type="checkbox" role="switch" className="accent-brand-600 w-4 h-4" checked={on} onChange={() => setRules({ [r.key]: !on })} />
                    </label>
                  )
                })}
              </div>
            </fieldset>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Quiet hours from" id="quietAfter" error={fields.quietAfter} hint="Leave as “No quiet hours” if there are none.">
                <TimeSelect id="quietAfter" value={draft.houseRules.quietAfter} allowEmpty onChange={(v) => setRules({ quietAfter: v })} />
              </Field>
              <Field label="Refundable security deposit (₹)" id="securityDeposit" error={fields.securityDeposit} hint="Collected at check-in and returned at check-out. 0 for none.">
                <input id="securityDeposit" type="number" min={0} step={500} className={inputClass} value={draft.securityDeposit} onChange={(e) => update('securityDeposit', Number(e.target.value))} />
              </Field>
            </div>
            <Field label="Other rules (optional)" id="houseRulesNotes" error={fields.houseRulesNotes} hint="E.g. music off by 11 pm, no outside caterers, ID for every adult.">
              <textarea id="houseRulesNotes" rows={3} maxLength={1000} className={inputClass} value={draft.houseRules.notes} onChange={(e) => setRules({ notes: e.target.value })} />
            </Field>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            {fields.overnight && <p className="text-xs text-rose-600 font-semibold">{fields.overnight}</p>}
            <section className={`rounded-2xl border-2 p-4 space-y-4 ${draft.overnight ? 'border-brand-500' : 'border-slate-200'}`}>
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span><span className="block font-bold text-slate-900"><i className="fa-solid fa-moon text-brand-600 mr-2" aria-hidden="true"></i>Overnight stays</span><span className="block text-xs text-slate-500">Guests stay from check-in to check-out the next day or later.</span></span>
                <input type="checkbox" role="switch" className="accent-brand-600 w-5 h-5" checked={draft.overnight} onChange={(e) => update('overnight', e.target.checked)} />
              </label>
              {draft.overnight && (
                <>
                  <Field label="Price per night (₹)" id="price" error={fields.price} hint="This price covers 2 guests. Each extra guest adds 15%.">
                    <input id="price" type="number" min={1} max={100000} className={inputClass} value={draft.price} onChange={(e) => update('price', Number(e.target.value))} />
                  </Field>
                  <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3">
                    A 2-night stay for 2 guests costs <span className="font-bold text-slate-900">{formatPrice(sample.total)}</span>, with no booking fee added. After Meridian’s {pct}% commission you receive <span className="font-bold text-slate-900">{formatPrice(payout)}</span>.
                  </p>
                </>
              )}
            </section>

            <section className={`rounded-2xl border-2 p-4 space-y-4 ${draft.dayUse.enabled ? 'border-brand-500' : 'border-slate-200'}`}>
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span><span className="block font-bold text-slate-900"><i className="fa-solid fa-sun text-brand-yellow-500 mr-2" aria-hidden="true"></i>Day use (“Day out”)</span><span className="block text-xs text-slate-500">Picnics, pool days, parties and get-togethers, booked by the hour on a single day.</span></span>
                <input type="checkbox" role="switch" className="accent-brand-600 w-5 h-5" checked={draft.dayUse.enabled} onChange={(e) => setDayUse({ enabled: e.target.checked })} />
              </label>
              {draft.dayUse.enabled && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="Hours included" id="blockHours" error={fields.dayUseBlock} hint="Also the shortest booking.">
                      <select id="blockHours" className={inputClass} value={draft.dayUse.blockHours} onChange={(e) => setDayUse({ blockHours: Number(e.target.value) })}>
                        {[2, 3, 4, 5, 6, 8, 10, 12].map((h) => <option key={h} value={h}>{h} hours</option>)}
                      </select>
                    </Field>
                    <Field label={`Price for ${draft.dayUse.blockHours} hours (₹)`} id="dayUsePrice" error={fields.dayUsePrice}>
                      <input id="dayUsePrice" type="number" min={1} className={inputClass} value={draft.dayUse.price} onChange={(e) => setDayUse({ price: Number(e.target.value) })} />
                    </Field>
                    <Field label="Each extra hour (₹)" id="dayUseExtra" error={fields.dayUseExtra}>
                      <input id="dayUseExtra" type="number" min={0} className={inputClass} value={draft.dayUse.extraHourPrice} onChange={(e) => setDayUse({ extraHourPrice: Number(e.target.value) })} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Earliest start" id="opensAt" error={fields.dayUseHours}>
                      <TimeSelect id="opensAt" value={draft.dayUse.opensAt} onChange={(v) => setDayUse({ opensAt: v })} />
                    </Field>
                    <Field label="Latest finish" id="closesAt">
                      <TimeSelect id="closesAt" value={draft.dayUse.closesAt} onChange={(v) => setDayUse({ closesAt: v })} />
                    </Field>
                  </div>
                  <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3">
                    A {draft.dayUse.blockHours + 2}-hour day out costs guests <span className="font-bold text-slate-900">{formatPrice(daySample.total)}</span>. Day use fits around overnight guests automatically: it has to finish by check-in time ({formatTime(draft.checkInTime)}) when guests arrive, and start after check-out ({formatTime(draft.checkOutTime)}) when they leave.
                  </p>
                </>
              )}
            </section>
            <section className={`rounded-2xl border-2 p-4 space-y-3 ${draft.discountPct > 0 ? 'border-rose-300' : 'border-slate-200'}`}>
              <p className="font-bold text-slate-900"><i className="fa-solid fa-tag text-rose-500 mr-2" aria-hidden="true"></i>Discount (optional)</p>
              <p className="text-xs text-slate-500">Guests see the old price crossed out and a “% off” badge on your listing. It applies to nightly and day-use prices.</p>
              <div className="flex items-center gap-3">
                <input id="discountPct" type="number" min={0} max={70} step={5} className={`${inputClass} w-28`} value={draft.discountPct} onChange={(e) => update('discountPct', Number(e.target.value))} />
                <label htmlFor="discountPct" className="text-sm text-slate-600">% off</label>
                {draft.discountPct > 0 && (
                  <span className="text-sm text-slate-600">
                    {draft.overnight && <>Nightly: <span className="line-through text-slate-400">{formatPrice(draft.price)}</span> <span className="font-bold text-slate-900">{formatPrice(discountedPrice(draft.price, draft.discountPct))}</span></>}
                    {draft.dayUse.enabled && <> · Day use: <span className="line-through text-slate-400">{formatPrice(draft.dayUse.price)}</span> <span className="font-bold text-slate-900">{formatPrice(discountedPrice(draft.dayUse.price, draft.discountPct))}</span></>}
                  </span>
                )}
              </div>
              {fields.discountPct && <p className="text-xs text-rose-600 font-semibold">{fields.discountPct}</p>}
            </section>
            <p className="text-xs text-slate-500">
              {management === 'managed'
                ? 'This property is managed by Meridian Stay: guests book instantly, and we handle upkeep and guest care.'
                : 'You manage this property yourself: guests send booking requests, which you accept or decline within 24 hours.'}
            </p>
          </div>
        )}

        {step === 6 && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Check your listing</h2>
            {isUrl(draft.coverImage) && <img src={draft.coverImage} alt="" className="h-48 w-full object-cover rounded-2xl mb-4" />}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <Row label="Type" value={draft.type ?? ''} />
              <Row label="Title" value={draft.title} />
              <Row label="Location" value={`${draft.city}, ${draft.region}, ${draft.country}`} />
              <Row label="Size" value={`${draft.beds} bedrooms · ${draft.baths} bathrooms · up to ${draft.maxGuests} guests`} />
              <Row label="Price" value={[draft.overnight && `${formatPrice(draft.price)} / night`, draft.dayUse.enabled && `Day use ${formatPrice(draft.dayUse.price)} for ${draft.dayUse.blockHours} h`].filter(Boolean).join(' · ')} />
              <Row label="Times" value={`Check-in ${formatTime(draft.checkInTime)} · check-out ${formatTime(draft.checkOutTime)}`} />
              <Row label="House rules" value={HOUSE_RULES.map((r) => (draft.houseRules[r.key] ? r.yes : r.no)).join(' · ')} />
              <Row label="Security deposit" value={draft.securityDeposit ? formatPrice(draft.securityDeposit) : 'None'} />
              <Row label="Discount" value={draft.discountPct ? `${draft.discountPct}% off` : 'None'} />
              <Row label="Photos" value={`${1 + photos.length}`} />
              <Row label="Video tour" value={draft.videoUrl ? 'Added' : 'None'} />
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

const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

function TimeSelect({ id, value, onChange, allowEmpty = false }: { id: string; value: string; onChange: (v: string) => void; allowEmpty?: boolean }) {
  return (
    <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty && <option value="">No quiet hours</option>}
      {TIMES.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
    </select>
  )
}
