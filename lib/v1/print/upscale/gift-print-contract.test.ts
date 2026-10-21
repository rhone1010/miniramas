// The manufacturing-ready file contract for the case that matters: the approved Fine Art 12 x 18 composition (portrait, 1050 x 1575 working size, as the repair produced it) becomes ONE
// 3600 x 5400 print file through prunaai/p-image-upscale, inspected, with the provider and model recorded; and nothing in the preparation can place a Prodigi order. The provider is a
// stand-in that enlarges locally (no paid call); the model constant and the provider routes are the real ones.

import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import fs from 'node:fs'
import { randomBytes } from 'node:crypto'

vi.mock('../../shared/outpaint', () => ({ outpaint: vi.fn() }))

import { runJob, type ProcessDeps } from './process'
import { memoryJobStore, memoryStorage } from './store'
import { DEFAULT_SETTINGS, type UpscaleSettings } from './settings'
import { REPLICATE_MODEL, PRUNA_MODEL } from './providers'
import type { UpscaleProvider } from './providers'
import type { UpscaleQa } from './qa'

const noise = async (w: number, h: number) => sharp(randomBytes(w * h * 3), { raw: { width: w, height: h, channels: 3 } }).blur(1.2).png().toBuffer()
const PASS: UpscaleQa = { verdict: 'pass', confidence: 0.92, checks: {} as any, defects: [], summary: 'ok', meta: { model: 'm', latency_ms: 1, images: 4 } }

interface Rig {
  deps: ProcessDeps; store: ReturnType<typeof memoryJobStore>; storage: ReturnType<typeof memoryStorage>
  provider: UpscaleProvider & { starts: number; polls: number; findRecent?: any; outputs: Map<string, Buffer> }
  inspect: ReturnType<typeof vi.fn>; settings: { current: UpscaleSettings }; clock: { t: number }; source: { buf: Buffer }
}

async function rig(opts: { source?: Buffer; settings?: Partial<UpscaleSettings>; listable?: boolean; sourceSize?: [number, number] } = {}): Promise<Rig> {
  const clock = { t: Date.parse('2026-10-14T10:00:00Z') }
  const store = memoryJobStore(() => clock.t), storage = memoryStorage()
  const settings = { current: { ...DEFAULT_SETTINGS, ...opts.settings } as UpscaleSettings }
  const [sw, sh] = opts.sourceSize ?? [1228, 1228]
  const source = { buf: opts.source ?? await noise(sw, sh) }
  let n = 0
  const provider: any = {
    name: 'replicate', starts: 0, polls: 0, outputs: new Map<string, Buffer>(),
    async start({ imageUrl, targetMp }: any) {
      provider.starts++
      const prepared = [...storage.files.entries()].find(([k]) => imageUrl.includes(k))![1]
      const md = await sharp(prepared).metadata()
      const s = Math.sqrt(targetMp * 1e6 / (md.width! * md.height!))
      const id = `pred${++n}`
      provider.outputs.set(id, await sharp(prepared).resize(Math.round(md.width! * s), Math.round(md.height! * s)).png().toBuffer())
      return { id }
    },
    async poll(id: string) { provider.polls++; return { status: 'succeeded', outputUrl: `https://out/${id}`, predictMs: 4000 } },
    async download(url: string) { return provider.outputs.get(url.split('/').pop()!)! },
  }
  if (opts.listable !== false) provider.findRecent = vi.fn(async () => null)
  const inspect = vi.fn(async () => PASS)
  const deps: ProcessDeps = {
    store, storage, now: () => clock.t, sleep: async () => { clock.t += 1000 }, pollMs: 1, budgetMs: 60_000,
    loadSource: async () => source.buf,
    loadSettings: async () => ({ settings: settings.current, version: 7, sources: ['global'] }),
    provider: () => provider, inspect: inspect as any, context: () => ({ series: 'portraits', effect: 'bronze' }),
    onAttention: vi.fn(async () => {}),
  }
  return { deps, store, storage, provider, inspect, settings, clock, source }
}
const enqueue = (r: Rig, over: Partial<{ size: string; finish: string }> = {}) =>
  r.store.enqueue({ order_id: 'o1', item_index: 0, render_id: 'render1', sku: 'GLOBAL-FAP-8X8', size: over.size ?? '8x8', finish: over.finish ?? 'fine_art', source_kind: 'owned' })

vi.setConfig({ testTimeout: 90_000 })

describe('print preparation for an approved Gift composition', () => {
  it('the upscaler is prunaai/p-image-upscale on both routes', () => {
    expect(REPLICATE_MODEL).toBe('prunaai/p-image-upscale'); expect(PRUNA_MODEL).toBe('p-image-upscale')
  })
  it('approved Fine Art 12 x 18 (1050 x 1575) -> one upscale call -> a 3600 x 5400 JPEG, inspected and approved, with the provider recorded', async () => {
    const r = await rig({ sourceSize: [1050, 1575] })
    const j = await r.store.enqueue({ order_id: 'o1', item_index: 0, render_id: 'gift:s:a', sku: 'GLOBAL-FAP-12X18', size: '12x18', finish: 'fine_art', source_kind: 'gift' })
    const { job, outcome } = await runJob(r.deps, j.id)
    expect(outcome).toBe('terminal'); expect(job!.status).toBe('approved'); expect(r.provider.starts).toBe(1)
    expect([job!.final_w, job!.final_h]).toEqual([3600, 5400]); expect(job).toMatchObject({ provider: 'replicate', qa_verdict: 'pass', submit_state: 'submitted' })
    const file = r.storage.files.get(`${j.id}/final.jpg`)!; const m = await sharp(file).metadata(); expect([m.width, m.height, m.format]).toEqual([3600, 5400, 'jpeg'])
    expect(r.deps.onAttention).not.toHaveBeenCalled()
  })
  it('nothing in the upscale pipeline can place a Prodigi order: no module under print/upscale imports the order client or calls its create function', () => {
    for (const f of fs.readdirSync('lib/v1/print/upscale').filter(x => /\.ts$/.test(x) && !/\.test\.ts$/.test(x))) {
      const t = fs.readFileSync('lib/v1/print/upscale/' + f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      expect(t, f).not.toMatch(/createProdigiOrder|placeOrder|\/v4\.0\/orders|prodigi-client'.*create/i)
    }
  })
})
