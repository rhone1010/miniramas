const MARKUP=`
<div class="scrim m-scrim" id="signinModal" data-role="modal">
  <div class="modal m-card">
    <button class="m-x" id="signinX" aria-label="Close">&times;</button>
    <div id="signinAsk">
      <div class="m-head"><img class="m-mark" src="/icons/curator-c.svg" alt="">
        <div class="m-title">Curator&rsquo;s Note</div></div>
      <div class="m-rule"><span class="m-fleuron">&#10086;</span></div>
      <div class="m-say">Before I begin &mdash; where shall I send your work?
          I&rsquo;ll email you a link to sign in. There is no password to remember.
          <span class="sig">&mdash;&thinsp;C.</span></div>
      <label class="signin-lbl" for="signinEmail">Email</label>
      <input class="signin-in" id="signinEmail" type="email" autocomplete="email"
             placeholder="you@example.com" spellcheck="false">
      <div class="signin-err" id="signinErr"></div>
      <div class="acts"><div class="btn fill" id="signinSend">Continue with email</div></div>
      <div class="acts"><div class="btn fill" id="signinGoogle" role="button" tabindex="0">Continue with Google</div></div>
      <div class="m-safe">Nothing is charged until your piece is crafted.</div>
    </div>
    <div id="signinSent" hidden>
      <div class="m-head"><img class="m-mark" src="/icons/curator-c.svg" alt="">
        <div class="m-title">Curator&rsquo;s Note</div></div>
      <div class="m-rule"><span class="m-fleuron">&#10086;</span></div>
      <div class="m-say">The link is on its way to <b id="signinAddr"></b>.
          Open it and I&rsquo;ll have everything just as you left it &mdash; the
          link works on any device.<span class="sig">&mdash;&thinsp;C.</span></div>
      <div class="acts"><div class="btn fill" id="signinDone">Close</div></div>
    </div>
  </div>
</div>
`;
let modal,opener,nextPath;
export function open(next){
 if(document.getElementById('signinModal')&&typeof window.openSignin==='function'){window.openSignin();return;}
 if(!modal)install();nextPath=next||location.pathname+location.search+location.hash;opener=document.activeElement;
 modal.querySelector('#signinAsk').hidden=false;modal.querySelector('#signinSent').hidden=true;modal.querySelector('#signinErr').textContent='';modal.classList.add('is-open');modal.querySelector('#signinEmail').focus();
}
function install(){
 const style=document.createElement('link');style.rel='stylesheet';style.href='/signin-original.next.css';document.head.append(style);
 document.body.insertAdjacentHTML('beforeend',MARKUP);modal=document.getElementById('signinModal');
 const close=()=>{modal.classList.remove('is-open');opener?.focus();};
 modal.querySelector('#signinX').onclick=close;modal.querySelector('#signinDone').onclick=close;
 modal.addEventListener('click',e=>{if(e.target===modal)close();});
 const send=async(provider)=>{
 const email=modal.querySelector('#signinEmail').value.trim().toLowerCase(),error=modal.querySelector('#signinErr');
 if(!provider&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){error.textContent='That does not look like an email address.';return;}
 if(modal.dataset.pending==='1')return;modal.dataset.pending='1';error.textContent='';
 try{const r=await fetch('/api/v1/auth/signin',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(provider?{provider,next:nextPath}:{email,next:nextPath})});const d=await r.json();
 if(!r.ok||!d.ok){error.textContent=d.reason==='preview_email_disabled'?'Sign-in email disabled during Preview review.':'The link could not be sent. Try again in a moment.';return;}
 if(provider){if(d.url)location.assign(d.url);else error.textContent='Try again';return;}
 modal.querySelector('#signinAddr').textContent=email;modal.querySelector('#signinAsk').hidden=true;modal.querySelector('#signinSent').hidden=false;
 }catch(_){error.textContent='The link could not be sent. Try again in a moment.';}finally{delete modal.dataset.pending;}
 };
 for(const [id,provider] of [['signinSend',null],['signinGoogle','google']]){const button=modal.querySelector('#'+id);button.setAttribute('role','button');button.tabIndex=0;button.onclick=()=>send(provider);button.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();send(provider);}};}
 modal.querySelector('#signinEmail').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();send(null);}};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('is-open'))close();});
}
