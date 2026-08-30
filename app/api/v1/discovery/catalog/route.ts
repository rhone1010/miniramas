// app/api/v1/discovery/catalog/route.ts
// GET returns the 56-position catalog map. Query param ?series=portraits
// (only value supported today - others 400, not silently wrong data).
import { NextRequest, NextResponse } from 'next/server'
import { getPortraitsCatalogMap, getPortraitsSiloBoundaries } from '@/lib/store/discovery-catalog'

export async function GET(req: NextRequest) {
  const series = req.nextUrl.searchParams.get('series') || 'portraits'
  if (series !== 'portraits') {
    return NextResponse.json(
      { error: 'series_not_wired', message: `catalog map for '${series}' is not built yet` },
      { status: 400 },
    )
  }
  return NextResponse.json({ series, map: getPortraitsCatalogMap(), silos: getPortraitsSiloBoundaries() })
}
