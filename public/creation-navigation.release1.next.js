/* Move the existing phone Back control into the masthead; retain its handlers. */
(function(){
if(document.documentElement.classList.contains('shared-collection-entry'))return;
const header=document.querySelector('.masthead,#masthead'),back=document.querySelector('.phone-dock .uxphone-back'),menu=document.querySelector('.ux-menu-toggle');
if(!header||!back||!menu)return;
const home=document.createComment('phone back home');back.before(home);const media=matchMedia('(max-width:767px)');
function sync(){const finishing=document.body.classList.contains('phone-finishing');if(media.matches&&finishing){if(back.parentElement!==header)header.append(back);back.classList.add('release1-masthead-back');menu.hidden=true;}else{if(back.parentElement!==home.parentElement)home.after(back);back.classList.remove('release1-masthead-back');menu.hidden=false;}}
new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});media.addEventListener('change',sync);sync();
})();
