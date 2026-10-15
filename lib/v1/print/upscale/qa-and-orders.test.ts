import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { randomBytes } from 'node:crypto'
import { decideQa, inspectUpscale, buildInspectionImages, QA_CHECKS, QA_SYSTEM_PROMPT, type QaCheck, type QaDefect } from './qa'
import { checkFinalAsset } from './checks'
import { enqueueOrderJobs, summarizeJobs, AssetsNotReadyError } from './orders'
import { memoryJobStore } from './store'

const checks = (over: Partial<Record<(typeof QA_CHECKS)[number], Partial<QaCheck>>> = {}) =>
  Object.fromEntries(QA_CHECKS.map(k => [k, { status: 'pass', confidence: 0.9, note: 'ok', ...(over[k] || {}) }])) as Record<(typeof QA_CHECKS)[number], QaCheck>
const defect = (o: Partial<QaDefect> = {}): QaDefect => ({ code: 'texture_altered', severity: 'major', confidence: 0.9, explanation: 'x', ...o })

describe('QA policy: only a clean pass is automatic', () => {
  it('pass', () => expect(decideQa({ checks: checks(), defects: [] }).verdict).toBe('pass'))
  it('a clear failed check is a defect', () => expect(decideQa({ checks: checks({ facial_features: { status: 'fail', confidence: 0.85 } }), defects: [] }).verdict).toBe('defect'))
  it('a major defect above 0.6 is a defect', () => expect(decideQa({ checks: checks(), defects: [defect({ confidence: 0.7 })] }).verdict).toBe('defect'))
  it('anything unsure is uncertain, never pass', () => {
    expect(decideQa({ checks: checks({ geometry: { status: 'uncertain', confidence: 0.4 } }), defects: [] }).verdict).toBe('uncertain')
    expect(decideQa({ checks: checks(), defects: [defect({ severity: 'minor', confidence: 0.3 })] }).verdict).toBe('uncertain')
    expect(decideQa({ checks: checks({ artifacts: { status: 'fail', confidence: 0.4 } }), defects: [] }).verdict).toBe('uncertain')
    expect(decideQa({ checks: checks(), defects: [defect({ confidence: 0.3 })] }).verdict).toBe('uncertain')
  })
})

describe('visual inspection', () => {
  const noise = (w: number, h: number) => sharp(randomBytes(w * h * 3), { raw: { width: w, height: h, channels: 3 } }).blur(1).jpeg().toBuffer()
  const reply = (o: any) => vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(o) } }] }), { status: 200 }))
  const good = { checks: checks(), defects: [], summary: 'faithful' }
  it('sends the reference and the enlargement at the same size, plus matching crops', async () => {
    const ref = await noise(600, 600), res = await noise(1800, 1800)
    const imgs = await buildInspectionImages(ref, res)
    expect(imgs).toHaveLength(4)
    const dims = await Promise.all(imgs.map(async u => { const m = await sharp(Buffer.from(u.split(',')[1], 'base64')).metadata(); return [m.width, m.height] }))
    expect(dims[0]).toEqual(dims[1]); expect(dims[2]).toEqual(dims[3]); expect(dims[2]).toEqual([512, 512])
  })
  it('approves a clean result and posts a strict schema request with four images', async () => {
    const f = reply(good)
    const out = await inspectUpscale({ reference: await noise(400, 400), result: await noise(1200, 1200), context: { series: 'pets', effect: 'bronze' } }, { apiKey: 'k', fetchImpl: f as any })
    expect(out.verdict).toBe('pass'); expect(out.meta.images).toBe(4)
    const body = JSON.parse((f.mock.calls[0] as any)[1].body)
    expect(body.response_format.json_schema.strict).toBe(true); expect(body.messages[1].content.filter((p: any) => p.type === 'image_url')).toHaveLength(4)
    expect(body.messages[1].content[0].text).toContain('bronze'); expect(QA_SYSTEM_PROMPT).toMatch(/REFERENCE/)
  })
  it('never throws: outages, timeouts and bad replies are errors for a person, not verdicts', async () => {
    const a = await noise(300, 300), b = await noise(900, 900)
    expect((await inspectUpscale({ reference: a, result: b }, { apiKey: 'k', fetchImpl: vi.fn(async () => new Response('x', { status: 500 })) as any })).meta.error).toBe('http_error')
    expect((await inspectUpscale({ reference: a, result: b }, { apiKey: 'k', fetchImpl: vi.fn(async () => { throw new TypeError('down') }) as any })).meta.error).toBe('network')
    const hang = vi.fn((_u: any, i: any) => new Promise((_r, rej) => i.signal.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' })))))
    expect((await inspectUpscale({ reference: a, result: b }, { apiKey: 'k', timeoutMs: 20, fetchImpl: hang as any })).meta.error).toBe('timeout')
    expect((await inspectUpscale({ reference: a, result: b }, { apiKey: 'k', fetchImpl: reply({ checks: {}, defects: [] }) as any })).meta.error).toBe('schema_invalid')
    vi.stubEnv('OPENAI_API_KEY', ''); expect((await inspectUpscale({ reference: a, result: b }, { fetchImpl: vi.fn() as any })).meta.error).toBe('no_api_key'); vi.unstubAllEnvs()
    const out = await inspectUpscale({ reference: Buffer.alloc(0), result: b }, { apiKey: 'k' })
    expect(out).toMatchObject({ verdict: 'error' })
  })
})

describe('deterministic file checks', () => {
  const noise = (w: number, h: number) => sharp(randomBytes(w * h * 3), { raw: { width: w, height: h, channels: 3 } }).blur(1)
  const jpeg444 = async (w: number, h: number) => (await noise(w, h).toColourspace('srgb').jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer())
  it('accepts a correct sRGB 4:4:4 JPEG of the exact size', async () => {
    const r = await checkFinalAsset(await jpeg444(800, 600), { w: 800, h: 600 })
    expect(r).toMatchObject({ ok: true, errors: [] }); expect(r.facts.sha256).toHaveLength(64)
  })
  it('rejects wrong size, format, subsampling, blank, truncated and tiny files', async () => {
    expect((await checkFinalAsset(await jpeg444(800, 600), { w: 801, h: 600 })).errors).toContain('wrong_dimensions')
    expect((await checkFinalAsset(await noise(800, 600).png().toBuffer(), { w: 800, h: 600 })).errors).toContain('not_jpeg')
    expect((await checkFinalAsset(await noise(800, 600).jpeg({ chromaSubsampling: '4:2:0' }).toBuffer(), { w: 800, h: 600 })).errors).toContain('chroma_not_444')
    const flat = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#808080' } }).jpeg({ chromaSubsampling: '4:4:4' }).toBuffer()
    expect((await checkFinalAsset(flat, { w: 800, h: 600 })).errors).toEqual(expect.arrayContaining(['blank_image']))
    const good = await jpeg444(800, 600)
    expect((await checkFinalAsset(good.subarray(0, Math.floor(good.length / 2)), { w: 800, h: 600 })).ok).toBe(false)
    expect((await checkFinalAsset(Buffer.from('nope'), { w: 1, h: 1 })).errors).toEqual(expect.arrayContaining(['file_too_small']))
    expect((await checkFinalAsset(Buffer.alloc(0), { w: 1, h: 1 })).ok).toBe(false)
  })
})

describe('order-level job handling', () => {
  const order: any = { id: 'o1', items: [{ renderId: 'a', size: '8x8', finish: 'fine_art' }, { renderId: 'b', size: '8x12', finish: 'canvas' }] }
  it('enqueues one job per line, idempotently, with the right source kind', async () => {
    const store = memoryJobStore()
    const first = await enqueueOrderJobs(store, order, true), again = await enqueueOrderJobs(store, order, true)
    expect(first.map(j => j.id)).toEqual(again.map(j => j.id)); expect(store.jobs.size).toBe(2)
    expect(first.map(j => j.sku)).toEqual(['GLOBAL-FAP-8X8', 'GLOBAL-CAN-8X12']); expect(first.every(j => j.source_kind === 'owned')).toBe(true)
    expect((await enqueueOrderJobs(memoryJobStore(), order, false))[0].source_kind).toBe('url')
  })
  it('summarises worst news first and approves only when every line is approved', () => {
    const j = (i: number, status: string, extra: object = {}) => ({ item_index: i, status, error: null, review_reason: null, ...extra }) as any
    expect(summarizeJobs([j(0, 'approved')], 2)).toMatchObject({ state: 'pending', detail: 'jobs_missing' })
    expect(summarizeJobs([j(0, 'approved'), j(1, 'qa')], 2).state).toBe('pending')
    expect(summarizeJobs([j(0, 'approved'), j(1, 'review', { review_reason: 'qa_uncertain' })], 2)).toMatchObject({ state: 'review' })
    expect(summarizeJobs([j(0, 'review'), j(1, 'failed', { error: 'x' })], 2).state).toBe('failed')
    expect(summarizeJobs([j(0, 'approved'), j(1, 'rejected')], 2).state).toBe('rejected')
    expect(summarizeJobs([j(0, 'approved'), j(1, 'approved')], 2).state).toBe('approved')
    expect(new AssetsNotReadyError('review', '1:qa_uncertain').message).toContain('asset_not_ready:review')
  })
})
