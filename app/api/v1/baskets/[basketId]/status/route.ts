// app/api/v1/baskets/[basketId]/status/route.ts
//
// Polled, not SSE — per the earlier engine recommendation (Q2), reusing
// the pattern the wallpaper studio's 4-shot round already proves out at
// smaller scale, rather than standing up a second delivery mechanism.
//
// GET-only, ownership-checked. Returns every slot's current state so the
// client can progressively fill tiles as they land, same shape as
// basket-styled.html panel 8 expects ("7 of 20 complete").

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/store/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: { basketId: string } },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'auth_required' }, { status: 401 })

  const { data: basket, error: basketErr } = await supabaseAdmin
    .from('baskets')
    .select('id, user_id, series, size, status, free_unlocks')
    .eq('id', params.basketId)
    .maybeSingle()
  if (basketErr) {
    return NextResponse.json({ error: 'basket_status_query_failed' }, { status: 500 })
  }
  if (!basket) return NextResponse.json({ error: 'basket_not_found' }, { status: 404 })
  if (basket.user_id !== user.id) return NextResponse.json({ error: 'wrong_owner' }, { status: 403 })

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from('basket_items')
    .select('slot, preset, status, preview_id, replaced_from')
    .eq('basket_id', basket.id)
    .order('slot', { ascending: true })
  if (itemsErr) {
    return NextResponse.json({ error: 'basket_items_query_failed' }, { status: 500 })
  }

  const doneCount = (items ?? []).filter((i) => i.status === 'done').length

  return NextResponse.json({
    basketId:   basket.id,
    series:     basket.series,
    size:       basket.size,
    status:     basket.status, // 'pending' | 'generating' | 'ready' | 'failed'
    doneCount,
    freeUnlocks: basket.free_unlocks,
    items: (items ?? []).map((i) => ({
      slot:         i.slot,
      preset:       i.preset,
      status:       i.status, // 'pending' | 'rendering' | 'done' | 'failed' | 'replaced'
      // previewUrl intentionally omitted here — this route has no
      // visibility into how the app builds a servable watermarked URL
      // from preview_ledger.storage_path (fetchCleanOriginal in
      // preview.ts returns bytes, not a URL, and is for the CLEAN
      // original, not the watermarked derivative). Whoever wires this
      // needs to confirm whether a watermarked-derivative URL builder
      // already exists before this field can be filled in.
      previewId:    i.preview_id,
      replacedFrom: i.replaced_from,
    })),
  })
}
