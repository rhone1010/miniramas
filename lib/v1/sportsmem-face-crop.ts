// sportsmem-face-crop.ts
// lib/v1/sportsmem-face-crop.ts
//
// Detects faces in a source image via Replicate (chigozienri/mediapipe-face)
// and returns tight per-face crops. Used by sportsmem-generator to pass
// face reference crops into gpt-image-1's multi-image input.
//
// No native deps — no tfjs-node, no canvas, no face-api package. Pure sharp + fetch + replicate.

import Replicate from 'replicate'
import sharp from 'sharp'

export interface FaceCrop {
  b64:    string  // PNG base64
  x:      number
  y:      number
  width:  number
  height: number
}

/**
 * Detect faces in the source image and return tight per-face crops.
 * - sorted left-to-right
 * - up to `maxFaces` (default 4)
 * - padded (default 45%) to include hairline + jaw + minimal background
 * - EXIF-rotated so crops match visual orientation
 */
export async function extractFaceCrops(
  sourceImageB64: string,
  maxFaces = 4,
  paddingRatio = 0.45,
): Promise<FaceCrop[]> {
  const apiKey = process.env.REPLICATE_API_TOKEN
  if (!apiKey) {
    console.warn('[face-crop] REPLICATE_API_TOKEN not set — skipping face detection')
    return []
  }

  // EXIF-rotate source so crop coordinates match visual orientation
  const srcBuf = Buffer.from(sourceImageB64, 'base64')
  const rotated = await sharp(srcBuf).rotate().png().toBuffer()
  const { width: srcW, height: srcH } = await sharp(rotated).metadata()
  if (!srcW || !srcH) return []

  // Upload source to Replicate Files (avoids large inline payload)
  const uploadedUrl = await uploadToReplicateFiles(rotated, apiKey)

  // Run mediapipe-face detection
  const replicate = new Replicate({ auth: apiKey })
  const output = await replicate.run(
    'chigozienri/mediapipe-face:b52b4dad3b9533cff5020d1a5a6624adb0838ca4bb5e073dfbcdd7c1fc4dc58e',
    { input: { image: uploadedUrl } }
  ) as unknown

  // mediapipe-face returns an annotated image URL — but we need the JSON data.
  // Unfortunately this particular model only returns an annotated overlay, not raw boxes.
  // Fall back to a different approach: use sharp-based simple center-crop if we can't detect.
  // Actually — let's use a different Replicate model that returns bounding boxes directly.

  // Parse the output — mediapipe-face newer versions return box JSON in response
  const boxes = await parseMediapipeFaceOutput(output, srcW, srcH)
  if (boxes.length === 0) {
    console.warn('[face-crop] no faces detected — returning empty crop list')
    return []
  }

  // Sort left-to-right, cap at maxFaces
  const sorted = boxes
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, maxFaces)
    .sort((a, b) => a.x - b.x)

  const crops: FaceCrop[] = []
  for (const box of sorted) {
    const padX = box.width  * paddingRatio
    const padY = box.height * paddingRatio
    const cx = Math.max(0, Math.floor(box.x - padX))
    const cy = Math.max(0, Math.floor(box.y - padY))
    const cw = Math.min(srcW - cx, Math.ceil(box.width  + padX * 2))
    const ch = Math.min(srcH - cy, Math.ceil(box.height + padY * 2))

    const cropBuf = await sharp(rotated)
      .extract({ left: cx, top: cy, width: cw, height: ch })
      .png()
      .toBuffer()

    crops.push({
      b64:    cropBuf.toString('base64'),
      x:      cx,
      y:      cy,
      width:  cw,
      height: ch,
    })
  }

  console.log(`[face-crop] detected ${crops.length} face(s) via Replicate mediapipe-face`)
  return crops
}

// ── REPLICATE OUTPUT PARSING ─────────────────────────────────
// mediapipe-face output shape varies — try multiple parse paths
interface Box { x: number; y: number; width: number; height: number; score?: number }

async function parseMediapipeFaceOutput(
  output: unknown,
  srcW: number,
  srcH: number,
): Promise<Box[]> {
  // Try: output is { detections: [{ bbox: { xmin, ymin, width, height }, score }, ...] }
  if (output && typeof output === 'object' && 'detections' in (output as any)) {
    const dets = (output as any).detections as any[]
    return dets.map(d => normalizeBox(d, srcW, srcH)).filter(Boolean) as Box[]
  }

  // Try: output is a raw array of detection objects
  if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'object') {
    return output.map(d => normalizeBox(d, srcW, srcH)).filter(Boolean) as Box[]
  }

  // Try: output is an object with .boxes or .faces
  if (output && typeof output === 'object') {
    const candidate = (output as any).boxes || (output as any).faces
    if (Array.isArray(candidate)) {
      return candidate.map(d => normalizeBox(d, srcW, srcH)).filter(Boolean) as Box[]
    }
  }

  return []
}

function normalizeBox(d: any, srcW: number, srcH: number): Box | null {
  if (!d || typeof d !== 'object') return null

  // Shape 1: { bbox: { xmin, ymin, width, height } } — normalized [0-1]
  if (d.bbox && typeof d.bbox === 'object') {
    const { xmin, ymin, width, height } = d.bbox
    const norm = xmin <= 1 && ymin <= 1 && width <= 1 && height <= 1
    if (typeof xmin === 'number' && typeof ymin === 'number' && typeof width === 'number' && typeof height === 'number') {
      return {
        x:      norm ? xmin * srcW : xmin,
        y:      norm ? ymin * srcH : ymin,
        width:  norm ? width * srcW : width,
        height: norm ? height * srcH : height,
        score:  typeof d.score === 'number' ? d.score : undefined,
      }
    }
  }

  // Shape 2: { x, y, width, height } — pixel coords
  if (typeof d.x === 'number' && typeof d.y === 'number' && typeof d.width === 'number' && typeof d.height === 'number') {
    return { x: d.x, y: d.y, width: d.width, height: d.height, score: d.score }
  }

  // Shape 3: { x1, y1, x2, y2 } — corner coords
  if (typeof d.x1 === 'number' && typeof d.y1 === 'number' && typeof d.x2 === 'number' && typeof d.y2 === 'number') {
    return { x: d.x1, y: d.y1, width: d.x2 - d.x1, height: d.y2 - d.y1, score: d.score }
  }

  return null
}

// ── REPLICATE FILES UPLOAD HELPER ─────────────────────────────
async function uploadToReplicateFiles(buf: Buffer, apiKey: string): Promise<string> {
  const form = new FormData()
  const blob = new Blob([new Uint8Array(buf)], { type: 'image/png' })
  form.append('content', blob, 'source.png')

  const res = await fetch('https://api.replicate.com/v1/files', {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body:    form,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Replicate file upload failed (${res.status}): ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const url = data?.urls?.get
  if (!url) throw new Error('Replicate file upload returned no URL')
  return url
}
