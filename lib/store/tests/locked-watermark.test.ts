// lib/store/tests/locked-watermark.test.ts
//
// A LOCKED PIECE CARRIES THE MARK IN ITS PIXELS.
//
// The bake was removed from the portfolio path on 2026-09-09 (dfa4f99) to
// stop pushing megabytes at the browser, and locked pieces became clean
// half-size copies. The cost was never the watermark: bakeWatermark ended
// `.png()`, which re-encoded a ~187 KB JPEG from NB2 into ~1.7 MB of lossless
// pixels. As JPEG at the locked derivative's own quality the marked 1K image
// is ~156 KB, smaller than the master it came from.
//
// So the protection is the mark again rather than a resolution too low to be
// worth keeping. These tests hold that invariant at the only place it can be
// checked cheaply -- the bytes themselves -- because every other check
// (a URL, a path, a flag) can be true of a clean image too.

import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { readFileSync } from 'fs'
import path from 'path'
import { bakeWatermark, makeLockedPreview, lockedPreviewPath, LOCKED_PREVIEW_QUALITY } from '../preview'

/** A 1K master shaped like what NB2 returns: a JPEG, not a flat colour --
 *  a flat image compresses to nothing and would hide a size regression. */
async function master(px = 1024): Promise<string> {
  const noise = Buffer.alloc(px * px * 3)
  for (let i = 0; i < noise.length; i += 3) {
    const v = (i * 2654435761) >>> 0
    noise[i] = v & 0xff; noise[i + 1] = (v >> 8) & 0xff; noise[i + 2] = (v >> 16) & 0xff
  }
  const buf = await sharp(noise, { raw: { width: px, height: px, channels: 3 } })
    .jpeg({ quality: 90 }).toBuffer()
  return buf.toString('base64')
}

/** Flat mid-grey: any difference after the bake is the mark, nothing else. */
async function flat(px = 1024): Promise<string> {
  const buf = await sharp({
    create: { width: px, height: px, channels: 3, background: { r: 128, g: 128, b: 128 } },
  }).jpeg({ quality: 95 }).toBuffer()
  return buf.toString('base64')
}

describe('the locked derivative is a JPEG', () => {
  it('encodes JPEG, not PNG', async () => {
    const out = Buffer.from(await bakeWatermark(await master()), 'base64')
    const meta = await sharp(out).metadata()
    expect(meta.format).toBe('jpeg')
  })

  /* The defect, stated as a size. PNG made this ~10x the master. */
  it('is no larger than the master it came from', async () => {
    const src = await master()
    const srcBytes = Buffer.from(src, 'base64').length
    const out = Buffer.from(await bakeWatermark(src), 'base64')
    expect(out.length).toBeLessThanOrEqual(srcBytes)
  })

  it('uses the same quality constant as the locked derivative', async () => {
    expect(LOCKED_PREVIEW_QUALITY).toBe(82)
    const src = readFileSync(path.join(process.cwd(), 'lib/store/preview.ts'), 'utf8')
    expect(src).toMatch(/\.composite\(\[\{ input: await watermarkTile\(tilePx\), tile: true \}\]\)\s*\r?\n\s*\.jpeg\(\{ quality: LOCKED_PREVIEW_QUALITY \}\)/)
  })
})

describe('the Liten mark is actually in the pixels', () => {
  /* Not "a watermark function was called" -- the bytes differ from the clean
     source, and differ in the direction the mark paints. WM_COLOR is white at
     0.25, so a flat mid-grey can only get lighter. */
  it('changes the image', async () => {
    const src = await flat()
    const clean = Buffer.from(src, 'base64')
    const marked = Buffer.from(await bakeWatermark(src), 'base64')

    const a = await sharp(clean).raw().toBuffer()
    const b = await sharp(marked).raw().toBuffer()
    expect(b.equals(a)).toBe(false)
  })

  it('lightens it, which is the direction a white mark paints', async () => {
    const src = await flat()
    const before = await sharp(Buffer.from(src, 'base64')).stats()
    const after  = await sharp(Buffer.from(await bakeWatermark(src), 'base64')).stats()
    expect(after.channels[0].mean).toBeGreaterThan(before.channels[0].mean)
  })

  /* A flat source has no variance; a tiled pattern does. This fails if the
     composite silently produced a uniform image. */
  it('leaves a pattern rather than an even wash', async () => {
    const marked = await bakeWatermark(await flat())
    const st = await sharp(Buffer.from(marked, 'base64')).stats()
    expect(st.channels[0].stdev).toBeGreaterThan(1)
  })

  it('fails closed on a source it cannot read', async () => {
    await expect(bakeWatermark(Buffer.from('not an image').toString('base64')))
      .rejects.toThrow()
  })
})

describe('the locked view stays 1K', () => {
  it('keeps the master’s dimensions', async () => {
    const out = Buffer.from(await bakeWatermark(await master(1024)), 'base64')
    const m = await sharp(out).metadata()
    expect(m.width).toBe(1024)
    expect(m.height).toBe(1024)
  })

  /* The half-size reduction was the OLD protection. It is not applied to the
     baked view, or the mark would be judged at 512 and the piece delivered at
     a resolution nobody chose. */
  it('does not reduce, the way the clean derivative did', async () => {
    const src = await master(1024)
    const baked = await sharp(Buffer.from(await bakeWatermark(src), 'base64')).metadata()
    const clean = await sharp(await makeLockedPreview(src)).metadata()
    expect(clean.width).toBe(512)
    expect(baked.width).toBe(1024)
  })
})

describe('the locked path does not serve the clean image', () => {
  const render = readFileSync(path.join(process.cwd(), 'lib/store/portfolio-render.ts'), 'utf8')

  it('builds the locked view by baking, not by copying the master', async () => {
    expect(render).toMatch(/lockedPreview = Buffer\.from\(await bakeWatermark\(imageB64\), 'base64'\)/)
  })

  /* makeLockedPreview still exists and is still tested -- it is simply no
     longer what a locked customer is shown. */
  it('no longer uses the clean derivative for the locked view', () => {
    expect(render).not.toMatch(/lockedPreview = await makeLockedPreview/)
    expect(render).not.toMatch(/import \{[^}]*makeLockedPreview/)
  })

  /* Fail-closed is the whole reason this is an invariant: without a
     derivative there is nothing a locked browser may see, and the clean
     master is never the substitute. */
  it('fails the item when the bake fails', () => {
    expect(render).toMatch(/locked-preview bake FAILED/)
    expect(render).toMatch(/handleItemFailure\(portfolioItemId, portfolio\.id, item\.attempts, 'locked_preview_failed'\)/)
  })

  it('still writes it to the locked prefix as a jpeg', () => {
    expect(lockedPreviewPath('portraits', 'abc')).toBe('locked/portraits/abc.jpg')
    expect(render).toMatch(/contentType: 'image\/jpeg'/)
  })
})

describe('an owned piece is clean', () => {
  const render = readFileSync(path.join(process.cwd(), 'lib/store/portfolio-render.ts'), 'utf8')

  /* The master is stored before and independently of the bake, and nothing
     marks it. Unlock, print and an unlocked tile all read that object. */
  it('stores the master untouched, separately from the locked view', () => {
    expect(render).toMatch(/const storagePath = await storeCleanOriginal\(supabaseAdmin, previewId, imageB64, portfolio\.series\)/)
    const at = render.indexOf('storeCleanOriginal')
    const bake = render.indexOf('bakeWatermark')
    expect(at).toBeLessThan(bake)   // the clean master is never derived from the marked one
  })

  it('never bakes the master itself', async () => {
    // bakeWatermark returns a NEW buffer; the input string is untouched
    const src = await flat(256)
    const copy = src.slice()
    await bakeWatermark(src)
    expect(src).toBe(copy)
  })
})
