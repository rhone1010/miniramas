// lib/store/tests/mobile-format.test.ts
//
// MOBILE IS A FOURTH FORMAT, NOT A CROP.
//
// Matrix B2 asks for "Native NB2 output, not crop", and the word that
// matters is native. It would have been easy to offer Mobile in the Format
// step, store 3:4, and trim the result to a phone shape afterwards -- the
// customer sees a tall picture either way, and nothing in the UI would give
// it away. What they would actually receive is a portrait with its sides cut
// off: a composition framed for one canvas, shown on another.
//
// So these tests guard the chain end to end. Each link is a place where
// Mobile could quietly become something else:
//
//   the UI offers it          -> ASPECTS carries 9:16
//   checkout records it       -> normalizeAspectChoice returns it, not null
//   the database permits it   -> migration 033 widens the constraint
//   the render is asked for it-> PORTRAIT_OUTPUT_ASPECTS contains it
//   the frame is composed     -> PHONE_COMPOSITION is appended at 9:16
//
// The fourth link is the one that failed silently before this change:
// normalizeAspectChoice recorded an unrecognised ratio as null with a
// console warning, so a Mobile purchase would have rendered as whatever the
// framing implied, and the only evidence would have been a line in a log.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { normalizeAspectChoice } from '../portfolio-checkout'
import { PORTRAIT_OUTPUT_ASPECTS, isPortraitOutputAspect } from '@/lib/v1/portraits/portraits-shared'
import { PHONE_COMPOSITION, WALLPAPER_ASPECT } from '@/lib/v1/shared/render-aspect'

const ROOT = path.join(process.cwd())
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')

const MOBILE = '9:16'

describe('the Format step offers Mobile', () => {
  const html = read('public/discovery-consolidated-draft.html')

  it('carries a fourth option at 9:16', () => {
    expect(html).toMatch(/id:'mobile',\s*ratio:'9:16'/)
  })

  it('offers exactly the four ratios the render accepts', () => {
    const ids = [...html.matchAll(/\{ id:'(\w+)',\s+ratio:'([\d:]+)'/g)].map(m => m[2])
    expect(ids).toEqual(['3:4', '1:1', '4:3', '9:16'])
    expect(new Set(ids)).toEqual(new Set(PORTRAIT_OUTPUT_ASPECTS))
  })

  /* The lightbox shapes a piece from its stored ratio. Without an entry a
     9:16 render falls back to null and is shown in the box's default shape --
     the one remaining place a native phone render would still look cropped. */
  it('knows how tall a Mobile piece is', () => {
    expect(html).toMatch(/'9:16':\s*'0\.5625'/)
  })
})

describe('checkout records Mobile rather than losing it', () => {
  it('keeps 9:16', () => {
    expect(normalizeAspectChoice(MOBILE)).toBe(MOBILE)
  })

  it('still keeps the other three', () => {
    expect(normalizeAspectChoice('1:1')).toBe('1:1')
    expect(normalizeAspectChoice('3:4')).toBe('3:4')
    expect(normalizeAspectChoice('4:3')).toBe('4:3')
  })

  /* THE FAILURE THIS REPLACES. An unrecognised ratio still records null --
     that behaviour is correct and deliberate -- but Mobile is no longer one
     of the unrecognised ones. */
  it('still records null for a ratio nothing supports', () => {
    expect(normalizeAspectChoice('16:9')).toBeNull()
    expect(normalizeAspectChoice('nonsense')).toBeNull()
    expect(normalizeAspectChoice(null)).toBeNull()
  })

  /* One list, not two. The client's options and the render's accepted set
     were separate literals, which is exactly how a fourth option could be
     offered by one and refused by the other. */
  it('defers to the list the render owns rather than repeating it', () => {
    const src = read('lib/store/portfolio-checkout.ts')
    expect(src).toMatch(/isPortraitOutputAspect\(aspectRatio\)/)
    expect(src).not.toMatch(/aspectRatio === '1:1' \|\| aspectRatio === '3:4'/)
  })
})

describe('the database permits Mobile', () => {
  const sql = read('supabase/migrations/033_portfolios_aspect_mobile.sql')

  it('widens the constraint to four ratios', () => {
    expect(sql).toMatch(/'1:1',\s*'3:4',\s*'4:3',\s*'9:16'/)
  })

  it('still allows null, so nothing existing is invalidated', () => {
    expect(sql).toMatch(/aspect_ratio is null or aspect_ratio in/)
  })

  it('drops the old constraint by name before adding the new one', () => {
    const drop = sql.indexOf('drop constraint if exists portfolios_aspect_ratio_check')
    const add  = sql.indexOf('add  constraint portfolios_aspect_ratio_check')
    expect(drop).toBeGreaterThan(-1)
    expect(add).toBeGreaterThan(drop)
  })
})

describe('a Mobile render is composed for a phone', () => {
  const gen = read('lib/v1/portraits/portraits-generator.ts')

  it('appends the phone clause at 9:16 and nothing at the other ratios', () => {
    expect(gen).toMatch(/req\.output_aspect_ratio === WALLPAPER_ASPECT/)
    expect(gen).toMatch(/\$\{posed\}\\n\\n\$\{PHONE_COMPOSITION\}/)
  })

  /* BORROWED, NOT REWRITTEN. render-aspect.ts argues at length that a
     composition clause belongs to the SURFACE and must exist once. A second
     phone clause written for Portraits would be the same mistake the
     Halloween bodies made, and this asserts it was not made again. */
  it('uses the constant the wallpaper room already uses', () => {
    expect(gen).toMatch(/from '\.\.\/shared\/render-aspect'/)
    expect(PHONE_COMPOSITION).toMatch(/subject sits low in the tall frame/)
    expect(WALLPAPER_ASPECT).toBe(MOBILE)
  })

  /* It goes after the whole body, where pose already goes, because
     portraits-bodies.ts is authoritative and its bodies are verbatim --
     buildEffectPrompt composes nothing, so a clause added inside a prompt
     builder would miss nearly every effect. */
  it('appends after the body, alongside pose, not inside a prompt builder', () => {
    const posed = gen.indexOf('const posed =')
    const framed = gen.indexOf('const framed =')
    const styleRef = gen.indexOf('const prompt = styleRefs.length > 0')
    expect(posed).toBeGreaterThan(-1)
    expect(framed).toBeGreaterThan(posed)
    expect(styleRef).toBeGreaterThan(framed)
    // and the style-ref clause now builds on the framed prompt, not the raw one
    expect(gen).toMatch(/\$\{framed\}\\n\\n\$\{STYLE_REF_CLAUSE\}/)
  })

  it('the prompt builder was left alone', () => {
    const prompt = read('lib/v1/portraits/portraits-prompt.ts')
    expect(prompt).not.toMatch(/PHONE_COMPOSITION/)
  })
})

describe('the render accepts Mobile', () => {
  it('has it in the accepted set', () => {
    expect(isPortraitOutputAspect(MOBILE)).toBe(true)
  })

  it('and the route will not answer unsupported_output_aspect_ratio for it', () => {
    const route = read('app/api/v1/portraits/generate/route.ts')
    expect(route).toMatch(/isPortraitOutputAspect\(body\.output_aspect_ratio\)/)
  })
})
