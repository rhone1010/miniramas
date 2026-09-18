// lib/store/tests/mobile-rail.test.ts
//
// THE RAIL ALWAYS HAS ITS ACTION.
//
// The desktop rule is deliberate and stays: `.btn-review{ display:none }`
// with `.btn-review.on{ display:block }`, and the comment beside it says why
// -- "Review appears when the count sits on a tier; otherwise the instrument
// above it is the instruction. Not greyed -- absent."
//
// That instrument is the tier discs. Rich's board removes them from mobile,
// which quietly removed the instruction as well: nothing adds `.on` on
// Discovery (updateCollectionSummary removes it on every repaint), so the
// docked rail had a Curator, a count, and nothing to press. A customer could
// choose four effects on a phone and have no way forward.
//
// The board draws Review in all five states -- 0, 1, 4, 8, 16 -- greyed at
// zero and live from one. So the docked rail shows it always and lets
// :disabled carry the state, scoped to .is-docked so desktop is untouched.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const HTML = readFileSync(
  path.join(process.cwd(), 'public/discovery-consolidated-draft.html'), 'utf8',
)

describe('the docked rail always offers Review', () => {
  it('shows it regardless of .on', () => {
    expect(HTML).toMatch(/\.your-collection\.is-docked \.btn-review\{[\s\S]{0,120}display:block/)
  })

  /* The desktop rule must survive. Removing it to fix the phone would change
     a deliberate desktop behaviour nobody asked about. */
  it('leaves the desktop absent-not-greyed rule alone', () => {
    expect(HTML).toMatch(/\.btn-review\{ display:none \} \.btn-review\.on\{ display:block \}/)
  })

  /* Disabled is the state carrier, and it is already set from the count --
     no second source of truth about whether Review is available. */
  it('lets the existing disabled state carry state 0', () => {
    expect(HTML).toMatch(/btn\.disabled = SELECTED\.length === 0/)
    expect(HTML).toMatch(/\.btn-review:disabled\{ opacity:\.45/)
  })

  /* The pulse belongs to a control that APPEARS. One that is always present
     would pulse at every repaint. */
  it('does not pulse a button that was already there', () => {
    expect(HTML).toMatch(/\.your-collection\.is-docked \.btn-review\{[\s\S]{0,200}animation:none/)
  })
})

describe('the rail is one row at every width the board covers', () => {
  it('never wraps', () => {
    expect(HTML).toMatch(/\.your-collection\.is-docked\{[\s\S]{0,400}flex-wrap:nowrap/)
  })

  /* It used to take its own line below the count, from the wrapping rail this
     replaced. Full width in a single row would push the Curator and the count
     off the end of it. */
  it('sizes the action to its text rather than the rail', () => {
    expect(HTML).not.toMatch(/\.your-collection\.is-docked \.btn-review\{ width:100%; order:4; \}/)
  })
})

describe('the board replaced the tier discs, and the count replaced them', () => {
  it('hides the discs on mobile only', () => {
    expect(HTML).toMatch(/\.your-collection\.is-docked \.tier\{ display:none; \}/)
    // still a control on desktop: trim/fill is not lost, only relocated away
    // from a 360px screen
    expect(HTML).toMatch(/\.tier \.mark\[data-trim\], \.tier \.mark\[data-fill\]\{ cursor:pointer \}/)
  })

  it('draws the count as the board does -- a filling line and N of target', () => {
    // built by the dock shim, not present as markup — the docked bar outlives
    // the five rail rebuilds, so its parts are created rather than templated
    expect(HTML).toMatch(/prog\.className = 'rail-prog'/)
    expect(HTML).toMatch(/rail-prog__bar i'\)\.style\.width/)
    expect(HTML).toMatch(/'of ' \+ t/)
  })

  it('reaches the rail on every selection change', () => {
    // updateCollectionSummary is what every selection path ends in
    expect(HTML).toMatch(/__M2_RAIL_STATES__ The docked rail carries the count/)
  })

  it('marks the empty state so 0 reads differently from 1', () => {
    expect(HTML).toMatch(/prog\.classList\.toggle\('is-empty', n === 0\)/)
    expect(HTML).toMatch(/\.rail-prog\.is-empty/)
  })

  it('steps aside on Review, where the count is the header’s job', () => {
    expect(HTML).toMatch(/document\.body\.classList\.contains\('is-review'\)/)
  })
})

describe('nothing floats over the artwork any more', () => {
  it('docks the Curator inside the rail instead of above it', () => {
    expect(HTML).toMatch(/coll\.insertBefore\(fab, coll\.firstChild\)/)
    expect(HTML).toMatch(/\.rail-fab\{ bottom:auto; \}/)
  })

  it('moves help to the masthead and suppresses the floating circle', () => {
    expect(HTML).toMatch(/\.tour-fab\{ display:none; \}/)
    expect(HTML).toMatch(/id="mhHelp"/)
  })
})
