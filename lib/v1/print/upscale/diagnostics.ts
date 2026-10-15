// lib/v1/print/upscale/diagnostics.ts
//
// What the Preview readiness diagnostic (/api/v1/print/source?readiness=1) reports about the environment and the
// pipeline. READ-ONLY and SECRET-FREE: every credential appears only as present/absent, never as a value or a length.
// The pipeline answer is pipelineState() itself (pipeline.ts), not a second implementation.

import { getEnv, ProdigiLiveBlockedError } from '../prodigi-client'
import { pipelineState, type PipelineState } from './pipeline'

type Env = Record<string, string | undefined>

export interface PrintDiagnostics {
  vercelEnv: string | null
  pipeline: PipelineState | { error: string }
  prodigi: { configured: string; effective: 'sandbox' | 'live' | 'blocked_in_preview' | 'misconfigured'; endpointHost: string | null; problem?: string }
  stripe: { mode: 'test' | 'live' | 'unknown' }
  credentials: { replicateToken: boolean; openaiKey: boolean; prunaKey: boolean; cronSecret: boolean; supabaseServiceRole: boolean }
}

/** The effective Prodigi mode is whatever the real client would use, including the Preview guard. */
function prodigiReport(env: Env): PrintDiagnostics['prodigi'] {
  const configured = (env.PRODIGI_ENV || 'sandbox').toLowerCase()
  try {
    const e = getEnv()
    return { configured, effective: e.env as 'sandbox' | 'live', endpointHost: new URL(e.baseUrl).host }
  } catch (err) {
    if (err instanceof ProdigiLiveBlockedError) return { configured, effective: 'blocked_in_preview', endpointHost: null }
    return { configured, effective: 'misconfigured', endpointHost: null, problem: err instanceof Error ? err.message.replace(/\s+/g, ' ').slice(0, 120) : 'unknown' }
  }
}

const stripeMode = (key: string | undefined): 'test' | 'live' | 'unknown' =>
  /^(sk|rk)_test_/.test(key ?? '') ? 'test' : /^(sk|rk)_live_/.test(key ?? '') ? 'live' : 'unknown'

export async function printDiagnostics(env: Env = process.env): Promise<PrintDiagnostics> {
  let pipeline: PrintDiagnostics['pipeline']
  try { pipeline = await pipelineState() } catch (e) { pipeline = { error: e instanceof Error ? e.message.slice(0, 120) : 'pipeline_state_unavailable' } }
  return {
    vercelEnv: env.VERCEL_ENV || null,
    pipeline,
    prodigi: prodigiReport(env),
    stripe: { mode: stripeMode(env.STRIPE_SECRET_KEY) },
    credentials: {
      replicateToken: !!env.REPLICATE_API_TOKEN, openaiKey: !!env.OPENAI_API_KEY, prunaKey: !!env.PRUNA_API_KEY,
      cronSecret: !!env.CRON_SECRET, supabaseServiceRole: !!env.SUPABASE_SERVICE_ROLE_KEY,
    },
  }
}
