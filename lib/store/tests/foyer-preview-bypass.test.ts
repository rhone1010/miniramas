// lib/store/tests/foyer-preview-bypass.test.ts
//
// TEMPORARY PREVIEW TEST BYPASS — REMOVE BEFORE PR #178 MERGE (with the
// bypass itself: lib/v1/foyer/foyer-preview-bypass.ts).
//
// Through the REAL route handlers (/foyer/intake, /foyer/reveal), the REAL
// NB2 call and the REAL watermark, over an in-memory allowance that follows
// supabase/migrations/032_foyer_reveals.sql exactly:
//   count  = succeeded rows in the window + claims younger than the claim TTL
//   claim  = null when count >= limit, else a new 'claimed' row's id
//   finalize(true) -> 'succeeded' (counts); finalize(false) -> row deleted
// Proves: Preview never runs out and never writes an allowance row;
// Production still stops at exactly 3; the intake is untouched in both; and
// nothing a visitor sends can switch Production onto the Preview path.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import sharp from 'sharp'

const h = vi.hoisted(() => ({ rpc: vi.fn(), detect: vi.fn() }))
vi.mock('@supabase/supabase-js', async (orig) => ({
  ...(await orig<any>()),
  createClient: () => ({ rpc: (name: string, args: any) => h.rpc(name, args) }),
}))
vi.mock('@/lib/v1/portraits/portraits-refine', () => ({
  detectFaceVisibility: (...a: any[]) => h.detect(...a),
}))

import { POST as intakePOST } from '@/app/api/v1/foyer/intake/route'
import { GET as revealGET, POST as revealPOST } from '@/app/api/v1/foyer/reveal/route'
import { previewAllowanceBypass } from '@/lib/v1/foyer/foyer-preview-bypass'
import { REVEALS_PER_WINDOW } from '@/lib/v1/foyer/foyer-policy'
import { signIntake, sha256Hex } from '@/lib/v1/foyer/foyer-identity'

const SECRET = 'test-secret-0123456789abcdef0123456789abcdef'
const DELIVERY = 'https://replicate.delivery/test/clean-output.jpeg'
let SOURCE_B64 = ''
let CLEAN: Buffer
let replicateBodies: any[] = []
let nb2Fails = false
let intakeCapped = false

/* The allowance table, as 032 keeps it. */
type Row = { id: string; ip: string; status: 'claimed' | 'succeeded'; at: number }
let rows: Row[] = []
let seq = 0
const rpcCalls = () => h.rpc.mock.calls.map(c => c[0])
function count(ip: string) { return rows.filter(r => r.ip === ip && (r.status === 'succeeded' || Date.now() - r.at < 10 * 60_000)).length }

function req(url: string, init: { method?: string; body?: any; ip?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': init.ip ?? '203.0.113.7',
    cookie: 'liten_anon=5b1f0a52-3c1e-4c7e-9a3f-2d8e6b7c1a90', ...(init.headers || {}) }
  return new Request('http://liten.test' + url, { method: init.method ?? 'POST', headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body) }) as any
}
const note = (b64 = SOURCE_B64, ageGroup = 'adult') =>
  signIntake(SECRET, { sha: sha256Hex(Buffer.from(b64, 'base64')), subject: 'woman', ageGroup, exp: Date.now() + 60_000 })
const reveal = (extra: Parameters<typeof req>[1] = {}) =>
  revealPOST(req('/api/v1/foyer/reveal', { body: { image_b64: SOURCE_B64, intake: note() }, ...extra }))
const available = async (extra: Parameters<typeof req>[1] = {}) =>
  (await (await revealGET(req('/api/v1/foyer/reveal', { method: 'GET', ...extra }))).json())

beforeEach(async () => {
  process.env.FOYER_HMAC_SECRET = SECRET
  process.env.SUPABASE_URL = 'http://supabase.test'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  process.env.REPLICATE_API_TOKEN = 'r8_test'
  process.env.OPENAI_API_KEY = 'sk-test'
  delete process.env.VERCEL_ENV
  h.rpc.mockReset(); h.detect.mockReset()
  rows = []; seq = 0; replicateBodies = []; nb2Fails = false; intakeCapped = false
  if (!SOURCE_B64) {
    SOURCE_B64 = (await sharp({ create: { width: 600, height: 800, channels: 3, background: '#8a6d5a' } }).jpeg().toBuffer()).toString('base64')
    CLEAN = await sharp({ create: { width: 848, height: 1264, channels: 3, background: '#404a58' } }).jpeg({ quality: 92 }).toBuffer()
  }
  h.detect.mockResolvedValue({ face_visible: true, subject_count_estimate: 1, gender: 'f', age_group: 'adult', reason: 'ok' })
  h.rpc.mockImplementation(async (name: string, a: any) => {
    if (name === 'claim_foyer_intake') return { data: !intakeCapped, error: null }
    if (name === 'foyer_reveal_count') return { data: count(a.p_ip), error: null }
    if (name === 'claim_foyer_reveal') {
      if (count(a.p_ip) >= a.p_limit) return { data: null, error: null }
      const id = 'claim-' + (++seq); rows.push({ id, ip: a.p_ip, status: 'claimed', at: Date.now() })
      return { data: id, error: null }
    }
    if (name === 'finalize_foyer_reveal') {
      const r = rows.find(x => x.id === a.p_id); if (!r) return { data: false, error: null }
      if (a.p_succeeded) r.status = 'succeeded'; else rows = rows.filter(x => x !== r)
      return { data: true, error: null }
    }
    return { data: null, error: { message: 'unknown rpc ' + name } }
  })
  vi.stubGlobal('fetch', vi.fn(async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url
    if (url.startsWith('https://api.replicate.com/')) {
      replicateBodies.push(JSON.parse(init.body))
      if (nb2Fails) return new Response('boom', { status: 500 })
      return new Response(JSON.stringify({ id: 'pred-1', status: 'succeeded', output: [DELIVERY] }), { status: 201 })
    }
    if (url === DELIVERY) return new Response(new Uint8Array(CLEAN), { status: 200 })
    throw new Error('unexpected fetch ' + url)
  }))
})
afterEach(() => { delete process.env.VERCEL_ENV; vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('the guard itself', () => {
  it('is on for a Vercel Preview deployment and nowhere else', () => {
    expect(previewAllowanceBypass({ VERCEL_ENV: 'preview' } as any)).toBe(true)
    for (const v of ['production', 'development', 'Preview', 'PREVIEW', ' preview', '', undefined]) {
      expect(previewAllowanceBypass({ VERCEL_ENV: v } as any)).toBe(false)
    }
    expect(previewAllowanceBypass({} as any)).toBe(false)
  })
})

describe('1 · PREVIEW: never runs out, never writes an allowance row', () => {
  it('stays available and keeps revealing well past 3, and leaves existing rows alone', async () => {
    process.env.VERCEL_ENV = 'preview'
    // this visitor's allowance already fully used (3 succeeded rows)
    const ipKeyed = await (async () => { delete process.env.VERCEL_ENV; await reveal(); await reveal(); await reveal(); process.env.VERCEL_ENV = 'preview'; return rows.slice() })()
    expect(ipKeyed.filter(r => r.status === 'succeeded')).toHaveLength(REVEALS_PER_WINDOW)
    h.rpc.mockClear()

    expect(await available()).toEqual({ available: true })
    for (let i = 0; i < 6; i++) {
      const res = await reveal()
      const d = await res.json()
      expect(res.status).toBe(200)
      expect(d.status).toBe('ok')
      expect(d.image).toMatch(/^data:image\/jpeg;base64,/)
    }
    expect(await available()).toEqual({ available: true })
    // no allowance read, claim or finalize on the Preview; only the intake is untouched (not called here)
    expect(rpcCalls().filter(n => /foyer_reveal/.test(n))).toEqual([])
    // the existing rows are exactly as they were
    expect(rows).toEqual(ipKeyed)
  })
})

describe('2 · PRODUCTION: exactly 3 successful reveals per window, then exhausted', () => {
  for (const env of ['production', undefined]) {
    it(`VERCEL_ENV=${env ?? '(unset)'}: 3 reveals, then 429 and GET says exhausted`, async () => {
      if (env) process.env.VERCEL_ENV = env
      expect(await available()).toEqual({ available: true })
      for (let i = 0; i < 3; i++) expect((await reveal()).status).toBe(200)
      expect(await available()).toEqual({ available: false, reason: 'exhausted' })
      const fourth = await reveal()
      expect(fourth.status).toBe(429)
      expect(await fourth.json()).toEqual({ status: 'exhausted' })
      expect(rows.filter(r => r.status === 'succeeded')).toHaveLength(3)
      expect(rpcCalls().filter(n => n === 'claim_foyer_reveal')).toHaveLength(4)
      expect(rpcCalls().filter(n => n === 'finalize_foyer_reveal')).toHaveLength(3)
    })
  }
  it('a failed render is released and costs nothing (unchanged)', async () => {
    process.env.VERCEL_ENV = 'production'
    expect((await reveal()).status).toBe(200)
    nb2Fails = true
    expect((await reveal()).status).toBe(502)
    nb2Fails = false
    expect((await reveal()).status).toBe(200)
    expect((await reveal()).status).toBe(200)
    expect((await reveal()).status).toBe(429)
    expect(rows.filter(r => r.status === 'succeeded')).toHaveLength(3)
  })
})

describe('3 · the intake is the same on both', () => {
  for (const env of ['preview', 'production']) {
    it(`${env}: a child or teen is refused at intake, and a reveal without a valid note is refused`, async () => {
      process.env.VERCEL_ENV = env
      for (const age of ['child', 'teen']) {
        h.detect.mockResolvedValueOnce({ face_visible: true, subject_count_estimate: 1, gender: 'm', age_group: age, reason: '' })
        const res = await intakePOST(req('/api/v1/foyer/intake', { body: { image_b64: SOURCE_B64 } }))
        expect(res.status).toBe(403)
        expect(await res.json()).toEqual({ status: 'refused', code: 'age_restricted' })
      }
      expect((await revealPOST(req('/api/v1/foyer/reveal', { body: { image_b64: SOURCE_B64 } }))).status).toBe(403)
      expect((await revealPOST(req('/api/v1/foyer/reveal', { body: { image_b64: SOURCE_B64, intake: 'forged' } }))).status).toBe(403)
      expect((await revealPOST(req('/api/v1/foyer/reveal', { body: { image_b64: SOURCE_B64, intake: note(SOURCE_B64, 'teen') } }))).status).toBe(403)
      expect(replicateBodies).toHaveLength(0)
    })
    it(`${env}: the intake's own abuse limit still applies`, async () => {
      process.env.VERCEL_ENV = env
      intakeCapped = true
      const res = await intakePOST(req('/api/v1/foyer/intake', { body: { image_b64: SOURCE_B64 } }))
      expect(res.status).toBe(429)
      expect(await res.json()).toEqual({ status: 'unavailable' })
      expect(h.detect).not.toHaveBeenCalled()
    })
  }
})

describe('4 · Production cannot be put on the Preview path', () => {
  it('nothing in the request -- query, header or cookie -- turns the bypass on', async () => {
    process.env.VERCEL_ENV = 'production'
    const hints = { headers: { 'x-vercel-env': 'preview', 'x-preview': '1', cookie: 'liten_anon=5b1f0a52-3c1e-4c7e-9a3f-2d8e6b7c1a90; VERCEL_ENV=preview; preview=1' } }
    for (let i = 0; i < 3; i++) {
      const res = await revealPOST(req('/api/v1/foyer/reveal?preview=1&VERCEL_ENV=preview', { body: { image_b64: SOURCE_B64, intake: note(), preview: true, bypass: true }, ...hints }))
      expect(res.status).toBe(200)
    }
    const fourth = await revealPOST(req('/api/v1/foyer/reveal?preview=1', { body: { image_b64: SOURCE_B64, intake: note(), preview: true }, ...hints }))
    expect(fourth.status).toBe(429)
    expect(await (await revealGET(req('/api/v1/foyer/reveal?preview=1', { method: 'GET', ...hints }))).json()).toEqual({ available: false, reason: 'exhausted' })
  })
})

describe('5 · the render is the same on both', () => {
  it('the NB2 request is byte-identical on Preview and Production (same model, prompt, effect pool)', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42)
    process.env.VERCEL_ENV = 'production'
    await reveal()
    process.env.VERCEL_ENV = 'preview'
    await reveal()
    expect(replicateBodies).toHaveLength(2)
    expect(JSON.stringify(replicateBodies[1])).toBe(JSON.stringify(replicateBodies[0]))
  })
})
