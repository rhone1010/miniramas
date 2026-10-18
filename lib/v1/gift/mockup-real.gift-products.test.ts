// The real renderer wrapper for the mug and the card: it must call the adapter's template entry with the geometry the backend knows, and take the SKU and pixel
// contract from OUR catalog (Codex's catalog snapshot lists no options for these two). The adapter here is a stub written to a temporary tools directory.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'

let dir = ''
beforeEach(async () => {
  vi.resetModules()
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockup-tools-'))
  fs.mkdirSync(path.join(dir, 'tools/product-mockup'), { recursive: true })
  for (const f of ['compositor.next.cjs', 'frame-finish.next.cjs']) fs.writeFileSync(path.join(dir, 'tools/product-mockup', f), '// stub')
  fs.writeFileSync(path.join(dir, 'tools/product-mockup/gift-visualization-adapter.next.cjs'), `
    module.exports = {
      calls: [],
      composeTemplateVisualTest: async function (i) { module.exports.calls.push(i); return { png: Buffer.from(${JSON.stringify((await sharp({ create: { width: 8, height: 6, channels: 3, background: '#ccc' } }).png().toBuffer()).toString('base64'))}, 'base64'), metadata: { width: 400, height: 300, fit: 'cover' }, visualizationKey: 'vk-' + i.artworkId } },
      composeCatalogItem: async function () { throw new Error('catalog entry must not be used for the mug or the card') },
    }`)
  for (const t of ['ceramic-mug', 'greeting-card', 'fine-art']) { fs.mkdirSync(path.join(dir, 'public/gift-wizard/mockup-templates', t), { recursive: true }); fs.writeFileSync(path.join(dir, 'public/gift-wizard/mockup-templates', t, 'template.next.json'), '{}') }
  fs.writeFileSync(path.join(dir, 'public/gift-wizard/catalog.next.json'), '{"products":[]}')
  process.env.GIFT_MOCKUP_TOOLS_DIR = dir
})
afterEach(() => { delete process.env.GIFT_MOCKUP_TOOLS_DIR; fs.rmSync(dir, { recursive: true, force: true }) })

describe('realMockupRenderer for the mug and the card', () => {
  it('mug: uses the template entry with no target geometry, and reports our SKU and the 2670 x 1110 contract', async () => {
    const { realMockupRenderer } = await import('./mockup-real'); const adapter = (await import('node:module')).createRequire(path.join(dir, 'package.json'))(path.join(dir, 'tools/product-mockup/gift-visualization-adapter.next.cjs'))
    const out = await realMockupRenderer.render({ templateId: 'ceramic-mug', productFamily: 'mug', size: '11oz', sku: 'GLOBAL-MUG-W', artworkId: 'comp-1', artwork: Buffer.from('x') })
    expect(adapter.calls[0]).toMatchObject({ templateId: 'ceramic-mug', artworkId: 'comp-1', allowCrop: false }); expect(adapter.calls[0].targetGeometry).toBeUndefined()
    expect(out).toMatchObject({ width: 400, height: 300, visualizationKey: 'vk-comp-1', configuration: { sku: 'GLOBAL-MUG-W', requiredPx: { w: 2670, h: 1110 } } })
  })
  it('card: the front is 5 x 7 in, and the contract is the 6118 x 2161 spread of the self-send SKU', async () => {
    const { realMockupRenderer } = await import('./mockup-real'); const adapter = (await import('node:module')).createRequire(path.join(dir, 'package.json'))(path.join(dir, 'tools/product-mockup/gift-visualization-adapter.next.cjs'))
    const out = await realMockupRenderer.render({ templateId: 'greeting-card', productFamily: 'card', size: '7x5', sku: 'GLOBAL-GRE-MOH-7X5-BLA', artworkId: 'comp-2', artwork: Buffer.from('x') })
    expect(adapter.calls[0]).toMatchObject({ templateId: 'greeting-card', targetGeometry: { widthIn: 5, heightIn: 7 }, allowCrop: false })
    expect(out.configuration).toEqual({ sku: 'GLOBAL-GRE-MOH-7X5-BLA', requiredPx: { w: 6118, h: 2161 } })
  })
  it('an unknown SKU is refused rather than rendered', async () => {
    const { realMockupRenderer } = await import('./mockup-real')
    await expect(realMockupRenderer.render({ templateId: 'ceramic-mug', productFamily: 'mug', size: '11oz', sku: 'NOT-A-SKU', artworkId: 'c', artwork: Buffer.from('x') })).rejects.toThrow('unknown_sku')
  })
  it('the revision covers the mug and card template directories, so a revised template re-renders', async () => {
    const { realMockupRenderer } = await import('./mockup-real')
    const a = await realMockupRenderer.revision('ceramic-mug'); fs.writeFileSync(path.join(dir, 'public/gift-wizard/mockup-templates/ceramic-mug/template.next.json'), '{"changed":true}')
    vi.resetModules(); const b = await (await import('./mockup-real')).realMockupRenderer.revision('ceramic-mug'); expect(b).not.toBe(a)
  })
})
