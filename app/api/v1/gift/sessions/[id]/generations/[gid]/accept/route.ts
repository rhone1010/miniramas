// POST /api/v1/gift/sessions/{id}/generations/{gid}/accept -> { generation, session }.
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { acceptGenerationH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(_req: Request, ctx: { params: Promise<{ id: string; gid: string }> }) {
  const user = await getUser().catch(() => null)
  const p = await ctx.params
  return user ? acceptGenerationH(user, giftDeps(), p.id, p.gid) : signInRequired()
}
