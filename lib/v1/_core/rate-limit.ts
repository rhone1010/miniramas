// rate-limit.ts
// lib/v1/rate-limit.ts
//
// Graduated friction rate limiter. Slows down (rather than bans) users
// who hit many rejections in a short window. Designed to be:
//   - Invisible to normal users (a non-abusive user almost never triggers it)
//   - Friction-y but not punitive to mild abusers
//   - A signal to admin (via rejection-log) for manual action on real abusers
//
// Tiers:
//   <  5 rejections in last hour     → no delay
//   5-9 rejections in last hour      → 30 second delay before next analyze call
//   10-19 rejections in last hour    → 5 minute delay
//   20+ rejections in last hour      → flagged for manual review (delay 0,
//                                       but the admin endpoint surfaces them)
//
// We use the EXISTING rejection log to drive this — no separate counter needed.

import { getRecentRejectionsForUser } from './rejection-log'

export interface RateLimitDecision {
  delayMs: number     // how long the client should wait before the analyze call proceeds
  flagged: boolean    // if true, surface this user in the admin review queue
  tier:    'normal' | 'mild' | 'moderate' | 'flagged'
  message?: string    // optional human-readable message for the UI
}

export function checkRateLimit(userId: string): RateLimitDecision {
  const oneHour = 60 * 60 * 1000
  const recent  = getRecentRejectionsForUser(userId, oneHour)
  const count   = recent.length

  if (count < 5) {
    return { delayMs: 0, flagged: false, tier: 'normal' }
  }

  if (count < 10) {
    return {
      delayMs: 30_000,
      flagged: false,
      tier:    'mild',
      message: 'Several recent uploads couldn\'t be processed. Please wait a moment before trying again.',
    }
  }

  if (count < 20) {
    return {
      delayMs: 5 * 60_000,
      flagged: false,
      tier:    'moderate',
      message: 'Many recent uploads couldn\'t be processed. There\'s a short cooldown before the next attempt.',
    }
  }

  return {
    delayMs: 0,           // don't add UI delay at this tier — it's invisible to admin
    flagged: true,
    tier:    'flagged',
    message: 'Your account has been flagged for review.',
  }
}
