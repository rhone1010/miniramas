import {describe,it,expect,vi} from 'vitest'
import fs from 'node:fs'
import vm from 'node:vm'
const html=fs.readFileSync('public/portraits.html','utf8')
const code=html.slice(html.indexOf('  var psReceiptOrder=null'),html.indexOf('  function psReceiptPaint(o){'))
function setup(status='paid'){
 let timer:any,requests:string[]=[],updates=0
 const el={querySelector:()=>({set textContent(v:string){updates++}}),querySelectorAll:()=>[{classList:{toggle:vi.fn()}}]}
 const context:any={psReceiptEl:el,psReceiptSay:()=>['status','detail'],document:{hidden:false},window:{addEventListener:vi.fn()},location:{search:'?print=1&session=test'},URLSearchParams,encodeURIComponent,setTimeout:(f:any)=>{timer=f;return 1},clearTimeout:()=>{timer=null},fetch:vi.fn(async(url:string)=>{requests.push(url);return {json:async()=>({ok:true,order:{status,paidAt:'date'}})}})}
 vm.createContext(context);vm.runInContext(code,context);context.psReceiptOrder={status:'paid',items:[{art:'unchanged'}]}
 return {context,requests,tick:async()=>{const f=timer;timer=null;await f?.();await new Promise(r=>setImmediate(r))},hasTimer:()=>!!timer,updates:()=>updates}
}
describe('receipt bounded status polling',()=>{
 it('polls status only, preserves artwork, and stops after 24 attempts',async()=>{const t=setup();t.context.psReceiptSchedule();for(let i=0;i<30&&t.hasTimer();i++)await t.tick();expect(t.requests).toHaveLength(24);expect(t.requests.every(u=>u==='/api/v1/print/order?status_only=1&session=test')).toBe(true);expect(t.context.psReceiptOrder.items[0].art).toBe('unchanged');expect(t.hasTimer()).toBe(false)})
 it.each(['placed','shipped','error','withheld'])('stops at %s',async status=>{const t=setup(status);t.context.psReceiptSchedule();await t.tick();expect(t.requests).toHaveLength(1);expect(t.hasTimer()).toBe(false);expect(t.updates()).toBe(3)})
 it('does not fetch while hidden and still exhausts the bound',async()=>{const t=setup();t.context.document.hidden=true;t.context.psReceiptSchedule();for(let i=0;i<30&&t.hasTimer();i++)await t.tick();expect(t.requests).toHaveLength(0);expect(t.hasTimer()).toBe(false)})
})
