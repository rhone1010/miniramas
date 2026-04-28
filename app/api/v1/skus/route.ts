// skus-route.ts
// app/api/v1/skus/route.ts
//
// Public — lists active SKUs for the /store page. No auth.

import { NextResponse } from 'next/server'
import { listActiveSkus } from '@/lib/store/skus'

export async function GET() {
  try {
    const skus = await listActiveSkus()
    return NextResponse.json({ skus })
  } catch (e) {
    console.error('[api/v1/skus] list failed', e)
    return NextResponse.json({ error: 'skus_query_failed' }, { status: 500 })
  }
}
