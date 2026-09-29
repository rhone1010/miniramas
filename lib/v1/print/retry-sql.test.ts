import {it,expect} from 'vitest'
import {createRequire} from 'node:module'
import fs from 'node:fs'
const {PGlite}=createRequire(import.meta.url)('../../../.temp/collection-sql-test/node_modules/@electric-sql/pglite')
it('atomically claims retries, preserves the paid order, deduplicates, and restricts access',async()=>{
 const db=new PGlite()
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table print_orders(id uuid primary key,owner_key text,status text,paid_at timestamptz,stripe_payment_intent text,prodigi_order_id text,placed_at timestamptz,error_message text,items jsonb,retail_total_cents int);
 create table account_flags(owner_key text,fulfilment boolean);
 create table print_order_notifications(order_id uuid,kind text);`)
 await db.exec(fs.readFileSync('supabase/migrations/043_print_fulfillment_retry.next.sql','utf8'))
 const order='10000000-0000-4000-8000-000000000001',user='20000000-0000-4000-8000-000000000001',retry='30000000-0000-4000-8000-000000000001',second='30000000-0000-4000-8000-000000000002'
 await db.query(`insert into print_orders values($1,$2,'error',now(),'pi',null,null,'original failure','[{"size":"8x12"}]',3585)`,[order,user]);await db.query('insert into account_flags values($1,true)',[user])
 const claim=async(id:string)=> (await db.query('select claim_print_fulfillment_retry($1,$2,$3) result',[order,user,id])).rows[0].result
 const first=await claim(retry);expect(first.claimed).toBe(true);expect(first.order.retail_total_cents).toBe(3585)
 expect((await claim(retry)).claimed).toBe(false);await expect(claim(second)).rejects.toThrow('retry_ineligible')
 await db.query("select finish_print_fulfillment_retry($1,$2,'placed',$3)",[retry,user,{prodigi_order_id:'sandbox-id'}])
 const row=(await db.query('select * from print_orders where id=$1',[order])).rows[0];expect(row.status).toBe('placed');expect(row.items).toEqual([{size:'8x12'}]);expect(row.retail_total_cents).toBe(3585)
 expect((await claim(retry)).status).toBe('placed');await expect(claim(second)).rejects.toThrow('retry_ineligible')
 const perms=(await db.query("select has_function_privilege('anon','claim_print_fulfillment_retry(uuid,uuid,uuid)','execute') anon,has_function_privilege('service_role','claim_print_fulfillment_retry(uuid,uuid,uuid)','execute') service")).rows[0];expect(perms).toEqual({anon:false,service:true})
 await db.query("update print_orders set status='error',prodigi_order_id=null,placed_at=null where id=$1",[order]);await db.query("insert into print_order_notifications values($1,'refunded')",[order]);await expect(claim(second)).rejects.toThrow('retry_refunded')
 }finally{await db.close()}
})
