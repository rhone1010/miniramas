# PATCH — the credits gate must name the craft it charges for

**2026-08-01 · CUI V24.** Reviewed and applied by Rich.
Target: `app/api/v1/credits/gate/route.ts`.

---

## WHY

Rich crafted three pieces against a photograph the gate redirected to Groups.
Thirty credits were taken, no piece was delivered, and the refund returned
**400 `ref_id_required`**. It happened three more times in the same session.
Fifty credits are outstanding on the test account.

The refund route is right to demand it. Its own header says so: without a
reference, *"calling it five times paid out five times."*

But no `ref_id` the client can send will ever work, because the gate writes:

```ts
    const ledger = Array.from({ length: n }, (_, k) => ({
      owner_key: owner,
      delta,
      reason: 'craft',
      ref_id: null as string | null,      // ← here
```

The refund then looks for `reason='craft'` rows with a matching `ref_id`:

```ts
    const { data: spentRows } = await db
      .from('credit_ledger').select('delta')
      .eq('owner_key', owner).eq('reason', 'craft').eq('ref_id', refId)
```

Finds none, every time. Verified against the live ledger on 2026-08-01 — ten
consecutive `craft` rows, `ref_id` null on all ten.

The two routes were written to a spec that assumed a craft id existed.
Neither generates one. **The gate is the only place that can**, because it is
the thing doing the charging.

---

## THE CHANGE

Three edits, all in `POST`.

**1 · Mint the id.** After `costPer` is validated and before the balance is
touched:

```ts
    // A charge must be nameable, or nothing can reverse it. The refund route
    // matches on this and refuses without it; until now the gate wrote null
    // and every refund failed. The client may supply one so a retried gate
    // call reuses the same reference; otherwise the server mints it.
    const refId = typeof body.ref_id === 'string' && body.ref_id.trim()
      ? body.ref_id.trim().slice(0, 64)
      : `craft_${crypto.randomUUID()}`
```

`crypto` is global in the Node runtime; no import.

**2 · Write it to the ledger.** Replace the null:

```ts
      ref_id: refId,
```

**3 · Return it.** The client cannot send back what it was never given:

```ts
    return NextResponse.json({
      ok: true,
      ref_id: refId,          // ← the client holds this and sends it to refund
      balance_after: balanceAfter,
      granted: n,
      spent: isAdmin ? 0 : total,
      cost_per: costPer,
      admin: isAdmin,
    })
```

**Optional, and worth it.** `craft_events` rows have no reference either, so
a charge and its event cannot be joined. If `craft_events` has a usable
column, put `refId` on those rows in the same pass. If it does not, leave it
— that is a migration, not this patch.

---

## WHAT IS DELIBERATELY NOT DONE

**The ledger stays outside `spend_credits`.** That is board decision 3.4 and
it is still open. This patch makes refunds possible; it does not settle where
the write belongs.

**No backfill.** The fifty credits already owed on the test account cannot be
refunded through this route — those rows have no reference and never will.
Correct them by hand:

```sql
-- 5 crafts × 10, redirected to Groups, refund route rejected them all
insert into credit_ledger (owner_key, delta, reason, ref_id, balance_after)
values ('b4f556b0-4003-47e6-81a9-4abe03350eac', 50, 'refund',
        'manual_2026-08-01_pre_refid',
        (select balance + 50 from credit_balances
          where owner_key = 'b4f556b0-4003-47e6-81a9-4abe03350eac'));

update credit_balances set balance = balance + 50
 where owner_key = 'b4f556b0-4003-47e6-81a9-4abe03350eac';
```

Check the drift query afterwards; it should read 0.

---

## TWO THINGS FOUND WHILE READING, NEITHER FIXED HERE

**The refund's ledger walk assumes a whole number of images.** It caps the
payout at what was spent, then writes `rows = round(total / costPer)` rows of
`costPer` each. At ten credits an image those agree. If the cap ever bites —
a partial refund, or a cost that is not a multiple — the rows and the balance
disagree and the ledger stops being true. Not reachable today.

**Admin is refunded nothing, correctly, but the customer copy does not know
that.** An admin whose craft is redirected sees *"those credits are back"*
having never been charged. True, and it reads oddly. Curator lane.

---

## VERIFY AFTER APPLYING

1. Craft anything. In Supabase:

```sql
select ref_id, reason, delta from credit_ledger
 where owner_key = '<your uid>' order by created_at desc limit 3;
```

`ref_id` reads `craft_…`, not null.

2. Craft a photograph with three people in it — the gate redirects to Groups,
   nothing is delivered. The console should read
   `[credits] refund response 200 {"ok":true,...}` and the balance should
   return to where it started.

3. **Send the same refund twice.** The second returns `already: true` and
   pays nothing. That is the test that matters — it is the guarantee the
   whole reference exists for.
