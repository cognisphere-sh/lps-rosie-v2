import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import sharp from 'sharp'

import { MAX_EDGE, NotAnImageError, preparePhoto } from './photo-prepare'

/** A phone-style JPEG: stored landscape with "rotate 90°" and GPS in EXIF. */
async function phoneJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#3a7' } })
    .jpeg()
    .withMetadata({ orientation: 6, exif: { IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '30/1 16/1 0/1' } } })
    .toBuffer()
}

test('applies the EXIF rotation, caps the long edge and makes WebP', async () => {
  const original = await phoneJpeg(4032, 3024)
  const photo = await preparePhoto(original)
  // Orientation 6 turns the landscape capture upright.
  assert.equal(photo.height, MAX_EDGE)
  assert.equal(photo.width, 1536)
  assert.equal(photo.byteSize, photo.webp.length)
  const meta = await sharp(photo.webp).metadata()
  assert.equal(meta.format, 'webp')
  assert.equal(meta.exif, undefined)
  assert.equal(meta.orientation, undefined)
})

test('never enlarges, and hashes the file it was handed', async () => {
  const original = await phoneJpeg(300, 200)
  const photo = await preparePhoto(original)
  assert.deepEqual([photo.width, photo.height], [200, 300])
  assert.equal(photo.sha256, createHash('sha256').update(original).digest('hex'))
})

test('rejects a file that is not an image', async () => {
  await assert.rejects(preparePhoto(Buffer.from('not a photo')), NotAnImageError)
})
