import { useEffect, useState, type ReactNode } from 'react'
import { fallbackImage, shapeFor, type PhotoShape } from '@meridian/shared'

// A mosaic built from the photos the host actually uploaded: landscape photos take a wide tile,
// portrait ones a tall tile, and `grid-flow-dense` closes the gaps. Every photo is shown whole,
// so a tall picture of a waterfall isn't cropped down to a letterbox.

/** Reads each photo's shape once it has loaded; landscape is assumed until then. */
function useShapes(urls: string[]): Record<string, PhotoShape> {
  const [shapes, setShapes] = useState<Record<string, PhotoShape>>({})
  useEffect(() => {
    let live = true
    for (const url of urls) {
      const img = new Image()
      img.onload = () => {
        if (live) setShapes((s) => (s[url] ? s : { ...s, [url]: shapeFor(img.naturalWidth, img.naturalHeight) }))
      }
      img.src = url
    }
    return () => { live = false }
  }, [urls.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps
  return shapes
}

/** How many columns and rows a tile takes. The first photo is the biggest. */
function span(shape: PhotoShape, first: boolean) {
  if (first) return shape === 'portrait' ? 'sm:col-span-2 sm:row-span-4' : 'sm:col-span-2 sm:row-span-2'
  return shape === 'portrait' ? 'sm:col-span-1 sm:row-span-2' : 'sm:col-span-2 sm:row-span-1'
}

interface Props {
  photos: string[]
  /** Photos beyond this stay in the "show all" view. */
  max?: number
  onOpen: (index: number) => void
  /** The buttons that sit over the bottom-right corner. */
  actions?: ReactNode
}

export function PhotoMosaic({ photos, max = 7, onOpen, actions }: Props) {
  const shown = photos.slice(0, max)
  const shapes = useShapes(shown)

  return (
    <div className="relative mb-10">
      <div className="grid grid-cols-1 sm:grid-cols-4 sm:auto-rows-[105px] grid-flow-dense gap-2 rounded-3xl overflow-hidden">
        {shown.map((src, i) => {
          const shape = shapes[src] ?? 'landscape'
          return (
            <button
              key={src + i}
              type="button"
              onClick={() => onOpen(i)}
              aria-label={`Open photo ${i + 1} of ${photos.length}`}
              className={`relative overflow-hidden bg-slate-100 ${i === 0 ? '' : 'hidden sm:block'} ${span(shape, i === 0)} ${i === 0 ? (shape === 'portrait' ? 'aspect-[2/3] sm:aspect-auto' : 'aspect-[3/2] sm:aspect-auto') : ''}`}
            >
              <img
                src={src}
                alt=""
                loading={i === 0 ? 'eager' : 'lazy'}
                onError={(e) => { e.currentTarget.src = fallbackImage }}
                className="w-full h-full object-cover hover:brightness-90 transition"
              />
            </button>
          )
        })}
      </div>
      <div className="absolute bottom-4 right-4 flex gap-2">{actions}</div>
    </div>
  )
}
