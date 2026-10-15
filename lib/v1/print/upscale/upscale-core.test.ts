import { describe, it, expect, vi } from 'vitest'
import { computeTarget, validateOutput, sourceQuality, TargetError } from './target'
import { DEFAULT_SETTINGS, resolveSettings, settingsHash, validatePatch, validateScope, loadSettings } from './settings'
import { replicateProvider, prunaProvider, makeProvider, estimateCostUsd, ProviderError } from './providers'
import { printPlan } from '../geometry'
import { getLaunchSku, SKU_MAP } from '../sku-map'

describe('target megapixels from real print plans', () => {
  const plan = (sz: any, fin: any, w = 1000, h = 1000) => printPlan(w, h, (fin === 'framed_canvas' || fin === 'matted' ? (SKU_MAP as any)[fin][sz] : getLaunchSku(sz, fin)))
  it('8x8 fine art: 5.76 MP rounds up to 6', () => {
    const t = computeTarget(plan('8x8', 'fine_art'), 300)
    expect(t.targetMp).toBe(6); expect(t.exactMp).toBeGreaterThan(5.76); expect(t.overshootPct).toBeLessThan(5)
  })
  it('20x30 fine art needs 54 MP', () => {
    expect(computeTarget(plan('20x30', 'fine_art', 1000, 1500), 300).targetMp).toBe(55)
  })
  it('canvas includes the 27px wrap on each side (2454x2454 for 8x8)', () => {
    const t = computeTarget(plan('8x8', 'canvas'), 300)
    expect(t.requiredFinal).toEqual({ w: 2454, h: 2454 }); expect(t.requiredFront).toEqual({ w: 2400, h: 2400 })
    expect(t.targetMp).toBe(7)           // 2454² = 6.02 MP
  })
  it('scales requirements with the configured PPI and never exceeds the limit', () => {
    const p = plan('20x30', 'fine_art', 1000, 1500)
    expect(computeTarget(p, 240).targetMp).toBeLessThan(computeTarget(p, 300).targetMp)
    expect(() => computeTarget(p, 300, 40)).toThrow(TargetError)
    expect(() => computeTarget(plan('24x36' as any, 'fine_art', 1000, 1500) as any, 300)).toThrow()   // 24x36 is not in the launch map
  })
  it('refuses nonsense input', () => {
    expect(() => computeTarget({ front: { w: 0, h: 0 }, final: { w: 0, h: 0 } }, 300)).toThrow('print_target_invalid')
    expect(() => computeTarget(plan('8x8', 'fine_art'), 0)).toThrow('print_target_invalid')
  })
})

describe('validating what the provider actually returned', () => {
  const need = { w: 2400, h: 2400 }
  it('accepts a result at or above the requirement with the same shape', () => {
    expect(validateOutput({ w: 2449, h: 2449 }, { w: 1200, h: 1200 }, need, 6).ok).toBe(true)
  })
  it('rejects short, reshaped, oversized or unreadable output', () => {
    expect(validateOutput({ w: 2399, h: 2400 }, { w: 1200, h: 1200 }, need, 6).errors).toContain('output_below_required_resolution')
    expect(validateOutput({ w: 2600, h: 2400 }, { w: 1200, h: 1200 }, need, 6).errors).toContain('output_aspect_changed')
    expect(validateOutput({ w: 6000, h: 6000 }, { w: 1200, h: 1200 }, need, 6).errors).toContain('output_far_above_target')
    expect(validateOutput({ w: 0, h: 0 }, { w: 1, h: 1 }, need, 6).errors).toContain('output_unreadable')
  })
  it('tolerates one pixel of provider rounding on the aspect', () => {
    expect(validateOutput({ w: 3000, h: 2000 }, { w: 1501, h: 1000 }, { w: 2400, h: 1600 }, 7).ok).toBe(true)
  })
})

describe('source quality is a warning measure', () => {
  it('reports real PPI of the aspect-corrected artwork over the print inches', () => {
    const q = sourceQuality({ w: 1228, h: 1228 }, { w: 2400, h: 2400 }, 100)
    expect(q.sourcePpi).toBeCloseTo(153.5, 1); expect(q.belowFloor).toBe(false)
    const big = sourceQuality({ w: 1228, h: 1228 }, { w: 6000, h: 6000 }, 100)
    expect(big.sourcePpi).toBeCloseTo(61.4, 1); expect(big.belowFloor).toBe(true)
  })
})

describe('settings resolution and validation', () => {
  const global = { scope: 'global', version: 2, ...DEFAULT_SETTINGS }
  it('falls back to approved defaults with no rows', () => {
    const r = resolveSettings([], 'GLOBAL-FAP-8X8', 'fine_art')
    expect(r.settings).toEqual(DEFAULT_SETTINGS); expect(r.sources).toEqual(['builtin'])
    expect(DEFAULT_SETTINGS).toMatchObject({ provider: 'replicate', output_format: 'jpg', output_quality: 95, enhance_details: false, enhance_realism: false, disable_safety_checker: false, target_ppi: 300 })
  })
  it('sku overrides family overrides global, field by field', () => {
    const r = resolveSettings([global, { scope: 'family:canvas', version: 3, enhance_details: true }, { scope: 'sku:GLOBAL-CAN-8X8', version: 5, output_quality: 90 }], 'GLOBAL-CAN-8X8', 'canvas')
    expect(r.settings).toMatchObject({ enhance_details: true, output_quality: 90, provider: 'replicate' })
    expect(r.version).toBe(5); expect(r.sources).toEqual(['global', 'family:canvas', 'sku:GLOBAL-CAN-8X8'])
    expect(resolveSettings([global, { scope: 'family:canvas', enhance_details: true }], 'GLOBAL-FAP-8X8', 'fine_art').settings.enhance_details).toBe(false)
  })
  it('the settings hash changes only when a setting changes', () => {
    expect(settingsHash(DEFAULT_SETTINGS)).toBe(settingsHash({ ...DEFAULT_SETTINGS }))
    expect(settingsHash(DEFAULT_SETTINGS)).not.toBe(settingsHash({ ...DEFAULT_SETTINGS, enhance_realism: true }))
  })
  it('validates admin edits strictly', () => {
    expect(validatePatch({ provider: 'pruna' }, 'global')).toEqual({ ok: true, value: { provider: 'pruna' } })
    for (const bad of [{ provider: 'x' }, { target_ppi: 10 }, { output_quality: 101 }, { enhance_details: 'yes' }, { secret_key: 'x' }, {}, [], null]) expect(validatePatch(bad as any, 'global').ok).toBe(false)
    expect(validatePatch({ output_quality: null }, 'sku:GLOBAL-CAN-8X8')).toEqual({ ok: true, value: { output_quality: null } })
    expect(validatePatch({ output_quality: null }, 'global').ok).toBe(false)
    expect(validateScope('family:canvas')).toBe(true); expect(validateScope('sku:GLOBAL-CAN-8X8')).toBe(true)
    for (const s of ['', 'family:', 'x', "sku:'; drop", 5, null]) expect(validateScope(s)).toBe(false)
  })
  it('loadSettings never throws and uses defaults when the table is unreadable', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await loadSettings({ from: () => ({ select: async () => ({ data: null, error: { message: 'down' } }) }) }, 'a', 'b')
    expect(r.settings).toEqual(DEFAULT_SETTINGS); expect(r.sources).toEqual(['builtin']); spy.mockRestore()
  })
})

describe('provider adapters', () => {
  const settings = { ...DEFAULT_SETTINGS, enhance_details: true }
  const resp = (status: number, body: any) => new Response(JSON.stringify(body), { status })
  it('replicate: creates asynchronously with target mode, the image URL and every setting', async () => {
    const f = vi.fn(async () => resp(201, { id: 'pred1' }))
    const p = replicateProvider({ fetchImpl: f as any, env: { REPLICATE_API_TOKEN: 'tok' } })
    expect(await p.start({ imageUrl: 'https://x/y.jpg', targetMp: 36, settings })).toEqual({ id: 'pred1' })
    const [url, init] = f.mock.calls[0] as any
    expect(url).toBe('https://api.replicate.com/v1/models/prunaai/p-image-upscale/predictions')
    expect(init.headers.Prefer).toBeUndefined()                       // never a synchronous wait
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body).input).toEqual({ image: 'https://x/y.jpg', upscale_mode: 'target', target: 36, output_format: 'jpg', output_quality: 95, enhance_details: true, enhance_realism: false, disable_safety_checker: false })
  })
  it('replicate: polling maps status, output and compute time', async () => {
    const f = vi.fn(async () => resp(200, { status: 'succeeded', output: 'https://out/a.jpg', metrics: { predict_time: 4.2 } }))
    const p = replicateProvider({ fetchImpl: f as any, env: { REPLICATE_API_TOKEN: 't' } })
    expect(await p.poll('pred1')).toEqual({ status: 'succeeded', outputUrl: 'https://out/a.jpg', error: undefined, predictMs: 4200 })
  })
  it('replicate: recovers a prediction created before a crash by its unique input path', async () => {
    const since = new Date('2026-10-14T10:00:00Z')
    const f = vi.fn(async () => resp(200, { results: [
      { id: 'other', created_at: '2026-10-14T10:00:05Z', model: 'prunaai/p-image-upscale', input: { image: 'https://s/sign/print-assets/OTHERJOB/prepared.jpg?t=1' } },
      { id: 'old', created_at: '2026-10-14T08:00:00Z', model: 'prunaai/p-image-upscale', input: { image: 'https://s/sign/print-assets/JOB1/prepared.jpg?t=1' } },
      { id: 'mine', created_at: '2026-10-14T10:00:07Z', model: 'prunaai/p-image-upscale', input: { image: 'https://s/sign/print-assets/JOB1/prepared.jpg?t=2' } },
    ] }))
    const p = replicateProvider({ fetchImpl: f as any, env: { REPLICATE_API_TOKEN: 't' } })
    expect(await p.findRecent!({ pathMarker: 'print-assets/JOB1/', since })).toBe('mine')
    expect(await p.findRecent!({ pathMarker: 'print-assets/NOPE/', since })).toBeNull()
  })
  it('pruna direct: Model header, apikey, no upscale_mode, status polling and keyed download', async () => {
    const f = vi.fn(async (url: string) => String(url).includes('/status/') ? resp(200, { status: 'succeeded', generation_url: 'https://api.pruna.ai/v1/files/o' }) : resp(200, { id: 'pr1' }))
    const p = prunaProvider({ fetchImpl: f as any, env: { PRUNA_API_KEY: 'k' } })
    expect(await p.start({ imageUrl: 'https://x/y.jpg', targetMp: 6, settings: DEFAULT_SETTINGS })).toEqual({ id: 'pr1' })
    const [url, init] = f.mock.calls[0] as any
    expect(url).toBe('https://api.pruna.ai/v1/predictions'); expect(init.headers).toMatchObject({ apikey: 'k', Model: 'p-image-upscale' })
    expect(JSON.parse(init.body).input).not.toHaveProperty('upscale_mode')
    expect(JSON.parse(init.body).input.target).toBe(6)
    expect(await p.poll('pr1')).toMatchObject({ status: 'succeeded', outputUrl: 'https://api.pruna.ai/v1/files/o' })
    expect(p.findRecent).toBeUndefined()                               // documented gap
  })
  it('missing credentials fail clearly and never call out', async () => {
    const f = vi.fn()
    await expect(replicateProvider({ fetchImpl: f as any, env: {} }).start({ imageUrl: 'u', targetMp: 4, settings })).rejects.toMatchObject({ code: 'not_configured', retryable: false })
    await expect(prunaProvider({ fetchImpl: f as any, env: {} }).start({ imageUrl: 'u', targetMp: 4, settings })).rejects.toBeInstanceOf(ProviderError)
    expect(f).not.toHaveBeenCalled()
  })
  it('classifies provider failures as retryable or not', async () => {
    const mk = (status: number) => replicateProvider({ fetchImpl: (async () => resp(status, {})) as any, env: { REPLICATE_API_TOKEN: 't' } })
    await expect(mk(429).start({ imageUrl: 'u', targetMp: 4, settings })).rejects.toMatchObject({ retryable: true })
    await expect(mk(503).start({ imageUrl: 'u', targetMp: 4, settings })).rejects.toMatchObject({ retryable: true })
    await expect(mk(422).start({ imageUrl: 'u', targetMp: 4, settings })).rejects.toMatchObject({ retryable: false, code: 'rejected' })
    const dead = replicateProvider({ fetchImpl: (async () => { throw new Error('boom') }) as any, env: { REPLICATE_API_TOKEN: 't' } })
    await expect(dead.poll('x')).rejects.toMatchObject({ code: 'unavailable', retryable: true })
  })
  it('estimates cost from published tiers and says what the estimate rests on', () => {
    expect(estimateCostUsd(4, 'pruna').usd).toBe(0.005); expect(estimateCostUsd(36, 'replicate').usd).toBe(0.06); expect(estimateCostUsd(128, 'pruna').usd).toBe(0.12)
    expect(estimateCostUsd(6, 'replicate').basis).toMatch(/unverified/)
    expect(makeProvider('pruna', { env: {} }).name).toBe('pruna'); expect(makeProvider('replicate', { env: {} }).name).toBe('replicate')
  })
})
