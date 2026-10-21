// POST /api/v1/gift/sessions/from-collection { previewId } -> 201 SessionView (new session) | 200 SessionView (the same piece again: the same live session).
// The MY COLLECTION entrance to the shared Product Studio: the favorite is an artwork the customer already owns (previewId = the owned artwork's id, as My Collection and
// /api/v1/print/source know it). The owned piece is only read; the session has its own files and records; everything after is the photo entrance's. Needs migration 057.
// Errors: 404 artwork_not_found (not theirs, not finished, or not there: never says which), 409 artwork_not_compatible, 429/rate_limited, 503 artwork_unavailable | collection_unavailable.
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { createCollectionSessionH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const user = await getUser().catch(() => null)
  return user ? createCollectionSessionH(req, user, giftDeps()) : signInRequired()
}
