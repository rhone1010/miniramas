// lib/v1/gift/real.ts
//
// The production wiring of GiftDeps: thin adapters over services that already exist. Nothing here is a second
// generation or storage stack:
//   storage     the existing private `previews` bucket (lib/store/preview.ts PREVIEW_BUCKET), under the gift/ prefix
//   analyze     lib/shared/upload-routing.ts (series classifier) + the existing age checks (Portraits detectFaceVisibility,
//               Groups analyzeSourceSet / groupsAgeDecision), applied the way the Foyer intake and Groups analyze apply them
//   generate    the existing /api/v1/{portraits|pets|groups}/generate routes via the internal self-call that paid
//               portfolios use (lib/store/portfolio-render.ts): same NB2.1 prompts, gates and secrets, clean output only
//   watermark   lib/v1/foyer/foyer-watermark.ts bakeFoyerWatermark (fails closed)
// These make paid calls (OpenAI, NB2.1) and are exercised only in a real environment, never by the unit tests.

import sharp from 'sharp'
import { supabaseAdmin } from '@/lib/supabase'
import { PREVIEW_BUCKET, LOCKED_PREVIEW_QUALITY } from '@/lib/store/preview'
import { internalBaseUrl, internalHeaders } from '@/lib/store/internal-fetch'
import { styleIdForPreset } from '@/lib/store/portraits-style-lookup'
import { analyzeUploadRouting } from '@/lib/shared/upload-routing'
import { detectFaceVisibility } from '@/lib/v1/portraits/portraits-refine'
import { analyzeSourceSet } from '@/lib/v1/groups/groups-refine'
import { groupsAgeDecision, groupsAgeEvidence, MAX_SUBJECTS, MIN_SUBJECTS } from '@/lib/v1/groups/groups-shared'
import { bakeFoyerWatermark } from '@/lib/v1/foyer/foyer-watermark'
import { supabaseGiftStore } from './store'
import type { GiftDeps, GiftStorage, SourceAnalysis } from './service'

export function supabaseGiftStorage(db: any = supabaseAdmin): GiftStorage {
  const bucket = () => db.storage.from(PREVIEW_BUCKET)
  return {
    async put(path, body, contentType) { const { error } = await bucket().upload(path, body, { contentType, upsert: true }); if (error) throw new Error('storage_put_failed: ' + error.message) },
    async get(path) { const { data, error } = await bucket().download(path); return error || !data ? null : Buffer.from(await data.arrayBuffer()) },
    async remove(paths) { const { error } = await bucket().remove(paths); if (error) throw new Error('storage_remove_failed: ' + error.message) },
    async signedUrl(path, seconds) { const { data, error } = await bucket().createSignedUrl(path, seconds); return error || !data?.signedUrl ? null : data.signedUrl },
  }
}

/** Series from the existing subject classifier; the age policies are the ones the existing intakes apply. */
export async function analyzeSource({ b64 }: { b64: string; bytes: Buffer }): Promise<SourceAnalysis> {
  const routing = await analyzeUploadRouting(b64)
  if (!routing) throw new Error('classifier_unavailable')           // availability is a retry, never "unsupported"
  const openaiApiKey = process.env.OPENAI_API_KEY || ''
  switch (routing.classification.subjectType) {
    case 'pet_animal': return { status: 'supported', series: 'pets', peopleCount: null }
    case 'person_single': {
      try {
        const det = await detectFaceVisibility({ sourceImageB64: b64, openaiApiKey })
        if (det.age_group === 'child' || det.age_group === 'teen') return { status: 'age_restricted' }
      } catch (e) { console.error('[gift/analyze] age check FAILED OPEN, as the Foyer intake does:', e) }
      return { status: 'supported', series: 'portraits', peopleCount: null }
    }
    case 'person_group': {
      const set = await analyzeSourceSet({ primaryB64: b64, openaiApiKey })
      const faces = set.per_photo.flatMap(p => p.faces).map(groupsAgeEvidence)
      const complete = set.per_photo.length === 1 && faces.length >= set.total_subjects
      if (groupsAgeDecision(complete ? faces : [...faces, { age_class: 'unknown', age_confidence: 0 }]) === 'blocked') return { status: 'age_restricted' }
      const count = Math.min(MAX_SUBJECTS, set.total_subjects)
      return count >= MIN_SUBJECTS ? { status: 'supported', series: 'groups', peopleCount: count } : { status: 'unsupported' }
    }
    default: return { status: 'unsupported' }
  }
}

/** ONE render through the series' own generate route. Returns the CLEAN master; throws on any refusal or failure. */
export async function generateMaster(i: { series: 'portraits' | 'pets' | 'groups'; sourceB64: string; effectId: string; aspect: string; peopleCount: number | null }): Promise<{ imageB64: string }> {
  const body = i.series === 'groups'
    ? { source_image_b64: i.sourceB64, effect_id: i.effectId, format: i.aspect, ...(i.peopleCount ? { subject_count: i.peopleCount } : {}), }
    : i.series === 'pets'
      ? { source_image_b64: i.sourceB64, style_id: 'realistic', preset_id: i.effectId, action_id: 'as_photographed', aspect_ratio: i.aspect, scale: 'close_up' }
      : { source_image_b64: i.sourceB64, style_id: styleIdForPreset(i.effectId), preset_id: i.effectId, skip_redirect: true, framing: 'bust', scale: 'close_up' }
  const res = await fetch(`${internalBaseUrl()}/api/v1/${i.series}/generate`, {
    method: 'POST',
    headers: internalHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` }),
    body: JSON.stringify(body),
  })
  const out: any = await res.json().catch(() => ({}))
  if (res.status === 403 && out?.code === 'age_restricted') throw new Error('age_restricted')
  const ok = res.ok && out?.result?.ok && !!out?.result?.image_b64 && out?.status !== 'redirected' && out?.status !== 'intake_rejected'
  if (!ok) throw new Error(String(out?.error || out?.status || 'generate_failed').slice(0, 120))
  return { imageB64: out.result.image_b64 as string }
}

export async function watermarkPreview(masterB64: string): Promise<Buffer> {
  return sharp(Buffer.from(await bakeFoyerWatermark(masterB64), 'base64')).toColourspace('srgb')
    .jpeg({ quality: LOCKED_PREVIEW_QUALITY, progressive: true, mozjpeg: true }).toBuffer()
}

export function giftDeps(): GiftDeps {
  return { store: supabaseGiftStore(supabaseAdmin), storage: supabaseGiftStorage(), analyze: analyzeSource, generate: generateMaster, watermark: watermarkPreview }
}
