// lib/bench/bench-report.ts
//
// Implementation document generator. Turns a finished (or paused) run
// into a markdown doc that guides final-product decisions: viability
// scorecard vs targets, matrix breakdown, failure taxonomy with
// synthesized prompt recommendations, classification/redirect stats,
// and a prioritized action list.
//
// The doc is the deliverable — written for a future Engine/UI Claude
// or human to act on without re-querying the database. Numbers first,
// synthesis second, raw suggestion samples last (for audit).
//
// Synthesis: per fail category, all triage suggestions are sent to
// gpt-4o-mini to consolidate into 1-3 concrete prompt directives
// (positive framing enforced in the synthesis prompt). Optional —
// `synthesize: false` skips the model call and lists raw counts only.
//
// Usage:
//   npm run bench:report -- --run <run_id>            (writes ./bench-reports/)
//   or call generateImplementationDoc() from the admin API.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import * as fs from 'fs/promises'
import * as path from 'path'

import { FAIL_CATEGORIES } from './bench-shared'

// ─── VIABILITY TARGETS (single source of truth) ──────────────────
// These are the launch bar. The scorecard grades every run against
// them. Change them here, in one place, when product moves the bar.

export const VIABILITY_TARGETS = {
  intakeAcceptRate:   0.75,   // ≥75% of realistic photos accepted
  passRate:           0.90,   // ≥90% of accepted intakes pass within retry cap
  firstPassRate:      0.70,   // ≥70% pass on attempt 1 (margin metric)
  aestheticFloorPct:  0.05,   // ≤5% of renders score aesthetic < 5
  redirectAccuracyMin: 0.90,  // ≥90% of redirects judged correct in human review
} as const

const RENDER_BUCKET = 'bench-renders'

interface ReportKeys {
  supabaseUrl:        string
  supabaseServiceKey: string
  openaiApiKey:       string
}

// ─── ENTRY POINT ─────────────────────────────────────────────────

export async function generateImplementationDoc(input: {
  keys:       ReportKeys
  runId:      string
  outDir?:    string       // default ./bench-reports
  synthesize?: boolean     // default true
  uploadToStorage?: boolean // default true — sets run.report_storage_key
}): Promise<{ filePath: string; storageKey: string | null }> {
  const sb = createClient(input.keys.supabaseUrl, input.keys.supabaseServiceKey, {
    auth: { persistSession: false },
  })
  const synthesize = input.synthesize !== false

  const { data: run, error } = await sb.from('batch_runs').select('*').eq('id', input.runId).single()
  if (error || !run) throw new Error(`run not found: ${error?.message}`)

  const { data: items } = await sb.from('batch_items')
    .select('*').eq('run_id', input.runId).neq('status', 'pending').neq('status', 'running')
  const all: any[] = items ?? []

  // ── Core counts ────────────────────────────────────────────────
  const n = {
    total:      all.length,
    redirected: all.filter(i => i.status === 'redirected').length,
    intakeRej:  all.filter(i => i.status === 'intake_rejected').length,
    passed:     all.filter(i => i.status === 'passed').length,
    failed:     all.filter(i => i.status === 'failed').length,
    errored:    all.filter(i => i.status === 'errored').length,
  }
  const generated  = n.passed + n.failed
  const intakePool = generated + n.intakeRej          // items that reached intake (post-redirect)
  const firstPass  = all.filter(i => i.first_pass && i.status === 'passed').length
  const aestheticSub5 = all.filter(i => i.aesthetic_score != null && i.aesthetic_score < 5).length
  const spentDollars  = (run.spent_cents / 100)
  const costPerPassed = n.passed > 0 ? spentDollars / n.passed : null

  const metrics = {
    intakeAcceptRate: intakePool > 0 ? generated / intakePool : null,
    passRate:         generated > 0 ? n.passed / generated : null,
    firstPassRate:    generated > 0 ? firstPass / generated : null,
    aestheticFloorPct: generated > 0 ? aestheticSub5 / generated : null,
  }

  // ── Matrix breakdown ───────────────────────────────────────────
  const matrixKeys = [...new Set(all.map(i => i.matrix_key))].sort()
  const matrixRows = matrixKeys.map(key => {
    const cell = all.filter(i => i.matrix_key === key)
    const cellGen = cell.filter(i => i.status === 'passed' || i.status === 'failed')
    const cellPassed = cell.filter(i => i.status === 'passed').length
    return {
      key,
      total: cell.length,
      passed: cellPassed,
      failed: cellGen.length - cellPassed,
      passRate: cellGen.length > 0 ? cellPassed / cellGen.length : null,
      avgFidelity:  avg(cellGen.map(i => i.fidelity_score).filter(isNum)),
      avgAesthetic: avg(cellGen.map(i => i.aesthetic_score).filter(isNum)),
      costCents: cell.reduce((s, i) => s + (i.cost_cents || 0), 0),
    }
  })

  // ── Failure taxonomy + synthesis ───────────────────────────────
  const fails = all.filter(i => i.status === 'failed' && i.fail_category)
  const categoryGroups = FAIL_CATEGORIES
    .map(cat => ({
      category: cat,
      items: fails.filter(i => i.fail_category === cat),
    }))
    .filter(g => g.items.length > 0)
    .sort((a, b) => b.items.length - a.items.length)

  const syntheses: Array<{ category: string; count: number; pct: number; recommendation: string; samples: string[] }> = []
  for (const group of categoryGroups) {
    const suggestions = group.items.map(i => i.prompt_suggestion).filter(Boolean) as string[]
    let recommendation = '(synthesis disabled — see samples)'
    if (synthesize && suggestions.length > 0) {
      try {
        recommendation = await synthesizeRecommendation({
          category: group.category,
          suggestions,
          openaiApiKey: input.keys.openaiApiKey,
        })
      } catch (e: unknown) {
        recommendation = `(synthesis failed: ${e instanceof Error ? e.message : 'unknown'})`
      }
    }
    syntheses.push({
      category: group.category,
      count: group.items.length,
      pct: fails.length > 0 ? group.items.length / fails.length : 0,
      recommendation,
      samples: suggestions.slice(0, 5),
    })
  }

  // ── Classification / redirect stats ───────────────────────────
  const classified = all.filter(i => i.detected_subject)
  const subjectCounts = countBy(classified, i => i.detected_subject)
  const mismatches = classified.filter(i => i.series_match === false)
  const redirectTargets = countBy(mismatches.filter(i => i.redirect_series), i => i.redirect_series)
  const reviewedRedirects = mismatches.filter(i => i.reviewed)
  const redirectOverturns = reviewedRedirects.filter(i => i.review_verdict === 'overturn_pass').length

  // Wrong-Series render outcomes (tag_and_render mode only)
  const taggedRendered = mismatches.filter(i => i.status === 'passed' || i.status === 'failed')

  // ── Assemble document ──────────────────────────────────────────
  const lines: string[] = []
  const grade = (actual: number | null, target: number, lessIsBetter = false): string => {
    if (actual == null) return '—'
    const ok = lessIsBetter ? actual <= target : actual >= target
    return ok ? 'MEETS TARGET' : 'BELOW TARGET'
  }
  const pct = (x: number | null) => x == null ? '—' : `${(x * 100).toFixed(1)}%`

  lines.push(`# Liten & Co — Implementation Findings: ${run.label}`)
  lines.push('')
  lines.push(`**Run:** \`${run.id}\` · **Series:** ${run.series} · **Status:** ${run.status} · **Generated:** ${new Date().toISOString().slice(0, 10)}`)
  lines.push(`**Items:** ${n.total} completed · **Spend:** $${spentDollars.toFixed(2)}`)
  lines.push('')
  lines.push('This document is generated from bench data and written to guide final-product decisions. Numbers first, synthesis second, raw samples last for audit.')
  lines.push('')

  lines.push('## 1. Viability scorecard')
  lines.push('')
  lines.push('| Metric | Actual | Target | Verdict |')
  lines.push('|---|---|---|---|')
  lines.push(`| Intake accept rate | ${pct(metrics.intakeAcceptRate)} | ≥ ${pct(VIABILITY_TARGETS.intakeAcceptRate)} | ${grade(metrics.intakeAcceptRate, VIABILITY_TARGETS.intakeAcceptRate)} |`)
  lines.push(`| Pass rate (accepted intakes) | ${pct(metrics.passRate)} | ≥ ${pct(VIABILITY_TARGETS.passRate)} | ${grade(metrics.passRate, VIABILITY_TARGETS.passRate)} |`)
  lines.push(`| First-pass rate | ${pct(metrics.firstPassRate)} | ≥ ${pct(VIABILITY_TARGETS.firstPassRate)} | ${grade(metrics.firstPassRate, VIABILITY_TARGETS.firstPassRate)} |`)
  lines.push(`| Aesthetic sub-5 share | ${pct(metrics.aestheticFloorPct)} | ≤ ${pct(VIABILITY_TARGETS.aestheticFloorPct)} | ${grade(metrics.aestheticFloorPct, VIABILITY_TARGETS.aestheticFloorPct, true)} |`)
  lines.push(`| Cost per accepted render | ${costPerPassed == null ? '—' : '$' + costPerPassed.toFixed(2)} | judgment vs price point | — |`)
  lines.push('')
  lines.push(`Counts: ${n.redirected} redirected · ${n.intakeRej} intake-rejected · ${n.passed} passed · ${n.failed} failed · ${n.errored} errored.`)
  lines.push('')

  lines.push('## 2. Matrix breakdown')
  lines.push('')
  lines.push('| Cell (preset|location|scale) | Total | Pass rate | Avg fidelity | Avg aesthetic | Cost |')
  lines.push('|---|---|---|---|---|---|')
  for (const r of matrixRows) {
    lines.push(`| ${r.key} | ${r.total} | ${pct(r.passRate)} | ${fmt(r.avgFidelity)} | ${fmt(r.avgAesthetic)} | $${(r.costCents / 100).toFixed(2)} |`)
  }
  lines.push('')
  const worst = matrixRows.filter(r => r.passRate != null).sort((a, b) => (a.passRate! - b.passRate!))[0]
  if (worst) lines.push(`Weakest cell: **${worst.key}** at ${pct(worst.passRate)} pass. Prioritize prompt work here.`)
  lines.push('')

  lines.push('## 3. Failure analysis & prompt recommendations')
  lines.push('')
  if (syntheses.length === 0) {
    lines.push('No categorized failures in this run.')
  }
  for (const s of syntheses) {
    lines.push(`### ${s.category} — ${s.count} fails (${pct(s.pct)} of all fails)`)
    lines.push('')
    lines.push(`**Recommendation:** ${s.recommendation}`)
    lines.push('')
    if (s.samples.length) {
      lines.push('<details><summary>Sample triage suggestions</summary>')
      lines.push('')
      for (const sample of s.samples) lines.push(`- ${sample}`)
      lines.push('')
      lines.push('</details>')
      lines.push('')
    }
  }

  lines.push('## 4. What customers upload — classification & redirect')
  lines.push('')
  lines.push('| Detected subject | Items |')
  lines.push('|---|---|')
  for (const [subject, count] of Object.entries(subjectCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${subject} | ${count} |`)
  }
  lines.push('')
  lines.push(`Series mismatches: **${mismatches.length}** of ${classified.length} classified (${pct(classified.length ? mismatches.length / classified.length : null)}).`)
  if (Object.keys(redirectTargets).length) {
    lines.push(`Redirect destinations: ${Object.entries(redirectTargets).map(([s, c]) => `${s} (${c})`).join(', ')}.`)
  }
  if (reviewedRedirects.length > 0) {
    const accuracy = 1 - redirectOverturns / reviewedRedirects.length
    lines.push(`Redirect accuracy (human-reviewed): ${pct(accuracy)} on ${reviewedRedirects.length} reviewed — target ≥ ${pct(VIABILITY_TARGETS.redirectAccuracyMin)}.`)
  } else {
    lines.push('Redirect accuracy: no human reviews yet — review a sample of redirected items in the UI before trusting the production gate.')
  }
  if (taggedRendered.length > 0) {
    const taggedPassed = taggedRendered.filter(i => i.status === 'passed').length
    lines.push('')
    lines.push(`Wrong-Series renders (tag_and_render mode): ${taggedRendered.length} generated, ${taggedPassed} passed gates anyway. ` +
      `A high pass rate here argues for a soft redirect (offer, don't block); a low one argues for a firm gate.`)
  }
  lines.push('')

  lines.push('## 5. Action items')
  lines.push('')
  let actionNo = 1
  if (metrics.intakeAcceptRate != null && metrics.intakeAcceptRate < VIABILITY_TARGETS.intakeAcceptRate) {
    lines.push(`${actionNo++}. Intake accept below target — either the threshold is too hot for realistic photos or upload guidance is needed at the front door. Re-run at intakeThreshold −1 and compare downstream fail movement.`)
  }
  if (metrics.firstPassRate != null && metrics.firstPassRate < VIABILITY_TARGETS.firstPassRate) {
    lines.push(`${actionNo++}. First-pass rate below target — every retry ≈ 2× COGS. Apply §3's top-category recommendation to the weakest matrix cell first, then re-run that cell only.`)
  }
  for (const s of syntheses.slice(0, 2)) {
    lines.push(`${actionNo++}. [${s.category}] ${s.recommendation}`)
  }
  if (mismatches.length > 0 && reviewedRedirects.length === 0) {
    lines.push(`${actionNo++}. Human-review the ${Math.min(mismatches.length, 20)} most recent redirected items to establish redirect accuracy before the production gate ships.`)
  }
  if (actionNo === 1) lines.push('1. All targets met for this run — widen the photo set (more uncurated sources) and re-verify before locking.')
  lines.push('')

  const doc = lines.join('\n')

  // ── Write + upload ─────────────────────────────────────────────
  const outDir = input.outDir ?? './bench-reports'
  await fs.mkdir(outDir, { recursive: true })
  const fileName = `liten-implementation-${run.series}-${slug(run.label)}-${Date.now().toString(36)}.md`
  const filePath = path.join(outDir, fileName)
  await fs.writeFile(filePath, doc, 'utf8')

  let storageKey: string | null = null
  if (input.uploadToStorage !== false) {
    storageKey = `${run.id}/reports/${fileName}`
    const { error: upErr } = await sb.storage.from(RENDER_BUCKET)
      .upload(storageKey, Buffer.from(doc, 'utf8'), { contentType: 'text/markdown', upsert: true })
    if (upErr) { console.warn(`[bench-report] upload failed: ${upErr.message}`); storageKey = null }
    else await sb.from('batch_runs').update({ report_storage_key: storageKey }).eq('id', run.id)
  }

  console.log(`[bench-report] wrote ${filePath}${storageKey ? ` (+ storage ${storageKey})` : ''}`)
  return { filePath, storageKey }
}

// ─── SUGGESTION SYNTHESIS ────────────────────────────────────────

const SYNTHESIS_PROMPT_HEAD = `You are consolidating prompt-improvement suggestions from a render quality review. All suggestions below address the same failure category. Distill them into 1-3 concrete prompt directives.

Rules for your directives:
- Positive framing only: describe what the render should show or match. State desired outcomes.
- Each directive under 25 words. Short directives outperform long ones.
- Each directive owns one concern.
- Prefer the pattern that appears most often across the suggestions.

Respond with ONLY a JSON object:
{ "directives": ["<directive 1>", "<directive 2 if needed>", "<directive 3 if needed>"] }

Respond with ONLY the JSON. No preamble.`

async function synthesizeRecommendation(input: {
  category:     string
  suggestions:  string[]
  openaiApiKey: string
}): Promise<string> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  const body =
    `Failure category: ${input.category}\n\nSuggestions (${input.suggestions.length}):\n` +
    input.suggestions.slice(0, 60).map((s, i) => `${i + 1}. ${s}`).join('\n')

  const response = await openai.chat.completions.create({
    model:      'gpt-4o-mini',
    max_tokens: 250,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: `${SYNTHESIS_PROMPT_HEAD}\n\n${body}` }],
  })

  const content = (response.choices[0]?.message?.content || '{}').trim()
  try {
    const parsed = JSON.parse(content)
    const directives: string[] = Array.isArray(parsed.directives)
      ? parsed.directives.map((d: unknown) => String(d)).filter(Boolean).slice(0, 3)
      : []
    return directives.length ? directives.join(' · ') : '(no directives produced)'
  } catch {
    return '(synthesis parse failed)'
  }
}

// ─── UTIL ────────────────────────────────────────────────────────

function isNum(x: unknown): x is number { return typeof x === 'number' && Number.isFinite(x) }
function avg(xs: number[]): number | null { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null }
function fmt(x: number | null): string { return x == null ? '—' : x.toFixed(2) }
function slug(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) }
function countBy<T>(xs: T[], key: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const x of xs) { const k = key(x); out[k] = (out[k] || 0) + 1 }
  return out
}

// ─── CLI ─────────────────────────────────────────────────────────
// npm run bench:report -- --run <run_id> [--no-synth]

if (require.main === module) {
  const runIdx = process.argv.indexOf('--run')
  const runId  = runIdx >= 0 ? process.argv[runIdx + 1] : null
  if (!runId) { console.error('usage: bench:report --run <run_id> [--no-synth]'); process.exit(1) }

  generateImplementationDoc({
    keys: {
      supabaseUrl:        process.env.SUPABASE_URL!,
      supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      openaiApiKey:       process.env.OPENAI_API_KEY!,
    },
    runId,
    synthesize: !process.argv.includes('--no-synth'),
  }).catch(e => { console.error(e); process.exit(1) })
}
