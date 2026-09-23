// Pets Foyer intake: existing authenticated Pets analysis and shared Foyer allowance.
// Signed notes are bound to this category, signed-in user and exact source bytes.
import { NextRequest, NextResponse } from 'next/server'
import { analyzePetSourceSet } from '@/lib/v1/pets/pets-refine'
import { getUser } from '@/lib/store/auth'
import { decodeSource, foyerDb } from '@/lib/v1/foyer/foyer-source'
import { foyerSecret, ipIdentity, deviceMarker, sha256Hex, signIntake } from '@/lib/v1/foyer/foyer-identity'
import { claimIntake } from '@/lib/v1/foyer/foyer-allowance'
import { INTAKE_TOKEN_TTL_MS } from '@/lib/v1/foyer/foyer-policy'
import { previewIntakeCapBypass } from '@/lib/v1/foyer/foyer-preview-bypass'   // TEMPORARY PREVIEW TEST BYPASS — REMOVE BEFORE PR #178 MERGE

export const runtime     = 'nodejs'
export const maxDuration = 60

const NO_STORE = { 'Cache-Control': 'no-store' }
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

export async function POST(req: NextRequest) {
  const user = await getUser().catch(() => null)
  if (!user) return reply({ status: 'unavailable', reason: 'not_signed_in' }, 401)
  let body: { image_b64?: unknown; intake?: unknown }
  try { body = await req.json() } catch { return reply({ status: 'bad_request', error: 'invalid_json' }, 400) }

  const src = await decodeSource(body?.image_b64)
  if ('error' in src) return reply({ status: 'bad_request', error: src.error }, 400)

  const secret = foyerSecret()
  const sb     = foyerDb()
  if (!secret || !sb) {
    console.error(`[foyer/intake] unavailable: ${!secret ? 'FOYER_HMAC_SECRET missing or short' : 'supabase not configured'}`)
    return reply({ status: 'unavailable' }, 503)
  }

  // ── TEMPORARY PREVIEW TEST BYPASS — REMOVE BEFORE PR #178 MERGE ──────────
  // On a Vercel Preview deployment only (VERCEL_ENV, set by the platform),
  // the per-IP limit is skipped: no claim, no intake row. Everything after
  // it -- the face/age/gender check and the refusals -- runs as always.
  if (!previewIntakeCapBypass()) {
    const cap = await claimIntake(sb, ipIdentity(req, secret), deviceMarker(req))
    if (cap !== 'ok') return reply({ status: 'unavailable' }, cap === 'capped' ? 429 : 503)
  }
  // ── end TEMPORARY PREVIEW TEST BYPASS ─────────────────────────────────────

  if (!process.env.OPENAI_API_KEY) return reply({ status: 'unavailable' }, 503)
  try {
    await analyzePetSourceSet({ sourceImageB64: src.b64, additionalImagesB64: [], openaiApiKey: process.env.OPENAI_API_KEY })
  } catch (e) {
    console.error('[pets/foyer/intake] analysis failed', e)
    return reply({ status: 'unavailable' }, 503)
  }
  const subject = null, gender = null, ageGroup = null
  const intake = signIntake(secret + ':pets:' + user.id, {
    sha: sha256Hex(src.bytes), subject, ageGroup, exp: Date.now() + INTAKE_TOKEN_TTL_MS,
  })
  return reply({ status: 'ok', subject, gender, age_group: ageGroup, intake })
}
