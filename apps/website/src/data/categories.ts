import { images, type PropertyType } from '@meridian/shared'

export interface Category {
  type: PropertyType
  title: string
  tag: string
  tagTone: 'green' | 'yellow'
  description: string
  image: string
}

export const categories: Category[] = [
  { type: 'Farmstay', title: 'Farmstays', tag: 'Organic Vibe', tagTone: 'green', description: 'Live close to nature & orchards', image: images.farmstay },
  { type: 'Resort', title: 'Resorts', tag: 'Luxury', tagTone: 'yellow', description: 'World-class amenities & pools', image: images.resort },
  { type: 'Cottage', title: 'Cottages', tag: 'Cozy', tagTone: 'green', description: 'Woodland & hillside wooden homes', image: images.cottage },
  { type: 'Villa', title: 'Villas', tag: 'Exclusive', tagTone: 'yellow', description: 'Private lawns & infinity pools', image: images.villa },
]
