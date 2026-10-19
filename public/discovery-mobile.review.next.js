/* Discovery-only adapter: existing category, selection and picker handlers remain authoritative. */
(function(){
'use strict';
const phone=matchMedia('(max-width:767px)'),view=document.getElementById('discoveryView'),stage=document.getElementById('stageScroll');
if(!view||!stage)return;
const heading=document.createElement('div');heading.className='discovery-review-heading';heading.textContent='Choose An Effect';view.prepend(heading);
const chooser=document.createElement('details');chooser.id='phoneGroupsSilo';const summary=document.createElement('summary');summary.className='dcur__room';summary.innerHTML='<svg class="phone-effects-map" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z"/><path d="M9 3v16M15 5v16"/></svg><span>Explore All Effects</span>';
const rooms=document.createElement('div');rooms.id='phoneGroupsRooms';chooser.append(summary,rooms);stage.before(chooser);
SILOS.forEach(s=>{const b=document.createElement('button');b.type='button';b.className='dcur__room';b.dataset.curatorRoom=s.id;b.innerHTML='<span class="dcur__room-icon">'+iconMarkup(s.id)+'</span><span>'+s.name+'</span>';rooms.append(b);});
let active=ACTIVE_SILO||SILOS[0].id;
function choose(id){active=id;ACTIVE_SILO=id;sync();stage.scrollTop=0;chooser.open=false;summary.focus();}
rooms.addEventListener('click',e=>{const b=e.target.closest('[data-curator-room]');if(b)choose(b.dataset.curatorRoom);});
chooser.addEventListener('keydown',e=>{if(e.key==='Escape'){chooser.open=false;summary.focus();}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-curator-room]');if(phone.matches&&b&&!rooms.contains(b))choose(b.dataset.curatorRoom);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const box=document.getElementById('pfmSizes');if(box&&!box.hidden){closePickSizes();document.getElementById('optPickForMe')?.focus();}}});
let dock=document.querySelector('.phone-dock');

function sync(){
 const on=phone.matches&&!document.body.classList.contains('is-review')&&!document.body.classList.contains('is-format');
 if(document.body.classList.contains('discovery-mobile-match')!==on)document.body.classList.toggle('discovery-mobile-match',on);
 stage.querySelectorAll('.silo-block').forEach(b=>{const hide=on&&b.id!=='silo-'+active;if(b.hidden!==hide)b.hidden=hide;});
 rooms.querySelectorAll('button').forEach(b=>{const v=String(b.dataset.curatorRoom===active);if(b.getAttribute('aria-pressed')!==v)b.setAttribute('aria-pressed',v);});

 const card=stage.querySelector('.silo-block:not([hidden]) .card');if(on&&card){const tail=Math.max(16,stage.clientHeight-card.offsetHeight)+'px';if(stage.style.getPropertyValue('--phone-silo-tail')!==tail)stage.style.setProperty('--phone-silo-tail',tail);}
}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;sync();});}
new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});new ResizeObserver(schedule).observe(stage);phone.addEventListener('change',sync);sync();
})();
