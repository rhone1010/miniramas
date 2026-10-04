import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
const {JSDOM}=require('jsdom')
const html=readFileSync('public/groups.html','utf8')
function fn(text:string,name:string){const start=text.indexOf('function '+name+'(');let at=text.indexOf('{',start),depth=1,end=at+1;for(;depth;end++){if(text[end]==='{')depth++;if(text[end]==='}')depth--}return text.slice(start,end)}
const pets=readFileSync('public/pets.html','utf8')
describe('shared Collection authoritative state and return',()=>{
 it.each(['pending','generating','ready'])('classifies %s portfolio items',async status=>{const ctx:any={Promise,fetch:(url:string)=>Promise.resolve({ok:true,json:()=>Promise.resolve(url.endsWith('/status')?{status,series:'groups',items:[{slot:0,status:status==='ready'?'done':'pending',preset:'a',previewId:null}]}:{items:[],includedRemaining:0})}),INCLUDED_BY_PORTFOLIO:{},canonicalSeries:(s:string)=>s,console};runInNewContext(fn(pets,'loadPortfolio'),ctx);const items=await ctx.loadPortfolio('p');expect(items.length).toBe(status==='pending'?0:1);if(items.length)expect(items[0].crafting).toBe(status==='generating')})
 it.each([['groups','/groups'],['pets','/pets/discovery'],['portraits','/discovery'],['https://evil.invalid','/discovery']])('uses validated URL origin %s despite stale tab state', (from,path)=>{let destination='';const ctx:any={location:{pathname:'/collection',search:'?from='+encodeURIComponent(from),assign:(p:string)=>destination=p},URLSearchParams,sessionStorage:{getItem:()=>'/discovery'}};runInNewContext(fn(pets,'closeMyCollection'),ctx);ctx.closeMyCollection();expect(destination).toBe(path)})
})
