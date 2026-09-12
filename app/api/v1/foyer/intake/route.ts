// app/api/v1/foyer/intake/route.ts
//
// POST { image_b64 }  -- the foyer's photo intake. Anonymous.
//
// The one safety step before a visitor's photograph goes anywhere: the same
// face/age/gender check /portraits/generate runs (detectFaceVisibility), under
// the same policy -- Liten and Co does not craft images of anyone under 18,
// and a detection outage fails OPEN, logged, as it does there. No aesthetic
// QA: this is not Gate 1.
//
// Answers:
//   200 { status:'ok', subject, gender, age_group, intake }
//         subject is what Discovery's effect resolution needs ('man' |
//         'woman' | null); intake is a signed note of this verdict, bound to
//         these exact bytes, that /foyer/reveal accepts instead of looking
//         again.
//   403 { status:'refused', code:'age_restricted' }   nothing is rendered
//   429 / 503 { status:'unavailable' }               capped, or the allowance
//         store cannot be reached -- the page carries on without a reveal
//   400 { status:'bad_request', error }
//
// The vision call is rationed per IP (foyer-policy.ts) so this cannot become
// the open tap /portraits/analyze was closed for.

import { NextRequest, NextResponse } from 'next/server'
import { detectFaceVisibility } from '@/lib/v1/portraits/portraits-refine'
import { decodeSource, foyerDb } from '@/lib/v1/foyer/foyer-source'
import { foyerSecret, ipIdentity, deviceMarker, sha256Hex, signIntake } from '@/lib/v1/foyer/foyer-identity'
import { claimIntake } from '@/lib/v1/foyer/foyer-allowance'
import { INTAKE_TOKEN_TTL_MS } from '@/lib/v1/foyer/foyer-policy'

export const runtime     = 'nodejs'
export const maxDuration = 60

const NO_STORE = { 'Cache-Control': 'no-store' }
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch { return reply({ status: 'bad_request', error: 'invalid_json' }, 400) }

  const src = await decodeSource(body?.image_b64)
  if ('error' in src) return reply({ status: 'bad_request', error: src.error }, 400)

  const secret = foyerSecret()
  const sb     = foyerDb()
  if (!secret || !sb) {
    console.error(`[foyer/intake] unavailable: ${!secret ? 'FOYER_HMAC_SECRET missing or short' : 'supabase not configured'}`)
    return reply({ status: 'unavailable' }, 503)
  }

  const cap = await claimIntake(sb, ipIdentity(req, secret), deviceMarker(req))
  if (cap !== 'ok') return reply({ status: 'unavailable' }, cap === 'capped' ? 429 : 503)

  let gender: 'f' | 'm' | null = null
  let ageGroup: string | null = null
  try {
    const det = await detectFaceVisibility({
      sourceImageB64: src.b64,
      openaiApiKey:   process.env.OPENAI_API_KEY || '',
    })
    gender   = det.gender
    ageGroup = det.age_group
    console.log(`[foyer/intake] age_group=${ageGroup ?? 'null'} gender=${gender ?? 'null'} face_visible=${det.face_visible}`)
  } catch (e) {
    console.error('[foyer/intake] age check FAILED OPEN —', e)
  }

  if (ageGroup === 'child' || ageGroup === 'teen') {
    return reply({ status: 'refused', code: 'age_restricted' }, 403)
  }

  const subject = gender === 'f' ? 'woman' : gender === 'm' ? 'man' : null
  const intake = signIntake(secret, {
    sha: sha256Hex(src.bytes), subject, ageGroup, exp: Date.now() + INTAKE_TOKEN_TTL_MS,
  })
  return reply({ status: 'ok', subject, gender, age_group: ageGroup, intake })
}
