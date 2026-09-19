import { bucket, emulated, firebaseMode, firestore, auth, projectId, storageBucket } from '../store/firebase'

// Firebase connection status for the admin Settings page. Secrets are never returned.

async function check(fn: () => Promise<unknown>) {
  try {
    await fn()
    return { ok: true, message: 'Connected' }
  } catch (err) {
    return { ok: false, message: (err as Error).message.split('\n')[0].slice(0, 200) }
  }
}

export const integrationsService = {
  async status() {
    const [firestoreCheck, authCheck, storageCheck] = await Promise.all([
      check(() => firestore.collection('siteSettings').limit(1).get()),
      check(() => auth.listUsers(1)),
      check(async () => {
        // The Storage emulator doesn't support bucket listing; uploads work there without a check.
        if (emulated) return
        try {
          await bucket.getFiles({ maxResults: 1 })
        } catch (err) {
          if ((err as { code?: number }).code === 404) throw new Error(`Storage bucket ${storageBucket} not found. Turn on Storage in the Firebase console.`)
          throw err
        }
      }),
    ])
    return {
      mode: firebaseMode,
      projectId,
      storageBucket,
      services: { firestore: firestoreCheck, auth: authCheck, storage: storageCheck },
    }
  },
}
