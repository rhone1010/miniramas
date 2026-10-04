import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
const {JSDOM}=require('jsdom')
const html=readFileSync('public/groups.html','utf8')
function fn(text:string,name:string){const start=text.indexOf('function '+name+'(');let at=text.indexOf('{',start),depth=1,end=at+1;for(;depth;end++){if(text[end]==='{')depth++;if(text[end]==='}')depth--}return text.slice(start,end)}
function setup(){
 const doc=new JSDOM(html).window.document
 const ctx:any={document:doc,QUEUE:[],GROUPS_TARGET:0,SLOTS:[],GROUPS_REVIEW:true,GROUPS_REVIEW_PAGE:0,GROUPS_FILL_SLOT:null,SUB_NOTE:null,phoneNeedsPhoto:()=>false,buildPayload:(s:string,e:string)=>({siloId:s,effectId:e}),renderQueue:()=>{},effFloor:doc.getElementById('effectFloor'),R:{byId:(id:string)=>({id})},effectCard:(_:string,e:any)=>{const d=doc.createElement('div');d.dataset.effectId=e.id;return d},showGroupsDiscovery:()=>{},inQueue:(s:string,e:string)=>ctx.QUEUE.some((q:any)=>q.siloId===s&&q.effectId===e),validCollection:()=>[1,4,8,16].includes(ctx.QUEUE.length)}
 for(const name of ['keyOf','targetFor','targetBundle','addToQueue','selectedReviewItems','lockTier','reviewItems','renderGroupsReview'])runInNewContext(fn(html,name),ctx)
 return ctx
}
describe('Groups acceptance correction handlers',()=>{
 it('manual selection crosses every milestone without losing choices and stops at sixteen',()=>{const c=setup();for(let n=1;n<=16;n++){expect(c.addToQueue('s','e'+n)).toBe(true);expect(c.QUEUE.map((q:any)=>q.effectId)).toEqual(Array.from({length:n},(_,i)=>'e'+(i+1)));expect(c.targetBundle()).toBe(n===1?1:n<=4?4:n<=8?8:16);expect(c.validCollection()).toBe([1,4,8,16].includes(n))}expect(c.addToQueue('s','extra')).toBe(false)})
 for(const n of [1,4,8,9,16])it('Review '+n+' retains order and eight-slot geometry per page',()=>{const c=setup();for(let i=0;i<n;i++)c.addToQueue('s','e'+i);c.renderGroupsReview();const before=JSON.stringify(c.QUEUE);expect(c.effFloor.children.length).toBe(Math.min(8,c.targetBundle()));expect(c.document.getElementById('groupsReviewCraft').disabled).toBe(![1,4,8,16].includes(n));if(n>8){c.GROUPS_REVIEW_PAGE=1;c.renderGroupsReview();expect(c.effFloor.children.length).toBe(8);expect(c.effFloor.children[0].dataset.effectId).toBe('e8');if(n===9){c.effFloor.children[1].click();expect(c.GROUPS_FILL_SLOT).toBe(9)}c.GROUPS_REVIEW_PAGE=0;c.renderGroupsReview();expect(c.effFloor.children[0].dataset.effectId).toBe('e0')}expect(JSON.stringify(c.QUEUE)).toBe(before)})
 it('forward controls are beneath their grids and absent from the rail',()=>{const d=setup().document;expect(d.querySelector('#cur #groupsShapeCraft')).toBe(null);expect(d.querySelector('#groupsShapes #groupsShapeCraft')).not.toBe(null);expect(d.querySelector('#groupsReviewActions #groupsReviewCraft')).toBe(null);expect(d.querySelector('#groupsReviewFooter #groupsReviewCraft')).not.toBe(null)})
})
describe('Pick regression against the existing handler',()=>{
 for(const capacity of [4,8,16])it('fills '+capacity+' without replacing manual choices',()=>{
 const c=setup();c.GROUPS_REVIEW=false;c.GROUPS_TARGET=capacity;c.addToQueue('s','manual');
 const effects=Array.from({length:42},(_,i)=>({id:'e'+i,category:'s'}));
 Object.assign(c,{CURATED_BUSY:false,CURATED_MODE:null,CURATED_PAGE:0,CURATED_PAGE_SIZE:6,GROUPS_PICK_ACTIVE:false,hasSource:()=>true,R:{silos:[{id:'s'}],byId:(id:string)=>({id,category:'s'})},siloList:()=>effects,shuffled:(x:any)=>x,paintCollectionProgress:()=>{},paintGroupsModeControl:()=>{},dismissGroupsPick:()=>{c.GROUPS_PICK_ACTIVE=false},curatedReveal:(_:any,__:any,done:()=>void)=>done(),curPick4Btn:null,curCuratedBtn:null,curAllFxBtn:null,curReviewBtn:null,curatedPageNav:null,crumbHere:{},workshop:c.document.getElementById('workshop')});c.workshop.classList.add('workshop-view--effects');c.workshop.classList.remove('workshop-view--silos');
 runInNewContext(fn(html,'openCurated'),c);c.openCurated('pick4');expect(c.QUEUE.length).toBe(capacity);expect(c.QUEUE[0].effectId).toBe('manual');expect(new Set(c.QUEUE.map((q:any)=>q.effectId)).size).toBe(capacity);c.openCurated('pick4');expect(c.QUEUE.length).toBe(capacity)
 })
})

describe('Review replacement on both pages',()=>{
 it.each([2,10])('returns to the same page after replacing slot %s',slot=>{
 const c=setup();for(let i=0;i<16;i++)c.addToQueue('s','e'+i);c.reviewItems();
 Object.assign(c,{hasSource:()=>true,showGroupsDiscovery:()=>{c.GROUPS_REVIEW=false},showGroupsReview:()=>{c.GROUPS_FILL_SLOT=null;c.GROUPS_REVIEW=true;c.renderGroupsReview()}});
 runInNewContext(fn(html,'removeFromQueue'),c);c.removeFromQueue('s','e'+slot);c.GROUPS_REVIEW_PAGE=slot<8?0:1;c.renderGroupsReview();
 const start=html.indexOf("  if (effFloor) effFloor.addEventListener('click', function(e){");const end=html.indexOf("  if (effFloor) effFloor.addEventListener('keydown'",start);runInNewContext(html.slice(start,end),c);
 c.effFloor.querySelector('.groups-review-slot').click();expect(c.GROUPS_FILL_SLOT).toBe(slot);
 const choice=c.document.createElement('div');choice.className='silo-card';choice.dataset.siloId='s';choice.dataset.effectId='replacement';c.effFloor.appendChild(choice);choice.click();
 expect(c.GROUPS_REVIEW).toBe(true);expect(c.GROUPS_REVIEW_PAGE).toBe(slot<8?0:1);expect(c.reviewItems().map((i:any)=>i.effectId)).toEqual(Array.from({length:16},(_,i)=>i===slot?'replacement':'e'+i));
 })
})
