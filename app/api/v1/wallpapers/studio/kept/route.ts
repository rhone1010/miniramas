// app/api/v1/wallpapers/studio/kept/route.ts
//
// How many Studio pieces this customer has kept, for the "five and the
// sixth is free" counter.
//
// ── PER SEASON ─────────────────────────────────────────────────────────
//
// Halloween keeps its own five and its own free sixth. A season is a
// vocabulary rather than a product — same four axes, same builder,
// different words — but the REWARD is per room. Five Halloween pieces
// spending a general Studio's count would be a customer's fair complaint.
//
// No season parameter means the general Studio.
//
// ── SIGNED OUT RETURNS ZERO, NOT AN ERROR ──────────────────────────────
//
// Ruled 11 August. The counter is a thing to aim at, and showing nothing to
// somebody who has not signed in yet is one fewer reason to.
//
// ── WHY THIS IS A GET AND WHY IT IS CHEAP ──────────────────────────────
//
// Called on every page load of the Studio. It is a head-only count against
// an indexed owner_key, and it is soft in every failure direction — a
// counter that cannot be read shows nothing rather than blocking the room.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '@/lib/store/auth'

export const runtime = 'nodejs'

/** Rich, 11 August. Five kept, and the sixth is free. */
export const STUDIO_FREE_SIXTH_AT = 5

export async function GET(req: NextRequest) {
  try {
    const url    = new URL(req.url)
    const season = url.searchParams.get('season') === 'halloween' ? 'halloween' : null

    const user = await getUser().catch(() => null)
    if (!user?.id) {
      return NextResponse.json({ kept: 0, free_sixth_at: STUDIO_FREE_SIXTH_AT })
    }

    const sbUrl = process.env.SUPABASE_URL
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!sbUrl || !sbKey) {
      return NextResponse.json({ kept: 0, free_sixth_at: STUDIO_FREE_SIXTH_AT })
    }

    const db = createClient(sbUrl, sbKey, { auth: { persistSession: false } })

    let q = db
      .from('collection_pieces')
      .select('id', { count: 'exact', head: true })
      .eq('owner_key', user.id)
      .eq('series', 'wallpapers')
      .eq('mode', 'studio')
      .eq('archived', false)

    // meta->>'season' is null for the general Studio. The two cases are
    // written separately so neither can accidentally match the other.
    q = season
      ? q.eq('meta->>season', season)
      : q.is('meta->>season', null)

    const { count, error } = await q

    if (error) {
      // Soft. A counter that cannot be read shows nothing; it does not
      // stop somebody generating.
      console.warn(`[studio/kept] count failed: ${error.message}`)
      return NextResponse.json({ kept: 0, free_sixth_at: STUDIO_FREE_SIXTH_AT })
    }

    const kept = count ?? 0

    return NextResponse.json({
      kept,
      free_sixth_at: STUDIO_FREE_SIXTH_AT,
      /** True when the NEXT keep should cost nothing. The glass reads this
       *  rather than doing the arithmetic, so the rule lives in one place. */
      next_is_free: kept > 0 && kept % (STUDIO_FREE_SIXTH_AT + 1) === STUDIO_FREE_SIXTH_AT,
      season,
    })

  } catch (e: any) {
    console.error(`[studio/kept] ${e?.message}`)
    return NextResponse.json({ kept: 0, free_sixth_at: STUDIO_FREE_SIXTH_AT })
  }
}
