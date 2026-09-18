-- 034_print_order_withheld.sql
-- Liten & Co — add the 'withheld' status markWithheld() has always written.
--
-- NOT DATABASE-VERIFIED. Written and reviewed statically; never executed.
--
-- ── THE DEFECT ─────────────────────────────────────────────────────────
--
-- lib/v1/print/db.ts:216 sets status = 'withheld'. print_order_status
-- (migration 012, lines 23-25) has eight values and that is not one of them:
--
--   'created','paid','placed','in_production','shipped','delivered',
--   'cancelled','error'
--
-- No migration has ever added it. So the UPDATE fails on an invalid enum
-- input, markWithheld throws, and print/webhook swallows the throw into a
-- console.error. Because the UPDATE is atomic, error_message does not land
-- either — the reason is lost with the status.
--
-- The order therefore stays at 'paid' and is indistinguishable from a healthy
-- paid order. It is counted in the panel's Orders and in Revenue, and it is
-- NOT counted in "paid, not printed", which matches status = 'error'. A real
-- customer has paid, nothing will be manufactured, and no operational surface
-- says so.
--
-- ── WHY THIS IS ADDITIVE AND SAFE ──────────────────────────────────────
--
-- ADD VALUE only widens the type. No existing row changes, no column is
-- rewritten, and nothing that reads the enum today can see a value it did not
-- see before — because no row has ever successfully held this one.
--
-- IF NOT EXISTS makes it idempotent. It is added AFTER 'error' so the declared
-- order matches the lifecycle: a withheld order is a terminal state reached
-- after payment, like error, not a stage on the way to shipping.
--
-- Once applied, markWithheld starts succeeding and withheld orders become
-- visible as their own status in the panel's order table. They are
-- deliberately NOT folded into "paid, not printed": that metric means a
-- failure, and a withheld order is a decision.

-- NOTE ON THE TRANSACTION: ALTER TYPE ... ADD VALUE could not run inside a
-- transaction block before Postgres 12. Supabase is well past that, and the
-- remaining rule — the new value cannot be USED in the same transaction that
-- adds it — is respected here, because this migration only adds it. If this
-- ever fails with "cannot run inside a transaction block", drop the begin and
-- commit and run the single statement on its own.

begin;

alter type public.print_order_status add value if not exists 'withheld' after 'error';

commit;
