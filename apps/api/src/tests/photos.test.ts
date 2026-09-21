import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { aspectOf, PHOTO_SIZES, shapeFor } from '@meridian/shared'

describe('listing photo shapes', () => {
  test('a photo becomes whichever of the two shapes it is closest to', () => {
    assert.equal(shapeFor(4032, 3024), 'landscape') // phone, held sideways
    assert.equal(shapeFor(3024, 4032), 'portrait') // phone, held upright
    assert.equal(shapeFor(1000, 1000), 'landscape') // a square leans landscape
  })

  test('the two shapes are 3:2 and its mirror, so tiles line up', () => {
    assert.equal(Math.round(aspectOf('landscape') * 100) / 100, 1.5)
    assert.equal(Math.round((1 / aspectOf('portrait')) * 100) / 100, 1.5)
    assert.equal(PHOTO_SIZES.landscape.width, PHOTO_SIZES.portrait.height)
  })
})
