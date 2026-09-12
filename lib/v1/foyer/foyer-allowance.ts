// lib/v1/foyer/foyer-allowance.ts
//
// The foyer's anonymous allowance, over the functions in
// supabase/migrations/032_foyer_reveals.sql. Every answer the database cannot
// give is 'unavailable', and the callers fail closed on it: no free render,
// but never a dead end.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  REVEALS_PER_WINDOW, REVEAL_WINDOW, CLAIM_TTL, INTAKES_PER_WINDOW, INTAKE_WINDOW,
} from './foyer-policy'

export type RevealClaim =
  | { kind: 'claimed'; id: string }
  | { kind: 'exhausted' }
  | { kind: 'unavailable'; reason: string }

export async function claimReveal(
  sb: SupabaseClient, ip: string, device: string | null,
): Promise<RevealClaim> {
  const { data, error } = await sb.rpc('claim_foyer_reveal', {
    p_ip: ip, p_device: device, p_limit: REVEALS_PER_WINDOW,
    p_window: REVEAL_WINDOW, p_claim_ttl: CLAIM_TTL,
  })
  if (error) return { kind: 'unavailable', reason: error.message }
  if (typeof data === 'string' && data) return { kind: 'claimed', id: data }
  if (data === null) return { kind: 'exhausted' }
  return { kind: 'unavailable', reason: 'unexpected claim result' }
}

/* succeeded: the reveal counts. Otherwise it is deleted -- a failed render,
   a timeout, anything that put no image in front of the visitor. */
export async function finalizeReveal(
  sb: SupabaseClient, id: string, succeeded: boolean,
): Promise<boolean> {
  const { data, error } = await sb.rpc('finalize_foyer_reveal', { p_id: id, p_succeeded: succeeded })
  if (error) {
    console.error(`[foyer/allowance] finalize ${id} (${succeeded ? 'succeeded' : 'released'}) failed: ${error.message}`)
    return false
  }
  return data === true
}

/* Read-only, for the page to decide before a photograph is chosen. Not a
   promise: /foyer/reveal claims for itself. null = could not be checked. */
export async function revealAvailable(
  sb: SupabaseClient, ip: string, device: string | null,
): Promise<boolean | null> {
  const { data, error } = await sb.rpc('foyer_reveal_count', {
    p_ip: ip, p_device: device, p_window: REVEAL_WINDOW, p_claim_ttl: CLAIM_TTL,
  })
  if (error || typeof data !== 'number') return null
  return data < REVEALS_PER_WINDOW
}

export type IntakeClaim = 'ok' | 'capped' | 'unavailable'

export async function claimIntake(
  sb: SupabaseClient, ip: string, device: string | null,
): Promise<IntakeClaim> {
  const { data, error } = await sb.rpc('claim_foyer_intake', {
    p_ip: ip, p_device: device, p_limit: INTAKES_PER_WINDOW, p_window: INTAKE_WINDOW,
  })
  if (error) {
    console.error(`[foyer/allowance] intake claim failed: ${error.message}`)
    return 'unavailable'
  }
  return data === true ? 'ok' : data === false ? 'capped' : 'unavailable'
}
