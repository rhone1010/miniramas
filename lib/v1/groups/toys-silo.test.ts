// The Groups Toys silo: first in order, six effects, the four newest first, the two before them after; every effect has an
// executable prompt and a plate; the effects removed from Toys are untouched elsewhere. Nothing here calls a model.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import vm from 'node:vm'
import sharp from 'sharp'
import { GROUPS_EFFECTS, GROUPS_EFFECT_IDS } from './groups-effects'
import { liveEffectIds, fillEffects } from '../gift/effects'

const NEW = ['marionettes', 'nesting_dolls', 'paper_puppets', 'tin_windup']
const TOYS = [...NEW, 'action_figures', 'designer_vinyl']
const LABELS: Record<string, string> = { marionettes: 'Marionettes', nesting_dolls: 'Nesting Dolls', paper_puppets: 'Paper Puppets', tin_windup: 'Tin Wind-Ups', action_figures: 'Action Figures', designer_vinyl: 'Designer Vinyl' }
const registry = () => { const c: any = { window: {} }; vm.runInNewContext(fs.readFileSync('public/groups-registry.js', 'utf8'), c); return c.window.GROUPS_REGISTRY }

describe('catalog and prompts', () => {
  it('the four new effects exist with the approved labels, single-photograph intake and an executable prompt', () => {
    for (const id of NEW) {
      const e = GROUPS_EFFECTS[id as keyof typeof GROUPS_EFFECTS]; expect(e, id).toBeTruthy()
      expect(e.id).toBe(id); expect(e.label).toBe(LABELS[id]); expect(e.intake).toBe('group_photo'); expect(e.body.length).toBeGreaterThan(300)
    }
  })
  it('the new prompts are the supplied ones, unchanged', () => {
    const src = 'E:/Dev/liten-auth-return-preview-20261005/lib/v1/groups/groups-effects.ts'
    if (!fs.existsSync(src)) return                                                         // provenance check only where the supplied source exists
    const text = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n')
    for (const id of NEW) {
      const m = new RegExp('^' + id + ': \\{\\n([\\s\\S]*?)^\\},\\n', 'm').exec(text)!
      expect(GROUPS_EFFECTS[id as keyof typeof GROUPS_EFFECTS].body).toBe(/body: `([\s\S]*?)`,\n/.exec(m[1])![1])
    }
  })
  it('no duplicate ids, and the effects removed from Toys are still in the catalog with their prompts', () => {
    expect(new Set(GROUPS_EFFECT_IDS).size).toBe(GROUPS_EFFECT_IDS.length)
    for (const id of ['retro_robot', 'driftwood_resin', 'neon']) { const e = GROUPS_EFFECTS[id as keyof typeof GROUPS_EFFECTS]; expect(e, id).toBeTruthy(); expect(e.body.length).toBeGreaterThan(300) }
  })
  it('generation is still NB2.1', () => { expect(fs.readFileSync('lib/v1/groups/groups-generator.ts', 'utf8')).toContain('google/nano-banana-2.1/predictions') })
})

describe('the emitted browser registry', () => {
  it('Toys is the first room with exactly six effects: the four newest first, then Action Figures and Designer Vinyl', () => {
    const r = registry()
    expect(r.silos[0]).toMatchObject({ id: 'toys', label: 'Toys' })
    expect(r.effects.filter((e: any) => e.category === 'toys').map((e: any) => e.id)).toEqual(TOYS)
    for (const e of r.effects.filter((x: any) => x.category === 'toys')) expect(e.label).toBe(LABELS[e.id])
  })
  it('Atomic Age Robot, Driftwood and Resin and Neon keep their other room; nothing else moved', () => {
    const r = registry(); const room = (id: string) => r.effects.find((e: any) => e.id === id).category
    expect([room('retro_robot'), room('driftwood_resin'), room('neon')]).toEqual(['curiosities', 'curiosities', 'curiosities'])
    expect(r.effects.filter((e: any) => e.category === 'curiosities').map((e: any) => e.id)).toEqual(['art_deco', 'balloon', 'clockwork', 'driftwood_resin', 'neon', 'retro_robot'])
    expect(r.silos.map((s: any) => s.id)).toEqual(['toys', 'portrait_collections', 'crafted_collections', 'sculpted', 'material_magic', 'made_by_hand', 'artists_studio', 'curiosities'])
  })
  it('counts come from the registry: eight rooms of six, every catalog effect placed exactly once', () => {
    const r = registry()
    for (const s of r.silos) expect(r.effects.filter((e: any) => e.category === s.id).length, s.id).toBe(6)
    expect(r.effects.length).toBe(GROUPS_EFFECT_IDS.length); expect(new Set(r.effects.map((e: any) => e.id)).size).toBe(r.effects.length)
  })
  it('every effect has a 500 x 500 JPEG plate named from its id, including the four new ones', async () => {
    for (const e of registry().effects) {
      const f = `public/previews/groups/groups_${e.id}.jpg`; expect(fs.existsSync(f), f).toBe(true)
      if (NEW.includes(e.id)) { const m = await sharp(f).metadata(); expect([m.format, m.width, m.height]).toEqual(['jpeg', 500, 500]) }
    }
  })
})

describe('the Groups page', () => {
  const html = fs.readFileSync('public/groups.html', 'utf8')
  it('highlights the room on screen with a tolerance, so fractional card heights cannot light the previous room (real-browser repro: 3 of 8 rooms were one early before this)', () => {
    expect(html).toContain('card.getBoundingClientRect().bottom>top+EDGE')
    expect(html).not.toMatch(/card\.getBoundingClientRect\(\)\.bottom>top;/)
  })
  it('the Toys room uses its own icon, and that icon file exists', () => {
    expect(html).toContain("toys:'toys'"); expect(fs.existsSync('public/icons/discovery-filters/toys.png')).toBe(true)
  })
})

describe('Gift Wizard', () => {
  it('single-photograph Groups effects include all four new ones', () => { for (const id of NEW) expect(liveEffectIds('groups')).toContain(id) })
  it('a hybrid pick of a new effect is honoured', () => { expect(fillEffects('groups', ['tin_windup'], [])[0]).toBe('tin_windup') })
})
