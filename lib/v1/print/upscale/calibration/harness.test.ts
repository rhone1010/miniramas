// End-to-end test of the calibration engine with a fake provider and fake inspector: no network, no cost.
// It proves the harness drives the production job processor, writes the artifacts and records, compares
// configurations, checkpoints, and resumes without repeating a call.

import { it, expect, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { randomBytes } from 'node:crypto'
import { execute, collect, type HarnessIO } from './harness'
import { renderGallery, type CaseSpec, type RunRecord } from './calibration-lib'
import type { UpscaleQa } from '../qa'
import { ProviderError, type UpscaleProvider } from '../providers'

const PASS = (summary = 'faithful'): UpscaleQa => ({ verdict: 'pass', confidence: 0.9, checks: {} as any, defects: [], summary, meta: { model: 'm', latency_ms: 1, images: 4 } })

async function fixtures() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upscale-cal-'))
  const img = (w: number, h: number) => sharp(randomBytes(w * h * 3), { raw: { width: w, height: h, channels: 3 } }).blur(1.5).jpeg().toBuffer()
  const a = path.join(dir, 'a.jpg'), b = path.join(dir, 'b.jpg')
  fs.writeFileSync(a, await img(900, 900)); fs.writeFileSync(b, await img(900, 600))
  const cases: CaseSpec[] = [
    { id: 'pets-01-jade', series: 'pets', effect: 'jade', path: a, ratio: '1:1', size: '8x8', finish: 'fine_art', nativeMp: 1.5 },
    { id: 'groups-02-bronze', series: 'groups', effect: 'bronze', path: b, ratio: '3:2', size: '8x12', finish: 'canvas', nativeMp: 1.5 },
  ]
  return { dir, cases }
}

function makeIO(over: Partial<HarnessIO> = {}) {
  const calls = { start: [] as any[], inspect: 0 }
  const outputs = new Map<string, Buffer>(); let n = 0
  const provider: UpscaleProvider = {
    name: 'replicate',
    async start(i) {
      calls.start.push(i.settings)
      const id = `p${++n}`
      const m = await sharp(Buffer.from(i.imageUrl.split(',')[1], 'base64')).metadata()          // the harness passes a data URI for Replicate
      const s = Math.sqrt(i.targetMp * 1e6 / (m.width! * m.height!))
      outputs.set(id, await sharp(Buffer.from(i.imageUrl.split(',')[1], 'base64')).resize(Math.round(m.width! * s), Math.round(m.height! * s)).png().toBuffer())
      return { id }
    },
    async poll(id) { return { status: 'succeeded', outputUrl: `https://out/${id}`, predictMs: 3000 } },
    async download(u) { return outputs.get(u.split('/').pop()!)! },
  }
  const io: HarnessIO = {
    providerName: 'replicate', configNames: ['off', 'details', 'realism'], pollMs: 1, retryWaitMs: 1,
    makeProvider: () => provider,
    inspect: async (_i, meter) => { calls.inspect++; meter.add(8000, 300); return PASS() }, ...over,
  }
  return { io, calls }
}

vi.setConfig({ testTimeout: 120_000 })

it('runs every case under every configuration through the production processor and records the lot', async () => {
  const { dir, cases } = await fixtures(); const out = path.join(dir, 'out'); fs.mkdirSync(out)
  const { io, calls } = makeIO(); const done = new Map<string, RunRecord>(), runs = path.join(out, 'runs.jsonl')
  await execute(io, cases, out, runs, done)
  expect(done.size).toBe(6); expect(calls.start).toHaveLength(6); expect(calls.inspect).toBe(6)
  // Each configuration reached the provider with exactly its own enhancement flags, everything else at the approved defaults.
  expect(calls.start.map(s => [s.enhance_details, s.enhance_realism])).toEqual([[false, false], [true, false], [false, true], [false, false], [true, false], [false, true]])
  expect(calls.start.every(s => s.output_format === 'jpg' && s.output_quality === 95 && s.disable_safety_checker === false && s.provider === 'replicate')).toBe(true)
  const r = done.get('pets-01-jade|details')!
  expect(r).toMatchObject({ status: 'approved', provider: 'replicate', qaVerdict: 'pass', targetMp: 6, final: [2400, 2400], upscaleMs: 3000, qaCostUsd: 0.023 })
  expect(r.params).toMatchObject({ enhance_details: true, enhance_realism: false, upscale_mode: 'target', target: 6 })
  expect(r.input[0]).toBeGreaterThan(1000); expect(r.output[0]!).toBeGreaterThanOrEqual(2400); expect(r.costUsdEst).toBe(0.01); expect(r.predictionId).toMatch(/^p\d+$/)
  const canvas = done.get('groups-02-bronze|off')!; expect(canvas.final).toEqual([3654, 2454])     // 8x12 canvas, landscape, with wrap
  // Artifacts: the raw upscaled file, a 100% crop of the result and of the reference, one reference preview per case.
  for (const f of [r.files.upscaled, r.files.cropResult, r.files.cropRef, r.files.previewRef]) expect(fs.existsSync(path.join(out, f!))).toBe(true)
  expect((await sharp(path.join(out, r.files.cropResult!)).metadata()).width).toBe(512)
  expect(fs.readFileSync(runs, 'utf8').trim().split('\n')).toHaveLength(6)
})

it('resumes without repeating a call, and repeats only what is missing', async () => {
  const { dir, cases } = await fixtures(); const out = path.join(dir, 'out'); fs.mkdirSync(out)
  const first = makeIO(), done = new Map<string, RunRecord>(), runs = path.join(out, 'runs.jsonl')
  await execute({ ...first.io, configNames: ['off'] }, cases, out, runs, done)
  expect(first.calls.start).toHaveLength(2)
  const again = makeIO()
  await execute({ ...again.io, configNames: ['off', 'details'] }, cases, out, runs, done)
  expect(again.calls.start).toHaveLength(2)                       // only the new 'details' runs
  expect(done.size).toBe(4)
})

it('API outages are recorded as such, not as quality judgments, and stop the spend after three in a row', async () => {
  const { dir, cases } = await fixtures(); const out = path.join(dir, 'out'); fs.mkdirSync(out)
  const { io } = makeIO()
  const down: UpscaleProvider = { ...io.makeProvider(), start: vi.fn(async () => { throw new ProviderError('rejected', 'HTTP 422', false, false) }) as any }
  const done = new Map<string, RunRecord>(), runs = path.join(out, 'runs.jsonl')
  const many: CaseSpec[] = [...cases, { ...cases[0], id: 'x3' }, { ...cases[0], id: 'x4' }]
  await execute({ ...io, makeProvider: () => down, configNames: ['off'] }, many, out, runs, done)
  const lines = fs.readFileSync(runs, 'utf8').trim().split('\n').map(l => JSON.parse(l))
  expect(lines.length).toBeLessThanOrEqual(3); expect(lines.every(l => l.qaVerdict === null)).toBe(true)
  expect(done.size).toBe(0)                                       // api errors are retried on resume, never banked as results
})

it('collects a complete table, with unrun cells marked, and renders a gallery from it', async () => {
  const { dir, cases } = await fixtures(); const out = path.join(dir, 'out'); fs.mkdirSync(out)
  const { io } = makeIO(); const done = new Map<string, RunRecord>()
  await execute({ ...io, configNames: ['off'] }, cases, out, path.join(out, 'runs.jsonl'), done)
  const rows = collect(cases, ['off', 'details'], done)
  expect(rows).toHaveLength(4); expect(rows.filter(r => r.status === 'not_run')).toHaveLength(2)
  const html = renderGallery(rows, { title: 'T', mode: 'live', generated: 'g', provider: 'replicate' })
  expect(html).toContain('not run'); expect(html).toContain('crop-result.jpg')
})
