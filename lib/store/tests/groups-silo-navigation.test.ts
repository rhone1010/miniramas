import {describe,it,expect} from 'vitest'
import {readFileSync,existsSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
const {JSDOM}=require('jsdom')
const html=readFileSync('public/groups.html','utf8')
const registry:any={window:{}};runInNewContext(readFileSync('public/groups-registry.js','utf8'),registry);const R=registry.window.GROUPS_REGISTRY
function setup(){
 const document=new JSDOM(html.replace(/<style[\s\S]*?<\/style>/g,'').replace(/<script[\s\S]*?<\/script>/g,'')).window.document
 const c:any={document,R,esc:(x:string)=>x,QUEUE:['keep'],GROUPS_TARGET:8,GROUPS_FLOOR_SILO:null,CURATED_BUSY:false,GROUPS_REVIEW:false,GROUPS_PICK_ACTIVE:false,UPSELL_CTX:null,crumbHere:document.getElementById('crumbHere'),effFloor:document.getElementById('effectFloor'),siloLabel:(id:string)=>R.silos.find((s:any)=>s.id===id).label,siloList:(id:string)=>R.effects.filter((e:any)=>e.category===id),inQueue:(_:string,id:string)=>id===R.effects[0].id,effectCard:(siloId:string,e:any)=>{const el=document.createElement('article');el.dataset.siloId=siloId;el.dataset.effectId=e.id;el.scrollIntoView=()=>{c.scrolledTo=e.id};return el}}
 const start=html.indexOf('  var GROUPS_SILO_ICONS =');const end=html.indexOf("  document.getElementById('groupsReviewPage1').addEventListener",start);runInNewContext(html.slice(start,end),c);c.paintGroupsRooms();c.paintGroupsCatalog();return c
}
describe('Groups continuous catalog browsing',()=>{
 it('reuses seven tracked icons without renaming silos',()=>{const c=setup();for(const silo of R.silos){const b=c.document.querySelector('[data-silo-id="'+silo.id+'"]');expect(b.textContent).toBe(silo.label);expect(existsSync('public'+b.querySelector('img').getAttribute('src'))).toBe(true)}})
 it('renders all 42 effects in registry silo order and keeps selected state',()=>{const c=setup();expect(Array.from(c.effFloor.children).map((e:any)=>e.dataset.effectId)).toEqual(R.silos.flatMap((s:any)=>R.effects.filter((e:any)=>e.category===s.id).map((e:any)=>e.id)));expect(c.effFloor.children.length).toBe(42);expect(c.effFloor.children[0].classList.contains('is-selected')).toBe(true)})
 it('each silo jumps on one click without replacing cards, selections or package',()=>{const c=setup(),first=c.effFloor.firstChild;for(const silo of R.silos){c.document.querySelector('#groupsRoomMap [data-silo-id="'+silo.id+'"]').click();expect(c.scrolledTo).toBe(R.effects.find((e:any)=>e.category===silo.id).id);expect(c.effFloor.firstChild).toBe(first);expect(c.document.querySelector('[aria-pressed="true"]').dataset.siloId).toBe(silo.id);expect(c.QUEUE).toEqual(['keep']);expect(c.GROUPS_TARGET).toBe(8)}})
 it('has no removed mode or journey controls',()=>{const c=setup();for(const id of ['curAllFxBtn','curatedPageNav','groupsJourney'])expect(c.document.getElementById(id)).toBe(null)})
})
