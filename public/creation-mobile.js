/* Confirmation uses the existing m-scrim / m-modal family. */
(function(){
'use strict';
document.body.insertAdjacentHTML('beforeend', '<div class="scrim m-scrim" id="deepStartOverModal" data-role="modal">'+
 '<div class="modal m-modal" role="dialog" aria-modal="true" aria-labelledby="deepStartOverCopy">'+
 '<div class="state active cap-body"><div class="mcur"><img class="mc-mark" src="/icons/curator-c.svg" alt="">'+
 '<div class="mcur-say" id="deepStartOverCopy">This will clear your cart&#39;s contents.</div></div>'+
 '<div class="acts"><button class="btn ghost" id="deepStartOverCancel" type="button">Cancel</button>'+
 '<button class="btn fill" id="deepStartOverProceed" type="button">Proceed</button></div></div></div></div>');
var modal=document.getElementById('deepStartOverModal'),cancel=document.getElementById('deepStartOverCancel'),proceed=document.getElementById('deepStartOverProceed');
var error=document.createElement('p');error.className='startover-err';error.hidden=true;error.setAttribute('role','alert');error.textContent='That did not go through. Nothing was cleared — please try again.';modal.querySelector('.state').appendChild(error);
var action=null,previous=null,busy=false;
function close(){if(busy)return;modal.classList.remove('is-open');if(previous&&previous.isConnected)previous.focus();action=null;}
window.DeepReviewConfirm=function(fn){action=fn;error.hidden=true;previous=document.activeElement;modal.classList.add('is-open');cancel.focus();};
cancel.addEventListener('click',close);
modal.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}if(e.key==='Tab'){e.preventDefault();e.stopPropagation();(document.activeElement===cancel?proceed:cancel).focus();}});
proceed.addEventListener('click',function(){if(busy||!action)return;busy=true;proceed.disabled=cancel.disabled=true;Promise.resolve().then(action).then(function(ok){busy=false;proceed.disabled=cancel.disabled=false;if(ok!==false)close();else error.hidden=false;},function(){busy=false;proceed.disabled=cancel.disabled=false;error.hidden=false;});});
var rail=document.getElementById('discoveryRail')||document.getElementById('cur');
function mount(){
 var button=rail.querySelector('#btnStartOver');
 if(button){button.classList.remove('rail-startover');button.classList.add('deep-startover');}
 if(document.body.classList.contains('is-format')||document.body.classList.contains('groups-shapes'))return;
 var review=document.body.classList.contains('is-review')||document.body.classList.contains('groups-cart');
 var back=review&&(rail.querySelector('#groupsCartBack')||rail.querySelector('#btnBackRail'));
 var collection=rail.querySelector('.your-collection');
 if(review&&!back||!review&&!collection)return;
 if(!button){button=document.createElement('button');button.className='deep-startover';button.id='btnStartOver';button.type='button';button.textContent='Start over';}
 if(review){
  var anchor=back.closest('#groupsShapeRail')||back;
  if(anchor.nextElementSibling!==button)anchor.after(button);
 }else if(collection.previousElementSibling!==button)collection.before(button);
}
new MutationObserver(mount).observe(rail,{childList:true,subtree:true});
new MutationObserver(mount).observe(document.body,{attributes:true,attributeFilter:['class']});mount();
})();
