// lib/store/tests/foyer-reveal.test.ts
//
// The foyer's free personal reveal, through the REAL route handlers
// (/api/v1/foyer/intake, /api/v1/foyer/reveal), the REAL production NB2 call
// (callNB2) and the REAL watermark (bakeWatermark). Only the database, the
// vision model and the network are fakes -- and the network fake is where
// the request to Replicate is read back, so the model, the prompt and the
// aspect are checked on the wire, not on a mock's arguments.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import sharp from 'sharp'
import { createHash } from 'crypto'

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  detect: vi.fn(),
}))

vi.mock('@supabase/supabase-js', async (orig) => ({
  ...(await orig<any>()),
  createClient: () => ({ rpc: (name: string, args: any) => h.rpc(name, args) }),
}))
vi.mock('@/lib/v1/portraits/portraits-refine', () => ({
  detectFaceVisibility: (...a: any[]) => h.detect(...a),
}))

import { POST as intakePOST } from '@/app/api/v1/foyer/intake/route'
import { GET as revealGET, POST as revealPOST } from '@/app/api/v1/foyer/reveal/route'
import { buildEffectPrompt } from '@/lib/v1/portraits/portraits-bodies'
import { FOYER_REVEAL_EFFECTS, REVEALS_PER_WINDOW } from '@/lib/v1/foyer/foyer-policy'
import { signIntake, sha256Hex } from '@/lib/v1/foyer/foyer-identity'
import { byId } from '@/lib/v1/portraits/effect-registry'

const SECRET = 'test-secret-0123456789abcdef0123456789abcdef'
const IP = '203.0.113.7'
const ANON = '5b1f0a52-3c1e-4c7e-9a3f-2d8e6b7c1a90'
const DELIVERY = 'https://replicate.delivery/test/clean-output.jpeg'

let SOURCE_B64 = ''
let CLEAN: Buffer
let replicate: { url: string; body: any }[] = []
let deliveryFetches = 0
let nb2Fails = false

function req(url: string, init: { method?: string; body?: any; ip?: string; cookie?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': init.ip ?? IP }
  if (init.cookie !== undefined) headers.cookie = init.cookie
  else headers.cookie = `liten_anon=${ANON}`
  return new Request('http://liten.test' + url, {
    method: init.method ?? 'POST', headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  }) as any
}

async function intakeToken(b64 = SOURCE_B64, subject: 'man' | 'woman' | null = 'woman', exp = Date.now() + 60_000) {
  return signIntake(SECRET, { sha: sha256Hex(Buffer.from(b64, 'base64')), subject, ageGroup: 'adult', exp })
}

beforeEach(async () => {
  process.env.FOYER_HMAC_SECRET = SECRET
  process.env.SUPABASE_URL = 'http://supabase.test'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  process.env.REPLICATE_API_TOKEN = 'r8_test'
  process.env.OPENAI_API_KEY = 'sk-test'
  h.rpc.mockReset(); h.detect.mockReset()
  replicate = []; deliveryFetches = 0; nb2Fails = false

  if (!SOURCE_B64) {
    SOURCE_B64 = (await sharp({ create: { width: 600, height: 800, channels: 3, background: '#8a6d5a' } }).jpeg().toBuffer()).toString('base64')
    // a "clean" render with structure, so a baked watermark shows in the pixels
    CLEAN = await sharp({ create: { width: 848, height: 1264, channels: 3, background: '#404a58' } }).jpeg({ quality: 92 }).toBuffer()
  }

  h.detect.mockResolvedValue({ face_visible: true, subject_count_estimate: 1, gender: 'f', age_group: 'adult', reason: 'ok' })
  h.rpc.mockImplementation(async (name: string) => {
    if (name === 'claim_foyer_intake') return { data: true, error: null }
    if (name === 'claim_foyer_reveal') return { data: 'claim-1', error: null }
    if (name === 'finalize_foyer_reveal') return { data: true, error: null }
    if (name === 'foyer_reveal_count') return { data: 0, error: null }
    return { data: null, error: { message: 'unknown rpc ' + name } }
  })

  vi.stubGlobal('fetch', vi.fn(async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url
    if (url.startsWith('https://api.replicate.com/')) {
      replicate.push({ url, body: JSON.parse(init.body) })
      if (nb2Fails) return new Response('boom', { status: 500 })
      return new Response(JSON.stringify({ id: 'pred-1', status: 'succeeded', output: [DELIVERY] }), { status: 201 })
    }
    if (url === DELIVERY) { deliveryFetches++; return new Response(new Uint8Array(CLEAN), { status: 200 }) }
    throw new Error('unexpected fetch ' + url)
  }))
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('/api/v1/foyer/intake — the one safety check', () => {
  it('passes an adult: subject for Discovery, and a signed verdict bound to these bytes', async () => {
    const res = await intakePOST(req('/api/v1/foyer/intake', { body: { image_b64: SOURCE_B64 } }))
    const d = await res.json()
    expect(res.status).toBe(200)
    expect(d).toMatchObject({ status: 'ok', subject: 'woman', gender: 'f', age_group: 'adult' })
    expect(typeof d.intake).toBe('string')
    expect(h.detect).toHaveBeenCalledTimes(1)
    expect(h.detect.mock.calls[0][0].sourceImageB64).toBe(SOURCE_B64)
  })

  it('keys the IP with the server secret -- never the address, never a bare sha256 of it', async () => {
    await intakePOST(req('/api/v1/foyer/intake', { body: { image_b64: SOURCE_B64 } }))
    const args = h.rpc.mock.calls.find(c => c[0] === 'claim_foyer_intake')![1]
    expect(args.p_ip).toMatch(/^[0-9a-f]{64}$/)
    expect(args.p_ip).not.toContain(IP)
    expect(args.p_ip).not.toBe(createHash('sha256').update(IP).digest('hex'))
    expect(args.p_device).toBe(ANON)
  })

  it.each(['child', 'teen'])('refuses a %s: no verdict, nothing rendered, no allowance spent', async (age) => {
    h.detect.mockResolvedValue({ face_visible: true, subject_count_estimate: 1, gender: 'm', age_group: age, reason: '' })
    const res = await intakePOST(req('/api/v1/foyer/intake', { body: { image_b64: SOURCE_B64 } }))
    const d = await res.json()
    expect(res.status).toBe(403)
    expect(d).toEqual({ status: 'refused', code: 'age_restricted' })
    expect(h.rpc.mock.calls.some(c => c[0] === 'claim_foyer_reveal')).toBe(false)
    expect(replicate).toHaveLength(0)
  })

  it('fails OPEN on a detection outage, as /portraits/generate does (subject unknown)', async () => {
    h.detect.mockRejectedValue(new Error('vision down'))
    const res = await intakePOST(req('/api/v1/foyer/intake', { body: { image_b64: SOURCE_B64 } }))
    const d = await res.json()
    expect(res.status).toBe(200)
    expect(d).toMatchObject({ status: 'ok', subject: null, age_group: null })
  })

  it('is rationed: over the cap it is unavailable and the vision model is not called', async () => {
    h.rpc.mockImplementation(async (name: string) => (name === 'claim_foyer_intake' ? { data: false, error: null } : { data: null, error: null }))
    const res = await intakePOST(req('/api/v1/foyer/intake', { body: { image_b64: SOURCE_B64 } }))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ status: 'unavailable' })
    expect(h.detect).not.toHaveBeenCalled()
  })

  it('without the secret or the store it is unavailable, and examines nothing', async () => {
    delete process.env.FOYER_HMAC_SECRET
    const res = await intakePOST(req('/api/v1/foyer/intake', { body: { image_b64: SOURCE_B64 } }))
    expect(res.status).toBe(503)
    expect(h.detect).not.toHaveBeenCalled()
  })

  it('refuses what is not a photograph before any paid or vision call', async () => {
    const notImage = Buffer.from('hello, not an image at all').toString('base64')
    const res = await intakePOST(req('/api/v1/foyer/intake', { body: { image_b64: notImage } }))
    expect(res.status).toBe(400)
    expect(h.detect).not.toHaveBeenCalled()
  })
})

describe('/api/v1/foyer/reveal — one NB2 render, watermarked, allowance-accounted', () => {
  it('renders on google/nano-banana-2 (never Lite) with the production prompt unchanged, at 2:3', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)          // the last of the six
    const res = await revealPOST(req('/api/v1/foyer/reveal', { body: { image_b64: SOURCE_B64, intake: await intakeToken() } }))
    const d = await res.json()
    expect(res.status).toBe(200)
    expect(replicate).toHaveLength(1)
    const call = replicate[0]
    expect(call.url).toBe('https://api.replicate.com/v1/models/google/nano-banana-2/predictions')
    expect(call.url).not.toContain('lite')
    const effect = FOYER_REVEAL_EFFECTS[FOYER_REVEAL_EFFECTS.length - 1]
    expect(call.body.input.prompt).toBe(buildEffectPrompt(effect))
    expect(call.body.input.aspect_ratio).toBe('2:3')
    expect(call.body.input.output_format).toBe('jpg')
    expect(call.body.input.image_input).toEqual([`data:image/jpeg;base64,${SOURCE_B64}`])
    expect(d.label).toBe(byId(effect)!.label)
  })

  it('draws only from the six, and can draw every one of them', async () => {
    const seen = new Set<string>()
    for (let i = 0; i < FOYER_REVEAL_EFFECTS.length; i++) {
      replicate = []
      vi.spyOn(Math, 'random').mockReturnValue((i + 0.5) / FOYER_REVEAL_EFFECTS.length)
      await revealPOST(req('/api/v1/foyer/reveal', { body: { image_b64: SOURCE_B64, intake: await intakeToken() } }))
      const prompt = replicate[0].body.input.prompt
      const hit = FOYER_REVEAL_EFFECTS.find(e => buildEffectPrompt(e) === prompt)
      expect(hit).toBeDefined()
      seen.add(hit!)
    }
    expect([...seen].sort()).toEqual([...FOYER_REVEAL_EFFECTS].sort())
  })

  it('returns the watermarked JPEG only: never the clean pixels, never Replicate\'s URL', async () => {
    const res = await revealPOST(req('/api/v1/foyer/reveal', { body: { image_b64: SOURCE_B64, intake: await intakeToken() } }))
    const raw = await res.text()
    const d = JSON.parse(raw)
    expect(d.status).toBe('ok')
    expect(d.image.startsWith('data:image/jpeg;base64,')).toBe(true)
    expect(raw).not.toContain(DELIVERY)
    expect(raw).not.toContain(CLEAN.toString('base64').slice(0, 200))
    expect(deliveryFetches).toBe(1)                                   // fetched server-side, once

    const marked = Buffer.from(d.image.split(',')[1], 'base64')
    const [a, b] = await Promise.all([sharp(CLEAN).raw().toBuffer({ resolveWithObject: true }), sharp(marked).raw().toBuffer({ resolveWithObject: true })])
    expect(b.info.width).toBe(a.info.width)
    expect(b.info.height).toBe(a.info.height)
    let brighter = 0
    for (let i = 0; i < a.data.length; i += 3) if (b.data[i] - a.data[i] > 25) brighter++
    // the white tiled mark lifts a real share of the pixels; JPEG noise alone lifts none by that much
    expect(brighter / (a.data.length / 3)).toBeGreaterThan(0.01)
  })

  it('a successful reveal is finalized as counted', async () => {
    await revealPOST(req('/api/v1/foyer/reveal', { body: { image_b64: SOURCE_B64, intake: await intakeToken() } }))
    const claimCall = h.rpc.mock.calls.find(c => c[0] === 'claim_foyer_reveal')![1]
    expect(claimCall).toMatchObject({ p_limit: REVEALS_PER_WINDOW, p_window: '24 hours', p_device: ANON })
    expect(h.rpc.mock.calls.find(c => c[0] === 'finalize_foyer_reveal')![1]).toEqual({ p_id: 'claim-1', p_succeeded: true })
  })

  it('a failed render is released -- it costs the visitor nothing', async () => {
    nb2Fails = true
    const res = await revealPOST(req('/api/v1/foyer/reveal', { body: { image_b64: SOURCE_B64, intake: await intakeToken() } }))
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ status: 'failed' })
    expect(h.rpc.mock.calls.find(c => c[0] === 'finalize_foyer_reveal')![1]).toEqual({ p_id: 'claim-1', p_succeeded: false })
  })

  it('exhausted: no render at all', async () => {
    h.rpc.mockImplementation(async (name: string) => (name === 'claim_foyer_reveal' ? { data: null, error: null } : { data: true, error: null }))
    const res = await revealPOST(req('/api/v1/foyer/reveal', { body: { image_b64: SOURCE_B64, intake: await intakeToken() } }))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ status: 'exhausted' })
    expect(replicate).toHaveLength(0)
  })

  it('the allowance cannot be checked: FAIL CLOSED, no render', async () => {
    h.rpc.mockImplementation(async () => ({ data: null, error: { message: 'relation "foyer_reveals" does not exist' } }))
    const res = await revealPOST(req('/api/v1/foyer/reveal', { body: { image_b64: SOURCE_B64, intake: await intakeToken() } }))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ status: 'unavailable' })
    expect(replicate).toHaveLength(0)
  })

  it('no secret: fail closed, no render', async () => {
    delete process.env.FOYER_HMAC_SECRET
    const res = await revealPOST(req('/api/v1/foyer/reveal', { body: { image_b64: SOURCE_B64, intake: 'x.y' } }))
    expect(res.status).toBe(503)
    expect(replicate).toHaveLength(0)
  })

  it('needs the intake\'s verdict for THESE bytes -- missing, forged, other bytes or expired are refused before any claim', async () => {
    const other = (await sharp({ create: { width: 10, height: 10, channels: 3, background: '#000' } }).jpeg().toBuffer()).toString('base64')
    const cases = [
      undefined,
      'forged.deadbeef',
      await intakeToken(other),                                   // a verdict for a different photograph
      await intakeToken(SOURCE_B64, 'woman', Date.now() - 1),     // expired
      signIntake('some-other-secret-0123456789abcdef0123', { sha: sha256Hex(Buffer.from(SOURCE_B64, 'base64')), subject: 'woman', ageGroup: 'adult', exp: Date.now() + 60_000 }),
    ]
    for (const intake of cases) {
      const res = await revealPOST(req('/api/v1/foyer/reveal', { body: { image_b64: SOURCE_B64, intake } }))
      expect(res.status).toBe(403)
    }
    expect(h.rpc.mock.calls.some(c => c[0] === 'claim_foyer_reveal')).toBe(false)
    expect(replicate).toHaveLength(0)
  })

  it('GET says whether a free preview is available; anything unknown is no', async () => {
    expect(await (await revealGET(req('/api/v1/foyer/reveal', { method: 'GET' }))).json()).toEqual({ available: true })
    h.rpc.mockImplementation(async () => ({ data: 3, error: null }))
    expect(await (await revealGET(req('/api/v1/foyer/reveal', { method: 'GET' }))).json()).toEqual({ available: false })
    h.rpc.mockImplementation(async () => ({ data: null, error: { message: 'down' } }))
    expect(await (await revealGET(req('/api/v1/foyer/reveal', { method: 'GET' }))).json()).toEqual({ available: false })
    delete process.env.FOYER_HMAC_SECRET
    expect(await (await revealGET(req('/api/v1/foyer/reveal', { method: 'GET' }))).json()).toEqual({ available: false })
  })

  it('a malformed liten_anon marker is ignored, not trusted', async () => {
    await revealPOST(req('/api/v1/foyer/reveal', { cookie: 'liten_anon=not-a-uuid', body: { image_b64: SOURCE_B64, intake: await intakeToken() } }))
    expect(h.rpc.mock.calls.find(c => c[0] === 'claim_foyer_reveal')![1].p_device).toBeNull()
  })
})

describe('the front door', () => {
  it('/ and /home are the foyer; /discovery is still Discovery', async () => {
    const { middleware } = await import('@/middleware')
    const { NextRequest } = await import('next/server')
    const rewrite = async (p: string) => (await middleware(new NextRequest('http://liten.test' + p)))!.headers.get('x-middleware-rewrite')
    expect(await rewrite('/')).toBe('http://liten.test/foyer.html')
    expect(await rewrite('/home')).toBe('http://liten.test/foyer.html')
    expect(await rewrite('/discovery')).toBe('http://liten.test/discovery-consolidated-draft.html')
  })
})
