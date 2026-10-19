// POST /api/v1/gift/sessions { image_b64 } -> 201 SessionView. Contract: lib/v1/gift/types.ts
// GET  /api/v1/gift/sessions -> RestoreResponse: the signed-in customer's current session (photo, batches, previews, generation state, suggested step), or current: null.
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { createSessionH, restoreSessionH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
  const user = await getUser().catch(() => null)
  return user ? restoreSessionH(user, giftDeps()) : signInRequired()
}

export async function POST(req: Request) {
  const user = await getUser().catch(() => null)
  return user ? createSessionH(req, user, giftDeps()) : signInRequired()
}
