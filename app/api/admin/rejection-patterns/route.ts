// admin-rejection-patterns-route.ts
// app/api/admin/rejection-patterns/route.ts
//
// Admin endpoint for reviewing moderation rejection patterns.
// Returns aggregated per-user rejection data sorted by category counts and
// recency. Use this to spot patterns and decide who to manually action.
//
// AUTHENTICATION:
// Locked behind ADMIN_API_KEY env var. Pass via header:
//   curl -H "x-admin-key: $ADMIN_API_KEY" /api/admin/rejection-patterns
// If ADMIN_API_KEY is not set, the endpoint returns 503 (do not silently allow).
//
// QUERY PARAMS (all optional):
//   ?minRejections=10       — only users with at least 10 rejections
//   ?hardOnly=true          — only users with at least one hard-category rejection
//   ?sortBy=hardRejections  — totalRejections | hardRejections | lastSeen | recent24h
//   ?limit=50               — cap results

import { NextRequest, NextResponse } from 'next/server'
import { getAllUserPatterns } from '@/lib/v1/rejection-log'

export async function GET(req: NextRequest) {
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) {
    return NextResponse.json({ error: 'admin_endpoint_disabled' }, { status: 503 })
  }

  const submitted = req.headers.get('x-admin-key')
  if (submitted !== adminKey) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url    = new URL(req.url)
  const params = url.searchParams
  const opts: any = {}
  if (params.has('minRejections')) opts.minRejections = parseInt(params.get('minRejections')!, 10) || 1
  if (params.get('hardOnly') === 'true') opts.hardOnly = true
  if (params.has('sortBy')) {
    const sb = params.get('sortBy')!
    if (['totalRejections', 'hardRejections', 'lastSeen', 'recent24h'].includes(sb)) {
      opts.sortBy = sb
    }
  }
  const limit = params.has('limit') ? parseInt(params.get('limit')!, 10) || 100 : 100

  const patterns = getAllUserPatterns(opts).slice(0, limit)

  return NextResponse.json({
    count:    patterns.length,
    patterns,
    queriedAt: new Date().toISOString(),
  })
}
