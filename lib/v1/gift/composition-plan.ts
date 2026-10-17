// lib/v1/gift/composition-plan.ts
//
// What it takes to turn the customer's ONE selected artwork into the picture each purchased product needs, decided from the
// product's actual geometry (the canonical catalog), the shape the artwork was generated in, and what the series' routes can
// generate. Nothing here depends on a single fixed series aspect: a 12 x 18 print and an 8 x 8 canvas in one project each get
// the plan their own geometry needs.
//
//   deterministic  the artwork already fits (exactly, within 2%, or by bounded background extension up to 20%): the existing
//                  Print Shop composition step adapts it. Never crops, never distorts.
//   generated      the shape is too far away for bounded extension: a separate NB2.1 generation of the SAME effect from the
//                  customer's own photograph is made at the nearest supported aspect ratio, then bounded extension finishes the
//                  exact shape. The customer sees the actual watermarked result and approves it before anything is manufactured.
//
// Products are grouped for composition ONLY when their requirements are identical: the same picture shape (the geometry key).
// A group is composed once and its files are shared; each purchased line still keeps its own composition record, approval,
// correction allowance and print job.

import { fitFor, type CanonicalProduct } from '../print/catalog'
import { MAX_EXTENSION, extensionBetween, generationAspectFor, ratioOf } from './aspects'
import type { Series } from './types'

export type CompositionMethod = 'deterministic' | 'generated'
export type CompositionFit = 'exact' | 'resample' | 'extend'

export interface CompositionPlan {
  /** Same key = same composition requirement = one shared composition. 'a667' is a 2:3 picture, 'a1000' a square. */
  geometryKey: string
  /** The shape of the finished picture (the product's picture area), width over height. */
  targetAspect: number
  method: CompositionMethod
  /** How the SELECTED artwork relates to the target (deterministic), or how the generated image will relate to it (generated). */
  fit: CompositionFit
  extensionFraction: number
  /** For 'generated': the NB2.1 ratio requested through the series route, and the extension still needed after it. */
  generationAspect: string | null
  generationExtensionFraction: number | null
}

export interface PlanContext {
  series: Series
  peopleCount: number | null
  /** The aspect the six artistic previews (and so the selected artwork) are generated in. */
  masterAspect: string
}

/** Nominal pixels for a ratio, only to ask the catalog how a product's shape fits it. */
export function masterDims(aspect: string | null): { width: number; height: number } {
  const m = /^(\d+):(\d+)$/.exec(aspect ?? '')
  return m ? { width: Number(m[1]) * 512, height: Number(m[2]) * 512 } : { width: 1024, height: 1024 }
}

/** Two products need the same composition exactly when their picture areas have the same shape (to three decimals). */
export const geometryKeyFor = (product: CanonicalProduct): string => 'a' + Math.round(product.requirements.pictureAspect * 1000)

const classify = (extension: number): CompositionFit => extension <= 1e-6 ? 'exact' : extension <= 0.02 + 1e-10 ? 'resample' : 'extend'

/** The plan for one product, or null when no bounded way to make this product's shape exists for this series. */
export function planFor(product: CanonicalProduct, ctx: PlanContext): CompositionPlan | null {
  const target = product.requirements.pictureAspect
  const key = geometryKeyFor(product)
  const direct = fitFor(masterDims(ctx.masterAspect), product)
  if (direct.fit !== 'unavailable') {
    return { geometryKey: key, targetAspect: target, method: 'deterministic', fit: direct.fit, extensionFraction: direct.extensionFraction, generationAspect: null, generationExtensionFraction: null }
  }
  const gen = generationAspectFor(ctx.series, ctx.peopleCount, target)
  if (!gen) return null
  return { geometryKey: key, targetAspect: target, method: 'generated', fit: classify(gen.extensionFraction), extensionFraction: gen.extensionFraction, generationAspect: gen.aspect, generationExtensionFraction: gen.extensionFraction }
}

/**
 * The plan the ONE included correction uses (customer-initiated only; nothing here runs on its own).
 *   generated line      the plan stays: the correction is one new generation (the favorite as the reference where the series takes one)
 *   deterministic line  falls back to ONE generated adaptation at the nearest ratio the series can generate within the 20% bound, because
 *                       recomposing the same artwork the same way could never change what the customer objected to
 *   null                a deterministic line no series ratio can reach: the caller keeps the old recomposition rather than refuse
 */
export function correctionPlanFor(product: CanonicalProduct, ctx: PlanContext, plan: CompositionPlan): CompositionPlan | null {
  if (plan.method === 'generated') return plan
  const gen = generationAspectFor(ctx.series, ctx.peopleCount, product.requirements.pictureAspect)
  if (!gen) return null
  return { ...plan, method: 'generated', fit: classify(gen.extensionFraction), extensionFraction: gen.extensionFraction, generationAspect: gen.aspect, generationExtensionFraction: gen.extensionFraction }
}

/** Group purchased lines by composition requirement, in first-seen order. */
export function groupLines<T extends { product: CanonicalProduct }>(items: T[], ctx: PlanContext): Array<{ geometryKey: string; plan: CompositionPlan; items: T[] }> {
  const groups = new Map<string, { geometryKey: string; plan: CompositionPlan; items: T[] }>()
  for (const it of items) {
    const plan = planFor(it.product, ctx)
    if (!plan) throw new Error('composition_impossible:' + it.product.productId)
    const g = groups.get(plan.geometryKey)
    if (g) g.items.push(it); else groups.set(plan.geometryKey, { geometryKey: plan.geometryKey, plan, items: [it] })
  }
  return [...groups.values()]
}

export { MAX_EXTENSION, extensionBetween, ratioOf }
