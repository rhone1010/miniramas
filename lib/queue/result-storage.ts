// queue/result-storage.ts
// lib/queue/result-storage.ts
//
// Uploads a finished image (base64 jpg) to the public 'queue-results' bucket
// and returns the public URL. Object keys are deterministic per job so the
// worker can be retried safely.

import { supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'queue-results'

export async function uploadResultImage(input: {
  jobId:     string
  imageB64:  string
  extension?: 'jpg' | 'png'
}): Promise<string> {
  const ext = input.extension ?? 'jpg'
  const objectKey = `${input.jobId}.${ext}`
  const buffer = Buffer.from(input.imageB64, 'base64')

  const { error: uploadError } = await supabaseAdmin
    .storage
    .from(BUCKET)
    .upload(objectKey, buffer, {
      contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
      upsert:      true,
    })
  if (uploadError) {
    throw new Error(`storage_upload_failed: ${uploadError.message}`)
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(objectKey)
  return data.publicUrl
}
