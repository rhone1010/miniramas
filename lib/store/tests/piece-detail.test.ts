// lib/store/tests/piece-detail.test.ts
//
// THE TWO STATES A PIECE CAN BE IN, AND THE ACTIONS EACH ONE ALLOWS.
//
// Rich's board, screens 6 and 7. A piece opened from My Collection is either
// a Preview -- locked art, with an included unlock to spend or $2.99 to pay
// -- or Owned, with the clean file to view and download. The states are not
// cosmetic: offering Download on a locked piece would hand over artwork that
// was never paid for, and offering Unlock on an owned one would invite a
// second charge for something already bought.
//
// These assert against the shipping page rather than a copy, and against the
// real capabilities underneath: unlockPiece is the call both grid surfaces
// already make (so the included-then-paid ordering and the in-flight guard
// are not reimplemented), and downloadPiece is the existing download,
// including its fetch of the clean master.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const HTML = readFileSync(
  path.join(process.cwd(), 'public/discovery-consolidated-draft.html'), 'utf8',
)

/** The detail's painter, where the two states are decided. */
const paint = (() => {
  const at = HTML.indexOf('function paintPieceDetail()')
  expect(at, 'paintPieceDetail is no longer in the page').toBeGreaterThan(-1)
  return HTML.slice(at, at + 4200)
})()

describe('a piece is Preview or Owned, and says which', () => {
  it('decides from the lock, not from a separate flag', () => {
    expect(paint).toMatch(/var owned = !p\.locked/)
  })

  it('badges both states', () => {
    expect(paint).toMatch(/owned \? 'Owned' : 'Preview'/)
    expect(paint).toMatch(/is-owned/)
    expect(paint).toMatch(/is-preview/)
  })
})

describe('Owned offers the real file and nothing that charges', () => {
  const owned = paint.slice(paint.indexOf('if (owned){'), paint.indexOf('/* Preview.'))

  it('offers View Full Size and Download', () => {
    expect(owned).toMatch(/View Full Size/)
    expect(owned).toMatch(/'Download'/)
  })

  it('uses the existing download rather than a second implementation', () => {
    expect(owned).toMatch(/downloadPiece\(p\)/)
  })

  /* THE ONE THAT MATTERS. An owned piece must not be able to start a
     purchase for something the customer already has. */
  it('offers no unlock of any kind', () => {
    expect(owned).not.toMatch(/unlockPiece/)
    expect(owned).not.toMatch(/Unlock for/)
    expect(owned).not.toMatch(/Included Unlock/)
  })

  it('reports a failed save instead of failing silently', () => {
    expect(owned).toMatch(/could not be saved just now/)
  })
})

describe('Preview offers the included unlock first, then the paid one', () => {
  const preview = paint.slice(paint.indexOf('/* Preview.'))

  it('shows the included unlock only while the portfolio has one', () => {
    expect(preview).toMatch(/var left = includedRemainingFor\(p\)/)
    expect(preview).toMatch(/if \(left > 0\)\{/)
    expect(preview).toMatch(/Use Included Unlock \(' \+ left \+ ' available\)/)
  })

  it('always offers the paid unlock, priced from the server constant', () => {
    expect(preview).toMatch(/Unlock for \$' \+ \(UNLOCK_PRICE_CENTS \/ 100\)\.toFixed\(2\)/)
  })

  /* Both buttons call the SAME entry point. The board's two buttons say
     which unlock will happen; they do not each decide it, because deciding
     it twice is how the included allowance and the charge get out of step. */
  it('routes both through unlockPiece', () => {
    const calls = preview.match(/unlockPiece\(p\)/g) || []
    expect(calls.length).toBe(2)
  })

  it('never offers a download of art that is still locked', () => {
    expect(preview).not.toMatch(/downloadPiece/)
    expect(preview).not.toMatch(/View Full Size/)
  })
})

describe('the detail walks what the customer is looking at', () => {
  it('lists from mcVisible, so filters and order agree with the grid', () => {
    expect(HTML).toMatch(/function pcList\(\)\{ return mcVisible\(\)/)
  })

  it('never opens on a piece that is still crafting', () => {
    expect(HTML).toMatch(/filter\(function\(p\)\{ return !p\.crafting; \}\)/)
  })

  it('carries collection context from the real created_at', () => {
    expect(paint).toMatch(/portfolioMadeOn\(p\.portfolioId\)/)
    expect(paint).toMatch(/Part of your ' \+ made \+ ' collection/)
  })

  it('bounds previous and next at the ends', () => {
    expect(paint).toMatch(/prev\.disabled = PC_AT === 0/)
    expect(paint).toMatch(/next\.disabled = PC_AT === list\.length - 1/)
  })
})

describe('Printshop is not invented', () => {
  it('offers no print action anywhere in the detail', () => {
    expect(paint).not.toMatch(/Make a Print/i)
    expect(paint).not.toMatch(/printshop/i)
  })
})

describe('the board copy Rich approved', () => {
  it('names the Curator actions as the board does', () => {
    expect(HTML).toMatch(/>Pick 4 Me</)
    expect(HTML).toMatch(/<span>Effect Map<\/span>/)
  })

  it('gives the map a labelled See All, not only a caret', () => {
    expect(HTML).toMatch(/id="aeSeeAll"/)
    expect(HTML).toMatch(/'See All'/)
  })

  /* Delegated, like every other rail control -- the rail is rebuilt by five
     call sites and none of them should own a listener. */
  it('handles both doors through the existing delegation', () => {
    expect(HTML).toMatch(/if \(c\('#allToggle'\) \|\| c\('#aeSeeAll'\)\)/)
  })
})

describe('the post-payment states orient without trapping', () => {
  const band = HTML.slice(HTML.indexOf('__M2_POST_PAYMENT__ (Rich'), HTML.indexOf('var lastGroup = null'))

  it('has all four states', () => {
    expect(band).toMatch(/Payment received/)
    expect(band).toMatch(/Creating your collection/)
    expect(band).toMatch(/A new portrait is ready/)
    expect(band).toMatch(/Your collection is ready/)
    expect(band).toMatch(/of ' \+ total \+ ' ready/)
  })

  /* The arrival is momentary because the FACT is momentary: JUST_LANDED holds
     the keys that turned from crafting to done on this tick and is cleared by
     the tile builder, so the band returns to the count on the next paint with
     no timer to keep in step. */
  it('marks an arrival from the same signal the tiles animate from', () => {
    expect(band).toMatch(/Object\.keys\(JUST_LANDED\)\.length/)
  })

  it('still says how many are ready while marking the arrival', () => {
    expect(band).toMatch(/is-making is-new/)
    expect(band).toMatch(/still being crafted/)
  })

  /* The band sits in the grid with the pieces, not over them: a customer can
     browse and unlock finished work while the rest arrives, which is the
     board's own principle and the reason these are not takeovers. */
  it('appends into the collection rather than covering it', () => {
    expect(band).toMatch(/mycollGrid\.appendChild\(el\)/)
    expect(band).not.toMatch(/position:fixed/)
  })

  it('shows the ready moment once rather than for ever', () => {
    expect(band).toMatch(/JUST_FINISHED/)
    expect(HTML).toMatch(/if \(band\.cls === 'is-done'\) JUST_FINISHED = false/)
  })

  it('invents no order number', () => {
    expect(HTML).not.toMatch(/LC-\d{4,}/)
    expect(HTML).not.toMatch(/Order #/)
  })
})
