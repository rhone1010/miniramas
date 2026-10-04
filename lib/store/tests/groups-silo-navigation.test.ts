import {describe,it,expect} from 'vitest'
import {readFileSync,existsSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
const {JSDOM}=require('jsdom')
const html=readFileSync('public/groups.html','utf8')
const registry:any={window:{}};runInNewContext(readFileSync('public/groups-registry.js','utf8'),registry);const R=registry.window.GROUPS_REGISTRY
function setup(){
 const document=new JSDOM(html.replace(/<style[\s\S]*?<\/style>/g,'').replace(/<script[\s\S]*?<\/script>/g,'')).window.document
 const pending:Array<()=>void>=[]
 const c:any={document,R,esc:(x:string)=>x,QUEUE:['keep'],GROUPS_TARGET:8,GROUPS_FLOOR_SILO:null,CURATED_BUSY:false,GROUPS_REVIEW:false,UPSELL_CTX:null,curatedPageNav:null,workshop:document.getElementById('workshop'),crumbHere:document.getElementById('crumbHere'),effFloor:document.getElementById('effectFloor'),clearGroupsMode:()=>{},paintGroupsModeControl:()=>{},siloLabel:(id:string)=>R.silos.find((s:any)=>s.id===id).label,siloList:(id:string)=>R.effects.filter((e:any)=>e.category===id),paintCuratedCards:(ids:string[])=>ids}
 c.curatedTurn=(_:any,ids:string[])=>new Promise<void>(resolve=>pending.push(()=>{c.effFloor.innerHTML=ids.map(id=>'<div data-effect-id="'+id+'"></div>').join('');resolve()}))
 const start=html.indexOf('  var GROUPS_REQUESTED_SILO =');const end=html.indexOf("  document.getElementById('groupsReviewPage1').addEventListener",start);runInNewContext(html.slice(start,end),c);c.paintGroupsRooms()
 return {c,pending,flush:async()=>{pending.shift()!();await Promise.resolve();}}
}
describe('Groups single-click silo browsing',()=>{
 it('all seven use approved existing icons and preserve registry names',()=>{const {c}=setup();for(const silo of R.silos){const b=c.document.querySelector('[data-silo-id="'+silo.id+'"]');expect(b.textContent).toBe(silo.label);expect(existsSync('public'+b.querySelector('img').getAttribute('src'))).toBe(true)}expect(new Set(Object.values(c.GROUPS_SILO_ICONS)).size).toBe(7)})
 it('every silo needs one click and displays exactly its six effects without changing selections/package',async()=>{const {c,flush}=setup();for(const silo of R.silos){c.document.querySelector('[data-silo-id="'+silo.id+'"]').click();await flush();expect(Array.from(c.effFloor.children).map((e:any)=>e.dataset.effectId)).toEqual(R.effects.filter((e:any)=>e.category===silo.id).map((e:any)=>e.id));expect(c.effFloor.children.length).toBe(6);expect(c.document.querySelector('[aria-pressed="true"]').dataset.siloId).toBe(silo.id);expect(c.QUEUE).toEqual(['keep']);expect(c.GROUPS_TARGET).toBe(8)}})
 it('retains a first click made during an unfinished turn, instead of dropping it',async()=>{const {c,flush,pending}=setup();c.showGroupsSilo(R.silos[0].id);c.showGroupsSilo(R.silos[1].id);expect(pending.length).toBe(1);await flush();expect(pending.length).toBe(1);await flush();expect(c.GROUPS_FLOOR_SILO).toBe(R.silos[1].id);expect(c.CURATED_BUSY).toBe(false);expect(c.QUEUE).toEqual(['keep'])})
 it('removes mode entrances and places Explore Styles before Pick and rewards',()=>{const {c}=setup(),d=c.document;expect(d.getElementById('curAllFxBtn')).toBe(null);expect(d.getElementById('curatedPageNav')).toBe(null);expect(d.getElementById('groupsExplore').textContent).toContain('Explore Styles');expect(d.getElementById('groupsExplore').compareDocumentPosition(d.getElementById('curPick4Btn'))&4).toBe(4);expect(d.getElementById('curPick4Btn').compareDocumentPosition(d.getElementById('groupsPackageInfo'))&4).toBe(4)})
})
