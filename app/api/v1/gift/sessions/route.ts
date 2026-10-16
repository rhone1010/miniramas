// POST /api/v1/gift/sessions { image_b64 } -> 201 SessionView. Contract: lib/v1/gift/types.ts
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { createSessionH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const user = await getUser().catch(() => null)
  return user ? createSessionH(req, user, giftDeps()) : signInRequired()
}
