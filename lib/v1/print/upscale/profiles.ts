// lib/v1/print/upscale/profiles.ts
//
// Product-specific artwork handling, behind one interface, so the job processor (process.ts) never learns
// what a "print" is. A profile answers three questions for its products:
//   prepare   source picture  -> the artwork in this product's exact shape, and what resolution it needs
//   finish    enlarged artwork -> the exact file the lab receives, and its required dimensions
//   qaRegion  the file        -> the part that is the PICTURE (so inspection ignores wrap, bleed and borders)
//
// ONLY ONE PROFILE EXISTS: the flat-print family already sold (fine art, premium, canvas, classic frame), whose
// geometry is in geometry.ts. Mugs (a wrap-around print area) and greeting cards (a flat spread with a front
// panel) have different shapes, bleeds and QA regions. Their numbers are NOT encoded here: the sandbox Products
// API returned print areas of 2670x1110 (mug) and 6118x2161 (7x5 card spread), but which part of a card sheet is
// the front, and how a mug wrap should treat a square picture, are unverified product decisions. Adding either is
// one new profile registered below plus tests; the processor, the job table, the settings, the review queue and
// the order gate need no change. Until then those SKUs fail loudly ('no_artwork_profile') and never reach a lab.

import sharp from 'sharp'
import { getSku, type PrintFinish, type PrintSize } from '../sku-map'
import { printPlan } from '../geometry'
import { finishPrintAsset, prepareComposition } from '../asset-pipeline'
import type { AssetJob } from './store'
import type { Dim, TargetPlan } from './target'

export interface PreparedArtwork {
  /** The artwork in the product's exact shape (after any outpaint or reflection). This is the QA reference. */
  working: Buffer
  width: number
  height: number
  /** Linear enlargement still needed; 0 means the picture is already large enough and no paid call is made. */
  scale: number
  /** The picture area the enlargement must reach. */
  requiredFront: Dim
  /** Pixel requirements at the reference PPI, from which the target megapixels are computed. */
  targetPlan: TargetPlan
  /** True when AI outpaint (a separate paid service) extended the artwork. */
  outpainted: boolean
}

export interface FinishedFile { jpeg: Buffer; expected: Dim }

export interface ArtworkProfile {
  readonly id: string
  prepare(input: { job: AssetJob; source: Buffer; ppi: number }): Promise<PreparedArtwork>
  finish(input: { job: AssetJob; image: Buffer; upscaled: boolean; targetMp?: number }): Promise<FinishedFile>
  /** The picture part of the finished file, for inspection. */
  qaRegion(input: { job: AssetJob; final: Buffer }): Promise<Buffer>
}

export class NoProfileError extends Error { constructor(sku: string) { super(`no_artwork_profile:${sku}`) } }

const planFor = (job: AssetJob) => printPlan(job.input_w!, job.input_h!, getSku(job.size as PrintSize, job.finish as PrintFinish))

/** Fine art, premium, gallery canvas and classic frame: flat prints, optional canvas wrap. */
export const flatPrintProfile: ArtworkProfile = {
  id: 'flat_print',
  async prepare({ job, source, ppi }) {
    const c = await prepareComposition({ imageB64: source.toString('base64'), size: job.size as PrintSize, finish: job.finish as PrintFinish, ppi })
    return { working: c.working, width: c.width, height: c.height, scale: c.scale, requiredFront: c.requiredFront, outpainted: c.outpainted,
      targetPlan: { front: c.plan.front, final: c.plan.final } }
  },
  async finish({ job, image, upscaled, targetMp }) {
    const plan = planFor(job)
    const f = await finishPrintAsset({
      image, upscaled, targetMp,
      composition: { plan, width: job.input_w!, height: job.input_h!, requiredFront: { w: job.required_front_w!, h: job.required_front_h! } },
    })
    return { jpeg: f.jpeg, expected: { w: plan.final.w, h: plan.final.h } }
  },
  async qaRegion({ job, final }) {
    const plan = planFor(job)
    // Compare the picture area only: canvas wrap is mirrored border, not artwork.
    return sharp(final).extract({ left: plan.extension.left, top: plan.extension.top, width: plan.front.w, height: plan.front.h }).jpeg({ quality: 95 }).toBuffer()
  },
}

type Matcher = (job: AssetJob) => boolean
const registry: Array<{ match: Matcher; profile: ArtworkProfile }> = [
  { match: job => ['fine_art', 'premium', 'canvas', 'framed', 'framed_canvas', 'matted'].includes(job.finish) && /^\d+x\d+$/.test(job.size), profile: flatPrintProfile },
]

/** Register a new product family's profile (mugs, cards). First match wins; registered profiles go first. */
export function registerProfile(match: Matcher, profile: ArtworkProfile) { registry.unshift({ match, profile }) }

export function profileFor(job: AssetJob): ArtworkProfile {
  const hit = registry.find(r => r.match(job))
  if (!hit) throw new NoProfileError(job.sku)
  return hit.profile
}
