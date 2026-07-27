// v1-bundles-route.ts
// app/api/v1/bundles/route.ts
//
// Public read endpoint for the customer Groups page. Returns active
// bundles ordered by display_order, each with their items in position
// order.

import { NextResponse } from 'next/server'
import { listActiveBundles } from '@/lib/bundles/repo'

export async function GET() {
  try {
    const bundles = await listActiveBundles()
    return NextResponse.json({ bundles })
  } catch (e) {
    console.error('[api/v1/bundles] list failed', e)
    return NextResponse.json({ error: 'bundles_query_failed' }, { status: 500 })
  }
}
