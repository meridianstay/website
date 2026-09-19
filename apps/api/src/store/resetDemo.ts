import { C, col, firestore } from './db'
import { emulated } from './firebase'
import { seed } from './seed'

// "Reset demo data" in admin Settings: replaces every listing, booking and review with fresh demo data
// (for client previews). Real accounts, site content, pages and payment keys are kept.

export const demoResetAllowed = () => emulated || process.env.SEED_DEMO_DATA === 'true'

const WIPE = [C.properties, C.bookings, C.reviews, C.blocks, C.wishlists, C.messages, C.audit, C.counters, C.amenities]

export async function resetDemo() {
  // recursiveDelete also removes each listing's nights subcollection.
  for (const name of WIPE) await firestore.recursiveDelete(col(name))
  const demoUsers = await col(C.users).where('uid', '>=', 'demo-').where('uid', '<', 'demo.').get()
  const w = firestore.bulkWriter()
  demoUsers.docs.forEach((d) => w.delete(d.ref))
  await w.close()
  await seed(() => {}, true)
}
