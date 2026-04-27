// face-detect.ts
// lib/v1/face-detect.ts
//
// Face detection using Grounding-DINO on Replicate.
// Open-vocabulary detection — we pass "face" as the text label and get back
// bounding boxes for every face in the image.
//
// Why grounding-dino vs alternatives:
//   - Hosted (no model files to bundle, no tfjs-node dependency)
//   - Fast (~1s per detection)
//   - Cheap (~$0.001 per call)
//   - Already on the user's existing Replicate account
//
// If you ever want to drop the Replicate dependency, swap this module's
// implementation for face-api.js (pure JS, ~5MB models, runs in Node with
// @tensorflow/tfjs-node). Public interface stays identical.

import Replicate from 'replicate'
import sharp     from 'sharp'

export interface FaceBox {
  x:      number   // pixel coords, top-left origin
  y:      number
  width:  number
  height: number
  score:  number   // 0..1 confidence
}

export async function detectFaces(input: {
  imageB64:        string
  replicateApiKey: string
  /** Hint: how many faces to expect. Used to filter low-confidence extras. */
  expectedCount?:  number
  /** Confidence threshold for keeping a detection. Default 0.30. */
  threshold?:      number
}): Promise<FaceBox[]> {
  const { imageB64, replicateApiKey } = input
  const threshold = input.threshold ?? 0.30

  const replicate = new Replicate({ auth: replicateApiKey })

  const buf = Buffer.from(imageB64, 'base64')
  const meta = await sharp(buf).metadata()
  const W = meta.width  || 1024
  const H = meta.height || 1024

  // Replicate accepts data URIs in image fields
  const dataUri = `data:image/jpeg;base64,${imageB64}`

  let output: any
  try {
    output = await replicate.run(
      'adirik/grounding-dino',
      {
        input: {
          image:          dataUri,
          query:          'face . head',  // grounding-dino uses "." as label separator
          box_threshold:  Math.max(0.20, threshold - 0.10),
          text_threshold: 0.20,
        },
      } as any
    )
  } catch (e: any) {
    throw new Error(`face_detect_failed: ${e.message || e}`)
  }

  const detections = parseDetections(output, W, H)

  // Filter to face-like labels and threshold
  const faces = detections
    .filter(d =>
      /face|head/i.test(d.label) &&
      d.score >= threshold
    )
    // Deduplicate near-overlapping boxes (face + head often overlap heavily)
    .reduce<FaceBox[]>((acc, d) => {
      const overlapsExisting = acc.some(a => iou(a, d) > 0.40)
      if (!overlapsExisting) {
        acc.push({ x: d.x, y: d.y, width: d.width, height: d.height, score: d.score })
      } else {
        // If existing box is lower confidence, replace it
        const i = acc.findIndex(a => iou(a, d) > 0.40)
        if (i >= 0 && acc[i].score < d.score) {
          acc[i] = { x: d.x, y: d.y, width: d.width, height: d.height, score: d.score }
        }
      }
      return acc
    }, [])
    // Sort left-to-right
    .sort((a, b) => a.x - b.x)

  // Trim to expected count if specified — keep highest-confidence in case of false positives
  if (input.expectedCount && faces.length > input.expectedCount) {
    return [...faces]
      .sort((a, b) => b.score - a.score)
      .slice(0, input.expectedCount)
      .sort((a, b) => a.x - b.x)
  }

  return faces
}

// ── PARSE GROUNDING-DINO OUTPUT ─────────────────────────────────
// The model returns variable shapes depending on version. Handle defensively.

interface RawDetection {
  x: number; y: number; width: number; height: number
  score: number
  label: string
}

function parseDetections(output: any, W: number, H: number): RawDetection[] {
  if (!output) return []

  // Common shapes:
  //   { detections: [{ bbox: [x1,y1,x2,y2], score, label }] }
  //   { boxes: [...], scores: [...], labels: [...] }
  //   [{ bbox: [...], ...}]
  //   "url-to-json"

  let payload: any = output
  if (typeof output === 'string') {
    // Sometimes returns a JSON string or URL — caller would need to fetch.
    // For our pinned version it's structured; if you see a URL here, swap.
    try { payload = JSON.parse(output) } catch { return [] }
  }
  if (Array.isArray(payload) && payload.length === 0) return []

  // Shape 1: { detections: [...] }
  if (payload.detections && Array.isArray(payload.detections)) {
    return payload.detections.map((d: any) => normalizeBox(d, W, H)).filter(Boolean)
  }
  // Shape 2: parallel arrays
  if (Array.isArray(payload.boxes)) {
    return payload.boxes.map((b: any, i: number) => normalizeBox({
      bbox:  b,
      score: payload.scores?.[i] ?? 0,
      label: payload.labels?.[i] ?? 'face',
    }, W, H)).filter(Boolean)
  }
  // Shape 3: bare array of detections
  if (Array.isArray(payload)) {
    return payload.map((d: any) => normalizeBox(d, W, H)).filter((d): d is RawDetection => d !== null)
  }
  return []
}

function normalizeBox(d: any, W: number, H: number): RawDetection | null {
  const bbox = d.bbox || d.box || d.coordinates
  if (!bbox || !Array.isArray(bbox) || bbox.length < 4) return null

  let [a, b, c, d4] = bbox.map(Number)
  // Detect normalized (0..1) vs absolute coords
  const looksNormalized = Math.max(a, b, c, d4) <= 1.5
  if (looksNormalized) {
    a *= W; b *= H; c *= W; d4 *= H
  }

  // Detect [x1,y1,x2,y2] vs [x,y,w,h]
  // If c/d4 < a/b it's [x,y,w,h]; if greater it's corner-corner
  let x1: number, y1: number, x2: number, y2: number
  if (c > a && d4 > b) {
    x1 = a; y1 = b; x2 = c; y2 = d4
  } else {
    x1 = a; y1 = b; x2 = a + c; y2 = b + d4
  }

  return {
    x:      Math.max(0, Math.round(x1)),
    y:      Math.max(0, Math.round(y1)),
    width:  Math.max(0, Math.round(x2 - x1)),
    height: Math.max(0, Math.round(y2 - y1)),
    score:  Number(d.score ?? d.confidence ?? 0),
    label:  String(d.label ?? d.class ?? 'face'),
  }
}

function iou(a: FaceBox, b: FaceBox): number {
  const x1 = Math.max(a.x, b.x)
  const y1 = Math.max(a.y, b.y)
  const x2 = Math.min(a.x + a.width,  b.x + b.width)
  const y2 = Math.min(a.y + a.height, b.y + b.height)
  if (x2 <= x1 || y2 <= y1) return 0
  const inter = (x2 - x1) * (y2 - y1)
  const union = a.width * a.height + b.width * b.height - inter
  return union > 0 ? inter / union : 0
}
