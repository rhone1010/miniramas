// The Preview readiness diagnostic: authenticated, read-only, secret-free, and it reuses the pipeline's own gate.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const s = vi.hoisted(() => ({ user: { id: 'u1' } as any, settingsRow: { data: { provider: 'replicate', qa_enabled: true }, error: null } as any, jobsErr: null as any, rpcErr: null as any, bucketErr: null as any }))
vi.mock('@/lib/store/auth', () => ({ getUser: async () => s.user }))
vi.mock('@/lib/supabase', () => {
  const chain = (result: any): any => { const c: any = { select: () => c, eq: () => c, maybeSingle: async () => result, limit: async () => result }; return c }
  return { supabaseAdmin: {
    storage: { getBucket: async () => ({ error: s.bucketErr }) },
    from: (t: string) => t === 'print_upscale_settings' ? chain(s.settingsRow) : chain({ data: [], error: t === 'print_asset_jobs' ? s.jobsErr : null }),
    rpc: async () => ({ data: null, error: s.rpcErr }),
  } }
})
vi.mock('@/lib/v1/print/db', () => ({ canFulfil: async () => true }))
vi.mock('@/lib/v1/print/stripe-client', () => ({ getStripe: () => ({ webhookEndpoints: { list: async () => ({ data: [] }) } }) }))
vi.mock('@/lib/v1/print/prodigi-client', async () => ({ ...(await vi.importActual<typeof import('../prodigi-client')>('../prodigi-client')), getProduct: async () => ({ outcome: 'Ok' }) }))
import { GET } from '../../../../app/api/v1/print/source/route'
import { resetPipelineCache } from './pipeline'

const SECRETS = { REPLICATE_API_TOKEN: 'r8_SECRETREPLICATE12345', OPENAI_API_KEY: 'sk-SECRETOPENAI12345', CRON_SECRET: 'SECRETCRON12345', SUPABASE_SERVICE_ROLE_KEY: 'SECRETSERVICE12345', STRIPE_SECRET_KEY: 'sk_test_SECRETSTRIPE12345', PRODIGI_KEY_SANDBOX: 'SECRETPRODIGISB12345', PRODIGI_KEY_LIVE: 'SECRETPRODIGILIVE12345' }
const call = (q = '?readiness=1') => GET(new Request('http://x/api/v1/print/source' + q))
const setEnv = (e: Record<string, string>) => { vi.unstubAllEnvs(); for (const k of ['VERCEL_ENV', 'PRODIGI_ENV', 'PRINT_UPSCALE_PIPELINE_ENABLED']) delete (process.env as any)[k]; for (const [k, v] of Object.entries(e)) vi.stubEnv(k, v) }

beforeEach(() => { resetPipelineCache(); s.user = { id: 'u1' }; s.settingsRow = { data: { provider: 'replicate', qa_enabled: true }, error: null }; s.jobsErr = null; s.rpcErr = null; s.bucketErr = null })
afterEach(() => vi.unstubAllEnvs())

describe('access', () => {
  it('requires a signed-in user', async () => {
    setEnv({ VERCEL_ENV: 'preview', ...SECRETS }); s.user = null
    const r = await call(); expect(r.status).toBe(401); expect(await r.json()).toEqual({ error: 'sign_in_required' })
  })
  it('exists only on Preview: elsewhere the endpoint refuses and reports nothing', async () => {
    for (const v of ['production', 'development']) {
      setEnv({ VERCEL_ENV: v, ...SECRETS }); const r = await call(); const text = await r.text()
      expect(r.status).toBe(409); expect(text).not.toMatch(/pipeline|credentials|prodigi|stripe/i)
    }
  })
})

describe('on Preview', () => {
  it('reports the environment, the flag off by default, sandbox Prodigi, test Stripe and which credentials exist', async () => {
    setEnv({ VERCEL_ENV: 'preview', ...SECRETS })
    const r = await call(); expect(r.status).toBe(200); expect(r.headers.get('cache-control')).toBe('private, no-store')
    const b = await r.json()
    expect(b).toMatchObject({ preview: true, vercelEnv: 'preview', productVerified: true, assetBucket: true, orderTable: true })
    expect(b.pipeline).toEqual({ flag: false, active: false, reason: 'disabled', problems: [] })
    expect(b.prodigi).toEqual({ configured: 'sandbox', effective: 'sandbox', endpointHost: 'api.sandbox.prodigi.com' })
    expect(b.stripe).toEqual({ mode: 'test' })
    expect(b.credentials).toEqual({ replicateToken: true, openaiKey: true, prunaKey: false, cronSecret: true, supabaseServiceRole: true })
    expect(b.upscaleConfigured).toBe(true)                                         // the existing field is unchanged
  })
  it('flag on and everything present: the pipeline is active', async () => {
    setEnv({ VERCEL_ENV: 'preview', PRINT_UPSCALE_PIPELINE_ENABLED: 'true', ...SECRETS })
    expect((await (await call()).json()).pipeline).toEqual({ flag: true, active: true, reason: null, problems: [] })
  })
  it('flag on but something missing: not ready, naming each missing item', async () => {
    const { OPENAI_API_KEY, REPLICATE_API_TOKEN, ...rest } = SECRETS
    setEnv({ VERCEL_ENV: 'preview', PRINT_UPSCALE_PIPELINE_ENABLED: 'true', ...rest }); s.jobsErr = { message: 'no table' }
    const b = await (await call()).json()
    expect(b.pipeline).toMatchObject({ flag: true, active: false, reason: 'not_ready' })
    expect(b.pipeline.problems).toEqual(expect.arrayContaining(['missing_OPENAI_API_KEY', 'missing_REPLICATE_API_TOKEN', 'migration_046_not_applied:jobs']))
    expect(b.credentials).toMatchObject({ replicateToken: false, openaiKey: false })
  })
  it('Preview configured for live Prodigi: shown as blocked, with the pipeline refusing to run', async () => {
    setEnv({ VERCEL_ENV: 'preview', PRODIGI_ENV: 'live', PRINT_UPSCALE_PIPELINE_ENABLED: 'true', ...SECRETS })
    const b = await (await call()).json()
    expect(b.prodigi).toEqual({ configured: 'live', effective: 'blocked_in_preview', endpointHost: null })
    expect(b.pipeline.problems).toContain('prodigi_live_blocked_in_preview'); expect(b.pipeline.active).toBe(false)
  })
  it('names a missing Prodigi key without the key', async () => {
    const { PRODIGI_KEY_SANDBOX, ...rest } = SECRETS
    setEnv({ VERCEL_ENV: 'preview', ...rest })
    expect((await (await call()).json()).prodigi).toMatchObject({ effective: 'misconfigured', problem: expect.stringContaining('PRODIGI_KEY_SANDBOX') })
  })
  it('reports Stripe live or unknown honestly', async () => {
    setEnv({ VERCEL_ENV: 'preview', ...SECRETS, STRIPE_SECRET_KEY: 'sk_live_SECRETLIVESTRIPE1' }); expect((await (await call()).json()).stripe.mode).toBe('live')
    setEnv({ VERCEL_ENV: 'preview', ...SECRETS, STRIPE_SECRET_KEY: '' }); expect((await (await call()).json()).stripe.mode).toBe('unknown')
  })
  it('never contains a credential value, a length, or a fragment of one', async () => {
    setEnv({ VERCEL_ENV: 'preview', PRINT_UPSCALE_PIPELINE_ENABLED: 'true', ...SECRETS })
    const text = await (await call()).text()
    for (const v of Object.values(SECRETS)) { expect(text).not.toContain(v); expect(text).not.toContain(v.slice(0, 10)) }
    expect(text).not.toMatch(/sk[-_](test|live)?_?[A-Za-z0-9]{6,}|r8_[A-Za-z0-9]+/)
  })
  it('is read-only: no write is attempted', async () => {
    setEnv({ VERCEL_ENV: 'preview', ...SECRETS }); const fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy)
    await call(); expect(fetchSpy).not.toHaveBeenCalled(); vi.unstubAllGlobals()
  })
})
