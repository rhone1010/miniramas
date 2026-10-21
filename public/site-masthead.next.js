/* Mount the approved shared masthead; retain legacy nodes and handlers for page controls. */
(function(){
'use strict';
document.addEventListener('click',function(e){if(location.pathname!=='/account'||!e.target.closest('#acClose'))return;var series=new URLSearchParams(location.search).get('from');if(['groups','pets','portraits'].includes(series)){e.preventDefault();e.stopImmediatePropagation();location.assign('/'+series);}},true);
if(document.querySelector('.liten-masthead'))return;
var legacy=document.querySelector('header.mh,header.masthead,header#masthead');if(!legacy)return;
legacy.classList.add('site-legacy-masthead');
var header=document.createElement('header');header.className='liten-masthead';legacy.before(header);
var style=document.createElement('link');style.rel='stylesheet';style.href='/shared-masthead.next.css';document.head.append(style);
var script=document.createElement('script');script.src='/shared-masthead.next.js';document.body.append(script);
})();
