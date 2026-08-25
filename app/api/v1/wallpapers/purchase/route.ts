// app/api/v1/wallpapers/purchase/route.ts
//
// POST - buy studio wallpapers with credits, in one call.
//
//   { items: [{ section: 'general'|'halloween', filename: '0000_...jpg' }],
//     ref_id?: string }
//
//   ok  -> { ok:true, ref_id, spent, balance_after, granted,
//            pieces:[{ id, image_path, label }], admin }
//   !ok -> { ok:false, reason, ... }
//
// ── WHY ONE ROUTE DOES ALL THREE THINGS ─────────────────────────────
//
// Validate, deliver, charge. Splitting them across calls means a gap where
// credits are gone and files are not, and with `reason:'wallpapers'`
// deliberately invisible to the refund route (Rich, 24 August: no refund),
// that gap has no way back. One call, so the glass cannot get a charge
// without a delivery.
//
// ── ORDER: VALIDATE, WRITE, CHARGE LAST ─────────────────────────────
//
// Rich approved rows-first on 24 August. With no refund path the failure
// costs must point at the studio, not the customer:
//
//   validation fails   -> nothing written, nothing charged
//   rows fail          -> nothing charged
//   charge fails       -> the rows just written are archived again, and the
//                         customer has lost nothing
//
// The one bad window is milliseconds wide: rows exist, spend_credits
// refuses, rows are archived. A collection refresh timed inside it shows
// tiles that then vanish. Acceptable against the alternative, which is a
// charge that delivered nothing and cannot be refunded.
//
// ── THE SPEND IS THE GATE'S SPEND ───────────────────────────────────
//
// Same spend_credits RPC, same admin detection, same ledger shape the gate
// writes for this Series: ONE row, reason 'wallpapers', delta the whole
// basket. The glass calls THIS route for wallpapers, not the gate - the
// gate's wallpapers branch remains valid but this is the path that also
// delivers.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '@/lib/store/auth'
import {
  type WallpaperItem,
  WALLPAPER_SECTIONS,
  wallpaperTotal,
  wallpaperPath,
  wallpaperLabel,
  wallpaperMeta,
  validateItems,
} from '@/lib/v1/wallpapers/store'

export const runtime = 'nodejs'

function svc() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: Request) {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 500 })

    const user = await getUser().catch(() => null)
    const owner = user?.id ?? null
    if (!owner) {
      return NextResponse.json({ ok: false, reason: 'not_signed_in' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))

    const rawItems: unknown[] = Array.isArray(body.items) ? body.items : []
    const items: WallpaperItem[] = rawItems
      .filter((i: any): i is { section: string; filename: string } =>
        i && typeof i.section === 'string' && typeof i.filename === 'string')
      .map((i) => ({ section: i.section as WallpaperItem['section'], filename: i.filename.trim() }))

    if (!items.length || items.length !== rawItems.length) {
      return NextResponse.json({ ok: false, reason: 'items_required' }, { status: 400 })
    }

    // ── PRICE, before anything else ─────────────────────────────────
    const total = wallpaperTotal(items.length)
    if (total === null) {
      return NextResponse.json({ ok: false, reason: 'count_required' }, { status: 400 })
    }

    // ── IDEMPOTENCY ─────────────────────────────────────────────────
    // A retry after a network drop must not buy the basket twice. A
    // supplied ref that already has a wallpapers ledger row is answered as
    // the duplicate it is, with the pieces that purchase created.
    const suppliedRef = typeof body.ref_id === 'string' ? body.ref_id.trim().slice(0, 64) : ''
    const refId = suppliedRef || `wp_${crypto.randomUUID()}`

    if (suppliedRef) {
      const { data: prior } = await db
        .from('credit_ledger')
        .select('ref_id')
        .eq('owner_key', owner)
        .eq('reason', 'wallpapers')
        .eq('ref_id', suppliedRef)
        .maybeSingle()
      if (prior) {
        const { data: pieces } = await db
          .from('collection_pieces')
          .select('id, image_path, label')
          .eq('owner_key', owner)
          .contains('meta', { purchase_ref: suppliedRef })
        return NextResponse.json({
          ok: true, ref_id: suppliedRef, duplicate: true,
          granted: pieces?.length ?? 0, spent: 0,
          pieces: pieces ?? [],
        })
      }
    }

    // ── VALIDATE, before anything is written or charged ─────────────
    const check = await validateItems(db, items)
    if (!check.ok) {
      const status = check.rejected.some(r => r.reason === 'bucket_unavailable') ? 503 : 400
      return NextResponse.json(
        { ok: false, reason: 'items_rejected', rejected: check.rejected }, { status })
    }

    // ── DELIVER ─────────────────────────────────────────────────────
    // Five bought is five rows - five tiles in My Collection, each its own
    // downloadable picture. Rich, 24 August.
    // ── COPY INTO THE COLLECTION BUCKET, before any row or charge ───
    //
    // The pieces reader signs image_path against the private 'collection'
    // bucket - the same one crafted pieces live in, <owner>/<uuid>.jpg.
    // The public studio path CANNOT go into image_path: signing it yields
    // null and the tile renders blank. So each bought file is copied under
    // the buyer's prefix and the row carries the collection path; the
    // studio path stays in meta as source_path.
    //
    // A copy failure refuses the whole basket here, before anything is
    // written or billed - same posture as validation, and for the same
    // reason: nobody pays for a blank tile.
    const copied: Array<{ it: WallpaperItem; collectionPath: string }> = []
    for (const it of items) {
      const src = wallpaperPath(it)
      const { data: blob, error: dlErr } = await db.storage
        .from('wallpapers').download(src)
      if (dlErr || !blob) {
        console.error('[wallpapers/purchase] download failed:', src, dlErr?.message)
        return NextResponse.json(
          { ok: false, reason: 'items_rejected',
            rejected: [{ filename: it.filename, reason: 'copy_failed' }] },
          { status: 503 })
      }
      const collectionPath = `${owner}/${crypto.randomUUID()}.jpg`
      const { error: upErr } = await db.storage
        .from('collection')
        .upload(collectionPath, blob, { contentType: 'image/jpeg', upsert: false })
      if (upErr) {
        console.error('[wallpapers/purchase] copy failed:', collectionPath, upErr.message)
        return NextResponse.json(
          { ok: false, reason: 'items_rejected',
            rejected: [{ filename: it.filename, reason: 'copy_failed' }] },
          { status: 503 })
      }
      copied.push({ it, collectionPath })
    }

    const rows = copied.map(({ it, collectionPath }) => ({
      owner_key: owner,
      user_id: owner,
      series: 'wallpapers',
      preset: it.filename.replace(/\.jpg$/, '').split('_')[1] ?? null,  // the world, for filtering
      label: wallpaperLabel(it.filename),
      image_path: collectionPath,
      meta: { ...wallpaperMeta(it), purchase_ref: refId, source_path: wallpaperPath(it) },
      archived: false,
    }))

    const { data: inserted, error: insErr } = await db
      .from('collection_pieces')
      .insert(rows)
      .select('id, image_path, label')

    if (insErr || !inserted || inserted.length !== rows.length) {
      console.error('[wallpapers/purchase] insert failed:', insErr?.message)
      return NextResponse.json({ ok: false, reason: 'delivery_failed' }, { status: 500 })
    }

    // ── CHARGE, last ────────────────────────────────────────────────
    let isAdmin = false
    const { data: reds } = await db
      .from('code_redemptions').select('code').eq('owner_key', owner)
    const codes = (reds || []).map((r: { code: string }) => r.code)
    if (codes.length) {
      const { data: adminCodes } = await db
        .from('access_codes').select('code').eq('kind', 'admin').in('code', codes).limit(1)
      isAdmin = Array.isArray(adminCodes) && adminCodes.length > 0
    }

    let balanceAfter: number
    if (isAdmin) {
      const { data: bal } = await db
        .from('credit_balances').select('balance').eq('owner_key', owner).maybeSingle()
      balanceAfter = bal?.balance ?? 0
    } else {
      const { data: spent, error: spendErr } = await db.rpc('spend_credits', {
        p_owner: owner,
        p_n: total,
      })

      const failed = spendErr || typeof spent !== 'number' || spent < 0
      if (failed) {
        // The rows just written come back out. Archived rather than
        // deleted - the standing rule, and the archive is the record of a
        // purchase that nearly happened.
        const ids = inserted.map(p => p.id)
        const { error: archErr } = await db
          .from('collection_pieces')
          .update({ archived: true, archived_at: new Date().toISOString() })
          .in('id', ids)
        if (archErr) {
          // Undelivered AND unarchived: the customer was not charged, but
          // ghost tiles exist. Loud, with the ids, so they can be found.
          console.error('[wallpapers/purchase] UNWOUND CHARGE BUT ARCHIVE FAILED, ids:',
            ids.join(','), archErr.message)
        }

        if (spendErr) {
          console.error('[wallpapers/purchase] spend failed:', spendErr.message)
          return NextResponse.json({ ok: false, reason: 'spend_failed' }, { status: 500 })
        }
        const { data: bal } = await db
          .from('credit_balances').select('balance').eq('owner_key', owner).maybeSingle()
        return NextResponse.json({
          ok: false, reason: 'insufficient_credits',
          balance: bal?.balance ?? 0, needed: total,
        })
      }
      balanceAfter = spent as number
    }

    // ── LEDGER ──────────────────────────────────────────────────────
    // One row for the purchase, reason 'wallpapers'. The refund route
    // matches reason='craft' and will never see this - deliberate, ruled by
    // Rich on 24 August. No craft_events row: that table describes renders.
    const { error: ldErr } = await db.from('credit_ledger').insert([{
      owner_key: owner,
      delta: isAdmin ? 0 : -total,
      reason: 'wallpapers',
      ref_id: refId,
      balance_after: balanceAfter,
    }])
    if (ldErr) console.error('[wallpapers/purchase] ledger insert failed:', ldErr.message)

    return NextResponse.json({
      ok: true,
      ref_id: refId,
      spent: isAdmin ? 0 : total,
      balance_after: balanceAfter,
      granted: inserted.length,
      pieces: inserted,
      admin: isAdmin,
    })
  } catch (e) {
    console.error('[wallpapers/purchase] threw:', (e as Error).message)
    return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
  }
}
