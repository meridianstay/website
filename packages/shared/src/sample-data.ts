import { images } from './images'
import type { Booking, Property, User } from './types'

// Sample data until the API exists. Every app reads from here so they stay consistent.

export const sampleUsers: User[] = [
  { id: 1, name: 'Aarav Sharma', email: 'aarav@meridian.com', role: 'admin', joinedAt: '2026-01-04' },
  { id: 2, name: 'Meera Nair', email: 'meera@greenvalley.in', role: 'host', joinedAt: '2026-02-11' },
  { id: 3, name: 'Karan Mehta', email: 'karan@hillside.in', role: 'host', joinedAt: '2026-03-02' },
  { id: 4, name: 'Priya Natarajan', email: 'priya.n@example.com', role: 'guest', joinedAt: '2026-04-19', avatar: images.avatar },
  { id: 5, name: 'Siddharth Kumar', email: 'sid.k@example.com', role: 'guest', joinedAt: '2026-05-27' },
]

export const sampleProperties: Property[] = [
  {
    id: 1, hostId: 2, title: 'Green Valley Organic Farmstay', type: 'Farmstay', location: 'Coorg, Karnataka',
    price: 145, rating: 4.92, reviewCount: 128, beds: 3, baths: 2, maxGuests: 6, status: 'Approved', image: images.farmstay,
    description: 'Wake up to the aroma of coffee blossoms and fresh organic breakfasts. Enjoy guided plantation walks and bonfire evenings.',
  },
  {
    id: 2, hostId: 3, title: 'Golden Sunset Hillside Resort', type: 'Resort', location: 'Wayanad, Kerala',
    price: 240, rating: 4.88, reviewCount: 94, beds: 4, baths: 4, maxGuests: 8, status: 'Approved', image: images.resort,
    description: 'A luxurious mountain resort with infinity pool overlooking misty green valleys and world-class spa facilities.',
  },
  {
    id: 3, hostId: 2, title: 'Whispering Pines Forest Cottage', type: 'Cottage', location: 'Manali, Himachal Pradesh',
    price: 120, rating: 4.95, reviewCount: 210, beds: 2, baths: 1, maxGuests: 4, status: 'Approved', image: images.cottage,
    description: 'A rustic wooden cabin nestled inside pine forests with mountain views, fireplace, and stargazing deck.',
  },
  {
    id: 4, hostId: 3, title: 'Emerald Luxury Pool Villa', type: 'Villa', location: 'Lonavala, Maharashtra',
    price: 320, rating: 4.97, reviewCount: 82, beds: 5, baths: 5, maxGuests: 10, status: 'Approved', image: images.villa,
    description: 'An architectural masterpiece featuring private plunge pool, manicured lawns, indoor game lounge, and private chef on request.',
  },
  {
    id: 5, hostId: 2, title: 'Sunny Citrus Farm & Estate', type: 'Farmstay', location: 'Nashik, Maharashtra',
    price: 160, rating: 4.85, reviewCount: 64, beds: 3, baths: 2, maxGuests: 6, status: 'Approved', image: images.citrusFarm,
    description: 'Experience vineyard tours and citrus picking in a sprawling eco-friendly family farmstay.',
  },
  {
    id: 6, hostId: 3, title: 'Bamboo Zen Treehouse Cottage', type: 'Cottage', location: 'Ubud, Bali',
    price: 195, rating: 4.99, reviewCount: 312, beds: 1, baths: 1, maxGuests: 2, status: 'Approved', image: images.treehouse,
    description: 'A stunning architectural bamboo treehouse overlooking lush green tropical rainforests and river streams.',
  },
  {
    id: 7, hostId: 2, title: 'Sunrise Garden View Private Room', type: 'Room', location: 'Ooty, Tamil Nadu',
    price: 80, rating: 0, reviewCount: 0, beds: 1, baths: 1, maxGuests: 2, status: 'Pending', image: images.room,
    description: 'A cozy private room with ensuite bathroom and gorgeous hillside garden views.',
  },
]

export const sampleBookings: Booking[] = [
  { id: 101, propertyId: 1, guestId: 4, checkIn: '2026-10-01', checkOut: '2026-10-06', guests: 2, total: 770, status: 'Confirmed' },
  { id: 102, propertyId: 3, guestId: 4, checkIn: '2026-12-20', checkOut: '2026-12-24', guests: 3, total: 597, status: 'Pending' },
  { id: 103, propertyId: 2, guestId: 5, checkIn: '2026-08-14', checkOut: '2026-08-17', guests: 2, total: 765, status: 'Completed' },
  { id: 104, propertyId: 4, guestId: 5, checkIn: '2026-11-08', checkOut: '2026-11-10', guests: 6, total: 941, status: 'Confirmed' },
  { id: 105, propertyId: 5, guestId: 4, checkIn: '2026-07-03', checkOut: '2026-07-05', guests: 2, total: 365, status: 'Cancelled' },
]

/** The logged-in user each app shows until auth exists. */
export const demoGuest = sampleUsers[3]
export const demoHost = sampleUsers[1]
export const demoAdmin = sampleUsers[0]

export const initialWishlist = [1, 3, 6]

export const propertyById = (id: number) => sampleProperties.find((p) => p.id === id)
