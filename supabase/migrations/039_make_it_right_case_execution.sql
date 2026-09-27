-- Approved and installed 2026-09-26 on miniramas (dqctwzertbujhsjatfyv).
begin;
alter table public.support_messages add column case_number bigint generated always as identity;
create unique index support_case_number on public.support_messages(case_number);
create index support_remedy_artwork on public.support_messages((context#>>'{case,artwork_key}'))
 where context#>>'{case,kind}'='make_it_right';

create function public.authorize_make_it_right_case(p_case uuid,p_user uuid,p_decision jsonb)
returns public.support_messages language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.support_messages; prior boolean; repeated boolean; same_art boolean;
 choice text; decision_source text; amount integer; first_goodwill boolean; art_key text; keys jsonb; result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('make-it-right:case-decision',0));
 select * into c from public.support_messages where id=p_case and user_id=p_user for update;
 if not found or c.context#>>'{case,kind}' is distinct from 'make_it_right' then raise exception 'case_missing'; end if;
 if c.context#>>'{case,authorized_remedy}' is not null then return c; end if;
 art_key:=c.context#>>'{case,artwork,id}';
 keys:=p_decision->'identity_keys';
 if jsonb_typeof(keys) is distinct from 'array' or not keys @> jsonb_build_array('user:'||p_user::text) then
  raise exception 'identity_context_missing'; end if;
 select exists(select 1 from public.support_messages s where s.id<>p_case
  and s.context#>>'{case,goodwill_consumed}'='true'
  and (s.user_id=p_user or exists(select 1 from jsonb_array_elements_text(keys) k
    where coalesce(s.context#>'{case,identity_keys}','[]'::jsonb) ? k))) into prior;
 select exists(select 1 from public.support_messages s where s.id<>p_case
  and ((s.context#>>'{case,authorized_remedy}'='refund' and p_decision->>'source_hash' is not null
    and s.context#>>'{case,source_hash}'=p_decision->>'source_hash')
   or (s.context#>>'{case,goodwill_consumed}'='true' and s.user_id<>p_user
    and exists(select 1 from jsonb_array_elements_text(keys) k
     where coalesce(s.context#>'{case,identity_keys}','[]'::jsonb) ? k)))) into repeated;
 select exists(select 1 from public.support_messages s where s.id<>p_case
  and s.context#>>'{case,artwork_key}'=art_key
  and s.context#>>'{case,authorized_remedy}' in ('redo','refund','source_photo')) into same_art;
 -- Replacement art inherits the original case; it never mints new goodwill.
 if exists(select 1 from public.portfolio_items i join public.portfolios pf on pf.id=i.portfolio_id
   where i.preview_id::text=art_key and pf.user_id=p_user and pf.composition#>>'{remedy,case_id}' is not null) then
  same_art:=true; end if;
 choice:=p_decision->>'remedy'; amount:=coalesce((p_decision->>'amountCents')::integer,0);
 if c.context#>>'{case,scope}' not in ('artwork','batch') or c.context#>>'{case,scope}' is null then
  raise exception 'case_scope_missing'; end if;
 first_goodwill:=not prior and not repeated;
 decision_source:=case when first_goodwill then 'goodwill' else 'evidence_policy' end;
 if c.context#>>'{case,scope}'='batch' then choice:='review'; decision_source:='batch_review';
 elsif c.context#>>'{case,requested_remedy}'='contact' then choice:='contact'; decision_source:='customer_contact';
 elsif same_art or repeated then choice:='review'; decision_source:='integrity_review';
 elsif choice='refund' then
  if c.context#>>'{case,requested_remedy}' is distinct from 'refund' or amount<=0 or amount>5000
   or (not first_goodwill and p_decision#>>'{evidence,classification}' is distinct from 'likely_failure') then
   choice:='review'; decision_source:='integrity_review'; end if;
 elsif choice not in ('redo','source_photo','review','contact') or choice is null then raise exception 'invalid_remedy';
 end if;
 if choice<>'refund' then amount:=0; end if;
 result:=(c.context->'case')||jsonb_build_object(
  'artwork_key',art_key,'identity_keys',keys,'source_hash',p_decision->>'source_hash',
  'authorized_remedy',choice,'authorized_amount_cents',amount,'decision_source',decision_source,
  'goodwill_consumed',first_goodwill and choice in ('redo','refund'),
  'evidence',p_decision->'evidence','refund_allocations',coalesce(p_decision->'refund_allocations','[]'::jsonb),
  'status',case when choice in ('review','contact') then 'reviewing' when choice='source_photo' then 'awaiting_photo' else 'authorized' end,
  'updated_at',now(),
  'events',coalesce(c.context#>'{case,events}','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
    'at',now(),'actor','policy','decision',choice,'source',decision_source,'amount_cents',amount)));
 update public.support_messages set context=jsonb_set(context,'{case}',result) where id=p_case returning * into c;
 return c;
end $$;

create function public.start_make_it_right_redo(p_case uuid,p_user uuid,p_source text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.support_messages; pf public.portfolios; item public.portfolio_items; l public.preview_ledger;
 pid uuid; iid uuid; source_image text; delivery_kind text;
begin
 select * into c from public.support_messages where id=p_case and user_id=p_user for update;
 if not found or coalesce(c.context#>>'{case,authorized_remedy}','') not in ('redo','source_photo')
  or c.context#>>'{case,scope}' is distinct from 'artwork' then raise exception 'redo_not_authorized'; end if;
 if c.context#>>'{case,replacement,portfolio_id}' is not null then return c.context#>'{case,replacement}'; end if;
 select * into pf from public.portfolios where id=(c.context#>>'{case,artwork,portfolioId}')::uuid and user_id=p_user;
 if not found or pf.series not in ('portraits','pets') then raise exception 'redo_context_missing'; end if;
 if not exists(select 1 from public.purchases where id=pf.purchase_id and user_id=p_user and status='paid') then
  raise exception 'redo_payment_requires_review'; end if;
 select * into item from public.portfolio_items where portfolio_id=pf.id
  and preview_id::text=c.context#>>'{case,artwork,id}' and status='done';
 if not found then raise exception 'redo_artwork_missing'; end if;
 select * into l from public.preview_ledger where id::text=item.preview_id::text
  and email='portfolio:'||pf.id::text||':'||item.slot::text;
 if not found then raise exception 'redo_ownership_missing'; end if;
 source_image:=pf.source_image;
 if c.context#>>'{case,authorized_remedy}'='source_photo' then
  if p_source is null or p_source=pf.source_image then raise exception 'better_photo_required'; end if;
  source_image:=p_source;
 elsif p_source is not null then raise exception 'unexpected_source'; end if;
 delivery_kind:=case when l.unlocked_at is not null then 'purchased' else 'preview' end;
 -- Reuse the original paid purchase, create no charge and mint no allowance.
 -- The existing renderer/dispatch handles this single complimentary replacement.
 insert into public.portfolios(purchase_id,user_id,series,size,status,free_unlocks,source_image,delivery,pose,framing,subject,aspect_ratio,composition)
 values(pf.purchase_id,p_user,pf.series,1,'generating',0,source_image,delivery_kind,pf.pose,pf.framing,pf.subject,pf.aspect_ratio,
  pf.composition||jsonb_build_object('remedy',jsonb_build_object('case_id',p_case,'original_preview_id',item.preview_id,'original_portfolio_id',pf.id))) returning id into pid;
 insert into public.portfolio_items(portfolio_id,slot,preset,status) values(pid,0,item.preset,'pending') returning id into iid;
 update public.support_messages set context=jsonb_set(context,'{case}',(context->'case')||jsonb_build_object(
  'replacement',jsonb_build_object('portfolio_id',pid,'item_id',iid),'status','executing','updated_at',now(),
  'events',coalesce(context#>'{case,events}','[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',now(),'actor','policy','decision','redo_started','portfolio_id',pid))))
 where id=p_case;
 return jsonb_build_object('portfolio_id',pid,'item_id',iid);
end $$;

create function public.refresh_make_it_right_case(p_case uuid,p_user uuid)
returns public.support_messages language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.support_messages; status text; total integer; succeeded integer;
begin
 select * into c from public.support_messages where id=p_case and user_id=p_user for update;
 if not found then raise exception 'case_missing'; end if;
 status:=c.context#>>'{case,status}';
 if c.context#>>'{case,authorized_remedy}'='refund' then
  select coalesce(sum(amount_cents),0),coalesce(sum(amount_cents) filter(where refund_status='succeeded'),0)
   into total,succeeded from public.refund_log where support_case_id=p_case;
  if exists(select 1 from public.refund_log where support_case_id=p_case and refund_status in ('failed','review')) then status:='reviewing';
  elsif total>0 then status:=case when total=succeeded and total=(c.context#>>'{case,authorized_amount_cents}')::integer then 'resolved' else 'executing' end; end if;
 elsif c.context#>>'{case,replacement,item_id}' is not null then
  select case when i.status='done' then 'resolved' when i.status='failed' then 'reviewing' else 'executing' end into status
   from public.portfolio_items i where i.id=(c.context#>>'{case,replacement,item_id}')::uuid;
 end if;
 update public.support_messages set context=jsonb_set(context,'{case}',(context->'case')||jsonb_build_object('status',status,'updated_at',now()))
 where id=p_case returning * into c;
 return c;
end $$;

-- One notification attempt per meaningful event; no internal-transition mail.
-- A lost network result remains visible in the case, never blindly resent.
create function public.claim_make_it_right_email(p_case uuid,p_user uuid,p_event text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.support_messages;
begin
 select * into c from public.support_messages where id=p_case and user_id=p_user for update;
 if not found or c.context#>>'{case,kind}' is distinct from 'make_it_right' then raise exception 'case_missing'; end if;
 if p_event not in ('received','action_required','resolved') or p_event is null then raise exception 'invalid_email_event'; end if;
 if p_event='action_required' and c.context#>>'{case,status}' is distinct from 'awaiting_photo' then return false; end if;
 if p_event='resolved' and c.context#>>'{case,status}' is distinct from 'resolved' then return false; end if;
 if coalesce(c.context#>'{case,email_events}','{}'::jsonb) ? p_event then return false; end if;
 update public.support_messages set context=jsonb_set(context,'{case,email_events}',
  coalesce(context#>'{case,email_events}','{}'::jsonb)||jsonb_build_object(p_event,jsonb_build_object('attempted_at',now(),'status','submitted'))) where id=p_case;
 return true;
end $$;

create function public.record_make_it_right_email(p_case uuid,p_user uuid,p_event text,p_result jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_event not in ('received','action_required','resolved') or p_event is null then raise exception 'invalid_email_event'; end if;
 if coalesce(p_result->>'status','') not in ('accepted','failed','uncertain') then raise exception 'invalid_email_result'; end if;
 update public.support_messages set context=jsonb_set(context,array['case','email_events',p_event],
  coalesce(context#>array['case','email_events',p_event],'{}'::jsonb)||p_result||jsonb_build_object('updated_at',now()))
 where id=p_case and user_id=p_user and coalesce(context#>'{case,email_events}','{}'::jsonb) ? p_event;
end $$;

-- No client or model can claim an arbitrary payment. This RPC only exposes an
-- existing owner/case-authorized reservation to the server executor.
create function public.claim_make_it_right_refund(p_id uuid,p_case uuid,p_user uuid)
returns public.refund_log language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.refund_log; c public.support_messages;
begin
 select * into c from public.support_messages where id=p_case and user_id=p_user for update;
 if not found or c.context#>>'{case,authorized_remedy}' is distinct from 'refund' then raise exception 'refund_not_authorized'; end if;
 select * into r from public.refund_log where id=p_id and support_case_id=p_case and user_id=p_user for update;
 if not found then raise exception 'reservation_missing'; end if;
 if r.refund_status='reserved' then
  update public.refund_log set refund_status='submitted',updated_at=now() where id=p_id returning * into r;
 end if;
 return r;
end $$;

create function public.record_make_it_right_refund(p_id uuid,p_case uuid,p_user uuid,p_result jsonb,p_status text)
returns public.refund_log language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.refund_log; c public.support_messages;
begin
 select * into c from public.support_messages where id=p_case and user_id=p_user for update;
 if not found or c.context#>>'{case,authorized_remedy}' is distinct from 'refund' then raise exception 'refund_not_authorized'; end if;
 select * into r from public.refund_log where id=p_id and support_case_id=p_case and user_id=p_user for update;
 if not found then raise exception 'reservation_missing'; end if;
 if r.refund_status='succeeded' then return r; end if;
 if p_status not in ('submitted','succeeded','failed','review') or p_status is null then raise exception 'invalid_refund_status'; end if;
 if p_status<>'review' then
  if not coalesce(p_result->>'id' like 're_%' and p_result->>'charge'=r.stripe_charge_id
   and (p_result->>'amount')::integer=r.amount_cents and p_result->>'currency'='usd'
   and p_result#>>'{metadata,liten_refund_allocation}'=r.id::text
   and p_result#>>'{metadata,liten_case}'=p_case::text
   and (r.stripe_refund_id is null or r.stripe_refund_id=p_result->>'id')
   and ((p_status='succeeded' and p_result->>'status'='succeeded')
    or (p_status='failed' and p_result->>'status' in ('failed','canceled'))
    or (p_status='submitted' and p_result->>'status' in ('pending','requires_action'))),false) then
   raise exception 'stripe_result_mismatch'; end if;
 end if;
 update public.refund_log set refund_status=p_status,
  stripe_refund_id=case when p_status='review' then stripe_refund_id else p_result->>'id' end,
  updated_at=now() where id=p_id returning * into r;
 update public.support_messages set context=jsonb_set(context,'{case,events}',
  coalesce(context#>'{case,events}','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
   'at',now(),'actor','refund_execution','allocation_id',p_id,'status',p_status,'stripe_refund_id',r.stripe_refund_id))) where id=p_case;
 return r;
end $$;
revoke all on function public.authorize_make_it_right_case(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.start_make_it_right_redo(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.refresh_make_it_right_case(uuid,uuid) from public,anon,authenticated;
grant execute on function public.authorize_make_it_right_case(uuid,uuid,jsonb) to service_role;
grant execute on function public.start_make_it_right_redo(uuid,uuid,text) to service_role;
grant execute on function public.refresh_make_it_right_case(uuid,uuid) to service_role;
revoke all on function public.claim_make_it_right_refund(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.record_make_it_right_refund(uuid,uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_make_it_right_refund(uuid,uuid,uuid) to service_role;
grant execute on function public.record_make_it_right_refund(uuid,uuid,uuid,jsonb,text) to service_role;
revoke all on function public.claim_make_it_right_email(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.record_make_it_right_email(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_make_it_right_email(uuid,uuid,text) to service_role;
grant execute on function public.record_make_it_right_email(uuid,uuid,text,jsonb) to service_role;
commit;
