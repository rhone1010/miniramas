// store/resultToken.ts
// lib/store/resultToken.ts
//
// Stateless signed magic-link token for /result/[jobId].
//
// Format (base64url): version "." jobId "." expiresAtMs "." hmacHex
// Signature payload (the bit we HMAC) is just `${version}.${jobId}.${expiresAtMs}`.
// 30-day expiry. No DB lookup to validate — the secret is the only state.
//
// Pure functions: signResultToken(jobId) and verifyResultToken(token).

import crypto from 'crypto'

const TOKEN_VERSION   = 'v1'
const TOKEN_TTL_DAYS  = 30
const TOKEN_TTL_MS    = TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000

function getSecret(): Buffer {
  const secret = process.env.RESULT_TOKEN_SECRET
  if (!secret) throw new Error('RESULT_TOKEN_SECRET is not set')
  if (secret.length < 32) {
    throw new Error('RESULT_TOKEN_SECRET must be at least 32 chars')
  }
  return Buffer.from(secret, 'utf8')
}

function b64urlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function b64urlDecode(input: string): Buffer {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4)
  const std = padded.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(std, 'base64')
}

function hmac(payload: string): Buffer {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest()
}

export function signResultToken(jobId: string): string {
  const expiresAt = Date.now() + TOKEN_TTL_MS
  const payload   = `${TOKEN_VERSION}.${jobId}.${expiresAt}`
  const sig       = hmac(payload)
  return b64urlEncode(`${payload}.${sig.toString('hex')}`)
}

export function verifyResultToken(token: string): { jobId: string } | null {
  if (!token || typeof token !== 'string') return null

  let decoded: string
  try {
    decoded = b64urlDecode(token).toString('utf8')
  } catch {
    return null
  }

  const parts = decoded.split('.')
  if (parts.length !== 4) return null
  const [version, jobId, expiresAtStr, sigHex] = parts
  if (version !== TOKEN_VERSION) return null
  if (!jobId) return null

  const expiresAt = Number(expiresAtStr)
  if (!Number.isFinite(expiresAt)) return null
  if (Date.now() > expiresAt) return null

  const expected = hmac(`${version}.${jobId}.${expiresAtStr}`)
  let actual: Buffer
  try {
    actual = Buffer.from(sigHex, 'hex')
  } catch {
    return null
  }
  if (actual.length !== expected.length) return null
  if (!crypto.timingSafeEqual(actual, expected)) return null

  return { jobId }
}
