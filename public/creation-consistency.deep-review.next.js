/* Groups donor: dc86f3ef5f89e30fb943ae142e666dea8ed1e039. Shared Pets/Portraits presentation adapter. */
(function(){
'use strict';
const CART=String.raw`
        <div id="groupsShapeRail" hidden>
          <p class="groups-source-caption">SOURCE PHOTOGRAPH</p>
          <div class="your-collection__title">Your Collection</div>
          <p id="groupsCartCount"></p>
          <ol id="groupsCartEffects"></ol>
          <p id="groupsShapeSummary"></p>
          <p id="groupsCartFormat" hidden></p>
          <button class="btn-review" id="groupsCartBack" type="button">← Back to Discovery</button>
        </div>
`;
const CLEAR=String.raw`
    <div id="groupsReviewActions"><button type="button" id="groupsReviewClear">Clear Selection</button></div>
`;
const REVIEW_FORWARD=String.raw`
        <div class="groups-forward"><button class="btn-review" type="button" id="groupsReviewCraft">Choose Format →</button></div>
`;
const FORMAT_FORWARD=String.raw`
      <div class="groups-forward"><button class="btn-review" id="groupsShapeCraft" type="button" disabled>Craft My Collection</button></div>
`;
const HEADING=String.raw`
    <div class="crumb">
      <span class="crumb-here" id="crumbHere"></span>
    </div>
`;
const desktop=()=>!railIsSheet();
const byId=id=>document.getElementById(id);
const packageState=window.LitenPickPackage({main:'#optPickForMe',choices:'#pfmSizes [data-pfm]',count:()=>SELECTED.length,target:targetBundle,size:el=>Number(el.dataset.pfm),open:()=>!!(byId('pfmSizes')&&!byId('pfmSizes').hidden),repaint:paintDiscovery});
const original={renderReviewRail,renderAspectRail,paintDesktopCurator,paintBundle,noteSection,chooseAspect,showDiscovery};
function mountHeading(view,id,text){
  let el=byId(id);
  if(!el){const box=document.createElement('div');box.innerHTML=HEADING;el=box.firstElementChild;el.id=id;el.classList.add('consistency-heading');el.querySelector('#crumbHere').removeAttribute('id');view.prepend(el);}
  el.querySelector('.crumb-here').textContent=text;el.hidden=!desktop();
}
function clearStageActions(){document.querySelectorAll('.consistency-port').forEach(el=>el.remove());}
function currentCategory(){
  if(!desktop())return;
  document.querySelectorAll('[data-curator-room]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.curatorRoom===ACTIVE_SILO)));
}
function paintDiscovery(){
  if(!desktop()||!byId('dcurRooms'))return;
  mountHeading(discoveryView,'consistencyDiscoveryHeading','Choose An Effect');
  byId('dcurMapBody').hidden=false;
  if(byId('optPickForMe').textContent!=='Pick for Me')byId('optPickForMe').textContent='Pick for Me';
  currentCategory();
  const n=SELECTED.length,ready=VALID_SIZES.indexOf(n)>=0,progress=byId('dcurProgress'),state=desktopBundleProgress(n);
  discoveryRail.querySelector('.your-collection').classList.toggle('is-ready',ready);
    progress.innerHTML = '<i class="dcur__fill" style="width:' + state.position + '%"></i>' +
      VALID_SIZES.map(function(size, i){
        return '<span class="dcur__milestone' + (n >= size ? ' reached' : '') + (size === targetFor(n) ? (ready ? ' is-current' : ' is-next') : '') + '" style="left:' +
          (i / (VALID_SIZES.length - 1) * 100) + '%">' + size + '</span>';
      }).join('') +
      '<i class="dcur__position" style="left:' + state.position + '%"></i>';
  let info=byId('groupsPackageInfo');
  if(!info){info=document.createElement('div');info.id='groupsPackageInfo';info.className='bundle-ind';discoveryRail.querySelector('.your-collection').before(info);}
  const rewardTarget=packageState.view().target,rewardSku={includedUnlocks:INCLUDED_UNLOCKS_BY_SIZE[rewardTarget]||0};
  info.classList.toggle('is-ready',ready);
  packageState.decorate();
      info.innerHTML='<span class="groups-number">'+rewardTarget+'</span>'+(rewardTarget === 1 ? ' Craft' : ' Crafts')+' · <span class="groups-number">'+'$'+Number(sizeInfo(rewardTarget).price).toFixed(2)+'</span><br><span class="groups-unlock-count">'+(rewardSku.includedUnlocks||0)+'</span> '+(rewardSku.includedUnlocks===1?'Unlock Included':'Unlocks Included');
}
  function paintGroupsCart(){
    var box=document.getElementById('groupsCartEffects');
    box.innerHTML='';
    reviewItems().filter(function(item){return !item.slot;}).forEach(function(item){
      var li=document.createElement('li');li.textContent=item.name;box.appendChild(li);
    });
    document.getElementById('groupsCartCount').textContent=SELECTED.length+(SELECTED.length===1?' artwork':' artworks');
    var n=targetBundle(), info=sizeInfo(n);
    var sku={count:n,includedUnlocks:INCLUDED_UNLOCKS_BY_SIZE[n]||0,price:info.price};
    if(sku){
      var summary=document.getElementById('groupsShapeSummary');summary.innerHTML='';
      [['Collection',sku.count+(sku.count===1?' Craft':' Crafts')],['Included Unlocks',String(sku.includedUnlocks||0)],['Total','$'+Number(sku.price).toFixed(2)]].forEach(function(item){
        var row=document.createElement('span'),label=document.createElement('span'),value=document.createElement('span');
        row.className='groups-cart-package';label.textContent=item[0];value.textContent=item[1];row.appendChild(label);row.appendChild(value);summary.appendChild(row);
      });
    }
    var format=document.getElementById('groupsCartFormat'),isFormat=document.body.classList.contains('is-format');
    var choice=ASPECTS.find(function(a){return a.id===ASPECT;});
    format.hidden=!isFormat||!choice;
    format.textContent=isFormat&&choice?'Format · '+choice.label:'';
    document.getElementById('groupsCartBack').textContent=isFormat?'← Back to Review':'← Back to Discovery';
  }
/* Align the rail to the approved forward action without introducing a new spacing value. */
let actionFrame=0;
function alignCartAction(){
  cancelAnimationFrame(actionFrame);
  actionFrame=requestAnimationFrame(()=>{
    const cart=byId('groupsShapeRail');
    if(!desktop()||!cart)return;
    const button=byId(document.body.classList.contains('is-format')?'groupsShapeCraft':'groupsReviewCraft');
    if(!button)return;
    const forward=button.getBoundingClientRect(),back=byId('groupsCartBack').getBoundingClientRect();
    cart.style.maxHeight=Math.max(0,forward.top+(forward.height+back.height)/2-cart.getBoundingClientRect().top)+'px';
  });
}
const actionObserver=new ResizeObserver(alignCartAction);
actionObserver.observe(reviewView);actionObserver.observe(byId('aspectView'));actionObserver.observe(discoveryRail);
window.addEventListener('resize',alignCartAction);
document.fonts.ready.then(alignCartAction);
let cartStage=null;
function mountCart(isFormat){
  const entering=cartStage!==isFormat;cartStage=isFormat;
  clearStageActions();
  document.body.classList.toggle('groups-cart',desktop());
  if(!desktop()){
    if(!isFormat){
      reviewView.insertAdjacentHTML('beforeend',CLEAR);
      const clear=byId('groupsReviewActions');clear.classList.add('consistency-port');
      byId('reviewGrid').before(clear);
      byId('groupsReviewClear').addEventListener('click',askStartOver);
    }
    return;
  }
  const photo=discoveryRail.querySelector('.photo-row'),curator=discoveryRail.querySelector('.curator');
  discoveryRail.replaceChildren();
  if(curator)discoveryRail.appendChild(curator);
  if(photo){photo.inert=true;discoveryRail.appendChild(photo);}
  discoveryRail.insertAdjacentHTML('beforeend',CART);byId('groupsShapeRail').hidden=false;
  if(entering){discoveryRail.scrollTop=0;window.scrollTo(0,0);}
  paintGroupsCart();
  byId('groupsCartBack').addEventListener('click',()=>isFormat?hideAspect():showDiscovery());
  const view=isFormat?byId('aspectView'):reviewView;
  if(!isFormat){
    mountHeading(view,'consistencyReviewHeading','Review Your Collection');
    view.insertAdjacentHTML('beforeend',CLEAR);
    const clear=byId('groupsReviewActions');clear.classList.add('consistency-port');
    byId('reviewGrid').before(clear);
    byId('groupsReviewClear').addEventListener('click',askStartOver);
    const confirmation=document.createElement('div');confirmation.id='startOverConfirm';clear.appendChild(confirmation);
  }
  view.insertAdjacentHTML('beforeend',isFormat?FORMAT_FORWARD:REVIEW_FORWARD);
  const button=byId(isFormat?'groupsShapeCraft':'groupsReviewCraft');button.parentElement.classList.add('consistency-port');
  const sum=buildSummaryHtml();button.disabled=!(sum.info.valid&&sum.n>0&&!openSlots());button.setAttribute('aria-disabled',String(button.disabled));
  button.addEventListener('click',()=>{if(!button.disabled)(isFormat?startCheckout:showAspect)();});
  fitStampThumb();if(ANALYZE_RESULT)focusStampThumb();
  alignCartAction();
}
renderReviewRail=function(){original.renderReviewRail.apply(this,arguments);mountCart(false);};
renderAspectRail=function(){original.renderAspectRail.apply(this,arguments);mountCart(true);};
paintDesktopCurator=function(){original.paintDesktopCurator.apply(this,arguments);paintDiscovery();};
paintBundle=function(){original.paintBundle.apply(this,arguments);paintDiscovery();};
noteSection=function(){original.noteSection.apply(this,arguments);currentCategory();};
chooseAspect=function(){original.chooseAspect.apply(this,arguments);if(desktop()&&byId('groupsCartEffects'))paintGroupsCart();};
showDiscovery=function(){cartStage=null;clearStageActions();document.body.classList.remove('groups-cart');return original.showDiscovery.apply(this,arguments);};
let wasDesktop=desktop();
window.addEventListener('resize',()=>{
  const now=desktop();if(now===wasDesktop)return;wasDesktop=now;
  if(!now)document.querySelectorAll('.consistency-heading').forEach(el=>el.remove());
  if(document.body.classList.contains('is-review'))renderReviewRail();
  else if(document.body.classList.contains('is-format'))renderAspectRail();
  else{document.body.classList.remove('groups-cart');paintDiscovery();}
  if(typeof window.__railDock==='function')window.__railDock();
});
if(document.body.classList.contains('is-review'))renderReviewRail();
else if(document.body.classList.contains('is-format'))renderAspectRail();
else paintDiscovery();
})();
