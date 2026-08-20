// app/api/v1/curator/suggest/route.ts
//
// THE SESSION CHECK-IN.
//
// Called once when the collection opens. Usually returns nothing. When it
// does return something, it is one piece the Curator thinks is worth
// showing on the community board.
//
// ── THE GATES, IN ORDER, CHEAPEST FIRST ────────────────────────────────
//
//   signed in
//   48 hours since the last suggestion of any kind
//   at least a few pieces to choose from
//   five sampled, scored until one clears the bar
//
// Every gate above the scoring one is a database read. The vision calls
// only happen when there is a real chance of something to say.
//
// ── 48 HOURS IS BETWEEN SUGGESTIONS, NOT PER PIECE ─────────────────────
//
// Rich, 19 August. She speaks at most every other day whatever the
// collection does. Somebody who crafts ten pieces in an afternoon gets one
// invitation, and the next no sooner than two days later.
//
// ── SHE NEVER ASKS TWICE ABOUT THE SAME PIECE ──────────────────────────
//
// Silence was an answer. Asking again about the same photograph reads as
// nagging, and there are other pieces. Enforced by a unique index rather
// than by this route remembering.
//
// ── NO REWARD IS OFFERED, DELIBERATELY ─────────────────────────────────
//
// Credits for posting were considered and refused. The suggestion works
// because it is C. saying THIS IS GOOD — a judgment from someone whose
// entire credibility is taste. Attach a payment and the compliment stops
// being believable: she would say that about anything, there is a bounty
// on it.
//
// It would also poison the board. Paid posts mean people post to get paid,
// and the wall fills with whatever clears the bar rather than with what
// people were proud of.
//
// The reward for posting is being seen, and hearing back.
//
// ── THE SCORE IS NEVER RETURNED ────────────────────────────────────────
//
// It is written to curator_suggestions for tuning and it does not appear
// in the response. A customer who can see that their family portrait
// scored 4 has been told it is not good enough, and no Curator line
// survives that.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '@/lib/store/auth'
import {
  scoreStandout,
  STANDOUT_THRESHOLD,
  STANDOUT_SAMPLE_SIZE,
} from '@/lib/v1/curator/standout'

export const runtime     = 'nodejs'
export const maxDuration = 60

const SUGGESTION_GAP_HOURS = 48

/** Below this there is nothing to choose from and the sample is the
 *  collection. Suggesting somebody's only piece is not a judgment. */
const MIN_COLLECTION_SIZE = 4

export async function GET() {
  try {
    const user = await getUser().catch(() => null)
    if (!user?.id) return silent()

    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return silent()

    const db    = createClient(url, key, { auth: { persistSession: false } })
    const owner = user.id

    // ── Gate 1: has it been 48 hours ──
    const { data: last } = await db
      .from('curator_suggestions')
      .select('created_at')
      .eq('owner_key', owner)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (last?.created_at) {
      const hours = (Date.now() - new Date(last.created_at).getTime()) / 3_600_000
      if (hours < SUGGESTION_GAP_HOURS) return silent()
    }

    // ── Gate 2: pieces she has not already named ──
    const { data: alreadyAsked } = await db
      .from('curator_suggestions')
      .select('piece_id')
      .eq('owner_key', owner)

    const asked = new Set((alreadyAsked ?? []).map((r: any) => r.piece_id))

    const { data: pieces, error: pErr } = await db
      .from('collection_pieces')
      .select('id, series, label, image_path')
      .eq('owner_key', owner)
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(60)

    if (pErr || !pieces || pieces.length < MIN_COLLECTION_SIZE) return silent()

    const candidates = pieces.filter(p => !asked.has(p.id))
    if (!candidates.length) return silent()

    // ── Gate 3: sample, then score until one clears ──
    //
    // Shuffled rather than taken in order, so a fresh sample each session
    // means a piece that missed the cut can come up again. No permanent
    // verdict on anybody's photograph.
    const sample = shuffle(candidates).slice(0, STANDOUT_SAMPLE_SIZE)

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) return silent()

    for (const piece of sample) {
      const b64 = await fetchPieceB64(db, piece.image_path)
      if (!b64) continue

      let scored
      try {
        scored = await scoreStandout({ imageB64: b64, openaiApiKey })
      } catch (e: any) {
        console.warn(`[curator/suggest] score failed ${piece.id}: ${e?.message}`)
        continue
      }

      if (scored.score < STANDOUT_THRESHOLD) continue

      // Recorded BEFORE responding. If the write fails she says nothing
      // rather than saying something she cannot remember having said —
      // which would mean asking again about the same piece tomorrow.
      const { error: insErr } = await db.from('curator_suggestions').insert({
        owner_key: owner,
        piece_id:  piece.id,
        kind:      'post_to_community',
        score:     scored.score,
      })

      if (insErr) {
        console.error(`[curator/suggest] insert failed ${piece.id}: ${insErr.message}`)
        return silent()
      }

      console.log(
        `[curator/suggest] ${owner} -> ${piece.id} ` +
        `score=${scored.score} sampled=${sample.indexOf(piece) + 1}/${sample.length}`,
      )

      return NextResponse.json({
        suggestion: {
          kind:     'post_to_community',
          piece_id: piece.id,
          series:   piece.series,
          label:    piece.label,
          // No score. See the header.
        },
      })
    }

    // Nothing cleared the bar. She says nothing — not another five.
    return silent()

  } catch (e: any) {
    console.error(`[curator/suggest] ${e?.message}`)
    return silent()
  }
}

/** The ordinary outcome. A session where she does not speak costs nothing,
 *  and the UI carries the moment perfectly well without her. */
function silent() {
  return NextResponse.json({ suggestion: null })
}

function shuffle<T>(a: T[]): T[] {
  const out = [...a]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** image_path is stored as `<bucket>/<key>`. */
async function fetchPieceB64(
  db: ReturnType<typeof createClient>,
  imagePath: string,
): Promise<string | null> {
  try {
    const slash  = imagePath.indexOf('/')
    if (slash <= 0) return null
    const bucket = imagePath.slice(0, slash)
    const key    = imagePath.slice(slash + 1)

    const { data, error } = await db.storage.from(bucket).download(key)
    if (error || !data) return null
    return Buffer.from(await data.arrayBuffer()).toString('base64')
  } catch {
    return null
  }
}
