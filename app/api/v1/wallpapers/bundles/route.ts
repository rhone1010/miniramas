// app/api/v1/wallpapers/bundle/route.ts
//
// Crafts a SET of wallpapers in one press. Five or seven effects from one
// silo, one credit decision, one response.
//
// Sits alongside /wallpapers/generate, which stays as the single-render
// path for a customer picking one tile.
//
// ── CONCURRENCY ────────────────────────────────────────────────────────
//
// Renders run in parallel with a small cap. Seven simultaneous NB2 calls
// is the difference between a customer waiting forty seconds and waiting
// four minutes, but it is also seven Replicate predictions at once, so the
// cap keeps that bounded and predictable rather than fastest-possible.
//
// ── PARTIAL FAILURE ────────────────────────────────────────────────────
//
// Each effect reports its own ok flag. The bundle returns 200 whenever at
// least one render succeeded, with `failed` listing the rest — the caller
// gets the images that worked and knows exactly what did not.
//
// This is NOT a refund decision. Whether a four-of-five bundle is refunded
// in part, re-rendered, or held is Rich's ruling and is not made here.

import { NextRequest, NextResponse } from 'next/server'
import { generateWallpaper } from '@/lib/v1/wallpapers/wallpapers-generator'
import {
  isWallpaperEffectId,
  wallpapersBySilo,
  WALLPAPER_SILOS,
  type WallpaperSiloId,
} from '@/lib/v1/wallpapers/wallpapers-registry'
import {
  pickBundleEffects,
  BUNDLE_SIZES,
  type BundleSize,
} from '@/lib/v1/wallpapers/wallpapers-bundles'

export const runtime     = 'nodejs'
export const maxDuration = 300   // several NB2 calls, capped concurrency

/** Simultaneous NB2 calls. Raising this shortens the wait and raises the
 *  burst on Replicate; lowering it does the reverse. */
const CONCURRENCY = 3

interface BundleRow {
  effect_id:     string
  ok:            boolean
  image_b64:     string | null
  outpainted:    boolean
  error?:        string
  duration_ms:   number
}

export async function POST(req: NextRequest) {
  const t0 = Date.now()

  try {
    const body = await req.json()

    const silo: WallpaperSiloId | undefined = body.silo
    const size: BundleSize = body.size ?? 5

    if (!silo || !(silo in WALLPAPER_SILOS)) {
      return NextResponse.json(
        { error: `unknown silo: ${silo}`, known: Object.keys(WALLPAPER_SILOS) },
        { status: 400 },
      )
    }

    if (!BUNDLE_SIZES.includes(size)) {
      return NextResponse.json(
        { error: `bundle size must be one of ${BUNDLE_SIZES.join(', ')}` },
        { status: 400 },
      )
    }

    // Caller may pin the exact set; otherwise it is picked in catalog order,
    // skipping anything already owned.
    let effectIds: string[]
    if (Array.isArray(body.effect_ids) && body.effect_ids.length) {
      effectIds = body.effect_ids
      const unknown = effectIds.filter(id => !isWallpaperEffectId(id))
      if (unknown.length) {
        return NextResponse.json(
          { error: `unknown effects: ${unknown.join(', ')}` },
          { status: 400 },
        )
      }
    } else {
      effectIds = pickBundleEffects({
        siloEffectIds: wallpapersBySilo(silo).map(e => e.id),
        size,
        exclude:       body.exclude || [],
      })
    }

    if (!effectIds.length) {
      return NextResponse.json(
        { error: 'no effects available for this bundle' },
        { status: 400 },
      )
    }

    const replicateApiToken = process.env.REPLICATE_API_TOKEN
    if (!replicateApiToken) {
      return NextResponse.json(
        { error: 'REPLICATE_API_TOKEN not configured' },
        { status: 500 },
      )
    }
    const stabilityApiKey = process.env.STABILITY_API_KEY || undefined

    console.log(
      `[wallpapers/bundle] start silo=${silo} size=${size} ` +
      `effects=${effectIds.join(',')}`,
    )

    const rows: BundleRow[] = await runCapped(
      effectIds,
      CONCURRENCY,
      async (effectId) => {
        const rowT0 = Date.now()
        try {
          const r = await generateWallpaper({
            request: {
              source_image_b64:      body.source_image_b64 || undefined,
              additional_images_b64: body.additional_images_b64 || [],
              effect_id:             effectId,
            },
            replicateApiToken,
            stabilityApiKey,
          })
          return {
            effect_id:   effectId,
            ok:          r.ok && !!r.image_b64,
            image_b64:   r.image_b64,
            outpainted:  r.outpainted,
            error:       r.fatal_error || undefined,
            duration_ms: Date.now() - rowT0,
          }
        } catch (e: any) {
          return {
            effect_id:   effectId,
            ok:          false,
            image_b64:   null,
            outpainted:  false,
            error:       e?.message || 'render failed',
            duration_ms: Date.now() - rowT0,
          }
        }
      },
    )

    const succeeded = rows.filter(r => r.ok)
    const failed    = rows.filter(r => !r.ok)

    console.log(
      `[wallpapers/bundle] done in ${Date.now() - t0}ms — ` +
      `${succeeded.length}/${rows.length} ok` +
      (failed.length ? ` failed=${failed.map(f => f.effect_id).join(',')}` : ''),
    )

    // Everything failed — that is a server problem, not a partial bundle.
    if (!succeeded.length) {
      return NextResponse.json(
        {
          error: 'all renders in the bundle failed',
          results: rows,
          duration_ms: Date.now() - t0,
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      result: {
        silo,
        size,
        requested:   rows.length,
        succeeded:   succeeded.length,
        failed:      failed.map(f => f.effect_id),
        results:     rows,
        duration_ms: Date.now() - t0,
      },
    })

  } catch (e: any) {
    const msg = e?.message || 'unknown error'
    console.error(`[wallpapers/bundle] failed in ${Date.now() - t0}ms: ${msg}`)
    return NextResponse.json(
      { error: msg, duration_ms: Date.now() - t0 },
      { status: 500 },
    )
  }
}

/** Run tasks with at most `limit` in flight, preserving input order in the
 *  output. Keeps the Replicate burst bounded. */
async function runCapped<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0

  async function worker() {
    while (true) {
      const i = next++
      if (i >= items.length) return
      out[i] = await fn(items[i])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  )
  return out
}
