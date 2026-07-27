// admin-bundles-route.ts
// app/api/admin/bundles/route.ts
//
// Admin: list all bundles (active + inactive), or create a new bundle.

import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin/auth'
import { listAllBundles, createBundle, validateBundleInput } from '@/lib/bundles/repo'
import type { BundleInput } from '@/lib/bundles/types'

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const bundles = await listAllBundles()
    return NextResponse.json({ bundles })
  } catch (e) {
    console.error('[api/admin/bundles] list failed', e)
    return NextResponse.json({ error: 'bundles_query_failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const errors = validateBundleInput(body)
  if (errors.length > 0) {
    return NextResponse.json({ error: 'validation_failed', errors }, { status: 400 })
  }

  try {
    const bundle = await createBundle(body as BundleInput)
    return NextResponse.json({ bundle }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[api/admin/bundles] create failed', msg)
    if (msg.includes('duplicate key') && msg.includes('slug')) {
      return NextResponse.json({ error: 'slug_already_exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'bundle_create_failed', message: msg }, { status: 500 })
  }
}
