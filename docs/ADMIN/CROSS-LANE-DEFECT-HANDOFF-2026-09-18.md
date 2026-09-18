# CROSS-LANE DEFECT HANDOFF
**Date:** 2026-09-18 · **From:** Admin lane (`H:\LitenCo_Admin`, branch `admin/control-panel`) · **To:** the CC team owning the customer application

Two defects found incidentally during Admin baseline reconnaissance. **Neither is Admin Phase 1 work.** Investigation was limited to what was needed to make this handoff accurate — no fix attempted, no database queried, no further root-cause work done.

Both are in the payment/fulfilment and credits lanes.

---

## DEFECT 1 — `markWithheld()` writes an enum value that does not exist

**Severity: serious.** A customer can be charged with nothing printed, and no operational surface will show it.

### Evidence

`print_orders.status` is typed `public.print_order_status` (`supabase/migrations/012_reconcile_live_schema.sql:280`). The enum is defined at `012:23-25` with exactly eight values:

```sql
create type public.print_order_status as enum (
  'created','paid','placed','in_production','shipped','delivered','cancelled','error'
);
```

`'withheld'` is **not among them**. `grep -rn "withheld" supabase/migrations/*.sql` returns **nothing** — no migration has ever added it.

`markWithheld()` sets exactly that value (`lib/v1/print/db.ts:213-221`):

```ts
export async function markWithheld(sessionId: string, reason: string): Promise<void> {
  const { error } = await sb()
    .from('print_orders')
    .update({
      status:        'withheld',
      error_message: reason.slice(0, 1000),
    })
    .eq('stripe_session_id', sessionId)
  if (error) throw new Error(`markWithheld: ${error.message}`)
}
```

It is **reachable in production**, on the paid-but-not-cleared-for-fulfilment path (`app/api/v1/print/webhook/route.ts:129-143`):

```ts
const allowed = await canFulfil(order.owner_key)
if (!allowed) {
  ...
  await markWithheld(session.id, why).catch(err =>
    console.error('[print-webhook] markWithheld failed:', err))
  return NextResponse.json({ ok: true, withheld: true, reason: why })
}
```

### Likely consequence

The UPDATE should fail with an invalid-enum-input error. `markWithheld` throws, and **the throw is swallowed by the `.catch()` at line 140** into a `console.error`. The webhook then returns `200 { ok: true, withheld: true }`.

Because the UPDATE is atomic, **neither** field lands:

- `status` stays `'paid'`
- `error_message` is **not** set either, so the reason is lost from the database

Net effect: **a withheld order is indistinguishable from a healthy paid order in `print_orders`.** It is counted in Admin's `Orders` and in Revenue (`paid_at` is set), and it is **not** counted in `in_error` (which matches `status = 'error'`). The customer has paid, nothing has been sent to Prodigi, and the only trace is the `console.warn` at `webhook:133-139` in Vercel logs.

### Why this matters to Admin specifically

Rich approved Phase 1 decision **C3**: the "Paid for, nothing printed" alert becomes `paid_at IS NOT NULL AND status = 'error'`. That is the correct definition — but **withheld orders never reach `status = 'error'`**, so they will remain invisible to that alert no matter what Admin does.

**Admin cannot close this blind spot.** Until the enum carries `'withheld'` (or the code writes an existing terminal status), the panel's paid-not-printed figure will under-report by exactly the volume of withheld orders — the ones where a real customer has paid and will receive nothing.

### Not investigated

Whether any historical rows attempted this write; whether the enum differs in the live database from migration 012; whether `'withheld'` was intended as a status or as an `error_message` convention. The design note at `lib/v1/print/db.ts:27` describes it as "a new terminal status", suggesting a migration was intended and never written.

---

## DEFECT 2 — `credit_ledger` receives `reason` values its CHECK constraint disallows

**Severity: potentially serious, but conditional** — the consequence depends on whether the constraint is active in the live database, which Admin did not check (no production queries authorized).

### Evidence

The constraint (`supabase/migrations/012_reconcile_live_schema.sql:167-168`):

```sql
do $$ begin alter table public.credit_ledger add constraint credit_ledger_reason_check
  check (reason = any (array['purchase','code','grant','referral','craft','refund','recraft'])) not valid;
exception when duplicate_object or duplicate_table then null; end $$;
```

No other migration alters it — `grep -rn "credit_ledger_reason_check\|reason = any" supabase/migrations/*.sql` returns only these two lines.

Two disallowed values are written by application code:

| Value | Written at |
|---|---|
| `'wallpapers'` | `app/api/v1/credits/gate/route.ts:371` and `app/api/v1/wallpapers/purchase/route.ts:253` |
| `'studio_keep'` | `app/api/v1/wallpapers/studio/keep/route.ts:207` |

### Likely consequence

`not valid` means **existing rows are not re-checked, but new inserts are.** So if the constraint is active, every one of these three insert paths should fail.

The inserts are error-checked with a `console.error` only — e.g. `app/api/v1/credits/gate/route.ts:371-378` logs `[credits/gate] credit_ledger insert failed` and continues. The credit **balance is spent before the ledger row is written**, so a rejected insert means:

**the credits are gone and there is no audit row recording where they went.**

That is precisely the failure mode migration `007_craft_events.sql:5-6` was written to prevent: *"With credits live that is unrecorded money movement — this table is the record of truth for dispute evidence."*

### Why Admin cannot resolve it

Determining whether the constraint is actually active requires querying the live database. Admin has read authorization but deliberately did not run this query, because the answer changes nothing Admin can do — the fix is either a migration widening the constraint or a code change to the three call sites, both in the credits/wallpapers lane.

Note the `do $$ ... exception when duplicate_object ... end $$` wrapper means the constraint may never have been added if one already existed under that name, so its presence cannot be inferred from the migration file alone.

### Relevance to Admin Phase 1

Rich approved decision **C4**: split purchased credits from promotional/granted credits using `credit_ledger.reason`. That split reads the `reason` column these two values are written to. If ledger rows are silently failing to insert, **the split will be computed over an incomplete ledger** — and `'wallpapers'` / `'studio_keep'` are not in Rich's purchased-vs-promotional taxonomy either way, so Admin needs a ruling on which side they fall regardless of this defect.

### Not investigated

Whether the constraint exists in the live database; whether any ledger inserts are currently failing; the reconciliation between `credit_balances.balance` and `sum(credit_ledger.delta)`. All three require production queries.

---

## SUMMARY FOR THE RECEIVING TEAM

| | Defect | Fix location | Admin impact |
|---|---|---|---|
| 1 | `'withheld'` absent from `print_order_status` enum | Migration adding the value, **or** `lib/v1/print/db.ts:216` writing an existing status | Blocks Admin from ever surfacing withheld orders; C3's paid-not-printed alert under-reports |
| 2 | `'wallpapers'` / `'studio_keep'` absent from `credit_ledger_reason_check` | Migration widening the constraint, **or** the three call sites using allowed reasons | May be silently dropping ledger rows, which would make C4's purchased-vs-promotional split incomplete |

Admin has taken no action on either and will not, absent cross-lane approval.
