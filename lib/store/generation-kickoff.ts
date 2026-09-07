// store/generation-kickoff.ts
// lib/store/generation-kickoff.ts
//
// The real implementation, wired 2026-09-06. This was a stub that logged
// "[generation-kickoff:STUB] would start generation" and returned — so a
// Discovery single-piece purchase ($2.99, qty 1) reserved an entitlement,
// took the money, rendered nothing and wrote no row anywhere. The customer
// paid and My Collection stayed empty.
//
// What it does now, in the order the original stub's own header asked for:
//   1. call the portraits pipeline (/api/v1/portraits/generate)
//   2. on success   → consumeEntitlement() with the jobId
//   3. on failure   → restoreEntitlement()
//   4. persist the result — into `collection_pieces`, the same table
//      portraits.html has always read, via lib/store/collection-pieces.
//      Not a new table, not a portfolio of one. Ruled 2026-09-06.
//
// NO WATERMARK HERE, deliberately. A single is bought outright and delivered
// clean (portfolio-checkout.ts:6-8) — the watermark/unlock pipeline is for
// portfolios of 4+. This is the one place in Discovery where the customer
// receives the clean render with no unlock step.
//
// TIMING, FLAGGED FOR RICH, NOT CHANGED: createCheckout fires this
// concurrently with the Stripe session, BEFORE payment confirms
// (checkout.ts:143-158, "Fire-and-forget"). That is the existing design and
// reserveEntitlement is its guard, but it does mean an abandoned checkout can
// still cost a render. Moving it behind the webhook needs somewhere to keep
// the source image — the purchases row has no column for one — so it is a
// schema decision, not a one-line move.

import type { GenerationKickoff } from './types'
import { getAppUrl } from './stripe'
import { consumeEntitlement, restoreEntitlement } from './entitlements'
import { styleIdForPreset } from './portraits-style-lookup'
import { savePiece } from './collection-pieces'
import { internalHeaders } from './internal-fetch'

export const defaultGenerationKickoff: GenerationKickoff = {
  async start(args) {
    if (!args.sourceImageRef) {
      console.error(`[generation-kickoff] no source image for job ${args.jobId} — nothing to craft`)
      await restoreEntitlement({
        entitlementId: args.entitlementId,
        reason:        'no_source_image',
        userId:        args.userId,
        guestEmail:    args.guestEmail,
      }).catch((e) => console.error('[generation-kickoff] restore failed', e))
      return
    }

    const appUrl = getAppUrl()
    /* Derived the same way the portfolio path derives it
       (portfolios/items/render/route.ts:71), so both routes ask the engine
       for the effect by the same name. `variant` is the effect key the
       browser sent; `style` is its silo. */
    const presetId = args.variant
    const styleId = styleIdForPreset(presetId) || args.style

    let imageB64: string | null = null
    let failure = 'generate_failed'
    try {
      /* The same composition block the portfolio path sends
         (portfolios/items/render/route.ts, ported from
         portraits.html:6807-6824). A single is one piece, so the block that
         would have been stored on a portfolio travels straight through. */
      const comp = args.composition ?? {}
      const res = await fetch(`${appUrl}/api/v1/portraits/generate`, {
        method: 'POST',
        headers: internalHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          source_image_b64: args.sourceImageRef,
          style_id: styleId,
          preset_id: presetId,
          framing: comp.framing ?? 'bust',
          scale: comp.scale ?? 'close_up',
          pose: comp.pose,
          aspect_ratio: comp.aspect_ratio,
          subject: comp.subject,
        }),
      })
      const data: any = await res.json()
      const ok = res.ok && data?.result?.ok && !!data?.result?.image_b64
        && data?.status !== 'redirected' && data?.status !== 'intake_rejected'
      if (ok) imageB64 = data.result.image_b64
      else failure = data?.error || data?.status || `generate_http_${res.status}`
    } catch (e: any) {
      failure = e?.message || 'generate_threw'
    }

    if (!imageB64) {
      console.error(`[generation-kickoff] job ${args.jobId} failed: ${failure}`)
      await restoreEntitlement({
        entitlementId: args.entitlementId,
        reason:        failure,
        userId:        args.userId,
        guestEmail:    args.guestEmail,
      }).catch((e) => console.error('[generation-kickoff] restore failed', e))
      return
    }

    /* Consume BEFORE the shelf write, because the entitlement is what was
       paid for and the render has already happened — a failed upload must
       not hand back a credit for work the engine has already done. The
       opposite order is right in portraits/unlock (route.ts:13-16), where
       nothing has been spent until the file is delivered. */
    const consumed = await consumeEntitlement({
      entitlementId: args.entitlementId,
      jobId:         args.jobId,
      style:         args.style,
      variant:       args.variant,
      userId:        args.userId,
      guestEmail:    args.guestEmail,
    })
    if (!consumed.ok) {
      console.error(`[generation-kickoff] consume refused for ${args.jobId}: ${consumed.reason}`)
    }

    /* owner_key is the auth user id, which is what resolveOwner stamps for a
       signed-in customer (portraits/pieces/route.ts). A guest buys with an
       email and no browser token reaches the server, so a guest single
       renders and is delivered but does not land on a shelf. Flagged: guest
       singles have nowhere durable to go until identity-map covers them. */
    if (!args.userId) {
      console.warn(`[generation-kickoff] guest single ${args.jobId} rendered but not shelved — no owner_key`)
      return
    }

    const saved = await savePiece({
      ownerKey:  args.userId,
      userId:    args.userId,
      userEmail: args.userEmail ?? args.guestEmail ?? null,
      imageB64,
      series:    'portraits',
      preset:    presetId,
      mode:      'material',
      meta:      { jobId: args.jobId, single: true },
    })
    if (!saved.ok) {
      console.error(`[generation-kickoff] piece not shelved for ${args.jobId}: ${saved.reason}`)
      return
    }
    console.log(`[generation-kickoff] job=${args.jobId} shelved piece=${saved.piece.id}`)
  },
}
