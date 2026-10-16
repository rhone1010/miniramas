-- gift-047-048-preflight.sql
--
-- ONE READ-ONLY STATEMENT. Paste the whole thing into the Supabase SQL Editor (project dqctwzertbujhsjatfyv) and run it ONCE
-- BEFORE applying migration 047, and again BEFORE applying 048 (after 047). It changes nothing: it only reads catalog views
-- and counts rows. It returns one grid: check | result | detail.
--
--   PASS  the requirement is met
--   FAIL  stop: do not apply the migration until this is resolved (the detail says what)
--   NOTE  information to read, not a blocker (for example "already applied")
--
-- It checks what 047 and 048 depend on: the live tables that are NOT defined in this repository's migrations (print_orders,
-- portfolios, portfolio_items, preview_ledger), their column types, nullability against the INSERTs the migrations make,
-- the check constraints they would run into, the enum, the service role's privileges, the storage bucket, and the migration role.
--
-- If this statement itself ERRORS (for example `column "origin" does not exist`), that is a FAIL too: tell me the message.

with
-- ── what the migrations read or write: table, column, accepted data types ─────────────────────────────────────────────
need(tbl, col, types) as (values
  ('print_orders', 'id', 'uuid'), ('print_orders', 'status', 'USER-DEFINED'), ('print_orders', 'stripe_session_id', 'text|character varying'),
  ('print_orders', 'stripe_payment_intent', 'text|character varying'), ('print_orders', 'paid_at', 'timestamp with time zone'),
  ('print_orders', 'placed_at', 'timestamp with time zone'), ('print_orders', 'prodigi_order_id', 'text|character varying'),
  ('print_orders', 'retail_total_cents', 'integer|bigint'), ('print_orders', 'retail_shipping_cents', 'integer|bigint'),
  ('print_orders', 'customer_email', 'text|character varying'), ('print_orders', 'items', 'jsonb|json'), ('print_orders', 'updated_at', 'timestamp with time zone'),
  ('portfolios', 'id', 'uuid'), ('portfolios', 'purchase_id', 'uuid'), ('portfolios', 'user_id', 'uuid'), ('portfolios', 'series', 'text|character varying'),
  ('portfolios', 'size', 'integer|smallint|bigint'), ('portfolios', 'status', 'text|character varying'), ('portfolios', 'free_unlocks', 'integer|smallint|bigint'),
  ('portfolios', 'source_image', 'text|character varying'), ('portfolios', 'composition', 'jsonb|json'), ('portfolios', 'delivery', 'text|character varying'),
  ('portfolios', 'pose', 'text|character varying'), ('portfolios', 'framing', 'text|character varying'), ('portfolios', 'subject', 'text|character varying'),
  ('portfolios', 'aspect_ratio', 'text|character varying'), ('portfolios', 'origin', 'text|character varying'),
  ('portfolio_items', 'portfolio_id', 'uuid'), ('portfolio_items', 'slot', 'integer|smallint|bigint'), ('portfolio_items', 'preset', 'text|character varying'),
  ('portfolio_items', 'status', 'text|character varying'), ('portfolio_items', 'preview_id', 'uuid'),
  ('preview_ledger', 'id', 'uuid'), ('preview_ledger', 'email', 'text|character varying'), ('preview_ledger', 'ip_hash', 'text|character varying'),
  ('preview_ledger', 'series', 'text|character varying'), ('preview_ledger', 'preset', 'text|character varying'), ('preview_ledger', 'resolution', 'text|character varying'),
  ('preview_ledger', 'storage_path', 'text|character varying'), ('preview_ledger', 'unlocked_at', 'timestamp with time zone'),
  ('print_asset_jobs', 'source_kind', 'text|character varying')),
-- ── the columns 048's INSERT statements supply, per table (anything else that is NOT NULL without a default would break the insert) ──
supplied(tbl, col) as (values
  ('portfolios', 'id'), ('portfolios', 'purchase_id'), ('portfolios', 'user_id'), ('portfolios', 'series'), ('portfolios', 'size'), ('portfolios', 'status'),
  ('portfolios', 'free_unlocks'), ('portfolios', 'source_image'), ('portfolios', 'composition'), ('portfolios', 'delivery'), ('portfolios', 'pose'),
  ('portfolios', 'framing'), ('portfolios', 'subject'), ('portfolios', 'aspect_ratio'), ('portfolios', 'origin'),
  ('portfolio_items', 'portfolio_id'), ('portfolio_items', 'slot'), ('portfolio_items', 'preset'), ('portfolio_items', 'status'), ('portfolio_items', 'preview_id'),
  ('preview_ledger', 'id'), ('preview_ledger', 'email'), ('preview_ledger', 'ip_hash'), ('preview_ledger', 'series'), ('preview_ledger', 'preset'),
  ('preview_ledger', 'resolution'), ('preview_ledger', 'storage_path'), ('preview_ledger', 'unlocked_at')),
-- ── values the live check constraints must allow (a constraint that exists and lacks the value would reject 048's insert) ──
must_allow(tbl, name_like, literal, why) as (values
  ('portfolios', '%series%', 'groups', 'a gift piece in a Groups session has series groups'),
  ('portfolios', '%delivery%', 'preview', 'a gift piece is inserted with delivery preview'),
  ('portfolios', '%status%', 'ready', 'a gift piece is inserted with status ready'),
  ('portfolios', '%aspect%', '3:2', 'Groups masters can be 3:2'),
  ('portfolios', '%aspect%', '2:3', 'Pets and small Groups masters are 2:3'),
  ('portfolios', '%aspect%', '1:1', 'Portraits masters are 1:1'),
  ('portfolio_items', '%status%', 'done', 'the adopted piece is inserted with status done'),
  ('preview_ledger', '%series%', 'groups', 'a Groups preview is recorded with series groups')),
checks(ord, check_name, result, detail) as (

  -- ═══ A. the database and the role that will run the migrations ═══
  select 10, 'Postgres 12 or newer', case when current_setting('server_version_num')::int >= 120000 then 'PASS' else 'FAIL' end, current_setting('server_version')
  union all
  select 11, 'service_role exists', case when exists (select 1 from pg_roles where rolname = 'service_role') then 'PASS' else 'FAIL' end, ''
  union all
  select 12, 'service_role can use schema public', case when has_schema_privilege('service_role', 'public', 'usage') then 'PASS' else 'FAIL' end, ''
  union all
  select 13, 'gen_random_uuid() works', case when gen_random_uuid() is not null then 'PASS' else 'FAIL' end, ''
  union all
  select 14, 'this role owns (or is a member of the owner of) what the migrations alter',
    case when (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                where n.nspname = 'public' and c.relname in ('print_orders', 'portfolios', 'print_asset_jobs') and not pg_has_role(current_user, c.relowner, 'member')) = 0
          and (select count(*) from pg_type t where t.typname = 'print_order_status' and not pg_has_role(current_user, t.typowner, 'member')) = 0
         then 'PASS' else 'FAIL: run the migrations as the table owner (usually postgres)' end,
    'current_user = ' || current_user

  -- ═══ B. prerequisites: migration 046 and the live tables exist ═══
  union all
  select 20, 'live tables exist: ' || t, case when to_regclass('public.' || t) is not null then 'PASS' else 'FAIL: missing table' end, ''
    from unnest(array['print_orders', 'portfolios', 'portfolio_items', 'preview_ledger']) t
  union all
  select 21, 'migration 046 applied (print_asset_jobs, print_upscale_settings)', case when to_regclass('public.print_asset_jobs') is not null and to_regclass('public.print_upscale_settings') is not null then 'PASS' else 'FAIL: apply 046 first' end, ''
  union all
  select 22, 'print_order_status has the labels the migrations compare against',
    case when (select count(*) from pg_enum e join pg_type t on t.oid = e.enumtypid
                where t.typname = 'print_order_status' and e.enumlabel in ('created', 'paid', 'placed', 'in_production', 'shipped', 'delivered', 'cancelled', 'error', 'withheld')) = 9
         then 'PASS' else 'FAIL: a label is missing (withheld comes from 046)' end,
    coalesce((select string_agg(e.enumlabel, ', ' order by e.enumsortorder) from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'print_order_status'), 'type not found')

  -- ═══ C. every column 047 and 048 read or write: it exists with a compatible type ═══
  union all
  select 30, 'column ' || n.tbl || '.' || n.col,
    case when c.column_name is null then 'FAIL: column missing'
         when c.data_type = any (string_to_array(n.types, '|')) then 'PASS'
         else 'FAIL: type is ' || c.data_type || ', expected ' || replace(n.types, '|', ' or ') end,
    coalesce(c.data_type, '')
    from need n left join information_schema.columns c on c.table_schema = 'public' and c.table_name = n.tbl and c.column_name = n.col

  -- ═══ D. 048's inserts must not hit a NOT NULL column they do not supply ═══
  union all
  select 40, 'insert-compatible: ' || t.tbl,
    case when count(c.column_name) = 0 then 'PASS' else 'FAIL: NOT NULL without default and not supplied by 048: ' || string_agg(c.column_name, ', ') end, ''
    from (select distinct tbl from supplied) t
    left join information_schema.columns c on c.table_schema = 'public' and c.table_name = t.tbl and c.is_nullable = 'NO' and c.column_default is null
         and coalesce(c.is_identity, 'NO') = 'NO' and coalesce(c.is_generated, 'NEVER') = 'NEVER'
         and not exists (select 1 from supplied s where s.tbl = t.tbl and s.col = c.column_name)
    group by t.tbl

  -- ═══ E. live check constraints that 048's inserts would run into ═══
  union all
  select 50, 'constraint on ' || m.tbl || ' (' || m.name_like || ') allows ' || m.literal,
    case when not exists (select 1 from pg_constraint k where k.conrelid = ('public.' || m.tbl)::regclass and k.contype = 'c' and k.conname ilike m.name_like) then 'PASS'
         when exists (select 1 from pg_constraint k where k.conrelid = ('public.' || m.tbl)::regclass and k.contype = 'c' and k.conname ilike m.name_like
                        and pg_get_constraintdef(k.oid) not ilike '%' || m.literal || '%') then 'FAIL: ' || m.why
         else 'PASS' end,
    coalesce((select string_agg(k.conname || ': ' || pg_get_constraintdef(k.oid), ' | ') from pg_constraint k
               where k.conrelid = ('public.' || m.tbl)::regclass and k.contype = 'c' and k.conname ilike m.name_like), 'no such constraint')
    from must_allow m
  union all
  select 51, 'portfolios_origin_purchase_check (048 replaces it with a superset that adds origin gift)',
    case when exists (select 1 from pg_constraint where conname = 'portfolios_origin_purchase_check') then 'PASS' else 'NOTE: not present; 048 adds it' end,
    coalesce((select pg_get_constraintdef(oid) from pg_constraint where conname = 'portfolios_origin_purchase_check' limit 1), '')
  union all
  select 52, 'no existing portfolio would violate 048''s new origin check',
    case when exists (select 1 from public.portfolios where not (
           (origin = 'discovery' and purchase_id is not null)
           or (origin = 'foyer' and purchase_id is null and series in ('portraits', 'pets') and size = 1 and delivery = 'preview' and free_unlocks = 0)
           or (origin = 'gift' and purchase_id is null and series in ('portraits', 'pets', 'groups') and size = 1 and delivery = 'preview' and free_unlocks = 0)))
         then 'FAIL: some portfolio row would violate it' else 'PASS' end,
    (select count(*)::text || ' portfolios' from public.portfolios)
  union all
  select 53, 'print_asset_jobs source_kind check (048 widens it to owned, url, gift)',
    case when exists (select 1 from pg_constraint where conrelid = 'public.print_asset_jobs'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%source_kind%') then 'PASS' else 'NOTE: no such check; 048 adds one' end,
    coalesce((select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.print_asset_jobs'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%source_kind%' limit 1), '')

  -- ═══ F. triggers that an adopted piece would fire (information only) ═══
  union all
  select 60, 'triggers on ' || c.relname, 'NOTE', coalesce(string_agg(tg.tgname, ', '), 'none')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    left join pg_trigger tg on tg.tgrelid = c.oid and not tg.tgisinternal
   where n.nspname = 'public' and c.relname in ('portfolios', 'portfolio_items', 'preview_ledger', 'print_orders')
   group by c.relname

  -- ═══ G. what the service role can do (the API uses the service role) ═══
  union all
  select 70, 'service_role privileges on ' || t.tbl,
    case when to_regclass('public.' || t.tbl) is null then 'FAIL: missing table'
         when has_table_privilege('service_role', 'public.' || t.tbl, 'select') and has_table_privilege('service_role', 'public.' || t.tbl, 'insert')
          and has_table_privilege('service_role', 'public.' || t.tbl, 'update') then 'PASS' else 'FAIL: needs select, insert and update' end, ''
    from (values ('print_orders'), ('portfolios'), ('portfolio_items'), ('preview_ledger'), ('print_asset_jobs')) as t(tbl)

  -- ═══ H. storage (the previews bucket holds gift sources, masters and previews) ═══
  union all
  select 80, 'private previews bucket exists',
    case when exists (select 1 from storage.buckets where id = 'previews' and public = false) then 'PASS'
         when exists (select 1 from storage.buckets where id = 'previews') then 'FAIL: the bucket is PUBLIC; clean masters must be private' else 'FAIL: no previews bucket' end, ''

  -- ═══ I. which of 047 and 048 are already applied (so you know which to run) ═══
  union all
  select 90, '047 state', 'NOTE',
    case when to_regclass('public.gift_sessions') is null then 'not applied: run 047 next' else 'applied' end
  union all
  select 91, '048 state', 'NOTE',
    case when to_regclass('public.gift_order_lines') is null and not exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'print_order_status' and e.enumlabel = 'awaiting_artwork')
         then 'not applied' else 'applied or partly applied: awaiting_artwork=' ||
              exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'print_order_status' and e.enumlabel = 'awaiting_artwork')::text ||
              ', gift_order_lines=' || (to_regclass('public.gift_order_lines') is not null)::text end
  union all
  select 92, '048 requires 047 first', case when to_regclass('public.gift_sessions') is not null then 'PASS' else 'NOTE: expected before 047; apply 047, then run this again before 048' end, ''
)
select check_name, result, detail from checks order by ord, check_name;
