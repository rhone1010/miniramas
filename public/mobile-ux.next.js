/* Mobile composition only: existing controls are moved, never cloned or rebound. */
(function(){
'use strict';
const media=matchMedia('(max-width:1024px)');
const header=document.querySelector('.masthead,#masthead');
if(!header)return;
const nav=header.querySelector('.masthead__nav,.mh-nav');
const actions=header.querySelector('.masthead__right,.mh-right');
const toggle=document.createElement('button');toggle.type='button';toggle.className='ux-menu-toggle';toggle.setAttribute('aria-label','Menu');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','uxMenu');
toggle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round"/></svg>';
const panel=document.createElement('div');panel.id='uxMenu';panel.className='ux-menu-panel';panel.hidden=true;
header.append(toggle,panel);
const moved=[nav,actions].filter(Boolean).map(el=>{const mark=document.createComment('mobile menu home');el.before(mark);return {el,mark};});
const labels=[];
for(const id of ['mhAskBtn','mhScarab']){const el=document.getElementById(id);if(!el)continue;const label=document.createElement('span');label.className='ux-action-label';label.textContent=id==='mhAskBtn'?'Ask the Concierge':'Feedback';el.append(label);labels.push(label);}
function closeMenu(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');document.body.classList.remove('ux-menu-open');}
toggle.addEventListener('click',()=>{const opening=panel.hidden;panel.hidden=!opening;toggle.setAttribute('aria-expanded',String(opening));document.body.classList.toggle('ux-menu-open',opening);});
panel.addEventListener('click',e=>{if(e.target.closest('#mhSeriesBtn,#mhIdentity'))return;if(e.target.closest('a,button'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();document.body.classList.remove('ux-groups-curator');}});
document.addEventListener('click',e=>{if(!header.contains(e.target))closeMenu();});
function layout(){
 closeMenu();
 if(media.matches)moved.forEach(({el})=>panel.append(el));
 else moved.forEach(({el,mark})=>mark.after(el));
 labels.forEach(el=>el.hidden=!media.matches);
 if(!media.matches)document.body.classList.remove('ux-overlay','ux-groups-curator');
 const categories=document.querySelector('.ux-categories');if(categories)categories.open=!media.matches;
 viewport();
}
function viewport(){const vv=window.visualViewport;const h=vv?vv.height:innerHeight,top=vv?vv.offsetTop:0;document.documentElement.style.setProperty('--ux-vh',h+'px');document.documentElement.style.setProperty('--ux-top',top+'px');document.body.classList.toggle('ux-keyboard',media.matches&&h<innerHeight*0.78);}
window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);window.addEventListener('resize',viewport);media.addEventListener('change',layout);
const groupRoom=document.querySelector('.room--curator');const groupHome=document.createComment('mobile curator home');if(groupRoom)groupRoom.before(groupHome);
let groupStage=null;
function overlay(){
 if(!media.matches){if(groupRoom&&groupRoom.parentElement===document.body)groupHome.after(groupRoom);return;}
 if(groupRoom){const open=(innerWidth<768||(innerWidth<=1024&&innerHeight<500))&&document.body.classList.contains('ux-groups-curator');if(open&&groupRoom.parentElement!==document.body)document.body.append(groupRoom);else if(!open&&groupRoom.parentElement===document.body)groupHome.after(groupRoom);}
 const cx=document.querySelector('.cx-veil');
 const modal=document.querySelector('#signinModal.is-open,.lcf-panel.is-open,.scrim.is-open,.acct.is-open');
 const open=document.body.classList.contains('ux-menu-open')||document.body.classList.contains('rail-open')||document.body.classList.contains('ux-groups-curator')||(cx&&!cx.hidden)||!!modal;
 if(document.body.classList.contains('ux-overlay')!==!!open)document.body.classList.toggle('ux-overlay',!!open);
 const rail=document.getElementById('discoveryRail');
 if(rail&&rail.classList.contains('is-sheet')){
  if(!rail.querySelector('#mcurClose,.ux-rail-close')){const x=document.createElement('button');x.type='button';x.className='ux-rail-close';x.textContent='×';x.setAttribute('aria-label','Close the Curator');x.addEventListener('click',()=>document.body.classList.remove('rail-open'));rail.prepend(x);}
  const utility=rail.querySelector('.mcur__body');
  if(utility){
   let summary=utility.querySelector('.ux-utility-summary');if(!summary){summary=document.createElement('div');summary.className='ux-utility-summary';utility.append(summary);}
   if(typeof SELECTED!=='undefined'&&typeof sizeInfo==='function'){
    const count=SELECTED.length,target=targetBundle(),info=sizeInfo(target);const text=count?count+' selected · '+target+' Crafts · $'+Number(info.price).toFixed(2)+' · '+(INCLUDED_UNLOCKS_BY_SIZE[target]||0)+' included unlocks':'';
    if(summary.textContent!==text)summary.textContent=text;if(summary.hidden!==!count)summary.hidden=!count;
   }
   if(!utility.querySelector('.deep-startover')){const b=document.createElement('button');b.type='button';b.className='deep-startover';b.textContent='Start over';b.addEventListener('click',()=>{if(typeof askStartOver==='function')askStartOver();});utility.append(b);}
  }
 }
 const tray=document.getElementById('lgTray'),cur=document.getElementById('cur');
 if(tray&&cur&&!tray.querySelector('.ux-curator-toggle')){
  const b=document.createElement('button');b.type='button';b.className='ux-curator-toggle';b.textContent='Curator';b.setAttribute('aria-controls','cur');b.addEventListener('click',()=>document.body.classList.add('ux-groups-curator'));tray.prepend(b);
  const x=document.createElement('button');x.type='button';x.className='ux-curator-close';x.textContent='×';x.setAttribute('aria-label','Close the Curator');x.addEventListener('click',()=>document.body.classList.remove('ux-groups-curator'));cur.prepend(x);
  const scrim=document.createElement('div');scrim.className='ux-groups-scrim';scrim.addEventListener('click',()=>document.body.classList.remove('ux-groups-curator'));document.body.append(scrim);
  const dock=document.createElement('div');dock.className='ux-groups-dock';
  const back=document.createElement('button');back.type='button';back.textContent='← Back';back.addEventListener('click',()=>document.getElementById('groupsCartBack')?.click());
  const curator=document.createElement('button');curator.type='button';curator.textContent='Curator';curator.addEventListener('click',()=>document.body.classList.add('ux-groups-curator'));
  const forward=document.createElement('button');forward.type='button';forward.className='ux-forward';forward.addEventListener('click',()=>document.getElementById(document.body.classList.contains('groups-shapes')?'groupsShapeCraft':'groupsReviewCraft')?.click());
  dock.append(back,curator,forward);document.body.append(dock);
  const map=document.getElementById('groupsRoomMap');if(map){const details=document.createElement('details');details.className='ux-categories';const summary=document.createElement('summary');summary.textContent='Categories';map.before(details);details.append(summary,map);details.addEventListener('click',e=>{if(e.target.closest('button'))document.body.classList.remove('ux-groups-curator');});}

 }
 const forward=document.querySelector('.ux-groups-dock .ux-forward');
 if(forward){const format=document.body.classList.contains('groups-shapes'),real=document.getElementById(format?'groupsShapeCraft':'groupsReviewCraft');if(real){if(forward.textContent!==real.textContent)forward.textContent=real.textContent;if(forward.disabled!==real.disabled)forward.disabled=real.disabled;}
  const stage=format?'format':document.body.classList.contains('groups-cart')?'review':'discovery';if(stage!==groupStage){groupStage=stage;if((innerWidth<768||(innerWidth<=1024&&innerHeight<500))){document.body.classList.remove('ux-groups-curator');window.scrollTo(0,0);}}
 }
}
new MutationObserver(overlay).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','disabled']});
layout();overlay();
})();
