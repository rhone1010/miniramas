// app/api/v1/baskets/items/complete/route.ts
//
// Job-completion callback. THIS IS THE PIECE THAT WAS MISSING — without
// it, activateBasket fires N jobs and nothing ever learns they finished.
// A basket purchase completed payment but never actually finished.
//
// NOT YET CALLED BY ANYTHING. generation-kickoff.ts is a stub (confirmed
// this session — it only logs, calls no real pipeline). So this route
// has no real caller today, same as basket generation itself has no
// real renderer wired in yet. This is the CONTRACT the eventual
// pipeline integration calls into, not a completed integration.
//
// Contract: POST { jobId, status: 'done' | 'failed', previewId?, error? }
//   - jobId matches basket_items.job_id (set in activateBasket / here on
//     re-kick after a replacement).
//   - 'done' requires previewId (joins preview_ledger.id — NOTE: the
//     preview_ledger system is Portraits-only today per the earlier
//     engine recommendation; Halloween pieces completing here will need
//     that gap closed before previewId means anything for Halloween).
//   - 'failed' triggers auto-replace: picks an unused preset via
//     basket-replace.ts, re-fires a new job for the same slot. If the
//     series' pool is exhausted, the slot terminal-fails instead
//     (rare — flagged in a comment below, not specially handled beyond
//     that).
//
// No auth on this route — it's meant to be called by the generation
// pipeline (server-to-server), not a browser. Whoever wires the real
// pipeline call needs to decide how this route authenticates that
// caller (shared secret header, internal-only network rule, etc.) —
// NOT decided here, flagging rather than leaving it silently open.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { pickReplacement } from '@/lib/store/basket-replace'
import type { GenerationKickoff } from '@/lib/store/types'
import { defaultGenerationKickoff } from '@/lib/store/generation-kickoff'
import crypto from 'crypto'

export async function POST(
  req: NextRequest,
  { kickoff = defaultGenerationKickoff }: { kickoff?: GenerationKickoff } = {},
) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const jobId = typeof body.jobId === 'string' ? body.jobId : ''
  const status = body.status === 'done' || body.status === 'failed' ? body.status : ''
  if (!jobId || !status) {
    return NextResponse.json({ error: 'jobId_and_status_required' }, { status: 400 })
  }

  const { data: item, error: itemErr } = await supabaseAdmin
    .from('basket_items')
    .select('id, basket_id, slot, preset, status')
    .eq('job_id', jobId)
    .maybeSingle()
  if (itemErr) {
    return NextResponse.json({ error: 'basket_item_query_failed' }, { status: 500 })
  }
  if (!item) return NextResponse.json({ error: 'job_not_found' }, { status: 404 })
  if (item.status === 'done' || item.status === 'failed') {
    // Already terminal — duplicate callback (retry from the pipeline
    // side). No-op, not an error, matches the webhook's own idempotency
    // stance on confirmPurchase.
    return NextResponse.json({ ok: true, alreadyTerminal: true })
  }

  if (status === 'done') {
    const previewId = typeof body.previewId === 'string' ? body.previewId : null
    if (!previewId) {
      return NextResponse.json({ error: 'previewId_required_for_done' }, { status: 400 })
    }
    const { error: updateErr } = await supabaseAdmin
      .from('basket_items')
      .update({ status: 'done', preview_id: previewId })
      .eq('id', item.id)
    if (updateErr) {
      return NextResponse.json({ error: 'basket_item_update_failed' }, { status: 500 })
    }
    await maybeFlipBasketReady(item.basket_id)
    return NextResponse.json({ ok: true })
  }

  // ── status === 'failed' — auto-replace, silently ────────────────
  const { data: basket, error: basketErr } = await supabaseAdmin
    .from('baskets')
    .select('id, series, source_image')
    .eq('id', item.basket_id)
    .maybeSingle()
  if (basketErr || !basket) {
    return NextResponse.json({ error: 'basket_not_found' }, { status: 500 })
  }

  const { data: siblings, error: sibErr } = await supabaseAdmin
    .from('basket_items')
    .select('preset')
    .eq('basket_id', basket.id)
  if (sibErr) {
    return NextResponse.json({ error: 'basket_items_query_failed' }, { status: 500 })
  }
  const currentPresets = (siblings ?? []).map((s) => s.preset)

  let replacement: string | null
  try {
    replacement = pickReplacement(basket.series, currentPresets)
  } catch (e) {
    // Series not wired (groups/pets) — can't auto-replace, terminal-fail
    // the slot rather than guess. Shouldn't happen today (see
    // basket-replace.ts header) but not silently swallowed if it does.
    console.error('[baskets/items/complete] replace failed', e)
    await supabaseAdmin.from('basket_items').update({ status: 'failed' }).eq('id', item.id)
    await maybeFlipBasketReady(basket.id)
    return NextResponse.json({ ok: true, terminalFailed: true, reason: 'series_not_wired' })
  }

  if (!replacement) {
    // Pool exhausted — every offerable preset in this series is already
    // in the basket. Rare; terminal-fail this slot rather than loop.
    await supabaseAdmin.from('basket_items').update({ status: 'failed' }).eq('id', item.id)
    await maybeFlipBasketReady(basket.id)
    return NextResponse.json({ ok: true, terminalFailed: true, reason: 'pool_exhausted' })
  }

  const newJobId = crypto.randomUUID()
  const { error: replaceErr } = await supabaseAdmin
    .from('basket_items')
    .update({
      preset:        replacement,
      replaced_from: item.preset,
      status:        'rendering',
      job_id:        newJobId,
      error:         typeof body.error === 'string' ? body.error : null,
    })
    .eq('id', item.id)
  if (replaceErr) {
    return NextResponse.json({ error: 'basket_item_replace_failed' }, { status: 500 })
  }

  void kickoff
    .start({
      jobId:          newJobId,
      entitlementId:  '',
      style:          replacement,
      variant:        basket.series,
      sourceImageRef: basket.source_image,
    })
    .catch((err) => {
      console.error(`[baskets/items/complete] replacement kickoff.start threw`, err)
    })

  return NextResponse.json({ ok: true, replaced: replacement })
}

/** Flips a basket to 'ready' once every item is in a terminal state
 *  (done or failed). Matches the "16-18 wins out of 20 is fine" model —
 *  ready doesn't mean all 20 succeeded, it means nothing's still in
 *  flight. */
async function maybeFlipBasketReady(basketId: string): Promise<void> {
  const { data: items, error } = await supabaseAdmin
    .from('basket_items')
    .select('status')
    .eq('basket_id', basketId)
  if (error || !items) return
  const stillWorking = items.some((i) => i.status === 'pending' || i.status === 'rendering')
  if (stillWorking) return
  await supabaseAdmin.from('baskets').update({ status: 'ready' }).eq('id', basketId)
}
