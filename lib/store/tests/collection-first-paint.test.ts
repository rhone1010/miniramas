import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
const {JSDOM}=require('jsdom')
const html=readFileSync('public/pets.html','utf8')
describe('shared Collection first paint',()=>{
 for(const path of ['/collection','/pets/discovery'])it('recognizes '+path+' before body parsing',()=>{
 const script=html.match(/<script>(if\(location.pathname === '\/collection'\)[\s\S]*?)<\/script>/)![1]
 const dom=new JSDOM('<html><head></head><body></body></html>');runInNewContext(script,{location:{pathname:path},document:dom.window.document});expect(dom.window.document.documentElement.classList.contains('shared-collection-entry')).toBe(path==='/collection');expect(html.indexOf(script)).toBeLessThan(html.indexOf('<body>'))
 })
 it('suppresses only the host discovery and pre-Collection rail, leaving shared Collection separate',()=>{const d=new JSDOM(html.replace(/<style[\s\S]*?<\/style>/g,'').replace(/<script[\s\S]*?<\/script>/g,'')).window.document;expect(d.querySelector('#discoveryView #mycoll')).toBe(null);expect(html).toContain('html.shared-collection-entry #discoveryView{visibility:hidden!important;}');expect(html).toContain('body:not(.mc-unlock-review) #discoveryRail{visibility:hidden!important;}');expect(html).toContain('html.shared-collection-entry .mycoll{transition:none;}')})
})
