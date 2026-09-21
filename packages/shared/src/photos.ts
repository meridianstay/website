// Listing photos are stored in one of two shapes, so every gallery, card and mosaic lines up no
// matter what a host's camera produced. The browser crops to the nearest shape before uploading.

export type PhotoShape = 'landscape' | 'portrait' | 'square'

export interface PhotoSize {
  width: number
  height: number
  label: string
}

export const PHOTO_SIZES: Record<PhotoShape, PhotoSize> = {
  landscape: { width: 1600, height: 1067, label: 'Landscape (3:2)' },
  portrait: { width: 1067, height: 1600, label: 'Portrait (2:3)' },
  square: { width: 800, height: 800, label: 'Square (1:1)' },
}

/** The shape a photo will be cropped to: whichever of the two is closest to how it was taken. */
export const shapeFor = (width: number, height: number): PhotoShape => (width >= height ? 'landscape' : 'portrait')

/** How wide a photo is compared with its height, e.g. 1.5 for landscape. */
export const aspectOf = (shape: PhotoShape) => PHOTO_SIZES[shape].width / PHOTO_SIZES[shape].height

export const PHOTO_RULE = 'Photos are saved as landscape 1600 × 1067 or portrait 1067 × 1600. We crop from the middle, so keep the subject centred.'
