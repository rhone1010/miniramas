// GET /api/v1/gift/sessions/{id}/product-preview?productId=canvas:8x8 -> ProductPreviewView
// The customer's selected favorite inside a product BEFORE checkout: a watermarked mockup (scene renderer where a photograph truthfully shows the configuration, otherwise the
// calibrated renderer), or an explicit adaptation_required / not_available status. Authenticated, owner only. Creates no composition, order, approval or correction.
// See lib/v1/gift/product-preview.ts and the ProductPreviewView contract in lib/v1/gift/types.ts.
import { getUser } from '@/lib/store/auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { productPreviewH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser().catch(() => null)
  return user ? productPreviewH(req, user, giftDeps(), (await ctx.params).id) : signInRequired()
}
