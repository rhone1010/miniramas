// app/api/v1/wallpapers/studio/generate/route.ts
//
// THE STUDIO — a round of four. Free, no sign-in, no photograph.
//
// The page sends four ids and a season. It never sends a prompt, and this
// route never accepts one.
//
// ── THE VALIDATION IS THE WHOLE SAFETY STORY ───────────────────────────
//
// Every id is checked against the vocabulary in studio-prompt.ts and
// anything unknown is refused. No prompt, no fragment of one, no seed, no
// step count, no model name, no negative prompt — whatever a future caller
// sends, whatever a browser is talked into sending.
//
// Four dropdowns cannot be talked into anything. That stops being true the
// moment a browser is trusted with words that reach the model, which is
// why `freeform` appears nowhere below. The absence of free text is also
// the absence of a moderation problem, and it is worth more than any
// classifier that could be put in front of it.
//
// ── WHAT COMES BACK, AND WHAT DOES NOT ─────────────────────────────────
//
// The four watermarked previews come back inline as data URLs. They are
// never stored: nobody pays to keep rounds nobody wanted, and a preview
// that lives only in the response is a preview with nothing to sweep.
//
// The four CLEAN files go to the private previews bucket and are released
// only by studio/keep, against four credits. A clean file must never
// reach a browser from here.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID, createHash } from 'crypto'

import {
  generateStudioRound,
  isRemixId,
} from '@/lib/v1/wallpapers/studio-generator'
import {
  validateStudioChoice,
  buildStudioRound,
} from '@/lib/v1/wallpapers/studio-round'
import { STUDIO_BUCKET, studioCleanPath } from '@/lib/v1/wallpapers/studio-store'

export const runtime     = 'nodejs'
export const maxDuration = 120

/** Rich, 11 August. Free generation is the only place in this business with
 *  no ceiling on it. At 0.3 cents an image it is a nuisance rather than a
 *  risk, but it needs a number. */
const ROUNDS_PER_SESSION = 15
const ROUNDS_PER_IP_DAY  = 40

export async function POST(req: NextRequest) {
  const t0 = Date.now()

  try {
    const body = await req.json().catch(() => ({}))

    // ── The vocabulary check ──
    //
    // Which vocabulary depends on `season`. Halloween ids are validated
    // against studio-halloween.ts, general ids against studio-prompt.ts,
    // and Energy comes from studio-prompt.ts either way because it
    // describes composition and motion, which do not become seasonal.
    //
    // studio-round.ts owns that dispatch so this route has no branch per
    // season and neither vocabulary file has to know the other exists.
    const v = validateStudioChoice(body)
    if (!v.ok) {
      return NextResponse.json(
        { ok: false, reason: 'unknown_choice', got: v.got },
        { status: 400 },
      )
    }

    // Remix is optional and validated the same way. An unknown id is
    // ignored rather than refused — a stale button on a cached page is not
    // worth failing a round over.
    const remixId = isRemixId(body.remix) ? body.remix : undefined

    const replicateApiToken = process.env.REPLICATE_API_TOKEN
    if (!replicateApiToken) {
      return NextResponse.json(
        { ok: false, reason: 'not_configured' }, { status: 500 })
    }

    const db = svc()

    // ── The cap ──
    //
    // WHAT HAPPENS AT THE WALL MATTERS MORE THAN THE NUMBER. Somebody who
    // has generated fifteen rounds and bought nothing is somebody who liked
    // it enough to try fifteen times — the worst possible moment to say no.
    //
    // So this returns `capped` with the counts and NO message. The line
    // belongs to Rich and it is the Concierge's register, not an error's.
    // The page owns what is shown; this route only says the wall was hit.
    const sessionId = readSessionId(body)
    const ipHash    = clientIpHash(req)

    if (db) {
      const cap = await checkCap(db, sessionId, ipHash)
      if (!cap.allowed) {
        return NextResponse.json({
          ok: false,
          reason: 'capped',
          scope: cap.scope,
          rounds: cap.rounds,
        }, { status: 429 })
      }
    }

    // The four prompts, built before anything is rendered. TWIST is rolled
    // per image inside here for Halloween, so the four in a round differ by
    // twist as well as by Energy.
    const entries = buildStudioRound(v.season, v.choice, remixId)

    const round = await generateStudioRound({
      entries,
      replicateApiToken,
    })

    if (!round.ok) {
      return NextResponse.json({
        ok: false,
        reason: 'generation_failed',
        errors: round.errors,
      }, { status: 502 })
    }

    // ── Store the clean files, ship the watermarked ones ──
    //
    // A clean file that failed to store is a keep that cannot be honoured,
    // so that tile is dropped from the round rather than shown as something
    // the customer might pay for and not receive.
    const images: {
      id: string; preview: string; energy_label: string
    }[] = []

    for (const img of round.images) {
      if (db) {
        const { error } = await db.storage
          .from(STUDIO_BUCKET)
          .upload(studioCleanPath(img.id), img.clean, {
            contentType: 'image/jpeg',
            upsert:      true,
          })
        if (error) {
          console.error(`[studio/generate] clean store FAILED ${img.id}: ${error.message}`)
          continue
        }
      }
      images.push({
        id:           img.id,
        energy_label: img.energy_label,
        preview:      `data:image/jpeg;base64,${img.preview.toString('base64')}`,
      })
    }

    if (!images.length) {
      return NextResponse.json(
        { ok: false, reason: 'storage_failed' }, { status: 500 })
    }

    if (db) await recordRound(db, sessionId, ipHash, v.choice as any, v.season)

    console.log(
      `[studio/generate] ${images.length}/4 in ${Date.now() - t0}ms — ` +
      `${(v.choice as any).world}/${(v.choice as any).mood}/` +
      `${(v.choice as any).energy}/${(v.choice as any).palette} ` +
      `remix=${remixId ?? '-'} season=${v.season ?? '-'} ` +
      `twists=${entries.map(e => e.twist ?? '-').join(',')}`,
    )

    return NextResponse.json({ ok: true, images })

  } catch (e: any) {
    const msg = e?.message || 'unknown error'
    console.error(`[studio/generate] failed in ${Date.now() - t0}ms: ${msg}`)
    return NextResponse.json({ ok: false, reason: msg }, { status: 500 })
  }
}

// ─── HELPERS ────────────────────────────────────────────────────

/** Returns the id only if it is in the list. Anything else becomes
 *  undefined and fails isValid — the caller never gets to say what the id
 *  means. */
function pick<T extends string>(
  list: { id: T }[],
  v: unknown,
): T | undefined {
  if (typeof v !== 'string') return undefined
  return list.find(e => e.id === v)?.id
}

function svc() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * The client's own type, taken from svc rather than written out.
 *
 * `ReturnType<typeof createClient>` is NOT the same type — it resolves the
 * generics to their defaults, and a helper declared with it rejects the
 * client svc actually returns. The schema parameter widens to `never`,
 * which then makes every .insert() argument unassignable for reasons that
 * have nothing to do with the row being inserted.
 *
 * Deriving it from svc means the two can never drift.
 */
type Db = NonNullable<ReturnType<typeof svc>>

function clientIpHash(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  const ip  = (fwd ? fwd.split(',')[0] : req.headers.get('x-real-ip') || 'unknown').trim()
  return createHash('sha256').update(ip).digest('hex')
}

/** The page holds this across a visit. Absent, every request looks like a
 *  new session and only the IP cap bites — which is the correct failure
 *  direction for a lead magnet. */
function readSessionId(body: any): string {
  const s = typeof body.session_id === 'string' ? body.session_id.trim() : ''
  return s ? s.slice(0, 64) : randomUUID()
}

type CapResult =
  | { allowed: true }
  | { allowed: false; scope: 'session' | 'ip'; rounds: number }

/**
 * Confirmed overuse blocks; an infrastructure error ALLOWS, loudly.
 *
 * Same rule as the free-preview ledger. A missing table or a slow read must
 * not cost somebody their round — the ceiling exists to stop a script, not
 * to police a customer, and at 0.3 cents an image the cost of being wrong
 * in the generous direction is pennies.
 *
 * NEEDS `studio_rounds`. Until the migration lands this logs and allows,
 * which is a working page with no ceiling rather than a broken one.
 */
async function checkCap(
  db: Db,
  sessionId: string,
  ipHash: string,
): Promise<CapResult> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [{ count: sessionRounds }, { count: ipRounds }] = await Promise.all([
      db.from('studio_rounds')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId),
      db.from('studio_rounds')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .gte('created_at', since),
    ])

    if ((sessionRounds ?? 0) >= ROUNDS_PER_SESSION) {
      return { allowed: false, scope: 'session', rounds: sessionRounds ?? 0 }
    }
    if ((ipRounds ?? 0) >= ROUNDS_PER_IP_DAY) {
      return { allowed: false, scope: 'ip', rounds: ipRounds ?? 0 }
    }
    return { allowed: true }

  } catch (e: any) {
    console.warn(`[studio/generate] cap check errored — allowing: ${e?.message}`)
    return { allowed: true }
  }
}

/** Non-fatal. A round that generated and could not be counted is a round
 *  the customer got, which is the right way round. */
async function recordRound(
  db: Db,
  sessionId: string,
  ipHash: string,
  choice: { world: string; mood: string; energy: string; palette: string },
  season: string | null,
): Promise<void> {
  const { error } = await db.from('studio_rounds').insert({
    session_id: sessionId,
    ip_hash:    ipHash,
    world:      choice.world,
    mood:       choice.mood,
    energy:     choice.energy,
    palette:    choice.palette,
    season,
  })
  if (error) console.warn(`[studio/generate] round record failed: ${error.message}`)
}
