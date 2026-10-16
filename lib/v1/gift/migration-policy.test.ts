// Static guards on the migration files themselves: the approved retention policy is in 047, the abandoned daily free-batch
// allowance is in neither, and 048 implements the approved purchase-before-generation flow and refund handling.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const read = (f: string) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const m047 = read('supabase/migrations/047_gift_wizard_sessions.sql'), m048 = read('supabase/migrations/048_gift_orders.sql')
const code = (s: string) => s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')

describe('migration 047', () => {
  it('carries the finalized retention policy: 7 days idle, 30 days maximum, paid packs preserved', () => {
    const c = code(m047)
    expect(c).toMatch(/interval '7 days'/); expect(c).toMatch(/created_at \+ interval '30 days'/)
    expect(c).toMatch(/least\(created_at \+ interval '30 days', greatest\(expires_at, now\(\) \+ interval '7 days'\)\)/)
    expect(c).toMatch(/pinned_at\s+timestamptz/)                                                   // retained-until-resolved hook
    expect(c).not.toMatch(/gift_preview_packs[^;]*references public\.gift_sessions/)                // a pack must outlive its session
    expect(c).toMatch(/user_id\s+uuid not null,\s*\n\s*stripe_session_id/)                          // a pack belongs to the user
  })
  it('does not contain the abandoned daily or rolling free-batch allowance', () => {
    for (const bad of [/free_claim/i, /rolling/i, /24 hours/i, /per day/i, /daily/i, /free_batches_per/i, /allowance/i]) expect(code(m047), String(bad)).not.toMatch(bad)
    expect(code(m048)).not.toMatch(/free_claim|rolling|24 hours|per day|daily|allowance/i)
  })
  it('keeps the service-role-only permission model', () => {
    expect(m047).toMatch(/revoke all on function public\.gift_reserve_batch[^;]*from anon, authenticated/)
    expect(m047).toMatch(/grant execute on function public\.gift_reserve_batch[^;]*to service_role/)
    expect((m047.match(/enable row level security/g) ?? []).length).toBe(4)
  })
  it('says plainly that 048 supersedes its per-session free batches', () => { expect(m047).toMatch(/Superseded by 048/) })
})

describe('migration 048', () => {
  it('implements the purchase-before-generation flow', () => {
    const c = code(m048)
    expect(c).toMatch(/add value if not exists 'awaiting_artwork'/)
    expect(c).toMatch(/free_batches_granted = 2/)                                                    // two free batches per paid order, set at confirmation only
    expect(c).toMatch(/create or replace function public\.gift_reserve_batch/); expect(c).toMatch(/raise exception 'order_payment_required'/)
    expect(c).toMatch(/if n < s\.free_batches_granted then/)
    for (const fn of ['gift_link_order', 'gift_confirm_order', 'gift_select_artwork', 'gift_use_correction', 'gift_approve_order', 'gift_request_refund', 'gift_decline_refund', 'gift_apply_refund', 'gift_release_session']) {
      expect(c, fn).toContain(`create or replace function public.${fn}(`); expect(c, fn + ' grant').toMatch(new RegExp(`grant execute on function public[.]${fn}[(][^)]*[)] +to service_role`))
    }
  })
  it('releases an order to fulfilment only through approval, and only from awaiting_artwork', () => {
    const c = code(m048)
    expect(c).toMatch(/update public\.print_orders set status = 'paid'[^;]*status::text = 'awaiting_artwork'/)
    expect(c).toMatch(/raise exception 'compositions_not_approved'/); expect(c).toMatch(/raise exception 'artwork_not_selected'/)
    expect((c.match(/update public\.print_orders set status = 'paid'/g) ?? []).length).toBe(1)        // the one and only path to 'paid'
  })
  it('limits corrections to one per line and the unlock to one per order, without touching entitlements', () => {
    const c = code(m048)
    expect(c).toMatch(/corrections_used int\s+not null default 0 check \(corrections_used between 0 and 1\)/)
    expect(c).toMatch(/if s\.unlock_portfolio_id is null then/); expect(c).toMatch(/origin = 'gift'/)
    expect(c).not.toMatch(/entitlements/i)
  })
  it('handles refunds: one request per order, blocks work while open, applies each Stripe refund once, never manufactures', () => {
    const c = code(m048)
    expect(c).toMatch(/order_id\s+uuid not null unique references public\.print_orders\(id\),\s*\n\s*session_id/)     // one request per order
    expect(c).toMatch(/refund_id\s+text primary key/); expect(c).toMatch(/on conflict \(refund_id\) do nothing/)
    expect(c).toMatch(/raise exception 'refund_pending'/); expect(c).toMatch(/raise exception 'refund_not_available_after_manufacturing'/)
    expect(c).toMatch(/set status = 'cancelled'[^;]*status::text in \('awaiting_artwork', 'paid', 'withheld', 'error'\)/)    // a placed order is never cancelled here
    expect(c).toMatch(/refunded_after_placement/)
  })
  it('is the next migration after 047 and numbered once', () => {
    const files = fs.readdirSync('supabase/migrations').filter(f => /^04[78]_/.test(f)).sort()
    expect(files).toEqual(['047_gift_wizard_sessions.sql', '048_gift_orders.sql'])
  })
})
