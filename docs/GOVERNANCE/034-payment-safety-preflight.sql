-- READ-ONLY PREFLIGHT for revised 034, 2026-09-21.
-- Run the entire file. It does not apply migrations or call payment RPCs.
-- Results are catalog result sets plus data-check counts in Messages/Notices.
-- Missing relations/columns produce warnings, not a missing-regclass failure.
-- Any warning, unexpected privilege, collision or anomaly requires review.
-- Clean results do NOT establish Stripe mode or prove runtime concurrency.
begin read only;
set local statement_timeout = '30s';
set local lock_timeout = '3s';

select current_database(), current_user, version();
select version, name from supabase_migrations.schema_migrations order by version;

select name, to_regclass(name) as actual_relation
from (values
  ('auth.users'), ('public.skus'), ('public.purchases'),
  ('public.entitlements'), ('public.preview_ledger'),
  ('public.portfolios'), ('public.portfolio_items'),
  ('public.collection_pieces'), ('public.generation_grants'),
  ('public.discovery_unlock_checkouts')
) as required(name);

select to_regprocedure('gen_random_uuid()') as uuid_function;

-- Mandatory column inventory. Every row should say PRESENT.
-- Review actual types/defaults below; existence alone is insufficient.
with required(table_schema, table_name, column_name) as (values
  ('auth','users','id'),
  ('public','skus','id'),
  ('public','purchases','id'), ('public','purchases','user_id'),
  ('public','purchases','sku_id'), ('public','purchases','stripe_session_id'),
  ('public','purchases','amount_cents'), ('public','purchases','status'),
  ('public','entitlements','id'), ('public','entitlements','purchase_id'),
  ('public','entitlements','user_id'), ('public','entitlements','guest_email'),
  ('public','entitlements','locked_style'), ('public','entitlements','locked_variant'),
  ('public','entitlements','status'),
  ('public','preview_ledger','id'), ('public','preview_ledger','unlocked_at'),
  ('public','portfolios','id'), ('public','portfolios','purchase_id'),
  ('public','portfolios','user_id'), ('public','portfolios','free_unlocks'),
  ('public','portfolios','status'),
  ('public','portfolio_items','portfolio_id'), ('public','portfolio_items','preview_id'),
  ('public','portfolio_items','status')
)
select r.*, case when c.column_name is null then 'MISSING' else 'PRESENT' end as result,
       c.udt_name, c.is_nullable, c.column_default
from required r left join information_schema.columns c using(table_schema,table_name,column_name)
order by r.table_schema,r.table_name,r.column_name;

-- Includes additional mandatory columns that could reject the RPC INSERTs.
select table_schema,table_name,column_name,udt_name,is_nullable,column_default
from information_schema.columns
where table_schema = 'public' and table_name in (
  'purchases','entitlements','preview_ledger','portfolios','portfolio_items',
  'collection_pieces','discovery_unlock_checkouts'
)
order by table_name,ordinal_position;

-- Check UUID keys/defaults, paid/pending/available/generating status support,
-- unique purchase session IDs, and unique portfolio purchase IDs.
select n.nspname,c.relname,k.conname,k.contype,k.convalidated,
       pg_get_constraintdef(k.oid) as definition
from pg_constraint k join pg_class c on c.oid=k.conrelid
join pg_namespace n on n.oid=c.relnamespace
where (n.nspname='auth' and c.relname='users')
   or (n.nspname='public' and c.relname in (
     'purchases','entitlements','preview_ledger','portfolios',
     'portfolio_items','discovery_unlock_checkouts'
   ))
order by n.nspname,c.relname,k.conname;

select schemaname,tablename,indexname,indexdef from pg_indexes
where schemaname='public' and tablename in (
  'purchases','entitlements','portfolios','portfolio_items','discovery_unlock_checkouts'
)
order by tablename,indexname;

-- Zero function collisions expected. The table above must also be absent.
select p.oid::regprocedure as signature,pg_get_userbyid(p.proowner) as owner,
       p.prosecdef,p.proconfig,p.proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'reserve_discovery_unlock','complete_discovery_unlock_checkout',
  'activate_discovery_portfolio','guard_discovery_included_unlock_insert'
);

-- Review ALL existing user triggers for interactions/order. No trigger with
-- the new name discovery_included_unlock_insert_guard may already exist.
select n.nspname,c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid) as definition
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal
  and ((n.nspname='public' and c.relname in ('entitlements','portfolios','preview_ledger','purchases'))
    or (n.nspname='auth' and c.relname='users'))
order by n.nspname,c.relname,t.tgname;

select rolname,rolcanlogin,rolbypassrls,
       has_schema_privilege(rolname,'public','CREATE') as can_create_in_public
from pg_roles where rolname in ('anon','authenticated','service_role');

-- Review defaults for unintended grants to any additional roles.
select pg_get_userbyid(defaclrole) as owner,defaclnamespace::regnamespace as schema_name,
       defaclobjtype,defaclacl
from pg_default_acl;

-- The migration executor needs ownership/DDL authority; service_role itself
-- does not need CREATE to call the installed RPCs.
select n.nspname,c.relname,pg_get_userbyid(c.relowner) as owner,
       c.relrowsecurity,c.relforcerowsecurity,c.relacl
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where (n.nspname='auth' and c.relname='users')
   or (n.nspname='public' and c.relname in (
     'entitlements','portfolios','preview_ledger','purchases','discovery_unlock_checkouts'
   ));

-- Read-only dynamic queries prevent absent prerequisites from causing 42P01.
do $$
declare missing integer; n bigint; catalog jsonb;
begin
  select count(*) into missing from (values
    ('portfolios','id'),('portfolios','purchase_id'),('portfolios','user_id'),
    ('portfolios','free_unlocks'),('portfolios','status'),
    ('entitlements','id'),('entitlements','purchase_id'),('entitlements','user_id'),
    ('entitlements','status')
  ) r(tbl,col)
  where not exists(select 1 from information_schema.columns c
    where c.table_schema='public' and c.table_name=r.tbl and c.column_name=r.col);
  if missing > 0 then
    raise warning 'BLOCKER: % data-check columns missing. Portfolio/entitlement checks skipped.',missing;
  else
    execute 'select count(*) from public.portfolios where free_unlocks is null or free_unlocks < 0' into n;
    raise notice 'invalid_allowances = % (expected 0)',n;
    execute 'select count(*) from (select purchase_id from public.portfolios group by purchase_id having count(*) > 1) d' into n;
    raise notice 'duplicate_portfolio_purchase_bindings = % (expected 0)',n;
    execute $q$
      select count(*) from public.portfolios p
      where (select count(*) from public.entitlements e where e.purchase_id=p.purchase_id) > p.free_unlocks
    $q$ into n;
    raise notice 'portfolios_with_excess_entitlements = % (expected 0; no automatic repair)',n;
    execute $q$
      select count(*) from public.entitlements e join public.portfolios p on p.purchase_id=e.purchase_id
      where e.user_id is distinct from p.user_id
    $q$ into n;
    raise notice 'portfolio_entitlement_owner_mismatches = % (expected 0)',n;
    execute $q$
      select count(*) from public.entitlements e join public.portfolios p on p.purchase_id=e.purchase_id
      where p.status='pending' and e.status not in ('available','consumed')
    $q$ into n;
    raise notice 'pending_portfolio_entitlements_in_other_states = % (review if nonzero)',n;
    execute $q$
      select count(*) from public.portfolios p where p.status='pending'
      and (select count(*) from public.entitlements e where e.purchase_id=p.purchase_id) between 1 and p.free_unlocks
    $q$ into n;
    raise notice 'pending_portfolios_with_existing_included_entitlements = % (legacy retry cases; review)',n;
  end if;

  select count(*) into missing from (values
    ('id'),('count'),('price_cents'),('stripe_price_id'),('active')
  ) r(col) where not exists(select 1 from information_schema.columns c
    where c.table_schema='public' and c.table_name='skus' and c.column_name=r.col);
  if missing > 0 then
    raise warning 'BLOCKER: SKU schema incomplete. Catalog check skipped.';
  else
    execute $q$
      select jsonb_agg(to_jsonb(s) order by s.id) from (
        select id,count,price_cents,stripe_price_id,active from public.skus
        where id in ('single','basket_discover_5','basket_discover_10','basket_discover_20','unlock_addon_1')
      ) s
    $q$ into catalog;
    raise notice 'Existing SKU mappings (not proof of Stripe live/test mode): %',catalog;
  end if;

  if to_regclass('public.discovery_unlock_checkouts') is not null then
    raise warning 'BLOCKER: discovery_unlock_checkouts already exists. 034 is not re-runnable; inspect, do not overwrite.';
  end if;
end $$;

-- Installation adds FK locks on parent tables and a trigger DDL lock on
-- entitlements. Observe contention immediately before any authorized run.
select n.nspname,c.relname,l.pid,l.mode,l.granted,pg_blocking_pids(l.pid) as blocked_by
from pg_locks l join pg_class c on c.oid=l.relation
join pg_namespace n on n.oid=c.relnamespace
where (n.nspname='auth' and c.relname='users')
   or (n.nspname='public' and c.relname in ('preview_ledger','purchases','entitlements','portfolios'))
order by n.nspname,c.relname,l.pid;

commit;
