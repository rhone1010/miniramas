import { describe, it, expect, vi, beforeEach } from 'vitest'
import { memoryJobStore, memoryStorage } from './store'

const s = vi.hoisted(() => ({
  admin: true, upserts: [] as any[], deletes: [] as any[], current: null as any, store: null as any, storage: null as any, complete: vi.fn(), rows: [] as any[],
}))
vi.mock('@/lib/admin/auth', () => ({ isAdmin: async () => s.admin }))
vi.mock('@/lib/v1/print/complete', () => ({ completePrintOrder: s.complete }))
vi.mock('./runtime', () => ({ assetRuntime: () => ({ store: s.store, storage: s.storage }) }))
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: (t: string) => {
    const q: any = {
      select: () => q, eq: () => q, order: () => q, limit: async () => ({ data: s.rows, error: null }),
      maybeSingle: async () => ({ data: s.current, error: null }),
      upsert: async (row: any) => { s.upserts.push({ t, row }); return { error: null } },
      delete: () => ({ eq: async (_c: string, v: string) => { s.deletes.push({ t, v }); return { error: null } } }),
      then: (r: any) => r({ data: s.rows, error: null }),
    }
    return q } },
}))
import { POST as settingsPost } from '../../../../app/api/admin/settings/route'
import { GET as assetsGet, POST as assetsPost } from '../../../../app/api/admin/print-assets/route'

const post = (url: string, body: unknown) => new Request('http://x' + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

beforeEach(() => { s.admin = true; s.upserts = []; s.deletes = []; s.current = { version: 3 }; s.rows = []; s.complete.mockReset().mockResolvedValue({ status: 'placed' }); s.store = memoryJobStore(); s.storage = memoryStorage() })

describe('settings write path (existing admin gate)', () => {
  it('requires the admin session', async () => {
    s.admin = false
    expect((await settingsPost(post('/api/admin/settings', { kind: 'print_upscale', scope: 'global', patch: { provider: 'pruna' } }))).status).toBe(401)
    expect(s.upserts).toHaveLength(0)
  })
  it('writes a validated patch and bumps the version', async () => {
    const r = await settingsPost(post('/api/admin/settings', { kind: 'print_upscale', scope: 'family:canvas', patch: { enhance_details: true, output_quality: null } }))
    expect(r.status).toBe(200)
    expect(s.upserts[0]).toMatchObject({ t: 'print_upscale_settings', row: { scope: 'family:canvas', enhance_details: true, output_quality: null, version: 4, updated_by: 'control-panel' } })
  })
  it('rejects unknown keys (including anything credential-like), bad values and bad scopes', async () => {
    for (const body of [
      { kind: 'print_upscale', scope: 'global', patch: { replicate_token: 'x' } }, { kind: 'print_upscale', scope: 'global', patch: { provider: 'other' } },
      { kind: 'print_upscale', scope: 'global', patch: { output_quality: null } }, { kind: 'print_upscale', scope: "sku:x'; drop", patch: { provider: 'pruna' } },
      { kind: 'print_upscale', scope: 'global', patch: {} }, { kind: 'print_upscale_clear', scope: 'global' },
    ]) expect((await settingsPost(post('/api/admin/settings', body))).status).toBe(400)
    expect(s.upserts).toHaveLength(0); expect(s.deletes).toHaveLength(0)
  })
  it('will not create a missing global row, and can remove an override', async () => {
    s.current = null
    expect((await settingsPost(post('/api/admin/settings', { kind: 'print_upscale', scope: 'global', patch: { provider: 'pruna' } }))).status).toBe(409)
    expect((await settingsPost(post('/api/admin/settings', { kind: 'print_upscale_clear', scope: 'sku:GLOBAL-CAN-8X8' }))).status).toBe(200)
    expect(s.deletes).toEqual([{ t: 'print_upscale_settings', v: 'sku:GLOBAL-CAN-8X8' }])
  })
  it('the existing settings kinds still work (not broken by the addition)', async () => {
    expect((await settingsPost(post('/api/admin/settings', { kind: 'nonsense' }))).status).toBe(400)
  })
})

describe('review queue', () => {
  const held = async (status: 'review' | 'failed', over: object = {}) => {
    const j = await s.store.enqueue({ order_id: 'o1', item_index: 0, render_id: 'r', sku: 'GLOBAL-FAP-8X8', size: '8x8', finish: 'fine_art', source_kind: 'owned' })
    Object.assign(s.store.jobs.get(j.id)!, { status, final_path: `${j.id}/final.jpg`, final_sha256: 'a'.repeat(64), input_path: `${j.id}/composition.png`, review_reason: 'qa_uncertain', ...over })
    return j.id as string
  }
  it('is closed to everyone but the admin', async () => {
    s.admin = false
    expect((await assetsGet()).status).toBe(401)
    expect((await assetsPost(post('/api/admin/print-assets', { action: 'review', job_id: 'x' }))).status).toBe(401)
  })
  it('lists held jobs with short-lived links and exposes no storage paths or keys', async () => {
    await held('review'); await s.storage.put(`${[...s.store.jobs.keys()][0]}/review-result.jpg`, Buffer.from('x'), 'image/jpeg')
    const body = await (await assetsGet()).json()
    expect(body.queue).toHaveLength(1); expect(body.queue[0].links.result_preview).toContain('token=3600')
    expect(JSON.stringify(body)).not.toMatch(/final_path|input_path|REPLICATE|PRUNA|apikey/i)
  })
  it('approval records the decision, then tries to place the order', async () => {
    const id = await held('review')
    const r = await assetsPost(post('/api/admin/print-assets', { action: 'review', job_id: id, decision: 'approved', note: 'looks right' }))
    expect(await r.json()).toMatchObject({ ok: true, status: 'approved', order: { status: 'placed' } })
    expect(s.store.jobs.get(id)).toMatchObject({ status: 'approved', reviewed_by: 'control-panel', review_note: 'looks right' }); expect(s.complete).toHaveBeenCalledWith('o1')
  })
  it('rejection never places anything', async () => {
    const id = await held('review')
    expect((await (await assetsPost(post('/api/admin/print-assets', { action: 'review', job_id: id, decision: 'rejected' }))).json()).status).toBe('rejected')
    expect(s.complete).not.toHaveBeenCalled()
  })
  it('cannot approve a job with no print file, a job not in review, or a bad id', async () => {
    const noFile = await held('review', { final_path: null })
    expect((await assetsPost(post('/api/admin/print-assets', { action: 'review', job_id: noFile, decision: 'approved' }))).status).toBe(409)
    const failed = await held('failed'); s.store.jobs.get(failed)!.item_index = 1
    expect((await assetsPost(post('/api/admin/print-assets', { action: 'review', job_id: failed, decision: 'approved' }))).status).toBe(409)
    expect((await assetsPost(post('/api/admin/print-assets', { action: 'review', job_id: 'not-a-uuid', decision: 'approved' }))).status).toBe(400)
    expect(s.complete).not.toHaveBeenCalled()
  })
  it('resets only a failed job, resuming from its last saved step with counters cleared', async () => {
    const id = await held('failed', { error: 'x', final_path: null, output_path: 'o', submit_attempts: 3, attempts: 9 })
    const r = await assetsPost(post('/api/admin/print-assets', { action: 'reset', job_id: id }))
    expect(await r.json()).toMatchObject({ ok: true, status: 'finishing' })
    expect(s.store.jobs.get(id)).toMatchObject({ submit_attempts: 0, attempts: 0, error: null }); expect(s.store.jobs.get(id)!.events.at(-1)!.step).toBe('admin_reset')
    const live = await held('review'); s.store.jobs.get(live)!.item_index = 4
    expect((await assetsPost(post('/api/admin/print-assets', { action: 'reset', job_id: live }))).status).toBe(409)
  })
})
