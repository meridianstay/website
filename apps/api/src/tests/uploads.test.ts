import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { embedUrl, isPlayableVideo } from '@meridian/shared'
import { uploadService } from '../services/uploads'
import { listingService } from '../services/listings'
import { propertiesRepo } from '../repositories'
import { appError, createUser, listingInput, resetDatabase } from './helpers'

describe('video tours', () => {
  beforeEach(resetDatabase)

  test('recognises YouTube and Vimeo links, and playable files', () => {
    assert.equal(embedUrl('https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
    assert.equal(embedUrl('https://www.youtube.com/watch?v=abc123xyz'), 'https://www.youtube-nocookie.com/embed/abc123xyz')
    assert.equal(embedUrl('https://vimeo.com/76979871'), 'https://player.vimeo.com/video/76979871')
    assert.equal(embedUrl('https://example.com/tour.mp4'), null)
    assert.equal(isPlayableVideo('https://example.com/tour.mp4'), true)
    assert.equal(isPlayableVideo('https://example.com/tour.pdf'), false)
  })

  test('checks the video type and size before uploading', async () => {
    const host = await createUser('host')
    assert.equal((await appError(() => uploadService.startVideoUpload(host.me, 'image/png', 1000))).status, 400)
    assert.equal((await appError(() => uploadService.startVideoUpload(host.me, 'video/mp4', 900 * 1024 * 1024))).status, 400)
    // Against the emulator the browser posts the file to the API instead of a signed link.
    const start = await uploadService.startVideoUpload(host.me, 'video/mp4', 5 * 1024 * 1024)
    assert.equal(start.mode, 'api')
    assert.equal(start.maxMb, 150)
  })

  test('a listing keeps its video link', async () => {
    const host = await createUser('host')
    const id = await listingService.create(host.me, host.uid, listingInput({ videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }))
    assert.equal((await propertiesRepo.get(id))!.videoUrl, 'https://youtu.be/dQw4w9WgXcQ')
    assert.equal((await propertiesRepo.toEditor((await propertiesRepo.get(id))!)).videoUrl, 'https://youtu.be/dQw4w9WgXcQ')
  })
})
