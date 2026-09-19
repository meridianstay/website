import { images } from '@meridian/shared'

export interface Category {
  title: string
  tag: string
  tagTone: 'green' | 'yellow'
  description: string
  image: string
}

export const categories: Category[] = [
  { title: 'Farmstays', tag: 'Organic Vibe', tagTone: 'green', description: 'Live close to nature & orchards', image: images.farmstay },
  { title: 'Resorts', tag: 'Luxury', tagTone: 'yellow', description: 'World-class amenities & pools', image: images.resort },
  { title: 'Cottages', tag: 'Cozy', tagTone: 'green', description: 'Woodland & hillside wooden homes', image: images.cottage },
  { title: 'Villas', tag: 'Exclusive', tagTone: 'yellow', description: 'Private lawns & infinity pools', image: images.villa },
]
