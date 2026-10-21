import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountStudio} from '../../public/product-studio/studio.next.js';
test('applicable options stay within chosen physical dimensions and skip absent choices',()=>{
 const d=new JSDOM('<main></main>'),host=d.window.document.querySelector('main'),state={step:'product',productId:'frame',size:'',copies:1,drafts:{}},added=[];
 const options=[{size:'s-black',label:'8 × 8″',retailCents:100,attributes:{color:'black'},imageWidthIn:8,imageHeightIn:8},{size:'s-white',label:'8 × 8″',retailCents:110,attributes:{color:'white'},imageWidthIn:8,imageHeightIn:8},{size:'portrait',label:'12 × 18″',retailCents:200,attributes:{color:'black'},imageWidthIn:12,imageHeightIn:18}];
 mountStudio(host,{products:[{id:'frame',label:'Classic Framed Print',image:'/photo.png',available:true,options}],state,previewHtml:()=>'<p>Review</p>',canAdd:()=>true,onChange:()=>{},onExit:()=>{},onAdd:(p,o,n)=>added.push([o.size,n])});
 const click=q=>host.querySelector(q).click();const panel=host.querySelector('.studio-panel');
 click('[data-feature]');click('[data-size="s-black"]');assert.equal(state.step,'options');assert.equal(host.querySelector('.studio-panel'),panel);
 click('[data-option-value="white"]');click('[data-review]');click('#primary');assert.deepEqual(added,[['s-white',1]]);
 click('#studio-back');assert.equal(state.step,'options');assert.equal(host.querySelector('[data-option-value="white"]').getAttribute('aria-pressed'),'true');
 click('#studio-back');click('[data-aspect="Portrait"]');click('[data-size="portrait"]');assert.equal(state.step,'review');assert.equal(state.size,'portrait');d.window.close();
});
test('unsupported configuration never calls add; invalid quantity is rejected',()=>{
 const d=new JSDOM('<main></main>'),host=d.window.document.querySelector('main');let writes=0;
 const state={step:'review',productId:'canvas',size:'8x8',copies:1,drafts:{}};
 mountStudio(host,{products:[{id:'canvas',label:'Gallery Canvas',image:'/photo.png',available:true,options:[{size:'8x8',label:'8 × 8″',retailCents:100,imageWidthIn:8,imageHeightIn:8}]}],state,previewHtml:()=>'<p>Not currently available</p>',canAdd:()=>false,onChange:()=>{},onExit:()=>{},onAdd:()=>writes++});
 assert.equal(host.querySelector('#primary').disabled,true);host.querySelector('#primary').click();assert.equal(writes,0);d.window.close();
});
