import { C, col, firestore } from './db'
import { emulated } from './firebase'
import { seed } from './seed'

// "Reset demo data" in admin Settings: replaces every listing, booking and review with fresh demo data
// (for client previews). Real accounts, site content, pages and payment keys are kept.

export const demoResetAllowed = () => emulated || process.env.SEED_DEMO_DATA === 'true'

const WIPE = [C.properties, C.bookings, C.reviews, C.blocks, C.wishlists, C.messages, C.audit, C.counters, C.amenities]

export async function resetDemo() {
  // Everything runs in parallel to stay well inside the hosting time limit.
  // recursiveDelete also removes each listing's nights subcollection.
  const deleteDemoUsers = async () => {
    const snap = await col(C.users).where('uid', '>=', 'demo-').where('uid', '<', 'demo.').get()
    const w = firestore.bulkWriter()
    snap.docs.forEach((d) => w.delete(d.ref))
    await w.close()
  }
  await Promise.all([...WIPE.map((name) => firestore.recursiveDelete(col(name))), deleteDemoUsers()])
  await seed(() => {}, true)
}
