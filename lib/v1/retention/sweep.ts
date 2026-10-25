// SOURCE PHOTOGRAPH RETENTION: one sweep over every place a customer's source photograph is held. Approved policy (2026-10-25): delete 60 days after
//   - creation, for unpurchased work;
//   - the qualifying purchase or Collection unlock, for Portraits, Pets and Groups (portfolios.source_image);
//   - customer artwork approval, for the Gift Shop (gift/{session}/source.jpg) and the copy a Gift approval makes into its portfolio.
// An open dispute suspends deletion. Crafted artwork, approved manufacturing files and financial records are never touched (see docs/GOVERNANCE/SOURCE-PHOTO-RETENTION-2026-10-25.md).
// Nothing is deleted unless `apply` is true; the cron route passes it only when SOURCE_RETENTION_DELETE=1.

import { purgeApprovedSources } from '../gift/service'
import type { GiftDeps } from '../gift/service'

export interface RpcClient { rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }> }

export interface PortfolioSweepRow { portfolio_id: string; delete_after: string; disputed: boolean; due: boolean; deleted: boolean }
export interface RetentionReport {
  apply: boolean; at: string
  portfolios: { held: number; due: number; deleted: number; disputed: number; notYetDue: number; ids: string[]; error?: string }
  gift: { due: number; deleted: number; held: number; failed: number; ids: string[]; error?: string }
}

export async function runSourceRetention(deps: { db: RpcClient; gift: GiftDeps; now?: () => Date }, opts: { apply: boolean; limit?: number }): Promise<RetentionReport> {
  const at = (deps.now ?? (() => new Date()))()
  const report: RetentionReport = { apply: opts.apply, at: at.toISOString(), portfolios: { held: 0, due: 0, deleted: 0, disputed: 0, notYetDue: 0, ids: [] }, gift: { due: 0, deleted: 0, held: 0, failed: 0, ids: [] } }
  try {
    const { data, error } = await deps.db.rpc('retention_sweep_portfolio_sources', { p_now: at.toISOString(), p_limit: opts.limit ?? 200, p_apply: opts.apply })
    if (error) throw new Error(error.message)
    for (const r of (data ?? []) as PortfolioSweepRow[]) {
      report.portfolios.held++
      if (r.due) report.portfolios.due++
      if (r.deleted) { report.portfolios.deleted++; report.portfolios.ids.push(r.portfolio_id) }
      if (r.disputed) report.portfolios.disputed++
      if (!r.due && !r.disputed) report.portfolios.notYetDue++
    }
  } catch (e) { report.portfolios.error = e instanceof Error ? e.message : String(e) }
  try { report.gift = { ...(await purgeApprovedSources(deps.gift, { apply: opts.apply, limit: opts.limit ?? 50 })) } } catch (e) { report.gift.error = e instanceof Error ? e.message : String(e) }
  return report
}
