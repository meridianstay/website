import { images } from './images'

export type PropertyType = 'Farmstay' | 'Room' | 'Resort' | 'Cottage' | 'Villa'

export interface Property {
  id: number
  title: string
  type: PropertyType
  location: string
  price: number
  rating: number
  reviewCount: number
  beds: number
  image: string
  description: string
}

export const featuredProperties: Property[] = [
  {
    id: 1,
    title: 'Green Valley Organic Farmstay',
    type: 'Farmstay',
    location: 'Coorg, Karnataka',
    price: 145,
    rating: 4.92,
    reviewCount: 128,
    beds: 3,
    image: images.farmstay,
    description:
      'Wake up to the aroma of coffee blossoms and fresh organic breakfasts. Enjoy guided plantation walks and bonfire evenings.',
  },
  {
    id: 2,
    title: 'Golden Sunset Hillside Resort',
    type: 'Resort',
    location: 'Wayanad, Kerala',
    price: 240,
    rating: 4.88,
    reviewCount: 94,
    beds: 4,
    image: images.resort,
    description:
      'A luxurious mountain resort with infinity pool overlooking misty green valleys and world-class spa facilities.',
  },
  {
    id: 3,
    title: 'Whispering Pines Forest Cottage',
    type: 'Cottage',
    location: 'Manali, Himachal Pradesh',
    price: 120,
    rating: 4.95,
    reviewCount: 210,
    beds: 2,
    image: images.cottage,
    description:
      'A rustic wooden cabin nestled inside pine forests with mountain views, fireplace, and stargazing deck.',
  },
  {
    id: 4,
    title: 'Emerald Luxury Pool Villa',
    type: 'Villa',
    location: 'Lonavala, Maharashtra',
    price: 320,
    rating: 4.97,
    reviewCount: 82,
    beds: 5,
    image: images.villa,
    description:
      'An architectural masterpiece featuring private plunge pool, manicured lawns, indoor game lounge, and private chef on request.',
  },
  {
    id: 5,
    title: 'Sunny Citrus Farm & Estate',
    type: 'Farmstay',
    location: 'Nashik, Maharashtra',
    price: 160,
    rating: 4.85,
    reviewCount: 64,
    beds: 3,
    image: images.citrusFarm,
    description:
      'Experience vineyard tours and citrus picking in a sprawling eco-friendly family farmstay.',
  },
  {
    id: 6,
    title: 'Bamboo Zen Treehouse Cottage',
    type: 'Cottage',
    location: 'Ubud, Bali',
    price: 195,
    rating: 4.99,
    reviewCount: 312,
    beds: 1,
    image: images.treehouse,
    description:
      'A stunning architectural bamboo treehouse overlooking lush green tropical rainforests and river streams.',
  },
]

export const initialWishlist = [1, 3, 6]
