// lib/store/tests/foyer-male-mapping.test.ts
//
// The foyer's flip -> canonical effect table (public/foyer.html FLIP_EFFECT,
// Rich, 2026-09-14): one explicit mapping, never guessed at run time. A man
// sees public/previews/foyer-flip-male/<effect>.jpg for every frame the
// woman's set shows -- so every flip must resolve, to a distinct effect,
// to a file that is really there.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'fs'
import path from 'path'

const PUB = path.join(process.cwd(), 'public')
const HTML = readFileSync(path.join(PUB, 'foyer.html'), 'utf8')
const DATA = readFileSync(path.join(PUB, 'foyer-DATA.js'), 'utf8')
const MAP: Record<string, string> = Function(`return ${HTML.match(/var FLIP_EFFECT = (\{[\s\S]*?\});/)![1]}`)()
const FLIPS: [string, string][] = Function(`${DATA.replace(/var /g, 'var ')}; return FLIPS`)()
const FAN: string[] = Function(`return ${HTML.match(/var FAN = (\[[^\]]*\]);/)![1]}`)()
const MOSAIC: string[] = Function(`return ${HTML.match(/var MOSAIC_MORE = (\[[^\]]*\]);/)![1]}`)()
const CANON = ['art_deco', 'art_nouveau', 'balloon_face', 'cast_glass', 'crystallized', 'deco_twenties', 'designer_vinyl', 'elizabethan', 'ice', 'impressionist',
  'iron', 'linocut', 'neon', 'oil_impasto', 'origami', 'plushy', 'porcelain', 'quilted', 'reclaimed_bronze', 'renaissance',
  'retro_robot', 'sand_form', 'sheet_music', 'stained_glass', 'stone', 'victorian', 'wild_west']

describe('foyer flip -> canonical effect -> male picture', () => {
  it('every flip resolves, once each, and all 27 canonical effects are covered', () => {
    expect(Object.keys(MAP).sort()).toEqual(FLIPS.map(f => f[0]).sort())
    expect(Object.values(MAP).sort()).toEqual(CANON)
  })
  it('the corrected mappings hold', () => {
    expect(MAP).toMatchObject({ flip_07: 'origami', flip_14: 'crystallized', flip_15: 'balloon_face', flip_18: 'cast_glass', flip_24: 'stained_glass', flip_26: 'victorian' })
  })
  it('every captioned flip agrees with its caption', () => {
    const words: Record<string, RegExp> = { retro_robot: /retro robot/, quilted: /quilted/, plushy: /plushy/, origami: /origami/, neon: /neon/,
      impressionist: /impressionism/i, ice: /ice/, elizabethan: /elizabethan/i, crystallized: /crystallized/, balloon_face: /balloon/,
      art_nouveau: /art nouveau/i, art_deco: /art deco/i, cast_glass: /cast glass/, linocut: /linocut/, stained_glass: /stained glass/, victorian: /victorian/i }
    for (const [id, caption] of FLIPS) if (caption) expect(caption).toMatch(words[MAP[id]])
  })
  it('the male picture for every flip is in public/previews/foyer-flip-male, named by its effect', () => {
    const files = readdirSync(path.join(PUB, 'previews', 'foyer-flip-male')).sort()
    expect(files).toEqual(CANON.map(e => e + '.jpg'))
    for (const id of Object.keys(MAP)) expect(existsSync(path.join(PUB, 'previews', 'foyer-flip-male', MAP[id] + '.jpg'))).toBe(true)
  })
  it('the fan and the phone grid resolve too', () => {
    expect(FAN).toEqual(['flip_23', 'flip_26', 'flip_24', 'flip_13', 'flip_06', 'flip_16'])
    expect(FAN.map(id => MAP[id])).toEqual(['sheet_music', 'victorian', 'stained_glass', 'elizabethan', 'designer_vinyl', 'art_nouveau'])
    expect(MOSAIC.map(id => MAP[id])).toEqual(['art_deco', 'ice'])
  })
})
