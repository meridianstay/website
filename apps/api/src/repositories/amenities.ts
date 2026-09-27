import type { Amenity } from '@meridian/shared'
import { C, all, col } from '../store/db'
import { cached } from '../store/cache'

// Collection: amenities/{name}

export const amenitiesRepo = {
  async list(): Promise<Amenity[]> {
    return cached('amenities', 'all', async () => {
      const rows = await all<Amenity & { order: number }>(col(C.amenities))
      return rows.sort((a, b) => a.order - b.order).map(({ name, icon }) => ({ name, icon }))
    })
  },

  async iconMap() {
    return new Map((await this.list()).map((a) => [a.name, a.icon]))
  },
}
