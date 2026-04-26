// face-blend.ts
// lib/v1/face-blend.ts
//
// Composites a refined face back into the group image at the matched
// bounding box. Uses sharp for everything — no opencv, no native deps
// beyond what's already in the project.
//
// Pipeline per face:
//   1. Find the face within the refined hero portrait (face fills ~50-65%
//      of that frame, so we use face-detect on the refined output too)
//   2. Extract a tight face crop with margin from the refined output
//   3. Resize to match the target bbox in the group image (slightly oversized
//      for blend margin)
//   4. LAB-space mean color match — shift the refined face's L*a*b* mean
//      to match the target region's mean. Prevents lighting / skin-tone
//      mismatch between hero portrait lighting and group lighting.
//   5. Apply feathered elliptical alpha mask (gaussian falloff at edges)
//   6. Composite over the group image
//
// The blend margin is critical: too tight and you see a seam at the jawline,
// too loose and you blend in shoulders/hair from the wrong context.
// 12-15% margin around the face bbox works well empirically.

import sharp     from 'sharp'
import { FaceBox } from './face-detect'

export interface BlendOneFaceInput {
  groupImageB64:    string   // current group image (full)
  refinedFaceB64:   string   // hero portrait output for this person
  targetBox:        FaceBox  // where the face is in the group image
  refinedFaceBox:   FaceBox  // where the face is in the refined hero output
}

export interface BlendOneFaceResult {
  imageB64: string
}

export async function blendFace(input: BlendOneFaceInput): Promise<BlendOneFaceResult> {
  const groupBuf   = Buffer.from(input.groupImageB64,  'base64')
  const refinedBuf = Buffer.from(input.refinedFaceB64, 'base64')

  const groupMeta = await sharp(groupBuf).metadata()
  const GW = groupMeta.width  || 1024
  const GH = groupMeta.height || 1024

  // ── 1. EXPAND TARGET BBOX FOR BLEND MARGIN ─────────────────
  // 14% margin on all sides — gives feather room without bleeding into
  // hair/shoulders meaningfully.
  const margin = 0.14
  const target = expandBox(input.targetBox, margin, GW, GH)

  // ── 2. EXPAND REFINED BBOX SIMILARLY, EXTRACT THE FACE PATCH ──
  const refinedMeta = await sharp(refinedBuf).metadata()
  const RW = refinedMeta.width  || 1024
  const RH = refinedMeta.height || 1024
  const refinedTarget = expandBox(input.refinedFaceBox, margin, RW, RH)

  // Extract face from refined hero output
  const faceCropBuf = await sharp(refinedBuf)
    .extract({
      left:   refinedTarget.x,
      top:    refinedTarget.y,
      width:  refinedTarget.width,
      height: refinedTarget.height,
    })
    .png()
    .toBuffer()

  // Resize to target dimensions
  const resizedFaceBuf = await sharp(faceCropBuf)
    .resize(target.width, target.height, { fit: 'fill' })
    .png()
    .toBuffer()

  // ── 3. LAB COLOR MATCH ─────────────────────────────────────
  // Extract the matching region from the group image as the color reference
  const targetRegionBuf = await sharp(groupBuf)
    .extract({
      left:   target.x,
      top:    target.y,
      width:  target.width,
      height: target.height,
    })
    .png()
    .toBuffer()

  const matchedFaceBuf = await labMeanMatch(resizedFaceBuf, targetRegionBuf)

  // ── 4. FEATHERED ELLIPTICAL ALPHA MASK ─────────────────────
  const maskBuf = await buildFeatherMask(target.width, target.height)

  // Apply mask as alpha to matched face
  const faceWithAlpha = await sharp(matchedFaceBuf)
    .ensureAlpha()
    .joinChannel(maskBuf)  // replace alpha channel with our feather mask
    .png()
    .toBuffer()

  // ── 5. COMPOSITE OVER GROUP IMAGE ──────────────────────────
  const composed = await sharp(groupBuf)
    .composite([{
      input: faceWithAlpha,
      top:   target.y,
      left:  target.x,
    }])
    .jpeg({ quality: 95 })
    .toBuffer()

  return { imageB64: composed.toString('base64') }
}

// ── HELPERS ────────────────────────────────────────────────────

function expandBox(b: FaceBox, marginFrac: number, maxW: number, maxH: number): FaceBox {
  const dx = Math.round(b.width  * marginFrac)
  const dy = Math.round(b.height * marginFrac)
  const x  = Math.max(0, b.x - dx)
  const y  = Math.max(0, b.y - dy)
  const x2 = Math.min(maxW, b.x + b.width  + dx)
  const y2 = Math.min(maxH, b.y + b.height + dy)
  return {
    x, y,
    width:  x2 - x,
    height: y2 - y,
    score:  b.score,
  }
}

/**
 * Build a feathered elliptical alpha mask: full opacity in the center,
 * smoothly falling off to zero at the edges. The falloff happens in the
 * outer ~30% of the radius — center is solid, edges feather out.
 *
 * Implementation: generate a raw 8-bit single-channel buffer with the
 * elliptical gaussian falloff baked in.
 */
async function buildFeatherMask(width: number, height: number): Promise<Buffer> {
  const cx = (width  - 1) / 2
  const cy = (height - 1) / 2
  const rx = width  / 2
  const ry = height / 2

  // Inner solid radius (relative to outer): 0.65 → solid out to 65% of radius
  const solidEdge = 0.65
  const featherEdge = 1.00

  const raw = Buffer.alloc(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      const r  = Math.sqrt(dx * dx + dy * dy)  // 0..~1.4
      let alpha: number
      if (r <= solidEdge) {
        alpha = 1
      } else if (r >= featherEdge) {
        alpha = 0
      } else {
        // Smooth cosine falloff between solidEdge and featherEdge
        const t = (r - solidEdge) / (featherEdge - solidEdge)
        alpha = 0.5 * (1 + Math.cos(Math.PI * t))
      }
      raw[y * width + x] = Math.round(alpha * 255)
    }
  }

  return await sharp(raw, {
    raw: { width, height, channels: 1 },
  }).png().toBuffer()
}

/**
 * LAB-space mean color matching. Shifts the source image's L*a*b* mean
 * to match the reference image's mean. This is a fast, robust way to
 * unify lighting and color between two image patches without doing a
 * full histogram match.
 *
 * Implementation note: we approximate LAB matching using sharp's linear()
 * channel ops in RGB space after converting to/from. Sharp doesn't have
 * native LAB, so we do this in linear RGB which is a reasonable proxy
 * for our use case (similar mid-range colors, just lighting/exposure
 * shift between hero portrait and group image).
 */
async function labMeanMatch(sourceBuf: Buffer, referenceBuf: Buffer): Promise<Buffer> {
  const srcStats = await sharp(sourceBuf).stats()
  const refStats = await sharp(referenceBuf).stats()

  // Per-channel mean shift in RGB (approximation of LAB L-channel adjust
  // plus a/b channel adjust combined). Works well for skin tones and
  // lighting differences.
  const rShift = (refStats.channels[0].mean - srcStats.channels[0].mean) / 255
  const gShift = (refStats.channels[1].mean - srcStats.channels[1].mean) / 255
  const bShift = (refStats.channels[2].mean - srcStats.channels[2].mean) / 255

  // Apply shift via linear() — multiplier 1.0, offset = shift * 255
  // This adds the shift to each channel (clamped automatically by sharp).
  return await sharp(sourceBuf)
    .linear(
      [1.0, 1.0, 1.0],
      [rShift * 255, gShift * 255, bShift * 255]
    )
    .png()
    .toBuffer()
}
