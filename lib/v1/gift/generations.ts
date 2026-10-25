// lib/v1/gift/generations.ts
//
// THE PRODUCT-FIRST JOURNEY (migration 059): choose ONE effect, then generate a personalized composition FOR A PRODUCT at that product's exact aspect with NB2.1, look at it, accept it or
// try again. Nothing here extends, mirrors or reframes a picture: the model is asked for the product's own ratio, and the only change made to what it returns is a trim of a sliver
// (never more than MAX_CONFORM_CROP per axis) so the stored picture has the product's EXACT aspect. The stored picture's sha256 is its identity from here to the printer.
//
//   chooseEffect       POST /sessions/{id}/effect
//   startGeneration    POST /sessions/{id}/generations     (idempotent per key; reserves, generates, stores)
//   list / get         GET  /sessions/{id}/generations[/{gid}]
//   acceptGeneration   POST /sessions/{id}/generations/{gid}/accept

import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { allProducts, type CanonicalProduct } from '../print/catalog'
import { generationAspectFor, supportsFavoriteReference } from './aspects'
import { MUG_COMPOSITIONS, MUG_PANEL_SHAPES, MUG_SINGLE_PANEL, mugSinglePanelPlacement, type MugComposition } from '../print/production-profiles'
import { liveEffectIds } from './effects'
import { MAX_CONFORM_CROP, STORAGE } from './policy'
import { GiftError, fromStoreError, generationViewOf, getSessionView, owned, type GiftDeps } from './service'
import { finalizedAt, type CompositionRec, type SessionRec } from './store'
import type { GenerationRec } from './generation-store'
import type { GenerationView, GiftLine, SessionView } from './types'

const IDEMPOTENCY = /^[\w.:-]{8,80}$/
const now = (deps: GiftDeps) => (deps.clock ?? Date.now)()

export async function chooseEffect(deps: GiftDeps, userId: string, sessionId: string, effectId: unknown): Promise<SessionView> {
  const rec = await owned(deps, userId, sessionId)
  if (typeof effectId !== 'string' || !effectId) throw new GiftError('invalid_effect_selection')
  if (!rec.series) throw new GiftError('unsupported_subject')
  if (!rec.collection_preview_id && !liveEffectIds(rec.series).includes(effectId)) throw new GiftError('invalid_effect_selection')
  try { await deps.store.chooseEffect(rec.id, userId, effectId) } catch (e) { fromStoreError(e) }
  return getSessionView(deps, userId, rec.id)
}

/**
 * The shape of the picture a generation for this product must have: the product's picture area, except the mug, whose picture is a SQUARE or LANDSCAPE panel the customer chooses
 * (`composition`, default square). The 21:9 full wrap is not used.
 */
export function generationShapeOf(p: CanonicalProduct, composition?: MugComposition | null): { w: number; h: number } {
  return p.family === 'mug' ? MUG_PANEL_SHAPES[composition ?? 'square'] : p.requirements.picturePx
}
export const generationAspectOf = (p: CanonicalProduct, composition?: MugComposition | null): number => { const s = generationShapeOf(p, composition); return Math.round((s.w / s.h) * 1e6) / 1e6 }
/** Same shape = same composition = shared among products: 'a667' is 2:3, 'a1000' square, 'a1500' 3:2 (a mug panel and a print of the same shape share one generation). */
export const geometryKeyOf = (p: CanonicalProduct, composition?: MugComposition | null): string => 'a' + Math.round(generationAspectOf(p, composition) * 1000)
/** Every geometry key a product can be made in: one for most products, the three panels for the mug. */
export const geometryKeysOf = (p: CanonicalProduct): string[] => (p.family === 'mug' ? MUG_COMPOSITIONS.map(c => geometryKeyOf(p, c)) : [geometryKeyOf(p)])
/** Which mug panel a stored generation (by its geometry key) is; null for any other product. */
/** What a mug generation's composition plan records, so approval, cart, checkout and manufacturing all see the same layout, orientation and placement. */
export function mugPlanFields(p: CanonicalProduct, key: string) {
  const composition = compositionOfKey(p, key) ?? 'square'
  return { layout: MUG_SINGLE_PANEL, composition, placement: mugSinglePanelPlacement(composition) }
}
export const compositionOfKey = (p: CanonicalProduct, key: string): MugComposition | null => (p.family === 'mug' ? MUG_COMPOSITIONS.find(c => geometryKeyOf(p, c) === key) ?? null : null)

/** The product's picture shape as the smallest whole-number ratio (2400 x 3600 -> 2 x 3), the grid an exact picture lands on. */
export function gridOf(p: CanonicalProduct, composition?: MugComposition | null): { w: number; h: number } {
  const { w, h } = generationShapeOf(p, composition)
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
  const d = gcd(w, h) || 1
  return { w: w / d, h: h / d }
}

const productOf = (id: unknown): CanonicalProduct | null => (typeof id === 'string' ? allProducts().find(p => p.productId === id) ?? null : null)
const purchasable = (p: CanonicalProduct) => p.status === 'launch' && p.retailCents !== null

/**
 * The exact picture a generation for this product must be, or null when the series cannot make that shape without extending. Pure.
 * `aspect` is the ratio requested from the model (a ratio the series' route admits that is within MAX_CONFORM_CROP of the product's shape).
 */
export function generationTargetFor(p: CanonicalProduct, series: SessionRec['series'], peopleCount: number | null, composition?: MugComposition | null): { geometryKey: string; targetAspect: number; aspect: string; composition: MugComposition | null } | null {
  if (!series) return null
  // The mug without a stated composition takes the first one the series can make (square, then landscape): Groups allow different ratios at different head counts.
  if (p.family === 'mug' && !composition) { for (const c of MUG_COMPOSITIONS) { const t = generationTargetFor(p, series, peopleCount, c); if (t) return t } return null }
  const c = p.family === 'mug' ? composition! : null
  const target = generationAspectOf(p, c)
  const gen = generationAspectFor(series, peopleCount, target)
  if (!gen || 1 - 1 / (1 + gen.extensionFraction) > MAX_CONFORM_CROP + 1e-9) return null          // what must be trimmed (not the extension ratio) is bounded
  return { geometryKey: geometryKeyOf(p, c), targetAspect: target, aspect: gen.aspect, composition: c }
}

/**
 * How to reach the exact aspect from what the model returned: nothing, or the smallest centered trim. Never an extension. Returns null when the trim would exceed the bound.
 * Pure and exported so tests pin it.
 */
/** Grids with a side above this are 'coarse' (see conformTo). */
const COARSE_GRID = 64
export function conformTo(width: number, height: number, target: number, grid?: { w: number; h: number }): { method: 'native' | 'trim'; crop: { left: number; top: number; width: number; height: number }; trimFraction: number; resize?: { width: number; height: number } } | null {
  let w = width, h = height
  if (grid && (grid.w > COARSE_GRID || grid.h > COARSE_GRID)) {
    // A shape whose reduced ratio is coarse (a mount opening of 2418 x 4218 px is 403:703): landing on the grid by trimming alone would throw most of the picture away. Trim to the ratio (a sliver), then
    // resample the WHOLE picture to the nearest grid size at or above it (a change of well under 1% in shape, no content added or removed): print preparation then has nothing to add.
    const r = grid.w / grid.h
    if (width / height > r) w = Math.round(height * r); else if (width / height < r) h = Math.round(width / r)
    w = Math.min(width, Math.max(1, w)); h = Math.min(height, Math.max(1, h))
    const trimFraction = Math.round(Math.max((width - w) / width, (height - h) / height) * 1e5) / 1e5
    if (trimFraction > MAX_CONFORM_CROP + 1e-9) return null
    const units = Math.max(1, Math.round(Math.min(w / grid.w, h / grid.h)))          // the NEAREST exact size: never a large enlargement at generation time (the print preparation upscales after approval)
    const crop = { left: Math.floor((width - w) / 2), top: Math.floor((height - h) / 2), width: w, height: h }
    return { method: w === width && h === height && units * grid.w === w ? 'native' : 'trim', crop, trimFraction, ...(units * grid.w !== w || units * grid.h !== h ? { resize: { width: units * grid.w, height: units * grid.h } } : {}) }
  }
  if (grid) {
    // The print preparation step pads anything that is not an exact multiple of the product's reduced ratio (2:3 -> multiples of 2 x 3). Landing ON the grid by trimming a few pixels means it has nothing to add.
    const units = Math.floor(Math.min(width / grid.w, height / grid.h))
    if (units < 1) return null
    w = units * grid.w; h = units * grid.h
  } else if (width / height > target) w = Math.round(height * target)
  else if (width / height < target) h = Math.round(width / target)
  w = Math.min(width, Math.max(1, w)); h = Math.min(height, Math.max(1, h))
  const trimFraction = Math.round(Math.max((width - w) / width, (height - h) / height) * 1e5) / 1e5
  if (trimFraction > MAX_CONFORM_CROP + 1e-9) return null
  const crop = { left: Math.floor((width - w) / 2), top: Math.floor((height - h) / 2), width: w, height: h }
  return { method: w === width && h === height ? 'native' : 'trim', crop, trimFraction }
}

export interface GenerationRequest { productId: unknown; idempotencyKey: unknown; mode?: unknown; /** Mug only: 'square' | 'landscape' (omitted = the first the series can make). */ composition?: unknown }
export interface GenerationOutcome { status: 'ok' | 'partial'; generation: GenerationView; reused: boolean; session: SessionView; retryAfterSeconds?: number }

export async function startGeneration(deps: GiftDeps, userId: string, sessionId: string, req: GenerationRequest): Promise<GenerationOutcome> {
  const rec = await owned(deps, userId, sessionId)
  if (typeof req?.idempotencyKey !== 'string' || !IDEMPOTENCY.test(req.idempotencyKey)) throw new GiftError('invalid_idempotency_key')
  if (req.mode !== undefined && req.mode !== 'reuse_or_generate' && req.mode !== 'new') throw new GiftError('invalid_lines')
  const mode = (req.mode as 'reuse_or_generate' | 'new' | undefined) ?? 'reuse_or_generate'
  const p = productOf(req.productId)
  if (!p || !purchasable(p)) throw new GiftError('product_not_available')
  if (!rec.series) throw new GiftError('unsupported_subject')
  if (req.composition !== undefined && req.composition !== null && (p.family !== 'mug' || !(MUG_COMPOSITIONS as readonly unknown[]).includes(req.composition))) throw new GiftError('invalid_composition', p.family === 'mug' ? { supported: [...MUG_COMPOSITIONS] } : undefined)
  const t = generationTargetFor(p, rec.series, rec.analysis.peopleCount ?? null, (req.composition as MugComposition | undefined) ?? null)
  if (!t) throw new GiftError('product_aspect_unsupported')
  const existing = await deps.store.listGenerations(rec.id).catch(e => fromStoreError(e))
  const repeat = existing.find(g => g.idempotency_key === req.idempotencyKey)
  if (!repeat && finalizedAt(rec)) throw new GiftError('order_not_awaiting_artwork')
  if (!repeat && mode === 'reuse_or_generate') {
    // The same effect at the same picture shape is the same composition need: hand back what already exists (delivered, or in progress) and spend nothing.
    const anchor = rec.artwork_preview_id ? (await deps.store.listBatches(rec.id)).flatMap(b => b.previews).find(x => x.id === rec.artwork_preview_id) : null
    const same = anchor ? existing.filter(g => g.geometry_key === t.geometryKey && g.effect_id === anchor.effect_id && g.status !== 'failed').sort((a, b) => Number(b.status === 'ready') - Number(a.status === 'ready') || b.created_at.localeCompare(a.created_at))[0] : null
    if (same) return outcome(deps, userId, rec, same, true)
  }
  let r
  try { r = await deps.store.reserveGeneration({ sessionId: rec.id, userId, key: req.idempotencyKey, productId: p.productId, geometryKey: t.geometryKey, aspect: t.aspect }) } catch (e) { fromStoreError(e) }
  return runGeneration(deps, userId, rec, r!.generation, r!.reused)
}

async function outcome(deps: GiftDeps, userId: string, rec: SessionRec, g: GenerationRec, reused: boolean): Promise<GenerationOutcome> {
  const fresh = (await deps.store.getGeneration(rec.id, g.id)) ?? g
  const view = await generationViewOf(deps, fresh)
  const session = await getSessionView(deps, userId, rec.id)
  const done = fresh.status === 'ready'
  return { status: done ? 'ok' : 'partial', generation: view, reused, session, ...(done || fresh.status === 'failed' ? {} : { retryAfterSeconds: 5 }) }
}

/** Generate whatever of this generation is not delivered. A ready one is returned untouched; one another request is rendering is reported as in progress. */
async function runGeneration(deps: GiftDeps, userId: string, rec: SessionRec, g: GenerationRec, reused: boolean): Promise<GenerationOutcome> {
  if (g.status !== 'ready') {
    const claimed = await deps.store.claimGeneration(g.id, userId)
    if (claimed) await renderGeneration(deps, rec, claimed)
  }
  return outcome(deps, userId, rec, g, reused)
}

async function renderGeneration(deps: GiftDeps, rec: SessionRec, g: GenerationRec): Promise<void> {
  const files: string[] = []
  try {
    const p = productOf(g.product_id); if (!p || !rec.series || !rec.source_path) throw new Error('generation_unavailable')
    const source = await deps.storage.get(rec.source_path); if (!source) throw new Error('source_missing')
    // A collection session may hand the owned artwork to the model as a reference where the series supports it (Portraits, Pets).
    let referenceB64: string | undefined
    if (rec.collection_preview_id && supportsFavoriteReference(rec.series)) {
      const anchor = (await deps.store.listBatches(rec.id)).flatMap(b => b.previews).find(x => x.id === g.anchor_id)
      const m = anchor?.master_path ? await deps.storage.get(anchor.master_path) : null
      if (m) referenceB64 = m.toString('base64')
    }
    const t0 = now(deps)
    const out = await deps.generate({ series: rec.series, sourceB64: source.toString('base64'), effectId: g.effect_id, aspect: g.aspect, userId: rec.user_id, peopleCount: rec.analysis.peopleCount ?? null, exactAspect: true, ...(referenceB64 ? { referenceB64 } : {}) })
    // The customer may have cancelled while the model worked: the result is then discarded and nothing is stored.
    const live = await deps.store.getSession(rec.id, rec.user_id).catch(() => rec)
    if (!live || live.status !== 'active') { await deps.store.failGeneration(g.id, g.user_id, 'session_gone').catch(() => {}); return }
    const raw = Buffer.from(out.imageB64, 'base64')
    const md = await sharp(raw).metadata()
    if (!md.width || !md.height) throw new Error('master_unreadable')
    const comp = compositionOfKey(p, g.geometry_key)
    const fit = conformTo(md.width, md.height, generationAspectOf(p, comp), gridOf(p, comp))
    if (!fit) throw new Error('aspect_mismatch')
    const img = sharp(raw).removeAlpha()
    const cropped = fit.method === 'trim' ? img.extract(fit.crop) : img
    const png = await (fit.resize ? sharp(await cropped.png().toBuffer()).resize(fit.resize.width, fit.resize.height, { fit: 'fill', kernel: 'lanczos3' }) : cropped).png().toBuffer({ resolveWithObject: true })
    const sha = createHash('sha256').update(png.data).digest('hex')
    const masterPath = STORAGE.master(rec.id, g.id, 'png'), previewPath = STORAGE.preview(rec.id, g.id)
    const marked = await deps.watermark(png.data.toString('base64'))                       // throws rather than return an unmarked image
    await deps.storage.put(masterPath, png.data, 'image/png'); files.push(masterPath)
    await deps.storage.put(previewPath, marked, 'image/jpeg'); files.push(previewPath)
    const record = {
      ...(out.generation ?? {}), productId: p.productId, geometryKey: g.geometry_key, requestedAspect: g.aspect, targetAspect: generationAspectOf(p, comp), durationMs: now(deps) - t0,
      conform: { method: fit.method, trimFraction: fit.trimFraction, crop: fit.crop, ...(fit.resize ? { resampledTo: fit.resize } : {}), from: { width: md.width, height: md.height } }, referenced: !!referenceB64,
    }
    const stored = await deps.store.completeGeneration(g.id, g.user_id, { master_path: masterPath, preview_path: previewPath, width: png.info.width, height: png.info.height, sha256: sha, record })
    if (!stored) await deps.storage.remove(files).catch(() => {})                         // the project was deleted between the check and now: leave nothing behind
  } catch (e: any) {
    if (files.length) await deps.storage.remove(files).catch(() => {})
    await deps.store.failGeneration(g.id, g.user_id, String(e?.message ?? 'generation_failed')).catch(() => {})
  }
}

export async function listGenerations(deps: GiftDeps, userId: string, sessionId: string): Promise<{ generations: GenerationView[]; session: SessionView }> {
  const rec = await owned(deps, userId, sessionId)
  const items = await deps.store.listGenerations(rec.id).catch(e => fromStoreError(e))
  return { generations: await Promise.all(items.map(g => generationViewOf(deps, g))), session: await getSessionView(deps, userId, rec.id) }
}
export async function getGeneration(deps: GiftDeps, userId: string, sessionId: string, generationId: string): Promise<GenerationView> {
  const rec = await owned(deps, userId, sessionId)
  const g = await deps.store.getGeneration(rec.id, generationId).catch(e => fromStoreError(e))
  if (!g) throw new GiftError('generation_not_found')
  return generationViewOf(deps, g)
}
export async function acceptGeneration(deps: GiftDeps, userId: string, sessionId: string, generationId: string): Promise<{ generation: GenerationView; session: SessionView }> {
  const rec = await owned(deps, userId, sessionId)
  try { await deps.store.acceptGeneration(rec.id, userId, generationId) } catch (e) { fromStoreError(e) }
  return { generation: await getGeneration(deps, userId, sessionId, generationId), session: await getSessionView(deps, userId, rec.id) }
}

// ── the cart: an accepted generation IS the line's approved composition ───────────────────────────────────────────────────────────────────────────

/**
 * Called by setLines for lines that carry a generationId. The generation must be this session's, delivered, ACCEPTED, of the current effect and of the line product's picture shape. The line then gets
 * an approved composition row that points at the generation's own files (nothing is copied, re-encoded or changed), with the picture's sha256 in its plan. Validation happens for every line before
 * any row is written. Idempotent: a line already bound to that generation is left alone; a line bound to another one has it superseded (history kept).
 */
export async function bindGenerationLines(deps: GiftDeps, rec: SessionRec, lines: GiftLine[]): Promise<void> {
  const bound = lines.filter(l => l.generationId)
  if (!bound.length) return
  if (rec.flow !== 'generations' && !rec.collection_preview_id) throw new GiftError('flow_not_generations')
  if (!rec.artwork_preview_id) throw new GiftError('effect_not_chosen')
  const anchor = (await deps.store.listBatches(rec.id)).flatMap(b => b.previews).find(x => x.id === rec.artwork_preview_id)
  if (!anchor) throw new GiftError('effect_not_chosen')
  const gens = await deps.store.listGenerations(rec.id).catch(e => fromStoreError(e))
  const comps = await deps.store.listCompositions(rec.id)
  const plans: Array<{ line: GiftLine; g: (typeof gens)[number]; keep: CompositionRec | null }> = []
  for (const l of bound) {
    const g = gens.find(x => x.id === l.generationId)
    if (!g) throw new GiftError('generation_not_found')
    const p = productOf(l.productId); if (!p) throw new GiftError('product_not_available')
    if (g.status !== 'ready' || !g.master_path || !g.preview_path || !g.sha256) throw new GiftError('generation_not_ready')
    if (!g.accepted_at) throw new GiftError('generation_not_accepted')
    if (g.effect_id !== anchor.effect_id) throw new GiftError('stale_composition')
    if (!geometryKeysOf(p).includes(g.geometry_key)) throw new GiftError('composition_geometry_mismatch')
    const live = comps.filter(c => c.line_id === l.lineId && c.preview_id === rec.artwork_preview_id && (c.status === 'ready' || c.status === 'approved'))
    plans.push({ line: l, g, keep: live.find(c => c.generation_id === g.id && c.status === 'approved' && (c.plan as { frameColor?: string }).frameColor === (l.frameColor ?? undefined)) ?? null })          // same picture AND same finish
  }
  const at = new Date(now(deps)).toISOString()
  for (const { line, g, keep } of plans) {
    if (keep) continue
    for (const c of comps.filter(x => x.line_id === line.lineId && x.preview_id === rec.artwork_preview_id && (x.status === 'ready' || x.status === 'approved'))) await deps.store.patchComposition(c.id, { status: 'superseded', plan: { ...c.plan, supersededReason: 'generation_changed' } })
    const priorSeq = comps.filter(c => c.line_id === line.lineId && c.preview_id === rec.artwork_preview_id && c.attempt === 1).map(c => c.repair_seq ?? 0)
    const row = await deps.store.insertComposition({
      session_id: rec.id, line_id: line.lineId, preview_id: rec.artwork_preview_id!, attempt: 1, status: 'approved', composed_path: g.master_path, preview_path: g.preview_path, width: g.width, height: g.height,
      geometry_key: g.geometry_key, method: 'generated', source_composition_id: null, generation_mode: g.generation?.referenced ? 'favorite_reference' : 'photo_regeneration', generation_aspect: g.aspect,
      nb21_calls: 0, outpaint_calls: 0, cost_usd_est: null, generation_id: g.id,
      plan: { fit: 'exact', outpainted: false, method: 'generated', geometryKey: g.geometry_key, generationAspect: g.aspect, targetAspect: (g.generation as { targetAspect?: number } | null)?.targetAspect ?? null, generationMode: g.generation?.referenced ? 'favorite_reference' : 'photo_regeneration',
              sourceArtworkId: rec.artwork_preview_id, correction: false, source: 'generation', generationId: g.id, artworkSha256: g.sha256, productId: line.productId, ...(line.productId.startsWith('mug:') ? mugPlanFields(productOf(line.productId)!, g.geometry_key) : {}), ...(line.frameColor ? { frameColor: line.frameColor } : {}) },
      ...(priorSeq.length ? { repair_seq: Math.max(...priorSeq) + 1 } : {}),
    })
    await deps.store.patchComposition(row.id, { approved_at: at })
  }
}

/**
 * The ONE free correction of a purchased generation line: a NEW generation of the same shape and effect, outside the allowance, that the customer reviews and approves like any composition. The
 * idempotency key is per line, so a retry (or a refresh) resumes the same generation and never pays twice; the line's correction is spent only when the new picture is delivered.
 */
export async function correctGenerationLine(deps: GiftDeps, userId: string, rec: SessionRec, line: { line_id: string; product_id: string }, current: CompositionRec, phase: 'draft' | 'purchased'): Promise<void> {
  const keepFinish = (current.plan as { frameColor?: string }).frameColor
  const p = productOf(line.product_id); if (!p || !rec.series) throw new GiftError('product_not_available')
  const t = generationTargetFor(p, rec.series, rec.analysis.peopleCount ?? null, compositionOfKey(p, current.geometry_key ?? '')); if (!t) throw new GiftError('product_aspect_unsupported')
  if (phase !== 'purchased') throw new GiftError('order_payment_required')           // before payment the customer simply generates again (it is part of the allowance)
  let r
  try { r = await deps.store.reserveCorrection({ sessionId: rec.id, userId, key: `correction-${line.line_id}`.slice(0, 80), productId: p.productId, geometryKey: t.geometryKey, aspect: t.aspect }) } catch (e) { fromStoreError(e) }
  let g = r!.generation
  if (g.status !== 'ready') {
    const claimed = await deps.store.claimGeneration(g.id, userId)
    if (claimed) await renderGeneration(deps, rec, claimed)
    g = (await deps.store.getGeneration(rec.id, g.id)) ?? g
  }
  if (g.status !== 'ready' || !g.master_path || !g.preview_path || !g.sha256) throw new GiftError('composition_failed')
  const comps = await deps.store.listCompositions(rec.id)
  const priorSeq = comps.filter(c => c.line_id === line.line_id && c.preview_id === current.preview_id && c.attempt === 2).map(c => c.repair_seq ?? 0)
  await deps.store.insertComposition({
    session_id: rec.id, line_id: line.line_id, preview_id: current.preview_id, attempt: 2, status: 'ready', composed_path: g.master_path, preview_path: g.preview_path, width: g.width, height: g.height,
    geometry_key: g.geometry_key, method: 'generated', source_composition_id: current.id, generation_mode: g.generation?.referenced ? 'favorite_reference' : 'photo_regeneration', generation_aspect: g.aspect,
    nb21_calls: 0, outpaint_calls: 0, cost_usd_est: null, generation_id: g.id,
    plan: { fit: 'exact', outpainted: false, method: 'generated', geometryKey: g.geometry_key, generationAspect: g.aspect, targetAspect: p.requirements.pictureAspect, generationMode: g.generation?.referenced ? 'favorite_reference' : 'photo_regeneration',
            sourceArtworkId: current.preview_id, correction: true, source: 'generation', generationId: g.id, artworkSha256: g.sha256, productId: p.productId, sku: p.sku, ...(p.family === 'mug' ? mugPlanFields(p, g.geometry_key) : {}), ...(keepFinish ? { frameColor: keepFinish } : {}) },
    ...(priorSeq.length ? { repair_seq: Math.max(...priorSeq) + 1 } : {}),
  })
}
