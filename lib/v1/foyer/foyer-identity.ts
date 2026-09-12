// lib/v1/foyer/foyer-identity.ts
//
// Who is asking, as far as a free anonymous reveal needs to know -- and the
// signed note that carries the photo intake's verdict to the reveal.
//
// The IP is never stored and never hashed bare: an unsalted sha256 of an IPv4
// address is reversed by trying all four billion of them. It is keyed with a
// server secret (HMAC-SHA256), so the stored value means nothing without it.

import { createHmac, createHash, timingSafeEqual } from 'crypto'

/* The one secret behind both the IP identity and the intake note. Absent,
   the allowance cannot be checked, and the foyer fails closed: no free
   reveal, and the visitor still walks into Discovery. */
export function foyerSecret(): string | null {
  const s = process.env.FOYER_HMAC_SECRET
  return s && s.length >= 32 ? s : null
}

/* The same headers, in the same order, as clientIpHash in lib/store/preview.ts. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  const ip  = (xff ? xff.split(',')[0] : null) || req.headers.get('x-real-ip') || 'unknown'
  return ip.trim()
}

export function ipIdentity(req: Request, secret: string): string {
  return createHmac('sha256', secret).update('foyer-ip:' + clientIp(req)).digest('hex')
}

/* The browser marker public/track.js already sets for every visitor:
   liten_anon, a uuid, one year. Supporting evidence only -- a visitor can
   clear it -- and only ever a well-formed uuid. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function deviceMarker(req: Request): string | null {
  const m = (req.headers.get('cookie') || '').match(/(?:^|;)\s*liten_anon\s*=\s*([^;]+)/)
  if (!m) return null
  let v = ''
  try { v = decodeURIComponent(m[1]).trim() } catch { return null }
  return UUID.test(v) ? v.toLowerCase() : null
}

export function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/* ── THE INTAKE NOTE ─────────────────────────────────────────────────────
   /foyer/intake examines the photograph (face, age, gender); /foyer/reveal
   renders it. The reveal must not trust a browser's word that the check was
   passed, and must not pay for the same vision call twice. So the intake
   signs what it saw, bound to the exact bytes it saw -- a different
   photograph, or the same one after its note has expired, is not covered. */
export interface IntakeVerdict {
  sha:      string                     // sha256 of the photograph's bytes
  subject:  'man' | 'woman' | null
  ageGroup: string | null
  exp:      number                     // ms since epoch
}

function b64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromB64url(s: string): string {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}
function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update('foyer-intake:' + payload).digest('hex')
}

export function signIntake(secret: string, v: IntakeVerdict): string {
  const payload = b64url(JSON.stringify(v))
  return payload + '.' + sign(secret, payload)
}

export function verifyIntake(
  secret: string, token: unknown, sha: string, now: number = Date.now(),
): IntakeVerdict | null {
  if (typeof token !== 'string') return null
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const payload = token.slice(0, dot), sig = token.slice(dot + 1)
  const want = Buffer.from(sign(secret, payload), 'hex')
  const got  = Buffer.from(sig, 'hex')
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  let v: IntakeVerdict
  try { v = JSON.parse(fromB64url(payload)) } catch { return null }
  if (!v || v.sha !== sha || typeof v.exp !== 'number' || v.exp < now) return null
  return v
}
