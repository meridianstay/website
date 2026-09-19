import { useRef, useState } from 'react'
import { api } from '@meridian/shared/client'

interface Props {
  purpose: 'listing' | 'avatar'
  /** Called with the uploaded photo's link. */
  onUploaded: (url: string) => void
  label?: string
  maxMb?: number
  className?: string
}

/** A button that uploads a photo to Firebase Storage through the API. */
export function PhotoUpload({ purpose, onUploaded, label = 'Upload photo', maxMb = 4, className = '' }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setError('Choose a JPG, PNG or WebP photo.')
    if (file.size > maxMb * 1024 * 1024) return setError(`Photos can be at most ${maxMb} MB.`)
    setBusy(true)
    try {
      onUploaded((await api.upload(file, purpose)).url)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className={className}>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id={`upload-${purpose}-${label}`}
        onChange={(e) => pick(e.target.files?.[0])} disabled={busy} />
      <label htmlFor={`upload-${purpose}-${label}`}
        className={`inline-flex items-center gap-2 cursor-pointer text-xs font-bold py-2.5 px-4 rounded-xl border-2 border-dashed transition ${busy ? 'border-slate-200 text-slate-400' : 'border-brand-300 text-brand-700 hover:bg-brand-50'}`}>
        <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}`} aria-hidden="true"></i>
        {busy ? 'Uploading…' : label}
      </label>
      {error && <p role="alert" className="text-xs text-rose-600 font-semibold mt-1">{error}</p>}
    </div>
  )
}
