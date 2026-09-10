// lib/store/generation-grants.ts
//
// Who may make a clean Portraits image, and how a paid one is delivered once.
//
// /api/v1/portraits/generate used to return a clean image to anyone. The
// paywall was the order the browser made its calls in: /credits/gate spent
// the credits, then generate rendered -- and generate never looked at the
// gate, so skipping the first call made the second free. This module is the
// check generate now makes.
//
// THE INVARIANT: one paid grant produces at most one canonical delivered
// image, and retrying that grant never produces a different one once its
// canonical result exists.
//
// A grant (table generation_grants, migration 031) is issued by /credits/gate
// together with the spend. Its lifecycle here:
//
//   openGrant          issued -> claimed, BEFORE any NB2 work; or re-deliver
//                      an already-stored result; or wait on a render in flight
//   persistAndConsume  store the canonical result (upsert OFF), THEN consume
//   releaseGrant       claimed -> issued, only when nothing was delivered
//
// A paid generation is not fulfilled until its canonical result is persisted
// (ruled 2026-09-10). If persistence fails the grant is released into the
// retry/refund path, and no image is returned for it.

import type { SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { PREVIEW_BUCKET } from '@/lib/store/preview'

/* How long a claim may stand before it is treated as dead. items/render and
   generate both cap at maxDuration 300, so no live render can hold a claim
   past 300s; doubling it covers cold start and clock skew. Approved
   2026-09-10, the same figure as the portfolio render reclaim. */
export const GRANT_STALE_CLAIM_MS = 600_000

/* A retried request that finds its grant mid-render waits for that render to
   finish and re-delivers its result, rather than answering "in progress" and
   letting the client give up. Without this, a network drop during a 20-60s
   render left the client's 2500ms x 4 retry window closing while the render
   was still running: the item showed failed, the credit was spent, and the
   finished image was never shown. 240s keeps the wait inside generate's own
   300s ceiling. */
export const INFLIGHT_WAIT_MS = 240_000
export const INFLIGHT_POLL_MS = 2_000

/** Where a grant's canonical result lives. Derived from the grant id alone,
 *  so every attempt on one grant writes -- and finds -- the same object. */
export function canonicalResultPath(grantId: string): string {
  return `portraits-grants/${grantId}.jpg`
}

export type ClaimedGrant = { id: string; token: string; ownerKey: string; preset: string }

export type OpenGrantOutcome =
  | { kind: 'claimed'; grant: ClaimedGrant }
  | { kind: 'redeliver'; grantId: string; imageB64: string }
  | { kind: 'refuse'; status: number; error: string }

export type GenerateAccess =
  | { kind: 'internal' }
  | { kind: 'grant' }
  | { kind: 'refuse'; status: number; error: string }

/** The authorization decision, made from credentials and never from what the
 *  body asks for. Body flags can only ever make a request LESS privileged. */
export function decideGenerateAccess(args: {
  body: any
  internal: boolean
  bakeAuthorized: boolean
}): GenerateAccess {
  const { body, internal, bakeAuthorized } = args
  // Closed: no caller has ever used it, and it rendered clean, before the
  // age refusal, for anyone.
  if (body && body.experimental_effect) {
    return { kind: 'refuse', status: 403, error: 'experimental_effect_disabled' }
  }
  // The catalogue bake keeps its own internal token, exactly as before.
  if (body && body.is_preview_bake === true) {
    return bakeAuthorized ? { kind: 'internal' } : { kind: 'refuse', status: 403, error: 'preview_bake_forbidden' }
  }
  // Closed: the anonymous free preview had no caller. The foyer's free
  // preview will be designed on its own.
  if (body && body.is_preview === true) {
    return { kind: 'refuse', status: 403, error: 'preview_disabled' }
  }
  if (internal) return { kind: 'internal' }
  return { kind: 'grant' }
}

type Deps = { now?: () => number; sleep?: (ms: number) => Promise<void> }
const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function downloadB64(sb: SupabaseClient, path: string): Promise<string | null> {
  try {
    const { data, error } = await sb.storage.from(PREVIEW_BUCKET).download(path)
    if (error || !data) return null
    return Buffer.from(await data.arrayBuffer()).toString('base64')
  } catch {
    return null
  }
}

function alreadyExists(err: any): boolean {
  if (!err) return false
  const code = String(err.statusCode ?? err.status ?? '')
  return code === '409' || /already exists|duplicate/i.test(String(err.message ?? err.error ?? ''))
}

/** Complete a grant whose canonical result exists, whatever claim it holds. */
async function completeFromStored(sb: SupabaseClient, grantId: string): Promise<boolean> {
  const { data, error } = await sb
    .from('generation_grants')
    .update({
      status: 'consumed',
      consumed_at: new Date().toISOString(),
      result_path: canonicalResultPath(grantId),
      claim_token: null,
      last_error: null,
    })
    .eq('id', grantId)
    .in('status', ['issued', 'claimed'])
    .select('id')
  return !error && (data?.length ?? 0) > 0
}

/**
 * Take a grant for one render, or re-deliver what it already produced.
 * Never starts NB2 work itself; a 'claimed' outcome is the caller's licence
 * to do so.
 */
export async function openGrant(
  sb: SupabaseClient,
  args: { grantId: string; ownerKey: string; preset: string },
  deps: Deps = {},
): Promise<OpenGrantOutcome> {
  const now = deps.now ?? Date.now
  const sleep = deps.sleep ?? realSleep
  const deadline = now() + INFLIGHT_WAIT_MS

  for (;;) {
    const { data: row, error } = await sb
      .from('generation_grants')
      .select('id, owner_key, series, preset, status, claim_token, claimed_at, result_path, attempts')
      .eq('id', args.grantId)
      .maybeSingle()
    if (error) return { kind: 'refuse', status: 503, error: 'grant_lookup_failed' }
    // Another owner's grant reads exactly like no grant at all.
    if (!row || row.owner_key !== args.ownerKey) return { kind: 'refuse', status: 403, error: 'grant_invalid' }
    if (row.series !== 'portraits' || row.preset !== args.preset) {
      return { kind: 'refuse', status: 403, error: 'grant_mismatch' }
    }
    if (row.status === 'refunded') return { kind: 'refuse', status: 409, error: 'grant_refunded' }

    if (row.status === 'consumed') {
      const b64 = await downloadB64(sb, row.result_path || canonicalResultPath(row.id))
      return b64
        ? { kind: 'redeliver', grantId: row.id, imageB64: b64 }
        : { kind: 'refuse', status: 503, error: 'redelivery_failed' }
    }

    if (row.status === 'claimed') {
      // The result may already be stored even though the row still says
      // claimed: the consume write can fail after persistence. Finish it
      // from storage rather than render again.
      const stored = await downloadB64(sb, canonicalResultPath(row.id))
      if (stored) {
        await completeFromStored(sb, row.id)
        return { kind: 'redeliver', grantId: row.id, imageB64: stored }
      }
      const claimedAt = row.claimed_at ? Date.parse(row.claimed_at) : 0
      const stale = now() - claimedAt > GRANT_STALE_CLAIM_MS
      if (!stale) {
        // A render is in flight on this grant. Wait for it, then re-deliver.
        if (now() + INFLIGHT_POLL_MS > deadline) {
          return { kind: 'refuse', status: 409, error: 'grant_in_progress' }
        }
        await sleep(INFLIGHT_POLL_MS)
        continue
      }
    }

    // issued, or claimed by a render long dead: take it.
    const token = randomUUID()
    let q = sb
      .from('generation_grants')
      .update({
        status: 'claimed',
        claim_token: token,
        claimed_at: new Date(now()).toISOString(),
        attempts: (row.attempts ?? 0) + 1,
        last_error: null,
      })
      .eq('id', row.id)
      .eq('owner_key', args.ownerKey)
    q = row.status === 'issued'
      ? q.eq('status', 'issued')
      // compare-and-swap on the dead claim's own token
      : q.eq('status', 'claimed').eq('claim_token', row.claim_token)
          .lt('claimed_at', new Date(now() - GRANT_STALE_CLAIM_MS).toISOString())
    const { data: took, error: claimErr } = await q.select('id')
    if (claimErr) return { kind: 'refuse', status: 503, error: 'grant_claim_failed' }
    if (took && took.length > 0) {
      return { kind: 'claimed', grant: { id: row.id, token, ownerKey: args.ownerKey, preset: args.preset } }
    }
    // Lost the race to another request on the same grant; go round and see
    // what it did.
    if (now() + INFLIGHT_POLL_MS > deadline) return { kind: 'refuse', status: 409, error: 'grant_in_progress' }
    await sleep(INFLIGHT_POLL_MS)
  }
}

/**
 * Persist the canonical result, then consume the grant. The image returned is
 * always the canonical one: if another attempt on this grant stored first,
 * that stored image is what this attempt returns, never its own.
 */
export async function persistAndConsume(
  sb: SupabaseClient,
  grant: ClaimedGrant,
  imageB64: string,
): Promise<{ ok: true; imageB64: string; consumed: boolean } | { ok: false; reason: string }> {
  const path = canonicalResultPath(grant.id)
  let canonical = imageB64

  const { error: upErr } = await sb.storage
    .from(PREVIEW_BUCKET)
    .upload(path, Buffer.from(imageB64, 'base64'), { contentType: 'image/jpeg', upsert: false })
  if (upErr) {
    if (!alreadyExists(upErr)) {
      return { ok: false, reason: `persist_failed: ${upErr.message ?? 'upload error'}` }
    }
    const stored = await downloadB64(sb, path)
    if (!stored) return { ok: false, reason: 'persist_conflict_unreadable' }
    canonical = stored
  }

  const consumedAt = new Date().toISOString()
  const { data: mine, error: mineErr } = await sb
    .from('generation_grants')
    .update({ status: 'consumed', consumed_at: consumedAt, result_path: path, claim_token: null, last_error: null })
    .eq('id', grant.id)
    .eq('claim_token', grant.token)
    .eq('status', 'claimed')
    .select('id')
  if (!mineErr && (mine?.length ?? 0) > 0) return { ok: true, imageB64: canonical, consumed: true }

  // Our claim was superseded, or the write failed. The canonical result is
  // stored, so the grant's outcome is settled either way: complete it by id.
  let done = await completeFromStored(sb, grant.id)
  if (!done) {
    // Another attempt on this grant may already have consumed it -- that is
    // settled too, and not a failure worth reporting.
    const { data: now } = await sb.from('generation_grants').select('status').eq('id', grant.id).maybeSingle()
    done = now?.status === 'consumed'
  }
  if (!done) {
    console.error(
      `[generation-grants] consume failed for ${grant.id}; result is stored at ${path} and ` +
      `will be completed by the next request on this grant or by refund`,
    )
  }
  return { ok: true, imageB64: canonical, consumed: done }
}

/** Nothing was delivered: put the grant back for a retry or a refund. Only the
 *  claim that took it may release it. */
export async function releaseGrant(sb: SupabaseClient, grant: ClaimedGrant, reason: string): Promise<void> {
  const { error } = await sb
    .from('generation_grants')
    .update({ status: 'issued', claim_token: null, claimed_at: null, last_error: reason.slice(0, 500) })
    .eq('id', grant.id)
    .eq('claim_token', grant.token)
    .eq('status', 'claimed')
  if (error) {
    console.error(`[generation-grants] release failed for ${grant.id}: ${error.message} — reclaimable after ${GRANT_STALE_CLAIM_MS / 1000}s`)
  }
}
