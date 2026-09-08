// lib/store/portfolio-replace.ts
// Renamed from basket-replace.ts. Behavior CHANGED per
// LITEN_DISCOVERY_PRODUCT_SPEC.md section 13: retry the SAME effect ID
// on failure, do not substitute a different one. "maintain original
// effect ID... replacement output supersedes failed attempt."
//
// ASCII-only throughout. Verified before handoff.

export const MAX_RETRY_ATTEMPTS = 3

export interface RetryDecision {
  shouldRetry: boolean
  attemptNumber: number
}

export function decideRetry(currentAttempts: number): RetryDecision {
  const attemptNumber = currentAttempts + 1
  return {
    shouldRetry: attemptNumber <= MAX_RETRY_ATTEMPTS,
    attemptNumber,
  }
}
