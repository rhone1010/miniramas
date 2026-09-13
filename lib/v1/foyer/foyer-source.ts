// lib/v1/foyer/foyer-source.ts
//
// The photograph as the foyer receives it, and the database it is rationed
// against.

import sharp from 'sharp'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { MAX_SOURCE_B64 } from './foyer-policy'

/* Raw base64 (no data: prefix) of a JPEG, PNG or WebP the browser has
   already fitted to the wire. Anything else is refused before any paid or
   vision call sees it. */
export async function decodeSource(
  b64: unknown,
): Promise<{ b64: string; bytes: Buffer } | { error: string }> {
  if (typeof b64 !== 'string' || !b64) return { error: 'image_b64_required' }
  if (b64.length > MAX_SOURCE_B64) return { error: 'image_too_large' }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { error: 'image_not_base64' }
  const bytes = Buffer.from(b64, 'base64')
  try {
    const md = await sharp(bytes).metadata()
    if (!md.width || !md.height || !['jpeg', 'png', 'webp'].includes(md.format || '')) {
      return { error: 'image_unreadable' }
    }
  } catch {
    return { error: 'image_unreadable' }
  }
  return { b64, bytes }
}

/* Service role, as every other server-only table here. */
export function foyerDb(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}
