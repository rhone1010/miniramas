// app/api/v1/print/assets/poll/route.ts
//
// Vercel Cron, every 2 minutes (vercel.json). Advances the print-asset jobs and places orders whose pictures
// are all approved. Same CRON_SECRET gate as /portfolios/items/render-poll; never callable from a browser.
//
// Each job is leased (single flight) and saves every step, so overlapping or crashed ticks are harmless:
// a job that is mid-call is skipped as 'busy', and a crashed one resumes from its last saved step.

import { NextResponse } from 'next/server'
import { checkInternalAuth } from '@/lib/store/internal-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { productionDeps, assetRuntime } from '@/lib/v1/print/upscale/runtime'
import { runJob } from '@/lib/v1/print/upscale/process'
import { completePrintOrder } from '@/lib/v1/print/complete'
import { pipelineState } from '@/lib/v1/print/upscale/pipeline'

export const runtime = 'nodejs'
export const maxDuration = 300

const MAX_JOBS_PER_TICK = 4
const STOP_STARTING_AFTER_MS = 150_000
const HARD_BUDGET_MS = 270_000
const MAX_ORDERS_PER_TICK = 25

async function tick(req: Request) {
  const auth = checkInternalAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // THE ACTIVATION GATE. Off (the default) or not ready: do nothing at all. No job is read or leased, nothing is
  // called, no order is touched. In-flight jobs simply wait and resume when the pipeline is active again.
  const gate = await pipelineState()
  if (!gate.active) return NextResponse.json({ skipped: true, reason: gate.reason, problems: gate.problems })

  const startedAt = Date.now()
  const deps = productionDeps()
  const work = await assetRuntime().store.listWork(MAX_JOBS_PER_TICK)
  const ran: Array<{ job: string; outcome: string; status?: string }> = []

  for (const j of work) {
    const elapsed = Date.now() - startedAt
    if (elapsed > STOP_STARTING_AFTER_MS) { ran.push({ job: j.id, outcome: 'skipped' }); continue }
    try {
      const r = await runJob({ ...deps, budgetMs: Math.max(20_000, HARD_BUDGET_MS - elapsed - 20_000) }, j.id)
      ran.push({ job: j.id, outcome: r.outcome, status: r.job?.status })
    } catch (e) {
      console.error('[print-assets] job threw', j.id, e)
      ran.push({ job: j.id, outcome: 'threw' })
    }
  }

  // Orders that may now be complete: paid, or held by an asset review/failure. completePrintOrder re-checks everything.
  const placed: string[] = []
  const { data: orders, error } = await supabaseAdmin.from('print_orders').select('id')
    .in('status', ['paid', 'withheld', 'error']).order('updated_at', { ascending: false }).limit(MAX_ORDERS_PER_TICK)
  if (error) console.error('[print-assets] order query failed:', error.message)
  for (const o of orders ?? []) {
    if (Date.now() - startedAt > HARD_BUDGET_MS) break
    try { const r = await completePrintOrder(o.id); if (r.status === 'placed') placed.push(o.id) }
    catch (e) { console.error('[print-assets] complete threw', o.id, e) }
  }

  const summary = { jobs: ran, placed, ms: Date.now() - startedAt }
  console.log('[print-assets]', JSON.stringify(summary))
  return NextResponse.json(summary)
}

export const GET = tick
export const POST = tick
