// app/api/admin/print-assets/route.ts
//
// The review queue for print artwork, behind the existing admin gate (lib/admin/auth.ts isAdmin).
//   GET   settings rows, jobs waiting for a person, recent jobs, with short-lived signed links to the files.
//   POST  { action: 'review', job_id, decision: 'approved' | 'rejected', note }
//         { action: 'reset',  job_id }                      retry a FAILED job from its last saved step
//
// A person can approve only a job that has a print file. Approval places the order immediately if it was the
// last picture outstanding (completePrintOrder re-checks payment, refund and fulfilment). Nothing here
// regenerates a customer's artwork, issues a refund or credits an account.

import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { assetRuntime } from '@/lib/v1/print/upscale/runtime'
import { resumeStatusFor } from '@/lib/v1/print/upscale/process'
import { completePrintOrder } from '@/lib/v1/print/complete'
import { pipelineState } from '@/lib/v1/print/upscale/pipeline'

export const runtime = 'nodejs'

const LINK_SECONDS = 3600

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  // The activation state first, and always: it is how a missing migration or key is seen, so it must not depend on the tables.
  const pipeline = await pipelineState()
  const { store, storage } = assetRuntime()
  const [settings, held, recent] = await Promise.all([
    supabaseAdmin.from('print_upscale_settings').select('*').order('scope'),
    store.listByStatus(['review', 'failed'], 50),
    supabaseAdmin.from('print_asset_jobs').select('id,order_id,item_index,sku,status,provider,target_mp,output_w,output_h,final_w,final_h,cost_usd_est,possible_duplicate,qa_verdict,review_reason,error,updated_at')
      .order('updated_at', { ascending: false }).limit(25),
  ])
  if (settings.error) return NextResponse.json({ pipeline, settings: [], queue: [], recent: [], error: 'settings_unavailable' })

  const link = async (path: string | null) => { try { return path ? await storage.signedUrl(path, LINK_SECONDS) : null } catch { return null } }
  const queue = await Promise.all(held.map(async j => ({
    id: j.id, order_id: j.order_id, item_index: j.item_index, sku: j.sku, status: j.status, provider: j.provider,
    review_reason: j.review_reason, error: j.error, warnings: j.warnings, qa_verdict: j.qa_verdict,
    qa: j.qa, source_ppi: j.source_ppi, target_mp: j.target_mp, input: [j.input_w, j.input_h], output: [j.output_w, j.output_h], final: [j.final_w, j.final_h],
    cost_usd_est: j.cost_usd_est, cost_basis: j.cost_basis, prediction_id: j.prediction_id, possible_duplicate: j.possible_duplicate,
    settings_hash: j.settings_hash, settings_snapshot: j.settings_snapshot, events: (j.events ?? []).slice(-12), created_at: j.created_at,
    has_file: !!j.final_path,
    links: {
      reference_preview: await link(`${j.id}/review-reference.jpg`), result_preview: await link(`${j.id}/review-result.jpg`),
      reference_full: await link(j.input_path), result_full: await link(j.final_path),
    },
  })))
  return NextResponse.json({ pipeline, settings: settings.data ?? [], queue, recent: recent.data ?? [] })
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }
  const id = typeof body.job_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.job_id) ? body.job_id : null
  if (!id) return NextResponse.json({ error: 'invalid_job' }, { status: 400 })
  const { store } = assetRuntime()
  const job = await store.get(id)
  if (!job) return NextResponse.json({ error: 'job_not_found' }, { status: 404 })

  if (body.action === 'review') {
    const decision = body.decision
    if (decision !== 'approved' && decision !== 'rejected') return NextResponse.json({ error: 'invalid_decision' }, { status: 400 })
    if (decision === 'approved' && (!job.final_path || !job.final_sha256)) return NextResponse.json({ error: 'no_file_to_approve' }, { status: 409 })
    try {
      const done = await store.review(id, decision, 'control-panel', typeof body.note === 'string' ? body.note : '')
      const order = decision === 'approved' ? await completePrintOrder(done.order_id).catch(e => ({ status: 'blocked', reason: String(e?.message ?? e) })) : null
      return NextResponse.json({ ok: true, status: done.status, order })
    } catch (e: any) {
      return NextResponse.json({ error: String(e?.message ?? '').includes('job_not_in_review') ? 'job_not_in_review' : 'review_failed' }, { status: 409 })
    }
  }

  if (body.action === 'reset') {
    if (job.status !== 'failed') return NextResponse.json({ error: 'job_not_failed' }, { status: 409 })
    // A person has chosen to try again. Attempt counters restart; any extra provider charge is theirs to accept.
    const reset = await store.reset(id, {
      status: resumeStatusFor(job), error: null, attempts: 0, submit_attempts: 0, notified_at: null,
      prediction_id: job.output_path ? job.prediction_id : null, submit_state: job.output_path ? job.submit_state : 'none',
      events: [...(job.events ?? []), { at: new Date().toISOString(), step: 'admin_reset', note: `from ${job.error ?? 'failed'}` }].slice(-60),
    })
    return reset ? NextResponse.json({ ok: true, status: reset.status }) : NextResponse.json({ error: 'reset_failed' }, { status: 409 })
  }

  return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
}
