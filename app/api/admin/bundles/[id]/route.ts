// admin-bundles-[id]-route.ts
// app/api/admin/bundles/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin/auth'
import {
  getBundleById,
  updateBundle,
  deleteBundle,
  validateBundleInput,
} from '@/lib/bundles/repo'
import type { BundleInput } from '@/lib/bundles/types'

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    const bundle = await getBundleById(id)
    if (!bundle) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ bundle })
  } catch (e) {
    console.error('[api/admin/bundles/[id]] get failed', e)
    return NextResponse.json({ error: 'bundle_query_failed' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params

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
    const existing = await getBundleById(id)
    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const bundle = await updateBundle(id, body as BundleInput)
    return NextResponse.json({ bundle })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[api/admin/bundles/[id]] update failed', msg)
    if (msg.includes('duplicate key') && msg.includes('slug')) {
      return NextResponse.json({ error: 'slug_already_exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'bundle_update_failed', message: msg }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await ctx.params
  try {
    await deleteBundle(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[api/admin/bundles/[id]] delete failed', e)
    return NextResponse.json({ error: 'bundle_delete_failed' }, { status: 500 })
  }
}
