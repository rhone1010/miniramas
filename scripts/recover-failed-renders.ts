// scripts/recover-failed-renders.ts
//
// OPERATOR-ONLY recovery of NAMED failed Discovery items. Not a route, not a page, not run by cron. It uses the same database claim as the Production sweep
// (claim_render_recovery), so every limit is identical: transient errors only, no artwork, paid and activated portfolio, two hours since the failure, one recovery
// per item, and the $5 daily ceiling. There is no "all": name each item.
//
//   Dry run (default; reads only, claims nothing, spends nothing):
//     npx tsx --env-file=.env.local scripts/recover-failed-renders.ts --item <uuid> [--item <uuid> ...]
//   Execute (claims, then asks the named deployment to render; this is the paid step):
//     RENDER_RECOVERY_COST_USD=<cost of one render> npx tsx --env-file=.env.local scripts/recover-failed-renders.ts --item <uuid> --base-url https://<preview>.vercel.app --execute
//
// The render itself runs in the deployment (items/render, Bearer CRON_SECRET, plus the Vercel protection bypass when VERCEL_AUTOMATION_BYPASS_SECRET is set), so the
// same claim, retry and idempotency rules apply. Needs migration 053 applied to this database. Output: ids and reasons only.

import { supabaseAdmin } from '../lib/supabase'
import { claimRecovery, explainRecovery, cycleCostUsd, dailyCeilingUsd } from '../lib/store/render-recovery'
import { parseRecoveryArgs } from '../lib/store/render-recovery-args'

async function main() {
  const a = parseRecoveryArgs(process.argv.slice(2))
  const host = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').host } catch { return '(unset)' } })()
  console.log(JSON.stringify({ mode: a.execute ? 'EXECUTE' : 'dry-run', database: host, items: a.items.length, cycleCostUsd: cycleCostUsd(), dailyCeilingUsd: dailyCeilingUsd() }))
  for (const id of a.items) {
    const verdict = await explainRecovery(supabaseAdmin, id)
    if (!a.execute) { console.log(JSON.stringify({ item: id, verdict })); continue }
    if (verdict !== 'eligible') { console.log(JSON.stringify({ item: id, skipped: verdict })); continue }
    const claim = await claimRecovery(supabaseAdmin, id)
    if (!claim.claimed) { console.log(JSON.stringify({ item: id, refused: claim.reason })); continue }
    const secret = process.env.CRON_SECRET
    if (!secret) { console.log(JSON.stringify({ item: id, claimed: true, rendered: false, note: 'CRON_SECRET not set: the item is queued for the cron poller' })); continue }
    const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` }
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    const res = await fetch(`${a.baseUrl}/api/v1/portfolios/items/render`, { method: 'POST', headers, body: JSON.stringify({ portfolioItemId: id }) })
    console.log(JSON.stringify({ item: id, claimed: true, renderHttp: res.status, body: (await res.text()).slice(0, 160) }))
  }
}
if (process.argv[1] && /recover-failed-renders\.(ts|js|mjs)$/.test(process.argv[1].replace(/\\/g, '/'))) main().then(() => process.exit(0), e => { console.error('recover-failed-renders:', e instanceof Error ? e.message : e); process.exit(1) })
