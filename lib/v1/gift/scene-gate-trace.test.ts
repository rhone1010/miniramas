// The sale gate is ON by default and asks the scene manifests whether a configuration has an approved photograph, in the add-to-cart and checkout routes. In a serverless bundle only the traced
// files exist there. This test builds a copy holding EXACTLY the traced list for those two routes (no pictures), points the real scene adapter at it, and checks the gate gives the same answer as with
// the full tree: if a needed file were missing, every product would look unavailable and nothing could be sold.

import { describe, it, expect, afterAll } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = process.cwd(), cfg = createRequire(path.join(ROOT, 'package.json'))('./next.config.js')
const ROUTES = ['/api/v1/gift/sessions/*/lines', '/api/v1/gift/sessions/*/checkout']
const expand = (g: string): string[] => { const p = g.replace(/^\.\//, ''); if (!p.includes('*')) return [p]; const [pre, post] = p.split('*'); return fs.readdirSync(path.join(ROOT, pre)).map(d => pre + d + post).filter(f => fs.existsSync(path.join(ROOT, f))) }
const files = [...new Set((cfg.outputFileTracingIncludes[ROUTES[0]] as string[]).flatMap(expand))]
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-trace-'))
afterAll(() => { try { fs.rmdirSync(path.join(tmp, 'node_modules')) } catch { /* no junction */ } fs.rmSync(tmp, { recursive: true, force: true }) })     // the junction is removed as a link first, never recursed into

describe('the add-to-cart and checkout functions carry what the sale gate needs', () => {
  it('both routes list the same files, none missing from disk, and no picture among them', () => {
    expect(cfg.outputFileTracingIncludes[ROUTES[1]]).toEqual(cfg.outputFileTracingIncludes[ROUTES[0]])
    for (const f of files) expect(fs.existsSync(path.join(ROOT, f)), f).toBe(true)
    expect(files.some(f => /\.(png|jpe?g|webp)$/i.test(f))).toBe(false)
    expect(files.length).toBeLessThan(40)
  })
  it('the gate gives exactly the same coverage from a copy of ONLY those files as from the full tree', async () => {
    for (const f of files) { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f)) }
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'), 'junction')                // the bundle's own traced dependencies (sharp), as Next's tracer adds them
    const { launchCoverage } = await import('./presentation'); const { SCENE_FACTS } = await import('./scenes')
    const full = (await import('./mockup-real')).realSceneRenderer
    const fullCov = launchCoverage(id => full.describe(id))
    const prev = process.env.GIFT_MOCKUP_TOOLS_DIR; process.env.GIFT_MOCKUP_TOOLS_DIR = tmp
    try {
      const spec = './mockup-real?bundle'; const mod: any = await import(/* @vite-ignore */ spec); const cut = mod.realSceneRenderer ?? full        // a fresh module instance, so it reads GIFT_MOCKUP_TOOLS_DIR now
      for (const id of Object.keys(SCENE_FACTS)) expect(() => cut.describe(id), id).not.toThrow()
      const cutCov = launchCoverage(id => cut.describe(id))
      expect(cutCov).toEqual(fullCov); expect(cutCov.filter(c => c.scene).length).toBeGreaterThan(10)
    } finally { if (prev === undefined) delete process.env.GIFT_MOCKUP_TOOLS_DIR; else process.env.GIFT_MOCKUP_TOOLS_DIR = prev }
  })
})
