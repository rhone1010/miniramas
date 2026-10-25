// GET /api/v1/retention/cleanup (internal auth, daily cron) -> the source-photograph retention report.
// DRY RUN unless SOURCE_RETENTION_DELETE=1 (and never when ?dry=1). A dry run reads and reports; it deletes nothing.
import { NextResponse } from 'next/server'
import { checkInternalAuth } from '@/lib/store/internal-auth'
import { supabaseAdmin } from '@/lib/supabase'
import { giftDeps } from '@/lib/v1/gift/real'
import { runSourceRetention } from '@/lib/v1/retention/sweep'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: Request) {
  const auth = checkInternalAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const apply = process.env.SOURCE_RETENTION_DELETE === '1' && new URL(req.url).searchParams.get('dry') !== '1'
  const report = await runSourceRetention({ db: supabaseAdmin as any, gift: giftDeps() }, { apply })
  const failed = !!(report.portfolios.error || report.gift.error)
  return NextResponse.json(report, { status: failed ? 500 : 200 })
}
