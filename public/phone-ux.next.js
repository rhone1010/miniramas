/* Phone-only presentation adapters. Product handlers and price authorities are retained. */
(function(){
'use strict';
const phone=matchMedia('(max-width:767px)'),groups=!!document.getElementById('workshop');
const $=s=>document.querySelector(s);
function toggle(el,c,on){if(el.classList.contains(c)!==on)el.classList.toggle(c,on);}
function state(){if(groups)return window.PhoneGroupsState?.();if(typeof SELECTED==='undefined')return null;const n=SELECTED.length;return {n,sizes:VALID_SIZES,price:sizeInfo(n).price,unlocks:INCLUDED_UNLOCKS_BY_SIZE[n],stage:document.body.classList.contains('is-format')?'format':document.body.classList.contains('is-review')?'review':'discovery'};}
function click(sel){$(sel)?.click();}
const dock=document.createElement('nav');dock.className='phone-dock';dock.setAttribute('aria-label','Creation actions');
dock.innerHTML='<div class="phone-utility"><button type="button" class="uxphone-back" aria-label="Back">←</button><button type="button" class="phone-curator">Curator</button></div><button type="button" class="phone-progress" aria-label="Collection package"><span class="phone-steps"></span><span class="phone-count"></span><span class="phone-disclosure" aria-hidden="true">⌃</span></button><button type="button" class="phone-forward">Review</button>';
document.body.append(dock);
const formatCount=groups?document.createElement('div'):null;if(formatCount){formatCount.className='phone-format-count';document.querySelector('#groupsShapes .aspect-gallery')?.prepend(formatCount);}
const modal=document.createElement('div');modal.className='phone-package scrim m-scrim';modal.hidden=true;
modal.innerHTML='<div class="modal m-modal" role="dialog" aria-modal="true" aria-labelledby="phonePackageTitle"><button type="button" class="phone-package-close" aria-label="Close">×</button><h2 id="phonePackageTitle">Your Collection</h2><p class="phone-package-price"></p><p class="phone-package-watermark"></p><p class="phone-package-unlocks"></p><div class="acts"><button type="button" class="btn ghost phone-add">Add More</button><button type="button" class="btn fill phone-review">Review Collection</button></div></div>';
document.body.append(modal);let focusBefore=null;
function close(){modal.hidden=true;modal.classList.remove('is-open');document.body.classList.remove('phone-package-open');focusBefore?.focus();}
function forward(reviewOnly=false){const s=state();if(!s)return;if(reviewOnly&&s.stage==='format'){click(groups?'#groupsCartBack':'.rail-back');return;}if(s.stage==='discovery')click(groups?'#groupsReviewAccess':'#btnGoReview');else if(s.stage==='review')click(groups?'#groupsReviewCraft':'.your-collection.is-docked .rail-go');else click(groups?'#groupsShapeCraft':'.your-collection.is-docked .rail-go');}
dock.querySelector('.uxphone-back').onclick=()=>click(groups?'#groupsCartBack':'.your-collection.is-docked .rail-back');
dock.querySelector('.phone-curator').onclick=()=>{if(groups)document.body.classList.add('ux-groups-curator');else click('.your-collection.is-docked .rail-fab');};
dock.querySelector('.phone-forward').onclick=()=>forward();
dock.querySelector('.phone-progress').onclick=()=>{const s=state();if(!s?.sizes.includes(s.n)||s.price==null)return;focusBefore=document.activeElement;modal.querySelector('.phone-package-price').textContent=s.n+(s.n===1?' Effect · $':' Effects · $')+Number(s.price).toFixed(2);modal.querySelector('.phone-package-watermark').textContent=s.n+' watermarked '+(s.n===1?'image':'images');modal.querySelector('.phone-package-unlocks').textContent=s.unlocks+' '+(s.unlocks===1?'unlock':'unlocks')+' included';modal.hidden=false;modal.classList.add('is-open');document.body.classList.add('phone-package-open');modal.querySelector('.phone-package-close').focus();};
modal.querySelector('.phone-package-close').onclick=close;
modal.querySelector('.phone-add').onclick=()=>{close();const s=state();if(s.stage!=='discovery'){click(groups?'#groupsCartBack':'.rail-back');if(state().stage!=='discovery')click(groups?'#groupsCartBack':'.rail-back');}};
modal.querySelector('.phone-review').onclick=()=>{close();if(state().stage!=='review')forward(true);};
modal.addEventListener('click',e=>{if(e.target===modal)close();});
modal.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const bs=[...modal.querySelectorAll('button')],i=bs.indexOf(document.activeElement);e.preventDefault();bs[(i+(e.shiftKey?bs.length-1:1))%bs.length].focus();}});
const folds=document.createElement('nav');folds.className='phone-folds';folds.setAttribute('aria-label','Effect folds');document.body.append(folds);let foldRows=[],foldKey='';
function measureFolds(){
 if(!phone.matches||state()?.stage!=='discovery')return;
 const scroller=$(groups?'#deck':'#stageScroll');if(!scroller)return;
 const bounds=scroller.getBoundingClientRect();
 const contentRight=bounds.left+scroller.clientLeft+scroller.clientWidth;
 // The reserved content padding holds the rail, left of both scrollbars.
 folds.style.left=Math.max(0,contentRight-24)+'px';
 const cards=[...document.querySelectorAll(groups?'#effectFloor .silo-card':'#stageScroll .effect-grid>.card')].filter(c=>c.getBoundingClientRect().height>0);
 const rows=[];for(const c of cards){const y=c.getBoundingClientRect().top;if(!rows.some(r=>Math.abs(r.y-y)<5))rows.push({y,el:c});}
 foldRows=rows;const key=rows.map(r=>r.el.dataset.effectId||r.el.dataset.baseId||r.el.textContent.trim()).join('|');
 if(key!==foldKey){foldKey=key;folds.replaceChildren(...rows.map((r,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label','Effect fold '+(i+1));b.onclick=()=>r.el.scrollIntoView({behavior:'smooth',block:'start'});return b;}));}
 const head=$('.masthead,#masthead');
 const top=Math.max(0,head?head.getBoundingClientRect().bottom:0,bounds.top+scroller.clientTop);
 let current=0,distance=Infinity;rows.forEach((r,i)=>{const d=Math.abs(r.y-top);if(d<distance){distance=d;current=i;}});
 [...folds.children].forEach((b,i)=>{toggle(b,'current',i===current);b.setAttribute('aria-current',i===current?'step':'false');});
}
let scheduled=false,last='',lastCount=null;
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;sync();});}
function sync(){const s=state();if(!s)return;toggle(document.body,'phone-finishing',phone.matches&&s.stage!=='discovery');toggle(document.body,'phone-discovery',phone.matches&&s.stage==='discovery');dock.hidden=!phone.matches;folds.hidden=!phone.matches||s.stage!=='discovery';const key=JSON.stringify([phone.matches,s.n,s.stage,s.sizes]);if(key!==last){const changed=lastCount!==null&&s.n!==lastCount;lastCount=s.n;last=key;const steps=dock.querySelector('.phone-steps');steps.replaceChildren(...s.sizes.map(n=>{const el=document.createElement('span');el.textContent=n;el.className=s.n>=n?'reached':'';if(n===s.n)el.classList.add('current');if(n===s.sizes.find(v=>v>s.n))el.classList.add('next');return el;}));dock.querySelector('.phone-count').textContent=s.n+' selected';if(formatCount)formatCount.textContent=s.n+(s.n===1?' Effect':' Effects')+' to be Crafted';const milestone=s.sizes.includes(s.n);dock.querySelector('.phone-progress').disabled=!milestone;dock.querySelector('.phone-disclosure').hidden=!milestone;document.querySelector('.uxphone-back').hidden=s.stage==='discovery';document.querySelector('.uxphone-back').setAttribute('aria-label',s.stage==='format'?'Back to Review':'Back to Discovery');dock.querySelector('.phone-forward').textContent=s.stage==='discovery'?'Review':s.stage==='review'?(groups?'Review':'Format'):'Craft';dock.querySelector('.phone-forward').disabled=!s.n;if(changed&&milestone){dock.classList.remove('phone-reached');requestAnimationFrame(()=>dock.classList.add('phone-reached'));}}const actual=s.stage==='format'?$(groups?'#groupsShapeCraft':'#btnCraft'):null;const forwardButton=dock.querySelector('.phone-forward');if(actual&&forwardButton.disabled!==actual.disabled)forwardButton.disabled=actual.disabled;measureFolds();}
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','disabled']});
document.addEventListener('scroll',measureFolds,true);window.addEventListener('resize',schedule);phone.addEventListener('change',()=>{close();schedule();});
// Groups Clear Selection retains its original clearing callback after confirmation.
let confirmedClear=false;
document.addEventListener('click',e=>{if(!phone.matches||!groups||confirmedClear||!e.target.closest('#groupsReviewClear'))return;e.preventDefault();e.stopImmediatePropagation();window.DeepReviewConfirm(()=>{confirmedClear=true;try{click('#groupsReviewClear');}finally{confirmedClear=false;}return true;});},true);
// Style the existing confirmation; do not replace its callbacks or clearing semantics.
const account=document.getElementById('mhIdentity');
if(account){
 const text=document.createElement('span');text.className='phone-account-label';let desktopMetadata=null;
 function label(){
  const raw=[...account.childNodes].filter(n=>n!==text).map(n=>n.textContent).join('');const value=/sign in/i.test(raw)?'Sign in':'Account';
  if(text.textContent!==value)text.textContent=value;if(!account.contains(text))account.append(text);
  if(phone.matches){
   const title=account.getAttribute('title'),aria=account.getAttribute('aria-label');
   if(!desktopMetadata)desktopMetadata={title,aria};
   else{if(title!==null)desktopMetadata.title=title;if(aria!==null&&aria!==value)desktopMetadata.aria=aria;}
   if(title!==null)account.removeAttribute('title');if(aria!==value)account.setAttribute('aria-label',value);
  }else if(desktopMetadata){
   const saved=desktopMetadata;desktopMetadata=null;
   for(const [attr,value] of [['title',saved.title],['aria-label',saved.aria]]){if(value===null)account.removeAttribute(attr);else account.setAttribute(attr,value);}
  }
 }
 label();new MutationObserver(label).observe(account,{childList:true,attributes:true,attributeFilter:['title','aria-label']});phone.addEventListener('change',label);
}

schedule();
})();
