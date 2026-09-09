// lib/store/tests/locked-preview.test.ts
//
// What a browser is allowed to be shown for a portfolio piece.
//
// Before this, /status signed watermarked/{series}/{previewId}.png for every
// finished item without asking whether it had been bought. Two consequences,
// opposite in kind:
//
//   - A customer who had PAID saw a watermarked image every time they
//     reloaded. The clean bytes existed only in UNLOCKED_ART, an in-memory
//     object on the page, so they survived exactly as long as the tab did.
//
//   - A LOCKED piece was protected by a mark baked into the pixels, which
//     turned a ~180-234 KB JPEG master into a 1.9-2.5 MB PNG. A locked
//     four-pack pushed roughly 8 MB of tile art.
//
// The derivative replaces the bake, and the route now asks the ledger. The
// invariant that must survive both changes is the last group here: a locked
// piece is NEVER handed the clean master, whatever is missing.

import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import {
  LOCKED_PREVIEW_PX,
  LOCKED_PREVIEW_QUALITY,
  lockedPreviewPath,
  makeLockedPreview,
} from '../preview'

const PID = '0dedb0d3-8b72-4432-b98a-ff3080f96b59'

// ── the derivative itself ─────────────────────────────────────────

/** A stand-in master at the size NB2 actually returns. */
async function master(px = 1024): Promise<string> {
  const buf = await sharp({
    create: { width: px, height: px, channels: 3, background: { r: 138, g: 115, b: 85 } },
  }).jpeg({ quality: 92 }).toBuffer()
  return buf.toString('base64')
}

describe('makeLockedPreview', () => {
  it('halves a 1024 master to 512', async () => {
    const out = await makeLockedPreview(await master(1024))
    const m = await sharp(out).metadata()
    expect(m.width).toBe(512)
    expect(m.height).toBe(512)
  })

  it('is a JPEG, not the PNG the bake produced', async () => {
    const m = await sharp(await makeLockedPreview(await master())).metadata()
    expect(m.format).toBe('jpeg')
  })

  it('never enlarges a master that is already small', async () => {
    // withoutEnlargement: a 256 master stays 256 rather than being upscaled
    // into a bigger file than the thing it derives from.
    const m = await sharp(await makeLockedPreview(await master(256))).metadata()
    expect(m.width).toBe(256)
  })

  it('comes out substantially smaller than the master', async () => {
    const src = await master(1024)
    const out = await makeLockedPreview(src)
    expect(out.length).toBeLessThan(Buffer.from(src, 'base64').length)
  })

  it('throws on bytes that are not an image, so the caller can fail closed', async () => {
    await expect(makeLockedPreview(Buffer.from('not an image').toString('base64')))
      .rejects.toThrow()
  })

  it('pins the two customer-visible constants', () => {
    // Both are product decisions, not implementation details. If either
    // changes it should be a deliberate edit here too.
    expect(LOCKED_PREVIEW_PX).toBe(512)
    expect(LOCKED_PREVIEW_QUALITY).toBe(82)
  })
})

describe('lockedPreviewPath', () => {
  it('sits under its own prefix, clear of the master and the retired bake', () => {
    const p = lockedPreviewPath('portraits', PID)
    expect(p).toBe(`locked/portraits/${PID}.jpg`)
    expect(p).not.toBe(`portraits/${PID}.png`)              // the clean master
    expect(p).not.toBe(`watermarked/portraits/${PID}.png`)  // the retired bake
  })
})

// ── what the status route chooses ─────────────────────────────────
//
// Mirrors the resolution in app/api/v1/portfolios/[portfolioId]/status.

type Stored = { clean: boolean; derivative: boolean; bake: boolean }

function chooseArt(
  series: string,
  previewId: string,
  unlocked: boolean,
  present: Stored,
  storagePath: string | null = null,
): string | null {
  if (unlocked) {
    const cleanPath = storagePath ?? `${series}/${previewId}.png`
    return present.clean ? cleanPath : null
  }
  if (present.derivative) return lockedPreviewPath(series, previewId)
  if (present.bake) return `watermarked/${series}/${previewId}.png`
  return null
}

const ALL: Stored = { clean: true, derivative: true, bake: true }

describe('an unlocked piece gets the clean master', () => {
  it('serves the master once the ledger says it is paid for', () => {
    expect(chooseArt('portraits', PID, true, ALL)).toBe(`portraits/${PID}.png`)
  })

  it('prefers the recorded storage_path over a rebuilt one', () => {
    // The ledger holds where the master actually went. Rebuilding the path
    // assumes the series on the portfolio still matches the series it was
    // stored under; the recorded value does not have to assume anything.
    expect(chooseArt('portraits', PID, true, ALL, `landscapes/${PID}.png`))
      .toBe(`landscapes/${PID}.png`)
  })

  it('serves nothing rather than a watermark when the master is gone', () => {
    expect(chooseArt('portraits', PID, true, { ...ALL, clean: false })).toBeNull()
  })
})

describe('a locked piece gets the derivative', () => {
  it('serves the derivative when it exists', () => {
    expect(chooseArt('portraits', PID, false, ALL)).toBe(`locked/portraits/${PID}.jpg`)
  })

  it('falls back to the retired bake for a piece not yet backfilled', () => {
    expect(chooseArt('portraits', PID, false, { clean: true, derivative: false, bake: true }))
      .toBe(`watermarked/portraits/${PID}.png`)
  })

  it('serves nothing when neither exists', () => {
    // A tile with no art is a blemish. The alternative is the product.
    expect(chooseArt('portraits', PID, false, { clean: true, derivative: false, bake: false }))
      .toBeNull()
  })
})

describe('THE INVARIANT: a locked piece is never handed the clean master', () => {
  const cleanPaths = [`portraits/${PID}.png`, `landscapes/${PID}.png`]

  it('holds for every combination of what is present in storage', () => {
    for (const derivative of [true, false]) {
      for (const bake of [true, false]) {
        for (const storagePath of [null, `portraits/${PID}.png`]) {
          const got = chooseArt('portraits', PID, false, { clean: true, derivative, bake }, storagePath)
          expect(cleanPaths).not.toContain(got)
          expect(got === null || got.startsWith('locked/') || got.startsWith('watermarked/')).toBe(true)
        }
      }
    }
  })

  it('holds when the derivative is missing — the gap is filled by nothing, not by the master', () => {
    const got = chooseArt('portraits', PID, false, { clean: true, derivative: false, bake: false })
    expect(got).toBeNull()
  })

  it('a piece whose unlock was released goes back to the derivative', () => {
    // releaseClaim sets preview_ledger.unlocked_at back to NULL when there
    // was nothing to spend, so unlocked is not a one-way door. This is also
    // why the backfill covers unlocked pieces too.
    expect(chooseArt('portraits', PID, true, ALL)).toBe(`portraits/${PID}.png`)
    expect(chooseArt('portraits', PID, false, ALL)).toBe(`locked/portraits/${PID}.jpg`)
  })
})
