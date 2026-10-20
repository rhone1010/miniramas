// Check a scene (e.g. a revised photograph and masks) against the backend BEFORE it is committed, without touching the repository's assets:
//   node --import tsx tools/gift-walk/check-scene.mts <toolsRoot> <sceneId> <artwork.png> [out.png]
// <toolsRoot> is a directory laid out like the repo (tools/product-scenes/adapter.next.cjs, tools/catalog-samples/scene-replacement-review.next.cjs, tools/product-mockup/compositor.next.cjs,
// public/gift-wizard/mockup-scenes/inventory.next.json and public/gift-wizard/mockup-scenes/<sceneId>/ with the revised files and scene.next.json) with a node_modules junction.
// It prints: what the renderer says the opening is, which catalog configurations the backend would route to the scene (and why not for the rest), the scene-compatible picture derived from a
// 1:1 (or any) artwork, a real render, and whether every pixel outside the art mask is identical to the approved photograph.
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'

const [root, sceneId, artworkPath, outPath] = process.argv.slice(2)
if (!root || !sceneId || !artworkPath) { console.error('usage: check-scene.mts <toolsRoot> <sceneId> <artwork.png> [out.png]'); process.exit(2) }
process.env.GIFT_MOCKUP_TOOLS_DIR = root
const { realSceneRenderer } = await import('../../lib/v1/gift/mockup-real.ts')
const { resolveScene, prepareSceneArtwork, SCENE_FACTS } = await import('../../lib/v1/gift/scenes.ts')
const { allProducts } = await import('../../lib/v1/print/catalog.ts')

const d = realSceneRenderer.describe(sceneId)
console.log('opening:', JSON.stringify(d))
const family = SCENE_FACTS[sceneId]?.family
for (const p of allProducts().filter(x => x.family === family)) {
  const r = resolveScene(p, id => { if (id === sceneId) return d; throw new Error('scene not in this root') })
  console.log(p.productId.padEnd(16), r.scene ? `SCENE fit=${r.scene.fit} extension=${r.scene.extension}` : `none: ${r.reason}${(r as any).detail ? ' ' + JSON.stringify((r as any).detail) : ''}`)
}
const art = await sharp(artworkPath).png().toBuffer()
const rep = await prepareSceneArtwork(art, d)
console.log('scene-compatible picture:', JSON.stringify({ fit: rep.fit, source: rep.source, prepared: rep.prepared, addedPx: rep.addedPx }))
const out = await realSceneRenderer.render({ sceneId, productFamily: d.family, artworkId: 'scene-check', artwork: rep.bytes })
const png = outPath ?? path.join(process.cwd(), `scene-check-${sceneId}.png`); fs.writeFileSync(png, out.png); console.log('rendered', `${out.width}x${out.height}`, '->', png)
const dir = path.join(root, 'public/gift-wizard/mockup-scenes', sceneId), m = JSON.parse(fs.readFileSync(path.join(dir, 'scene.next.json'), 'utf8')) as { sourceImage: string; artworkMask: string }
const base = await sharp(path.join(dir, m.sourceImage)).removeAlpha().raw().toBuffer(), mask = await sharp(path.join(dir, m.artworkMask)).flatten({ background: 'black' }).greyscale().raw().toBuffer(), res = await sharp(out.png).removeAlpha().raw().toBuffer()
let outside = 0, bad = 0
for (let i = 0; i < mask.length; i++) if (mask[i] === 0) { outside++; for (let c = 0; c < 3; c++) if (res[i * 3 + c] !== base[i * 3 + c]) { bad++; break } }
console.log(`pixels outside the art mask that differ from the approved photograph: ${bad} of ${outside}`)
