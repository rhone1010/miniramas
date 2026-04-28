// queue-route.ts
// app/api/v1/queue/route.ts
//
// POST: customer asks "email me when ready" — store the original POST body
// for the appropriate product and return a queue position estimate.

import { NextRequest, NextResponse } from 'next/server'
import { enqueueJob, countQueuedAhead } from '@/lib/queue/repo'
import { QUEUED_PRODUCTS } from '@/lib/queue/types'
import type { QueuedProduct } from '@/lib/queue/types'

const MAX_BODY_BYTES = 10 * 1024 * 1024 // 10 MB

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  let body: { email?: unknown; product?: unknown; requestBody?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email || !EMAIL_RE.test(email) || email.length > 320) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
  }

  const product = typeof body.product === 'string' ? body.product : ''
  if (!QUEUED_PRODUCTS.includes(product as QueuedProduct)) {
    return NextResponse.json({ error: 'invalid_product' }, { status: 400 })
  }

  if (!body.requestBody || typeof body.requestBody !== 'object' || Array.isArray(body.requestBody)) {
    return NextResponse.json({ error: 'invalid_request_body' }, { status: 400 })
  }

  // Cheap size guard. We don't strictly need the byte length but the body is
  // base64 image data that can be large; reject runaway payloads.
  const approxBytes = JSON.stringify(body.requestBody).length
  if (approxBytes > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'request_body_too_large' }, { status: 413 })
  }

  try {
    const job = await enqueueJob({
      email,
      product:     product as QueuedProduct,
      requestBody: body.requestBody as Record<string, unknown>,
    })
    const ahead = await countQueuedAhead(job.createdAt)
    return NextResponse.json(
      { queued: true, jobId: job.id, position: ahead + 1 },
      { status: 201 },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[api/v1/queue] enqueue failed', msg)
    return NextResponse.json({ error: 'enqueue_failed' }, { status: 500 })
  }
}
