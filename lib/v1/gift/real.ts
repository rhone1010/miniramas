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
import { composeWithPrintShop } from './compose'
import { realMockupRenderer } from './mockup-real'
import { GROUPS_FAVORITE_REFERENCE_ENABLED } from './aspects'
import type { GiftOrderDeps } from './orders'
import type { ConciergePort } from './refund'
import type { CollectionPort, GiftDeps, GiftStorage, SourceAnalysis } from './service'
import type { Series } from './types'

export function supabaseGiftStorage(db: any = supabaseAdmin): GiftStorage {
  const bucket = () => db.storage.from(PREVIEW_BUCKET)
  return {
    async put(path, body, contentType) { const { error } = await bucket().upload(path, body, { contentType, upsert: true }); if (error) throw new Error('storage_put_failed: ' + error.message) },
    async get(path) { const { data, error } = await bucket().download(path); return error || !data ? null : Buffer.from(await data.arrayBuffer()) },
    async remove(paths) { const { error } = await bucket().remove(paths); if (error) throw new Error('storage_remove_failed: ' + error.message) },
    async signedUrl(path, seconds) { const { data, error } = await bucket().createSignedUrl(path, seconds); return error || !data?.signedUrl ? null : data.signedUrl },
    async list(dirPrefix) { const dir = dirPrefix.replace(/\/+$/, ''); const { data, error } = await bucket().list(dir, { limit: 200 }); if (error) throw new Error('storage_list_failed: ' + error.message); return (data ?? []).filter((o: { id?: string | null }) => o.id).map((o: { name: string }) => dir + '/' + o.name) },
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

export interface GenerateInput { series: 'portraits' | 'pets' | 'groups'; sourceB64: string; effectId: string; aspect: string; peopleCount: number | null; productComposition?: boolean; referenceB64?: string }

/** The request body for the series' generate route. Pure, so tests pin exactly what is sent. */
export function generateBody(i: GenerateInput, groupsReference: boolean = GROUPS_FAVORITE_REFERENCE_ENABLED): Record<string, unknown> {
  // The approved artwork rides as the SECOND image. Groups send it through their own internal field, and only when enabled (aspects.ts).
  const ref = i.referenceB64 && i.series !== 'groups' ? { additional_images_b64: [i.referenceB64], adaptation: 'favorite' as const } : {}
  return i.series === 'groups'
    ? { source_image_b64: i.sourceB64, effect_id: i.effectId, format: i.aspect, ...(i.peopleCount ? { subject_count: i.peopleCount } : {}),
        ...(groupsReference && i.productComposition ? { product_composition: true } : {}),
        ...(groupsReference && i.referenceB64 ? { favorite_reference_b64: i.referenceB64, adaptation: 'favorite' as const } : {}) }
    : i.series === 'pets'
      ? { source_image_b64: i.sourceB64, style_id: 'realistic', preset_id: i.effectId, action_id: 'as_photographed', aspect_ratio: i.aspect, scale: 'close_up', ...ref }
      : { source_image_b64: i.sourceB64, style_id: styleIdForPreset(i.effectId), preset_id: i.effectId, skip_redirect: true, framing: 'bust', scale: 'close_up',
          // Preview batches send none of this and keep the framing-derived square. A product composition names its ratio (the route
          // admits the extra ratios only from this internal call).
          ...(i.productComposition ? { output_aspect_ratio: i.aspect, product_composition: true } : {}), ...ref }
}

/**
 * Why a series route said no, as one short string for the preview row (server-side: a preview's error is never shown to a customer). The three series routes all return the
 * generator's result with a fatal_error and an error_code on failure (e.g. nb2_failed when Replicate refused or timed out); this used to be thrown away, so every failed
 * preview just said generate_failed. Format: <route error or status>[:http_<n>][:<error_code>] (or the generator's own text when it gave no code).
 */
export function failureReason(out: any, httpStatus: number): string {
  const r = out?.result
  const code = typeof r?.error_code === 'string' && /^[\w.-]{1,60}$/.test(r.error_code) ? r.error_code : null
  const fatal = typeof r?.fatal_error === 'string' && r.fatal_error.trim() ? r.fatal_error.trim().replace(/\s+/g, ' ') : null
  const base = String(out?.error || out?.status || 'generate_failed')
  return [base, httpStatus >= 400 ? 'http_' + httpStatus : null, code, fatal ? fatal.slice(0, 80) : null].filter(Boolean).join(':').slice(0, 200)
}

/** ONE render through the series' own generate route. Returns the CLEAN master; throws on any refusal or failure. */
export async function generateMaster(i: GenerateInput): Promise<{ imageB64: string }> {
  return generateVia(i, (url, init) => fetch(url, init))
}
/**
 * The same call, made by invoking the series' route handler in this process instead of over HTTP. For the operator repair script only: it runs outside the app, where there is no
 * server to call (a localhost APP_URL answers "fetch failed"). Same route, same body, same bearer check, so the generation is identical and billed once.
 */
export async function generateMasterInProcess(i: GenerateInput): Promise<{ imageB64: string }> {
  const { NextRequest } = await import('next/server')
  const handlers: Record<string, () => Promise<{ POST: (r: any) => Promise<Response> }>> = {
    groups: () => import('@/app/api/v1/groups/generate/route'), pets: () => import('@/app/api/v1/pets/generate/route'), portraits: () => import('@/app/api/v1/portraits/generate/route'),
  }
  const load = handlers[i.series]; if (!load) throw new Error('generation_unavailable')
  const { POST } = await load()
  return generateVia(i, (url, init) => POST(new NextRequest(url, init as any)))
}
async function generateVia(i: GenerateInput, send: (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<Response>): Promise<{ imageB64: string }> {
  const body = generateBody(i)
  const res = await send(`${internalBaseUrl()}/api/v1/${i.series}/generate`, {
    method: 'POST',
    headers: internalHeaders({ 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` }),
    body: JSON.stringify(body),
  })
  const out: any = await res.json().catch(() => ({}))
  if (res.status === 403 && out?.code === 'age_restricted') throw new Error('age_restricted')
  const ok = res.ok && out?.result?.ok && !!out?.result?.image_b64 && out?.status !== 'redirected' && out?.status !== 'intake_rejected'
  if (!ok) throw new Error(failureReason(out, res.status))
  return { imageB64: out.result.image_b64 as string }
}

export async function watermarkPreview(masterB64: string): Promise<Buffer> {
  return sharp(Buffer.from(await bakeFoyerWatermark(masterB64), 'base64')).toColourspace('srgb')
    .jpeg({ quality: LOCKED_PREVIEW_QUALITY, progressive: true, mozjpeg: true }).toBuffer()
}

/**
 * My Collection, read-only: the owned artwork's clean original (through the same ownership check the Print Shop uses: the piece must be the user's, finished, a portraits / pets / groups piece
 * of a compatible shape) and the customer's own photograph it was made from. Nothing here writes to My Collection. The database checks ownership again when the session is created (057).
 */
export const realCollectionPort: CollectionPort = {
  async resolve(userId, previewId) {
    const { ownedPrintSource } = await import('@/lib/v1/print/owned-source')
    const s = await ownedPrintSource(userId, previewId)
    const { data } = await supabaseAdmin.from('portfolios').select('source_image').eq('id', s.portfolioId).eq('user_id', userId).maybeSingle()
    const raw = typeof data?.source_image === 'string' ? data.source_image.replace(/^data:[^,]+,/, '') : ''
    return {
      previewId, portfolioId: s.portfolioId, series: s.series as Series, preset: s.preset, bytes: await sharp(s.bytes).png().toBuffer(), width: s.width, height: s.height,
      sourcePhoto: raw ? Buffer.from(raw, 'base64') : null,
    }
  },
}

export function giftDeps(): GiftDeps {
  return {
    draftCompositions: process.env.GIFT_COMPOSITIONS_BEFORE_PAYMENT === '1',
    store: supabaseGiftStore(supabaseAdmin), storage: supabaseGiftStorage(), analyze: analyzeSource, generate: generateMaster, watermark: watermarkPreview,
    compose: composeWithPrintShop,
    mockup: realMockupRenderer,
    collection: realCollectionPort,
    // Release an approved order to the existing fulfilment pipeline now rather than waiting for the poller (crons run on Production only).
    kick: async orderId => (await import('@/lib/v1/print/complete')).completePrintOrder(orderId),
  }
}

/** Concierge is the existing support_messages record. Idempotent on id (a repeat is a no-op). */
export function conciergePort(db: any = supabaseAdmin): ConciergePort {
  return {
    async create(row) {
      const { error } = await db.from('support_messages').insert(row)
      if (error && error.code !== '23505') throw new Error('concierge_record_failed: ' + error.message)
    },
  }
}

/** Checkout dependencies: the existing Stripe client, Prodigi quote and print_orders helpers. Preview requires Stripe test mode and the Prodigi sandbox. */
export async function giftOrderDeps(): Promise<GiftOrderDeps & { gift: GiftDeps }> {
  const [{ getStripe }, prodigi, printDb, owned] = await Promise.all([
    import('@/lib/store/stripe'), import('@/lib/v1/print/prodigi-client'), import('@/lib/v1/print/db'), import('@/lib/v1/print/owned-source'),
  ])
  return {
    gift: giftDeps(), store: supabaseGiftStore(supabaseAdmin), stripe: getStripe(),
    requireReviewedCompositions: process.env.GIFT_COMPOSITIONS_BEFORE_PAYMENT === '1',      // off: the approved journey is checkout, then compose, review, approve
    printOrders: {
      async create(i) { const row = await printDb.createPrintOrder(i); return { id: row.id } },
      async updateUnpaid(orderId, i) {
        const { data, error } = await supabaseAdmin.from('print_orders').update({
          stripe_session_id: i.stripeSessionId, customer_email: i.customerEmail, shipping_address: i.shippingAddress, items: i.items, retail_subtotal_cents: i.retailSubtotalCents,
          retail_shipping_cents: i.retailShippingCents, retail_total_cents: i.retailTotalCents, shipping_method: i.shippingMethod, updated_at: new Date().toISOString(),
        }).eq('id', orderId).eq('status', 'created').select('id')
        if (error) throw new Error('update_unpaid_order_failed: ' + error.message)
        return (data?.length ?? 0) === 1
      },
    },
    quote: prodigi.getQuote, canFulfil: printDb.canFulfil,
    requireSandbox: process.env.VERCEL_ENV === 'preview' ? owned.requireSandboxPrint : undefined,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY,
  }
}
