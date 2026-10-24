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
  return sharp(soft).composite(panels.map((input, i) => ({ input, left: rects[i].x, top: rects[i].y }))).png().toBuffer()
}

/** The shape of the full-wrap picture: the printable band of the lab file (2670 x 1034). */
export const MUG_FULL_WRAP_ASPECT = MUG.fullWrap.printable.w / MUG.fullWrap.printable.h
export const isMugFullWrapShape = (w: number, h: number): boolean => w > 0 && h > 0 && Math.abs(w / h / MUG_FULL_WRAP_ASPECT - 1) <= SHAPE_TOLERANCE

/**
 * The genuine full wrap: the ONE picture the customer reviewed, whole, across the full width of the lab file inside the 1/8 inch unprinted band at rim and base, rolled so its subjects sit on the face a
 * right-handed mug shows. Nothing is repeated, mirrored, blurred, cropped or stretched (a picture of another shape is refused). `scale` 1 is the 2670 x 1110 lab file; 0.5 is the mockup size.
 * The lab file is built from the unrolled-for-viewing picture; a mockup rolls THIS file again to put the visible face in the middle, but the beauty crop is never the print file.
 */
export async function buildMugFullWrap(picture: Buffer, scale = 1): Promise<Buffer> {
  const f = MUG.fullWrap, W = Math.round(MUG.wrap.w * scale), H = Math.round(MUG.wrap.h * scale)
  const pw = W, ph = Math.round(f.printable.h * scale), top = Math.round(f.printable.y * scale), roll = Math.round(f.rollPx * scale)
  const m = await sharp(picture).metadata()
  if (!isMugFullWrapShape(m.width ?? 0, m.height ?? 0)) throw new Error('mug_picture_shape_mismatch')
  const band = await sharp(picture).resize(pw, ph, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer()
  const rolled = roll ? await sharp({ create: { width: pw, height: ph, channels: 3, background: '#ffffff' } }).composite([
    { input: await sharp(band).extract({ left: pw - roll, top: 0, width: roll, height: ph }).png().toBuffer(), left: 0, top: 0 },
    { input: await sharp(band).extract({ left: 0, top: 0, width: pw - roll, height: ph }).png().toBuffer(), left: roll, top: 0 }]).png().toBuffer() : band
  return sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite([{ input: rolled, left: 0, top }]).png().toBuffer()
}
/** The picture part of a full-wrap lab file (the printable band), for inspection. */
export async function mugFullWrapQaRegion(final: Buffer): Promise<Buffer> {
  const r = MUG.fullWrap.printable
  return sharp(final).extract({ left: r.x, top: r.y, width: r.w, height: r.h }).jpeg({ quality: 95 }).toBuffer()
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
    const pm = await sharp(picture).metadata()
    const wrap = isMugFullWrapShape(pm.width ?? 0, pm.height ?? 0) ? await buildMugFullWrap(picture, MUG.mockupScale) : await buildMugWrap(picture, MUG.mockupScale), W = Math.round(MUG.wrap.w * MUG.mockupScale), H = Math.round(MUG.wrap.h * MUG.mockupScale)
    const shift = (((Math.round(W / 2 - MUG.mockupFaceCenterX * MUG.mockupScale)) % W) + W) % W        // roll the wrap sideways (it is a circle): the right-handed face lands in the middle
    if (!shift) return wrap
    const tail = await sharp(wrap).extract({ left: W - shift, top: 0, width: shift, height: H }).png().toBuffer()
    const head = await sharp(wrap).extract({ left: 0, top: 0, width: W - shift, height: H }).png().toBuffer()
    return sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } }).composite([{ input: tail, left: 0, top: 0 }, { input: head, left: shift, top: 0 }]).png().toBuffer()
  }
  const f = cardLayout(0.5).front
  return sized(picture, f, 'card_picture_shape_mismatch')
}
