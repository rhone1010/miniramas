// lib/store/tests/locked-watermark-size.test.ts
//
// THE MEASUREMENT, RUN RATHER THAN QUOTED.
//
// The bake was removed on 2026-09-09 because it cost megabytes. That number
// came from `.png()` on a JPEG source, and it has been repeated in comments
// and commit messages ever since. This runs it against a real 1K portrait so
// the figure in those comments is checked by the suite instead of trusted.
//
// Skips rather than fails if the source pool is not present: the pool lives
// outside the repo and a machine without it should not see a red suite for
// a measurement.

import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { existsSync, readFileSync } from 'fs'
import { bakeWatermark } from '../preview'

const SOURCE = 'H:/minramas/source-pool/batch_woman_001.jpg'
const have = existsSync(SOURCE)

describe.skipIf(!have)('measured against a real 1K portrait', () => {
  it('the marked locked view is smaller than the master', async () => {
    const raw = readFileSync(SOURCE)
    const master = await sharp(raw)
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer()

    const marked = Buffer.from(await bakeWatermark(master.toString('base64')), 'base64')
    const asPng  = await sharp(marked).png().toBuffer()

    const kb = (b: Buffer) => Math.round(b.length / 1024)
    // Reported so the numbers in preview.ts are visible when this runs.
    console.log(
      `[locked-watermark] master ${kb(master)} KB -> marked jpeg ${kb(marked)} KB ` +
      `(same pixels as PNG would be ${kb(asPng)} KB)`,
    )

    expect(kb(marked)).toBeLessThanOrEqual(kb(master))
    // and the format decision is worth an order of magnitude, not a rounding
    expect(asPng.length).toBeGreaterThan(marked.length * 5)
  })

  it('keeps the master\u2019s dimensions', async () => {
    const raw = readFileSync(SOURCE)
    const master = await sharp(raw)
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer()
    const before = await sharp(master).metadata()
    const after = await sharp(Buffer.from(await bakeWatermark(master.toString('base64')), 'base64')).metadata()
    expect(after.width).toBe(before.width)
    expect(after.height).toBe(before.height)
  })
})
