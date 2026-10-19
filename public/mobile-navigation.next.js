/* Shared mobile adapter for the existing mh-menu / mh-drawer pattern. */
(function(){
'use strict';
var header=document.querySelector('.hp-header,.gift-header');if(!header)return;
var host=document.createElement('div');host.className='liten-mobile-navigation';
host.innerHTML='<a href="/homepage.next.html" aria-label="LITEN &amp; Co homepage"><img src="/homepage/liten-and-co.png" alt="LITEN &amp; Co"></a>'+"  <button class=\"mh-menu\" id=\"mhMenuBtn\" aria-label=\"Menu\" aria-expanded=\"false\" aria-controls=\"mhDrawer\" type=\"button\">\n    <svg viewBox=\"0 0 24 24\"><path d=\"M4 7h16M4 12h16M4 17h16\" stroke-linecap=\"round\"/></svg>\n  </button>"+'<nav class="mh-drawer" id="mhDrawer" aria-label="LITEN &amp; Co" hidden><a href="/groups">Groups</a><a href="/pets">Pets</a><a href="/portraits">Portraits</a><a href="/gift-wizard.next.html">Gifts</a><a href="/discovery?print_pick=1">Print Shop</a></nav>';
header.appendChild(host);
var button=host.querySelector('button'),panel=host.querySelector('nav'),links=Array.from(panel.querySelectorAll('a')),mobile=matchMedia('(max-width:1000px)');
if(/gift/.test(location.pathname))links[3].setAttribute('aria-current','page');
function close(focus){panel.hidden=true;button.setAttribute('aria-expanded','false');if(focus)button.focus();}
function open(focus){if(location.pathname==='/homepage.next.html'){var current=header.querySelector(':scope > nav a[aria-current]');var index=current?['#groups','#pets','#portraits','#holiday-gifts'].indexOf(current.hash):-1;links.forEach(function(a,i){if(i===index)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}panel.hidden=false;button.setAttribute('aria-expanded','true');if(focus)links[0].focus();}
button.addEventListener('click',function(){if(panel.hidden)open(false);else close(false);});
button.addEventListener('keydown',function(e){if(e.key==='ArrowDown'){e.preventDefault();open(true);}});
host.addEventListener('keydown',function(e){if(e.key==='Escape'&&!panel.hidden){e.preventDefault();close(true);}if(panel.contains(e.target)&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();var i=links.indexOf(document.activeElement);links[e.key==='Home'?0:e.key==='End'?links.length-1:(i+(e.key==='ArrowDown'?1:links.length-1))%links.length].focus();}});
host.addEventListener('focusout',function(){setTimeout(function(){if(!host.contains(document.activeElement))close(false);},0);});
document.addEventListener('click',function(e){if(!host.contains(e.target)||e.target.closest('.mh-drawer a'))close(false);});
mobile.addEventListener('change',function(){close(false);});
})();
