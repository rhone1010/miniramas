/* Phone presentation only. Series data, product handlers and desktop remain authoritative. */
(function(){
if(!document.getElementById('reviewView')||document.documentElement.classList.contains('shared-collection-entry'))return;
const phone=matchMedia('(max-width:767px)');document.body.classList.add('release1-creation');
const chooser=document.createElement('details');chooser.id='release1Silo';const summary=document.createElement('summary');summary.className='dcur__room';const rooms=document.createElement('div');rooms.id='release1Rooms';chooser.append(summary,rooms);document.getElementById('stageScroll').before(chooser);
const discoveryHeading=document.createElement('div');discoveryHeading.id='release1DiscoveryHeading';discoveryHeading.textContent='Choose An Effect';chooser.before(discoveryHeading);
let roomId=ACTIVE_SILO;
const originals=[...document.querySelectorAll('#iconNav [data-target]')];
originals.forEach(original=>{const b=original.cloneNode(true);b.className='dcur__room';b.onclick=()=>{roomId=b.dataset.target;paintRoom();original.click();chooser.open=false;summary.focus();};rooms.append(b);});
function paintRoom(){const selected=originals.find(b=>b.dataset.target===roomId);if(selected&&summary.innerHTML!==selected.innerHTML)summary.innerHTML=selected.innerHTML;document.querySelectorAll('#stageScroll .silo-block').forEach(s=>s.classList.toggle('release1-other-room',phone.matches&&s.id!=='silo-'+roomId));rooms.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.target===roomId)));}
chooser.addEventListener('keydown',e=>{if(e.key==='Escape'){chooser.open=false;summary.focus();}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-curator-room],.mm[data-target]');if(b&&phone.matches){roomId=b.dataset.curatorRoom||b.dataset.target;paintRoom();}},true);
phone.addEventListener('change',paintRoom);paintRoom();
const view=document.getElementById('reviewView'),grid=document.getElementById('reviewGrid');
const heading=document.createElement('div');heading.id='release1ReviewHeading';heading.className='crumb';heading.innerHTML='<span class="crumb-here">Review Your Collection</span>';view.prepend(heading);
const footer=document.createElement('div');footer.id='release1ReviewFooter';const pages=document.createElement('div');pages.id='release1ReviewPages';footer.append(pages);view.append(footer);
const count=document.createElement('div');count.className='phone-format-count';document.querySelector('#aspectFloor .aspect-gallery').prepend(count);
let page=0,key='',pending=false;
function sync(){
 pending=false;heading.hidden=!phone.matches;footer.hidden=true;
 const cards=[...grid.querySelectorAll('.card.fan-card')];
 const signature=cards.map(c=>c.querySelector('[data-key]')?.dataset.key||'slot').join('|');if(signature!==key){page=0;key=signature;}
 cards.forEach((c,i)=>c.classList.toggle('release1-page-hidden',phone.matches&&Math.floor(i/8)!==page));
 if(phone.matches&&document.body.classList.contains('is-review')&&cards.length>8){footer.hidden=false;const total=Math.ceil(cards.length/8);if(pages.children.length!==total){pages.replaceChildren(...Array.from({length:total},(_,i)=>{const b=document.createElement('button');b.type='button';b.className='cur-mode';b.textContent=String(i+1);b.onclick=()=>{page=i;sync();};return b;}));}Array.from(pages.children).forEach((b,i)=>{b.classList.toggle('is-active',i===page);b.setAttribute('aria-current',i===page?'page':'false');});}
 const n=SELECTED.length,text=n+(n===1?' Effect':' Effects')+' to be Crafted';if(count.textContent!==text)count.textContent=text;
 const forward=document.querySelector('.phone-forward');if(phone.matches&&document.body.classList.contains('is-review')&&forward.textContent!=='Review')forward.textContent='Review';
}
function schedule(){if(!pending){pending=true;requestAnimationFrame(sync);}}
new MutationObserver(schedule).observe(grid,{childList:true,subtree:true});
new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class']});
phone.addEventListener('change',schedule);sync();
})();
