// lib/v1/print/upscale/calibration/harness.ts
//
// The runner's engine, separated so it can be tested with fakes and no network: it drives the production job
// processor over cases x configurations, writes the artifacts, and records one result per run.

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { runJob, type ProcessDeps } from '../process'
import { memoryJobStore, memoryStorage } from '../store'
import { DEFAULT_SETTINGS, type UpscaleSettings } from '../settings'
import type { UpscaleProvider } from '../providers'
import { buildInspectionImages, type UpscaleQa } from '../qa'
import { CONFIGS, nativeDims, type CaseSpec, type RunRecord } from './calibration-lib'
import { printPlan } from '../../geometry'
import { getLaunchSku } from '../../sku-map'

const OPENAI_PRICE = { in: 2.5, out: 10 }        // gpt-4o, USD per 1M tokens (OpenAI published pricing)

export interface HarnessIO {
  providerName: 'replicate' | 'pruna'
  configNames: string[]
  makeProvider(): UpscaleProvider
  inspect(input: { reference: Buffer; result: Buffer; context: { series?: string; effect?: string } }, meter: { add(inTokens: number, outTokens: number): void }): Promise<UpscaleQa>
  pollMs?: number
  retryWaitMs?: number
}

export function collect(cases: CaseSpec[], configNames: string[], done: Map<string, RunRecord>): RunRecord[] {
  const rows: RunRecord[] = []
  for (const c of cases) for (const config of configNames) {
    rows.push(done.get(c.id + '|' + config) ?? {
      caseId: c.id, series: c.series, effect: c.effect, size: c.size, finish: c.finish, config, params: { ...CONFIGS[config], output_format: 'jpg', output_quality: 95 }, provider: null, predictionId: null,
      input: [null, null], output: [null, null], final: [null, null], targetMp: null, sourcePpi: null, upscaleMs: null, wallMs: 0, costUsdEst: null, costBasis: null,
      status: 'not_run', reviewReason: null, error: null, warnings: [], qaVerdict: null, qaSummary: null, qaDefects: [], qaCostUsd: null, files: {},
    })
  }
  return rows
}

/** The provider, fed from the in-memory file store: Replicate takes a data URI, Pruna takes its own uploaded file URL. */
export function viaMemory(p: UpscaleProvider, storage: ReturnType<typeof memoryStorage>): UpscaleProvider {
  const bytesFor = (url: string) => { const m = /print-assets\/([^?]+)/.exec(url); const b = m && storage.files.get(m[1]); if (!b) throw new Error('prepared image not found'); return b }
  return { ...p, name: p.name,
    start: async i => p.start({ ...i, imageUrl: p.upload ? await p.upload(bytesFor(i.imageUrl)) : 'data:image/jpeg;base64,' + bytesFor(i.imageUrl).toString('base64') }),
    poll: id => p.poll(id), download: u => p.download(u), findRecent: p.findRecent?.bind(p) }
}

export async function execute(io: HarnessIO, cases: CaseSpec[], out: string, runsPath: string, done: Map<string, RunRecord>) {
  let consecutiveErrors = 0
  for (const c of cases) {
    const nd = nativeDims(c.ratio, c.nativeMp)
    const source = await sharp(c.path).resize(nd.w, nd.h, { fit: 'fill', kernel: 'lanczos3' }).jpeg({ quality: 92 }).toBuffer()   // what the app actually stores: ~1.5 MP
    for (const config of io.configNames) {
      const key = c.id + '|' + config
      if (done.has(key)) continue
      if (consecutiveErrors >= 3) { console.error('STOPPED: 3 consecutive API errors; not spending further.'); return }
      const store = memoryJobStore(), storage = memoryStorage()
      const settings: UpscaleSettings = { ...DEFAULT_SETTINGS, provider: io.providerName, ...CONFIGS[config] }
      let qaIn = 0, qaOut = 0
      const meter = { add: (i: number, o: number) => { qaIn += i; qaOut += o } }
      const deps: ProcessDeps = {
        store, storage, loadSource: async () => source,
        loadSettings: async () => ({ settings, version: 0, sources: ['calibration:' + config] }),
        provider: () => viaMemory(io.makeProvider(), storage),
        inspect: i => io.inspect(i, meter),
        context: () => ({ series: c.series, effect: c.effect }),
        pollMs: io.pollMs ?? 2500, budgetMs: 180_000,
      }
      const t0 = Date.now()
      const job0 = await store.enqueue({ order_id: 'calibration', item_index: 0, render_id: c.id, sku: getLaunchSku(c.size, c.finish).sku, size: c.size, finish: c.finish, source_kind: 'owned' })
      let job = job0
      for (let i = 0; i < 12; i++) {
        const r = await runJob(deps, job0.id)
        job = (await store.get(job0.id))!
        if (r.outcome === 'terminal' || ['approved', 'review', 'rejected', 'failed'].includes(job.status)) break
        await new Promise(r2 => setTimeout(r2, io.retryWaitMs ?? 5000))
      }
      const wall = Date.now() - t0
      const dir = path.join(out, c.id, config); fs.mkdirSync(dir, { recursive: true })
      const files: RunRecord['files'] = {}
      const w = (name: string, buf: Buffer, key2?: keyof RunRecord['files']) => { fs.writeFileSync(path.join(dir, name), buf); if (key2) files[key2] = `${c.id}/${config}/${name}`.split(path.sep).join('/') }
      try {
        if (job.output_path && storage.files.has(job.output_path)) w(path.basename(job.output_path), storage.files.get(job.output_path)!, 'upscaled')
        if (job.final_path && job.input_path && storage.files.has(job.final_path)) {
          const final = storage.files.get(job.final_path)!, ref = storage.files.get(job.input_path)!
          const plan = printPlan(job.input_w!, job.input_h!, getLaunchSku(c.size, c.finish))
          const front = await sharp(final).extract({ left: plan.extension.left, top: plan.extension.top, width: plan.front.w, height: plan.front.h }).jpeg({ quality: 95 }).toBuffer()
          const imgs = await buildInspectionImages(ref, front)
          const dec = (u: string) => Buffer.from(u.split(',')[1], 'base64')
          w('crop-result.jpg', dec(imgs[3]), 'cropResult'); w('crop-reference.jpg', dec(imgs[2]), 'cropRef')
          const sharedRef = path.join(out, c.id, 'reference-preview.jpg')
          if (!fs.existsSync(sharedRef)) fs.writeFileSync(sharedRef, dec(imgs[0]))
          files.previewRef = `${c.id}/reference-preview.jpg`; files.cropRef = `${c.id}/${config}/crop-reference.jpg`
        }
      } catch (e) { console.error('artifact write failed:', e instanceof Error ? e.message : e) }
      const qa = job.qa as any
      const rec: RunRecord = {
        caseId: c.id, series: c.series, effect: c.effect, size: c.size, finish: c.finish, config,
        params: { ...(job.settings_snapshot ?? {}), upscale_mode: 'target', target: job.target_mp }, provider: job.provider, predictionId: job.prediction_id,
        input: [job.input_w, job.input_h], output: [job.output_w, job.output_h], final: [job.final_w, job.final_h],
        targetMp: job.target_mp, sourcePpi: job.source_ppi, upscaleMs: job.upscale_ms, wallMs: wall, costUsdEst: job.cost_usd_est, costBasis: job.cost_basis,
        status: job.status === 'failed' && /^(rejected|unavailable|not_configured|bad_response|poll_failed|provider_|too_many_attempts)/.test(job.error ?? '') ? 'api_error' : job.status, reviewReason: job.review_reason, error: job.error, warnings: job.warnings,
        qaVerdict: job.qa_verdict, qaSummary: qa?.summary ?? null, qaDefects: (qa?.defects ?? []).map((d: any) => ({ code: d.code, severity: d.severity, explanation: d.explanation })),
        qaCostUsd: qaIn || qaOut ? +((qaIn * OPENAI_PRICE.in + qaOut * OPENAI_PRICE.out) / 1e6).toFixed(4) : null, files,
      }
      fs.appendFileSync(runsPath, JSON.stringify(rec) + '\n')
      if (rec.status !== 'api_error') done.set(key, rec)
      consecutiveErrors = rec.status === 'api_error' ? consecutiveErrors + 1 : 0
      console.log(`${c.id} [${config}] ${rec.status} qa=${rec.qaVerdict ?? '-'} target=${rec.targetMp ?? '-'}MP out=${rec.output.join('x')} ${(wall / 1000).toFixed(1)}s`)
    }
  }
}
