// lib/v1/print/upscale/pipeline.ts
//
// The activation gate for the queued Print Shop pipeline.
//
//   PRINT_UPSCALE_PIPELINE_ENABLED   unset or anything but 'true' / '1'  =>  OFF (the default)
//
// ACTIVE = the flag is on AND the pipeline is demonstrably ready. If the flag is on but migration 046 is not
// applied, or a key it needs is missing, the pipeline is NOT active: it fails closed and says why. Turning the
// flag on early therefore cannot half-start the pipeline.
//
// WHAT "OFF" MEANS, honestly: the original synchronous fulfilment path was replaced by this pipeline and is not
// kept. Off does not mean "behave like before"; it means "do not start any new automated work": the webhook
// still verifies and records the payment and applies the account gate, then WITHHOLDS the order visibly (existing
// 'withheld' status and notices) instead of preparing artwork or calling Prodigi. Nothing is lost, and the order is
// picked up when the pipeline is activated (see complete.ts).
//
// The flag only decides whether new automated work starts. It cannot loosen any check: payment verification, the
// refund check, account clearance and the Prodigi Preview-live guard all run exactly as before, after this gate.

export const FLAG_NAME = 'PRINT_UPSCALE_PIPELINE_ENABLED'

export const isPipelineFlagOn = (env: Record<string, string | undefined> = process.env): boolean =>
  ['true', '1'].includes((env[FLAG_NAME] ?? '').trim().toLowerCase())

export type PipelineReason = 'disabled' | 'not_ready'
export interface PipelineState { flag: boolean; active: boolean; reason: PipelineReason | null; problems: string[] }

/** Thrown when something tries to start pipeline work while the pipeline is not active. */
export class PipelineInactiveError extends Error {
  constructor(public state: PipelineState) { super(`print_pipeline_inactive:${state.reason}${state.problems.length ? ':' + state.problems.join(',') : ''}`) }
}

export interface ProbeDb {
  from(table: string): { select(cols: string): any }
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>
}
export interface PipelineDeps { env?: Record<string, string | undefined>; db?: ProbeDb; now?: () => number }

const NIL = '00000000-0000-0000-0000-000000000000'
const CACHE_MS = 30_000
let cache: { at: number; key: string; state: PipelineState } | null = null
export const resetPipelineCache = () => { cache = null }

async function defaultDb(): Promise<ProbeDb> { return (await import('@/lib/supabase')).supabaseAdmin as unknown as ProbeDb }

/** Everything the pipeline needs before it may start. Reads only; creates and changes nothing. */
async function findProblems(env: Record<string, string | undefined>, db: ProbeDb): Promise<string[]> {
  const problems: string[] = []
  if ((env.VERCEL_ENV || '').toLowerCase() === 'preview' && (env.PRODIGI_ENV || '').toLowerCase() === 'live') problems.push('prodigi_live_blocked_in_preview')
  if (!env.CRON_SECRET) problems.push('missing_CRON_SECRET')
  if (!env.SUPABASE_SERVICE_ROLE_KEY) problems.push('missing_SUPABASE_SERVICE_ROLE_KEY')

  // Migration 046: the settings row, the jobs table, and the lease function (a probe with a nil id changes nothing).
  let provider = 'replicate', qa = true
  try {
    const g = await db.from('print_upscale_settings').select('provider,qa_enabled').eq('scope', 'global').maybeSingle()
    if (g.error || !g.data) problems.push('migration_046_not_applied:settings')
    else { provider = g.data.provider === 'pruna' ? 'pruna' : 'replicate'; qa = g.data.qa_enabled !== false }
    const j = await db.from('print_asset_jobs').select('id').limit(1)
    if (j.error) problems.push('migration_046_not_applied:jobs')
    const l = await db.rpc('lease_print_asset_job', { p_id: NIL, p_seconds: 1, p_token: NIL })
    if (l.error) problems.push('migration_046_not_applied:functions')
  } catch { problems.push('database_unreachable') }

  if (provider === 'pruna' ? !env.PRUNA_API_KEY : !env.REPLICATE_API_TOKEN) problems.push(provider === 'pruna' ? 'missing_PRUNA_API_KEY' : 'missing_REPLICATE_API_TOKEN')
  if (qa && !env.OPENAI_API_KEY) problems.push('missing_OPENAI_API_KEY')
  return problems
}

/**
 * The current gate. With the flag off it answers immediately and touches nothing: no database, no network.
 * With the flag on it checks readiness (cached for 30 s so a busy webhook does not probe every call).
 */
export async function pipelineState(deps: PipelineDeps = {}): Promise<PipelineState> {
  const env = deps.env ?? process.env
  if (!isPipelineFlagOn(env)) return { flag: false, active: false, reason: 'disabled', problems: [] }
  const now = (deps.now ?? Date.now)()
  const key = JSON.stringify([env.VERCEL_ENV, env.PRODIGI_ENV, !!env.CRON_SECRET, !!env.REPLICATE_API_TOKEN, !!env.PRUNA_API_KEY, !!env.OPENAI_API_KEY])
  if (!deps.db && cache && cache.key === key && now - cache.at < CACHE_MS) return cache.state
  const problems = await findProblems(env, deps.db ?? await defaultDb())
  const state: PipelineState = problems.length ? { flag: true, active: false, reason: 'not_ready', problems } : { flag: true, active: true, reason: null, problems: [] }
  if (!deps.db) cache = { at: now, key, state }
  return state
}

/** The order note that records why an order was held, and what source its pictures come from, so activation can resume it. */
export const pipelineHoldReason = (s: PipelineState, source: 'owned' | 'url') =>
  `print_pipeline_${s.reason}${s.problems.length ? ':' + s.problems.join(',') : ''};source=${source}`

export const isPipelineHold = (message: string | null | undefined) => (message ?? '').startsWith('print_pipeline_')
export const sourceOfHold = (message: string | null | undefined): 'owned' | 'url' => /;source=owned\b/.test(message ?? '') ? 'owned' : 'url'
