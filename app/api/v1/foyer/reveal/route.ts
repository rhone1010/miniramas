// app/api/v1/foyer/reveal/route.ts
//
// THE FOYER'S FREE PERSONAL REVEAL. Anonymous.
//
// GET   { available, reason? }  -- may this visitor have a free reveal right
//       now? For the page to decide before a photograph is chosen. Read-only
//       and not a promise. When not: reason 'exhausted' (the allowance is
//       used) or 'unavailable' (it could not be checked -- fail closed; the
//       page says so in its own words, not as a used allowance).
//
// POST  { image_b64, intake }  -- render one.
//   1. The photograph must carry /foyer/intake's signed verdict for these
//      exact bytes (age-checked there; not checked twice).
//   2. One reveal is CLAIMED against the allowance (3 successful per rolling
//      24h; the IP primary, the liten_anon marker supporting).
//   3. ONE production NB2 render of one of the six foyer effects, chosen
//      here at random, with its production prompt -- lib/v1/foyer/
//      foyer-render.ts.
//   4. The clean image is watermarked (bakeFoyerWatermark: one large Liten &
//      Co lockup across the portrait) and dropped. Only the
//      marked JPEG is returned, inline. Nothing is stored: not the source,
//      not the result, not a preview, a portfolio item, a selection or an
//      unlock.
//   5. The claim is finalized: success counts; failure or timeout is
//      released and costs the visitor nothing.
//
// Answers:
//   200 { status:'ok', image:'data:image/jpeg;base64,...', label }
//   429 { status:'exhausted' }      allowance used
//   503 { status:'unavailable' }    the allowance cannot be checked -- FAIL
//                                   CLOSED, no render
//   502 { status:'failed' }         the render did not come through
//   403 { status:'intake_required' } no valid intake note for these bytes
//   400 { status:'bad_request', error }
//
// It never calls /portraits/generate, the grant path or raw-pipeline, and it
// changes nothing in them.

import { NextRequest, NextResponse } from 'next/server'
import { decodeSource, foyerDb } from '@/lib/v1/foyer/foyer-source'
import { foyerSecret, ipIdentity, deviceMarker, sha256Hex, verifyIntake } from '@/lib/v1/foyer/foyer-identity'
import { claimReveal, finalizeReveal, revealAvailable } from '@/lib/v1/foyer/foyer-allowance'
import { pickRevealEffect } from '@/lib/v1/foyer/foyer-policy'
import { renderFoyerReveal } from '@/lib/v1/foyer/foyer-render'
// TEMPORARY PREVIEW TEST BYPASS — REMOVE BEFORE PR #178 MERGE (see the module)
import { previewAllowanceBypass } from '@/lib/v1/foyer/foyer-preview-bypass'

export const runtime     = 'nodejs'
export const maxDuration = 300

const NO_STORE = { 'Cache-Control': 'no-store' }
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

export async function GET(req: NextRequest) {
  const secret = foyerSecret()
  const sb     = foyerDb()
  if (!secret || !sb) return reply({ available: false, reason: 'unavailable' })
  // TEMPORARY PREVIEW TEST BYPASS — REMOVE BEFORE PR #178 MERGE: Preview only, no allowance read.
  if (previewAllowanceBypass()) return reply({ available: true })
  const ok = await revealAvailable(sb, ipIdentity(req, secret), deviceMarker(req))
  if (ok === null) return reply({ available: false, reason: 'unavailable' })
  return reply(ok ? { available: true } : { available: false, reason: 'exhausted' })
}

export async function POST(req: NextRequest) {
  const tReq = Date.now()   // diagnostic only: total_ms in the ok/failed log lines
  let body: any
  try { body = await req.json() } catch { return reply({ status: 'bad_request', error: 'invalid_json' }, 400) }

  const src = await decodeSource(body?.image_b64)
  if ('error' in src) return reply({ status: 'bad_request', error: src.error }, 400)

  const secret = foyerSecret()
  const sb     = foyerDb()
  const replicateApiToken = process.env.REPLICATE_API_TOKEN
  if (!secret || !sb || !replicateApiToken) {
    console.error(`[foyer/reveal] unavailable: ${!secret ? 'FOYER_HMAC_SECRET missing or short' : !sb ? 'supabase not configured' : 'REPLICATE_API_TOKEN missing'}`)
    return reply({ status: 'unavailable' }, 503)
  }

  const verdict = verifyIntake(secret, body?.intake, sha256Hex(src.bytes))
  if (!verdict) return reply({ status: 'intake_required' }, 403)
  if (verdict.ageGroup === 'child' || verdict.ageGroup === 'teen') {
    return reply({ status: 'intake_required' }, 403)   // intake never signs these; belt and braces
  }

  // TEMPORARY PREVIEW TEST BYPASS — REMOVE BEFORE PR #178 MERGE: on a Preview
  // no allowance row is claimed or finalized (claimId stays null). Production
  // runs exactly the checks below.
  let claimId: string | null = null
  if (previewAllowanceBypass()) {
    console.log('[foyer/reveal] TEMPORARY PREVIEW TEST BYPASS: allowance not claimed')
  } else {
    const claim = await claimReveal(sb, ipIdentity(req, secret), deviceMarker(req))
    if (claim.kind === 'unavailable') {
      console.error(`[foyer/reveal] allowance unavailable — failing closed: ${claim.reason}`)
      return reply({ status: 'unavailable' }, 503)
    }
    if (claim.kind === 'exhausted') return reply({ status: 'exhausted' }, 429)
    claimId = claim.id
  }

  const effectId = pickRevealEffect()
  const t0 = Date.now()
  try {
    const r = await renderFoyerReveal({
      sourceImageB64: src.b64,
      effectId,
      subject:  verdict.subject,
      ageGroup: verdict.ageGroup,
      replicateApiToken,
    })
    if (claimId) await finalizeReveal(sb, claimId, true)
    // ms = the render step (NB2 + watermark), as before; nb2_ms / mark_ms /
    // refs split it -- diagnostic only (go-to-market pass 1, 2026-09-14).
    console.log(`[foyer/reveal] ok effect=${effectId} preset=${r.presetId} prompt_chars=${r.promptChars} ms=${Date.now() - t0} nb2_ms=${r.timing.nb2Ms} mark_ms=${r.timing.markMs} refs=${r.timing.styleRefs} total_ms=${Date.now() - tReq}`)
    return reply({ status: 'ok', image: r.imageDataUrl, label: r.label })
  } catch (e: any) {
    if (claimId) await finalizeReveal(sb, claimId, false)
    console.error(`[foyer/reveal] render failed effect=${effectId} ms=${Date.now() - t0} total_ms=${Date.now() - tReq}: ${e?.message || e}`)
    return reply({ status: 'failed' }, 502)
  }
}
