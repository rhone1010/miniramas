// GET /api/v1/gift/sessions/{id}/lines/{lineId}/mockup[?compositionId=...] -> MockupView
// The watermarked product mockup of a purchased line's CURRENT composition, rendered server-side by the existing Node/Sharp compositor.
// Authenticated; the line must belong to the caller's own paid order. The clean artwork never leaves the server. See lib/v1/gift/mockup.ts.
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { mockupH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: Request, ctx: { params: Promise<{ id: string; lineId: string }> }) {
  const user = await getUser().catch(() => null)
  const p = await ctx.params
  return user ? mockupH(req, user, giftDeps(), p.id, p.lineId) : signInRequired()
}
