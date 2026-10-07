/* Presentation state only. Selection and package authorities stay in each series. */
(function(){
'use strict';
window.LitenPickPackage=function(config){
 var hover=null,focus=null,activeSize=null;
 function control(node){return node&&node.closest?node.closest(config.main+','+config.choices):null;}
 function size(el){return el&&!el.disabled&&!el.closest('[hidden]')?(el.matches(config.main)?config.target():config.size(el)):null;}
 function view(){
  var n=config.count();if(activeSize!==null&&n!==activeSize)activeSize=null;
  if(hover&&!hover.isConnected)hover=null;if(focus&&!focus.isConnected)focus=null;
  var preview=size(hover)||size(focus),open=config.open();
  return {target:preview||activeSize||config.target(),visible:n>0||!!preview||open||activeSize!==null,active:open||activeSize!==null,activeSize:activeSize||(open?config.target():null)};
 }
 function decorate(){
  var state=view(),info=document.getElementById('groupsPackageInfo'),main=document.querySelector(config.main);
  if(info)info.hidden=!state.visible;
  if(main){main.classList.toggle('is-active',state.active);main.setAttribute('aria-pressed',String(state.active));}
  document.querySelectorAll(config.choices).forEach(function(el){var selected=config.size(el)===state.activeSize;el.classList.toggle('is-active',selected);el.setAttribute('aria-pressed',String(selected));});
  return state;
 }
 function repaint(){config.repaint();decorate();}
 document.addEventListener('pointerover',function(e){var el=control(e.target);if(el!==hover){hover=el;repaint();}});
 document.addEventListener('pointerout',function(e){if(control(e.target)){hover=control(e.relatedTarget);repaint();}});
 document.addEventListener('focus',function(e){var el=control(e.target);hover=null;focus=el;repaint();},true);
 document.addEventListener('blur',function(e){if(control(e.target)){focus=control(e.relatedTarget);repaint();}},true);
 document.addEventListener('click',function(e){var el=control(e.target);if(!el)return;var chosen=el.disabled?null:config.size(el);if(!el.matches(config.main)&&chosen&&config.count()===chosen)activeSize=chosen;repaint();});
 document.addEventListener('keydown',function(e){var el=control(e.target);if(el){hover=null;focus=el;repaint();}else if(e.key==='Escape')repaint();});
 return {view:view,decorate:decorate};
};
})();
