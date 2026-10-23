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
import { geometryKeyFor } from './composition-plan'
import { liveEffectIds } from './effects'
import { MAX_CONFORM_CROP, STORAGE } from './policy'
import { GiftError, fromStoreError, generationViewOf, getSessionView, owned, type GiftDeps } from './service'
import { finalizedAt, type SessionRec } from './store'
import type { GenerationRec } from './generation-store'
import type { GenerationView, SessionView } from './types'

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

const productOf = (id: unknown): CanonicalProduct | null => (typeof id === 'string' ? allProducts().find(p => p.productId === id) ?? null : null)
const purchasable = (p: CanonicalProduct) => p.status === 'launch' && p.retailCents !== null

/**
 * The exact picture a generation for this product must be, or null when the series cannot make that shape without extending. Pure.
 * `aspect` is the ratio requested from the model (a ratio the series' route admits that is within MAX_CONFORM_CROP of the product's shape).
 */
export function generationTargetFor(p: CanonicalProduct, series: SessionRec['series'], peopleCount: number | null): { geometryKey: string; targetAspect: number; aspect: string } | null {
  if (!series) return null
  const target = p.requirements.pictureAspect
  const gen = generationAspectFor(series, peopleCount, target)
  if (!gen || gen.extensionFraction > MAX_CONFORM_CROP + 1e-9) return null
  return { geometryKey: geometryKeyFor(p), targetAspect: target, aspect: gen.aspect }
}

/**
 * How to reach the exact aspect from what the model returned: nothing, or the smallest centered trim. Never an extension. Returns null when the trim would exceed the bound.
 * Pure and exported so tests pin it.
 */
export function conformTo(width: number, height: number, target: number): { method: 'native' | 'trim'; crop: { left: number; top: number; width: number; height: number }; trimFraction: number } | null {
  let w = width, h = height
  if (width / height > target) w = Math.round(height * target)
  else if (width / height < target) h = Math.round(width / target)
  w = Math.min(width, Math.max(1, w)); h = Math.min(height, Math.max(1, h))
  const trimFraction = Math.round(Math.max((width - w) / width, (height - h) / height) * 1e5) / 1e5
  if (trimFraction > MAX_CONFORM_CROP + 1e-9) return null
  const crop = { left: Math.floor((width - w) / 2), top: Math.floor((height - h) / 2), width: w, height: h }
  return { method: w === width && h === height ? 'native' : 'trim', crop, trimFraction }
}

export interface GenerationRequest { productId: unknown; idempotencyKey: unknown; mode?: unknown }
export interface GenerationOutcome { status: 'ok' | 'partial'; generation: GenerationView; reused: boolean; session: SessionView; retryAfterSeconds?: number }

export async function startGeneration(deps: GiftDeps, userId: string, sessionId: string, req: GenerationRequest): Promise<GenerationOutcome> {
  const rec = await owned(deps, userId, sessionId)
  if (typeof req?.idempotencyKey !== 'string' || !IDEMPOTENCY.test(req.idempotencyKey)) throw new GiftError('invalid_idempotency_key')
  if (req.mode !== undefined && req.mode !== 'reuse_or_generate' && req.mode !== 'new') throw new GiftError('invalid_lines')
  const mode = (req.mode as 'reuse_or_generate' | 'new' | undefined) ?? 'reuse_or_generate'
  const p = productOf(req.productId)
  if (!p || !purchasable(p)) throw new GiftError('product_not_available')
  if (!rec.series) throw new GiftError('unsupported_subject')
  const t = generationTargetFor(p, rec.series, rec.analysis.peopleCount ?? null)
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
    const fit = conformTo(md.width, md.height, p.requirements.pictureAspect)
    if (!fit) throw new Error('aspect_mismatch')
    const img = sharp(raw).removeAlpha()
    const png = await (fit.method === 'trim' ? img.extract(fit.crop) : img).png().toBuffer({ resolveWithObject: true })
    const sha = createHash('sha256').update(png.data).digest('hex')
    const masterPath = STORAGE.master(rec.id, g.id, 'png'), previewPath = STORAGE.preview(rec.id, g.id)
    const marked = await deps.watermark(png.data.toString('base64'))                       // throws rather than return an unmarked image
    await deps.storage.put(masterPath, png.data, 'image/png'); files.push(masterPath)
    await deps.storage.put(previewPath, marked, 'image/jpeg'); files.push(previewPath)
    const record = {
      ...(out.generation ?? {}), productId: p.productId, geometryKey: g.geometry_key, requestedAspect: g.aspect, targetAspect: p.requirements.pictureAspect, durationMs: now(deps) - t0,
      conform: { method: fit.method, trimFraction: fit.trimFraction, crop: fit.crop, from: { width: md.width, height: md.height } }, referenced: !!referenceB64,
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
