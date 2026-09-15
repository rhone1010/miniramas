// lib/store/tests/foyer-watermark-fail-closed.test.ts
//
// The foyer's baked watermark FAILS CLOSED (Rich, 2026-09-14): if the lockup
// cannot be baked, the reveal is a failed reveal -- 502, the allowance claim
// released, and no image at all in the response. Never the clean pixels.
// Through the REAL /foyer/reveal route with the real NB2 call faked on the
// wire; only bakeFoyerWatermark is made to throw.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import sharp from 'sharp'

const h = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('@supabase/supabase-js', async (orig) => ({
  ...(await orig<any>()),
  createClient: () => ({ rpc: (name: string, args: any) => h.rpc(name, args) }),
}))
vi.mock('@/lib/v1/foyer/foyer-watermark', () => ({
  bakeFoyerWatermark: async () => { throw new Error('lockup could not be baked') },
}))

import { POST as revealPOST } from '@/app/api/v1/foyer/reveal/route'
import { signIntake, sha256Hex } from '@/lib/v1/foyer/foyer-identity'

const SECRET = 'test-secret-0123456789abcdef0123456789abcdef'
const DELIVERY = 'https://replicate.delivery/test/clean-output.jpeg'

beforeEach(() => {
  process.env.FOYER_HMAC_SECRET = SECRET
  process.env.SUPABASE_URL = 'http://supabase.test'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  process.env.REPLICATE_API_TOKEN = 'r8_test'
  delete process.env.VERCEL_ENV
  h.rpc.mockReset()
  h.rpc.mockImplementation(async (name: string) => {
    if (name === 'claim_foyer_reveal') return { data: 'claim-1', error: null }
    if (name === 'finalize_foyer_reveal') return { data: true, error: null }
    return { data: null, error: { message: 'unknown rpc ' + name } }
  })
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('the foyer watermark fails closed', () => {
  it('a bake failure is a failed reveal: 502, the claim released, no image and no clean pixels', async () => {
    const source = (await sharp({ create: { width: 600, height: 800, channels: 3, background: '#8a6d5a' } }).jpeg().toBuffer()).toString('base64')
    const clean = await sharp({ create: { width: 848, height: 1264, channels: 3, background: '#404a58' } }).jpeg({ quality: 92 }).toBuffer()
    vi.stubGlobal('fetch', vi.fn(async (input: any) => {
      const url = typeof input === 'string' ? input : input.url
      if (url.startsWith('https://api.replicate.com/')) return new Response(JSON.stringify({ id: 'pred-1', status: 'succeeded', output: [DELIVERY] }), { status: 201 })
      if (url === DELIVERY) return new Response(new Uint8Array(clean), { status: 200 })
      throw new Error('unexpected fetch ' + url)
    }))
    const intake = signIntake(SECRET, { sha: sha256Hex(Buffer.from(source, 'base64')), subject: 'woman', ageGroup: 'adult', exp: Date.now() + 60_000 })
    const res = await revealPOST(new Request('http://liten.test/api/v1/foyer/reveal', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
      body: JSON.stringify({ image_b64: source, intake }),
    }) as any)
    const raw = await res.text()
    expect(res.status).toBe(502)
    expect(JSON.parse(raw)).toEqual({ status: 'failed' })
    expect(raw).not.toContain(clean.toString('base64').slice(0, 200))
    expect(h.rpc.mock.calls.find(c => c[0] === 'finalize_foyer_reveal')![1]).toEqual({ p_id: 'claim-1', p_succeeded: false })
  })
})
