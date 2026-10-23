// GET /api/v1/gift/sessions/{id}/generations/{gid} -> GenerationView (status, large watermarked preview URL, sha256).
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { getGenerationH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; gid: string }> }) {
  const user = await getUser().catch(() => null)
  const p = await ctx.params
  return user ? getGenerationH(user, giftDeps(), p.id, p.gid) : signInRequired()
}
