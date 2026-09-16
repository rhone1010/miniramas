// lib/store/tests/curated-bench.test.ts
//
// PASS 2, 2026-09-13 (Rich): the Curated bench. A session draws 16 of the
// authoritative 25 (never Ebony, Fire Face or Mercury) and shows them one
// page of 8 at a time. The bench is stable until the customer rerolls it.
// A reroll replaces ONLY the open (unchosen) places; a chosen effect never
// moves; an effect never comes back into the place it just left; an effect
// rerolled away may come back on a later reroll.
//
// These run the SHIPPED CURATED_UNIVERSE, curatedEffect, shuffled, isChosen,
// validBench, drawBench, rerollBench, curatedPreviewUrl and curatedPage, cut
// out of the page by name, against the page's own registry ids.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const FILE = path.join(process.cwd(), 'public', 'discovery-consolidated-draft.html')
const HTML = readFileSync(FILE, 'utf8').replace(/\r\n/g, '\n')

function matchBrace(src: string, open: number, o = '{', c2 = '}'): number {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const c = src[i], n = src[i + 1]
    if (c === '/' && n === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue }
    if (c === '/' && n === '*') { i = src.indexOf('*/', i + 2) + 1; continue }
    if (c === "'" || c === '"' || c === '`') {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++
      continue
    }
    if (c === o) depth++
    else if (c === c2) { depth--; if (depth === 0) return i }
  }
  throw new Error('unbalanced from ' + open)
}
const fn = (name: string) => {
  const at = HTML.indexOf('\nfunction ' + name + '(')
  if (at < 0) throw new Error('function not found in page: ' + name)
  return HTML.slice(at + 1, matchBrace(HTML, HTML.indexOf('{', at)) + 1)
}
const arrSrc = (name: string) => {
  const at = HTML.indexOf('\nvar ' + name + ' = [')
  if (at < 0) throw new Error(name + ' not found')
  const open = HTML.indexOf('[', at)
  return HTML.slice(at + 1, matchBrace(HTML, open, '[', ']') + 1) + ';'
}
const universeSrc = arrSrc('CURATED_UNIVERSE')
const platesSrc = arrSrc('CURATED_PLATES')

/* 25 since 2026-09-16 (Rich): cast_glass retired with the catalog change;
   then crystallized, petal_sculpture, deco_twenties, sand_form and
   porcelain left Curated -- they stay live in their own rooms and in All
   Effects -- and mosaic_portrait, designer_vinyl, action_figure and
   cubism joined. Ebony was never in the bench and still is not. */
const AUTHORITATIVE = [
  'reclaimed_bronze', 'retro_robot', 'stained_glass', 'plushy', 'ice', 'impressionist', 'art_deco', 'stone', 'mosaic_portrait',
  'renaissance', 'victorian', 'wild_west', 'neon', 'oil_impasto', 'balloon_face', 'sheet_music', 'origami', 'linocut',
  'art_nouveau', 'designer_vinyl', 'action_figure', 'elizabethan', 'iron', 'quilted', 'cubism',
]
/* The four newcomers have no plate in /previews/curated, so
   curatedPreviewUrl falls back to the manifest preview for them. */
const NO_CURATED_PLATE = ['mosaic_portrait', 'designer_vinyl', 'action_figure', 'cubism']

function build(selected: string[] = []) {
  // every one of the 25 is a registry effect in some room
  const SILOS = [{ id: 'room', name: 'Room', effects: AUTHORITATIVE.map(id => ({ id, label: id })) }]
  const SELECTED = selected.map(b => ({ key: b, baseId: b }))
  const src = [
    universeSrc, platesSrc, 'var CURATED = { bench: [], page: 0 };',
    "function previewUrlFor(id, subject){ return '/previews/effects/' + id + '/' + ((subject || 'man') === 'woman' ? 'woman' : 'man') + '.jpg'; }",
    fn('curatedEffect'), fn('shuffled'), fn('isChosen'), fn('validBench'), fn('drawBench'), fn('rerollBench'),
    fn('curatedPreviewUrl'), fn('curatedPage'),
    'return { CURATED_UNIVERSE, CURATED, drawBench, rerollBench, validBench, curatedPreviewUrl, curatedPage,',
    '  choose: function(b){ SELECTED.push({ key: b, baseId: b }); }, unchoose: function(){ SELECTED.length = 0; } };',
  ].join('\n')
  return new Function('SILOS', 'SELECTED', src)(SILOS, SELECTED)
}

describe('the Curated universe', () => {
  it('is exactly the authoritative 25, with no Ebony, Fire Face or Mercury', () => {
    const s = build()
    expect(s.CURATED_UNIVERSE.slice().sort()).toEqual(AUTHORITATIVE.slice().sort())
    expect(s.CURATED_UNIVERSE.join(' ')).not.toMatch(/ebony|fire|mercury/)
  })
  it('the previews are the male/female NB2 set by subject, keyed by base id', () => {
    const s = build()
    expect(s.curatedPreviewUrl('plushy', 'woman')).toBe('/previews/curated/plushy/woman.jpg')
    expect(s.curatedPreviewUrl('plushy', 'man')).toBe('/previews/curated/plushy/man.jpg')
    expect(s.curatedPreviewUrl('plushy', undefined)).toBe('/previews/curated/plushy/man.jpg')
  })
  it('every preview file the page can ask for is present', () => {
    const s = build()
    for (const b of AUTHORITATIVE) for (const g of ['man', 'woman']) {
      const url = s.curatedPreviewUrl(b, g)
      expect(url).toBeTruthy()
      expect(() => readFileSync(path.join(process.cwd(), 'public' + url))).not.toThrow()
    }
  })
  it('the four that joined without a Curated plate fall back to the manifest preview', () => {
    const s = build()
    for (const b of NO_CURATED_PLATE) {
      expect(s.curatedPreviewUrl(b, 'woman')).toBe('/previews/effects/' + b + '/woman.jpg')
      expect(s.curatedPreviewUrl(b, 'man')).toBe('/previews/effects/' + b + '/man.jpg')
    }
  })
  it('the six Rich took out of Curated are gone from the bench universe', () => {
    const s = build()
    for (const b of ['crystallized', 'petal_sculpture', 'ebony', 'deco_twenties', 'sand_form', 'porcelain']) {
      expect(s.CURATED_UNIVERSE).not.toContain(b)
    }
  })
  it('the six Rich put into Curated are all there', () => {
    const s = build()
    for (const b of ['mosaic_portrait', 'stained_glass', 'designer_vinyl', 'action_figure', 'cubism', 'sheet_music']) {
      expect(s.CURATED_UNIVERSE).toContain(b)
    }
  })
})

describe('the bench', () => {
  it('draws 16 distinct effects from the 25, page 1 first', () => {
    for (let n = 0; n < 50; n++) {
      const s = build(); s.drawBench()
      expect(s.CURATED.bench).toHaveLength(16)
      expect(new Set(s.CURATED.bench).size).toBe(16)
      expect(s.CURATED.bench.every((id: string) => AUTHORITATIVE.includes(id))).toBe(true)
      expect(s.CURATED.page).toBe(0)
      expect(s.validBench(s.CURATED.bench)).toBe(true)
    }
  })
  it('one page is 8: page 1 is places 1-8, page 2 is places 9-16', () => {
    const s = build(); s.drawBench()
    expect(s.curatedPage()).toEqual(s.CURATED.bench.slice(0, 8))
    s.CURATED.page = 1
    expect(s.curatedPage()).toEqual(s.CURATED.bench.slice(8, 16))
  })
  it('a restored bench is accepted only if it is 16 distinct effects of the 25', () => {
    const s = build(); s.drawBench()
    expect(s.validBench(s.CURATED.bench.slice())).toBe(true)
    expect(s.validBench(s.CURATED.bench.slice(0, 15))).toBe(false)
    expect(s.validBench([...s.CURATED.bench.slice(0, 15), s.CURATED.bench[0]])).toBe(false)
    expect(s.validBench([...s.CURATED.bench.slice(0, 15), 'ebony'])).toBe(false)
    expect(s.validBench(null)).toBe(false)
  })
})

describe('reroll', () => {
  for (const chosenCount of [0, 1, 3, 8, 15]) {
    it(`with ${chosenCount} chosen: the chosen stay put, every open place changes, never to what it held`, () => {
      for (let n = 0; n < 200; n++) {
        const s = build(); s.drawBench()
        const before = s.CURATED.bench.slice()
        const chosenAt = [...Array(16).keys()].sort(() => Math.random() - 0.5).slice(0, chosenCount)
        chosenAt.forEach(i => s.choose(before[i]))
        expect(s.rerollBench()).toBe(true)
        const after = s.CURATED.bench
        expect(after).toHaveLength(16)
        expect(new Set(after).size).toBe(16)
        expect(after.every((id: string) => AUTHORITATIVE.includes(id))).toBe(true)
        for (let i = 0; i < 16; i++) {
          if (chosenAt.includes(i)) expect(after[i]).toBe(before[i])
          else expect(after[i]).not.toBe(before[i])
        }
      }
    })
  }
  it('with all 16 chosen there is nothing to reroll, and nothing moves', () => {
    const s = build(); s.drawBench()
    const before = s.CURATED.bench.slice()
    before.forEach((b: string) => s.choose(b))
    expect(s.rerollBench()).toBe(false)
    expect(s.CURATED.bench).toEqual(before)
  })
  it('an effect rerolled away can come back on a later reroll', () => {
    const s = build(); s.drawBench()
    const first = new Set<string>(s.CURATED.bench)
    let cameBack = false
    for (let n = 0; n < 20 && !cameBack; n++) {
      const was = s.CURATED.bench.slice()
      s.rerollBench()
      const gone = was.filter((id: string) => !s.CURATED.bench.includes(id))
      s.rerollBench()
      if (gone.some((id: string) => s.CURATED.bench.includes(id))) cameBack = true
    }
    expect(first.size).toBe(16)
    expect(cameBack).toBe(true)
  })
  it('the bench does not change on its own -- only drawBench and rerollBench write it', () => {
    const writes = HTML.split('\n').filter(l => /CURATED\.bench\s*=[^=]/.test(l))
    expect(writes.length).toBe(4)   // drawBench, rerollBench, the boot restore, the Review-resume restore
  })
})
