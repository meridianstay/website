export type PropertyType = 'Farmstay' | 'Room' | 'Resort' | 'Cottage' | 'Villa'

export type ListingStatus = 'Draft' | 'Pending' | 'Approved' | 'Rejected'

export type UserRole = 'guest' | 'host' | 'admin'

/** Every property type, in display order. */
export const PROPERTY_TYPE_LIST: PropertyType[] = ['Farmstay', 'Room', 'Resort', 'Cottage', 'Villa']
