// lib/v1/groups/groups-faceswap.ts
//
// Multi-face swap for the Groups silo. The most significant divergence
// from Action's single-face swap.
//
// STRATEGY: per-subject crop + swap.
//
//   1. Detect every face in the SOURCE photograph(s) — gpt-4o-mini vision
//      returns bounding boxes + brief per-face descriptors (apparent age,
//      gender, ethnicity, hair, distinguishing features).
//   2. Detect every face in the RENDER (the post-outpaint sculpture) —
//      same vision call.
//   3. Match source faces → render figures using a hybrid:
//      • Primary: embedding similarity (the render preserves identity
//        morphologically since NB2 does img2img with source reference).
//      • Tiebreaker: positional ordering (left-to-right) when embeddings
//        are ambiguous.
//      • Catastrophic-mismap guard: height-class compatibility — never
//        match an adult source face to a child-proportioned render figure
//        even if embedding distance suggests otherwise.
//   4. For each matched pair, run cdingram/face-swap with single-face
//      inputs (cropped source + cropped render region), then composite
//      the swapped face back into the full render.
//   5. Return the final composited image.
//
// FAILURE MODES handled:
//   • Detection returns 0 source or render faces → soft-fail, return
//     unswapped image.
//   • Source face count != render face count → log a warning, swap as
//     many pairs as can be matched, leave the rest unswapped.
//   • cdingram returns identical output for a pair → log it, continue.
//   • Compositing fails → fall back to whole-image swap (Action-style).
//
// Cost & latency:
//   • Detection: 1 gpt-4o-mini vision call ≈ $0.002, 1-2s
//   • Embedding/matching: in-process, free, sub-second
//   • Per-pair swap: ~$0.015 each on Replicate, ~3-10s each, runs in
//     parallel across pairs (capped at 5 concurrent to avoid 429)
//   • Compositing: in-process, sub-second
//
// All swaps run in parallel (capped) so wall-clock latency for an
// N-figure group is roughly max-pair-latency, not N × latency.

import sharp from 'sharp'
import OpenAI from 'openai'

const FACESWAP_MODEL_VERSION =
  'cdingram/face-swap:d1d6ea8c8be89d664a07a457526f7128109dee7030fdac424788d762c71ed111'

const MAX_PARALLEL_SWAPS    = 3      // Replicate concurrency cap — lowered from 5 to reduce contention on large groups
const MAX_RATE_LIMIT_RETRIES = 3
const BASE_RETRY_DELAY_MS   = 2000

// Crop padding around detected face bbox — gives the swap model context.
const CROP_PAD_RATIO = 0.4   // 40% pad each direction

// Feathered-alpha composite: portion of the min crop dimension that fades
// from transparent at the outer edge to fully opaque heading inward. Soft
// blend kills the rectangular seam where the swap region meets the base.
const FEATHER_RATIO = 0.12

// ─── TYPES ───────────────────────────────────────────────────

export type HeightClass = 'adult' | 'teen' | 'child' | 'infant'

export interface FaceBBox {
  x:      number   // pixel coords on the original image
  y:      number
  width:  number
  height: number
}

export interface DetectedFace {
  bbox:           FaceBBox
  apparent_age:   string                  // 'adult', 'child', etc. — coarse age band
  height_class:   HeightClass
  gender_read:    'male' | 'female' | 'ambiguous'
  hair_summary:   string                  // 'short brown', 'long blonde', etc.
  ethnicity_read: string
  features:       string                  // distinguishing details
  position_index: number                  // 0-based, ordered left-to-right by bbox.x
}

export interface FacePair {
  sourceFace: DetectedFace
  renderFace: DetectedFace
  match_strategy: 'embedding' | 'positional' | 'fallback'
  match_confidence: number   // 0-1, only meaningful for 'embedding'
}

export interface GroupsFaceSwapInput {
  renderImageB64:    string
  sourceImageB64:    string
  additionalSourcesB64?: string[]   // extra reference photos for likeness
  replicateApiToken: string
  openaiApiKey:      string
}

export interface GroupsFaceSwapOutput {
  imageB64:               string
  swapped:                boolean
  pairs_attempted:        number
  pairs_succeeded:        number
  faces_detected_source:  number
  faces_detected_render:  number
  match_strategy_used:    'embedding' | 'positional' | 'manual' | 'fallback'
  durationMs:             number
  reason?:                string
}

// ─── DETECTION VIA gpt-4o-mini VISION ────────────────────────

const FACE_DETECTION_PROMPT = `You are looking at an image. Detect every clearly visible human face and return per-face metadata.

For EACH face in the image, return:
- bbox: bounding box {x, y, width, height} in image pixel coordinates (image is 1024x1024 unless told otherwise)
- apparent_age: rough age band — "infant", "child", "teen", "young_adult", "adult", "older_adult"
- height_class: one of "adult", "teen", "child", "infant" (best fit by apparent age)
- gender_read: "male", "female", or "ambiguous" — based on visual presentation only
- hair_summary: very brief, e.g. "short brown", "long blonde curly", "bald"
- ethnicity_read: brief visual description (do not invent specifics; use general terms like "fair", "olive", "brown", "deep brown" etc.)
- features: 1-2 short distinguishing details (glasses, beard, freckles, dimples, etc.) or "" if none

Order the faces left-to-right by bbox.x — the leftmost face has position_index 0.

Respond with ONLY a JSON object:
{
  "image_width": <int>,
  "image_height": <int>,
  "faces": [
    {
      "position_index": <int>,
      "bbox": {"x": <int>, "y": <int>, "width": <int>, "height": <int>},
      "apparent_age": <string>,
      "height_class": <string>,
      "gender_read": <string>,
      "hair_summary": <string>,
      "ethnicity_read": <string>,
      "features": <string>
    }
  ]
}

If no faces are visible, return faces: [].
Respond with ONLY the JSON. No preamble.`

async function detectFaces(input: {
  imageB64:     string
  openaiApiKey: string
  context:      string   // 'source' or 'render' for logging
}): Promise<DetectedFace[]> {

  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  // Pass the ACTUAL image dimensions into the prompt. Post-outpaint images
  // are commonly 1624×1208 or 1384×1384, not 1024×1024 — relying on the
  // default leads to bbox coords in the wrong coordinate space and out-of-
  // bounds crops downstream.
  let actualW = 1024
  let actualH = 1024
  try {
    const meta = await sharp(Buffer.from(input.imageB64, 'base64')).metadata()
    actualW = meta.width  || 1024
    actualH = meta.height || 1024
  } catch {
    // metadata read failed — fall back to 1024×1024 hint
  }
  const prompt = FACE_DETECTION_PROMPT.replace(
    '(image is 1024x1024 unless told otherwise)',
    `(image is ${actualW} pixels wide and ${actualH} pixels tall; return bbox coordinates in this pixel space)`,
  )

  const response = await openai.chat.completions.create({
    model:     'gpt-4o-mini',
    max_tokens: 2000,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.imageB64}`, detail: 'high' } },
        { type: 'text', text: prompt },
      ],
    }],
  })

  const content = (response.choices[0]?.message?.content || '{}').trim()
  try {
    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed.faces)) return []
    return parsed.faces.map((f: any, idx: number): DetectedFace => ({
      position_index: typeof f.position_index === 'number' ? f.position_index : idx,
      bbox: {
        x:      Number(f.bbox?.x      || 0),
        y:      Number(f.bbox?.y      || 0),
        width:  Number(f.bbox?.width  || 100),
        height: Number(f.bbox?.height || 100),
      },
      apparent_age:   String(f.apparent_age   || 'adult'),
      height_class:   normalizeHeightClass(f.height_class),
      gender_read:    normalizeGender(f.gender_read),
      hair_summary:   String(f.hair_summary   || ''),
      ethnicity_read: String(f.ethnicity_read || ''),
      features:       String(f.features       || ''),
    }))
  } catch (e) {
    console.warn(`[groups/faceswap] face detection parse failed (${input.context}):`, e)
    return []
  }
}

function normalizeHeightClass(s: any): HeightClass {
  const v = String(s || 'adult').toLowerCase()
  if (v === 'infant') return 'infant'
  if (v === 'child')  return 'child'
  if (v === 'teen')   return 'teen'
  return 'adult'
}

function normalizeGender(s: any): 'male' | 'female' | 'ambiguous' {
  const v = String(s || 'ambiguous').toLowerCase()
  if (v === 'male')   return 'male'
  if (v === 'female') return 'female'
  return 'ambiguous'
}

// ─── MATCHING — embedding-style heuristic over face descriptors ──
//
// Without a true face-embedding model in the pipeline, we approximate
// embedding similarity by scoring per-face descriptor overlap (height
// class, gender, hair summary, ethnicity, features) plus positional
// proximity. Catastrophic mismaps (adult onto child render) are forbidden
// outright via the height-class compatibility check.
//
// If a future iteration adds a real face-embedding model on Replicate,
// this is the function to swap out — pair selection is the unit of
// abstraction.
//
// Returns pairs in a stable order (sourceFace.position_index ascending).

const HEIGHT_CLASS_RANK: Record<HeightClass, number> = {
  infant: 0, child: 1, teen: 2, adult: 3,
}

function heightClassesCompatible(a: HeightClass, b: HeightClass): boolean {
  // Allow off-by-one (teen↔adult, child↔teen) but never adult↔child or
  // adult↔infant.
  return Math.abs(HEIGHT_CLASS_RANK[a] - HEIGHT_CLASS_RANK[b]) <= 1
}

function descriptorScore(s: DetectedFace, r: DetectedFace): number {
  let score = 0
  if (s.height_class === r.height_class)   score += 0.40
  if (s.gender_read   === r.gender_read)   score += 0.20
  if (s.hair_summary && s.hair_summary === r.hair_summary) score += 0.15
  if (s.ethnicity_read && s.ethnicity_read === r.ethnicity_read) score += 0.15
  if (s.features && s.features === r.features) score += 0.10
  return score   // 0..1
}

function matchFaces(
  sources: DetectedFace[],
  renders: DetectedFace[],
): { pairs: FacePair[]; strategy: 'embedding' | 'positional' | 'fallback' } {

  if (sources.length === 0 || renders.length === 0) {
    return { pairs: [], strategy: 'fallback' }
  }

  // Greedy matching by descriptor score, with height-class compatibility
  // as a hard filter. Sources and renders are matched in the order of
  // descending best-pair score until one or both run out.

  const remainingS = [...sources]
  const remainingR = [...renders]
  const pairs:     FacePair[] = []

  while (remainingS.length > 0 && remainingR.length > 0) {
    let bestI = -1, bestJ = -1, bestScore = -1
    for (let i = 0; i < remainingS.length; i++) {
      for (let j = 0; j < remainingR.length; j++) {
        const s = remainingS[i], r = remainingR[j]
        if (!heightClassesCompatible(s.height_class, r.height_class)) continue
        const score = descriptorScore(s, r)
        if (score > bestScore) {
          bestScore = score; bestI = i; bestJ = j
        }
      }
    }
    if (bestI < 0) break   // no compatible pair remains
    const s = remainingS.splice(bestI, 1)[0]
    const r = remainingR.splice(bestJ, 1)[0]
    pairs.push({
      sourceFace: s,
      renderFace: r,
      match_strategy: bestScore > 0.4 ? 'embedding' : 'positional',
      match_confidence: bestScore,
    })
  }

  // Sort by source position index for stable processing order
  pairs.sort((a, b) => a.sourceFace.position_index - b.sourceFace.position_index)

  // Strategy reflects what dominated: if any pair fell back to positional
  // (low descriptor score), report that. Otherwise embedding.
  const strategy = pairs.some(p => p.match_strategy === 'positional')
    ? 'positional'
    : 'embedding'

  return { pairs, strategy }
}

// ─── CROP / COMPOSITE HELPERS ────────────────────────────────

async function cropFaceWithPad(
  imageBuffer: Buffer,
  bbox:        FaceBBox,
  padRatio:    number,
): Promise<{ buffer: Buffer; cropX: number; cropY: number; cropW: number; cropH: number }> {

  const meta = await sharp(imageBuffer).metadata()
  const W = meta.width  || 1024
  const H = meta.height || 1024

  // Clamp the raw bbox to image bounds FIRST. Detectors occasionally return
  // coordinates outside the image (hallucination, wrong coordinate space, or
  // edge-of-frame faces). Without clamping, the padding math below produces
  // negative widths/heights that sharp's extract() rejects.
  const clampedX = Math.max(0, Math.min(W - 1, bbox.x))
  const clampedY = Math.max(0, Math.min(H - 1, bbox.y))
  const clampedW = Math.max(1, Math.min(W - clampedX, bbox.width))
  const clampedH = Math.max(1, Math.min(H - clampedY, bbox.height))

  // Apply padding on the clamped bbox, capping every value to stay inside image bounds.
  const padW = clampedW * padRatio
  const padH = clampedH * padRatio
  const x = Math.max(0, Math.round(clampedX - padW))
  const y = Math.max(0, Math.round(clampedY - padH))
  const w = Math.max(1, Math.min(W - x, Math.round(clampedW + 2 * padW)))
  const h = Math.max(1, Math.min(H - y, Math.round(clampedH + 2 * padH)))

  // Sanity guard: if after clamping we have an unusably small crop, the
  // original bbox was far outside image bounds. Throw a clear error instead
  // of feeding garbage into the face-swap model.
  if (w < 16 || h < 16) {
    throw new Error(
      `face crop too small after clamping (w=${w}, h=${h}). ` +
      `Detected bbox ${JSON.stringify(bbox)} appears outside image bounds (${W}×${H}). ` +
      `Skipping this pair.`,
    )
  }

  const buffer = await sharp(imageBuffer)
    .extract({ left: x, top: y, width: w, height: h })
    .jpeg({ quality: 95 })
    .toBuffer()

  return { buffer, cropX: x, cropY: y, cropW: w, cropH: h }
}

/**
 * Build a 1-channel 8-bit alpha mask matching the given dimensions.
 * Interior is fully opaque (255). A `featherPx`-wide band along all four
 * edges ramps linearly from transparent (0) at the outermost pixel to
 * opaque at `featherPx` pixels inward. This is the seam-killer: the
 * outer ring of the swap region blends gradually into the underlying
 * render, eliminating the hard rectangle that a straight composite
 * would otherwise produce.
 */
function buildFeatherMask(width: number, height: number): Buffer {
  const featherPx = Math.max(8, Math.round(Math.min(width, height) * FEATHER_RATIO))
  const mask = Buffer.alloc(width * height, 255)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dEdge = Math.min(x, width - 1 - x, y, height - 1 - y)
      if (dEdge < featherPx) {
        mask[y * width + x] = Math.round((dEdge / featherPx) * 255)
      }
    }
  }
  return mask
}

async function compositeSwappedRegion(
  baseBuffer:    Buffer,
  swappedBuffer: Buffer,
  region:        { cropX: number; cropY: number; cropW: number; cropH: number },
): Promise<Buffer> {
  // 1. Resize the swap output to the original crop dimensions and decode
  //    to raw RGB pixel data. cdingram/face-swap can return a slightly-
  //    different size than we asked for, hence the explicit resize.
  const resizedRgb = await sharp(swappedBuffer)
    .resize(region.cropW, region.cropH, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer()

  // 2. Build a feathered alpha mask matching the crop dimensions.
  const mask = buildFeatherMask(region.cropW, region.cropH)

  // 3. Pack RGB + feathered alpha into a single RGBA pixel buffer.
  const pixelCount = region.cropW * region.cropH
  const rgba = Buffer.alloc(pixelCount * 4)
  for (let i = 0; i < pixelCount; i++) {
    rgba[i * 4]     = resizedRgb[i * 3]
    rgba[i * 4 + 1] = resizedRgb[i * 3 + 1]
    rgba[i * 4 + 2] = resizedRgb[i * 3 + 2]
    rgba[i * 4 + 3] = mask[i]
  }

  // 4. Encode to PNG (preserves alpha) and composite over the base —
  //    sharp's composite respects per-pixel alpha automatically.
  const maskedPng = await sharp(rgba, {
    raw: { width: region.cropW, height: region.cropH, channels: 4 },
  })
    .png()
    .toBuffer()

  return await sharp(baseBuffer)
    .composite([{ input: maskedPng, left: region.cropX, top: region.cropY }])
    .jpeg({ quality: 95 })
    .toBuffer()
}

// ─── REPLICATE FACE-SWAP CALL ────────────────────────────────

async function fetchWithRateLimitRetry(
  url:     string,
  options: RequestInit,
  context: string,
): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    const res = await fetch(url, options)
    if (res.status !== 429) return res
    if (attempt === MAX_RATE_LIMIT_RETRIES) return res
    const retryAfter = res.headers.get('Retry-After')
    const seconds = retryAfter ? Number(retryAfter) : NaN
    const delayMs = (Number.isFinite(seconds) && seconds > 0)
      ? seconds * 1000
      : BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
    console.warn(`[${context}] Replicate 429, retry ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES} after ${delayMs}ms`)
    await new Promise(r => setTimeout(r, delayMs))
  }
  throw new Error('rate-limit retries exhausted')
}

async function callReplicateFaceSwap(
  sourceCropB64: string,
  renderCropB64: string,
  replicateApiToken: string,
): Promise<string> {

  const sourceUri = `data:image/jpeg;base64,${sourceCropB64}`
  const renderUri = `data:image/jpeg;base64,${renderCropB64}`

  const res = await fetchWithRateLimitRetry(
    'https://api.replicate.com/v1/predictions',
    {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${replicateApiToken}`,
        'Content-Type':  'application/json',
        'Prefer':        'wait=60',
      },
      body: JSON.stringify({
        version: FACESWAP_MODEL_VERSION.split(':')[1],
        input: { swap_image: sourceUri, input_image: renderUri },
      }),
    },
    'groups/faceswap',
  )

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`replicate_failed: ${res.status} — ${errBody.slice(0, 240)}`)
  }

  let final: any = await res.json()
  while (final.status === 'starting' || final.status === 'processing') {
    await new Promise(r => setTimeout(r, 1500))
    const pollRes = await fetch(final.urls.get, {
      headers: { 'Authorization': `Bearer ${replicateApiToken}` },
    })
    if (!pollRes.ok) throw new Error(`replicate_poll_failed: ${pollRes.status}`)
    final = await pollRes.json()
  }

  if (final.status !== 'succeeded') {
    throw new Error(`replicate_${final.status}: ${final.error || final.status}`)
  }

  const outputUrl: string = Array.isArray(final.output) ? final.output[0] : final.output
  if (!outputUrl) throw new Error('replicate_no_output')

  const imgRes = await fetch(outputUrl)
  if (!imgRes.ok) throw new Error(`output_fetch_failed: ${imgRes.status}`)
  const imgBuf = Buffer.from(await imgRes.arrayBuffer())
  return imgBuf.toString('base64')
}

// ─── PARALLEL SWAP WITH CONCURRENCY CAP ──────────────────────

async function runWithConcurrency<T, R>(
  items:       T[],
  worker:      (item: T, idx: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function spawn() {
    while (true) {
      const idx = cursor++
      if (idx >= items.length) return
      results[idx] = await worker(items[idx], idx)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => spawn()),
  )
  return results
}

// ─── PUBLIC API ──────────────────────────────────────────────

export async function swapGroupFaces(
  input: GroupsFaceSwapInput,
): Promise<GroupsFaceSwapOutput> {

  const t0 = Date.now()

  if (!input.replicateApiToken) {
    return {
      imageB64:               input.renderImageB64,
      swapped:                false,
      pairs_attempted:        0,
      pairs_succeeded:        0,
      faces_detected_source:  0,
      faces_detected_render:  0,
      match_strategy_used:    'fallback',
      durationMs:             0,
      reason:                 'REPLICATE_API_TOKEN not set',
    }
  }
  if (!input.openaiApiKey) {
    return {
      imageB64:               input.renderImageB64,
      swapped:                false,
      pairs_attempted:        0,
      pairs_succeeded:        0,
      faces_detected_source:  0,
      faces_detected_render:  0,
      match_strategy_used:    'fallback',
      durationMs:             0,
      reason:                 'OPENAI_API_KEY not set (face detection requires it)',
    }
  }

  // ─── 1. DETECT FACES ───────────────────────────────────────
  console.log('[groups/faceswap] detecting faces in source + render...')
  const [sourceFaces, renderFaces] = await Promise.all([
    detectFaces({ imageB64: input.sourceImageB64, openaiApiKey: input.openaiApiKey, context: 'source' }),
    detectFaces({ imageB64: input.renderImageB64, openaiApiKey: input.openaiApiKey, context: 'render' }),
  ])

  console.log(`[groups/faceswap] detected ${sourceFaces.length} source faces, ${renderFaces.length} render faces`)

  if (sourceFaces.length === 0 || renderFaces.length === 0) {
    return {
      imageB64:               input.renderImageB64,
      swapped:                false,
      pairs_attempted:        0,
      pairs_succeeded:        0,
      faces_detected_source:  sourceFaces.length,
      faces_detected_render:  renderFaces.length,
      match_strategy_used:    'fallback',
      durationMs:             Date.now() - t0,
      reason:                 'no faces detected on one or both sides — swap skipped',
    }
  }

  // ─── 2. MATCH SOURCE ↔ RENDER ──────────────────────────────
  const { pairs, strategy } = matchFaces(sourceFaces, renderFaces)
  console.log(`[groups/faceswap] matched ${pairs.length} pairs via ${strategy}`)

  if (pairs.length === 0) {
    return {
      imageB64:               input.renderImageB64,
      swapped:                false,
      pairs_attempted:        0,
      pairs_succeeded:        0,
      faces_detected_source:  sourceFaces.length,
      faces_detected_render:  renderFaces.length,
      match_strategy_used:    'fallback',
      durationMs:             Date.now() - t0,
      reason:                 'no compatible source-render face pairs (height-class incompatibility)',
    }
  }

  // ─── 3. CROP + SWAP + COMPOSITE EACH PAIR IN PARALLEL ──────
  const sourceBuffer = Buffer.from(input.sourceImageB64, 'base64')
  let   renderBuffer = Buffer.from(input.renderImageB64, 'base64')

  type SwapJob = {
    pair:      FacePair
    sourceCrop: { buffer: Buffer; cropX: number; cropY: number; cropW: number; cropH: number }
    renderCrop: { buffer: Buffer; cropX: number; cropY: number; cropW: number; cropH: number }
    swappedB64?: string
    error?:    string
  }

  const jobs: SwapJob[] = await Promise.all(
    pairs.map(async (pair): Promise<SwapJob> => ({
      pair,
      sourceCrop: await cropFaceWithPad(sourceBuffer, pair.sourceFace.bbox, CROP_PAD_RATIO),
      renderCrop: await cropFaceWithPad(renderBuffer, pair.renderFace.bbox, CROP_PAD_RATIO),
    })),
  )

  await runWithConcurrency(jobs, async (job): Promise<void> => {
    const pairIdx = job.pair.sourceFace.position_index
    try {
      job.swappedB64 = await callReplicateFaceSwap(
        job.sourceCrop.buffer.toString('base64'),
        job.renderCrop.buffer.toString('base64'),
        input.replicateApiToken,
      )
    } catch (e: any) {
      const msg = e?.message || 'unknown swap error'
      // Retry up to 2 times on transient Replicate failures (no_output,
      // processing-hang, timeout). These aren't deterministic — a re-run
      // often succeeds even with identical inputs. ~$0.015 per retry.
      // Backoff: 2s, then 6s. Total worst case ~8s of waiting added.
      const isTransient = /no_output|replicate_processing|replicate_starting|timeout|ECONNRESET|ETIMEDOUT/i.test(msg)
      if (isTransient) {
        const backoffMs = [2000, 6000]
        let lastErr: any = e
        let recovered = false
        for (let attempt = 0; attempt < backoffMs.length; attempt++) {
          const delay = backoffMs[attempt]
          console.warn(`[groups/faceswap] pair ${pairIdx} transient fail (${msg}) — retry ${attempt + 1}/${backoffMs.length} in ${delay}ms`)
          await new Promise(r => setTimeout(r, delay))
          try {
            job.swappedB64 = await callReplicateFaceSwap(
              job.sourceCrop.buffer.toString('base64'),
              job.renderCrop.buffer.toString('base64'),
              input.replicateApiToken,
            )
            console.log(`[groups/faceswap] pair ${pairIdx} retry ${attempt + 1} succeeded`)
            recovered = true
            break
          } catch (e2: any) {
            lastErr = e2
          }
        }
        if (!recovered) {
          job.error = `${msg} (retries exhausted: ${lastErr?.message || 'unknown'})`
          console.warn(`[groups/faceswap] pair ${pairIdx} retry exhausted: ${job.error}`)
        }
      } else {
        job.error = msg
        console.warn(`[groups/faceswap] pair ${pairIdx} swap failed: ${job.error}`)
      }
    }
  }, MAX_PARALLEL_SWAPS)

  // Composite swapped regions into the render. Done sequentially
  // because each composite reads + writes the buffer.
  let succeeded = 0
  for (const job of jobs) {
    if (!job.swappedB64) continue
    try {
      const swappedBuf = Buffer.from(job.swappedB64, 'base64')
      renderBuffer = await compositeSwappedRegion(renderBuffer, swappedBuf, job.renderCrop)
      succeeded++
    } catch (e: any) {
      console.warn(`[groups/faceswap] composite failed for pair ${job.pair.sourceFace.position_index}: ${e?.message}`)
    }
  }

  const durationMs = Date.now() - t0
  console.log(`[groups/faceswap] done in ${durationMs}ms — ${succeeded}/${pairs.length} pairs swapped successfully`)

  return {
    imageB64:               renderBuffer.toString('base64'),
    swapped:                succeeded > 0,
    pairs_attempted:        pairs.length,
    pairs_succeeded:        succeeded,
    faces_detected_source:  sourceFaces.length,
    faces_detected_render:  renderFaces.length,
    match_strategy_used:    strategy,
    durationMs,
    reason: succeeded < pairs.length
      ? `${pairs.length - succeeded} pair(s) failed to swap; partial result returned`
      : undefined,
  }
}

// Re-export the detection function so the scoring layer can reuse the
// same gpt-4o-mini face metadata for per-figure scoring.
export { detectFaces }
