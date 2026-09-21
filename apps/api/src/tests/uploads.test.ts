import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { embedUrl, isPlayableVideo } from '@meridian/shared'
import { listingService, parseListing } from '../services/listings'
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

  test('only a YouTube or Vimeo link is accepted, and the video is optional', async () => {
    const host = await createUser('host')
    const err = await appError(async () => parseListing(listingInput({ videoUrl: 'https://example.com/tour.mp4' }) as unknown as Record<string, unknown>))
    assert.ok(err.fields.videoUrl)
    const id = await listingService.create(host.me, host.uid, listingInput({ videoUrl: '' }))
    assert.equal((await propertiesRepo.get(id))!.videoUrl, '')
  })

  test('a listing keeps its video link', async () => {
    const host = await createUser('host')
    const id = await listingService.create(host.me, host.uid, listingInput({ videoUrl: 'https://youtu.be/dQw4w9WgXcQ' }))
    assert.equal((await propertiesRepo.get(id))!.videoUrl, 'https://youtu.be/dQw4w9WgXcQ')
    assert.equal((await propertiesRepo.toEditor((await propertiesRepo.get(id))!)).videoUrl, 'https://youtu.be/dQw4w9WgXcQ')
  })
})
