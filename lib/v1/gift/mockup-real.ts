// lib/v1/gift/mockup-real.ts
//
// The production wiring of MockupRenderer: a thin wrapper over the EXISTING Node/Sharp visualization adapter
// (tools/product-mockup/gift-visualization-adapter.next.cjs, which calls compositor.next.cjs and frame-finish.next.cjs). No compositor
// logic lives here and none of its calibration is touched: perspective coordinates, masks, frame recoloring, MirrorWrap and cylindrical
// mapping all stay inside the adapter.
//
// WHERE THE RENDERER LIVES. tools/product-mockup/ and public/gift-wizard/ (templates and catalog.next.json) are Codex's files and are
// not part of this branch yet. Until they are committed alongside this one, loadAdapter() fails and the endpoint answers
// 503 mockup_renderer_unavailable (nothing else breaks). GIFT_MOCKUP_TOOLS_DIR may point at a directory that contains tools/ and public/
// for local validation; it is read-only input and is never written.
//
// RUNTIME REQUIREMENT. The adapter reads its template images with fs at request time, so a serverless deployment must include those files
// in the function bundle (Next's outputFileTracingIncludes for tools/product-mockup/** and public/gift-wizard/**). That is a build
// configuration change and is not made here; see the handoff document.

import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { MockupRenderer } from './mockup'
import type { SceneDescription, SceneRenderer } from './scenes'
import { getProductBySku } from '../print/catalog'

interface Adapter {
  composeTemplateVisualTest(i: { templateId: string; artwork: Buffer; artworkId: string; targetGeometry?: { widthIn: number; heightIn: number }; allowCrop?: boolean }): Promise<{
    png: Buffer; metadata: Record<string, any>; visualizationKey: string
  }>
  composeCatalogItem(i: { line: { productId: string; size: string }; artwork: Buffer; artworkId: string; allowCrop?: boolean }): Promise<{
    png: Buffer; metadata: Record<string, any>; visualizationKey: string; identity: { configuration: { sku: string; requiredPx: { w: number; h: number } } }
  }>
}

const root = () => process.env.GIFT_MOCKUP_TOOLS_DIR || process.cwd()
let adapter: Adapter | null = null
function loadAdapter(): Adapter {
  if (adapter) return adapter
  // A run-time require of a file whose path is only known at run time. process.getBuiltinModule keeps this out of the bundler's analysis (webpack
  // warns on a dynamic createRequire and Turbopack would try to resolve it); the files themselves are shipped by outputFileTracingIncludes.
  const { createRequire } = (process as unknown as { getBuiltinModule(id: string): typeof import('node:module') }).getBuiltinModule('node:module')
  const req = createRequire(path.join(root(), 'package.json'))
  adapter = req(path.join(root(), 'tools/product-mockup/gift-visualization-adapter.next.cjs')) as Adapter
  return adapter
}

const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')
const revisions = new Map<string, Promise<string>>()
/** Renderer code + template manifest + every file in the template directory: any change gives a new revision. Computed once per process per template. */
function revisionOf(templateId: string): Promise<string> {
  if (!/^[a-z0-9-]+$/.test(templateId)) return Promise.reject(new Error('bad_template_id'))
  const key = root() + '|' + templateId
  let p = revisions.get(key)
  if (!p) {
    p = (async () => {
      const tools = path.join(root(), 'tools/product-mockup'), dir = path.join(root(), 'public/gift-wizard/mockup-templates', templateId)
      const parts: string[] = []
      for (const f of ['compositor.next.cjs', 'frame-finish.next.cjs', 'gift-visualization-adapter.next.cjs']) parts.push(f + ':' + sha(await fs.readFile(path.join(tools, f))))
      for (const f of (await fs.readdir(dir)).sort()) parts.push(f + ':' + sha(await fs.readFile(path.join(dir, f))))
      // The adapter reads public/gift-wizard/catalog.next.json on EVERY render, so it is part of what the picture depends on, and it must be in the
      // deployed function. Turbopack's trace did not ship it from outputFileTracingIncludes alone (every render then failed with ENOENT on it: the
      // first Preview mockup attempt), so it is read here through a literal path the bundler's own analysis sees. The env override is for local validation.
      const catalog = process.env.GIFT_MOCKUP_TOOLS_DIR
        ? await fs.readFile(path.join(process.env.GIFT_MOCKUP_TOOLS_DIR, 'public', 'gift-wizard', 'catalog.next.json'))
        : await fs.readFile(path.join(process.cwd(), 'public', 'gift-wizard', 'catalog.next.json'))
      parts.push('catalog.next.json:' + sha(catalog))
      return sha(parts.join('|')).slice(0, 32)
    })()
    p.catch(() => revisions.delete(key))
    revisions.set(key, p)
  }
  return p
}

// ── THE PHOTOGRAPHIC CUSTOMER SCENES ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
// tools/product-scenes/adapter.next.cjs (Codex) wraps the same approved clean-replacement compositor. It accepts only an explicit scene id, a product family
// and the in-memory picture, and has no network, storage, payment or approval capability. Which scene may show a purchased configuration, and the picture it is
// given, are decided in scenes.ts; this wrapper only calls it. The scene files are shipped by outputFileTracingIncludes (next.config.js).
interface SceneAdapter {
  describeScene(sceneId: string): SceneDescription
  revision(sceneId: string): string
  renderScene(i: { sceneId: string; productFamily: string; artworkId: string; artwork: Buffer }): Promise<{ png: Buffer; width: number; height: number; templateRevision: string; visualizationKey: string; metadata: Record<string, unknown> }>
}
let sceneAdapter: SceneAdapter | null = null
function loadSceneAdapter(): SceneAdapter {
  if (sceneAdapter) return sceneAdapter
  const { createRequire } = (process as unknown as { getBuiltinModule(id: string): typeof import('node:module') }).getBuiltinModule('node:module')
  sceneAdapter = createRequire(path.join(root(), 'package.json'))(path.join(root(), 'tools/product-scenes/adapter.next.cjs')) as SceneAdapter
  return sceneAdapter
}
const sceneDescriptions = new Map<string, SceneDescription>()
const sceneRevisions = new Map<string, Promise<string>>()
export const realSceneRenderer: SceneRenderer = {
  describe(sceneId) {
    const key = root() + '|' + sceneId
    let d = sceneDescriptions.get(key)
    if (!d) { d = loadSceneAdapter().describeScene(sceneId); sceneDescriptions.set(key, d) }
    return d
  },
  /** Renderer code, the shared compositor, the inventory, the scene manifest and every scene asset (the adapter hashes them all). Once per process per scene; a failure is not cached. */
  revision(sceneId) {
    const key = root() + '|' + sceneId
    let p = sceneRevisions.get(key)
    if (!p) {
      p = (async () => loadSceneAdapter().revision(sceneId))()
      p.catch(() => sceneRevisions.delete(key))
      sceneRevisions.set(key, p)
    }
    return p
  },
  render: i => loadSceneAdapter().renderScene(i),
}


export const realMockupRenderer: MockupRenderer = {
  scenes: realSceneRenderer,
  revision: revisionOf,
  async render(i) {
    const a = loadAdapter()
    // The mug and the card are not in the adapter's catalog snapshot (Codex's catalog.next.json lists no options for them), so they go through its template entry
    // with the geometry the backend knows (card front 5 x 7 in; the mug's wrap geometry is built in by the adapter). The SKU and pixel contract come from OUR catalog.
    if (i.productFamily === 'mug' || i.productFamily === 'card') {
      const p = getProductBySku(i.sku)
      if (!p) throw new Error('unknown_sku')
      const r = await a.composeTemplateVisualTest({ templateId: i.templateId, artwork: i.artwork, artworkId: i.artworkId, ...(i.productFamily === 'card' ? { targetGeometry: { widthIn: 5, heightIn: 7 } } : {}), allowCrop: false })
      const m = r.metadata
      return { png: r.png, width: m.width, height: m.height, visualizationKey: r.visualizationKey, configuration: { sku: p.sku, requiredPx: { ...p.requirements.finalPx } },
        crop: m.fit ? { fit: m.fit, allowCrop: false, surfaceAspectRatio: m.surfaceAspectRatio ?? null, geometryReport: m.geometryReport ?? null } : null }
    }
    // The adapter chooses the template from the family and the (square or rectangular) catalog geometry and reads its SKU, attributes and
    // pixel requirements from its own catalog; mockup.ts compares those with the frozen purchase and refuses a mismatch.
    const r = await a.composeCatalogItem({ line: { productId: i.productFamily, size: i.size }, artwork: i.artwork, artworkId: i.artworkId, allowCrop: false })
    const m = r.metadata
    return {
      png: r.png, width: m.width, height: m.height, visualizationKey: r.visualizationKey,
      configuration: { sku: r.identity.configuration.sku, requiredPx: r.identity.configuration.requiredPx },
      crop: m.fit ? { fit: m.fit, allowCrop: false, surfaceAspectRatio: m.surfaceAspectRatio ?? null, geometryReport: m.geometryReport ?? null } : null,
    }
  },
}
