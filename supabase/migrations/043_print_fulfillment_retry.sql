begin;
create table public.print_fulfillment_retries (
  id uuid primary key,
  order_id uuid not null references public.print_orders(id),
  requested_by uuid not null,
  status text not null check(status in ('running','placed','error','uncertain')),
  prior_error text,
  result jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create unique index print_one_active_retry on public.print_fulfillment_retries(order_id)
where status in ('running','uncertain');
alter table public.print_fulfillment_retries enable row level security;
revoke all on public.print_fulfillment_retries from public,anon,authenticated;
grant select on public.print_fulfillment_retries to service_role;

create function public.claim_print_fulfillment_retry(p_order uuid,p_user uuid,p_retry uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.print_orders; r public.print_fulfillment_retries;
begin
 select * into o from public.print_orders where id=p_order for update;
 if not found or o.owner_key is distinct from p_user::text then raise exception 'retry_not_authorized'; end if;
 if not exists(select 1 from public.account_flags where owner_key=p_user::text and fulfilment) then raise exception 'retry_not_authorized'; end if;
 select * into r from public.print_fulfillment_retries where id=p_retry;
 if found then
  if r.order_id<>p_order or r.requested_by<>p_user then raise exception 'retry_not_authorized'; end if;
  return jsonb_build_object('claimed',false,'status',r.status);
 end if;
 if o.status::text<>'error' or o.paid_at is null or o.stripe_payment_intent is null or o.prodigi_order_id is not null or o.placed_at is not null then raise exception 'retry_ineligible'; end if;
 if exists(select 1 from public.print_order_notifications where order_id=p_order and kind='refunded') then raise exception 'retry_refunded'; end if;
 if exists(select 1 from public.print_fulfillment_retries where order_id=p_order and status in ('running','uncertain')) then raise exception 'retry_in_progress'; end if;
 insert into public.print_fulfillment_retries(id,order_id,requested_by,status,prior_error) values(p_retry,p_order,p_user,'running',o.error_message);
 update public.print_orders set status='paid' where id=p_order;
 return jsonb_build_object('claimed',true,'order',to_jsonb(o));
end $$;

create function public.finish_print_fulfillment_retry(p_retry uuid,p_user uuid,p_status text,p_result jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.print_fulfillment_retries;
begin
 select * into r from public.print_fulfillment_retries where id=p_retry and requested_by=p_user for update;
 if not found then raise exception 'retry_not_found'; end if;
 if r.status<>'running' then return; end if;
 if p_status not in ('placed','error','uncertain') or p_status is null then raise exception 'invalid_retry_result'; end if;
 if p_status='placed' and coalesce(p_result->>'prodigi_order_id','')='' then raise exception 'missing_prodigi_reference'; end if;
 perform 1 from public.print_orders where id=r.order_id for update;
 if p_status='placed' then
  update public.print_orders set status='placed',placed_at=now(),prodigi_order_id=p_result->>'prodigi_order_id',error_message=null where id=r.order_id and status::text='paid';
 elsif p_status='error' then
  update public.print_orders set status='error',error_message=left(p_result->>'error',1000) where id=r.order_id and status::text='paid';
 else
  -- Unknown placement outcome is quarantined; never make it automatically retryable.
  update public.print_orders set error_message='retry_placement_uncertain' where id=r.order_id and status::text='paid';
 end if;
 update public.print_fulfillment_retries set status=p_status,result=p_result,finished_at=now() where id=p_retry;
end $$;
revoke all on function public.claim_print_fulfillment_retry(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.finish_print_fulfillment_retry(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_print_fulfillment_retry(uuid,uuid,uuid) to service_role;
grant execute on function public.finish_print_fulfillment_retry(uuid,uuid,text,jsonb) to service_role;
commit;
