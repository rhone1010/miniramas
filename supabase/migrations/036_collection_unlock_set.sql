-- Collection-wide purchases: immutable checkout snapshot, no reusable credits.
-- Additive. Does not replace migration 035 or alter wallet functions.
begin;

create table public.collection_unlock_sets (
 attempt_id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 preview_ids uuid[] not null,
 quantity integer not null check(quantity >= 10),
 rate_cents integer not null,
 amount_cents integer not null,
 params jsonb not null,
 created_at timestamptz not null default now(),
 closed_at timestamptz,
 fulfilled_at timestamptz,
 session_id text unique,
 purchase_id uuid unique references public.purchases(id),
 check(quantity = cardinality(preview_ids)),
 check(rate_cents = case when quantity >= 20 then 159 else 179 end),
 check(amount_cents = quantity * rate_cents)
);
create unique index collection_unlock_set_open on public.collection_unlock_sets(user_id) where closed_at is null;
alter table public.collection_unlock_sets enable row level security;
revoke all on public.collection_unlock_sets from public,anon,authenticated;
grant all on public.collection_unlock_sets to service_role;

create function public.reserve_collection_unlock_set(p_user uuid,p_return_url text,p_expected_count integer,p_expired uuid default null)
returns public.collection_unlock_sets language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.collection_unlock_sets; ids uuid[]; n integer; rate integer; aid uuid := gen_random_uuid();
begin
 if p_user is null then raise exception 'unlock_requires_user'; end if;
 perform pg_advisory_xact_lock(hashtextextended('collection-unlock-set:'||p_user::text,0));
 select * into r from public.collection_unlock_sets where user_id=p_user and closed_at is null for update;
 if found and r.attempt_id=p_expired then
  if r.fulfilled_at is not null or exists(select 1 from public.purchases where id=r.purchase_id and status='paid') then
   raise exception 'already_paid'; end if;
  update public.collection_unlock_sets set closed_at=now() where attempt_id=r.attempt_id;
  r:=null;
 end if;
 -- An in-flight session always retains its original set, even if Collection changed.
 if r.attempt_id is not null then return r; end if;
 select array_agg(x.id order by x.id) into ids from (
  select l.id from public.preview_ledger l
  where l.unlocked_at is null and l.storage_path is not null and exists(
   select 1 from public.portfolio_items i join public.portfolios p on p.id=i.portfolio_id
   where i.preview_id::text=l.id::text and i.status='done' and p.user_id=p_user
    and l.email='portfolio:'||p.id::text||':'||i.slot::text
  ) order by l.id for update of l
 ) x;
 n:=coalesce(cardinality(ids),0);
 if n<10 then raise exception 'collection_set_too_small'; end if;
 if p_expected_count is distinct from n then raise exception 'collection_set_quote_changed'; end if;
 rate:=case when n>=20 then 159 else 179 end;
 insert into public.collection_unlock_sets(attempt_id,user_id,preview_ids,quantity,rate_cents,amount_cents,params)
 values(aid,p_user,ids,n,rate,n*rate,jsonb_build_object(
  'mode','payment','ui_mode','embedded','redirect_on_completion','if_required','return_url',p_return_url,
  'line_items',jsonb_build_array(jsonb_build_object('quantity',n,'price_data',jsonb_build_object(
   'currency','usd','unit_amount',rate,'product','prod_VIC0Ff7OO7nFPj'))),
  'metadata',jsonb_build_object('kind','collection_unlock_set','userId',p_user::text,'attemptId',aid::text)
 )) returning * into r;
 return r;
end $$;

create function public.complete_collection_unlock_set(p_attempt uuid,p_user uuid,p_session text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.collection_unlock_sets; pid uuid;
begin
 select * into r from public.collection_unlock_sets where attempt_id=p_attempt and user_id=p_user for update;
 if not found or r.closed_at is not null then raise exception 'checkout_missing'; end if;
 if r.session_id is not null then
  if r.session_id<>p_session then raise exception 'checkout_session_mismatch'; end if;
  return r.purchase_id;
 end if;
 -- Reuse the existing single-piece unlock SKU; the snapshot holds this sale's price.
 insert into public.purchases(user_id,sku_id,stripe_session_id,amount_cents,status)
 values(p_user,'unlock_addon_1',p_session,r.amount_cents,'pending') returning id into pid;
 insert into public.entitlements(purchase_id,user_id,locked_style,locked_variant,status)
 select pid,p_user,'discovery_unlock_set',id::text,'pending' from unnest(r.preview_ids) id;
 update public.collection_unlock_sets set session_id=p_session,purchase_id=pid where attempt_id=p_attempt;
 return pid;
end $$;

create function public.fulfill_collection_unlock_set(p_session text,p_charge text,p_user uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.collection_unlock_sets; p public.purchases; n integer;
begin
 select * into r from public.collection_unlock_sets where session_id=p_session and user_id=p_user for update;
 if not found then raise exception 'checkout_missing'; end if;
 select * into strict p from public.purchases where id=r.purchase_id for update;
 if p.user_id is distinct from p_user or p.sku_id<>'unlock_addon_1' or p.amount_cents<>r.amount_cents
  or p.stripe_session_id<>p_session or p_charge is null
  or (p.stripe_charge_id is not null and p.stripe_charge_id<>p_charge) or p.status in ('failed','refunded') then
  raise exception 'purchase_mismatch'; end if;
 if r.fulfilled_at is not null then return r.quantity; end if;
 -- Share the existing redemption row locks. Already-unlocked purchased pieces are
 -- harmless on replay; later additions never enter this immutable purchased set.
 perform 1 from public.preview_ledger where id=any(r.preview_ids) order by id for update;
 select count(*) into n from public.preview_ledger l where l.id=any(r.preview_ids)
  and l.storage_path is not null and exists(
   select 1 from public.portfolio_items i join public.portfolios pf on pf.id=i.portfolio_id
   where i.preview_id::text=l.id::text and i.status='done' and pf.user_id=p_user
    and l.email='portfolio:'||pf.id::text||':'||i.slot::text);
 if n<>r.quantity then raise exception 'collection_set_ownership_mismatch'; end if;
 select count(*) into n from public.entitlements where purchase_id=p.id and user_id=p_user
  and locked_style='discovery_unlock_set' and locked_variant=any(r.preview_ids::text[])
  and status='pending';
 if n<>r.quantity then raise exception 'collection_set_entitlement_mismatch'; end if;
 update public.purchases set status='paid',stripe_charge_id=p_charge,paid_at=coalesce(paid_at,now()) where id=p.id;
 update public.entitlements set status='consumed',consumed_at=now(),job_id=gen_random_uuid()
  where purchase_id=p.id and locked_style='discovery_unlock_set' and status='pending';
 update public.preview_ledger set unlocked_at=coalesce(unlocked_at,now()) where id=any(r.preview_ids);
 update public.collection_unlock_sets set fulfilled_at=now(),closed_at=now() where attempt_id=r.attempt_id;
 return r.quantity;
end $$;

revoke all on function public.reserve_collection_unlock_set(uuid,text,integer,uuid) from public,anon,authenticated;
revoke all on function public.complete_collection_unlock_set(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.fulfill_collection_unlock_set(text,text,uuid) from public,anon,authenticated;
grant execute on function public.reserve_collection_unlock_set(uuid,text,integer,uuid) to service_role;
grant execute on function public.complete_collection_unlock_set(uuid,uuid,text) to service_role;
grant execute on function public.fulfill_collection_unlock_set(text,text,uuid) to service_role;
commit;
