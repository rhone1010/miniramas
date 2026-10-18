// scripts/gift-repair-line.ts
//
// OPERATOR-ONLY repair of ONE Gift Wizard line whose stored composition fails the frozen-product shape check (a LITEN-side defect). It is not
// a route, a page or a customer action; nothing in the app imports it.
//
//   Dry run (the default, changes nothing, makes no paid call):
//     npx tsx --env-file=.env.local scripts/gift-repair-line.ts --session <uuid> --user <uuid> --line <lineId> --operator <you@liten.co>
//   Execute (one paid NB2.1 generation if the plan is a generation; refused unless migration 052 is applied to THIS database):
//     npx tsx --env-file=.env.local scripts/gift-repair-line.ts --session <uuid> --user <uuid> --line <lineId> --operator <you@liten.co> --execute
//
// One line per run, by design: there is no "repair all". The customer's correction, the order, the frozen geometry, the saved favorite and every
// other line are untouched; the defective row is superseded (kept for audit) and the customer approves the replacement. Safe to repeat: see
// repairLine in lib/v1/gift/compose.ts. Output is JSON with ids and statuses only (no keys, no image data).

import { repairLine } from '../lib/v1/gift/compose'
import { parseRepairArgs as parseArgs } from '../lib/v1/gift/repair-args'
import { giftDeps } from '../lib/v1/gift/real'
import { supabaseAdmin } from '../lib/supabase'

async function main() {
  const a = parseArgs(process.argv.slice(2))
  const host = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').host } catch { return '(unset)' } })()
  console.log(JSON.stringify({ mode: a.execute ? 'EXECUTE' : 'dry-run', database: host, session: a.session, line: a.line, operator: a.operator }))

  if (a.execute) {
    // Refuse before any paid call if 052 is not applied to this database: the replacement row could not be stored.
    const probe = await supabaseAdmin.from('gift_compositions').select('repair_seq').limit(1)
    const claims = await supabaseAdmin.from('gift_repair_claims').select('session_id').limit(1)
    if (probe.error || claims.error) throw new Error('migration 052 is not applied to this database: nothing was done')
  }

  const result = await repairLine(giftDeps(), { operator: a.operator, userId: a.user, sessionId: a.session, lineId: a.line, dryRun: !a.execute })
  console.log(JSON.stringify(result, null, 2))
  if (!a.execute && result.status === 'would_repair') console.log('Dry run only. Add --execute to perform this repair (one generation at most).')
}

// Run only when invoked directly, so the argument parser can be tested without touching a database.
if (process.argv[1] && /gift-repair-line\.(ts|js|mjs)$/.test(process.argv[1].replace(/\\/g, '/'))) {
  main().then(() => process.exit(0), e => { console.error('gift-repair-line:', e instanceof Error ? e.message : e); process.exit(1) })
}
