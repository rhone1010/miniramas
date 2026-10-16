// GET /api/v1/print/catalog[?width=<px>&height=<px>]
//
// The canonical product catalog (lib/v1/print/catalog.ts): every verified SKU with its print requirements, status and
// retail price. READ-ONLY and public: no session, no Prodigi call, no database, no wholesale cost. With the artwork's
// pixel size it also reports how each product fits that artwork. A product is selectable only when it is enabled AND
// the artwork fits it. This route enables nothing: status and prices come from sku-map.ts and the disabled entries.

import { NextResponse } from 'next/server'
import { catalogResponse } from '@/lib/v1/print/catalog'

export const runtime = 'nodejs'

const dim = (v: string | null) => (v !== null && /^\d{1,6}$/.test(v) ? Number(v) : null)

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const width = dim(q.get('width')), height = dim(q.get('height'))
  if ((q.has('width') || q.has('height')) && (!width || !height)) {
    return NextResponse.json({ error: 'invalid_artwork_dimensions' }, { status: 400 })
  }
  return NextResponse.json(catalogResponse(width && height ? { width, height } : null), {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
  })
}
