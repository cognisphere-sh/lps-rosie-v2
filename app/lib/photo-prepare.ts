import { createHash } from 'node:crypto'

import sharp from 'sharp'

/**
 * The Photos page's copy of Daisy's `prepare-photo`
 * (`harness/agents/daisy/skills/agent/plant-photo-catalogue/scripts/prepare-photo`):
 * the same normalisation, so a row the app writes is the same as one she does.
 * Keep the numbers in step with that script.
 *
 * - EXIF rotation is applied to the pixels, then every bit of metadata
 *   (GPS included) is dropped — sharp writes none unless asked.
 * - The long edge is capped at 2048 px, never enlarged.
 * - WebP at quality 82, the only type the `plant-photos` bucket accepts.
 *
 * `sha256` is of the file we were handed, not of our output, so the same photo
 * sent again still matches the row it made (dedupe).
 */
export const MAX_EDGE = 2048
const WEBP_QUALITY = 82

export interface PreparedPhoto {
  webp: Buffer
  sha256: string
  byteSize: number
  width: number
  height: number
}

/** Throws `NotAnImageError` for anything sharp can't read as a picture. */
export async function preparePhoto(original: Buffer): Promise<PreparedPhoto> {
  const sha256 = createHash('sha256').update(original).digest('hex')
  let out
  try {
    out = await sharp(original)
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true })
  } catch {
    throw new NotAnImageError()
  }
  return { webp: out.data, sha256, byteSize: out.info.size, width: out.info.width, height: out.info.height }
}

export class NotAnImageError extends Error {
  constructor() {
    super('not an image the photo catalogue can read')
  }
}
