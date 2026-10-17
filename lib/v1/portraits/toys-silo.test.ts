// The Portraits Toys silo: first in order, eight effects, the four newest first; every effect resolves to an existing prompt;
// the browser registry, the server catalog, the preview plates and the Gift Wizard all agree. Nothing here calls a model.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import vm from 'node:vm'
import sharp from 'sharp'
import { SILOS, EFFECTS, isOfferable } from './effect-registry'
import { hasBody, buildEffectPrompt, getBody } from './portraits-bodies'
import { PRESET_LABELS, STYLE_MATERIALS } from './portraits-shared'
import { getPortraitsCatalogMap, getPortraitsSiloBoundaries } from '../../store/discovery-catalog'
import { liveEffectIds, fillEffects } from '../gift/effects'

const NEW = ['marionettes_portrait', 'nesting_dolls_portrait', 'paper_puppets_portrait', 'tin_windup_portrait']       // the four new effects: prompts, labels, plates
const NEW_TOYS = ['marionettes_portrait', 'nesting_dolls_portrait', 'tin_windup_portrait']                          // the three that are in Toys (Paper Puppets lives in Made by Hand)
const MOVED = ['retro_robot', 'action_figure', 'designer_vinyl', 'plushy']
const TOYS = [...NEW_TOYS, ...MOVED]
const LABELS: Record<string, string> = { marionettes_portrait: 'Marionettes', nesting_dolls_portrait: 'Nesting Dolls', paper_puppets_portrait: 'Paper Puppets', tin_windup_portrait: 'Tin Wind-Ups', retro_robot: 'Atomic Age Robot', action_figure: 'Action Figure', designer_vinyl: 'Vinyl Figure', plushy: 'Plushy' }

const browser = () => { const c: any = { window: {} }; vm.runInNewContext(fs.readFileSync('public/effect-registry.js', 'utf8'), c); return c.window.EFFECT_REGISTRY }

describe('registry', () => {
  it('Toys is the first silo and holds exactly the seven approved effects, the newest first', () => {
    expect(SILOS[0]).toMatchObject({ id: 'toys', label: 'Toys' })
    expect(EFFECTS.filter(e => e.category === 'toys').map(e => e.id)).toEqual(TOYS)
    for (const e of EFFECTS.filter(x => x.category === 'toys')) { expect(e.label).toBe(LABELS[e.id]); expect(isOfferable(e)).toBe(true) }
  })
  it('Paper Puppets is in Made by Hand, after that silo\'s existing effects, and in no other silo', () => {
    expect(EFFECTS.filter(e => e.id === 'paper_puppets_portrait').map(e => e.category)).toEqual(['made_by_hand'])
    const mbh = EFFECTS.filter(e => e.category === 'made_by_hand').map(e => e.id); expect(mbh[mbh.length - 1]).toBe('paper_puppets_portrait')
    expect(mbh.slice(0, -1)).toEqual(['chocolate', 'balloon_face', 'quilted', 'origami', 'porcelain', 'beaded'])      // unchanged and in their old order (beaded is the retired row)
  })
  it('the four moved effects are in no other silo, and nothing else changed category', () => {
    for (const id of MOVED) expect(EFFECTS.filter(e => e.id === id).map(e => e.category)).toEqual(['toys'])
    const toysFirstOrder = EFFECTS.map(e => e.id)
    expect(new Set(toysFirstOrder).size).toBe(toysFirstOrder.length)                       // no duplicate effect ids
    expect(EFFECTS.find(e => e.id === 'dragon_skin')!.category).toBe('fantasy_future'); expect(EFFECTS.find(e => e.id === 'chocolate')!.category).toBe('made_by_hand')
  })
  it('every effect category is a known silo', () => { const ids = new Set(SILOS.map(s => s.id)); for (const e of EFFECTS) expect(ids.has(e.category), e.id).toBe(true) })
})

describe('prompts', () => {
  it('every Toys effect resolves to an existing executable prompt, sent verbatim with its avoid line', () => {
    for (const id of TOYS) {
      expect(hasBody(id), id).toBe(true)
      const b = getBody(id); expect(b.body.length, id).toBeGreaterThan(200)
      expect(buildEffectPrompt(id)).toBe(b.avoid ? `${b.body}\n\n${b.avoid}` : b.body)
    }
  })
  it('the new prompts are the supplied ones, unchanged', () => {
    const src = 'E:/Dev/liten-auth-return-preview-20261005/lib/v1/portraits/portraits-bodies.ts'
    if (!fs.existsSync(src)) return                                                         // provenance check only where the supplied source exists
    const text = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n')
    for (const id of NEW) {
      const m = new RegExp('^\\s*' + id + ': \\{\\n([\\s\\S]*?)^\\s*\\},\\n', 'm').exec(text)!
      const body = /^\s*body: `([\s\S]*?)`,\n/m.exec(m[1])![1], avoid = /^\s*avoid: `([\s\S]*?)`,?\n/m.exec(m[1])![1]
      expect(getBody(id).body).toBe(body); expect(getBody(id).avoid).toBe(avoid)
    }
  })
  it('the generate route accepts them: each has a label, and the realistic style list includes them', () => {
    for (const id of NEW) { expect(PRESET_LABELS[id as keyof typeof PRESET_LABELS]).toBe(LABELS[id]); expect(STYLE_MATERIALS.realistic).toContain(id as any) }
  })
  it('the generators still call NB2.1 (the Toys work must not revert the migration)', () => {
    for (const f of ['lib/v1/portraits/portraits-generator.ts', 'lib/v1/groups/groups-generator.ts']) {
      const t = fs.readFileSync(f, 'utf8'); expect(t, f).toContain('google/nano-banana-2.1/predictions'); expect(t, f).not.toMatch(/google\/nano-banana-2\/predictions/)
    }
  })
})

describe('what the browser and the server read', () => {
  it('the emitted browser registry equals the source: same silos, same effects, same order', () => {
    const r = browser()
    expect(r.silos.map((s: any) => s.id)).toEqual(SILOS.map(s => s.id))
    expect(r.effects.map((e: any) => [e.id, e.category, e.label, e.body])).toEqual(EFFECTS.map(e => [e.id, e.category, e.label, e.body]))
    expect(r.offerableTilesBySilo('toys').map((e: any) => e.id)).toEqual(TOYS)
  })
  it('Discovery silo counts update: Toys 7 live (two full rows of four with its header tile), Made by Hand gains Paper Puppets, Fantasy & Future loses what moved', () => {
    const live = (silo: string) => EFFECTS.filter(e => e.category === silo && isOfferable(e)).length
    expect(live('toys')).toBe(7); expect(live('fantasy_future')).toBe(4); expect(live('made_by_hand')).toBe(6)
  })
  it('the server catalog (catalog API, Curator) lists Toys first with the same seven, Paper Puppets in Made by Hand, and the moved effects only once', () => {
    const map = getPortraitsCatalogMap(), silos = getPortraitsSiloBoundaries()
    expect(silos[0]).toMatchObject({ siloId: 'toys', startIndex: 0, endIndex: 6 })
    expect(map.slice(0, 7).map(m => m.effectId)).toEqual(TOYS)
    expect(map.filter(m => m.effectId === 'paper_puppets_portrait').map(m => m.siloId)).toEqual(['made_by_hand'])
    for (const id of MOVED) expect(map.filter(m => m.effectId === id).map(m => m.siloId)).toEqual(['toys'])
    const ids = map.map(m => m.effectId); expect(new Set(ids).size).toBe(ids.length)
  })
  it('the preview manifest maps each new effect to a man and a woman plate, and the plates are on disk at the existing size', async () => {
    const m = JSON.parse(fs.readFileSync('public/previews/effects-manifest.json', 'utf8'))
    for (const id of NEW) {
      expect(m.effects[id], id).toMatchObject({ man: 'man.jpg', woman: 'woman.jpg', all: ['man.jpg', 'woman.jpg', 'man@2x.jpg', 'woman@2x.jpg'] })
      for (const who of ['man', 'woman']) {
        const a = await sharp(`public/previews/effects/${id}/${who}.jpg`).metadata(), b = await sharp(`public/previews/effects/${id}/${who}@2x.jpg`).metadata()
        expect([a.format, a.width, a.height]).toEqual(['jpeg', 322, 400]); expect([b.format, b.width, b.height]).toEqual(['jpeg', 725, 900])
      }
    }
  })
  it('the /portraits workshop accepts and previews them', () => {
    const html = fs.readFileSync('public/portraits.html', 'utf8')
    for (const id of NEW) { expect(html).toContain(`'${id}'`); expect(html).toContain(`"${id}": ["man.jpg", "woman.jpg", ""]`) }
  })
})

describe('Portraits Discovery page', () => {
  const html = fs.readFileSync('public/discovery-consolidated-draft.html', 'utf8')
  it('every silo icon falls back to the real file, so a silo added after the icons were embedded (Toys) never shows a broken image', () => {
    expect(html).toContain('function iconUrl(siloId){ return __REAL_ICONS[siloId] || iconSrc(siloId); }')
    expect(html).not.toContain("__REAL_ICONS[silo.id]||''"); expect(html).not.toContain("__REAL_ICONS[silo.id] || ''")
  })
  it('the Toys icon is the supplied artwork', () => {
    const a = fs.readFileSync('public/icons/discovery-filters/toys.png'), b = fs.readFileSync('public/icons/discovery-filters/fantasy_future.png')
    expect(a.equals(b)).toBe(false); expect(a.length).toBeGreaterThan(60_000)
  })
})

describe('Gift Wizard', () => {
  it('server-side silo order puts Toys first, so the auto-filled slots start with the newest Toys', () => {
    const live = liveEffectIds('portraits')
    expect(live.slice(0, 7)).toEqual(TOYS)
    expect(fillEffects('portraits', [], [])).toEqual(TOYS.slice(0, 6))
    expect(fillEffects('portraits', ['tin_windup_portrait'], [])[0]).toBe('tin_windup_portrait')
  })
})
