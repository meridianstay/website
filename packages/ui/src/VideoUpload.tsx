import { useId, useRef, useState } from 'react'
import { VIDEO_TYPES } from '@meridian/shared'
import { api } from '@meridian/shared/client'

interface Props {
  /** Called with the uploaded video's link. */
  onUploaded: (url: string) => void
  label?: string
  className?: string
}

/**
 * Uploads a property video. Big files go straight from the browser to Firebase Storage using a
 * short-lived link from the API, so uploads aren't limited by our server.
 */
export function VideoUpload({ onUploaded, label = 'Upload video', className = '' }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const send = (url: string, headers: Record<string, string>, file: File) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', url)
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
      xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100))
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('The upload didn’t finish. Please try again.')))
      xhr.onerror = () => reject(new Error('The upload didn’t finish. Check your connection and try again.'))
      xhr.send(file)
    })

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!VIDEO_TYPES[file.type]) return setError('Choose an MP4, WebM or MOV video.')
    setProgress(0)
    try {
      const start = await api.startVideoUpload(file.type, file.size)
      if (start.mode === 'signed') {
        await send(start.uploadUrl, start.headers, file)
        onUploaded(start.url)
      } else {
        // Development: the emulator can't sign links, so the file goes through the API.
        onUploaded((await api.upload(file, 'video')).url)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setProgress(null)
      if (input.current) input.current.value = ''
    }
  }

  const busy = progress !== null
  return (
    <div className={className}>
      <input ref={input} id={id} type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" disabled={busy}
        onChange={(e) => pick(e.target.files?.[0])} />
      <label htmlFor={id}
        className={`inline-flex items-center gap-2 cursor-pointer text-xs font-bold py-2.5 px-4 rounded-xl border-2 border-dashed transition ${busy ? 'border-slate-200 text-slate-400' : 'border-brand-300 text-brand-700 hover:bg-brand-50'}`}>
        <i className={`fa-solid ${busy ? 'fa-spinner fa-spin' : 'fa-video'}`} aria-hidden="true"></i>
        {busy ? `Uploading… ${progress}%` : label}
      </label>
      {busy && (
        <span className="block mt-2 h-1.5 w-48 bg-slate-200 rounded-full overflow-hidden" role="progressbar" aria-valuenow={progress ?? 0} aria-valuemin={0} aria-valuemax={100}>
          <span className="block h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
        </span>
      )}
      {error && <p role="alert" className="text-xs text-rose-600 font-semibold mt-1">{error}</p>}
    </div>
  )
}
