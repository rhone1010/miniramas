import { createHmac, randomUUID, timingSafeEqual } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { PREVIEW_BUCKET, storeCleanOriginal, lockedPreviewPath } from '@/lib/store/preview'

export const RESULT_CLAIM_SECONDS = 2 * 60 * 60
export const RESULT_COOKIE_PREFIX = 'liten_foyer_result_'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function signature(secret: string, payload: string) {
  return createHmac('sha256', secret).update('foyer-result:' + payload).digest('hex')
}
export function signResultClaim(secret: string, id: string, expires: number) {
  const payload = id + '.' + expires
  return payload + '.' + signature(secret, payload)
}
export function verifyResultClaim(secret: string, token: string, now = Date.now()): string | null {
  const parts = token.split('.')
  if (parts.length !== 3 || !UUID.test(parts[0]) || !/^\d+$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2])) return null
  const expiry = Number(parts[1])
  if (!Number.isSafeInteger(expiry) || expiry <= now) return null
  const want = Buffer.from(signature(secret, parts[0] + '.' + parts[1]), 'hex')
  if (!timingSafeEqual(want, Buffer.from(parts[2], 'hex'))) return null
  return parts[0]
}

// A row precedes uploads so a killed invocation leaves cleanup-visible work.
// No credentials, source bytes or clean path are returned to the browser.
export async function retainFoyerClean(sb: SupabaseClient, input: {
  series: 'portraits' | 'pets'; preset: string; clean: string; source: string;
  subject?: string | null; ageGroup?: string | null;
}) {
  const id = randomUUID(), previewId = randomUUID()
  const cleanPath = `${input.series}/${previewId}.png`
  const lockedPath = lockedPreviewPath(input.series, previewId)
  const expires = Date.now() + RESULT_CLAIM_SECONDS * 1000
  const original = sharp(Buffer.from(input.clean, 'base64'))
  const dimensions = await original.metadata()
  const { error } = await sb.from('foyer_result_claims').insert({
    id, preview_id: previewId, series: input.series, preset: input.preset,
    source_image: input.source, clean_path: cleanPath, locked_path: lockedPath,
    expires_at: new Date(expires).toISOString(),
    metadata: { subject: input.subject ?? null, age_group: input.ageGroup ?? null,
      aspect_ratio: '2:3', width: dimensions.width, height: dimensions.height,
      model: 'google/nano-banana-2', generated_at: new Date().toISOString() },
  })
  if (error) throw new Error('foyer_result_record_failed')
  const png = await original.png().toBuffer()
  if (!await storeCleanOriginal(sb, previewId, png.toString('base64'), input.series)) {
    throw new Error('foyer_result_storage_failed')
  }
  return { id, expires, lockedPath }
}

export async function finishFoyerClaim(sb: SupabaseClient,
  claim: { id: string; lockedPath: string }, watermarkedDataUrl: string) {
  const bytes = Buffer.from(watermarkedDataUrl.split(',')[1], 'base64')
  const { error: uploadError } = await sb.storage.from(PREVIEW_BUCKET)
    .upload(claim.lockedPath, bytes, { contentType: 'image/jpeg', upsert: false })
  if (uploadError) throw new Error('foyer_result_locked_storage_failed')
  const { data, error } = await sb.from('foyer_result_claims').update({ state: 'ready' })
    .eq('id', claim.id).eq('state', 'staging').select('id').single()
  if (error || !data) throw new Error('foyer_result_finalize_failed')
}

export async function cleanupFoyerResults(sb: SupabaseClient) {
  const { data, error } = await sb.rpc('claim_expired_foyer_results', { p_limit: 10 })
  if (error) throw new Error('foyer_cleanup_claim_failed')
  let removed = 0
  for (const row of data || []) {
    const { error: storageError } = await sb.storage.from(PREVIEW_BUCKET).remove([row.clean_path, row.locked_path])
    if (storageError) continue // Tombstone remains, next bounded sweep retries.
    const { error: deleteError } = await sb.from('foyer_result_claims').delete().eq('id', row.id).eq('state', 'deleting')
    if (!deleteError) removed++
  }
  return removed
}
