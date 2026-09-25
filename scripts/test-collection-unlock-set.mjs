// Isolated in-memory PostgreSQL only. Pass the installed PGlite entrypoint.
// No Supabase URL, credentials, application server, or customer data is used.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth; create table auth.users(id uuid primary key default gen_random_uuid());
create table skus(id text primary key); insert into skus values('unlock_addon_1');
create table purchases(id uuid primary key default gen_random_uuid(), user_id uuid, sku_id text references skus,
 stripe_session_id text unique, amount_cents integer, status text, stripe_charge_id text unique, paid_at timestamptz);
create table entitlements(id uuid primary key default gen_random_uuid(),purchase_id uuid references purchases,user_id uuid,
 locked_style text,locked_variant text,status text,consumed_at timestamptz,job_id uuid);
create table portfolios(id uuid primary key default gen_random_uuid(),user_id uuid);
create table portfolio_items(portfolio_id uuid references portfolios,slot integer,preview_id uuid,status text);
create table preview_ledger(id uuid primary key default gen_random_uuid(),email text,storage_path text,unlocked_at timestamptz);
`);
await db.exec(readFileSync('supabase/migrations/036_collection_unlock_set.sql','utf8'));
const one = async (sql,args=[]) => (await db.query(sql,args)).rows[0];
async function fixture(count) {
 const {id:user}=await one('insert into auth.users default values returning id');
 const {id:portfolio}=await one('insert into portfolios(user_id) values($1) returning id',[user]);
 for(let i=0;i<count;i++) await add(portfolio,i);
 return {user,portfolio};
}
async function add(portfolio,slot,unlocked=false,storage='clean.png',status='done') {
 const {id}=await one('insert into preview_ledger(email,storage_path,unlocked_at) values($1,$2,$3) returning id',
  [`portfolio:${portfolio}:${slot}`,storage,unlocked?new Date().toISOString():null]);
 await db.query('insert into portfolio_items values($1,$2,$3,$4)',[portfolio,slot,id,status]); return id;
}
const reserve = (user,count,expired=null) => one('select * from reserve_collection_unlock_set($1,$2,$3,$4)',[user,'https://preview.example/discovery',count,expired]);
let checks=0;
for(const [count,rate] of [[10,179],[19,179],[20,159]]) {
 const f=await fixture(count), r=await reserve(f.user,count);
 assert.equal(r.quantity,count); assert.equal(r.rate_cents,rate); assert.equal(r.amount_cents,count*rate);
 assert.equal(new Set(r.preview_ids).size,count); checks++;
}
const small=await fixture(9);
await assert.rejects(()=>reserve(small.user,9),/collection_set_too_small/); checks++;
const f=await fixture(10);
await add(f.portfolio,10,true); await add(f.portfolio,11,false,null); await add(f.portfolio,12,false,'clean.png','generating');
await assert.rejects(()=>reserve(f.user,11),/collection_set_quote_changed/); checks++;
const r=await reserve(f.user,10);
assert.equal(r.quantity,10); checks++;
const later=await add(f.portfolio,13);
const retry=await reserve(f.user,11);
assert.equal(retry.attempt_id,r.attempt_id); assert.deepEqual(retry.preview_ids,r.preview_ids); checks++;
await db.query('select complete_collection_unlock_set($1,$2,$3)',[r.attempt_id,f.user,'session']);
await db.query('select complete_collection_unlock_set($1,$2,$3)',[r.attempt_id,f.user,'session']);
assert.equal((await one("select count(*)::int as n from entitlements where user_id=$1",[f.user])).n,10); checks++;
await assert.rejects(()=>db.query('select fulfill_collection_unlock_set($1,$2,$3)',['session','charge',small.user]),/checkout_missing/); checks++;
// Force a late transaction failure: ownership and payment must remain unchanged.
await db.exec("create function fail_set_fulfillment() returns trigger language plpgsql as $$ begin if new.fulfilled_at is not null then raise exception 'test_rollback'; end if; return new; end $$; create trigger test_fail before update on collection_unlock_sets for each row execute function fail_set_fulfillment();");
await assert.rejects(()=>db.query('select fulfill_collection_unlock_set($1,$2,$3)',['session','charge',f.user]),/test_rollback/);
assert.equal((await one("select status from purchases where stripe_session_id='session'")).status,'pending');
assert.equal((await one('select count(*)::int as n from preview_ledger where id=any($1::uuid[]) and unlocked_at is not null',[r.preview_ids])).n,0); checks++;
await db.exec('drop trigger test_fail on collection_unlock_sets;');
// A piece separately unlocked while checkout is open stays part of the paid set.
await db.query('update preview_ledger set unlocked_at=now() where id=$1',[r.preview_ids[0]]);
await db.query('select fulfill_collection_unlock_set($1,$2,$3)',['session','charge',f.user]);
await db.query('select fulfill_collection_unlock_set($1,$2,$3)',['session','charge',f.user]);
assert.equal((await one('select count(*)::int as n from preview_ledger where id=any($1::uuid[]) and unlocked_at is not null',[r.preview_ids])).n,10);
assert.equal((await one('select unlocked_at from preview_ledger where id=$1',[later])).unlocked_at,null);
assert.equal((await one("select count(*)::int as n from entitlements where user_id=$1 and status='consumed' and locked_style='discovery_unlock_set'",[f.user])).n,10);
assert.equal((await one("select count(*)::int as n from entitlements where user_id=$1 and (status='available' or locked_style='discovery_unlock_credit')",[f.user])).n,0); checks++;
await assert.rejects(()=>db.query('select fulfill_collection_unlock_set($1,$2,$3)',['session','other-charge',f.user]),/purchase_mismatch/); checks++;
const expired=await fixture(10), er=await reserve(expired.user,10);
const rotated=await reserve(expired.user,10,er.attempt_id);
assert.notEqual(rotated.attempt_id,er.attempt_id); checks++;
await db.exec('set role authenticated;');
await assert.rejects(()=>reserve(f.user,10),/permission denied/); checks++;
await db.close();
console.log(`${checks} isolated PostgreSQL transaction checks passed`);
