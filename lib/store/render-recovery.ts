// lib/store/render-recovery.ts
//
// BOUNDED AUTOMATIC RECOVERY of a Discovery render that failed for a transient reason (migration 053). The rules live in the database function
// claim_render_recovery, which enforces them in ONE transaction; this file supplies the numbers, finds candidates, asks, and explains.
//
//   one extra cycle      an item that already used its attempts and became 'failed' gets ONE more cycle (attempts reset to 0), never a second
//   two-hour backoff     measured from the failure time recorded when the item failed (failed_at); a failure with no recorded time is never recovered,
//                        so nothing that failed before this shipped is touched
//   who               paid purchase, portfolio 'generating' or 'ready', not refunded (the purchase must still be 'paid'), no preview_id
//   what              only transient errors (the allow-list below); age_restricted, unknown_*_effect and every error not on the list are permanent
//   spend             each recovery reserves its WORST-CASE cost (every attempt of the cycle) in render_recovery_ledger first; the UTC day may not pass $5
//   off by default    RENDER_RECOVERY_ENABLED=1 turns the sweep on; RENDER_RECOVERY_COST_USD (cost of one render) must be set or nothing is claimed

import { MAX_RETRY_ATTEMPTS } from '@/lib/store/portfolio-replace'

export const RECOVERY = {
  backoffSeconds: 2 * 60 * 60,
  maxRecoveries: 1,
  dailyCeilingUsd: 5,
  /** Errors a repeat could plausibly fix. Exactly the reasons portfolio-render.ts records for a failure that is not the customer's or the catalog's. */
  transient: ['generate_failed', 'locked_preview_failed', 'locked_preview_upload_failed', 'ledger_write_failed', 'unhandled_error'] as const,
  /** Messages from the network or the provider that mean "try later". Case-insensitive; the same pattern is passed to the database. */
  transientPattern: 'timeout|timed out|rate.?limit|too many requests|overloaded|temporar|ECONN|ETIMEDOUT|fetch failed|\\m(429|502|503|504)\\M',
} as const

export const recoveryEnabled = (env: Record<string, string | undefined> = process.env) => env.RENDER_RECOVERY_ENABLED === '1'

/** Worst-case cost of one cycle: the first render and every retry. null when the cost of a render is not configured (nothing is claimed). */
export function cycleCostUsd(env: Record<string, string | undefined> = process.env): number | null {
  const one = Number(env.RENDER_RECOVERY_COST_USD)
  return Number.isFinite(one) && one > 0 ? Math.round(one * (MAX_RETRY_ATTEMPTS + 1) * 1e4) / 1e4 : null
}
/** $5 a day. The environment may only lower it. */
export function dailyCeilingUsd(env: Record<string, string | undefined> = process.env): number {
  const lower = Number(env.RENDER_RECOVERY_DAILY_CEILING_USD)
  return Number.isFinite(lower) && lower > 0 ? Math.min(RECOVERY.dailyCeilingUsd, lower) : RECOVERY.dailyCeilingUsd
}

const PATTERN = new RegExp(RECOVERY.transientPattern.replace(/\\m/g, '\\b').replace(/\\M/g, '\\b'), 'i')
export function isTransientError(error: string | null | undefined): boolean {
  if (!error) return false
  return (RECOVERY.transient as readonly string[]).includes(error) || PATTERN.test(error)
}

type Db = any
export interface Claim { claimed: boolean; reason: string }

/** Ask the database to claim one recovery. Never throws for a refusal: the reason says why. */
export async function claimRecovery(db: Db, itemId: string, env: Record<string, string | undefined> = process.env): Promise<Claim> {
  const cost = cycleCostUsd(env)
  if (cost === null) return { claimed: false, reason: 'accounting_not_configured' }
  const { data, error } = await db.rpc('claim_render_recovery', {
    p_item: itemId, p_cost_usd: cost, p_daily_cap_usd: dailyCeilingUsd(env), p_backoff_seconds: RECOVERY.backoffSeconds, p_max_recoveries: RECOVERY.maxRecoveries,
    p_transient: [...RECOVERY.transient], p_transient_pattern: RECOVERY.transientPattern,
  })
  if (error) return { claimed: false, reason: 'rpc_failed: ' + String(error.message ?? error) }
  const row = Array.isArray(data) ? data[0] : data
  return { claimed: row?.claimed === true, reason: String(row?.reason ?? 'no_answer') }
}

export interface SweepSummary { enabled: boolean; candidates: number; claimed: number; refused: Record<string, number>; stoppedAt?: string }

/**
 * The cron sweep: find terminal failures that are old enough and have no artwork, ask the database to claim each (it re-checks everything, atomically), up to `limit`
 * claims per tick. Claimed items are 'pending' in a 'generating' portfolio, so the poller's ordinary scan renders them in the same tick or the next.
 * Stops at the first daily-ceiling refusal: every later claim would be refused for the same reason.
 */
export async function recoverFailedRenders(db: Db, opts: { limit?: number; env?: Record<string, string | undefined>; now?: number } = {}): Promise<SweepSummary> {
  const env = opts.env ?? process.env, limit = opts.limit ?? 2
  const summary: SweepSummary = { enabled: recoveryEnabled(env), candidates: 0, claimed: 0, refused: {} }
  if (!summary.enabled) return summary
  const cutoff = new Date((opts.now ?? Date.now()) - RECOVERY.backoffSeconds * 1000).toISOString()
  const { data, error } = await db.from('portfolio_items').select('id')
    .eq('status', 'failed').is('preview_id', null).lt('recovery_count', RECOVERY.maxRecoveries).lt('failed_at', cutoff).order('failed_at', { ascending: true }).limit(limit * 5)
  if (error) { summary.refused['query_failed'] = 1; return summary }
  for (const row of data ?? []) {
    summary.candidates++
    if (summary.claimed >= limit) break
    const c = await claimRecovery(db, row.id, env)
    if (c.claimed) { summary.claimed++; continue }
    summary.refused[c.reason] = (summary.refused[c.reason] ?? 0) + 1
    if (c.reason === 'daily_ceiling' || c.reason === 'accounting_not_configured' || c.reason.startsWith('rpc_failed')) { summary.stoppedAt = c.reason; break }
  }
  return summary
}

/**
 * What a customer may be told about a piece, from its own state (no database column beyond the two this migration adds, and tolerant of their absence):
 *   'scheduled'    failed, transient, no artwork, never recovered, recovery on: one automatic try is coming
 *   'in_progress'  the automatic try is under way (the item is queued or rendering and has used its recovery)
 *   null           nothing automatic is coming (permanent failure, recovery used up, recovery off): the page says so and points to support
 */
export type RecoveryState = 'scheduled' | 'in_progress' | null
export function recoveryStateFor(item: { status: string; error?: string | null; preview_id?: string | null; recovery_count?: number | null; failed_at?: string | null }, portfolioStatus: string, env: Record<string, string | undefined> = process.env): RecoveryState {
  const used = item.recovery_count ?? 0
  if ((item.status === 'pending' || item.status === 'rendering') && used >= 1) return 'in_progress'
  if (item.status !== 'failed' || !recoveryEnabled(env) || cycleCostUsd(env) === null) return null
  if (item.preview_id || used >= RECOVERY.maxRecoveries || !item.failed_at || !isTransientError(item.error) || !['generating', 'ready'].includes(portfolioStatus)) return null
  return 'scheduled'
}

/**
 * READ-ONLY: what the database would answer for this item right now, in the database's own order (it is the authority; this is for the operator's dry run).
 * Returns 'eligible' or the refusal reason. Writes nothing and reserves nothing.
 */
export async function explainRecovery(db: Db, itemId: string, env: Record<string, string | undefined> = process.env, now = Date.now()): Promise<string> {
  if (cycleCostUsd(env) === null) return 'accounting_not_configured'
  const { data: i, error } = await db.from('portfolio_items').select('id, portfolio_id, status, error, preview_id, recovery_count, failed_at').eq('id', itemId).maybeSingle()
  if (error) return 'read_failed: ' + String(error.message ?? error)
  if (!i) return 'item_not_found'
  if (i.status !== 'failed') return 'not_failed'
  if (i.preview_id) return 'has_artwork'
  if ((i.recovery_count ?? 0) >= RECOVERY.maxRecoveries) return 'already_recovered'
  if (!i.failed_at) return 'no_failure_time'
  if (Date.parse(i.failed_at) > now - RECOVERY.backoffSeconds * 1000) return 'backoff'
  const { data: p } = await db.from('portfolios').select('id, status, purchase_id').eq('id', i.portfolio_id).maybeSingle()
  if (!p || !['generating', 'ready'].includes(p.status)) return 'portfolio_not_active'
  const { data: pu } = p.purchase_id ? await db.from('purchases').select('status').eq('id', p.purchase_id).maybeSingle() : { data: null }
  if (!p.purchase_id || pu?.status !== 'paid') return 'not_paid'
  if (!isTransientError(i.error)) return 'permanent_error'
  return 'eligible'
}
