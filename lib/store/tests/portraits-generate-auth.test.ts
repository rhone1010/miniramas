// lib/store/tests/portraits-generate-auth.test.ts
//
// The REAL POST /api/v1/portraits/generate, end to end through its
// authorization, with only NB2, the age check, the session and the database
// faked.
//
// Before this, the route returned a clean image to anyone who left out
// is_preview, and the credit charge happened in a separate call it never
// looked at. Now clean output needs the internal secret (Discovery's server
// render) or a signed-in owner with a single-use grant from /credits/gate
// (Portraits in the browser).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeSupabase } from './helpers/fake-supabase'

const h = vi.hoisted(() => ({
  fake: null as any,
  user: null as null | { id: string },
  render: vi.fn(),
}))

vi.mock('@supabase/supabase-js', async (orig) => ({
  ...(await orig<any>()),
  createClient: () => h.fake.sb,
}))
vi.mock('@/lib/store/auth', () => ({ getUser: async () => h.user }))
vi.mock('@/lib/v1/portraits/portraits-generator', () => ({
  generatePortraitsRender: (...a: any[]) => h.render(...a),
  callNB2: vi.fn(),
}))
vi.mock('@/lib/v1/portraits/portraits-refine', () => ({
  detectFaceVisibility: async () => ({ age_group: 'adult', gender: 'f', face_visible: true, subject_count: 1 }),
}))

import { POST } from '@/app/api/v1/portraits/generate/route'
import { PRESET_LABELS, STYLE_PIPELINE } from '@/lib/v1/portraits/portraits-shared'
import { canonicalResultPath } from '@/lib/store/generation-grants'

const OWNER = 'owner-1'
const G = '11111111-1111-4111-8111-111111111111'
const PRESET = Object.keys(PRESET_LABELS)[0]
const STYLE = Object.keys(STYLE_PIPELINE)[0]
const IMG = Buffer.from('a-clean-render').toString('base64')
const SOURCE = Buffer.from('source-photo').toString('base64')

function req(body: any, headers: Record<string, string> = {}) {
  return new Request('https://litenco.com/api/v1/portraits/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as any
}
const paid = (extra: any = {}) => ({ source_image_b64: SOURCE, style_id: STYLE, preset: PRESET, grant_id: G, ...extra })
const grantRow = (over: any = {}) => ({
  id: G, ref_id: 'craft_1', unit: 0, owner_key: OWNER, series: 'portraits', preset: PRESET,
  cost_credits: 10, status: 'issued', claim_token: null, claimed_at: null, result_path: null, attempts: 0, ...over,
})

beforeEach(() => {
  process.env.CRON_SECRET = 'cron-secret-for-tests'
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-for-tests'
  process.env.REPLICATE_API_TOKEN = 'replicate-for-tests'
  delete process.env.OPENAI_API_KEY          // QA layer off: it needs both sb and this
  h.fake = fakeSupabase({ tables: { generation_grants: [grantRow()] } })
  h.user = { id: OWNER }
  h.render.mockReset()
  h.render.mockResolvedValue({ ok: true, image_b64: IMG, attempts: [{ passed: true }], final_pass: true })
})

// -- refused before any work ------------------------------------------------

describe('refused before any NB2 work', () => {
  it('experimental_effect is closed -- even with the internal secret', async () => {
    const res = await POST(req({ ...paid(), experimental_effect: 'anything' }, { authorization: 'Bearer cron-secret-for-tests' }))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'experimental_effect_disabled' })
    expect(h.render).not.toHaveBeenCalled()
  })

  it('the anonymous free preview is closed', async () => {
    h.user = null
    const res = await POST(req({ source_image_b64: SOURCE, style_id: STYLE, preset: PRESET, is_preview: true, preview_email: 'a@b.co' }))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'preview_disabled' })
    expect(h.render).not.toHaveBeenCalled()
  })

  it('no session, no secret: 401, and no image', async () => {
    h.user = null
    const res = await POST(req({ source_image_b64: SOURCE, style_id: STYLE, preset: PRESET }))
    expect(res.status).toBe(401)
    expect(h.render).not.toHaveBeenCalled()
  })

  it('a signed-in caller with no grant: 403 grant_required', async () => {
    const res = await POST(req({ source_image_b64: SOURCE, style_id: STYLE, preset: PRESET }))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'grant_required' })
    expect(h.render).not.toHaveBeenCalled()
  })

  it("someone else's grant is refused", async () => {
    h.user = { id: 'intruder' }
    const res = await POST(req(paid()))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'grant_invalid' })
    expect(h.render).not.toHaveBeenCalled()
  })

  it('a wrong bearer is not the internal secret', async () => {
    h.user = null
    const res = await POST(req({ source_image_b64: SOURCE, style_id: STYLE, preset: PRESET }, { authorization: 'Bearer guess' }))
    expect(res.status).toBe(401)
    expect(h.render).not.toHaveBeenCalled()
  })

  it('the catalogue bake still needs its own token', async () => {
    const res = await POST(req({ source_image_b64: SOURCE, style_id: STYLE, preset: PRESET, is_preview_bake: true, preview_bake_path: 'previews/x.jpg' }))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'preview_bake_forbidden' })
  })
})

// -- Discovery: internal ------------------------------------------------------

describe('internal (Discovery portfolio render) -- behaviourally unchanged', () => {
  it('the CRON_SECRET bearer gets a clean image with no grant and no session', async () => {
    h.user = null
    const res = await POST(req({ source_image_b64: SOURCE, style_id: STYLE, preset_id: PRESET, framing: 'bust', scale: 'close_up' },
      { authorization: 'Bearer cron-secret-for-tests' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.ok).toBe(true)
    expect(body.result.image_b64).toBe(IMG)
    expect(h.render).toHaveBeenCalledTimes(1)
    expect(h.fake.calls.uploads).toEqual([])                   // no grant, nothing persisted here
    expect(h.fake.row('generation_grants', G).status).toBe('issued')
  })
})

// -- Portraits: a paid grant --------------------------------------------------

describe('a paid Portraits render', () => {
  it('claim -> render -> persist -> consume -> image', async () => {
    const res = await POST(req(paid()))
    expect(res.status).toBe(200)
    expect((await res.json()).result.image_b64).toBe(IMG)
    expect(h.render).toHaveBeenCalledTimes(1)
    expect(h.fake.calls.uploads).toEqual([{ path: canonicalResultPath(G), upsert: false }])
    const g = h.fake.row('generation_grants', G)
    expect([g.status, g.result_path, g.attempts]).toEqual(['consumed', canonicalResultPath(G), 1])
  })

  it('if the canonical result cannot be persisted: 503, NO image, grant back to issued', async () => {
    h.fake.fault({ op: 'upload' })
    const res = await POST(req(paid()))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body).toEqual({ error: 'result_persist_failed', retryable: true })
    expect(JSON.stringify(body)).not.toContain(IMG)
    expect(h.fake.row('generation_grants', G).status).toBe('issued')
  })

  it('a failed render returns the failure and releases the grant', async () => {
    h.render.mockResolvedValue({ ok: false, fatal_error: 'nb2 said no', attempts: [] })
    const res = await POST(req(paid()))
    expect(res.status).toBe(200)
    expect((await res.json()).result.fatal_error).toBe('nb2 said no')
    expect(h.fake.row('generation_grants', G).status).toBe('issued')
    expect(h.fake.calls.uploads).toEqual([])
  })

  it('a render that throws releases the grant', async () => {
    h.render.mockRejectedValue(new Error('boom'))
    const res = await POST(req(paid()))
    expect(res.status).toBe(500)
    expect(h.fake.row('generation_grants', G).status).toBe('issued')
  })

  it('a validation refusal after the claim releases the grant', async () => {
    const res = await POST(req(paid({ style_id: 'no-such-style' })))
    expect(res.status).toBe(400)
    expect(h.fake.row('generation_grants', G).status).toBe('issued')
    expect(h.render).not.toHaveBeenCalled()
  })

  it('a replay of a delivered grant re-delivers, with no second render', async () => {
    await POST(req(paid()))
    h.render.mockResolvedValue({ ok: true, image_b64: Buffer.from('DIFFERENT').toString('base64'), attempts: [] })
    const again = await POST(req(paid()))
    expect(again.status).toBe(200)
    const body = await again.json()
    expect(body.redelivered).toBe(true)
    expect(body.result.image_b64).toBe(IMG)                     // the canonical image, not a new one
    expect(h.render).toHaveBeenCalledTimes(1)
  })

  it('a refunded grant cannot render', async () => {
    h.fake.row('generation_grants', G).status = 'refunded'
    const res = await POST(req(paid()))
    expect(res.status).toBe(409)
    expect(h.render).not.toHaveBeenCalled()
  })

  it('a grant for another preset cannot render this one', async () => {
    const other = Object.keys(PRESET_LABELS)[1]
    const res = await POST(req(paid({ preset: other })))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'grant_mismatch' })
  })
})
