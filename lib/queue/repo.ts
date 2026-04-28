// queue/repo.ts
// lib/queue/repo.ts
//
// Supabase access layer for queued_jobs. The cron worker calls
// claimNextQueued() to atomically transition rows from 'queued' to
// 'processing' so concurrent runs don't pick up the same row.

import { supabaseAdmin } from '@/lib/supabase'
import type { QueuedJob, QueuedJobStatus, QueuedProduct } from './types'

const MAX_ATTEMPTS = 5

interface QueuedJobRow {
  id:            string
  email:         string
  product:       string
  request_body:  unknown
  status:        QueuedJobStatus
  attempt_count: number
  result_url:    string | null
  error_message: string | null
  created_at:    string
  started_at:    string | null
  completed_at:  string | null
}

function rowToJob(row: QueuedJobRow): QueuedJob {
  return {
    id:           row.id,
    email:        row.email,
    product:      row.product as QueuedProduct,
    requestBody:  (row.request_body ?? {}) as Record<string, unknown>,
    status:       row.status,
    attemptCount: row.attempt_count,
    resultUrl:    row.result_url,
    errorMessage: row.error_message,
    createdAt:    row.created_at,
    startedAt:    row.started_at,
    completedAt:  row.completed_at,
  }
}

export async function enqueueJob(input: {
  email:       string
  product:     QueuedProduct
  requestBody: Record<string, unknown>
}): Promise<QueuedJob> {
  const { data, error } = await supabaseAdmin
    .from('queued_jobs')
    .insert({
      email:        input.email,
      product:      input.product,
      request_body: input.requestBody,
    })
    .select()
    .single()
  if (error) throw new Error(`queue_insert_failed: ${error.message}`)
  return rowToJob(data as QueuedJobRow)
}

export async function countQueuedAhead(beforeIso: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('queued_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .lt('created_at', beforeIso)
  if (error) throw new Error(`queue_count_failed: ${error.message}`)
  return count ?? 0
}

// Atomically claim up to `limit` queued rows by transitioning them to
// 'processing' and stamping started_at. We do this in two steps:
//   1) read the IDs of the oldest queued rows
//   2) update those IDs WHERE status = 'queued' (so a concurrent claimer
//      that already moved them won't double-process)
// The .select() after update returns the rows we actually transitioned.
export async function claimNextQueued(limit = 3): Promise<QueuedJob[]> {
  const { data: candidates, error: readErr } = await supabaseAdmin
    .from('queued_jobs')
    .select('id')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(limit)
  if (readErr) throw new Error(`queue_read_failed: ${readErr.message}`)
  if (!candidates || candidates.length === 0) return []

  const ids = candidates.map((c) => c.id as string)
  const nowIso = new Date().toISOString()

  const { data: claimed, error: updErr } = await supabaseAdmin
    .from('queued_jobs')
    .update({ status: 'processing', started_at: nowIso })
    .in('id', ids)
    .eq('status', 'queued')
    .select()
  if (updErr) throw new Error(`queue_claim_failed: ${updErr.message}`)
  return ((claimed ?? []) as QueuedJobRow[]).map(rowToJob)
}

export async function markCompleted(id: string, resultUrl: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('queued_jobs')
    .update({
      status:       'completed',
      result_url:   resultUrl,
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq('id', id)
  if (error) throw new Error(`queue_complete_failed: ${error.message}`)
}

// Transient failure: bump attempt_count, return to 'queued' for the next
// cron tick — but if we've exceeded MAX_ATTEMPTS, mark permanently failed.
export async function markFailedTransient(id: string, errorMessage: string): Promise<{ permanent: boolean; attemptCount: number }> {
  const { data: current, error: readErr } = await supabaseAdmin
    .from('queued_jobs')
    .select('attempt_count')
    .eq('id', id)
    .single()
  if (readErr) throw new Error(`queue_read_failed: ${readErr.message}`)

  const nextAttempt = (current.attempt_count ?? 0) + 1

  if (nextAttempt >= MAX_ATTEMPTS) {
    const { error } = await supabaseAdmin
      .from('queued_jobs')
      .update({
        status:        'failed',
        attempt_count: nextAttempt,
        error_message: errorMessage,
        completed_at:  new Date().toISOString(),
      })
      .eq('id', id)
    if (error) throw new Error(`queue_fail_failed: ${error.message}`)
    return { permanent: true, attemptCount: nextAttempt }
  }

  const { error } = await supabaseAdmin
    .from('queued_jobs')
    .update({
      status:        'queued',
      attempt_count: nextAttempt,
      error_message: errorMessage,
      started_at:    null,
    })
    .eq('id', id)
  if (error) throw new Error(`queue_requeue_failed: ${error.message}`)
  return { permanent: false, attemptCount: nextAttempt }
}

export async function markFailedPermanent(id: string, errorMessage: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('queued_jobs')
    .update({
      status:        'failed',
      error_message: errorMessage,
      completed_at:  new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(`queue_fail_failed: ${error.message}`)
}

export async function getRecentByEmail(email: string, limit = 10): Promise<QueuedJob[]> {
  const { data, error } = await supabaseAdmin
    .from('queued_jobs')
    .select('*')
    .eq('email', email)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(`queue_query_failed: ${error.message}`)
  return ((data ?? []) as QueuedJobRow[]).map(rowToJob)
}
