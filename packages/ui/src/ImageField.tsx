import { useId, useState } from 'react'
import { PhotoUpload } from './PhotoUpload'

interface Props {
  label: string
  value: string
  onChange: (url: string) => void
  /** Storage folder: website content (admins), listing photos or profile photos. */
  purpose?: 'content' | 'listing' | 'avatar'
  error?: React.ReactNode
  /** Preview shape: wide for banners and heroes, square for cards and people. */
  shape?: 'wide' | 'square' | 'round'
  small?: boolean
}

/** A photo picker for editors: preview, upload, replace or remove, with pasting a link as a fallback. */
export function ImageField({ label, value, onChange, purpose = 'content', error, shape = 'wide', small = false }: Props) {
  const [linkOpen, setLinkOpen] = useState(false)
  const id = useId()
  const box = shape === 'wide' ? 'w-40 h-24 rounded-xl' : shape === 'round' ? 'w-20 h-20 rounded-full' : 'w-24 h-24 rounded-xl'
  return (
    <div>
      <p id={`${id}-label`} className={`block font-bold uppercase text-slate-500 mb-1 ${small ? 'text-[10px]' : 'text-xs'}`}>{label}</p>
      <div className="flex items-center gap-4">
        {value ? (
          <img src={value} alt="" className={`${box} object-cover border border-slate-200 bg-slate-100 shrink-0`} />
        ) : (
          <span className={`${box} shrink-0 border-2 border-dashed border-slate-200 bg-slate-50 text-slate-300 flex items-center justify-center`} aria-hidden="true">
            <i className="fa-solid fa-image text-xl"></i>
          </span>
        )}
        <div className="space-y-2 min-w-0">
          <PhotoUpload purpose={purpose} label={value ? 'Replace photo' : 'Upload photo'} onUploaded={(url) => { onChange(url); setLinkOpen(false) }} />
          <div className="flex gap-3 text-xs font-bold">
            {value && <button type="button" onClick={() => onChange('')} className="text-rose-600 hover:underline">Remove</button>}
            <button type="button" onClick={() => setLinkOpen(!linkOpen)} aria-expanded={linkOpen} className="text-slate-500 hover:underline">
              {linkOpen ? 'Hide link' : 'Paste a link instead'}
            </button>
          </div>
        </div>
      </div>
      {linkOpen && (
        <input aria-labelledby={`${id}-label`} value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder="https://…"
          className="mt-2 w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:border-brand-500" />
      )}
      {error}
    </div>
  )
}
