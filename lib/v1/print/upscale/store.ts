// lib/v1/print/upscale/store.ts
//
// Persistence for upscale jobs and their files, behind small interfaces so the processor is tested
// without Supabase. The Supabase implementations use only the service-role client and the functions
// from migration 046; nothing here is reachable from a browser.

import { randomUUID } from 'node:crypto'

export type JobStatus =
  | 'queued' | 'preparing' | 'ready_to_submit' | 'submitting' | 'upscaling' | 'finishing' | 'qa'
  | 'approved' | 'review' | 'rejected' | 'failed'

export const WORKING_STATUSES: JobStatus[] = ['queued', 'preparing', 'ready_to_submit', 'submitting', 'upscaling', 'finishing', 'qa']
export const isWorking = (s: JobStatus) => WORKING_STATUSES.includes(s)

export interface JobWarning { code: string; detail: string }
export interface JobEvent { at: string; step: string; note?: string }

export interface AssetJob {
  id: string
  order_id: string
  item_index: number
  revision: number
  render_id: string
  sku: string
  size: string
  finish: string
  source_kind: 'owned' | 'url'
  status: JobStatus
  lease_token: string | null
  lease_until: string | null
  attempts: number
  error: string | null
  settings_snapshot: Record<string, unknown> | null
  settings_hash: string | null
  settings_version: number | null
  source_sha256: string | null
  input_path: string | null
  input_sha256: string | null
  input_w: number | null
  input_h: number | null
  source_ppi: number | null
  warnings: JobWarning[]
  target_mp: number | null
  required_front_w: number | null
  required_front_h: number | null
  required_final_w: number | null
  required_final_h: number | null
  provider: string | null
  submit_state: 'none' | 'submitting' | 'submitted'
  submit_attempts: number
  submit_started_at: string | null
  possible_duplicate: boolean
  prediction_id: string | null
  output_path: string | null
  output_w: number | null
  output_h: number | null
  upscale_ms: number | null
  cost_usd_est: number | null
  cost_basis: string | null
  final_path: string | null
  final_sha256: string | null
  final_w: number | null
  final_h: number | null
  qa: unknown
  qa_verdict: 'pass' | 'uncertain' | 'defect' | 'skipped' | 'error' | null
  review_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  notified_at: string | null
  events: JobEvent[]
  created_at: string
  updated_at: string
}

export type JobPatch = Partial<Omit<AssetJob, 'id' | 'order_id' | 'item_index' | 'revision' | 'created_at'>>

export interface NewJob {
  order_id: string; item_index: number; revision?: number
  render_id: string; sku: string; size: string; finish: string; source_kind: 'owned' | 'url'
}

export interface JobStore {
  /** Idempotent: the same line enqueued twice returns the same job. */
  enqueue(j: NewJob): Promise<AssetJob>
  get(id: string): Promise<AssetJob | null>
  listForOrder(orderId: string): Promise<AssetJob[]>
  /** Jobs that still have work to do and are not leased. */
  listWork(limit: number): Promise<AssetJob[]>
  listByStatus(statuses: JobStatus[], limit: number): Promise<AssetJob[]>
  /** Single-flight: returns the job only if no live lease holds it. */
  lease(id: string, seconds: number, token: string): Promise<AssetJob | null>
  /** Writes only while `token` still holds the lease; null means the lease was lost and nothing was written. */
  update(id: string, token: string, patch: JobPatch): Promise<AssetJob | null>
  /** A person's decision on a held job. Throws unless the job is in review. */
  review(id: string, decision: 'approved' | 'rejected', by: string, note: string): Promise<AssetJob>
  /** Admin retry of a failed job: only from 'failed'. */
  reset(id: string, patch: JobPatch): Promise<AssetJob | null>
}

export interface AssetStorage {
  put(path: string, data: Buffer, contentType: string): Promise<void>
  get(path: string): Promise<Buffer>
  signedUrl(path: string, seconds: number): Promise<string>
}

export const newToken = () => randomUUID()

// ── Supabase ───────────────────────────────────────────────────────────────
const BUCKET = 'print-assets'

/** `db` is the service-role client (lib/supabase supabaseAdmin); passed in so importing this file needs no environment. */
export function supabaseStorage(db: any): AssetStorage {
  return {
    async put(path, data, contentType) {
      const { error } = await db.storage.from(BUCKET).upload(path, data, { contentType, upsert: true })
      if (error) throw new Error(`storage_put_failed:${error.message}`)
    },
    async get(path) {
      const { data, error } = await db.storage.from(BUCKET).download(path)
      if (error || !data) throw new Error(`storage_get_failed:${error?.message ?? 'empty'}`)
      return Buffer.from(await data.arrayBuffer())
    },
    async signedUrl(path, seconds) {
      const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, seconds)
      if (error || !data?.signedUrl) throw new Error(`storage_sign_failed:${error?.message ?? 'none'}`)
      return data.signedUrl
    },
  }
}

export function supabaseJobStore(db: any): JobStore {
  const one = async (q: PromiseLike<{ data: any; error: any }>) => { const { data, error } = await q; if (error) throw new Error(error.message); return data }
  return {
    async enqueue(j) {
      const data = await one(db.rpc('enqueue_print_asset_job', {
        p_order: j.order_id, p_index: j.item_index, p_render: j.render_id, p_sku: j.sku, p_size: j.size,
        p_finish: j.finish, p_source_kind: j.source_kind, p_revision: j.revision ?? 0 }))
      return data as AssetJob
    },
    async get(id) { return (await one(db.from('print_asset_jobs').select('*').eq('id', id).maybeSingle())) ?? null },
    async listForOrder(orderId) { return (await one(db.from('print_asset_jobs').select('*').eq('order_id', orderId).order('item_index'))) ?? [] },
    async listWork(limit) {
      const now = new Date().toISOString()
      return (await one(db.from('print_asset_jobs').select('*').in('status', WORKING_STATUSES)
        .or(`lease_until.is.null,lease_until.lt.${now}`).order('updated_at').limit(limit))) ?? []
    },
    async listByStatus(statuses, limit) {
      return (await one(db.from('print_asset_jobs').select('*').in('status', statuses).order('created_at').limit(limit))) ?? []
    },
    async lease(id, seconds, token) { return (await one(db.rpc('lease_print_asset_job', { p_id: id, p_seconds: seconds, p_token: token }))) ?? null },
    async update(id, token, patch) {
      const data = await one(db.from('print_asset_jobs').update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id).eq('lease_token', token).select('*').maybeSingle())
      return data ?? null
    },
    async review(id, decision, by, note) { return (await one(db.rpc('review_print_asset_job', { p_id: id, p_decision: decision, p_by: by, p_note: note }))) as AssetJob },
    async reset(id, patch) {
      return (await one(db.from('print_asset_jobs').update({ ...patch, lease_token: null, lease_until: null, updated_at: new Date().toISOString() })
        .eq('id', id).eq('status', 'failed').select('*').maybeSingle())) ?? null
    },
  }
}

// ── In memory (tests) ──────────────────────────────────────────────────────
export function memoryStorage(): AssetStorage & { files: Map<string, Buffer> } {
  const files = new Map<string, Buffer>()
  return {
    files,
    async put(p, d) { files.set(p, Buffer.from(d)) },
    async get(p) { const b = files.get(p); if (!b) throw new Error('storage_get_failed:missing'); return Buffer.from(b) },
    async signedUrl(p, s) { return `https://signed.test/sign/print-assets/${p}?token=${s}` },
  }
}

export function memoryJobStore(clock: () => number = Date.now): JobStore & { jobs: Map<string, AssetJob> } {
  const jobs = new Map<string, AssetJob>()
  const iso = () => new Date(clock()).toISOString()
  const blank = (j: NewJob): AssetJob => ({
    id: randomUUID(), order_id: j.order_id, item_index: j.item_index, revision: j.revision ?? 0, render_id: j.render_id,
    sku: j.sku, size: j.size, finish: j.finish, source_kind: j.source_kind, status: 'queued', lease_token: null, lease_until: null,
    attempts: 0, error: null, settings_snapshot: null, settings_hash: null, settings_version: null, source_sha256: null,
    input_path: null, input_sha256: null, input_w: null, input_h: null, source_ppi: null, warnings: [], target_mp: null,
    required_front_w: null, required_front_h: null, required_final_w: null, required_final_h: null, provider: null,
    submit_state: 'none', submit_attempts: 0, submit_started_at: null, possible_duplicate: false, prediction_id: null,
    output_path: null, output_w: null, output_h: null, upscale_ms: null, cost_usd_est: null, cost_basis: null,
    final_path: null, final_sha256: null, final_w: null, final_h: null, qa: null, qa_verdict: null, review_reason: null,
    reviewed_by: null, reviewed_at: null, review_note: null, notified_at: null, events: [], created_at: iso(), updated_at: iso(),
  })
  const copy = (j: AssetJob) => structuredClone(j)
  return {
    jobs,
    async enqueue(j) {
      const found = [...jobs.values()].find(x => x.order_id === j.order_id && x.item_index === j.item_index && x.revision === (j.revision ?? 0))
      if (found) return copy(found)
      const n = blank(j); jobs.set(n.id, n); return copy(n)
    },
    async get(id) { const j = jobs.get(id); return j ? copy(j) : null },
    async listForOrder(o) { return [...jobs.values()].filter(j => j.order_id === o).sort((a, b) => a.item_index - b.item_index).map(copy) },
    async listWork(limit) {
      return [...jobs.values()].filter(j => isWorking(j.status) && (!j.lease_until || Date.parse(j.lease_until) < clock())).slice(0, limit).map(copy)
    },
    async listByStatus(s, limit) { return [...jobs.values()].filter(j => s.includes(j.status)).slice(0, limit).map(copy) },
    async lease(id, seconds, token) {
      const j = jobs.get(id)
      if (!j || !isWorking(j.status) || (j.lease_until && Date.parse(j.lease_until) >= clock())) return null
      j.lease_token = token; j.lease_until = new Date(clock() + seconds * 1000).toISOString(); j.attempts++; j.updated_at = iso()
      return copy(j)
    },
    async update(id, token, patch) {
      const j = jobs.get(id)
      if (!j || j.lease_token !== token) return null
      Object.assign(j, patch, { updated_at: iso() }); return copy(j)
    },
    async review(id, decision, by, note) {
      const j = jobs.get(id)
      if (!j || j.status !== 'review') throw new Error('job_not_in_review')
      Object.assign(j, { status: decision, reviewed_by: by, reviewed_at: iso(), review_note: note.slice(0, 1000), lease_token: null, lease_until: null, updated_at: iso() })
      return copy(j)
    },
    async reset(id, patch) {
      const j = jobs.get(id)
      if (!j || j.status !== 'failed') return null
      Object.assign(j, patch, { lease_token: null, lease_until: null, updated_at: iso() }); return copy(j)
    },
  }
}
