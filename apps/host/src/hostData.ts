import { demoHost, sampleBookings, sampleProperties } from '@meridian/shared'

// The signed-in host's slice of the sample data.
export const myListings = sampleProperties.filter((p) => p.hostId === demoHost.id)
const myIds = new Set(myListings.map((p) => p.id))
export const myBookings = sampleBookings.filter((b) => myIds.has(b.propertyId))
