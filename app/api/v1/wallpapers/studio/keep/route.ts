// app/api/v1/wallpapers/studio/keep/route.ts
//
// Spends four credits and releases the clean, unwatermarked file.
//
// ── FOUR CREDITS, NOT SIX ──────────────────────────────────────────────
//
// The photo wallpapers are six ($2.99). The Studio is four ($1.99), because
// nobody's face is in it — the market will not bear a portrait's price for
// something a stranger's face is not in.
//
// A craft is ten. This route therefore does NOT call /api/v1/credits/gate,
// which validates cost_per against CREDITS_PER_IMAGE and would refuse
// anything that is not ten. It spends directly, against the same RPC and
// writing the same ledger shape.
//
// ── THE ORDER OF OPERATIONS IS THE WHOLE ROUTE ─────────────────────────
//
//   1  signed in?
//   2  does the clean file exist?
//   3  copy it into the collection bucket
//   4  spend
//   5  record the piece
//   6  sign the URL
//
// Two comes before three because money must not move for a file that
// cannot be delivered — the same rule the craft gate learned when a
// customer paid ten credits for an effect with no prompt behind it and
// received a 400.
//
// Four comes after three because a signed URL handed out before the spend
// settles is the file, given away.
//
// ── THE PIECE MOVES BUCKETS ON KEEP ────────────────────────────────────
//
// CORRECTED 20 August. This route wrote image_path as
// `previews/studio/<id>.jpg` and was wrong twice over.
//
// The convention, set by app/api/v1/portraits/pieces/route.ts and followed
// by everything that reads a piece:
//
//   bucket      collection
//   image_path  <ownerKey>/<pieceId>.jpg
//
// A BARE PATH scoped by owner, with no bucket prefix, because every reader
// signs image_path against the collection bucket itself. Writing the
// bucket into the path means the reader signs `collection/previews/...`
// and gets nothing.
//
// Either fault alone returns null. On the community board that looks
// exactly like a board nobody has posted to, which is how it would have
// stayed hidden.
//
// So the clean file is COPIED out of the private previews bucket into
// collection under the owner's key. Cross-bucket, so it is a download and
// an upload rather than a storage copy.
//
// It happens BEFORE the spend. Money must not move for a piece that cannot
// be delivered — the same rule the craft gate learned when a customer paid
// ten credits for an effect with no prompt behind it. A copy that succeeds
// and a spend that fails leaves an unreferenced object in storage, which
// costs pennies and is swept.
//
// ── PREVIEWS ARE NOT KEPT. A KEPT IMAGE IS. ────────────────────────────
//
// Ruled 11 August: the four previews in a round live as long as the session
// needs them and are swept. Only a kept image becomes a collection_pieces
// row — nobody pays to store rounds nobody wanted.
//
// That row is also what the "five and the sixth is free" counter counts, so
// it is not merely a record: it is the thing the offer is made of. Written
// non-fatally all the same. A customer who paid must get their file even if
// the row fails, and a failed insert is loud enough to reconcile by hand.
//
// ── EVERY CHARGE IS NAMEABLE ───────────────────────────────────────────
//
// The refund route matches a ledger row on reason and ref_id and refuses
// outright without one. A ref_id written as null is a charge nothing can
// reverse — that cost Rich fifty credits in one session. So a ref is minted
// here and returned, and the client may supply its own so a retried keep
// reuses one reference rather than charging under two.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { getUser } from '@/lib/store/auth'
import {
  STUDIO_BUCKET,
  studioCleanPath,
  STUDIO_SIGNED_URL_SECONDS,
  COLLECTION_BUCKET,
  collectionPiecePath,
} from '@/lib/v1/wallpapers/studio-store'

export const runtime = 'nodejs'

/** $1.99. See the header. */
const STUDIO_KEEP_CREDITS = 4

// POST { id, ref_id? }
//   ok  → { ok:true, url, ref_id, balance_after, spent }
//   !ok → { ok:false, reason:'signed_out' | 'no_credits' | ... }
export async function POST(req: Request) {
  try {
    const db = svc()
    if (!db) {
      return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))

    const rawId = typeof body.id === 'string' ? body.id.trim() : ''
    // Round ids are `<8 chars>-<0..3>`. Anything with a slash or a dot is
    // somebody trying to name a different object in the bucket.
    if (!rawId || !/^[A-Za-z0-9_-]{1,80}$/.test(rawId)) {
      return NextResponse.json({ ok: false, reason: 'bad_id' }, { status: 400 })
    }

    // ── 1 · Signed in ──
    // The page handles this by name: it sends them to sign in and back.
    const user = await getUser().catch(() => null)
    if (!user?.id) {
      return NextResponse.json({ ok: false, reason: 'signed_out' }, { status: 401 })
    }
    const owner = user.id

    // ── 2 · The file exists ──
    // Checked BEFORE the spend. A missing object here means the round was
    // swept or never stored, and the customer must not pay for it.
    const path = studioCleanPath(rawId)
    const { data: found, error: listErr } = await db.storage
      .from(STUDIO_BUCKET)
      .list('studio', { search: `${rawId}.jpg`, limit: 1 })

    if (listErr) {
      console.error(`[studio/keep] storage list failed: ${listErr.message}`)
      return NextResponse.json({ ok: false, reason: 'storage_unavailable' }, { status: 503 })
    }
    if (!found || found.length === 0) {
      return NextResponse.json({ ok: false, reason: 'expired' }, { status: 404 })
    }

    // ── 3 · Copy it into the collection bucket ──
    //
    // The piece id is minted here rather than left to the table's default,
    // because the path contains it and the file has to be in place before
    // the row that names it.
    const pieceId    = randomUUID()
    const piecePath  = collectionPiecePath(owner, pieceId)

    const { data: clean, error: dlErr } = await db.storage
      .from(STUDIO_BUCKET).download(path)

    if (dlErr || !clean) {
      console.error(`[studio/keep] download failed ${path}: ${dlErr?.message}`)
      return NextResponse.json({ ok: false, reason: 'storage_unavailable' }, { status: 503 })
    }

    const { error: upErr } = await db.storage
      .from(COLLECTION_BUCKET)
      .upload(piecePath, Buffer.from(await clean.arrayBuffer()), {
        contentType: 'image/jpeg',
        upsert:      true,
      })

    if (upErr) {
      // Before the spend, so nobody has paid. A refusal here is a bad
      // moment, not a bad outcome.
      console.error(`[studio/keep] copy to collection failed ${piecePath}: ${upErr.message}`)
      return NextResponse.json({ ok: false, reason: 'storage_unavailable' }, { status: 503 })
    }

    // ── 4 · Spend ──
    const suppliedRef = typeof body.ref_id === 'string' ? body.ref_id.trim() : ''
    const refId = suppliedRef ? suppliedRef.slice(0, 64) : `studio_${randomUUID()}`

    const { data: spent, error: spendErr } = await db.rpc('spend_credits', {
      p_owner: owner,
      p_n:     STUDIO_KEEP_CREDITS,
    })

    if (spendErr) {
      return NextResponse.json(
        { ok: false, reason: `spend_failed: ${spendErr.message}` }, { status: 500 })
    }

    // The RPC returns -1 for insufficient funds AND for no balance row at
    // all. Both are the same thing to a customer: they need credits.
    if (typeof spent !== 'number' || spent < 0) {
      const { data: bal } = await db
        .from('credit_balances').select('balance').eq('owner_key', owner).maybeSingle()
      return NextResponse.json({
        ok: false,
        reason:  'no_credits',
        balance: bal?.balance ?? 0,
        needed:  STUDIO_KEEP_CREDITS,
      })
    }

    const balanceAfter = spent

    // Audit. Non-fatal — the customer has paid and must get their file even
    // if the ledger write fails, and a failed write is loud enough to
    // reconcile by hand.
    const { error: ldErr } = await db.from('credit_ledger').insert({
      owner_key:     owner,
      delta:         -STUDIO_KEEP_CREDITS,
      reason:        'studio_keep',
      ref_id:        refId,
      balance_after: balanceAfter,
    })
    if (ldErr) {
      console.error(`[studio/keep] credit_ledger insert FAILED ref=${refId}: ${ldErr.message}`)
    }

    // ── 6 · Release ──
    //
    // Signed against collection, from the bare owner-scoped path, exactly
    // as every other reader of a piece does.
    const { data: signed, error: signErr } = await db.storage
      .from(COLLECTION_BUCKET)
      .createSignedUrl(piecePath, STUDIO_SIGNED_URL_SECONDS)

    if (signErr || !signed?.signedUrl) {
      // Paid and undelivered. This is the one state that must never be
      // quiet — the ref is logged so it can be refunded by name.
      console.error(
        `[studio/keep] PAID BUT UNDELIVERED owner=${owner} ref=${refId} ` +
        `id=${rawId}: ${signErr?.message ?? 'no url'}`,
      )
      return NextResponse.json({
        ok: false, reason: 'delivery_failed', ref_id: refId,
      }, { status: 500 })
    }

    // ── 5 · Record the piece ──
    //
    // series is 'wallpapers' rather than 'studio' so the Print Shop's
    // exclusion of this silo works off one value, and so a season is a
    // vocabulary rather than a series — the same rule the rooms follow.
    //
    // The season lives in meta, which is where the kept-count query filters
    // it: Halloween keeps its own five.
    const season = typeof body.season === 'string' && body.season === 'halloween'
      ? 'halloween'
      : null

    const { error: pieceErr } = await db.from('collection_pieces').insert({
      id:         pieceId,
      owner_key:  owner,
      user_id:    owner,
      series:     'wallpapers',
      preset:     'studio',
      label:      season ? 'Studio · Halloween' : 'Studio',
      mode:       'studio',
      // Bare, owner-scoped, no bucket prefix. See the header.
      image_path: piecePath,
      meta:       {
        room:    'studio',
        season,
        ref_id:  refId,
        credits: STUDIO_KEEP_CREDITS,
      },
    })

    if (pieceErr) {
      // Loud, not fatal. The customer has paid and the file is about to be
      // released; a missing row costs them a place in their collection and
      // one step toward the free sixth, both recoverable by hand.
      console.error(
        `[studio/keep] collection_pieces insert FAILED owner=${owner} ` +
        `ref=${refId} id=${rawId}: ${pieceErr.message}`,
      )
    }

    console.log(`[studio/keep] kept id=${rawId} owner=${owner} ref=${refId} season=${season ?? '-'}`)

    // The count AFTER this keep, so the page can update its counter the
    // moment it changes rather than on the next page view. Soft — a count
    // that failed to read is not worth failing a delivered file over.
    let kept: number | null = null
    try {
      kept = await countKept(db, owner, season)
    } catch (e: any) {
      console.warn(`[studio/keep] kept count failed: ${e?.message}`)
    }

    return NextResponse.json({
      ok:            true,
      url:           signed.signedUrl,
      ref_id:        refId,
      balance_after: balanceAfter,
      spent:         STUDIO_KEEP_CREDITS,
      kept,
    })

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'error'
    console.error(`[studio/keep] ${msg}`)
    return NextResponse.json({ ok: false, reason: msg }, { status: 500 })
  }
}

function svc() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * How many Studio pieces this owner has kept, in this season.
 *
 * PER SEASON, deliberately. Halloween keeps its own five and its own free
 * sixth. A season is a vocabulary rather than a product, but the reward is
 * per room — five Halloween pieces should not spend a general Studio's
 * count, and the customer would be right to be annoyed if they did.
 *
 * Filters on meta->>'season', which is null for the general Studio. Postgres
 * treats `meta->>'season' is null` and `= 'halloween'` as the two cases, so
 * neither can accidentally match the other.
 */
export async function countKept(
  db: ReturnType<typeof createClient>,
  owner: string,
  season: string | null,
): Promise<number> {
  let q = db
    .from('collection_pieces')
    .select('id', { count: 'exact', head: true })
    .eq('owner_key', owner)
    .eq('series', 'wallpapers')
    .eq('mode', 'studio')
    .eq('archived', false)

  q = season
    ? q.eq('meta->>season', season)
    : q.is('meta->>season', null)

  const { count, error } = await q
  if (error) throw new Error(error.message)
  return count ?? 0
}
