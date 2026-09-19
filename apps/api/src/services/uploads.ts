import { randomUUID } from 'node:crypto'
import type { Me } from '@meridian/shared'
import { bucket, emulated } from '../store/firebase'
import { contentRepo, usersRepo } from '../repositories'
import { AppError } from '../http/errors'

// Photo uploads to Firebase Storage. Files are served through their download links.

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
/** listing: host photos. avatar: profile photos. content: website pages (admins only). */
export type UploadPurpose = 'listing' | 'avatar' | 'content'

function downloadUrl(path: string, token: string) {
  const base = emulated ? `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}` : 'https://firebasestorage.googleapis.com'
  return `${base}/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`
}

export const uploadService = {
  async upload(user: Me, uid: string, file: File, purpose: UploadPurpose) {
    const { uploads } = await contentRepo.settings()
    const ext = TYPES[file.type]
    if (!ext) throw new AppError(400, 'Upload a JPG, PNG or WebP photo.')
    if (file.size > uploads.maxMb * 1024 * 1024) throw new AppError(400, `Photos can be at most ${uploads.maxMb} MB.`)

    if (purpose === 'content' && user.role !== 'admin') throw new AppError(403, 'Only admins can upload website photos.')
    const folder = { avatar: 'avatars', listing: 'listings', content: 'site' }[purpose]
    const path = `${folder}/${user.id}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`
    const token = randomUUID()
    await bucket.file(path).save(Buffer.from(await file.arrayBuffer()), {
      resumable: false,
      contentType: file.type,
      metadata: { cacheControl: 'public, max-age=31536000', metadata: { firebaseStorageDownloadTokens: token, uploadedBy: String(user.id) } },
    })
    const url = downloadUrl(path, token)
    if (purpose === 'avatar') await usersRepo.update(uid, { avatarUrl: url })
    return { url }
  },
}
