import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
const {JSDOM}=require('jsdom')
const html=readFileSync('public/groups.html','utf8')
const source=html.slice(html.indexOf('  var ASPECT = null;'),html.indexOf('  function showGroupsReview(){'))
function setup(count:number){
 const dom=new JSDOM(html)
 let crafts=0, reviews=0
 const ctx:any={document:dom.window.document,SRC:{subjectCount:count},QUEUE:['a','b','c','d'],BLOCKS:[],targetBundle:()=>4,reviewItems:()=>[],effectLabel:(id:string)=>id,guardCollection:()=>true,paintGroupsModeControl:()=>{},loadBlocks:()=>Promise.resolve([]),saveResume:()=>{},tbcGo:{click:()=>crafts++},showGroupsReview:()=>{reviews++;dom.window.document.getElementById('groupsShapes').hidden=true}}
 runInNewContext(source,ctx)
 return {ctx,doc:dom.window.document,crafts:()=>crafts,reviews:()=>reviews}
}
describe('Groups Shapes actual browser handlers',()=>{
 for(const [count,allowed] of [[3,['2:3','1:1','9:16']],[4,['4:3','3:2','16:9','2:3','1:1']],[6,['4:3','3:2','16:9','2:3','1:1']],[7,['4:3','3:2','16:9']],[8,['4:3','3:2','16:9']],[10,['4:3','3:2','16:9']]] as const){
 it(`${count} people: six visible, eligible unselected, explicit choice required`,()=>{
 const {ctx,doc,crafts}=setup(count);ctx.showAspect()
 const cards=Array.from(doc.querySelectorAll('#aspectRow button')) as any[]
 expect(cards).toHaveLength(6)
 expect(cards.filter(b=>!b.disabled).map(b=>b.dataset.aspect)).toEqual(allowed)
 expect(doc.querySelectorAll('.aspect-opt.is-chosen').length).toBe(0)
 expect(doc.getElementById('groupsShapeCraft').disabled).toBe(true)
 doc.getElementById('groupsShapeCraft').click();expect(crafts()).toBe(0)
 cards.find(b=>!b.disabled).click()
 expect(doc.querySelectorAll('.aspect-opt.is-chosen').length).toBe(1)
 expect(doc.getElementById('groupsShapeCraft').disabled).toBe(false)
 doc.getElementById('groupsShapeCraft').click();expect(crafts()).toBe(1)
 const selected=ctx.ASPECT;cards.find(b=>b.disabled)?.click();expect(ctx.ASPECT).toBe(selected)
 ctx.showAspect();expect(ctx.ASPECT).toBe(null);expect(doc.getElementById('groupsShapeCraft').disabled).toBe(true)
 })
 }
 it('Back preserves source and selections',()=>{
 const {ctx,doc,reviews}=setup(4);ctx.showAspect();ctx.chooseAspect('3:2');doc.getElementById('groupsCartBack').click()
 expect(reviews()).toBe(1);expect(ctx.QUEUE).toEqual(['a','b','c','d']);expect(ctx.SRC.subjectCount).toBe(4);expect(doc.getElementById('groupsShapes').hidden).toBe(true)
 })
})
