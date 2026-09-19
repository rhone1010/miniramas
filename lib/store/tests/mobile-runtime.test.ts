// lib/store/tests/mobile-runtime.test.ts
//
// THE DEFECTS BROWSERSTACK FOUND THAT THE COMPLIANCE PASS DID NOT.
//
// Every one of these shipped with tests passing and CSS that read correctly
// in isolation. They were found by a person looking at a phone. What they
// have in common is that each depended on something the stylesheet could not
// see on its own -- a container whose height no longer bounds anything, a
// class nested one level deeper than the grid placing it, a status value with
// no state to land in, a body class cleared by the screen that needed it.
//
// So these assert the JOINS rather than the declarations.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const HTML = readFileSync(
  path.join(process.cwd(), 'public/discovery-consolidated-draft.html'), 'utf8',
)

describe('the Discovery grid gives every effect its own cell', () => {
  /* The desktop silo sizes cards from the CONTAINER's height -- two rows that
     must fit a stage that cannot scroll. A phone stage scrolls and a room is
     three rows or more, so each card was sizing to half a container height
     that bounded nothing and growing into the row below. */
  it('stops driving the grid from container height below 1024', () => {
    expect(HTML).toMatch(/\.silo-block \.effect-grid\{[\s\S]{0,200}container-type:normal/)
    expect(HTML).toMatch(/\.silo-block \.effect-grid\{[\s\S]{0,200}grid-template-rows:none/)
  })

  it('lets rows take their height from their contents', () => {
    expect(HTML).toMatch(/\.silo-block \.effect-grid\{[\s\S]{0,240}grid-auto-rows:max-content/)
  })

  it('gives the card its column rather than a height-derived width', () => {
    expect(HTML).toMatch(/\.silo-block \.card, \.silo-block \.title-card\{ width:100% \}/)
  })

  /* Whatever the source image is, nothing paints outside the cell. */
  it('clips the card and pins the art to the ratio', () => {
    expect(HTML).toMatch(/\.effect-grid \.card\{ overflow:hidden \}/)
    expect(HTML).toMatch(/\.effect-grid \.card__art\{ aspect-ratio:var\(--card-ar\); width:100% \}/)
  })
})

describe('the Review list is a row, not a card with a row inside it', () => {
  /* .card has ONE child, .card__art; the name and the remove are nested
     INSIDE that. A three-column grid on .card therefore had one item to
     place -- the thumbnail took column one and the other two held nothing,
     which is the "tiny thumbnail stranded in a large empty card". */
  it('lays the row out as flex with a fixed thumbnail', () => {
    expect(HTML).toMatch(/#reviewGrid\.rv-list \.card\.fan-card\{[\s\S]{0,220}display:flex/)
    expect(HTML).toMatch(/#reviewGrid\.rv-list \.card\.fan-card \.card__art\{[\s\S]{0,140}flex:0 0 56px/)
  })

  it('positions the nested name and remove against the row itself', () => {
    expect(HTML).toMatch(/#reviewGrid\.rv-list \.card__content\{[\s\S]{0,160}position:absolute/)
    expect(HTML).toMatch(/#reviewGrid\.rv-list \.card__badge\{[\s\S]{0,160}position:absolute/)
  })

  it('has no tall empty interior', () => {
    expect(HTML).toMatch(/#reviewGrid\.rv-list \.card\.fan-card\{[\s\S]{0,120}aspect-ratio:auto/)
    expect(HTML).toMatch(/#reviewGrid\.rv-list \.card\.fan-card\{[\s\S]{0,140}min-height:72px/)
  })

  it('still uses the list only at 8 and 16', () => {
    expect(HTML).toMatch(/rv-list', stacked && fanState\.tier >= 8/)
  })
})

describe('a failed render is not a crafting one', () => {
  /* Eight tiles turning for ever. `crafting: i.status !== 'done'` is true of
     a FAILED item as well as a pending one, and the poll gives up silently at
     60 x 3s -- so after three minutes the animation was the only thing still
     moving. */
  it('reads failed as its own state', () => {
    expect(HTML).toMatch(/var itemFailed = i\.status === 'failed'/)
    expect(HTML).toMatch(/crafting: i\.status !== 'done' && !itemFailed/)
  })

  it('carries the state into the pieces the grid draws', () => {
    const copies = HTML.match(/crafting:item\.crafting, failed:item\.failed,/g) || []
    expect(copies.length).toBe(2)
  })

  it('draws a still card rather than a turning one', () => {
    expect(HTML).toMatch(/if \(p\.failed\)\{/)
    expect(HTML).toContain('Didn’t finish')
    // and the gear stays with work that is actually happening
    expect(HTML).toMatch(/\} else if \(p\.crafting\)\{/)
  })

  /* Counting a stopped piece as ready overstates what the customer has;
     counting it as crafting means the bar never reaches full. */
  it('counts it as neither ready nor in flight', () => {
    expect(HTML).toMatch(/var stopped = mine\.filter\(function\(p\)\{ return p\.failed; \}\)\.length/)
    expect(HTML).toMatch(/var ready  = total - making - stopped/)
  })

  it('says so above the grid instead of claiming the collection is ready', () => {
    expect(HTML).toMatch(/Some pieces did not finish/)
  })
})

describe('one forward action per step', () => {
  /* Format cleared is-review, and the rail keyed everything off that -- so
     the phone showed the count, "Review Collection" and "Craft My Collection"
     at once: three forward actions, two of them for steps already behind. */
  it('names the Format stage on the body', () => {
    expect(HTML).toMatch(/document\.body\.classList\.add\('is-format'\)/)
  })

  it('drops the earlier steps’ controls there', () => {
    expect(HTML).toMatch(/body\.is-format \.your-collection\.is-docked \.btn-review,[\s\S]{0,160}display:none/)
  })

  it('clears the class on every way out, so it cannot outlive the screen', () => {
    const cleared = HTML.match(/classList\.remove\('is-format'\)/g) || []
    expect(cleared.length).toBeGreaterThanOrEqual(4)
  })
})

describe('every screen has a way back', () => {
  /* The handler for #btnBackAspect has existed since the pose step was
     bypassed. The button never did. */
  it('gives Format the button its handler was always waiting for', () => {
    expect(HTML).toMatch(/id="btnBackAspect"/)
    expect(HTML).toMatch(/closest\('#btnBackAspect'\)\)\{ hideAspect\(\)/)
  })

  it('keeps Review’s way back on a phone', () => {
    // the icon and the sentence go; the control stays
    expect(HTML).toMatch(/\.review-banner__icon, \.review-banner p\{ display:none \}/)
    expect(HTML).toMatch(/\.review-banner \.back-btn\{[\s\S]{0,140}display:inline-flex/)
  })

  it('returns to Review with the work intact, not to Discovery', () => {
    expect(HTML).toMatch(/function hideAspect\(\)\{[\s\S]{0,320}showReview\(\)/)
  })
})

describe('no source sends the customer to the Curator, not to look for it', () => {
  /* Below 1024 the photo stamp lives inside a sheet that starts shut, so
     "please upload an image first" named a control that was not on screen. */
  it('opens the sheet as well as explaining', () => {
    expect(HTML).toMatch(/function requirePhoto\(anchorEl\)\{[\s\S]{0,1600}classList\.add\('rail-open'\)/)
    expect(HTML).toMatch(/Please upload an image first/)
  })

  /* This gate stands in front of Review and checkout. It must not throw
     where matchMedia is absent -- a photo guard that fails open would let
     corrupt work reach paid rendering. */
  it('cannot throw where matchMedia is missing', () => {
    expect(HTML).toMatch(/typeof window !== 'undefined' && window\.matchMedia &&/)
  })
})
