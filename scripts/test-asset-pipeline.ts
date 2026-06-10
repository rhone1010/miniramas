// scripts/test-asset-pipeline.ts
//
// Smoke test for the print asset pipeline.
//
// Run:  npx tsx --env-file=.env.local scripts/test-asset-pipeline.ts <image_source>
//
// <image_source> can be either:
//   - A local file path:   ./public/style_refs/bronze_01.jpg
//   - A URL:               https://example.com/render.jpg
//
// What it does:
//   1. Load the source image into base64
//   2. Run preparePrintAsset() for each of the three sizes (8×10, 12×16, 18×24)
//   3. Print signed URLs + final dimensions
//
// The signed URLs are exactly what Prodigi will fetch when placing a real order.
// After this passes, you can take any one of those signed URLs and feed it into
// the existing scripts/test-prodigi.ts to confirm Prodigi accepts your hosted asset.

import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { preparePrintAsset } from '../lib/v1/print/asset-pipeline'
import type { PrintSize } from '../lib/v1/print/sku-map'

const source = process.argv[2]
if (!source) {
  console.error('Usage: npx tsx --env-file=.env.local scripts/test-asset-pipeline.ts <image_path_or_url>')
  console.error('')
  console.error('Examples:')
  console.error('  npx tsx --env-file=.env.local scripts/test-asset-pipeline.ts ./public/style_refs/bronze_01.jpg')
  console.error('  npx tsx --env-file=.env.local scripts/test-asset-pipeline.ts https://example.com/render.jpg')
  process.exit(1)
}

async function loadAsBase64(src: string): Promise<string> {
  if (src.startsWith('http://') || src.startsWith('https://')) {
    console.log(`  loading from URL: ${src}`)
    const res = await fetch(src)
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${src}`)
    const buf = Buffer.from(await res.arrayBuffer())
    return buf.toString('base64')
  }
  if (!existsSync(src)) {
    throw new Error(`Local file not found: ${src}`)
  }
  console.log(`  loading from disk: ${src}`)
  const buf = await readFile(src)
  return buf.toString('base64')
}

async function main() {
  console.log('━'.repeat(60))
  console.log('Print asset pipeline smoke test')
  console.log('━'.repeat(60))

  console.log('\n[1/2] Loading source image')
  let imageB64: string
  try {
    imageB64 = await loadAsBase64(source)
    const sizeKb = Math.round((imageB64.length * 3 / 4) / 1024)
    console.log(`  ✓ loaded — ${sizeKb} KB base64`)
  } catch (err) {
    console.error('  ✗', err instanceof Error ? err.message : err)
    process.exit(1)
  }

  console.log('\n[2/2] Running pipeline for all three sizes')
  const renderId = `smoke-${Date.now()}`
  const sizes: PrintSize[] = ['8x10', '12x16', '18x24']
  const results: Array<{ size: PrintSize; signedUrl: string; width: number; height: number; upscaled: boolean }> = []

  for (const size of sizes) {
    console.log(`\n  ── ${size} ──`)
    try {
      const r = await preparePrintAsset({
        imageB64,
        renderId,
        size,
        finish: 'unframed',
      })
      console.log(`  ✓ ${size} done`)
      console.log(`     dimensions: ${r.width}×${r.height}`)
      console.log(`     upscaled:   ${r.upscaled ? 'yes' : 'no (source met target)'}`)
      console.log(`     path:       ${r.storagePath}`)
      console.log(`     signed URL: ${r.signedUrl}`)
      results.push({ size, ...r })
    } catch (err) {
      console.error(`  ✗ ${size} failed:`, err instanceof Error ? err.message : err)
      // Continue with other sizes to surface the full picture
    }
  }

  console.log('\n' + '━'.repeat(60))
  if (results.length === sizes.length) {
    console.log(`All ${sizes.length} sizes passed.`)
    console.log('')
    console.log('Next: copy one of the signed URLs above and feed it to the Prodigi test:')
    console.log('  npx tsx --env-file=.env.local scripts/test-prodigi.ts "<signed_url>"')
    console.log('')
    console.log('That confirms end-to-end: render → upscale → Supabase → Prodigi-fetchable.')
  } else {
    console.log(`${results.length}/${sizes.length} sizes passed. See errors above.`)
    process.exit(1)
  }
  console.log('━'.repeat(60))
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
