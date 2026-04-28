// admin/auth.ts
// lib/admin/auth.ts
//
// Single-password admin gate for the bundle catalog. Cookie holds an
// HMAC-signed timestamp; we verify the signature and reject anything older
// than 7 days. There's only one admin (the operator), so no user table.

import { cookies } from 'next/headers'
import crypto from 'crypto'

const COOKIE_NAME = 'minirama_admin'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7
const COOKIE_MAX_AGE_MS = COOKIE_MAX_AGE_SECONDS * 1000

function getSecret(): string {
  const secret = process.env.ADMIN_COOKIE_SECRET
  if (!secret) throw new Error('ADMIN_COOKIE_SECRET is not set')
  return secret
}

function getPassword(): string {
  const pw = process.env.ADMIN_PASSWORD
  if (!pw) throw new Error('ADMIN_PASSWORD is not set')
  return pw
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
}

function buildToken(timestampMs: number): string {
  const payload = String(timestampMs)
  return `${payload}:${sign(payload)}`
}

function verifyToken(token: string): boolean {
  const parts = token.split(':')
  if (parts.length !== 2) return false
  const [payload, signature] = parts
  const expected = sign(payload)
  if (expected.length !== signature.length) return false
  let sigOk = false
  try {
    sigOk = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
  if (!sigOk) return false
  const ts = Number(payload)
  if (!Number.isFinite(ts)) return false
  const age = Date.now() - ts
  if (age < 0 || age > COOKIE_MAX_AGE_MS) return false
  return true
}

export function checkPassword(submitted: string): boolean {
  const expected = getPassword()
  const a = Buffer.from(submitted)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  try {
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function setAdminCookie(): Promise<void> {
  const token = buildToken(Date.now())
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   COOKIE_MAX_AGE_SECONDS,
    path:     '/',
  })
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   0,
    path:     '/',
  })
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies()
  const cookie = store.get(COOKIE_NAME)
  if (!cookie?.value) return false
  return verifyToken(cookie.value)
}
