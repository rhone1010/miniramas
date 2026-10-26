/* Explicit source/effect relationships, not inferred from the old hero library. */
(()=>{
'use strict';
const root=document.querySelector('.splash-presentation');if(!root)return;
const base='/homepage/assets/splash/';
const pairs={Pets:[1,2,3,4,5].map(n=>({a:`Pets_${n}A.jpg`,b:`Pets_${n}B.jpg`,name:`Pets ${n}`})),Portraits:[1,2,3].map(n=>({a:`Portrait_${n}A.jpg`,b:`Portrait_${n}B.jpg`,name:`Portraits ${n}`}))};
const initial=['Portrait_3B.jpg','Group_4B.jpg','Portrait_1B.jpg'];
const panels=[...root.querySelectorAll('.splash-panel')];
const stage=root.parentElement,gifts=stage.querySelector('.hp-beauty');
const button=stage.querySelector('.splash-motion'),motion=matchMedia('(prefers-reduced-motion: reduce)');
let paused=motion.matches,stopped=false,visible=false,ready=false,elapsed=0,last=0,eventIndex=0,raf=0;
const events=[{at:4000,presentation:'triptych'}];let time=6000;
// One shared source introduction, then its four effects. Never copy the master into other panels.
const groups=[
 {panel:0,file:'group-master-a.jpg',phase:'source',pair:'Groups 1–4'},
 {panel:0,file:'Group_1B.jpg',phase:'effect',pair:'Groups 1'},
 {panel:1,file:'Group_2B.jpg',phase:'effect',pair:'Groups 2'},
 {panel:2,file:'Group_3B.jpg',phase:'effect',pair:'Groups 3'},
 {panel:0,file:'Group_4B.jpg',phase:'effect',pair:'Groups 4'},
 {panel:1,file:'Group_5A.jpg',phase:'source',pair:'Groups 5'},
 {panel:1,file:'Group_5B.jpg',phase:'effect',pair:'Groups 5'}
];
groups.forEach((image,i)=>events.push({...image,at:time+i*1000,series:'Groups',alt:image.pair+(image.phase==='source'?' source photograph':' effect artwork')}));
time+=groups.length*1000;
for(const [series,items] of Object.entries(pairs)){
  for(let start=0;start<items.length;start+=3){
    const batch=items.slice(start,start+3);
    batch.forEach((pair,i)=>events.push({at:time+i*1000,panel:i,file:pair.a,alt:`${pair.name} source photograph`,series,pair:pair.name,phase:'source'}));
    batch.forEach((pair,i)=>events.push({at:time+3000+i*1000,panel:i,file:pair.b,alt:`${pair.name} effect artwork`,series,pair:pair.name,phase:'effect'}));
    time+=6000;
  }
}
events.push({at:time,presentation:'gifts'});
// One continuous left, middle, right order across all image changes.
let nextPanel=0;
events.forEach(event=>{if(event.file){event.panel=nextPanel;nextPanel=(nextPanel+1)%panels.length}});
// Add half a second to every existing hold, including the Gifts hold.
events.forEach((event,index)=>{event.at+=(index+1)*500});
let previousOriginal=0,previousScheduled=0;
events.forEach((event,index)=>{const original=event.at;event.at=index===0?original:previousScheduled+Math.max(2250,original-previousOriginal);previousOriginal=original;previousScheduled=event.at});
const cycleEnd=events[events.length-1].at+4500;
function present(name){stage.dataset.presentation=name;const triptych=name==='triptych';root.hidden=!triptych;root.inert=!triptych;gifts.inert=triptych;gifts.setAttribute('aria-hidden',String(triptych));stage.setAttribute('aria-labelledby',triptych?'splash-title':'groups-title');}
function flip(event){
 if(event.presentation){if(event.presentation==='triptych')resetPanels();present(event.presentation);return;}
 const panel=panels[event.panel],flipper=panel.firstElementChild,back=!flipper.classList.contains('is-back');
 const incoming=flipper.querySelector(back?'.splash-back':'.splash-front'),outgoing=flipper.querySelector(back?'.splash-front':'.splash-back');
 incoming.src=base+event.file;incoming.alt=event.alt;incoming.removeAttribute('aria-hidden');outgoing.setAttribute('aria-hidden','true');
 panel.dataset.series=event.series;panel.dataset.pair=event.pair||'';panel.dataset.phase=event.phase;
 flipper.classList.toggle('is-back',back);
 const turns=Number(flipper.dataset.turns||0)+1;
 flipper.dataset.turns=String(turns);
 flipper.style.transform=`rotateY(${turns*180}deg)`;
}
function frame(now){
 raf=0;if(stopped)return;
 if(!paused&&visible&&!document.hidden){if(last)elapsed+=now-last;while(eventIndex<events.length&&elapsed>=events[eventIndex].at)flip(events[eventIndex++]);if(elapsed>=cycleEnd){elapsed=events[0].at;eventIndex=0;}}
 last=now;schedule();
}
function label(){button.setAttribute('aria-pressed',String(paused));button.setAttribute('aria-label',paused?'Play hero animation':'Pause hero animation');button.firstElementChild.textContent=paused?'▶':'Ⅱ';}
function schedule(){if(ready&&!stopped&&!paused&&visible&&!document.hidden&&!raf)raf=requestAnimationFrame(frame)}
function sync(){cancelAnimationFrame(raf);raf=0;last=0;schedule()}
function resetPanels(){panels.forEach((panel,i)=>{const f=panel.firstElementChild;f.style.transition='none';f.classList.remove('is-back');f.dataset.turns='0';f.style.transform='rotateY(0deg)';const front=f.querySelector('.splash-front');front.src=base+initial[i];front.alt=['Portrait mosaic artwork','Group carved artwork','Portrait action figure artwork'][i];front.removeAttribute('aria-hidden');f.querySelector('.splash-back').setAttribute('aria-hidden','true');panel.dataset.phase='initial';panel.dataset.series='Initial';requestAnimationFrame(()=>{f.style.transition=''})})}
button.addEventListener('click',()=>{paused=!paused;label();sync()});
motion.addEventListener('change',()=>{paused=motion.matches;if(paused){elapsed=0;eventIndex=0;resetPanels();present('triptych')}else{elapsed=0;eventIndex=0;present('gifts')};label();sync()});
document.addEventListener('visibilitychange',sync);
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync()},{threshold:0}).observe(stage);
window.addEventListener('pagehide',()=>{stopped=true;sync()});
window.addEventListener('pageshow',()=>{stopped=false;sync()});
if(motion.matches)present('triptych');else present('gifts');
label();
// Decode the actual paired files before starting the clock so a slow network cannot flip to an empty face.
const files=[...new Set([...groups.map(p=>p.file),...Object.values(pairs).flat().flatMap(p=>[p.a,p.b])])];
Promise.all(files.map(file=>{const image=new Image();image.src=base+file;return image.decode().catch(()=>{stopped=true})})).then(()=>{ready=true;schedule()});
})();
