// locate.ts
// lib/v1/actionmini-locate.ts
//
// Pixel-color heuristic for locating the brass plaque and inferring the
// diorama center in a generated Action Mini image.
//
// PLAQUE DETECTION:
//   The plaque is brass — warm tan/gold color cluster. The prompt places it
//   in either lower-left or lower-right corner. We scan BOTH lower quadrants
//   for the largest cluster of brass-colored pixels and return the bbox of
//   the stronger cluster.
//
// DIORAMA CENTER:
//   For the brightening pass, we don't need a tight bbox — just a center point
//   for a feathered circle. The diorama is reliably placed around the frame
//   center, biased slightly down (lower-third to lower-half per the prompt).
//   We return a fixed approximation: horizontal center, 55% down from top.
//
// All operations are forgiving — if the scan fails to find a confident plaque
// match, we return null and the downstream composite step skips.

import sharp from 'sharp'

export interface LocatedRegions {
  plaque_bbox:    { x: number; y: number; w: number; h: number } | null
  diorama_center: { cx: number; cy: number; radius: number }
  image_width:    number
  image_height:   number
}

// ── BRASS COLOR RANGE ─────────────────────────────────────────
// Brass is warm tan/gold — R dominant, G moderate, B low.
// Narrow enough to avoid false matches on walnut (browner) or skin (pinker).
function isBrassPixel(r: number, g: number, b: number): boolean {
  if (r < 120 || r > 230) return false
  if (g < 90  || g > 190) return false
  if (b > 140)            return false
  if (r - g < 15)         return false  // must be warmer than neutral
  if (r - b < 40)         return false  // must be notably warmer than blue
  return true
}

// ── FIND THE LARGEST BRASS CLUSTER IN A QUADRANT ──────────────
// Returns bbox of the tightest rectangular region covering most brass pixels
// in the given quadrant, plus a confidence score (total brass pixel count).
function scanQuadrant(
  data: Buffer, w: number, h: number,
  x0: number, y0: number, x1: number, y1: number
): { bbox: { x: number; y: number; w: number; h: number } | null; score: number } {
  let minX = x1, minY = y1, maxX = x0, maxY = y0
  let count = 0

  // Sample every other pixel for speed
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * w + x) * 3  // assumes RGB raw (no alpha)
      const r = data[i], g = data[i + 1], b = data[i + 2]
      if (isBrassPixel(r, g, b)) {
        count++
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (count < 500) return { bbox: null, score: count }  // too few pixels to trust

  const bbw = maxX - minX
  const bbh = maxY - minY
  if (bbw < 50 || bbh < 30) return { bbox: null, score: count }  // too tiny
  if (bbw / bbh < 1.2 || bbw / bbh > 3.5) return { bbox: null, score: count }  // wrong aspect

  return {
    bbox: { x: minX, y: minY, w: bbw, h: bbh },
    score: count,
  }
}

// ── MAIN ──────────────────────────────────────────────────────
export async function locateRegions(imageB64: string): Promise<LocatedRegions> {
  try {
    const buf  = Buffer.from(imageB64, 'base64')
    const meta = await sharp(buf).metadata()
    const w    = meta.width  ?? 1024
    const h    = meta.height ?? 1024

    // Strip alpha, get raw RGB
    const { data } = await sharp(buf)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Scan lower-left and lower-right quadrants — lower half of frame
    // Left quadrant: x 0 → w/2,  y h/2 → h
    // Right quadrant: x w/2 → w, y h/2 → h
    const leftHit  = scanQuadrant(data, w, h, 0,          Math.floor(h * 0.5), Math.floor(w * 0.5), h)
    const rightHit = scanQuadrant(data, w, h, Math.floor(w * 0.5), Math.floor(h * 0.5), w, h)

    let plaque_bbox: LocatedRegions['plaque_bbox'] = null
    if (leftHit.bbox && rightHit.bbox) {
      plaque_bbox = leftHit.score > rightHit.score ? leftHit.bbox : rightHit.bbox
      console.log(`[locate] plaque candidates — L:${leftHit.score} R:${rightHit.score} — picked ${leftHit.score > rightHit.score ? 'LEFT' : 'RIGHT'}`)
    } else if (leftHit.bbox) {
      plaque_bbox = leftHit.bbox
      console.log(`[locate] plaque found LEFT, score ${leftHit.score}`)
    } else if (rightHit.bbox) {
      plaque_bbox = rightHit.bbox
      console.log(`[locate] plaque found RIGHT, score ${rightHit.score}`)
    } else {
      console.log(`[locate] no confident plaque cluster — skipping composite`)
    }

    // Diorama center — fixed approximation based on prompt composition
    // Horizontal center, 55% down (prompt places diorama lower-third to lower-half)
    const cx = Math.round(w * 0.50)
    const cy = Math.round(h * 0.55)
    const radius = Math.round(Math.min(w, h) * 0.22)  // ~22% of short edge

    return {
      plaque_bbox,
      diorama_center: { cx, cy, radius },
      image_width:  w,
      image_height: h,
    }
  } catch (e: any) {
    console.error('[locate] Error:', e.message)
    return {
      plaque_bbox:    null,
      diorama_center: { cx: 512, cy: 563, radius: 225 },
      image_width:    1024,
      image_height:   1024,
    }
  }
}
