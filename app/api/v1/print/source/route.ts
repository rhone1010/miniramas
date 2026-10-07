import { NextResponse } from 'next/server'
import { getUser } from '@/lib/store/auth'
import { ownedPrintPreview, ownedPrintSource } from '@/lib/v1/print/owned-source'
import { canFulfil } from '@/lib/v1/print/db'
import { catalogFor } from '@/lib/v1/print/geometry'

export async function GET(req: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'sign_in_required' }, { status: 401 })
  const headers = { 'Cache-Control': 'private, no-store' }
  try {
    const query = new URL(req.url).searchParams
    const id = query.get('piece') || ''
    const fulfilment = await canFulfil(user.id)
    if (query.has('eligibility')) {
      if (!fulfilment) return NextResponse.json({ eligible: false }, { headers })
      await ownedPrintSource(user.id, id)
      return NextResponse.json({ eligible: true }, { headers })
    }
    const piece = await ownedPrintPreview(user.id, id)
    return NextResponse.json({ piece, catalog: catalogFor(piece.width, piece.height), fulfilment }, { headers })
  } catch {
    return NextResponse.json({ error: 'print_source_unavailable' }, { status: 409, headers })
  }
}
