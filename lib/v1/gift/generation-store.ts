// lib/v1/gift/generation-store.ts
//
// Persistence for the product-first generation flow (migration 059): the ONE chosen effect, the allowance ledger, and the pool of generated compositions.
// The Supabase implementation delegates every atomic rule to the 059 functions (migration-059.test.ts runs them against real Postgres); the memory implementation mirrors
// them for the service tests. Before 059 is applied every call degrades to StoreError('generations_unavailable'): nothing else in the Gift flow is affected.

import { randomUUID } from 'node:crypto'
import { FREE_GENERATIONS, GENERATIONS_PER_PACK, GENERATION_LEASE_SECONDS, GENERATION_MAX_ATTEMPTS, MAX_INFLIGHT_GENERATIONS } from './policy'
import { StoreError } from './store'
import type { GenerationRecord } from './types'

export type GenerationStatus = 'pending' | 'generating' | 'ready' | 'failed'
export interface GenerationRec {
  id: string; session_id: string; user_id: string; anchor_id: string; effect_id: string; product_id: string; geometry_key: string; aspect: string
  kind: 'free' | 'paid' | 'correction'; pack_id: string | null; idempotency_key: string; status: GenerationStatus; attempts: number; lease_until: string | null
  master_path: string | null; preview_path: string | null; width: number | null; height: number | null; sha256: string | null
  generation: (Partial<GenerationRecord> & Record<string, unknown>) | null; error: string | null; accepted_at: string | null; created_at: string; updated_at: string
}
export type FreeGenerationBlock = 'session_limit' | 'photo_limit' | 'daily_limit' | 'lifetime_limit'
export interface GenerationAllowance { freeUsed: number; freeAvailable: boolean; reason: FreeGenerationBlock | null; paidUnits: number }
export interface GenerationStore {
  /** Choose (or re-choose) the ONE effect of a generations session; returns the anchor preview id. Idempotent. */
  chooseEffect(sessionId: string, userId: string, effectId: string): Promise<string>
  reserveGeneration(i: { sessionId: string; userId: string; key: string; productId: string; geometryKey: string; aspect: string }): Promise<{ generation: GenerationRec; kind: 'free' | 'paid' | 'correction'; reused: boolean }>
  /** The ONE free post-purchase correction of a line: a generation outside the allowance. Idempotent per key; the caller spends the line's correction (useCorrection) once it is delivered. */
  reserveCorrection(i: { sessionId: string; userId: string; key: string; productId: string; geometryKey: string; aspect: string }): Promise<{ generation: GenerationRec; reused: boolean }>
  /** Take the work (lease). null = someone else holds a live lease, it is finished, or its attempts are used up. */
  claimGeneration(id: string, userId: string): Promise<GenerationRec | null>
  completeGeneration(id: string, userId: string, r: { master_path: string; preview_path: string; width: number; height: number; sha256: string; record: Record<string, unknown> }): Promise<boolean>
  failGeneration(id: string, userId: string, error: string): Promise<void>
  acceptGeneration(sessionId: string, userId: string, id: string): Promise<string>
  listGenerations(sessionId: string): Promise<GenerationRec[]>
  getGeneration(sessionId: string, id: string): Promise<GenerationRec | null>
  generationAllowance(sessionId: string, userId: string): Promise<GenerationAllowance>
}

const MISSING = /could not find the function|does not exist|schema cache|relation .* does not exist/i
const CAPS = { p_session_cap: FREE_GENERATIONS.perSession, p_photo_cap: FREE_GENERATIONS.perAccountPhoto, p_24h_cap: FREE_GENERATIONS.perAccount24h, p_total_cap: FREE_GENERATIONS.perAccountLifetime }
const CODES = /order_payment_required|session_not_found|session_expired|order_refunded|refund_pending|order_not_awaiting_artwork|payment_required|invalid_idempotency_key|invalid_effect_selection|effect_not_chosen|effect_fixed|flow_not_generations|legacy_batches_closed|generation_in_progress|generation_not_found|generation_not_ready/

export function supabaseGenerationStore(db: any): GenerationStore {
  const fromRpc = (e: any): never => {
    const msg = String(e?.message ?? '')
    if (MISSING.test(msg) && /gift_generation|gift_choose_effect|gift_reserve_generation|gift_reserve_correction|gift_claim_generation|gift_complete_generation|gift_fail_generation|gift_accept_generation/.test(msg)) throw new StoreError('generations_unavailable')
    const m = CODES.exec(msg)
    if (m) throw new StoreError(m[0] as any)
    throw new Error(msg || 'gift_store_error')
  }
  const rpc = async (fn: string, args: Record<string, unknown>) => { const { data, error } = await db.rpc(fn, args); if (error) fromRpc(error); return data }
  const rows = async (q: any) => { const { data, error } = await q; if (error) { if (MISSING.test(String(error.message))) throw new StoreError('generations_unavailable'); throw new Error(error.message) } return data }
  return {
    async chooseEffect(sessionId, userId, effectId) { return (await rpc('gift_choose_effect', { p_session: sessionId, p_user: userId, p_effect: effectId })) as string },
    async reserveGeneration(i) {
      const data = await rpc('gift_reserve_generation', { p_session: i.sessionId, p_user: i.userId, p_key: i.key, p_product: i.productId, p_geometry: i.geometryKey, p_aspect: i.aspect, ...CAPS, p_max_inflight: MAX_INFLIGHT_GENERATIONS })
      const row = Array.isArray(data) ? data[0] : data
      const generation = (await rows(db.from('gift_generations').select('*').eq('id', row.o_generation_id).single())) as GenerationRec
      return { generation, kind: row.o_kind, reused: !!row.o_reused }
    },
    async reserveCorrection(i) {
      const data = await rpc('gift_reserve_correction', { p_session: i.sessionId, p_user: i.userId, p_key: i.key, p_product: i.productId, p_geometry: i.geometryKey, p_aspect: i.aspect })
      const row = Array.isArray(data) ? data[0] : data
      return { generation: (await rows(db.from('gift_generations').select('*').eq('id', row.o_generation_id).single())) as GenerationRec, reused: !!row.o_reused }
    },
    async claimGeneration(id, userId) {
      const data = await rpc('gift_claim_generation', { p_gen: id, p_user: userId, p_lease_seconds: GENERATION_LEASE_SECONDS, p_max_attempts: GENERATION_MAX_ATTEMPTS })
      const row = Array.isArray(data) ? data[0] : data
      return row?.id ? (row as GenerationRec) : null
    },
    async completeGeneration(id, userId, r) {
      return !!(await rpc('gift_complete_generation', { p_gen: id, p_user: userId, p_master: r.master_path, p_preview: r.preview_path, p_w: r.width, p_h: r.height, p_sha: r.sha256, p_record: r.record }))
    },
    async failGeneration(id, userId, error) { await rpc('gift_fail_generation', { p_gen: id, p_user: userId, p_error: error.slice(0, 200) }) },
    async acceptGeneration(sessionId, userId, id) { return String(await rpc('gift_accept_generation', { p_session: sessionId, p_user: userId, p_gen: id })) },
    async listGenerations(sessionId) { return ((await rows(db.from('gift_generations').select('*').eq('session_id', sessionId).order('created_at'))) ?? []) as GenerationRec[] },
    async getGeneration(sessionId, id) { return ((await rows(db.from('gift_generations').select('*').eq('session_id', sessionId).eq('id', id).maybeSingle())) ?? null) as GenerationRec | null },
    async generationAllowance(sessionId, userId) {
      const data = await rpc('gift_generation_status', { p_session: sessionId, p_user: userId, ...CAPS })
      const row = Array.isArray(data) ? data[0] : data
      return { freeUsed: Number(row?.o_free_used ?? 0), freeAvailable: !!row?.o_free_available, reason: (row?.o_reason ?? null) as FreeGenerationBlock | null, paidUnits: Number(row?.o_paid_units ?? 0) }
    },
  }
}

/** What the memory store shares with this module: the same sessions, previews, packs and free-grant ledger the other rules use. */
export interface MemoryGenerationCtx {
  clock: () => number
  sessions: Map<string, any>; previews: any[]; batches: any[]; packs: any[]; compositions: any[]
  freeGrants: Array<{ user_id: string; source_sha256: string; session_id: string | null; batch_id?: string; generation_id?: string; at: number }>
  owned: (id: string, userId: string) => any
  orderOf: (s: any) => { status: string } | null
}
export function memoryGenerationStore(c: MemoryGenerationCtx): GenerationStore & { generations: GenerationRec[] } {
  const generations: GenerationRec[] = []
  const iso = (ms = c.clock()) => new Date(ms).toISOString()
  const unitsOf = (p: any) => p.units ?? GENERATIONS_PER_PACK
  const usedOfPack = (packId: string, except?: string) => generations.filter(g => g.pack_id === packId && g.status !== 'failed' && g.id !== except).length
  const freeUsed = (sessionId: string, except?: string) => generations.filter(g => g.session_id === sessionId && g.kind === 'free' && g.status !== 'failed' && g.id !== except).length
  const slot = (s: any, except?: string): { kind: 'free' | 'paid'; pack: any | null } => {
    const mine = c.freeGrants.filter(g => g.user_id === s.user_id && g.generation_id !== except)
    if (freeUsed(s.id, except) < FREE_GENERATIONS.perSession && mine.filter(g => g.source_sha256 === s.source_sha256).length < FREE_GENERATIONS.perAccountPhoto &&
        mine.filter(g => c.clock() - g.at < 864e5).length < FREE_GENERATIONS.perAccount24h && mine.length < FREE_GENERATIONS.perAccountLifetime) return { kind: 'free', pack: null }
    const pack = c.packs.find(p => p.user_id === s.user_id && p.status === 'paid' && unitsOf(p) > usedOfPack(p.id, except))
    if (!pack) throw new StoreError('payment_required')
    return { kind: 'paid', pack }
  }
  const takeUnit = (pack: any) => { if (usedOfPack(pack.id) >= unitsOf(pack)) pack.status = 'consumed' }
  return {
    generations,
    async chooseEffect(sessionId, userId, effectId) {
      const s = c.owned(sessionId, userId)
      if (s.status !== 'active' || (Date.parse(s.expires_at) < c.clock() && !s.pinned_at)) throw new StoreError('session_expired')
      if (s.refunded_at) throw new StoreError('order_refunded')
      if (s.refund_requested_at) throw new StoreError('refund_pending')
      if ((s.flow ?? 'previews') !== 'generations' && !s.collection_preview_id) throw new StoreError('flow_not_generations')
      if (!effectId || effectId.length > 80) throw new StoreError('invalid_effect_selection')
      if (s.collection_preview_id) {
        const a = c.previews.find(p => p.id === s.artwork_preview_id && p.effect_id === effectId)
        if (!a) throw new StoreError('effect_fixed')
        return a.id
      }
      const o = c.orderOf(s); if (o && o.status !== 'created') throw new StoreError('order_not_awaiting_artwork')
      let a = c.previews.find(p => p.session_id === sessionId && p.effect_id === effectId)
      if (!a) {
        const n = c.batches.filter(b => b.session_id === sessionId).length + 1
        const batch = { id: randomUUID(), session_id: sessionId, user_id: userId, batch_index: n, kind: 'generation', pack_id: null, idempotency_key: 'generation:' + effectId, effect_ids: [effectId], created_at: iso() }
        c.batches.push(batch)
        a = { id: randomUUID(), batch_id: batch.id, session_id: sessionId, slot: 1, effect_id: effectId, status: 'pending', attempts: 0, lease_until: null, master_path: null, preview_path: null, width: null, height: null, error: null }
        c.previews.push(a)
      }
      if (s.artwork_preview_id !== a.id) {
        for (const x of c.compositions) if (x.session_id === sessionId && x.preview_id !== a.id && (x.status === 'ready' || x.status === 'approved')) x.status = 'superseded'
        s.artwork_preview_id = a.id; s.last_activity_at = iso()
      }
      return a.id
    },
    async reserveGeneration(i) {
      const s = c.owned(i.sessionId, i.userId)
      if (s.status !== 'active' || (Date.parse(s.expires_at) < c.clock() && !s.pinned_at)) throw new StoreError('session_expired')
      if ((s.flow ?? 'previews') !== 'generations' && !s.collection_preview_id) throw new StoreError('flow_not_generations')
      if (s.refunded_at) throw new StoreError('order_refunded')
      if (s.refund_requested_at) throw new StoreError('refund_pending')
      const o = c.orderOf(s); if (o && !['created', 'awaiting_artwork', 'cancelled'].includes(o.status)) throw new StoreError('order_not_awaiting_artwork')
      if (!s.artwork_preview_id) throw new StoreError('effect_not_chosen')
      const anchor = c.previews.find(p => p.id === s.artwork_preview_id)
      if (!i.key || i.key.length < 8 || i.key.length > 80) throw new StoreError('invalid_idempotency_key')
      const same = generations.find(g => g.session_id === i.sessionId && g.idempotency_key === i.key)
      if (same) {
        if (same.status === 'failed') {
          const k = slot(s, same.id)
          Object.assign(same, { status: 'pending', kind: k.kind, pack_id: k.pack?.id ?? null, error: null, lease_until: null, updated_at: iso() })
          if (k.kind === 'free') c.freeGrants.push({ user_id: i.userId, source_sha256: s.source_sha256, session_id: i.sessionId, generation_id: same.id, at: c.clock() })
          if (k.pack) takeUnit(k.pack)
          return { generation: structuredClone(same), kind: k.kind, reused: true }
        }
        return { generation: structuredClone(same), kind: same.kind, reused: true }
      }
      const inflight = generations.filter(g => g.session_id === i.sessionId && (g.status === 'pending' || (g.status === 'generating' && Date.parse(g.lease_until ?? '') > c.clock()))).length
      if (inflight >= MAX_INFLIGHT_GENERATIONS) throw new StoreError('generation_in_progress')
      const k = slot(s)
      const g: GenerationRec = {
        id: randomUUID(), session_id: i.sessionId, user_id: i.userId, anchor_id: anchor.id, effect_id: anchor.effect_id, product_id: i.productId, geometry_key: i.geometryKey, aspect: i.aspect,
        kind: k.kind, pack_id: k.pack?.id ?? null, idempotency_key: i.key, status: 'pending', attempts: 0, lease_until: null, master_path: null, preview_path: null, width: null, height: null,
        sha256: null, generation: null, error: null, accepted_at: null, created_at: iso(), updated_at: iso(),
      }
      generations.push(g)
      if (k.kind === 'free') c.freeGrants.push({ user_id: i.userId, source_sha256: s.source_sha256, session_id: i.sessionId, generation_id: g.id, at: c.clock() })
      if (k.pack) takeUnit(k.pack)
      s.last_activity_at = iso()
      if (!s.pinned_at) s.expires_at = iso(Math.min(Date.parse(s.created_at) + 30 * 864e5, Math.max(Date.parse(s.expires_at), c.clock() + 7 * 864e5)))
      return { generation: structuredClone(g), kind: k.kind, reused: false }
    },
    async reserveCorrection(i) {
      const s = c.owned(i.sessionId, i.userId)
      if (s.status !== 'active') throw new StoreError('session_expired')
      if ((s.flow ?? 'previews') !== 'generations' && !s.collection_preview_id) throw new StoreError('flow_not_generations')
      if (s.refunded_at) throw new StoreError('order_refunded')
      if (s.refund_requested_at) throw new StoreError('refund_pending')
      if (!s.order_id) throw new StoreError('order_payment_required')
      const o = c.orderOf(s); if (!o || o.status !== 'awaiting_artwork' || s.final_approved_at || s.approved_at) throw new StoreError('order_not_awaiting_artwork')
      if (!s.artwork_preview_id) throw new StoreError('effect_not_chosen')
      if (!i.key || i.key.length < 8 || i.key.length > 80) throw new StoreError('invalid_idempotency_key')
      const anchor = c.previews.find(p => p.id === s.artwork_preview_id)
      const same = generations.find(g => g.session_id === i.sessionId && g.idempotency_key === i.key)
      if (same) {
        if (same.kind !== 'correction') throw new StoreError('invalid_idempotency_key')
        if (same.status === 'failed') Object.assign(same, { status: 'pending', error: null, lease_until: null, updated_at: iso() })
        return { generation: structuredClone(same), reused: true }
      }
      const inflight = generations.filter(g => g.session_id === i.sessionId && (g.status === 'pending' || (g.status === 'generating' && Date.parse(g.lease_until ?? '') > c.clock()))).length
      if (inflight >= MAX_INFLIGHT_GENERATIONS) throw new StoreError('generation_in_progress')
      const g: GenerationRec = {
        id: randomUUID(), session_id: i.sessionId, user_id: i.userId, anchor_id: anchor.id, effect_id: anchor.effect_id, product_id: i.productId, geometry_key: i.geometryKey, aspect: i.aspect,
        kind: 'correction', pack_id: null, idempotency_key: i.key, status: 'pending', attempts: 0, lease_until: null, master_path: null, preview_path: null, width: null, height: null,
        sha256: null, generation: null, error: null, accepted_at: null, created_at: iso(), updated_at: iso(),
      }
      generations.push(g)
      return { generation: structuredClone(g), reused: false }
    },
    async claimGeneration(id, userId) {
      const g = generations.find(x => x.id === id); const s = g && c.sessions.get(g.session_id)
      if (!g || !s || g.user_id !== userId || s.status !== 'active') return null
      const lapsed = g.status === 'generating' && Date.parse(g.lease_until ?? '') < c.clock()
      if (g.attempts >= GENERATION_MAX_ATTEMPTS || !(g.status === 'pending' || lapsed)) return null
      Object.assign(g, { status: 'generating', attempts: g.attempts + 1, lease_until: iso(c.clock() + GENERATION_LEASE_SECONDS * 1000), updated_at: iso(), error: null })
      return structuredClone(g)
    },
    async completeGeneration(id, userId, r) {
      const g = generations.find(x => x.id === id); if (!g || g.user_id !== userId || !['generating', 'pending'].includes(g.status)) return false
      Object.assign(g, { status: 'ready', lease_until: null, error: null, master_path: r.master_path, preview_path: r.preview_path, width: r.width, height: r.height, sha256: r.sha256, generation: r.record, updated_at: iso() })
      const a = c.previews.find(p => p.id === g.anchor_id)
      if (a && a.status !== 'ready') Object.assign(a, { status: 'ready', master_path: r.master_path, preview_path: r.preview_path, width: r.width, height: r.height })
      return true
    },
    async failGeneration(id, userId, error) {
      const g = generations.find(x => x.id === id); if (!g || g.user_id !== userId || g.status === 'ready') return
      Object.assign(g, { status: 'failed', lease_until: null, error: error.slice(0, 200), updated_at: iso() })
      const at = c.freeGrants.findIndex(x => x.generation_id === g.id); if (at >= 0) c.freeGrants.splice(at, 1)
      const pack = g.pack_id ? c.packs.find(p => p.id === g.pack_id) : null
      if (pack && pack.status === 'consumed' && !pack.consumed_batch_id && unitsOf(pack) > usedOfPack(pack.id)) pack.status = 'paid'
    },
    async acceptGeneration(sessionId, userId, id) {
      const s = c.owned(sessionId, userId)
      const g = generations.find(x => x.id === id && x.session_id === sessionId); if (!g) throw new StoreError('generation_not_found')
      if (g.status !== 'ready') throw new StoreError('generation_not_ready')
      if (s.refunded_at) throw new StoreError('order_refunded')
      if (s.refund_requested_at) throw new StoreError('refund_pending')
      g.accepted_at ??= iso(); s.last_activity_at = iso()
      return g.accepted_at
    },
    async listGenerations(sessionId) { return generations.filter(g => g.session_id === sessionId).map(g => structuredClone(g)) },
    async getGeneration(sessionId, id) { const g = generations.find(x => x.id === id && x.session_id === sessionId); return g ? structuredClone(g) : null },
    async generationAllowance(sessionId, userId) {
      const s = c.owned(sessionId, userId)
      const mine = c.freeGrants.filter(g => g.user_id === userId)
      const used = freeUsed(sessionId)
      let reason: FreeGenerationBlock | null = null
      if (used >= FREE_GENERATIONS.perSession) reason = 'session_limit'
      else if (mine.filter(g => g.source_sha256 === s.source_sha256).length >= FREE_GENERATIONS.perAccountPhoto) reason = 'photo_limit'
      else if (mine.filter(g => c.clock() - g.at < 864e5).length >= FREE_GENERATIONS.perAccount24h) reason = 'daily_limit'
      else if (mine.length >= FREE_GENERATIONS.perAccountLifetime) reason = 'lifetime_limit'
      const paidUnits = c.packs.filter(p => p.user_id === userId && p.status === 'paid').reduce((n, p) => n + Math.max(0, unitsOf(p) - usedOfPack(p.id)), 0)
      return { freeUsed: used, freeAvailable: reason === null, reason, paidUnits }
    },
  }
}
