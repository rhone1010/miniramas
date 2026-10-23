// POST /api/v1/gift/sessions/{id}/generations { productId, idempotencyKey, mode? }: generate a personalized composition for a product at its exact aspect (NB2.1). GET lists them.
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { listGenerationsH, signInRequired, startGenerationH } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null)
  return user ? startGenerationH(req, user, giftDeps(), (await ctx.params).id) : signInRequired()
}
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null)
  return user ? listGenerationsH(user, giftDeps(), (await ctx.params).id) : signInRequired()
}
