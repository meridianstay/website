import { randomUUID } from 'node:crypto'
import { VIDEO_TYPES, type Me } from '@meridian/shared'
import { bucket, emulated } from '../store/firebase'
import { contentRepo, usersRepo } from '../repositories'
import { AppError } from '../http/errors'

// Uploads to Firebase Storage. Files are served through their download links.
//
// Photos go through the API (they're small). Videos are too big for a serverless request body, so the
// browser sends them straight to Firebase Storage using a short-lived signed link this API creates.
// The local emulator can't sign links, so in development videos come through the API instead.

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
/** listing: host photos. avatar: profile photos. content: website pages (admins only). */
export type UploadPurpose = 'listing' | 'avatar' | 'content' | 'video'

function downloadUrl(path: string, token: string) {
  const base = emulated ? `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}` : 'https://firebasestorage.googleapis.com'
  return `${base}/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`
}

export const uploadService = {
  async upload(user: Me, uid: string, file: File, purpose: UploadPurpose) {
    const { uploads } = await contentRepo.settings()
    const isVideo = purpose === 'video'
    const ext = isVideo ? VIDEO_TYPES[file.type] : TYPES[file.type]
    if (!ext) throw new AppError(400, isVideo ? 'Upload an MP4, WebM or MOV video.' : 'Upload a JPG, PNG or WebP photo.')
    const limit = isVideo ? uploads.maxVideoMb : uploads.maxMb
    if (file.size > limit * 1024 * 1024) throw new AppError(400, `${isVideo ? 'Videos' : 'Photos'} can be at most ${limit} MB.`)

    if (purpose === 'content' && user.role !== 'admin') throw new AppError(403, 'Only admins can upload website photos.')
    const folder = { avatar: 'avatars', listing: 'listings', content: 'site', video: 'videos' }[purpose]
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

  /**
   * Prepares a video upload. In production the browser uploads straight to Firebase Storage with the
   * signed link; in development (emulator) it posts the file to this API instead.
   */
  async startVideoUpload(user: Me, contentType: string, sizeBytes: number) {
    const { uploads } = await contentRepo.settings()
    const ext = VIDEO_TYPES[contentType]
    if (!ext) throw new AppError(400, 'Upload an MP4, WebM or MOV video.')
    if (!(sizeBytes > 0)) throw new AppError(400, 'That video looks empty.')
    if (sizeBytes > uploads.maxVideoMb * 1024 * 1024) {
      throw new AppError(400, `Videos can be at most ${uploads.maxVideoMb} MB. Try a shorter clip, or paste a YouTube link instead.`)
    }
    if (emulated) return { mode: 'api' as const, maxMb: uploads.maxVideoMb }

    const path = `videos/${user.id}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`
    const token = randomUUID()
    const tokenHeader = 'x-goog-meta-firebasestoragedownloadtokens'
    const [uploadUrl] = await bucket.file(path).getSignedUrl({
      version: 'v4', action: 'write', expires: Date.now() + 30 * 60_000, contentType,
      extensionHeaders: { [tokenHeader]: token },
    })
    return {
      mode: 'signed' as const,
      uploadUrl,
      headers: { 'Content-Type': contentType, [tokenHeader]: token },
      url: downloadUrl(path, token),
      maxMb: uploads.maxVideoMb,
    }
  },
}
