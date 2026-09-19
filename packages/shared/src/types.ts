export type PropertyType = 'Farmstay' | 'Room' | 'Resort' | 'Cottage' | 'Villa'

export type ListingStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected'

export type UserRole = 'guest' | 'host' | 'admin'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  joinedAt: string
  avatar?: string
}

export interface Property {
  id: number
  hostId: number
  title: string
  type: PropertyType
  location: string
  price: number
  rating: number
  reviewCount: number
  beds: number
  baths: number
  maxGuests: number
  status: ListingStatus
  image: string
  description: string
}

export type BookingStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled'

export interface Booking {
  id: number
  propertyId: number
  guestId: number
  checkIn: string
  checkOut: string
  guests: number
  total: number
  status: BookingStatus
}
