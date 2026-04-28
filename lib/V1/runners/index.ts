// runners/index.ts
// lib/v1/runners/index.ts
//
// Switch helper for the queue cron worker — given a product key + body,
// run the matching generation pipeline.

import type { QueuedProduct } from '@/lib/queue/types'
import { runGroupsGeneration }     from './groups'
import { runStructuresGeneration } from './structures'
import { runLandscapesGeneration } from './landscapes'
import { runInteriorGeneration }   from './interior'
import { runStadiumGeneration }    from './stadium'
import { runActionminiGeneration } from './actionmini'
import { runSportsmemGeneration }  from './sportsmem'
import { runMomentsGeneration }    from './moments'

export async function runByProduct(
  product: QueuedProduct,
  body: Record<string, unknown>,
): Promise<unknown> {
  switch (product) {
    case 'groups':     return runGroupsGeneration(body)
    case 'structures': return runStructuresGeneration(body)
    case 'landscapes': return runLandscapesGeneration(body)
    case 'interior':   return runInteriorGeneration(body)
    case 'stadium':    return runStadiumGeneration(body)
    case 'actionmini': return runActionminiGeneration(body)
    case 'sportsmem':  return runSportsmemGeneration(body)
    case 'moments':    return runMomentsGeneration(body)
  }
}

// The cron worker uploads the primary image. Different products return
// the image under different keys; this helper finds it. Returns null if
// the product produced multiple images (e.g. collectable_card front+back)
// or no image — the worker treats that as a permanent failure for v1.
export function extractPrimaryImageB64(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null
  const r = result as Record<string, unknown>

  // structures returns { results: [{ image_b64 }, ...] }
  if (Array.isArray(r.results) && r.results.length > 0) {
    const first = r.results[0] as Record<string, unknown>
    if (typeof first.image_b64 === 'string') return first.image_b64
    return null
  }

  // single-image: { result: { image_b64 } }
  const inner = r.result as Record<string, unknown> | undefined
  if (inner && typeof inner.image_b64 === 'string') return inner.image_b64

  return null
}
