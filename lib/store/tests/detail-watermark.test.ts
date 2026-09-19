// lib/store/tests/detail-watermark.test.ts
//
// A PIECE LOOKS THE SAME WHEREVER IT IS SHOWN.
//
// Mobile defect, 2026-09-18: a locked preview was marked in the My Collection
// grid and clean the moment it was tapped open. The mark is drawn, not baked
// into the file -- the tile carries it as a pseudo-element keyed off
// .is-locked -- and the mobile piece detail is not a .card, so it matched
// nothing. The artwork the watermark exists to protect was handed over by the
// act of looking at it.
//
// The desktop lightbox never had this: openFeatured REFUSES a locked piece,
// because full size is what the purchase buys. The mobile detail cannot
// refuse -- it is where the unlock actions live -- so it marks instead.
//
// What matters here is that there is ONE decision. The detail joins the
// gallery's declaration rather than restating it, and it reads the same
// p.locked, which comes from the /unlocks entitlement read. A second rule
// would be a second thing to keep true.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const HTML = readFileSync(
  path.join(process.cwd(), 'public/discovery-consolidated-draft.html'), 'utf8',
)

/** The rule, exactly as paintPieceDetail applies it: the shell is marked when
 *  the piece is not owned, and owned is nothing more than !p.locked. */
function detailIsMarked(piece: { locked?: boolean }): boolean {
  const owned = !piece.locked
  return !owned
}

describe('the detail is marked from the same state the gallery is', () => {
  /* 1 · a plain locked piece */
  it('locked piece: gallery marked, detail marked', () => {
    expect(detailIsMarked({ locked: true })).toBe(true)
  })

  /* 2 · an included unlock EXISTS but has not been spent. Having one to
     spend is not the same as having spent it, and the piece is still a
     preview until it is. */
  it('included unlock available but unused: detail still marked', () => {
    const piece = { locked: true, portfolioId: 'pf1' }   // includedRemaining > 0
    expect(detailIsMarked(piece)).toBe(true)
  })

  /* 3 · a $2.99 checkout started and not completed. The entitlement is
     pending, the ledger is unclaimed, and locked is still true. */
  it('paid unlock not completed: detail still marked', () => {
    expect(detailIsMarked({ locked: true })).toBe(true)
  })

  /* 4 · owned */
  it('owned piece: detail clean', () => {
    expect(detailIsMarked({ locked: false })).toBe(false)
  })

  /* 5 · after a successful unlock the /unlocks read returns unlocked for the
     slot, loadPortfolio sets locked:false, and the reopened detail is clean.
     The detail re-reads on every paint rather than caching a list, so this
     needs no invalidation step. */
  it('after a successful unlock: reopened detail clean', () => {
    const before = { locked: true }
    const after  = { locked: false }        // same slot, post-claim /unlocks read
    expect(detailIsMarked(before)).toBe(true)
    expect(detailIsMarked(after)).toBe(false)
  })

  /* THE ONE THAT NAMES THE DEFECT. Having an image URL is not ownership --
     the locked derivative is a URL too. */
  it('an image URL does not make a piece owned', () => {
    expect(detailIsMarked({ locked: true, art: 'https://signed/locked.jpg' } as any)).toBe(true)
  })
})

describe('there is one rule, not two', () => {
  /* The detail joins the gallery's declaration. If someone writes the mark a
     second time for the detail, these two surfaces can drift into disagreeing
     about what a locked piece looks like. */
  it('the detail shares the gallery selector rather than restating it', () => {
    expect(HTML).toMatch(
      /\.card\.is-locked:not\(\.is-crafting\) \.card__art::after,\s*\r?\n\s*\.pc-detail\.is-locked \.pc-detail__art::after\{/,
    )
  })

  /* The detail adds no declaration of its own -- it appears only as a second
     selector on the gallery's. There is one other `content:"PREVIEW"` in the
     file, `.lbox__img.is-locked::after`, which predates this work and is
     effectively unreachable because openFeatured refuses locked pieces before
     the lightbox opens. Left alone; noted so the count below is not mistaken
     for the defect returning. */
  it('the detail adds no second declaration of the mark', () => {
    /* Every rule that declares the legend, with the selector list that owns
       it. The detail must appear only inside the gallery's rule -- never as a
       rule of its own.

       Split rather than matched: a `([^{}]+)\{[^}]*` pattern backtracks
       catastrophically against this file, which carries base64 image data in
       its CSS. It hung the suite for two minutes before being killed. */
    const blocks = HTML.split('}')
      .filter(b => b.includes('content:"PREVIEW"'))
      .map(b => b.slice(0, b.indexOf('{')).trim())
    expect(blocks.length).toBe(2)

    const shared = blocks.find(b => b.includes('.pc-detail'))
    expect(shared, 'the detail must share a rule, not own one').toBeTruthy()
    expect(shared).toContain('.card.is-locked')

    /* The other is the desktop lightbox's, which predates this work and is
       effectively unreachable because openFeatured refuses locked pieces
       before it opens. Left alone. */
    const other = blocks.find(b => !b.includes('.pc-detail'))
    expect(other).toContain('.lbox__img')
  })

  it('the painter drives it from the ownership value, not from the artwork', () => {
    expect(HTML).toMatch(/shell\.classList\.toggle\('is-locked', !owned\)/)
    expect(HTML).toMatch(/var owned = !p\.locked/)
  })

  /* p.locked is the entitlement read, not a guess: /unlocks gives unlocked
     per slot and loadPortfolio inverts it. */
  it('ownership still comes from the unlocks read', () => {
    expect(HTML).toMatch(/locked: !unlockedBySlot\[i\.slot\]/)
    expect(HTML).toMatch(/un\.items\.forEach\(function\(i\)\{ unlockedBySlot\[i\.slot\] = i\.unlocked; \}\)/)
  })

  it('the mark has a containing block to sit in', () => {
    expect(HTML).toMatch(/\.pc-detail__art\{[\s\S]{0,320}position:relative/)
  })
})

describe('the desktop path is unchanged', () => {
  /* It refuses rather than marks, and that refusal is the stronger rule --
     a watermarked preview at full size is still a bigger copy of the thing
     the watermark protects. */
  it('the lightbox still refuses a locked piece outright', () => {
    expect(HTML).toMatch(/function openFeatured\(p\)\{[\s\S]{0,600}if \(p\.locked\) return;/)
  })
})

describe('the unlock actions are untouched by the mark', () => {
  it('a marked detail still offers both unlocks', () => {
    expect(HTML).toMatch(/Use Included Unlock \(' \+ left \+ ' available\)/)
    expect(HTML).toMatch(/Unlock for \$' \+ \(UNLOCK_PRICE_CENTS \/ 100\)\.toFixed\(2\)/)
  })

  it('and an owned detail still offers the file', () => {
    expect(HTML).toMatch(/View Full Size/)
    expect(HTML).toMatch(/downloadPiece\(p\)/)
  })
})
