// POST /api/v1/gift/sessions/{id}/finalize -> SessionView. The customer's FINAL ORDER APPROVAL, and nothing else: every purchased line must already have an approved
// composition; the approval is recorded durably and idempotently; the order is NOT released to manufacturing (no Prodigi, no fulfilment, no queue). Release is a separate,
// explicit operator step (scripts/gift-release-order.ts). Needs migration 056 (503 finalization_unavailable until it is applied).
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { finalizeOrderH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null)
  return user ? finalizeOrderH(user, giftDeps(), (await ctx.params).id) : signInRequired()
}
