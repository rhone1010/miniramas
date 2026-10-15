// lib/v1/print/upscale/target.ts
//
// How many megapixels to ask the upscaler for, and whether what came back is usable.
// Pure functions: no network, no storage. The numbers come from the real print plan
// (geometry.ts printPlan) so bleed and canvas wrap are already inside `final`.
//
// The model's `target` parameter is an INTEGER number of megapixels. Rounding up always
// overshoots a little (see `overshootPct`); finishPrintPixels() then resamples to the exact
// size Prodigi wants. Nothing here assumes the provider hit the target: validateOutput()
// checks the real dimensions.

export const REFERENCE_PPI = 300   // geometry.ts sizes every print at 300 PPI
export const MAX_MEGAPIXELS = 128  // the model's own cap
const HEADROOM_PX = 2              // matches requiredUpscale(): absorbs provider integer rounding

export interface Dim { w: number; h: number }

export interface TargetPlan {
  /** The visible picture area at 300 PPI (geometry printPlan().front). */
  front: Dim
  /** What Prodigi receives at 300 PPI, including canvas wrap (printPlan().final). */
  final: Dim
}

export interface TargetResult {
  /** Integer megapixels to send as `target`. */
  targetMp: number
  /** The unrounded requirement, for the record. */
  exactMp: number
  overshootPct: number
  requiredFront: Dim
  requiredFinal: Dim
}

export class TargetError extends Error {
  constructor(public code: 'print_target_exceeds_limit' | 'print_target_invalid', message?: string) { super(message || code) }
}

const scale = (d: Dim, ppi: number): Dim => ({ w: Math.round(d.w * ppi / REFERENCE_PPI), h: Math.round(d.h * ppi / REFERENCE_PPI) })

/**
 * Target megapixels for one print.
 * The requirement is the larger of
 *   - the picture area (plus headroom), so the front reaches the requested PPI, and
 *   - the full print file including bleed and canvas wrap,
 * both at `ppi`. Anything over `maxMp` is refused, not silently clipped.
 */
export function computeTarget(plan: TargetPlan, ppi: number, maxMp: number = MAX_MEGAPIXELS): TargetResult {
  if (!(ppi > 0) || !(maxMp >= 1) || !plan?.front?.w || !plan.front.h || !plan.final?.w || !plan.final.h) {
    throw new TargetError('print_target_invalid')
  }
  const requiredFront = scale(plan.front, ppi)
  const requiredFinal = scale(plan.final, ppi)
  const frontArea = (requiredFront.w + HEADROOM_PX) * (requiredFront.h + HEADROOM_PX)
  const finalArea = requiredFinal.w * requiredFinal.h
  const exactMp = Math.max(frontArea, finalArea) / 1e6
  const targetMp = Math.max(1, Math.ceil(exactMp))
  if (targetMp > Math.min(maxMp, MAX_MEGAPIXELS)) {
    throw new TargetError('print_target_exceeds_limit', `needs ${targetMp} MP, limit ${Math.min(maxMp, MAX_MEGAPIXELS)} MP`)
  }
  return { targetMp, exactMp, overshootPct: ((targetMp - exactMp) / exactMp) * 100, requiredFront, requiredFinal }
}

export interface OutputCheck { ok: boolean; errors: string[]; actualMp: number }

/** What the provider really returned, judged against what we needed. */
export function validateOutput(out: Dim, input: Dim, requiredFront: Dim, targetMp: number): OutputCheck {
  const errors: string[] = []
  if (!out.w || !out.h) errors.push('output_unreadable')
  else {
    if (out.w < requiredFront.w || out.h < requiredFront.h) errors.push('output_below_required_resolution')
    // Same picture, same shape. Integer rounding of megapixels moves the ratio by a hair, never by a percent.
    const aspectIn = input.w / input.h, aspectOut = out.w / out.h
    if (Math.abs(aspectOut - aspectIn) / aspectIn > 0.002) errors.push('output_aspect_changed')
    // A result far larger than asked for means the parameter was not what we think it is.
    if ((out.w * out.h) / 1e6 > targetMp * 1.3 + 0.5) errors.push('output_far_above_target')
  }
  return { ok: errors.length === 0, errors, actualMp: (out.w * out.h) / 1e6 }
}

export interface SourceQuality { sourcePpi: number; belowFloor: boolean; floor: number }

/**
 * Real detail: the aspect-corrected artwork's pixels over the inches it will cover.
 * Upscaling adds pixels, never information, so this is the honest measure of how soft
 * the print will be. A shortfall is recorded as diagnostic metadata only; it never holds a job.
 */
export function sourceQuality(input: Dim, front: Dim, minSourcePpi: number): SourceQuality {
  const inchesW = front.w / REFERENCE_PPI, inchesH = front.h / REFERENCE_PPI
  const sourcePpi = Math.min(input.w / inchesW, input.h / inchesH)
  return { sourcePpi: Math.round(sourcePpi * 100) / 100, belowFloor: sourcePpi < minSourcePpi, floor: minSourcePpi }
}
