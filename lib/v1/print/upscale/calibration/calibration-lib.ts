// lib/v1/print/upscale/calibration/calibration-lib.ts
//
// Pure helpers for the upscale calibration harness: choosing 20 representative images, the print size each
// one is tested at, the enhancement configurations to compare, the cost estimate, and the review gallery.
// No network, no file writes.

import { estimateCostUsd } from '../providers'
import { computeTarget } from '../target'
import { printPlan } from '../../geometry'
import { getLaunchSku, type PrintFinish, type PrintSize } from '../../sku-map'
import { DEFAULT_SETTINGS, type UpscaleSettings } from '../settings'

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

const csvEscape = (v: unknown) => { const s = v === undefined || v === null ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
export const toCsv = (rows: Record<string, unknown>[], cols: string[]) => [cols.join(','), ...rows.map(r => cols.map(c => csvEscape(r[c])).join(','))].join('\r\n') + '\r\n'

export type Series = 'portraits' | 'pets' | 'groups'
export interface Candidate { series: Series; effect: string; path: string; ratio: string }
export interface CaseSpec { id: string; series: Series; effect: string; path: string; ratio: string; size: PrintSize; finish: PrintFinish; nativeMp: number }

/** The comparison set. `off` is the production default; the others change exactly one enhancement. */
export const CONFIGS: Record<string, Partial<UpscaleSettings>> = {
  off:     { enhance_details: false, enhance_realism: false },
  details: { enhance_details: true,  enhance_realism: false },
  realism: { enhance_details: false, enhance_realism: true },
  both:    { enhance_details: true,  enhance_realism: true },
}
export const DEFAULT_CONFIGS = ['off', 'details', 'realism']

/** Targets chosen to cover paper, frame and canvas, small and large; XL (above ~36 MP) only on request. */
const SQUARE_SIZES: Array<[PrintSize, PrintFinish]> = [['8x8', 'fine_art'], ['12x12', 'premium'], ['16x16', 'canvas'], ['20x20', 'framed'], ['12x12', 'canvas'], ['16x16', 'fine_art'], ['8x8', 'premium']]
const RECT_SIZES: Array<[PrintSize, PrintFinish]> = [['8x12', 'fine_art'], ['12x18', 'premium'], ['16x24', 'canvas'], ['12x18', 'framed'], ['8x12', 'canvas'], ['16x24', 'fine_art']]
const XL: Array<[PrintSize, PrintFinish]> = [['20x30', 'fine_art']]

/**
 * 20 cases: 7 portraits, 6 groups, 7 pets, each a different effect where the pool allows, mixing square and
 * rectangular shapes. Deterministic: the same pool always yields the same set.
 */
export function selectCases(pool: Candidate[], opts: { nativeMp?: number; includeXl?: boolean } = {}): CaseSpec[] {
  const want: Record<Series, number> = { portraits: 7, groups: 6, pets: 7 }
  const out: CaseSpec[] = []
  const nativeMp = opts.nativeMp ?? 1.5
  for (const series of ['portraits', 'groups', 'pets'] as Series[]) {
    // One image per effect, alternating square and 2:3/3:2 so both geometries are exercised. Other shapes are left out
    // on purpose: they need an AI outpaint (a separate paid service) to fit a print, which is not what is being measured.
    const mine = pool.filter(c => c.series === series && ['1:1', '2:3', '3:2'].includes(c.ratio)).sort((x, y) => (x.effect + x.ratio).localeCompare(y.effect + y.ratio))
    const effects = [...new Set(mine.map(c => c.effect))]
    let nSq = 0, nRect = 0
    effects.forEach((effect, i) => {
      if (out.filter(o => o.series === series).length >= want[series]) return
      const sq = mine.find(c => c.effect === effect && c.ratio === '1:1'), rect = mine.find(c => c.effect === effect && c.ratio !== '1:1')
      const c = (i % 2 === 0 ? sq ?? rect : rect ?? sq)!
      const square = c.ratio === '1:1'
      const list = square ? SQUARE_SIZES : [...(opts.includeXl ? XL : []), ...RECT_SIZES]
      const [size, finish] = list[(square ? nSq++ : nRect++) % list.length]
      out.push({ id: `${series}-${String(out.length + 1).padStart(2, '0')}-${c.effect.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`, series, effect: c.effect, path: c.path, ratio: c.ratio, size, finish, nativeMp })
    })
  }
  return out
}

/** The pixel dimensions a render has in the live app (about `nativeMp` megapixels at its aspect). */
export function nativeDims(ratio: string, nativeMp: number): { w: number; h: number } {
  const [a, b] = ratio.split(':').map(Number)
  const h = Math.sqrt(nativeMp * 1e6 * b / a), w = h * a / b
  return { w: Math.round(w), h: Math.round(h) }
}

export interface PlanRow { caseId: string; config: string; targetMp: number; costUsd: number; qaCostUsd: number }

const QA_COST_PER_CALL = 0.012   // 4 high-detail images on gpt-4o; a stated estimate, replaced by measured usage after a run

export function buildPlan(cases: CaseSpec[], configs: string[], settings: UpscaleSettings = DEFAULT_SETTINGS): { rows: PlanRow[]; skipped: Array<{ caseId: string; reason: string }> } {
  const rows: PlanRow[] = [], skipped: Array<{ caseId: string; reason: string }> = []
  for (const c of cases) {
    let target
    try {
      const d = nativeDims(c.ratio, c.nativeMp)
      const plan = printPlan(d.w, d.h, getLaunchSku(c.size, c.finish))
      target = computeTarget(plan, settings.target_ppi, settings.max_megapixels)
    } catch (e) { skipped.push({ caseId: c.id, reason: e instanceof Error ? e.message : String(e) }); continue }
    for (const config of configs) rows.push({ caseId: c.id, config, targetMp: target.targetMp, costUsd: estimateCostUsd(target.targetMp, settings.provider).usd, qaCostUsd: QA_COST_PER_CALL })
  }
  return { rows, skipped }
}

export function estimateTotals(rows: PlanRow[]) {
  const upscale = rows.reduce((s, r) => s + r.costUsd, 0), qa = rows.reduce((s, r) => s + r.qaCostUsd, 0)
  return { calls: rows.length, upscaleUsd: upscale, qaUsd: qa, expectedUsd: upscale + qa, worstUsd: (upscale + qa) * 1.25 }
}

// ── gallery ────────────────────────────────────────────────────────────────
export interface RunRecord {
  caseId: string; series: string; effect: string; size: string; finish: string; config: string
  params: Record<string, unknown>; provider: string | null; predictionId: string | null
  input: [number | null, number | null]; output: [number | null, number | null]; final: [number | null, number | null]
  targetMp: number | null; sourcePpi: number | null; upscaleMs: number | null; wallMs: number; costUsdEst: number | null; costBasis: string | null
  status: string; reviewReason: string | null; error: string | null; warnings: Array<{ code: string; detail: string }>
  qaVerdict: string | null; qaSummary: string | null; qaDefects: Array<{ code: string; severity: string; explanation: string }>; qaCostUsd: number | null
  files: { reference?: string; upscaled?: string; cropRef?: string; cropResult?: string; previewRef?: string; previewResult?: string }
}

export function renderGallery(records: RunRecord[], meta: { title: string; mode: 'dry-run' | 'live'; generated: string; provider: string }): string {
  const cases = [...new Set(records.map(r => r.caseId))]
  const badge = (v: string | null) => `<span class="b ${esc(v ?? 'none')}">${esc((v ?? 'not run').replace(/_/g, ' '))}</span>`
  const cell = (r: RunRecord) => `<div class="cfg" data-case="${esc(r.caseId)}" data-config="${esc(r.config)}">
    <h4>${esc(r.config)} ${badge(r.qaVerdict ?? r.status)}</h4>
    ${r.files.cropResult ? `<a href="${esc(r.files.cropResult)}" target="_blank"><img loading="lazy" src="${esc(r.files.cropResult)}" alt="100% crop"></a>` : '<div class="none">no image</div>'}
    <p class="m">enhance details ${r.params.enhance_details ? 'on' : 'off'} · realism ${r.params.enhance_realism ? 'on' : 'off'} · q${esc(r.params.output_quality)} ${esc(r.params.output_format)}</p>
    <p class="m">${r.input.join('×')} → ${r.output.join('×')} · target ${r.targetMp ?? '–'} MP · ${r.upscaleMs != null ? (r.upscaleMs / 1000).toFixed(1) + ' s' : '–'} (wall ${(r.wallMs / 1000).toFixed(1)} s) · est. $${r.costUsdEst ?? '–'}${r.qaCostUsd ? ` + QA $${r.qaCostUsd}` : ''}</p>
    ${r.qaSummary ? `<p>${esc(r.qaSummary)}</p>` : ''}${r.qaDefects.map(d => `<p class="m">${d.severity === 'major' ? '✖' : '•'} ${esc(d.code)}: ${esc(d.explanation)}</p>`).join('')}
    ${r.warnings.map(w => `<p class="m">⚠ ${esc(w.detail)}</p>`).join('')}${r.error ? `<p class="err">${esc(r.error)}</p>` : ''}${r.reviewReason ? `<p class="m">held: ${esc(r.reviewReason)}</p>` : ''}
    <label>Your judgment <select data-k="verdict"><option value="">—</option><option value="better">Better than the others</option><option value="equal">Fine / same</option><option value="worse">Worse</option><option value="unacceptable">Unacceptable</option></select></label>
    <label>QA call <select data-k="qa_call"><option value="">—</option><option value="correct">Correct</option><option value="too_strict">Too strict</option><option value="too_lenient">Too lenient</option></select></label>
  </div>`
  const block = (id: string) => {
    const rs = records.filter(r => r.caseId === id), f = rs[0]
    return `<article class="case" data-case="${esc(id)}"><header><h3>${esc(f.series)} · ${esc(f.effect)} · ${esc(f.finish)} ${esc(f.size)}</h3>
      <p class="m">${esc(id)} · source detail ${f.sourcePpi ?? '–'} PPI at this size</p></header>
      <div class="pair">${f.files.previewRef ? `<figure><img loading="lazy" src="${esc(f.files.previewRef)}" alt="reference"><figcaption>Aspect-corrected artwork</figcaption></figure>` : ''}
        ${f.files.cropRef ? `<figure><img loading="lazy" src="${esc(f.files.cropRef)}" alt="reference crop"><figcaption>Reference, close crop (enlarged to match)</figcaption></figure>` : ''}</div>
      <div class="cfgs">${rs.map(cell).join('')}</div>
      <label>Best configuration <select data-k="best"><option value="">—</option>${rs.map(r => `<option>${esc(r.config)}</option>`).join('')}<option>none acceptable</option></select></label>
      <input data-k="note" placeholder="note"></article>`
  }
  const data = { generated: meta.generated, mode: meta.mode, provider: meta.provider, records: records.map(r => ({ ...r, files: undefined })) }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(meta.title)}</title>
<style>:root{--bg:#1d1814;--fg:#f0e6d2;--card:#2a231d;--m:#b8a98f;--line:#4a3e33}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif}
header.top{padding:16px 20px;border-bottom:1px solid var(--line)}h1{margin:0 0 4px;font-size:20px}.m{color:var(--m);margin:3px 0}.mode{display:inline-block;padding:2px 8px;border-radius:4px;background:${meta.mode === 'live' ? '#2f5d3a' : '#6b4b1e'}}
main{padding:16px 20px;display:grid;gap:18px}.case{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px}.case h3{margin:0;font-size:15px}
.pair{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0}.pair img{max-width:340px;display:block;border-radius:4px}.cfgs{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin:8px 0}
.cfg{border:1px solid var(--line);border-radius:6px;padding:8px}.cfg h4{margin:0 0 6px}.cfg img{width:100%;display:block;border-radius:4px}.none{padding:30px;text-align:center;color:var(--m)}
.b{display:inline-block;padding:1px 8px;border-radius:10px;font-size:12px;background:#555}.b.pass,.b.approved{background:#2f5d3a}.b.defect,.b.failed{background:#8a2f2f}.b.uncertain,.b.review{background:#7a6420}
.err{color:#e08a8a}label{display:block;margin:6px 0 2px;color:var(--m)}select,input{background:#1d1814;color:var(--fg);border:1px solid var(--line);border-radius:4px;padding:3px}
button{background:#74313a;color:#f3e6ce;border:0;border-radius:6px;padding:8px 14px;cursor:pointer;margin-right:8px}</style></head><body>
<header class="top"><h1>${esc(meta.title)}</h1><span class="mode">${meta.mode}</span> <span class="m">${cases.length} images · ${records.length} runs · provider ${esc(meta.provider)} · ${esc(meta.generated)}</span>
<p class="m">Model predictions and your judgments are kept apart: your choices live in this browser until exported, keyed by case and configuration. Nothing here approves, prints or orders anything.</p>
<button id="x">Export judgments + results (JSON)</button><button id="xc">Export (CSV)</button></header>
<main>${cases.map(block).join('')}</main>
<script>const DATA=${JSON.stringify(data).replace(/</g, '\\u003c')};const K='upscale-calibration:'+${JSON.stringify(meta.generated)};let S={};try{S=JSON.parse(localStorage.getItem(K)||'{}')}catch(e){}
const key=(c,f)=>c+'|'+f;
document.querySelectorAll('.cfg').forEach(el=>{const k=key(el.dataset.case,el.dataset.config);el.querySelectorAll('[data-k]').forEach(i=>{i.value=(S[k]||{})[i.dataset.k]||'';i.addEventListener('change',()=>{S[k]=S[k]||{};S[k][i.dataset.k]=i.value;try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}})})});
document.querySelectorAll('.case').forEach(el=>{const k='case|'+el.dataset.case;el.querySelectorAll(':scope > [data-k], :scope > label [data-k]').forEach(i=>{i.value=(S[k]||{})[i.dataset.k]||'';i.addEventListener('change',()=>{S[k]=S[k]||{};S[k][i.dataset.k]=i.value;try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}})})});
const rows=()=>DATA.records.map(r=>({...r,human:{verdict:(S[key(r.caseId,r.config)]||{}).verdict||'',qa_call:(S[key(r.caseId,r.config)]||{}).qa_call||'',best_for_case:(S['case|'+r.caseId]||{}).best||'',note:(S['case|'+r.caseId]||{}).note||''}}));
const dl=(n,t,m)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:m}));a.download=n;a.click()};
document.getElementById('x').onclick=()=>dl('upscale-calibration-judgments.json',JSON.stringify({generated:DATA.generated,mode:DATA.mode,provider:DATA.provider,runs:rows()},null,1),'application/json');
document.getElementById('xc').onclick=()=>{const q=v=>{v=v==null?'':String(v);return /[",\\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};const cols=['caseId','series','effect','size','finish','config','targetMp','upscaleMs','costUsdEst','qaVerdict','status','human_verdict','human_qa_call','best_for_case','note'];
const lines=[cols.join(',')].concat(rows().map(r=>[r.caseId,r.series,r.effect,r.size,r.finish,r.config,r.targetMp,r.upscaleMs,r.costUsdEst,r.qaVerdict,r.status,r.human.verdict,r.human.qa_call,r.human.best_for_case,r.human.note].map(q).join(',')));dl('upscale-calibration-judgments.csv',lines.join('\\r\\n')+'\\r\\n','text/csv')}</script></body></html>`
}
