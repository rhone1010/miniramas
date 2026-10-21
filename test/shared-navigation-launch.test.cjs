const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const fs=require('node:fs');
const script=fs.readFileSync('public/shared-masthead.next.js','utf8');
async function mount(path,user,mobile=false){
 const dom=new JSDOM('<header class="liten-masthead"></header><button id="outside">Outside</button>',{url:'https://navigation.test'+path,runScripts:'outside-only'});
 const w=dom.window;
 w.matchMedia=()=>({matches:mobile,addEventListener(){}});
 w.HTMLElement.prototype.getClientRects=function(){return [{}]};
 w.fetch=async()=>({ok:true,json:async()=>({user})});
 w.eval(script);await new Promise(resolve=>setImmediate(resolve));return dom;
}
for(const series of ['groups','pets','portraits'])test(series+' keeps series across Collection, Print Shop, Help and Account',async()=>{
 const dom=await mount('/'+series,{id:'fixture'}),d=dom.window.document;
 const links=Array.from(d.querySelectorAll('a'));
 for(const [label,path] of [['My Collection','collection'],['Print Shop','collection'],['Help','help'],['Account','account'],['Orders','account']])assert.equal(links.find(a=>a.textContent===label).getAttribute('href'),'/'+path+'?from='+series);
 for(const name of ['Portraits','Groups','Pets'])assert.equal(links.find(a=>a.textContent===name).getAttribute('href'),'/'+name.toLowerCase());
 assert.equal(links.find(a=>a.textContent==='Gift Collection').getAttribute('href'),'/gifts.next.html');dom.window.close();
});
for(const user of [null,{id:'fixture'}])test('auth label reflects '+(user?'signed in':'signed out')+' server response',async()=>{
 const dom=await mount('/collection?from=groups',user);assert.equal(dom.window.document.querySelector('[data-action="auth"]').textContent,user?'Sign out':'Sign in');dom.window.close();
});
test('mobile drawer, keyboard menu navigation, Escape and outside close',async()=>{
 const dom=await mount('/groups',null,true),w=dom.window,d=w.document;
 const toggle=d.querySelector('.mh-menu'),create=d.querySelector('.mh-series-btn');toggle.click();assert.equal(toggle.getAttribute('aria-expanded'),'true');
 create.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));assert.equal(d.activeElement.textContent,'Portraits');
 d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));assert.equal(d.activeElement.textContent,'Pets');
 d.activeElement.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(d.activeElement,create);assert.equal(create.getAttribute('aria-expanded'),'false');
 create.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(toggle.getAttribute('aria-expanded'),'false');assert.equal(d.activeElement,toggle);
 toggle.click();create.click();d.querySelector('#outside').click();assert.equal(toggle.getAttribute('aria-expanded'),'false');assert.equal(create.getAttribute('aria-expanded'),'false');dom.window.close();
});
