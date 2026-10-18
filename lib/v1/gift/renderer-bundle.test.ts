// The committed renderer revision against the bridge's tested interface. Keeps four things identical: the files on disk, the manifest
// (with hashes), the serverless tracing list in next.config.js, and what the real adapter actually reads. Runs the REAL compositor on
// small artwork (no network, no model).

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import sharp from 'sharp'
import { allProducts, getProduct } from '../print/catalog'
import { realMockupRenderer } from './mockup-real'
import { templateFor, pictureArea } from './mockup'

const ROOT = process.cwd()
const rel = (p: string) => p.split(path.sep).join('/')
const sha = (p: string) => createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex')
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/product-mockup/renderer-manifest.json'), 'utf8')) as { templates: string[]; files: Array<{ path: string; bytes: number; sha256: string }> }
const walk = (dir: string): string[] => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(dir + '/' + e.name) : [dir + '/' + e.name])
const listed = new Set(manifest.files.map(f => f.path))

describe('the renderer bundle is exactly what the manifest says', () => {
  it('every file matches its recorded size and SHA-256', () => {
    for (const f of manifest.files) { expect(fs.statSync(path.join(ROOT, f.path)).size, f.path).toBe(f.bytes); expect(sha(f.path), f.path).toBe(f.sha256) }
  })
  it('nothing else is in the renderer or template directories: no reports, screenshots, fixtures or mug/card templates', () => {
    // public/gift-wizard also holds the wizard front end now, so only the renderer's own folders are checked: tools/product-mockup and the template directories.
    const onDisk = [...walk('tools/product-mockup'), ...walk('public/gift-wizard/mockup-templates'), 'public/gift-wizard/catalog.next.json'].filter(p => p !== 'tools/product-mockup/renderer-manifest.json')
    expect(onDisk.sort()).toEqual([...listed].sort())
    expect(onDisk.some(p => /ceramic-mug|greeting-card|\.md$|review\/(?!frame-finishes\/references)/.test(p))).toBe(false)
    expect(manifest.files.reduce((n, f) => n + f.bytes, 0)).toBeLessThan(5_000_000)
  })
  it('the serverless tracing list in next.config.js covers exactly these files and only for the mockup route', () => {
    const cfg = createRequire(path.join(ROOT, 'package.json'))('./next.config.js')
    const routes = Object.keys(cfg.outputFileTracingIncludes); expect(routes).toEqual(['/api/v1/gift/sessions/[id]/lines/[lineId]/mockup'])
    const traced = (cfg.outputFileTracingIncludes[routes[0]] as string[]).flatMap(g => {
      const p = g.replace(/^\.\//, '')
      return p.endsWith('/*') ? fs.readdirSync(path.join(ROOT, p.slice(0, -2))).map(f => p.slice(0, -2) + '/' + f) : [p]
    })
    expect(traced.sort()).toEqual([...listed].sort())
  })
})

describe('the renderer revision matches the interface the bridge was tested against', () => {
  const adapter = createRequire(path.join(ROOT, 'package.json'))('./tools/product-mockup/gift-visualization-adapter.next.cjs')
  it('exports the functions the bridge calls and routes the six purchasable templates (plus the two disabled, test-only ones)', () => {
    expect(Object.keys(adapter).sort()).toEqual(['composeCatalogItem', 'composeTemplateVisualTest', 'registry', 'resolveCatalogTemplate'])
    expect(Object.keys(adapter.registry).sort()).toEqual([...manifest.templates, 'ceramic-mug', 'greeting-card'].sort())
    for (const t of ['ceramic-mug', 'greeting-card']) expect(adapter.registry[t].testOnly).toBe(true)
  })
  it("its catalog agrees with the canonical catalog on SKU and lab-file pixels for every purchasable product, so the bridge's per-render check never trips", () => {
    const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/gift-wizard/catalog.next.json'), 'utf8')) as { products: Array<{ id: string; available: boolean; options: Array<{ size: string; sku: string; requiredPx: { w: number; h: number } }> }> }
    const mine = allProducts().filter(p => p.status === 'launch' && templateFor(p))
    expect(mine.length).toBeGreaterThan(20)
    for (const p of mine) {
      const opt = cat.products.find(x => x.id === p.family)?.options.find(o => o.size === p.size)
      expect(opt, p.productId).toBeTruthy(); expect(opt!.sku, p.productId).toBe(p.sku); expect(opt!.requiredPx, p.productId).toEqual(p.requirements.finalPx)
    }
    for (const id of ['mug', 'card']) expect(cat.products.find(x => x.id === id)!.available).toBe(false)
  })
  it('renders every purchasable template through the real compositor via the bridge wrapper: SKU and pixels match the frozen purchase, revisions are stable and distinct', async () => {
    const seen = new Map<string, string>()
    for (const id of ['fine_art:12x18', 'premium:12x18', 'framed:12x18', 'framed:8x8', 'canvas:12x18', 'canvas:8x8']) {
      const p = getProduct(id)!, t = templateFor(p)!, f = p.requirements.finalPx
      const file = await sharp({ create: { width: Math.round(f.w / 6), height: Math.round(f.h / 6), channels: 3, background: '#8a6' } }).png().toBuffer()
      const out = await realMockupRenderer.render({ templateId: t, productFamily: p.family, size: p.size, sku: p.sku, artworkId: 'test-' + id, artwork: await pictureArea(file, p) })
      expect(out.configuration, id).toEqual({ sku: p.sku, requiredPx: f }); expect(out.width).toBeGreaterThan(100); expect((await sharp(out.png).metadata()).format).toBe('png'); expect(out.visualizationKey).toMatch(/^[0-9a-f]{64}$/)
      const rev = await realMockupRenderer.revision(t); expect(await realMockupRenderer.revision(t)).toBe(rev); seen.set(t, rev)
    }
    expect(new Set(seen.values()).size).toBe(seen.size)
  }, 120_000)
  it('refuses a template id that is not a plain name', async () => { await expect(realMockupRenderer.revision('../x')).rejects.toThrow('bad_template_id') })
})

describe('the catalog the adapter reads on every render', () => {
  it('is read through literal paths in mockup-real.ts so the bundler ships it (Turbopack dropped it from the includes alone, which made every Preview render fail with ENOENT)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'lib/v1/gift/mockup-real.ts'), 'utf8')
    expect(src).toContain("path.join(process.cwd(), 'public', 'gift-wizard', 'catalog.next.json')")
    expect(listed.has('public/gift-wizard/catalog.next.json')).toBe(true)
  })
  it('is part of the renderer revision: changing the catalog changes the revision, and the revision is cached per tools directory', async () => {
    const os = await import('node:os'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gift-rev-'))
    try {
      for (const f of manifest.files) { fs.mkdirSync(path.dirname(path.join(tmp, f.path)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f.path), path.join(tmp, f.path)) }
      process.env.GIFT_MOCKUP_TOOLS_DIR = tmp
      const before = await realMockupRenderer.revision('fine-art')
      fs.appendFileSync(path.join(tmp, 'public/gift-wizard/catalog.next.json'), ' ')
      process.env.GIFT_MOCKUP_TOOLS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'gift-rev2-'))
      for (const f of manifest.files) { fs.mkdirSync(path.dirname(path.join(process.env.GIFT_MOCKUP_TOOLS_DIR, f.path)), { recursive: true }); fs.copyFileSync(path.join(tmp, f.path), path.join(process.env.GIFT_MOCKUP_TOOLS_DIR, f.path)) }
      expect(await realMockupRenderer.revision('fine-art')).not.toBe(before)
    } finally { delete process.env.GIFT_MOCKUP_TOOLS_DIR }
  })
})
