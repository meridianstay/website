import { PHOTO_SIZES, shapeFor, type PhotoShape } from '@meridian/shared'

// Photos are cropped and resized in the browser before they are uploaded: every listing photo comes
// out at one of the agreed sizes, and a 12 MP phone photo shrinks to a few hundred kilobytes, which
// keeps it under the upload limit and makes pages load quickly.

/** Reads a picked file into an image element. */
function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('We couldn’t read that photo. Try another one.')) }
    img.src = url
  })
}

/**
 * Centre-crops `file` to the nearest allowed shape and scales it to that exact size.
 * `only` forces a shape (square for profile photos). Returns the original if the browser can't do it.
 */
export async function cropToShape(file: File, only?: PhotoShape): Promise<{ file: File; shape: PhotoShape }> {
  const img = await load(file)
  const shape = only ?? shapeFor(img.naturalWidth, img.naturalHeight)
  const { width, height } = PHOTO_SIZES[shape]
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return { file, shape }
  // The largest part of the photo with the target shape, taken from the middle.
  const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight)
  const drawWidth = img.naturalWidth * scale
  const drawHeight = img.naturalHeight * scale
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86))
  if (!blob) return { file, shape }
  const name = file.name.replace(/\.[^.]+$/, '') || 'photo'
  return { file: new File([blob], `${name}-${shape}.jpg`, { type: 'image/jpeg' }), shape }
}
