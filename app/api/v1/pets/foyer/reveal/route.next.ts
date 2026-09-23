// Pets adapter of the existing Foyer reveal; allowance, delivery and finalization unchanged.
import { NextRequest, NextResponse } from 'next/server'
import { decodeSource, foyerDb } from '@/lib/v1/foyer/foyer-source'
import { foyerSecret, ipIdentity, deviceMarker, sha256Hex, verifyIntake } from '@/lib/v1/foyer/foyer-identity'
import { claimReveal, finalizeReveal, revealAvailable } from '@/lib/v1/foyer/foyer-allowance'
import { pickRevealEffect } from '@/lib/v1/foyer/foyer-policy'
import { renderPetsFoyerReveal as renderFoyerReveal } from '@/lib/v1/pets/pets-foyer-render'
import { getUser } from '@/lib/store/auth'
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
  const user = await getUser().catch(() => null)
  if (!user) return reply({ status: 'unavailable', reason: 'not_signed_in' }, 401)
  const tReq = Date.now()   // diagnostic only: total_ms in the ok/failed log lines
  let body: { image_b64?: unknown; intake?: unknown }
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

  const verdict = verifyIntake(secret + ':pets:' + user.id, body?.intake, sha256Hex(src.bytes))
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
      replicateApiToken,
    })
    if (claimId) await finalizeReveal(sb, claimId, true)
    // ms = the render step (NB2 + watermark), as before; nb2_ms / mark_ms /
    // refs split it -- diagnostic only (go-to-market pass 1, 2026-09-14).
    console.log(`[foyer/reveal] ok effect=${effectId} preset=${r.presetId} prompt_chars=${r.promptChars} ms=${Date.now() - t0} nb2_ms=${r.timing.nb2Ms} mark_ms=${r.timing.markMs} refs=${r.timing.styleRefs} total_ms=${Date.now() - tReq}`)
    return reply({ status: 'ok', image: r.imageDataUrl, label: r.label })
  } catch (e: unknown) {
    if (claimId) await finalizeReveal(sb, claimId, false)
    console.error(`[foyer/reveal] render failed effect=${effectId} ms=${Date.now() - t0} total_ms=${Date.now() - tReq}: ${e instanceof Error ? e.message : String(e)}`)
    return reply({ status: 'failed' }, 502)
  }
}
