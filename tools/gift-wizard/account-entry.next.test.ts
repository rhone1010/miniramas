import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
async function boot(signedIn:boolean){
 const dom=new JSDOM('<header class="liten-masthead"></header>',{url:'https://liten.invalid/gift-wizard.next.html',runScripts:'outside-only'});const w=dom.window as any,calls:string[]=[];
 w.matchMedia=()=>({matches:false,addEventListener(){}});w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 w.fetch=async(url:string)=>{calls.push(url);return new Response(JSON.stringify(url.endsWith('/me')?{user:signedIn?{id:'user'}:null}:{ok:true}),{status:200})};
 w.eval(fs.readFileSync('public/shared-masthead.next.js','utf8'));await new Promise(r=>setTimeout(r,10));return {dom,w,calls};
}
test('signed-out Account opens explicit provider choice without starting OAuth',async()=>{const {dom,w,calls}=await boot(false);w.document.querySelector('[data-action=auth]').click();assert(w.document.querySelector('#liten-signin').open);assert(w.document.querySelector('#liten-google'));assert(w.document.querySelector('#liten-email').required);assert.equal(calls.filter(x=>x.endsWith('/signin')).length,0);assert(w.document.querySelector('[data-action=switch-account]').hidden);w.document.querySelector('#liten-auth-close').click();assert(!w.document.querySelector('#liten-signin').open);dom.window.close()});
test('signed-in Account exposes real sign-out and switch-account without touching gifts',async()=>{for(const action of ['auth','switch-account']){const {dom,w,calls}=await boot(true);assert.equal(w.document.querySelector('[data-action=auth]').textContent,'Sign out');assert(!w.document.querySelector('[data-action=switch-account]').hidden);w.document.querySelector('[data-action='+action+']').click();await new Promise(r=>setTimeout(r,10));assert.equal(calls.filter(x=>x.endsWith('/signout')).length,1);assert(!calls.some(x=>x.includes('/gift/')));dom.window.close()}});
