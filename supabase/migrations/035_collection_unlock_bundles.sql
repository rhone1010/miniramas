-- LOCAL REVIEW ONLY. Do not rerun 034. No Stripe mutations.
-- Balance remains existing entitlements; this table records checkout attempts only.
begin;

-- Inactive in the general SKU catalog: only the dedicated, validated Collection
-- checkout may sell these. Existing /store and generic checkout stay unchanged.
insert into public.skus(id,display_name,kind,count,price_cents,stripe_price_id,active) values
 ('discovery_unlock_1','1 Unlock','bundle',1,299,'price_1UHbcOCWHIffAtyWFDQnDjXS',false),
 ('discovery_unlock_3','3 Unlocks','bundle',3,799,'price_1UHbd2CWHIffAtyW1MJLbZze',false),
 ('discovery_unlock_5','5 Unlocks','bundle',5,1299,'price_1UHbdeCWHIffAtyWzjKDpaI6',false),
 ('discovery_unlock_10','10 Unlocks','bundle',10,1999,'price_1UHbeNCWHIffAtyWhFIbwhdU',false)
on conflict (id) do nothing;
do $$ begin
 if exists (
  select 1 from (values
   ('discovery_unlock_1',1,299,'price_1UHbcOCWHIffAtyWFDQnDjXS'),
   ('discovery_unlock_3',3,799,'price_1UHbd2CWHIffAtyW1MJLbZze'),
   ('discovery_unlock_5',5,1299,'price_1UHbdeCWHIffAtyWzjKDpaI6'),
   ('discovery_unlock_10',10,1999,'price_1UHbeNCWHIffAtyWhFIbwhdU')
  ) v(id,n,c,price) join public.skus s on s.id=v.id
  where s.count<>v.n or s.price_cents<>v.c or s.stripe_price_id<>v.price or s.kind<>'bundle' or s.active
 ) then raise exception 'existing_collection_unlock_sku_conflict'; end if;
end $$;

create table public.collection_unlock_checkouts (
 attempt_id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 sku_id text not null references public.skus(id),
 quantity integer not null check(quantity in (1,3,5,10)),
 amount_cents integer not null check(amount_cents>0),
 stripe_price_id text not null,
 params jsonb not null,
 created_at timestamptz not null default now(),
 closed_at timestamptz,
 session_id text unique,
 purchase_id uuid unique references public.purchases(id)
);
create unique index collection_unlock_open on public.collection_unlock_checkouts(user_id,sku_id) where closed_at is null;
alter table public.collection_unlock_checkouts enable row level security;
revoke all on public.collection_unlock_checkouts from public,anon,authenticated;
grant all on public.collection_unlock_checkouts to service_role;

create function public.reserve_collection_unlock_checkout(p_user uuid,p_sku text,p_params jsonb,p_expired uuid default null)
returns public.collection_unlock_checkouts language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.collection_unlock_checkouts; s public.skus;
begin
 if p_user is null or p_sku not in ('discovery_unlock_1','discovery_unlock_3','discovery_unlock_5','discovery_unlock_10') then
  raise exception 'invalid_collection_unlock_request'; end if;
 select * into strict s from public.skus where id=p_sku;
 if not exists(select 1 from (values
  ('discovery_unlock_1',1,299,'price_1UHbcOCWHIffAtyWFDQnDjXS'),
  ('discovery_unlock_3',3,799,'price_1UHbd2CWHIffAtyW1MJLbZze'),
  ('discovery_unlock_5',5,1299,'price_1UHbdeCWHIffAtyWzjKDpaI6'),
  ('discovery_unlock_10',10,1999,'price_1UHbeNCWHIffAtyWhFIbwhdU')
 ) v(id,n,c,price) where v.id=s.id and v.n=s.count and v.c=s.price_cents and v.price=s.stripe_price_id)
 or s.kind<>'bundle' or s.active or (p_params#>>'{line_items,0,price}') is distinct from s.stripe_price_id then
  raise exception 'collection_unlock_sku_mismatch'; end if;
 perform pg_advisory_xact_lock(hashtextextended('collection-unlocks:'||p_user::text,0));
 select * into r from public.collection_unlock_checkouts where user_id=p_user and sku_id=p_sku and closed_at is null for update;
 if found and r.attempt_id=p_expired then
  if exists(select 1 from public.purchases where id=r.purchase_id and status='paid') then raise exception 'already_paid'; end if;
  update public.collection_unlock_checkouts set closed_at=now() where attempt_id=r.attempt_id;
  r:=null;
 end if;
 if r.attempt_id is null then
  insert into public.collection_unlock_checkouts(user_id,sku_id,params,quantity,amount_cents,stripe_price_id)
  values(p_user,p_sku,p_params,s.count,s.price_cents,s.stripe_price_id) returning * into r;
 end if;
 return r;
end $$;

create function public.complete_collection_unlock_checkout(p_attempt uuid,p_user uuid,p_session text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.collection_unlock_checkouts; pid uuid;
begin
 select * into r from public.collection_unlock_checkouts where attempt_id=p_attempt and user_id=p_user for update;
 if not found or r.closed_at is not null then raise exception 'checkout_missing'; end if;
 if r.session_id is not null then
  if r.session_id<>p_session then raise exception 'checkout_session_mismatch'; end if;
  return r.purchase_id;
 end if;
 insert into public.purchases(user_id,sku_id,stripe_session_id,amount_cents,status)
 values(p_user,r.sku_id,p_session,r.amount_cents,'pending') returning id into pid;
 insert into public.entitlements(purchase_id,user_id,locked_style,status)
 select pid,p_user,'discovery_unlock_credit','pending' from generate_series(1,r.quantity);
 update public.collection_unlock_checkouts set session_id=p_session,purchase_id=pid where attempt_id=p_attempt;
 return pid;
end $$;

create function public.fulfill_collection_unlocks(p_session text,p_charge text,p_user uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.collection_unlock_checkouts; p public.purchases; n integer;
begin
 select * into r from public.collection_unlock_checkouts where session_id=p_session and user_id=p_user for update;
 if not found then raise exception 'checkout_missing'; end if;
 select * into strict p from public.purchases where id=r.purchase_id for update;
 if p.user_id is distinct from p_user or p.sku_id<>r.sku_id or p.amount_cents<>r.amount_cents or
    (p.stripe_charge_id is not null and p.stripe_charge_id<>p_charge) or p.status in ('failed','refunded') then
  raise exception 'purchase_mismatch'; end if;
 select count(*) into n from public.entitlements where purchase_id=p.id and user_id=p_user
  and locked_style='discovery_unlock_credit' and status in ('pending','available','consumed');
 if n<>r.quantity then raise exception 'entitlement_quantity_mismatch'; end if;
 update public.purchases set status='paid',stripe_charge_id=p_charge,paid_at=coalesce(paid_at,now()) where id=p.id;
 update public.entitlements set status='available' where purchase_id=p.id and status='pending';
 update public.collection_unlock_checkouts set closed_at=coalesce(closed_at,now()) where attempt_id=r.attempt_id;
end $$;

-- Fetch clean bytes in the existing route first. This transaction changes
-- entitlement and ownership together, only when no existing included/bound
-- entitlement should take precedence. No balances or ownership are client-written.
create function public.redeem_collection_unlock(p_user uuid,p_preview uuid)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare l public.preview_ledger; pf public.portfolios; eid uuid;
begin
 select * into l from public.preview_ledger where id=p_preview for update;
 if not found then raise exception 'preview_missing'; end if;
 select p.* into pf from public.portfolios p join public.portfolio_items i on i.portfolio_id=p.id
  where i.preview_id=p_preview and i.status='done' and p.user_id=p_user
   and l.email='portfolio:'||p.id::text||':'||i.slot::text limit 1;
 if not found then return 'legacy'; end if;
 if l.unlocked_at is not null then return 'already_unlocked'; end if;
 if l.storage_path is null then raise exception 'clean_unavailable'; end if;
 if exists(select 1 from public.entitlements e join public.purchases p on p.id=e.purchase_id
  where e.user_id=p_user and e.status='available' and p.status='paid' and
   (e.purchase_id=pf.purchase_id or (e.locked_style='discovery_unlock' and e.locked_variant=p_preview::text))) then
  return 'legacy'; end if;
 select e.id into eid from public.entitlements e join public.purchases p on p.id=e.purchase_id
  where e.user_id=p_user and e.status='available' and e.locked_style='discovery_unlock_credit'
   and e.locked_variant is null and p.status='paid'
  order by e.created_at,e.id limit 1 for update of e skip locked;
 if not found then return 'legacy'; end if;
 update public.entitlements set status='consumed',locked_variant=p_preview::text,job_id=gen_random_uuid(),consumed_at=now() where id=eid;
 update public.preview_ledger set unlocked_at=now() where id=p_preview;
 return 'unlocked';
end $$;

revoke all on function public.reserve_collection_unlock_checkout(uuid,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.complete_collection_unlock_checkout(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.fulfill_collection_unlocks(text,text,uuid) from public,anon,authenticated;
revoke all on function public.redeem_collection_unlock(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_collection_unlock_checkout(uuid,text,jsonb,uuid) to service_role;
grant execute on function public.complete_collection_unlock_checkout(uuid,uuid,text) to service_role;
grant execute on function public.fulfill_collection_unlocks(text,text,uuid) to service_role;
grant execute on function public.redeem_collection_unlock(uuid,uuid) to service_role;
commit;
