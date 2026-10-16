// POST /api/v1/gift/preview-pack/confirm { stripeSessionId } -> { confirmed, paidPacksAvailable }
// Re-verifies the Stripe session with Stripe (the same verified fulfilment the webhook runs). Idempotent.
import { getUser } from '@/lib/store/auth'
import { getStripe } from '@/lib/store/stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { supabaseGiftStore } from '@/lib/v1/gift/store'
import { packConfirmH, signInRequired } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const user = await getUser().catch(() => null)
  return user ? packConfirmH(req, user, { stripe: getStripe(), store: supabaseGiftStore(supabaseAdmin) }) : signInRequired()
}
