// scripts/gift-release-order.ts
//
// OPERATOR-ONLY release of ONE finalized Gift order to manufacturing. Not a route, page or customer action; nothing in the app imports it.
// The customer's final approval (POST /api/v1/gift/sessions/{id}/finalize) never does this. Releasing moves the order from 'awaiting_artwork' to 'paid', the state the
// existing fulfilment pipeline acts on (it still runs its own account gate, payment check, refund recheck, upscale, QA and Prodigi sandbox/live checks).
//
//   Dry run (the default, changes nothing):
//     npx tsx --env-file=.env.local scripts/gift-release-order.ts --session <uuid> --user <uuid> --operator <you@liten.co>
//   Release (needs migration 056 applied to THIS database, and the customer's final approval):
//     npx tsx --env-file=.env.local scripts/gift-release-order.ts --session <uuid> --user <uuid> --operator <you@liten.co> --execute

import { releaseOrder } from '../lib/v1/gift/compose'
import { giftDeps } from '../lib/v1/gift/real'

function arg(name: string): string | null { const i = process.argv.indexOf('--' + name); return i >= 0 ? process.argv[i + 1] ?? null : null }

async function main() {
  const session = arg('session'), user = arg('user'), operator = arg('operator'), execute = process.argv.includes('--execute')
  if (!session || !user || !operator || !/^[0-9a-f-]{36}$/i.test(session) || !/^[0-9a-f-]{36}$/i.test(user)) throw new Error('usage: --session <uuid> --user <uuid> --operator <email> [--execute]')
  const host = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').host } catch { return '(unset)' } })()
  console.log(JSON.stringify({ mode: execute ? 'RELEASE' : 'dry-run', database: host, session, operator }))
  const out = await releaseOrder(giftDeps(), { operator, userId: user, sessionId: session, dryRun: !execute })
  console.log(JSON.stringify(out, null, 2))
  if (!execute && out.status === 'would_release') console.log('Dry run only. Add --execute to release this order to the fulfilment pipeline.')
}
main().then(() => process.exit(0), e => { console.error('gift-release-order:', e instanceof Error ? e.message : e); process.exit(1) })
