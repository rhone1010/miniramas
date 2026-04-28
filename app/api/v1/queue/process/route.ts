// queue-process-route.ts
// app/api/v1/queue/process/route.ts
//
// Cron handler. Vercel Cron sends GET with `Authorization: Bearer <CRON_SECRET>`.
// Each invocation claims up to 3 queued jobs and processes them sequentially:
//   - run the product pipeline directly (no HTTP self-call)
//   - upload the primary image to public storage
//   - send "ready" email + mark completed
// Overload errors → mark transient (re-queues up to MAX_ATTEMPTS).
// Other errors → mark permanent and send apology email.

import { NextRequest, NextResponse } from 'next/server'
import { runByProduct, extractPrimaryImageB64 } from '@/lib/v1/runners'
import {
  claimNextQueued,
  markCompleted,
  markFailedTransient,
  markFailedPermanent,
} from '@/lib/queue/repo'
import { uploadResultImage } from '@/lib/queue/result-storage'
import { sendCompletionEmail, sendApologyEmail } from '@/lib/email/resend'
import { classifyError } from '@/lib/v1/error-classification'
import type { QueuedJob } from '@/lib/queue/types'

const BATCH_SIZE = 3

// Vercel Cron has a 60s default timeout for hobby; the orchestration can
// take longer per job. Allow up to ~5min on pro. The actual generation calls
// already have their own timeouts inside the lib functions.
export const maxDuration = 300

interface ProcessResult {
  jobId:    string
  outcome:  'completed' | 'transient_failed' | 'permanent_failed' | 'no_image'
  attempts: number
  message?: string
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') || ''
  const expected = `Bearer ${secret}`
  if (header.length !== expected.length) return false
  // Constant-time-ish: comparison length already matches
  return header === expected
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let claimed: QueuedJob[]
  try {
    claimed = await claimNextQueued(BATCH_SIZE)
  } catch (e) {
    console.error('[queue/process] claim failed', e)
    return NextResponse.json({ error: 'claim_failed' }, { status: 500 })
  }

  if (claimed.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 })
  }

  const outcomes: ProcessResult[] = []
  for (const job of claimed) {
    outcomes.push(await processOne(job))
  }
  return NextResponse.json({ ok: true, processed: outcomes.length, outcomes })
}

async function processOne(job: QueuedJob): Promise<ProcessResult> {
  const attemptsBefore = job.attemptCount
  try {
    const result = await runByProduct(job.product, job.requestBody)
    const imageB64 = extractPrimaryImageB64(result)

    if (!imageB64) {
      // No single primary image (e.g. collectable_card). v1 doesn't support
      // multi-image queue replays — mark permanent and apologize.
      await markFailedPermanent(job.id, 'no_primary_image')
      try {
        await sendApologyEmail({
          to:           job.email,
          product:      job.product,
          errorContext: 'no_primary_image',
        })
      } catch (e) {
        console.error('[queue/process] apology email failed', (e as Error).message)
      }
      return { jobId: job.id, outcome: 'no_image', attempts: attemptsBefore + 1 }
    }

    const url = await uploadResultImage({ jobId: job.id, imageB64 })
    await markCompleted(job.id, url)
    try {
      await sendCompletionEmail({ to: job.email, product: job.product, resultUrl: url })
    } catch (e) {
      // Mark completed anyway — image is stored; email failure shouldn't
      // re-run the expensive generation. Log loudly.
      console.error('[queue/process] completion email failed', (e as Error).message)
    }
    return { jobId: job.id, outcome: 'completed', attempts: attemptsBefore + 1 }
  } catch (err) {
    const classified = classifyError(err)
    console.error('[queue/process] job failed', job.id, classified.category, classified.originalMessage)

    if (classified.category === 'upstream_overload') {
      const { permanent, attemptCount } = await markFailedTransient(job.id, classified.originalMessage)
      if (permanent) {
        try {
          await sendApologyEmail({
            to:           job.email,
            product:      job.product,
            errorContext: 'overload_max_attempts',
          })
        } catch (e) {
          console.error('[queue/process] apology email failed', (e as Error).message)
        }
        return { jobId: job.id, outcome: 'permanent_failed', attempts: attemptCount, message: 'overload_max_attempts' }
      }
      return { jobId: job.id, outcome: 'transient_failed', attempts: attemptCount }
    }

    // upstream_error or our_error — permanent fail
    await markFailedPermanent(job.id, classified.originalMessage)
    try {
      await sendApologyEmail({
        to:           job.email,
        product:      job.product,
        errorContext: classified.category,
      })
    } catch (e) {
      console.error('[queue/process] apology email failed', (e as Error).message)
    }
    return { jobId: job.id, outcome: 'permanent_failed', attempts: attemptsBefore + 1, message: classified.category }
  }
}
