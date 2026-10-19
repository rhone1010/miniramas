// lib/v1/print/product-layout.ts
//
// BUILDS THE LAB FILE (and the customer's view of it) for the mug and the card from the ONE picture the customer reviewed. The same functions make the
// print file at scale 1 (profiles.ts) and the mockup input at a smaller scale (gift/mockup.ts), so what is shown is what is printed. The geometry is in
// production-profiles.ts. Nothing here crops or distorts a picture: a picture whose shape is not the panel's shape is refused, never squeezed.

import sharp from 'sharp'
import { CARD, MUG, cardLayout, mugPanelRects, type Rect } from './production-profiles'

/** A picture may differ from its panel's proportions by this much (rounding of a composed file), never more. */
export const SHAPE_TOLERANCE = 0.003

function assertShape(w: number, h: number, rect: { w: number; h: number }, code: string): void {
  if (!(w > 0 && h > 0) || Math.abs(w / h / (rect.w / rect.h) - 1) > SHAPE_TOLERANCE) throw new Error(code)
}
async function sized(picture: Buffer, rect: Rect, code: string): Promise<Buffer> {
  const m = await sharp(picture).metadata()
  assertShape(m.width ?? 0, m.height ?? 0, rect, code)
  return sharp(picture).resize(rect.w, rect.h, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer()
}

/**
 * The full mug wrap. The picture sits, whole, on BOTH faces. Everything else is a soft wash made from the picture itself, mirrored so the two ends of the
 * file (which meet at the handle) have the same colour and the seam cannot show. `scale` 1 is the 2670 x 1110 lab file; 0.5 is the mockup size.
 */
export async function buildMugWrap(picture: Buffer, scale = 1): Promise<Buffer> {
  const W = Math.round(MUG.wrap.w * scale), H = Math.round(MUG.wrap.h * scale), half = Math.round(MUG.wrap.w / 2 * scale)
  const rects = mugPanelRects(scale)
  const panels = await Promise.all(rects.map(r => sized(picture, r, 'mug_picture_shape_mismatch')))
  const left = await sharp(picture).resize(half, H, { fit: 'cover' }).png().toBuffer()
  const right = await sharp(picture).flop().resize(W - half, H, { fit: 'cover' }).png().toBuffer()
  const wash = await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
    .composite([{ input: left, left: 0, top: 0 }, { input: right, left: half, top: 0 }]).png().toBuffer()
  const soft = await sharp(wash).blur(Math.max(1, 45 * scale)).png().toBuffer()
  // Outside-only feather: the complete 910px picture panel is unchanged. Geometry and safety offsets are unchanged.
  const halo = Math.max(1, Math.min(...rects.map(r => r.y)))
  const blends = await Promise.all(panels.map(async (panel, i) => {
    const r = rects[i]
    const raw = await sharp(panel).extend({ left: halo, right: halo, top: halo, bottom: halo, extendWith: 'copy' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (let y = 0; y < raw.info.height; y++) for (let x = 0; x < raw.info.width; x++) {
      const distance = Math.max(halo - x, halo - y, x - (halo + r.w - 1), y - (halo + r.h - 1), 0)
      raw.data[(y * raw.info.width + x) * 4 + 3] = Math.round(255 * (1 + Math.cos(Math.PI * Math.min(1, distance / halo))) / 2)
    }
    return { input: await sharp(raw.data, { raw: raw.info }).png().toBuffer(), left: r.x - halo, top: r.y - halo }
  }))
  return sharp(soft).composite(blends).png().toBuffer()

}

/**
 * The full card spread: white paper everywhere except the front panel, which carries the picture whole at 5:7 and, outside the trim on the right, top and
 * bottom, a mirror of the picture's own edge as bleed. `scale` 1 is the 6118 x 2161 lab file.
 */
export async function buildCardSpread(picture: Buffer, scale = 1): Promise<Buffer> {
  const W = Math.round(CARD.spread.w * scale), H = Math.round(CARD.spread.h * scale)
  const L = cardLayout(scale), r = (v: number) => Math.round(v * scale)
  const front = await sized(picture, L.front, 'card_picture_shape_mismatch')
  const withBleed = await sharp(front).extend({ top: r(CARD.bleed.top), bottom: H - L.front.h - r(CARD.bleed.top), right: r(CARD.bleed.right), left: 0, extendWith: 'mirror' }).png().toBuffer()
  return sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite([{ input: withBleed, left: L.front.x, top: 0 }]).png().toBuffer()
}

/** The part of a finished file that is the PICTURE, for inspection (QA compares only this). */
export async function mugQaRegion(final: Buffer): Promise<Buffer> {
  const r = mugPanelRects(1)[1]                                   // the face a right-handed mug shows; the other face is the same picture
  return sharp(final).extract({ left: r.x, top: r.y, width: r.w, height: r.h }).jpeg({ quality: 95 }).toBuffer()
}
export async function cardQaRegion(final: Buffer): Promise<Buffer> {
  const f = cardLayout(1).front
  return sharp(final).extract({ left: f.x, top: f.y, width: f.w, height: f.h }).jpeg({ quality: 95 }).toBuffer()
}

/**
 * What the mockup renderer is given for these products, built from the reviewed picture: the mug's full wrap (the renderer maps it onto a cylinder) and the
 * card's front picture at exactly 5:7 (the renderer places it on the card). Half size is plenty for a scene image and keeps the aspect exact.
 */
export async function mockupInputFor(family: 'mug' | 'card', picture: Buffer): Promise<Buffer> {
  if (family === 'mug') {
    const wrap = await buildMugWrap(picture, MUG.mockupScale), W = Math.round(MUG.wrap.w * MUG.mockupScale), H = Math.round(MUG.wrap.h * MUG.mockupScale)
    const shift = (((Math.round(W / 2 - MUG.mockupFaceCenterX * MUG.mockupScale)) % W) + W) % W        // roll the wrap sideways (it is a circle): the right-handed face lands in the middle
    if (!shift) return wrap
    const tail = await sharp(wrap).extract({ left: W - shift, top: 0, width: shift, height: H }).png().toBuffer()
    const head = await sharp(wrap).extract({ left: 0, top: 0, width: W - shift, height: H }).png().toBuffer()
    return sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite([{ input: tail, left: 0, top: 0 }, { input: head, left: shift, top: 0 }]).png().toBuffer()
  }
  const f = cardLayout(0.5).front
  return sized(picture, f, 'card_picture_shape_mismatch')
}
