-- Free Foyer previews converge into canonical Collection records. No payment or entitlement is fabricated.
begin;
alter table public.portfolios add column if not exists origin text not null default 'discovery';
alter table public.portfolios alter column purchase_id drop not null;
alter table public.portfolios add constraint portfolios_origin_purchase_check check (
  (origin = 'discovery' and purchase_id is not null) or
  (origin = 'foyer' and purchase_id is null and series in ('portraits','pets')
    and size = 1 and delivery = 'preview' and free_unlocks = 0)
);
alter table public.portfolios drop constraint if exists portfolios_aspect_ratio_check;
alter table public.portfolios add constraint portfolios_aspect_ratio_check
  check (aspect_ratio is null or aspect_ratio in ('1:1','3:4','4:3','9:16','2:3'));

create table public.foyer_result_claims (
  id uuid primary key,
  preview_id uuid not null unique,
  series text not null check (series in ('portraits','pets')),
  preset text not null,
  source_image text,
  clean_path text not null,
  locked_path text not null,
  metadata jsonb not null default '{}',
  state text not null default 'staging' check (state in ('staging','ready','adopted','deleting')),
  owner_id uuid references auth.users(id),
  portfolio_id uuid unique references public.portfolios(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  adopted_at timestamptz,
  check ((state = 'adopted' and owner_id is not null and portfolio_id is not null and adopted_at is not null)
    or (state <> 'adopted' and owner_id is null and portfolio_id is null and adopted_at is null))
);
create index foyer_result_claims_expiry on public.foyer_result_claims(expires_at) where state <> 'adopted';
alter table public.foyer_result_claims enable row level security;
revoke all on public.foyer_result_claims from public, anon, authenticated;
grant select, insert, update, delete on public.foyer_result_claims to service_role;

create function public.adopt_foyer_result(p_claim uuid, p_user uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.foyer_result_claims%rowtype; pf uuid := gen_random_uuid(); identity_key text;
begin
  if p_user is null or not exists(select 1 from auth.users where id = p_user) then
    raise exception 'foyer_owner_required';
  end if;
  select * into c from public.foyer_result_claims where id = p_claim for update;
  if not found then raise exception 'foyer_claim_not_found'; end if;
  if c.state = 'adopted' then
    if c.owner_id <> p_user then raise exception 'foyer_claim_owner_mismatch'; end if;
    return c.portfolio_id;
  end if;
  if c.expires_at <= now() then raise exception 'foyer_claim_expired'; end if;
  if c.state <> 'ready' or c.source_image is null then raise exception 'foyer_claim_unavailable'; end if;
  insert into public.portfolios(id,purchase_id,user_id,series,size,status,free_unlocks,source_image,
    composition,delivery,pose,framing,subject,aspect_ratio,origin)
  values(pf,null,p_user,c.series,1,'ready',0,c.source_image,
    jsonb_build_object('foyer',c.metadata || jsonb_build_object('claim_id',c.id),'skip_redirect',true),
    'preview','as_photographed','bust',c.metadata->>'subject','2:3','foyer');
  identity_key := 'portfolio:' || pf::text || ':0';
  insert into public.preview_ledger(id,email,ip_hash,series,preset,resolution,storage_path,unlocked_at)
    values(c.preview_id,identity_key,identity_key,c.series,c.preset,'1k',c.clean_path,null);
  insert into public.portfolio_items(portfolio_id,slot,preset,status,preview_id)
    values(pf,0,c.preset,'done',c.preview_id);
  update public.foyer_result_claims set state='adopted',owner_id=p_user,portfolio_id=pf,
    adopted_at=now(),source_image=null where id=c.id;
  return pf;
end $$;
revoke all on function public.adopt_foyer_result(uuid,uuid) from public,anon,authenticated;
grant execute on function public.adopt_foyer_result(uuid,uuid) to service_role;

-- The deleting tombstone fences adoption before any storage deletion. Failed deletions are retryable.
create function public.claim_expired_foyer_results(p_limit integer default 10)
returns table(id uuid, clean_path text, locked_path text)
language sql security definer set search_path = public, pg_temp as $$
  with expired as (
    select c.id from public.foyer_result_claims c
    where c.state <> 'adopted' and c.expires_at <= now()
    order by c.expires_at limit greatest(1,least(p_limit,20)) for update skip locked
  )
  update public.foyer_result_claims c set state='deleting',source_image=null
    from expired e where c.id=e.id
    returning c.id,c.clean_path,c.locked_path;
$$;
revoke all on function public.claim_expired_foyer_results(integer) from public,anon,authenticated;
grant execute on function public.claim_expired_foyer_results(integer) to service_role;
commit;
