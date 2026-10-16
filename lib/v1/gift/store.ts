// lib/v1/gift/store.ts
//
// Persistence for Gift Wizard sessions, batches, previews and paid packs, behind one interface so the service is tested
// without a database. The Supabase implementation delegates every rule that must be atomic (reserving a batch, consuming
// a pack, leasing a preview) to the functions in migration 047, which migration-047.test.ts runs against real Postgres.
// The memory implementation mirrors those rules for the service tests.

import { randomUUID } from 'node:crypto'
import { FREE_BATCHES } from './policy'
import type { BatchKind, GiftLine, PreviewStatus, Series } from './types'

export interface SessionRec {
  id: string; user_id: string; status: 'active' | 'expired' | 'deleted'
  source_path: string | null; source_sha256: string; source_width: number; source_height: number
  series: Series | null; analysis: { peopleCount?: number | null; [k: string]: unknown }
  lines: GiftLine[]; master_aspect: string | null
  created_at: string; last_activity_at: string; expires_at: string; pinned_at: string | null
}
export interface BatchRec { id: string; session_id: string; user_id: string; batch_index: number; kind: BatchKind; pack_id: string | null; idempotency_key: string; effect_ids: string[]; created_at: string }
export interface PreviewRec {
  id: string; batch_id: string; session_id: string; slot: number; effect_id: string; status: PreviewStatus; attempts: number
  lease_until: string | null; master_path: string | null; preview_path: string | null; width: number | null; height: number | null; error: string | null
}
export type StoreErrorCode = 'session_not_found' | 'session_expired' | 'payment_required' | 'previous_batch_incomplete' | 'effect_already_used' | 'six_distinct_effects_required'
export class StoreError extends Error { constructor(public code: StoreErrorCode) { super(code) } }

export interface GiftStore {
  createSession(rec: SessionRec): Promise<void>
  getSession(id: string, userId: string): Promise<SessionRec | null>
  patchSession(id: string, userId: string, patch: Partial<Pick<SessionRec, 'lines' | 'master_aspect' | 'source_path' | 'expires_at' | 'last_activity_at'>>): Promise<void>
  listBatches(sessionId: string): Promise<Array<{ batch: BatchRec; previews: PreviewRec[] }>>
  reserveBatch(i: { sessionId: string; userId: string; key: string; effects: string[] }): Promise<{ batch: BatchRec; reused: boolean }>
  claimPreview(previewId: string, userId: string): Promise<PreviewRec | null>
  markReady(previewId: string, r: { master_path: string; preview_path: string; width: number; height: number }): Promise<void>
  markFailed(previewId: string, error: string): Promise<void>
  paidPackCount(userId: string): Promise<number>
  fulfillPack(userId: string, stripeSessionId: string, amountCents: number): Promise<string>
  expiredSessions(nowIso: string, limit: number): Promise<SessionRec[]>
  deleteSession(id: string): Promise<void>
}

// ── Supabase ────────────────────────────────────────────────────────────

export function supabaseGiftStore(db: any): GiftStore {
  const one = async (q: any) => { const { data, error } = await q; if (error) throw new Error(error.message); return data }
  const fromRpc = (e: any): never => {
    const m = /session_not_found|session_expired|payment_required|previous_batch_incomplete|effect_already_used|six_distinct_effects_required/.exec(String(e?.message ?? ''))
    if (m) throw new StoreError(m[0] as StoreErrorCode)
    throw new Error(String(e?.message ?? 'gift_store_error'))
  }
  return {
    async createSession(rec) { await one(db.from('gift_sessions').insert(rec)) },
    async getSession(id, userId) { return await one(db.from('gift_sessions').select('*').eq('id', id).eq('user_id', userId).neq('status', 'deleted').maybeSingle()) },
    async patchSession(id, userId, patch) { await one(db.from('gift_sessions').update(patch).eq('id', id).eq('user_id', userId)) },
    async listBatches(sessionId) {
      const batches: BatchRec[] = (await one(db.from('gift_batches').select('*').eq('session_id', sessionId).order('batch_index'))) ?? []
      const previews: PreviewRec[] = (await one(db.from('gift_previews').select('*').eq('session_id', sessionId).order('slot'))) ?? []
      return batches.map(batch => ({ batch, previews: previews.filter(p => p.batch_id === batch.id) }))
    },
    async reserveBatch({ sessionId, userId, key, effects }) {
      const { data, error } = await db.rpc('gift_reserve_batch', { p_session: sessionId, p_user: userId, p_key: key, p_effects: effects, p_free: FREE_BATCHES })
      if (error) fromRpc(error)
      const row = Array.isArray(data) ? data[0] : data
      const batch: BatchRec = await one(db.from('gift_batches').select('*').eq('id', row.o_batch_id).single())
      return { batch, reused: !!row.o_reused }
    },
    async claimPreview(previewId, userId) {
      const { data, error } = await db.rpc('gift_claim_preview', { p_preview: previewId, p_user: userId })
      if (error) throw new Error(error.message)
      const row = Array.isArray(data) ? data[0] : data
      return row?.id ? (row as PreviewRec) : null
    },
    async markReady(previewId, r) {
      await one(db.from('gift_previews').update({ ...r, status: 'ready', lease_until: null, error: null, updated_at: new Date().toISOString() }).eq('id', previewId))
    },
    async markFailed(previewId, error) {
      await one(db.from('gift_previews').update({ status: 'failed', lease_until: null, error: error.slice(0, 200), updated_at: new Date().toISOString() }).eq('id', previewId).neq('status', 'ready'))
    },
    async paidPackCount(userId) {
      const { count, error } = await db.from('gift_preview_packs').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'paid')
      if (error || count === null) throw new Error('pack_balance_unavailable')
      return count
    },
    async fulfillPack(userId, stripeSessionId, amountCents) {
      const { data, error } = await db.rpc('gift_fulfill_preview_pack', { p_user: userId, p_stripe_session: stripeSessionId, p_amount: amountCents })
      if (error) throw new Error(error.message)
      return data as string
    },
    async expiredSessions(nowIso, limit) {
      return (await one(db.from('gift_sessions').select('*').eq('status', 'active').is('pinned_at', null).lt('expires_at', nowIso).limit(limit))) ?? []
    },
    async deleteSession(id) { await one(db.from('gift_sessions').delete().eq('id', id)) },
  }
}

// ── Memory (tests) ──────────────────────────────────────────────────────

export function memoryGiftStore(clock: () => number = Date.now): GiftStore & { sessions: Map<string, SessionRec>; batches: BatchRec[]; previews: PreviewRec[]; packs: Array<{ id: string; user_id: string; stripe_session_id: string; amount_cents: number; status: 'paid' | 'consumed' }> } {
  const sessions = new Map<string, SessionRec>(), batches: BatchRec[] = [], previews: PreviewRec[] = []
  const packs: Array<{ id: string; user_id: string; stripe_session_id: string; amount_cents: number; status: 'paid' | 'consumed' }> = []
  const iso = (ms = clock()) => new Date(ms).toISOString()
  return {
    sessions, batches, previews, packs,
    async createSession(rec) { sessions.set(rec.id, structuredClone(rec)) },
    async getSession(id, userId) { const s = sessions.get(id); return s && s.user_id === userId && s.status !== 'deleted' ? structuredClone(s) : null },
    async patchSession(id, userId, patch) { const s = sessions.get(id); if (s && s.user_id === userId) Object.assign(s, structuredClone(patch)) },
    async listBatches(sessionId) {
      return batches.filter(b => b.session_id === sessionId).sort((a, b) => a.batch_index - b.batch_index)
        .map(batch => ({ batch: structuredClone(batch), previews: previews.filter(p => p.batch_id === batch.id).sort((a, b) => a.slot - b.slot).map(p => structuredClone(p)) }))
    },
    async reserveBatch({ sessionId, userId, key, effects }) {
      const s = sessions.get(sessionId)
      if (!s || s.user_id !== userId) throw new StoreError('session_not_found')
      if (s.status !== 'active' || Date.parse(s.expires_at) < clock()) throw new StoreError('session_expired')
      const same = batches.find(b => b.session_id === sessionId && b.idempotency_key === key)
      if (same) return { batch: structuredClone(same), reused: true }
      if (effects.length !== 6 || new Set(effects).size !== 6) throw new StoreError('six_distinct_effects_required')
      if (previews.some(p => p.session_id === sessionId && effects.includes(p.effect_id))) throw new StoreError('effect_already_used')
      if (previews.some(p => p.session_id === sessionId && p.status !== 'ready')) throw new StoreError('previous_batch_incomplete')
      const n = batches.filter(b => b.session_id === sessionId).length
      let kind: BatchKind = 'free', packId: string | null = null
      if (n >= FREE_BATCHES) {
        const pack = packs.find(p => p.user_id === userId && p.status === 'paid')
        if (!pack) throw new StoreError('payment_required')
        kind = 'paid'; packId = pack.id; pack.status = 'consumed'
      }
      const batch: BatchRec = { id: randomUUID(), session_id: sessionId, user_id: userId, batch_index: n + 1, kind, pack_id: packId, idempotency_key: key, effect_ids: [...effects], created_at: iso() }
      batches.push(batch)
      effects.forEach((effect_id, i) => previews.push({ id: randomUUID(), batch_id: batch.id, session_id: sessionId, slot: i + 1, effect_id, status: 'pending', attempts: 0, lease_until: null, master_path: null, preview_path: null, width: null, height: null, error: null }))
      s.last_activity_at = iso(); s.expires_at = iso(Math.min(Date.parse(s.created_at) + 30 * 864e5, Math.max(Date.parse(s.expires_at), clock() + 7 * 864e5)))
      return { batch: structuredClone(batch), reused: false }
    },
    async claimPreview(previewId, userId) {
      const p = previews.find(x => x.id === previewId); const s = p && sessions.get(p.session_id)
      if (!p || !s || s.user_id !== userId || s.status !== 'active') return null
      const lapsed = p.status === 'generating' && p.lease_until !== null && Date.parse(p.lease_until) < clock()
      if (p.attempts >= 3 || !(p.status === 'pending' || p.status === 'failed' || lapsed)) return null
      p.status = 'generating'; p.attempts += 1; p.lease_until = iso(clock() + 300_000); p.error = null
      return structuredClone(p)
    },
    async markReady(previewId, r) { const p = previews.find(x => x.id === previewId)!; Object.assign(p, r, { status: 'ready', lease_until: null, error: null }) },
    async markFailed(previewId, error) { const p = previews.find(x => x.id === previewId)!; if (p.status !== 'ready') Object.assign(p, { status: 'failed', lease_until: null, error }) },
    async paidPackCount(userId) { return packs.filter(p => p.user_id === userId && p.status === 'paid').length },
    async fulfillPack(userId, stripeSessionId, amountCents) {
      const existing = packs.find(p => p.stripe_session_id === stripeSessionId); if (existing) return existing.id
      const id = randomUUID(); packs.push({ id, user_id: userId, stripe_session_id: stripeSessionId, amount_cents: amountCents, status: 'paid' }); return id
    },
    async expiredSessions(nowIso, limit) { return [...sessions.values()].filter(s => s.status === 'active' && !s.pinned_at && s.expires_at < nowIso).slice(0, limit).map(s => structuredClone(s)) },
    async deleteSession(id) {
      sessions.delete(id)
      for (let i = batches.length - 1; i >= 0; i--) if (batches[i].session_id === id) batches.splice(i, 1)
      for (let i = previews.length - 1; i >= 0; i--) if (previews[i].session_id === id) previews.splice(i, 1)
    },
  }
}
