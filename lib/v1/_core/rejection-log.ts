// rejection-log.ts
// lib/v1/rejection-log.ts
//
// In-memory pattern-tracking store for moderation rejections.
// Tracks WHO is being rejected for WHAT category, over time, so you can
// review patterns and manually action repeat offenders.
//
// IMPORTANT: We never store image content — only the moderation decision
// (category + image hash + timestamp + user identifier).
//
// Storage: in-memory Map. 30-day rolling retention (older entries pruned
// on each write). For production scale, swap this for Postgres / Redis,
// but the API surface stays the same.

import type { ModerationCategory, ModerationVerdict } from './moderation'

export interface RejectionRecord {
  userId:    string                  // IP for now; switch to auth user id when available
  category:  ModerationCategory
  verdict:   ModerationVerdict
  imageHash: string                  // sha256[0..16] — stable key, not the image
  reason:    string                  // human-readable
  ts:        number                  // unix ms
  route:     string                  // 'global' | 'actionmini' | 'landscape'
}

export interface UserPattern {
  userId:                string
  totalRejections:       number
  hardRejections:        number
  softRejections:        number
  byCategory:            Partial<Record<ModerationCategory, number>>
  firstSeen:             number
  lastSeen:              number
  recentRejectionsLastHour:  number
  recentRejectionsLast24h:   number
  uniqueImageHashes:     number      // helps distinguish "same bad image retried" from "many bad images"
}

const STORE: RejectionRecord[] = []
const MAX_RETENTION_MS = 30 * 24 * 60 * 60 * 1000  // 30 days

// ── PUBLIC API ──────────────────────────────────────────────

export function logRejection(rec: Omit<RejectionRecord, 'ts'> & { ts?: number }): void {
  const record: RejectionRecord = { ...rec, ts: rec.ts ?? Date.now() }
  STORE.push(record)
  pruneOld()
}

export function getRecentRejectionsForUser(userId: string, windowMs: number): RejectionRecord[] {
  const cutoff = Date.now() - windowMs
  return STORE.filter(r => r.userId === userId && r.ts >= cutoff)
}

export function getUserPattern(userId: string): UserPattern | null {
  const userRecords = STORE.filter(r => r.userId === userId)
  if (userRecords.length === 0) return null

  const now      = Date.now()
  const hourAgo  = now - (60 * 60 * 1000)
  const dayAgo   = now - (24 * 60 * 60 * 1000)

  const byCategory: Partial<Record<ModerationCategory, number>> = {}
  let hardCount = 0
  let softCount = 0
  for (const r of userRecords) {
    byCategory[r.category] = (byCategory[r.category] || 0) + 1
    if (r.verdict === 'hard') hardCount++
    else if (r.verdict === 'soft') softCount++
  }

  const uniqueHashes = new Set(userRecords.map(r => r.imageHash)).size
  const firstSeen    = Math.min(...userRecords.map(r => r.ts))
  const lastSeen     = Math.max(...userRecords.map(r => r.ts))
  const lastHour     = userRecords.filter(r => r.ts >= hourAgo).length
  const last24h      = userRecords.filter(r => r.ts >= dayAgo).length

  return {
    userId,
    totalRejections:           userRecords.length,
    hardRejections:            hardCount,
    softRejections:            softCount,
    byCategory,
    firstSeen,
    lastSeen,
    recentRejectionsLastHour:  lastHour,
    recentRejectionsLast24h:   last24h,
    uniqueImageHashes:         uniqueHashes,
  }
}

export function getAllUserPatterns(opts?: {
  minRejections?:  number       // only include users with at least N rejections
  hardOnly?:       boolean      // only include users with at least one hard rejection
  sortBy?:         'totalRejections' | 'hardRejections' | 'lastSeen' | 'recent24h'
}): UserPattern[] {
  const userIds = new Set(STORE.map(r => r.userId))
  const patterns: UserPattern[] = []
  for (const uid of userIds) {
    const p = getUserPattern(uid); if (!p) continue
    if (opts?.minRejections && p.totalRejections < opts.minRejections) continue
    if (opts?.hardOnly && p.hardRejections === 0) continue
    patterns.push(p)
  }

  const sortKey = opts?.sortBy || 'totalRejections'
  patterns.sort((a, b) => {
    if (sortKey === 'lastSeen')   return b.lastSeen - a.lastSeen
    if (sortKey === 'hardRejections') return b.hardRejections - a.hardRejections
    if (sortKey === 'recent24h')  return b.recentRejectionsLast24h - a.recentRejectionsLast24h
    return b.totalRejections - a.totalRejections
  })

  return patterns
}

// ── INTERNAL ────────────────────────────────────────────────

function pruneOld(): void {
  const cutoff = Date.now() - MAX_RETENTION_MS
  // Mutate in place — find first index >= cutoff, splice from start
  let firstKeep = 0
  while (firstKeep < STORE.length && STORE[firstKeep].ts < cutoff) firstKeep++
  if (firstKeep > 0) STORE.splice(0, firstKeep)
}

// Helper: derive a stable user id from a Next.js request.
// Uses x-forwarded-for (deployment proxy) → x-real-ip → fallback to a header hash.
// When you add real auth, replace this with the user's auth id.
export function deriveUserId(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return 'ip:' + fwd.split(',')[0].trim()
  const real = req.headers.get('x-real-ip')
  if (real) return 'ip:' + real.trim()
  // Fallback — can't identify user, use a session cookie or similar
  return 'anon'
}
