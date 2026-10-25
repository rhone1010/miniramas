-- 061: one automatic goodwill refund per customer; every later refund claim goes to review. NOT APPLIED. Written 2026-10-25.
-- Replaces authorize_make_it_right_case (039). The only change: a refund decision for a customer whose goodwill is already consumed (or whose
-- identity/payment matches a consumed one) becomes 'review' with decision_source 'subsequent_review'. Redo and better-photo outcomes are unchanged.
-- The $50 ceiling, the atomic lock, the identity keys and the per-payment unique indexes (038) are unchanged.
begin;
create or replace function public.authorize_make_it_right_case(p_case uuid,p_user uuid,p_decision jsonb)
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
  if not first_goodwill then
   -- ONE automatic goodwill refund per customer (approved 2026-10-25): every later refund claim is reviewed by a person; evidence may inform that review but never pays.
   choice:='review'; decision_source:='subsequent_review';
  elsif c.context#>>'{case,requested_remedy}' is distinct from 'refund' or amount<=0 or amount>5000 then
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
commit;
