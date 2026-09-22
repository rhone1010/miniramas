// app/api/v1/discovery/catalog/route.ts
// GET returns the 56-position catalog map. Query param ?series=portraits
// (only value supported today - others 400, not silently wrong data).
import { NextRequest, NextResponse } from 'next/server'
import { getPortraitsCatalogMap, getPortraitsSiloBoundaries } from '@/lib/store/discovery-catalog'

import pets from '@/lib/v1/pets/pets-discovery-data.json'

export async function GET(req: NextRequest) {
  const series = req.nextUrl.searchParams.get('series') || 'portraits'
  if (series === 'pets') {
    const map: Array<{mapIndex:number; seriesId:string; siloId:string; effectId:string}> = []
    const silos = pets.silos.map(silo => {
      const startIndex = map.length
      pets.effects.filter(effect => effect.category === silo.id).forEach(effect => {
        map.push({mapIndex:map.length,seriesId:'pets',siloId:silo.id,effectId:effect.id})
      })
      return {siloId:silo.id,label:silo.label,startIndex,endIndex:map.length-1}
    })
    return NextResponse.json({series,map,silos})
  }
  if (series !== 'portraits') {
    return NextResponse.json(
      { error: 'series_not_wired', message: `catalog map for '${series}' is not built yet` },
      { status: 400 },
    )
  }
  return NextResponse.json({ series, map: getPortraitsCatalogMap(), silos: getPortraitsSiloBoundaries() })
}
