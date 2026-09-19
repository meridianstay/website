import { useState, type ReactNode } from 'react'
import { PageHeader } from '@meridian/ui'
import { formatPrice, type PropertyType } from '@meridian/shared'

const propertyTypes: { type: PropertyType; icon: string; blurb: string }[] = [
  { type: 'Farmstay', icon: 'seedling', blurb: 'A working farm or orchard' },
  { type: 'Room', icon: 'door-open', blurb: 'A private room in your home' },
  { type: 'Cottage', icon: 'house-chimney', blurb: 'A standalone woodland or hillside home' },
  { type: 'Villa', icon: 'hotel', blurb: 'A large private home, often with a pool' },
  { type: 'Resort', icon: 'umbrella-beach', blurb: 'Multiple units with shared amenities' },
]

const steps = ['Property type', 'Location & size', 'Photos & description', 'Price', 'Review']

interface Draft {
  type: PropertyType | null
  title: string
  location: string
  beds: number
  baths: number
  maxGuests: number
  image: string
  description: string
  price: number
}

const emptyDraft: Draft = { type: null, title: '', location: '', beds: 1, baths: 1, maxGuests: 2, image: '', description: '', price: 100 }

const inputClass = 'w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500'

export function Onboarding() {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [submitted, setSubmitted] = useState(false)
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const canContinue = [
    draft.type !== null,
    draft.title.trim() !== '' && draft.location.trim() !== '',
    draft.description.trim().length >= 20,
    draft.price > 0,
    true,
  ][step]

  if (submitted) {
    return (
      <div className="max-w-md mx-auto my-16 text-center bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mx-auto text-2xl">
          <i className="fa-solid fa-check" aria-hidden="true"></i>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900">Submitted for review</h2>
        <p className="text-sm text-slate-500">Our team reviews new listings before they appear on Meridian Stay. You’ll get an email once “{draft.title}” is approved.</p>
        <button type="button" onClick={() => { setDraft(emptyDraft); setStep(0); setSubmitted(false) }} className="bg-slate-900 text-white text-xs font-bold py-3 px-6 rounded-2xl">
          Add another listing
        </button>
      </div>
    )
  }

  return (
    <>
      <PageHeader eyebrow="Meridian Host Portal" title="List your property" description="Share your farmstay, room, resort, cottage or villa with travelers." />

      <ol className="flex flex-wrap gap-2 mb-8" aria-label="Steps">
        {steps.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? 'step' : undefined}
            className={`px-3 py-1.5 rounded-full text-xs font-bold ${
              i === step ? 'bg-brand-600 text-white' : i < step ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {i < step && <i className="fa-solid fa-check mr-1.5" aria-hidden="true"></i>}
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm max-w-3xl">
        {step === 0 && (
          <fieldset>
            <legend className="text-lg font-bold text-slate-900 mb-4">What kind of place are you listing?</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {propertyTypes.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => update('type', t.type)}
                  aria-pressed={draft.type === t.type}
                  className={`text-left p-4 rounded-2xl border-2 transition flex items-start space-x-3 ${
                    draft.type === t.type ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <i className={`fa-solid fa-${t.icon} text-brand-600 text-lg mt-0.5 w-6 text-center`} aria-hidden="true"></i>
                  <span>
                    <span className="block font-bold text-sm text-slate-900">{t.type}</span>
                    <span className="block text-xs text-slate-500">{t.blurb}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Field label="Listing title" id="title">
              <input id="title" className={inputClass} value={draft.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Whispering Pines Woodland Cottage" />
            </Field>
            <Field label="Location" id="location">
              <input id="location" className={inputClass} value={draft.location} onChange={(e) => update('location', e.target.value)} placeholder="e.g. Coorg, Karnataka" />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Counter label="Bedrooms" value={draft.beds} onChange={(v) => update('beds', v)} />
              <Counter label="Bathrooms" value={draft.baths} onChange={(v) => update('baths', v)} />
              <Counter label="Max guests" value={draft.maxGuests} onChange={(v) => update('maxGuests', v)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Field label="Cover photo URL" id="image" hint="Photo upload comes with the backend. Paste an image link for now.">
              <input id="image" type="url" className={inputClass} value={draft.image} onChange={(e) => update('image', e.target.value)} placeholder="https://images.unsplash.com/..." />
            </Field>
            {draft.image && <img src={draft.image} alt="Cover preview" className="h-48 w-full object-cover rounded-2xl border border-slate-200" />}
            <Field label="Description" id="description" hint="At least 20 characters. Describe the views, hospitality and amenities.">
              <textarea id="description" rows={4} className={inputClass} value={draft.description} onChange={(e) => update('description', e.target.value)} />
            </Field>
          </div>
        )}

        {step === 3 && (
          <Field label="Price per night" id="price" hint="Guests see this price plus the service fee.">
            <input id="price" type="number" min={1} className={inputClass} value={draft.price} onChange={(e) => update('price', Number(e.target.value))} />
          </Field>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Check your listing</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <Row label="Type" value={draft.type ?? ''} />
              <Row label="Title" value={draft.title} />
              <Row label="Location" value={draft.location} />
              <Row label="Size" value={`${draft.beds} bedrooms · ${draft.baths} bathrooms · up to ${draft.maxGuests} guests`} />
              <Row label="Price" value={`${formatPrice(draft.price)} / night`} />
            </dl>
            <p className="text-sm text-slate-600 mt-4">{draft.description}</p>
          </div>
        )}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
          <button type="button" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="text-sm font-bold text-slate-600 hover:text-slate-900 disabled:opacity-0">
            Back
          </button>
          {step < steps.length - 1 ? (
            <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canContinue} className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-bold py-3 px-8 rounded-2xl text-sm transition">
              Continue
            </button>
          ) : (
            <button type="button" onClick={() => setSubmitted(true)} className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-8 rounded-2xl text-sm shadow-lg shadow-brand-500/25 transition">
              Submit for review
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-bold uppercase text-slate-500 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

function Counter({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
      <span className="block text-[10px] font-bold uppercase text-slate-500 mb-2">{label}</span>
      <div className="flex items-center justify-between">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} onClick={() => onChange(Math.max(1, value - 1))} className="w-7 h-7 rounded-full bg-white border border-slate-200 font-bold">−</button>
        <span className="font-bold text-sm tabular-nums">{value}</span>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(value + 1)} className="w-7 h-7 rounded-full bg-white border border-slate-200 font-bold">+</button>
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
