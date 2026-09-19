import type { Amenity } from '@meridian/shared'
import { query } from '../db/pool'

// Table: amenities

export const amenitiesRepo = {
  list() {
    return query<Amenity>('SELECT name, icon FROM amenities ORDER BY id')
  },
}
