-- Approved and installed 2026-09-26 on miniramas (dqctwzertbujhsjatfyv).
-- This reservation function cannot authorize a remedy or execute a Stripe refund.
begin;

alter table public.refund_log alter column entitlement_id drop not null;
alter table public.refund_log
 add column support_case_id uuid references public.support_messages(id),
 add column purchase_id uuid references public.purchases(id),
 add column allocation_key text,
 add column allocation_cents integer,
 add column amount_cents integer,
 add column stripe_charge_id text,
 add column stripe_refund_id text,
 add column refund_status text,
 add column allocation_context jsonb,
 add column updated_at timestamptz;

alter table public.refund_log add constraint remedy_refund_allocation_shape check (coalesce((
 (support_case_id is null and entitlement_id is not null) or
 (support_case_id is not null and purchase_id is not null and allocation_key is not null
  and allocation_cents > 0 and amount_cents > 0 and amount_cents <= allocation_cents
  and stripe_charge_id is not null and refund_status in ('reserved','submitted','succeeded','failed','review')
  and allocation_context is not null and updated_at is not null)
),false));
-- An allocation is never made available again by deleting/retagging a refund.
-- A failed/uncertain attempt is reconciled on its original row and Stripe key.
create unique index remedy_refund_economic_value on public.refund_log(purchase_id,allocation_key)
 where support_case_id is not null;
create unique index remedy_refund_stripe_result on public.refund_log(stripe_refund_id)
 where stripe_refund_id is not null;
create index remedy_refund_case on public.refund_log(support_case_id)
 where support_case_id is not null;

create function public.reserve_make_it_right_refund(p_case uuid,p_user uuid,p_allocations jsonb)
returns setof public.refund_log language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.support_messages; p public.purchases; a jsonb; prior public.refund_log;
 total integer; committed integer; pending integer; confirmed integer; n integer;
begin
 -- All remedy reservations share this lock, then lock the case and purchases.
 -- This is deliberately small-volume case handling, not a second wallet system.
 perform pg_advisory_xact_lock(hashtextextended('make-it-right:cash-allocation',0));
 select * into c from public.support_messages where id=p_case and user_id=p_user for update;
 if not found or c.context#>>'{case,authorized_remedy}' is distinct from 'refund'
  or c.context#>>'{case,scope}' is distinct from 'artwork'
  or coalesce(c.context#>>'{case,status}','') not in ('authorized','executing','resolved') then
  raise exception 'remedy_not_authorized'; end if;
 if jsonb_typeof(p_allocations) is distinct from 'array' or jsonb_array_length(p_allocations)=0 then
  raise exception 'invalid_allocations'; end if;
 select sum((x->>'eligibleCents')::integer),count(*) into total,n from jsonb_array_elements(p_allocations) x;
 if total is null or total<=0 or total>5000 or total is distinct from (c.context#>>'{case,authorized_amount_cents}')::integer
  or n<>(select count(distinct x->>'key') from jsonb_array_elements(p_allocations) x) then
  raise exception 'remedy_amount_mismatch'; end if;
 -- The server stores the owner-verified, Stripe-verified allocation snapshot
 -- in the same case before authorization. This RPC accepts only that snapshot.
 if c.context#>'{case,refund_allocations}' is distinct from p_allocations then
  raise exception 'remedy_allocation_mismatch'; end if;
 if exists(select 1 from public.refund_log r where r.support_case_id=p_case
   and not exists(select 1 from jsonb_array_elements(p_allocations) x
     where x->>'key'=r.allocation_key and (x->>'purchaseId')::uuid=r.purchase_id)) then
  raise exception 'remedy_allocation_snapshot_changed'; end if;
 for a in select x from jsonb_array_elements(p_allocations) x order by x->>'purchaseId',x->>'key' loop
  select * into p from public.purchases where id=(a->>'purchaseId')::uuid and user_id=p_user for update;
  if not found then raise exception 'payment_allocation_mismatch'; end if;
  select * into prior from public.refund_log where purchase_id=p.id and allocation_key=a->>'key';
  if found then
   if prior.support_case_id<>p_case or prior.amount_cents<>(a->>'eligibleCents')::integer
    or prior.allocation_context is distinct from a then raise exception 'economic_value_already_reserved'; end if;
   continue;
  end if;
  if not coalesce(p.status='paid' and (a->>'paidCents')::integer between 0 and p.amount_cents
   and (a->>'remainingCents')::integer between 0 and (a->>'paidCents')::integer
   and (a->>'eligibleCents')::integer between 1 and (a->>'cents')::integer
   and a->>'chargeId' is not null,false) then raise exception 'payment_allocation_mismatch'; end if;
  select coalesce(sum(amount_cents),0),
   coalesce(sum(amount_cents) filter(where refund_status<>'succeeded'),0),
   coalesce(sum(amount_cents) filter(where refund_status='succeeded'),0)
   into committed,pending,confirmed from public.refund_log where purchase_id=p.id and support_case_id is not null;
  -- A refund performed outside this audit has unknown artwork attribution.
  -- Hold for reconciliation instead of guessing which economic share it used.
  if (a->>'paidCents')::integer-(a->>'remainingCents')::integer<>confirmed then
   raise exception 'external_refund_requires_reconciliation'; end if;
  if committed+(a->>'eligibleCents')::integer>(a->>'paidCents')::integer
   or pending+(a->>'eligibleCents')::integer>(a->>'remainingCents')::integer then
   raise exception 'refundable_amount_changed'; end if;
  insert into public.refund_log(user_id,reason,support_case_id,purchase_id,allocation_key,allocation_cents,
    amount_cents,stripe_charge_id,refund_status,allocation_context,updated_at)
   values(p_user,'make_it_right',p_case,p.id,a->>'key',(a->>'cents')::integer,
    (a->>'eligibleCents')::integer,a->>'chargeId','reserved',a,now());
 end loop;
 return query select * from public.refund_log where support_case_id=p_case order by purchase_id,allocation_key;
end $$;
revoke all on function public.reserve_make_it_right_refund(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_make_it_right_refund(uuid,uuid,jsonb) to service_role;
commit;
