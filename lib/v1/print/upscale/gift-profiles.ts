// lib/v1/print/upscale/gift-profiles.ts
//
// The artwork production profiles for the 11 oz mug and the 7 x 5 greeting card (see production-profiles.ts for every number and its source).
// Both profiles work on ONE picture, the panel the customer reviewed: prepare() makes it the panel's exact shape, the shared processor upscales it, and
// finish() builds the whole lab file around it (product-layout.ts). The upscaler therefore never sees the blank paper or the background wash, a card's
// 13 MP spread is never sent to a provider, and the picture on the file is exactly the one on the mockup.

import sharp from 'sharp'
import { preparePanelComposition } from '../asset-pipeline'
import { compositionPlan } from '../geometry'
import { buildCardSpread, buildMugFullWrap, buildMugSinglePanel, buildMugWrap, cardQaRegion, isMugFullWrapShape, mugFullWrapQaRegion, mugQaRegion } from '../product-layout'
import { CARD, MUG, MUG_PANEL_SHAPES, MUG_SINGLE_PANEL, mugPanelShapeOf, type MugComposition } from '../production-profiles'
import { validateOutput, type Dim } from './target'
import type { ArtworkProfile } from './profiles'

const JPEG_QUALITY = 92

function layoutProfile(id: string, panel: Dim, spread: Dim, build: (picture: Buffer) => Promise<Buffer>, qa: (final: Buffer) => Promise<Buffer>): ArtworkProfile {
  return {
    id,
    async prepare({ source, ppi }) {
      const c = await preparePanelComposition({ imageB64: source.toString('base64'), panel, ppi })
      // The target for the upscaler is the PANEL only: the rest of the file is paper or a soft wash.
      return { working: c.working, width: c.width, height: c.height, scale: c.scale, requiredFront: c.requiredFront, outpainted: c.outpainted, targetPlan: { front: panel, final: panel } }
    },
    async finish({ job, image, upscaled, targetMp }) {
      let working = image
      if (upscaled) {
        const enlarged = await sharp(working).metadata()
        const check = validateOutput({ w: enlarged.width || 0, h: enlarged.height || 0 }, { w: job.input_w!, h: job.input_h! }, { w: job.required_front_w!, h: job.required_front_h! }, targetMp ?? 128)
        if (check.errors.includes('output_below_required_resolution') || check.errors.includes('output_unreadable')) throw new Error('print_upscale_resolution_shortfall')
        if (check.errors.includes('output_aspect_changed')) throw new Error('print_upscale_dimensions_changed')
        // Provider output is integer-rounded: restore only that rounding with a reflection, never a crop or a stretch.
        const rounded = compositionPlan(enlarged.width!, enlarged.height!, panel.w, panel.h)
        if (rounded.width !== enlarged.width || rounded.height !== enlarged.height) working = await sharp(working).extend({ ...rounded.padding, extendWith: 'mirror' }).png().toBuffer()
      }
      const picture = await sharp(working).resize(panel.w, panel.h, { fit: 'inside', kernel: 'lanczos3' }).png().toBuffer()
      const m = await sharp(picture).metadata()
      if (m.width !== panel.w || m.height !== panel.h) throw new Error('upscale_changed_aspect')
      const file = await build(picture)
      const jpeg = await sharp(file).toColourspace('srgb').jpeg({ quality: JPEG_QUALITY, chromaSubsampling: '4:4:4', progressive: false, mozjpeg: true }).toBuffer()
      return { jpeg, expected: { w: spread.w, h: spread.h } }
    },
    async qaRegion({ final }) { return qa(final) },
  }
}

const mugPanelProfiles: Record<MugComposition, ArtworkProfile> = {
  square: layoutProfile('mug_wrap', { ...MUG_PANEL_SHAPES.square }, { ...MUG.wrap }, p => buildMugWrap(p, 1), f => mugQaRegion(f, 'square')),
  landscape: layoutProfile('mug_wrap', { ...MUG_PANEL_SHAPES.landscape }, { ...MUG.wrap }, p => buildMugWrap(p, 1), f => mugQaRegion(f, 'landscape')),
}
const mugSinglePanelProfiles: Record<MugComposition, ArtworkProfile> = {
  square: layoutProfile('mug_wrap', { ...MUG_PANEL_SHAPES.square }, { ...MUG.wrap }, p => buildMugSinglePanel(p, 1), f => mugQaRegion(f, 'square')),
  landscape: layoutProfile('mug_wrap', { ...MUG_PANEL_SHAPES.landscape }, { ...MUG.wrap }, p => buildMugSinglePanel(p, 1), f => mugQaRegion(f, 'landscape')),
}
const mugFullWrapProfile = layoutProfile('mug_wrap', { w: MUG.fullWrap.printable.w, h: MUG.fullWrap.printable.h }, { ...MUG.wrap }, p => buildMugFullWrap(p, 1), mugFullWrapQaRegion)
/**
 * The mug's layouts, told apart by the shape of the picture the customer approved: a SQUARE or LANDSCAPE panel on the face (the square is every composition made before 2026-10-24, kept exactly
 * as it was), or the FULL WRAP (built but not used: the wrap was dropped). The shape decides, so an existing paid order never changes layout; a shape that is none of them falls to the square panel as before.
 */
/** The layout frozen onto the job when it was prepared (settings_snapshot.layout, from the approved composition); a job without one is a mug made before the single panel and keeps the two-face layout. */
const layoutOfJob = (job: { settings_snapshot?: Record<string, unknown> | null }): string | undefined => (job.settings_snapshot as { layout?: string } | null | undefined)?.layout
const mugVariant = (w: number, h: number, layout?: string): ArtworkProfile => isMugFullWrapShape(w, h) ? mugFullWrapProfile : (layout === MUG_SINGLE_PANEL ? mugSinglePanelProfiles : mugPanelProfiles)[mugPanelShapeOf(w, h) ?? 'square']
export const mugWrapProfile: ArtworkProfile = {
  id: 'mug_wrap',
  async prepare(i) { const m = await sharp(i.source).metadata(); return mugVariant(m.width ?? 0, m.height ?? 0, layoutOfJob(i.job)).prepare(i) },
  finish(i) { return mugVariant(i.job.input_w ?? 0, i.job.input_h ?? 0, layoutOfJob(i.job)).finish(i) },
  qaRegion(i) { return mugVariant(i.job.input_w ?? 0, i.job.input_h ?? 0, layoutOfJob(i.job)).qaRegion(i) },
}
export const cardSpreadProfile = layoutProfile('card_spread', { w: CARD.frontTrim.w, h: CARD.frontTrim.h }, { ...CARD.spread }, p => buildCardSpread(p, 1), cardQaRegion)
