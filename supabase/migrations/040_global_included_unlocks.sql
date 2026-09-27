-- Approved and installed 2026-09-26. Leaves the deployed 035 RPC intact.
begin;
create function public.redeem_collection_unlock_v2(p_user uuid,p_preview uuid,p_confirm_cross uuid default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare l public.preview_ledger; pf public.portfolios; e public.entitlements; origin uuid; cross_collection boolean;
begin
 select * into l from public.preview_ledger where id=p_preview for update;
 if not found then raise exception 'preview_missing'; end if;
 select p.* into pf from public.portfolios p join public.portfolio_items i on i.portfolio_id=p.id
  where i.preview_id=p_preview and i.status='done' and p.user_id=p_user
   and l.email='portfolio:'||p.id::text||':'||i.slot::text limit 1;
 if not found then
  if l.email like 'portfolio:%' then raise exception 'wrong_owner'; end if;
  return jsonb_build_object('status','legacy');
 end if;
 if l.unlocked_at is not null then return jsonb_build_object('status','already_unlocked'); end if;
 if l.storage_path is null then raise exception 'clean_unavailable'; end if;
 select ent.* into e from public.entitlements ent join public.purchases p on p.id=ent.purchase_id
  where ent.user_id=p_user and ent.status='available' and p.status='paid' and (
   (ent.locked_style is null and ent.locked_variant is null and exists(select 1 from public.portfolios own
     where own.purchase_id=ent.purchase_id and own.user_id=p_user and own.free_unlocks>0))
   or (ent.locked_style='discovery_unlock' and ent.locked_variant=p_preview::text)
   or (ent.locked_style='discovery_unlock_credit' and ent.locked_variant is null))
  order by case when ent.purchase_id=pf.purchase_id then 0 when ent.locked_style='discovery_unlock' then 1
   when ent.locked_style is null then 2 else 3 end,ent.created_at,ent.id
  limit 1 for update of ent skip locked;
 if not found then return jsonb_build_object('status','no_entitlement'); end if;
 if e.locked_style is null then
  select id into origin from public.portfolios where purchase_id=e.purchase_id and user_id=p_user and free_unlocks>0 order by created_at,id limit 1;
 end if;
 cross_collection:=origin is not null and origin<>pf.id;
 if cross_collection and p_confirm_cross is distinct from e.id then
  return jsonb_build_object('status','confirm_included','entitlementId',e.id,'originPortfolioId',origin);
 end if;
 update public.entitlements set status='consumed',locked_variant=p_preview::text,
  locked_style=coalesce(locked_style,'portrait_unlock'),job_id=gen_random_uuid(),consumed_at=now() where id=e.id;
 update public.preview_ledger set unlocked_at=now() where id=p_preview;
 return jsonb_build_object('status','unlocked','reusable',e.locked_style='discovery_unlock_credit','originPortfolioId',origin);
end $$;
revoke all on function public.redeem_collection_unlock_v2(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.redeem_collection_unlock_v2(uuid,uuid,uuid) to service_role;
commit;
