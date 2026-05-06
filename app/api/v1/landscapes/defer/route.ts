// app/api/v1/landscapes/defer/route.ts
// Accepts a deferred render request and queues it for later processing.
//
// When /generate returns status="deferred", the UI shows the brand-voice capacity
// message and an email-capture form. UI then POSTs here with the original request
// body PLUS the customer's email and the job_id from /generate.
//
// This route's only job is to PERSIST the deferred work. A separate worker drains
// the queue when capacity returns and emails the customer with a library link.
//
// Storage / worker / email integration are infra outside Engine's scope. This file
// exposes the contract and a stub persistence call (replace `persistDeferredJob`
// with whatever queue/db the infra team wires up — Supabase row, SQS message, etc.).

import { NextRequest, NextResponse } from 'next/server'
import { GenerateRequest } from '@/lib/v1/landscapes/landscape-shared'

interface DeferRequest {
  job_id:   string
  email:    string
  request:  GenerateRequest   // the original generate body, replayed when capacity returns
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as DeferRequest

    // Minimal validation
    if (!body.job_id)              return jsonError('job_id required')
    if (!body.email)               return jsonError('email required')
    if (!isValidEmail(body.email)) return jsonError('email invalid')
    if (!body.request)             return jsonError('request body required')
    if (!body.request.source_image_b64) return jsonError('request.source_image_b64 required')
    if (!Array.isArray(body.request.renders) || !body.request.renders.length) {
      return jsonError('request.renders[] required')
    }

    await persistDeferredJob({
      jobId:     body.job_id,
      email:     body.email.trim().toLowerCase(),
      request:   body.request,
      submittedAt: new Date().toISOString(),
    })

    console.log(`[landscapes/defer] queued job ${body.job_id} for ${body.email}`)
    return NextResponse.json({
      status: 'queued',
      job_id: body.job_id,
    })

  } catch (err: any) {
    console.error('[landscapes/defer] fatal:', err.message)
    return NextResponse.json({
      status: 'error',
      error:  err.message,
    }, { status: 500 })
  }
}

// ── HELPERS ───────────────────────────────────────────────────
function jsonError(msg: string) {
  return NextResponse.json({ status: 'error', error: msg }, { status: 400 })
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

// ── PERSISTENCE STUB ──────────────────────────────────────────
// Replace this with the actual queue/db write when infra is wired up.
// Possible implementations:
//   - Supabase: insert into a `deferred_renders` table
//   - SQS / Cloud Tasks: enqueue a message
//   - Redis: LPUSH to a queue list
//
// The worker reads these jobs back, replays them against /generate when capacity
// is available, persists results to the customer's library, and triggers email.
async function persistDeferredJob(job: {
  jobId:       string
  email:       string
  request:     GenerateRequest
  submittedAt: string
}): Promise<void> {
  // TODO: replace with real persistence. For now, log so the request shape is
  // captured during integration testing.
  console.log('[landscapes/defer] persist:', JSON.stringify({
    jobId:       job.jobId,
    email:       job.email,
    submittedAt: job.submittedAt,
    renderCount: job.request.renders.length,
    aspectRatio: job.request.aspect_ratio,
    placeName:   job.request.display_name,
  }))
}
