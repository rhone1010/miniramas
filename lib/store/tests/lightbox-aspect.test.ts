// lib/store/tests/lightbox-aspect.test.ts
//
// Full-size view shows the whole master at its own shape; the gallery card
// does not move.
//
// .lbox__img was a fixed box -- aspect-ratio:var(--card-ar), which is .75 --
// filled with background-size:cover. Cover scales to the larger dimension and
// crops the overflow, so a 1:1 or 4:3 master was cut down to 3:4 there. The
// customer's true canvas was visible nowhere in the UI: the card crops by
// design, and full size cropped by accident.
//
// The fix drives that one box from the piece's stored ratio. When the box
// matches the image, cover has nothing to crop.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const HTML = readFileSync(
  path.join(process.cwd(), 'public', 'discovery-consolidated-draft.html'), 'utf8',
)

/** LBOX_AR, as shipped in the page. */
const LBOX_AR: Record<string, string> = { '1:1': '1', '3:4': '0.75', '4:3': '1.3333' }
const lboxAspectFor = (p: { aspect?: string | null } | null) =>
  (p && p.aspect && LBOX_AR[p.aspect]) || null

/** background-size:cover — scale to fill, crop the overflow.
 *  Returns the fraction of the image's area that is cut off. */
function coverCropFraction(imageAR: number, boxAR: number): number {
  // Cover scales until both axes are filled, so the longer axis overflows and
  // is cut. Whichever way round it is, the surviving fraction of the image is
  // the smaller of the two ratios.
  const visible = Math.min(boxAR / imageAR, imageAR / boxAR)
  return 1 - visible
}

const CARD_AR = 0.75

describe('a purchased master opens full-size at its true ratio', () => {
  it('Square opens 1:1', () => {
    expect(lboxAspectFor({ aspect: '1:1' })).toBe('1')
    expect(Number(lboxAspectFor({ aspect: '1:1' }))).toBeCloseTo(1, 4)
  })

  it('Portrait opens 3:4', () => {
    expect(Number(lboxAspectFor({ aspect: '3:4' }))).toBeCloseTo(3 / 4, 4)
  })

  it('Landscape opens 4:3', () => {
    expect(Number(lboxAspectFor({ aspect: '4:3' }))).toBeCloseTo(4 / 3, 3)
  })
})

describe('nothing is cropped at full size', () => {
  const cases: Array<[string, number]> = [['1:1', 1], ['3:4', 3 / 4], ['4:3', 4 / 3]]

  it('the box takes the image ratio, so cover crops zero', () => {
    for (const [choice, imageAR] of cases) {
      const boxAR = Number(lboxAspectFor({ aspect: choice }))
      expect(coverCropFraction(imageAR, boxAR)).toBeCloseTo(0, 3)
    }
  })

  it('and the old fixed box DID crop the other two', () => {
    // The defect, stated as a number. 3:4 was the only one that survived.
    expect(coverCropFraction(1, CARD_AR)).toBeGreaterThan(0.2)      // Square
    expect(coverCropFraction(4 / 3, CARD_AR)).toBeGreaterThan(0.4)  // Landscape
    expect(coverCropFraction(3 / 4, CARD_AR)).toBeCloseTo(0, 3)     // Portrait
  })

  it('never distorts — the box ratio always equals the image ratio', () => {
    for (const [choice, imageAR] of cases) {
      expect(Number(lboxAspectFor({ aspect: choice }))).toBeCloseTo(imageAR, 3)
    }
  })
})

describe('anything without a stored ratio keeps the old behaviour', () => {
  it('returns null for a preview bundle and for pre-030 pieces', () => {
    expect(lboxAspectFor({ aspect: null })).toBeNull()
    expect(lboxAspectFor({})).toBeNull()
    expect(lboxAspectFor(null)).toBeNull()
  })

  it('returns null for a ratio outside the three, rather than guessing', () => {
    for (const a of ['16:9', '2:3', 'square', '']) {
      expect(lboxAspectFor({ aspect: a })).toBeNull()
    }
  })

  it('the CSS falls back to the literals the rule always had', () => {
    // --lbox-ar unset => width min(86vw, 68vh * .75), aspect var(--card-ar).
    expect(HTML).toContain('width:min(86vw, 68vh * var(--lbox-ar, .75))')
    expect(HTML).toContain('aspect-ratio:var(--lbox-ar, var(--card-ar))')
  })
})

describe('the gallery is untouched', () => {
  it('.card__art keeps its geometry and crop-to-fill, byte for byte', () => {
    expect(HTML).toContain(
      '.card__art{ position:relative; aspect-ratio:var(--card-ar); ' +
      'background:linear-gradient(150deg,#8a725d,#3a2b24); ' +
      'background-size:cover; background-position:center 30% }',
    )
  })

  it('--card-ar is still declared at every breakpoint it was', () => {
    // .75 at four places and .69 at the widest -- unchanged by this work.
    expect((HTML.match(/--card-ar:\.75/g) || []).length).toBe(4)
    expect(HTML).toContain('--card-ar:.69')
    expect(HTML).toContain('--card-ar:.78')
  })

  it('the featured rail image still uses the card ratio, not the piece ratio', () => {
    // .mc-feat__img is part of the rail, not the full-size view.
    expect(HTML).toContain('.mc-feat__img{ aspect-ratio:var(--card-ar)')
    expect(HTML).not.toContain('.mc-feat__img{ aspect-ratio:var(--lbox-ar')
  })

  it('only ONE rule reads --lbox-ar', () => {
    expect((HTML.match(/--lbox-ar/g) || []).length).toBeGreaterThan(0)
    const cssUses = (HTML.match(/var\(--lbox-ar/g) || []).length
    expect(cssUses).toBe(2) // the width and the aspect-ratio of .lbox__img
  })
})
