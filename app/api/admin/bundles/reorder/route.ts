// admin-bundles-reorder-route.ts
// app/api/admin/bundles/reorder/route.ts
//
// Batch update of display_order. Body: { order: [{ id, displayOrder }] }

import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin/auth'
import { reorderBundles } from '@/lib/bundles/repo'

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { order?: Array<{ id?: unknown; displayOrder?: unknown }> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!Array.isArray(body?.order)) {
    return NextResponse.json({ error: 'invalid_order' }, { status: 400 })
  }

  const order: { id: string; displayOrder: number }[] = []
  for (const e of body.order) {
    if (typeof e?.id !== 'string' || typeof e?.displayOrder !== 'number' || !Number.isInteger(e.displayOrder)) {
      return NextResponse.json({ error: 'invalid_order_entry' }, { status: 400 })
    }
    order.push({ id: e.id, displayOrder: e.displayOrder })
  }

  try {
    await reorderBundles(order)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/admin/bundles/reorder] failed', e)
    return NextResponse.json({ error: 'reorder_failed' }, { status: 500 })
  }
}
