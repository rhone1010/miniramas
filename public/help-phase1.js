/* Help Phase 1: Account shell and controls, shared Concierge, existing Collection APIs. */
(function(){
'use strict';
var shell = "  <section class=\"acct\" id=\"helpStage\" aria-hidden=\"true\" aria-label=\"Help\">\n    <div class=\"mc-head\">\n      <button class=\"mc-close\" id=\"helpClose\" type=\"button\">\n        <svg viewBox=\"0 0 16 16\" aria-hidden=\"true\"><path d=\"M10 3 5 8l5 5\"/></svg>\n        Back to the workshop\n      </button>\n      <span class=\"mc-title\">Help</span>\n      <span class=\"mc-n\" id=\"helpWho\"></span>\n    </div>\n\n    <!-- Cards, not a sidebar. Five sections behind five clicks was hiding\n         four of them. -->\n    <div class=\"ac-main\" id=\"helpMain\"></div>\n  </section>";
document.body.insertAdjacentHTML('beforeend', shell);
var stage=document.getElementById('helpStage'), main=document.getElementById('helpMain');
var artwork=[], selected=null, requestId=null, epoch=0, busy=false;
var issues={likeness:"Doesn't look like the subject",details:'Important details are wrong',quality:'Poor-quality result',other:'Something else'};
var remedies={redo:'Redo Artwork',refund:"I'd prefer a refund",contact:'Talk to us'};
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function button(text,action){return '<button class="ac-second" type="button" data-help="'+action+'">'+esc(text)+'</button>'}
function card(title,copy,action){return '<div class="ac-card"><h3>'+esc(title)+'</h3><p class="note">'+esc(copy)+'</p><div class="ac-acts">'+button(title,action)+'</div></div>'}
function chat(topic,caseId){window.Concierge.openForHelp({topic:topic,caseId:caseId||null})}
function close(){epoch++;stage.classList.remove('is-open');stage.setAttribute('aria-hidden','true');if(location.pathname==='/help')history.replaceState({},'','/discovery')}
function open(){var acct=document.getElementById('acct');if(acct){acct.classList.remove('is-open');acct.setAttribute('aria-hidden','true')}stage.classList.add('is-open');stage.setAttribute('aria-hidden','false');landing()}
function header(title){return '<div class="ac-head"><h2>'+esc(title)+'</h2><div class="ac-acts">'+button('Help','home')+button('Ask Concierge','chat')+'</div></div>'}
function landing(){epoch++;main.innerHTML='<div class="ac-head"><h2>How can we help?</h2></div><div class="ac-cards">'+
 card('Learn & Explore','Get more from Liten & Co','learn')+card('Support','Something not working?','support')+card('Make It Right','Not happy with your artwork?','remedy')+'</div><div class="ac-acts">'+button('Ask Concierge','chat')+'</div>'}
var faqs=[
 ['Photography guidance','Use a clear photograph where the subject is easy to see. The Curator will help you choose once you are inside.'],
 ['Crafting','Upload a photograph, choose a finish, and we craft a portrait from it. Portraits and Pets have their own existing effect selections in their workshops.'],
 ['Collection Unlocks','Reusable unlocks are account-level credits used on locked eligible Collection pieces, one unlock per piece, and never expire. Packages: 1 for $2.99, 3 for $7.99, 5 for $12.99, 10 for $19.99. Included unlocks stay with their original collection.'],
 ['Unlock All of My Collection','10–19 locked pieces: $1.79 each. 20+ locked pieces: $1.59 each. This purchases the specific eligible locked set included at checkout and creates no reusable credits.'],
 ['My Collection','An unlocked piece is owned and its clean artwork is available to download. Already-owned pieces are excluded from Unlock All.'],
 ['Printing','Print Shop is not available yet.'],
 ['Accounts','Sign in with Google or an email link. There is no password to remember.'],
 ['What if I don’t like what I get?','Select artwork → identify issue → select requested resolution. Redo Artwork, I’d prefer a refund, or Talk to us. Requests are reviewed; submitting a request does not redo artwork or issue a refund.']
];
function learn(){epoch++;main.innerHTML=header('Learn & Explore')+'<div class="ac-card">'+faqs.map(function(f){return '<details class="q" name="help-faq"><summary class="q-btn"><span class="mk">✦</span>'+esc(f[0])+'</summary><div class="q-body"><p>'+esc(f[1])+'</p><div class="ac-acts">'+button('Ask Concierge','chat')+'</div></div></details>'}).join('')+'</div>'}
function support(){epoch++;main.innerHTML=header('Support')+'<div class="ac-card"><h3>Something not working?</h3><div class="ac-acts">'+['Payments','Missing artwork','Sign-in','Downloads','Technical issues'].map(function(s){return button(s,'topic:'+s)}).join('')+button('Bug Report','bug')+button('Talk to us','message')+'</div></div>'}
async function json(url,options){var r=await fetch(url,Object.assign({credentials:'same-origin',cache:'no-store'},options||{}));var d=await r.json();if(!r.ok)throw new Error(d.reason||d.error||'unavailable');return d}
function receipt(c){return '<div class="ac-row"><span class="what">'+esc(issues[c.issue])+' · '+esc(remedies[c.requested_remedy])+'</span><span>'+esc(c.status)+'</span></div><p class="ac-gap">'+esc(c.id)+'</p>'}
async function remedy(){
 var ticket=++epoch;selected=null;requestId=null;
 main.innerHTML=header('Make It Right')+'<p class="ac-gap" role="status">Loading…</p>';
 try{
  var account=await json('/api/v1/account');if(!account.user)throw new Error('auth_required');
  var lists=await Promise.all([json('/api/v1/portfolios'),json('/api/v1/portraits/pieces?all=1'),json('/api/v1/support')]);
  var portfolios=await Promise.all(lists[0].portfolios.map(function(p){return json('/api/v1/portfolios/'+encodeURIComponent(p.id)+'/status')}));
  if(ticket!==epoch)return;
  artwork=[];
  portfolios.forEach(function(p){p.items.forEach(function(i){if(i.status==='done'&&i.previewId)artwork.push({kind:'portfolio',id:i.previewId,portfolioId:p.portfolioId,label:p.series+' · '+i.preset+' · '+(i.slot+1),image:i.previewUrl})})});
  (lists[1].pieces||[]).forEach(function(p){artwork.push({kind:'piece',id:p.id,label:p.label||p.series+' · '+p.preset,image:p.image_url})});
  main.innerHTML=header('Make It Right')+'<div class="ac-card"><h3>Select artwork</h3>'+(!artwork.length?'<p class="ac-gap">Nothing here yet.</p>':'<select class="ac-nav" id="helpArtwork" aria-label="Select artwork"><option value="">Select artwork</option>'+artwork.map(function(p,i){return '<option value="'+i+'">'+esc(p.label)+'</option>'}).join('')+'</select><div id="helpSelected"></div>')+
   '<div class="ac-acts">'+button('Talk to us','message')+'</div></div><div id="helpCaseForm"></div><div class="ac-card"><h3>Make It Right</h3>'+(lists[2].cases||[]).map(receipt).join('')+'</div>';
 }catch(e){if(ticket!==epoch)return;main.innerHTML=header('Make It Right')+'<p class="ac-gap">'+(e.message==='auth_required'?'Sign in with Google or an email link.':'This could not be read just now.')+'</p><div class="ac-acts">'+button('Sign In','signin')+button('Talk to us','message')+'</div>'}
}
function selectArtwork(value){
 selected=value===''?null:artwork[Number(value)];requestId=null;
 document.getElementById('helpSelected').innerHTML=selected?'<div class="ac-item"><span class="ic"><img src="'+esc(selected.image||'')+'" alt=""></span><span class="body"><span class="t">'+esc(selected.label)+'</span></span></div>':'';
 document.getElementById('helpCaseForm').innerHTML=selected?'<form id="helpRequest" class="ac-card"><h3>Identify issue</h3><div class="ac-acts">'+Object.keys(issues).map(function(k){return '<label class="ac-nav"><input type="radio" name="issue" value="'+k+'" required> '+esc(issues[k])+'</label>'}).join('')+'</div><div class="describe-box"><textarea id="helpDetails" maxlength="4000" aria-label="What do you need?" placeholder="What do you need?"></textarea></div><h3>Select requested resolution</h3><div class="ac-acts">'+Object.keys(remedies).map(function(k){return '<label class="ac-nav"><input type="radio" name="remedy" value="'+k+'" required> '+esc(remedies[k])+'</label>'}).join('')+'</div><p class="ac-gap">Requests are reviewed; submitting a request does not redo artwork or issue a refund.</p><div class="ac-acts"><button class="ac-buy" type="submit">Send</button></div><p id="helpResult" class="ac-gap" role="status"></p></form>':'';
}
main.addEventListener('change',function(e){requestId=null;if(e.target.id==='helpArtwork')selectArtwork(e.target.value)});
main.addEventListener('input',function(){requestId=null});
main.addEventListener('submit',async function(e){
 if(e.target.id!=='helpRequest')return;e.preventDefault();if(busy||!selected)return;
 var form=e.target, values=new FormData(form), output=document.getElementById('helpResult');
 var issue=values.get('issue'),remedyChoice=values.get('remedy');
 requestId=requestId||crypto.randomUUID();busy=true;
 var fields=Array.from(form.elements);fields.forEach(function(f){f.disabled=true});
 var picker=document.getElementById('helpArtwork');picker.disabled=true;
 try{
  var d=await json('/api/v1/support',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   subject:'Make It Right',message:document.getElementById('helpDetails').value.trim()||issues[issue],context:{page:location.pathname},
   case:{requestId:requestId,artwork:{kind:selected.kind,id:selected.id,portfolioId:selected.portfolioId},issue:issue,remedy:remedyChoice}
  })});
  if(!d.ok)throw new Error(d.reason);output.textContent='Request received · '+d.ref;
  output.insertAdjacentHTML('afterend','<div class="ac-acts">'+button('Ask Concierge','case:'+d.ref)+'</div>');
 }catch(e){output.textContent=e.message==='too_many'?'That is a few messages in a short while — give us a chance to answer the first ones.':'This could not be read just now. Please try again.';fields.forEach(function(f){f.disabled=false})}
 finally{busy=false;picker.disabled=false}
});
main.addEventListener('click',function(e){
 var b=e.target.closest('[data-help]');if(!b)return;var a=b.dataset.help;
 if(a==='home')landing();else if(a==='learn')learn();else if(a==='support')support();else if(a==='remedy')remedy();
 else if(a==='chat')chat('Help');else if(a.startsWith('topic:'))chat(a.slice(6));else if(a.startsWith('case:'))chat('Make It Right',a.slice(5));
 else if(a==='message'){chat('Support');window.Concierge.message()}
 else if(a==='signin'){close();if(typeof openSignin==='function')openSignin()}
 else if(a==='bug'){close();if(window.LCFeedback)window.LCFeedback.open()}
});
document.getElementById('helpClose').addEventListener('click',close);
document.addEventListener('click',function(e){var a=e.target.closest('a[href="/help"],a[href="/help#make-it-right"]');if(a){e.preventDefault();window.Concierge.close();open();if(a.hash)remedy()}});
addEventListener('keydown',function(e){if(e.key==='Escape')close()});
window.LitenHelp={open:open,close:close,remedy:function(){open();remedy()}};
var mobileHelp=document.getElementById('mhHelp');if(mobileHelp)mobileHelp.addEventListener('click',function(e){e.stopImmediatePropagation();open()},true);
if(location.pathname==='/help'){open();if(location.hash==='#make-it-right')remedy()}
})();
