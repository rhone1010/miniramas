// ==========================================================================
// portraits.wizard.js
// Step controller. THE ROUTE SEAM LIVES HERE.
// Liten & Co — extracted from portraits r77 (2026-07-22)
// ==========================================================================

/* Wizard step engine — one controller: upload -> frame -> picks (-> tier -> pay, upcoming).
   Folds in upload/crop. Route-backed steps (analyze, curate-effects, checkout) wire in the repo. */
(function(){
  var STEPS=['upload','frame','picks','pay'];
  var LABELS={upload:'Upload',frame:'Frame',picks:'Picks',pay:'Pay'};
  var BUILT={upload:1,frame:1,picks:1,pay:1};
  var NOTES={
    frame:'A good one. Frame it the way you\u2019d like it kept \u2014 we\u2019ll sort out who to craft next.',
    picks:'Here are finishes I\u2019d choose. Tap any to add them \u2014 or open Design your own to shape it yourself.',
    pay:'Payment is the next step. In the studio build this hands off to secure checkout.'
  };
  var EFFECTS=[
    {id:'walnut',label:'Walnut'},{id:'bronze',label:'Bronze'},{id:'alabaster',label:'Alabaster'},
    {id:'ebony',label:'Ebony'},{id:'stone',label:'Stone'},{id:'iron',label:'Iron'},
    {id:'impressionist',label:'Impressionist'},{id:'torn_paper',label:'Torn Paper'},{id:'mercury',label:'Mercury'},
    {id:'deep_sea',label:'Deep Sea'},{id:'nebula_resin',label:'Nebula Resin'},{id:'dragon_skin',label:'Dragon Skin'},
    {id:'amber',label:'Amber'},{id:'armor',label:'Armor'},{id:'blown_glass',label:'Blown Glass'},
    {id:'charcoal_chalk',label:'Charcoal & Chalk'},{id:'circuit',label:'Circuit'},{id:'fantasy_crystal',label:'Fantasy Crystal'},
    {id:'folded_book',label:'Folded Book'},{id:'magic_energy',label:'Magic Energy'},{id:'neon',label:'Neon'},
    {id:'pencil_sketch',label:'Pencil Sketch'},{id:'reclaimed_bronze',label:'Reclaimed Bronze'},{id:'sheet_music',label:'Sheet Music'}
  ];
  function src(id){ return '/previews/portraits/'+id+'/1.jpg'; }
  var SHOWCASE=EFFECTS.slice(0,12);
  var SUGGEST=EFFECTS.slice(0,5);
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var file=document.getElementById('s1file');
  var card=document.querySelector('.upload-card');
  var inv=document.querySelector('.inv-letter');
  var note=document.getElementById('curNote');
  var crop=document.getElementById('curCrop');
  var img=document.getElementById('s1img');
  var grid=document.getElementById('stageGrid');
  var cycleBtn=document.getElementById('cycleBtn');
  var pickHint=document.getElementById('pickHint');
  var hintTimer=null;
  function hideHint(){ if(hintTimer){clearTimeout(hintTimer);hintTimer=null;} if(pickHint){ pickHint.classList.remove('show'); setTimeout(function(){ if(pickHint&&!pickHint.classList.contains('show'))set(pickHint,false); },320); } }
  function armHint(){ if(hintTimer)clearTimeout(hintTimer); hintTimer=setTimeout(function(){ if(!bag.length){ set(pickHint,true); requestAnimationFrame(function(){ if(pickHint)pickHint.classList.add('show'); }); } }, 3000); }
  var stepsEl=document.getElementById('wzSteps');
  var cont=document.getElementById('s1continue');
  var curSource=document.getElementById('curSource');
  var srcThumb=document.getElementById('srcThumb');
  var changePhoto=document.getElementById('changePhoto');
  var another=document.getElementById('s1another');
  var pback=document.getElementById('picksBack');
  var railTbc=document.getElementById('railTbc');
  var railCollection=document.getElementById('railCollection');
  var tbcPills=document.getElementById('tbcPills');
  var tbcPrice=document.getElementById('tbcPrice');
  var tbcMsg=document.getElementById('tbcMsg');
  var tbcCraft=document.getElementById('tbcCraft');
  var payStage=document.getElementById('payStage');
  var payItems=document.getElementById('payItems');
  var payTierLabel=document.getElementById('payTierLabel');
  var payTotal=document.getElementById('payTotal');
  var payBtn=document.getElementById('payBtn');
  var payBack=document.getElementById('payBack');
  var nameStage=document.getElementById('nameStage');
  var nameList=document.getElementById('nameList');
  var nameMsg=document.getElementById('nameMsg');
  var nameContinue=document.getElementById('nameContinue');
  var nameBack=document.getElementById('nameBack');

  var CAP=10;
  var PCT={1:0,2:.10,3:.15,4:.20,5:.25,6:.26,7:.27,8:.28,9:.29,10:.30};
  function pct(n){ return PCT[Math.min(n,CAP)]||0; }
  function orderTotal(n){ return Math.round(4.99*n*(1-pct(n))*100)/100; }
  var bag=[];

  var step='upload', url=null, pick=null, timers=[], transitioning=false;
  function set(el,show){ if(el) el.hidden=!show; }
  function clearTimers(){ timers.forEach(function(t){clearInterval(t);clearTimeout(t);}); timers=[]; }

  function indicator(){
    if(!stepsEl)return;
    var cur=STEPS.indexOf(step);
    stepsEl.innerHTML=STEPS.map(function(s,i){
      var cls='wzstep'+(i<cur?' done':'')+(i===cur?' on':'')+(!BUILT[s]?' soon':'');
      return '<span class="'+cls+'"><i></i>'+LABELS[s]+'</span>';
    }).join('');
  }
  function cell(e){ return '<img class="show" src="'+src(e.id)+'" alt=""><span class="plabel"><span class="pl-nm">'+e.label+'</span><span class="pl-add">+</span></span>'; }

  /* deal the suggested grid onto the stage (no cycling showcase) */
  var cycleTimer=null;
  var cycleLocked=false;
  function revealCycleAfter(ms){ if(cycleLocked){ if(cycleBtn)set(cycleBtn,true); return; } if(cycleTimer)clearTimeout(cycleTimer); if(cycleBtn)set(cycleBtn,false); cycleTimer=setTimeout(function(){ if(cycleBtn){ set(cycleBtn,true); cycleLocked=true; } }, ms); }
  function dealSuggestions(){
    buildSuggestions();
    if(cycleBtn&&!cycleLocked)set(cycleBtn,false);
    if(reduce){ revealCycleAfter(2000); return; }
    var nw=[].slice.call(grid.querySelectorAll('.scard'));
    nw.forEach(function(c){ c.style.opacity='0'; });
    requestAnimationFrame(function(){ dealIn(nw); });
    revealCycleAfter(1500+5000); /* deal lands ~1.5s, then +3s */
  }

  /* suggested stage — static 3x2: 5 picks + Add All 5 (adds all to To Be Crafted) */
  function buildSuggestions(){
    grid.innerHTML='';
    SUGGEST.forEach(function(e,i){
      var c=document.createElement('div');
      c.className='scard pick'+(inBag(e)?' added':'');
      c.innerHTML=cell(e);
      c.addEventListener('click',function(){ togglePick(c,e); });
      bindTilt(c);
      grid.appendChild(c);
    });
    var a=document.createElement('div');
    a.className='scard addall';
    a.innerHTML='<span class="aa-plus">+</span><span class="aa-lbl">Add All 5</span>';
    a.addEventListener('click',function(){ addAll(); });
    grid.appendChild(a);
  }
  function bindTilt(c){
    c.addEventListener('mousemove',function(e){
      if(transitioning)return;
      var r=c.getBoundingClientRect();
      var px=(e.clientX-r.left)/r.width-0.5, py=(e.clientY-r.top)/r.height-0.5;
      c.style.setProperty('--tx',(px*5).toFixed(2)+'deg');
      c.style.setProperty('--ty',(-py*5).toFixed(2)+'deg');
    });
    c.addEventListener('mouseleave',function(){ c.style.setProperty('--tx','0deg'); c.style.setProperty('--ty','0deg'); });
  }

  /* naming — AI suggestion + client moderation (real AI call + server gate incl. child-safety wire in repo) */
  var NAME_A=['Quiet','Evening','First','Golden','Still','Soft','Late','Morning','Long','Amber','Fair','Gentle'];
  var NAME_N=['Study','Light','Hour','Portrait','Likeness','Sitting','Reverie','Repose','Sketch','Moment'];
  function aiName(){ return NAME_A[Math.floor(Math.random()*NAME_A.length)]+' '+NAME_N[Math.floor(Math.random()*NAME_N.length)]; }
  var BANNED=['fuck','shit','cunt','bitch','slut','nazi'];
  function moderate(raw){
    var t=(raw||'').replace(/\s+/g,' ').trim();
    if(!t) return {ok:true, clean:'Untitled portrait'};
    for(var i=0;i<BANNED.length;i++){ if(new RegExp('\\b'+BANNED[i]+'\\b','i').test(t)) return {ok:false}; }
    return {ok:true, clean:t.length>60?t.slice(0,60):t};
  }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  /* To Be Crafted bag */
  function inBag(e){ for(var i=0;i<bag.length;i++){ if(bag[i].id===e.id&&bag[i].label===e.label)return true; } return false; }
  function togglePick(c,e){
    hideHint();
    if(inBag(e)){ bag=bag.filter(function(x){return !(x.id===e.id&&x.label===e.label);}); c.classList.remove('added'); }
    else { if(bag.length>=CAP){ note.textContent='That\u2019s the full set of ten \u2014 The Studio. Craft these, then start another.'; return; } bag.push({id:e.id,label:e.label,name:aiName()}); c.classList.add('added'); }
    renderTBC();
  }
  function addAll(){
    hideHint();
    SUGGEST.forEach(function(e){ if(!inBag(e)&&bag.length<CAP){ bag.push({id:e.id,label:e.label,name:aiName()}); } });
    [].slice.call(grid.querySelectorAll('.scard.pick')).forEach(function(c,i){ if(inBag(SUGGEST[i]))c.classList.add('added'); });
    renderTBC();
  }
  function tierLabel(n){ return n>=CAP?'The Studio':(n+' image'+(n>1?'s':'')); }
  function renderTBC(){
    var n=bag.length;
    set(railTbc, n>0);
    set(railCollection, n<=0);
    if(tbcMsg)tbcMsg.textContent='';
    if(!n){ if(tbcPills)tbcPills.innerHTML=''; if(tbcPrice)tbcPrice.innerHTML=''; return; }
    tbcPills.innerHTML=bag.map(function(e,i){
      return '<div class="tbc-pill"><span class="dot"></span>'+
        '<span class="pn" contenteditable="true" spellcheck="false" data-i="'+i+'">'+esc(e.name)+'</span>'+
        '<span class="reroll" data-i="'+i+'" title="Suggest another name">\u21bb</span>'+
        '<span class="x" data-i="'+i+'">\u00d7</span>'+
        '<span class="pf">'+e.label+'</span></div>';
    }).join('');
    [].slice.call(tbcPills.querySelectorAll('.x')).forEach(function(x){
      x.addEventListener('click',function(){ var i=+x.getAttribute('data-i'); bag.splice(i,1); refreshAddedState(); renderTBC(); });
    });
    [].slice.call(tbcPills.querySelectorAll('.reroll')).forEach(function(r){
      r.addEventListener('click',function(){ var i=+r.getAttribute('data-i'); bag[i].name=aiName(); renderTBC(); });
    });
    [].slice.call(tbcPills.querySelectorAll('.pn')).forEach(function(el){
      el.addEventListener('keydown',function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); el.blur(); } });
      el.addEventListener('blur',function(){
        var i=+el.getAttribute('data-i'); var r=moderate(el.textContent);
        if(r.ok){ bag[i].name=r.clean; el.textContent=r.clean; if(tbcMsg)tbcMsg.textContent=''; }
        else { el.textContent=bag[i].name; if(tbcMsg){ tbcMsg.textContent='Please choose a different name'; setTimeout(function(){ if(tbcMsg)tbcMsg.textContent=''; },2600);} }
      });
    });
    var p=Math.round(pct(n)*100);
    tbcPrice.innerHTML='<div class="tbc-tier"><span class="lbl">'+tierLabel(n)+'</span>'+(p?'<span class="pct">\u2212'+p+'%</span>':'')+'</div>'+
      '<div class="tbc-tot">$'+orderTotal(n).toFixed(2)+'</div>'+
      (n>=CAP?'<div class="tbc-cap">Full set \u00b7 ten</div>':'');
  }
  function refreshAddedState(){
    [].slice.call(grid.querySelectorAll('.scard.pick')).forEach(function(c,i){ c.classList.toggle('added', SUGGEST[i]&&inBag(SUGGEST[i])); });
  }

  /* Pay — embedded-style, line items = pieces, count-tier total, email native to Stripe */
  function buildPay(){
    var n=bag.length||1;
    payItems.innerHTML=bag.map(function(e){ return '<div class="pay-item"><span class="pi-left"><span class="pi-dot"></span><span class="pi-name">'+esc(e.name)+'</span></span><span>$4.99</span></div>'; }).join('');
    var p=Math.round(pct(n)*100);
    payTierLabel.innerHTML=tierLabel(n)+(p?'<span class="pct">\u2212'+p+'%</span>':'');
    var tot='$'+orderTotal(n).toFixed(2);
    payTotal.textContent=tot;
    payBtn.disabled=false; payBtn.textContent='Pay '+tot;
    var note2=payStage&&payStage.querySelector('.pay-note'); if(note2)note2.textContent='Email is collected at secure checkout \u2014 wires to Stripe in the studio build.';
    revealPay();
  }
  function revealPay(){
    if(reduce)return;
    var cardEl=payStage&&payStage.querySelector('.paycard');
    try{ payStage.animate([{opacity:0},{opacity:1}],{duration:220,easing:'ease-out'}); }catch(e){}
    if(cardEl){ try{ cardEl.animate([
      {opacity:0,transform:'translateY(16px) scale(.985)'},
      {opacity:1,transform:'translateY(0) scale(1)'}
    ],{duration:380,easing:'cubic-bezier(.25,1,.3,1)'}); }catch(e){} }
  }

  /* dealt art-cards transition — gather old to a hand, deal new onto the table */
  function dealIn(cards){
    var gr=grid.getBoundingClientRect();
    var ox=gr.left+gr.width*0.14, oy=gr.top+gr.height*0.10;
    cards.forEach(function(c,i){
      var r=c.getBoundingClientRect();
      var cx=r.left+r.width/2, cy=r.top+r.height/2;
      var dx=ox-cx, dy=oy-cy, rot=(i%2===0?-4:4);
      var mx=dx*0.42+(i%2===0?16:-16), my=dy*0.5-20;
      var a=c.animate([
        {transform:'perspective(900px) translate('+dx+'px,'+dy+'px) scale(.88) rotate('+rot+'deg)',opacity:0,offset:0},
        {transform:'perspective(900px) translate('+mx+'px,'+my+'px) scale(.94) rotate('+(rot*0.4)+'deg)',opacity:1,offset:.55},
        {transform:'perspective(900px) translate(0,0) scale(1) rotate(0deg)',opacity:1,offset:1}
      ],{duration:1000,delay:i*100,easing:'cubic-bezier(.25,1,.3,1)',fill:'both'});
      a.onfinish=function(){ try{a.cancel();}catch(e){} c.style.transform=''; c.style.opacity=''; };
    });
  }
  function gather(cards,done){
    var n=cards.length; if(!n){ if(done)done(); return; }
    var gr=grid.getBoundingClientRect();
    var gx=gr.left+gr.width*0.9, gy=gr.top+gr.height*0.06, fin=0;
    cards.forEach(function(c,i){
      var r=c.getBoundingClientRect();
      var cx=r.left+r.width/2, cy=r.top+r.height/2;
      var dx=gx-cx, dy=gy-cy, rot=(i%2===0?5:-6)+(i-2)*1.4;
      var a=c.animate([
        {transform:'perspective(900px) translate(0,0) scale(1) rotate(0deg)',opacity:1,offset:0},
        {transform:'perspective(900px) translate('+(dx*0.28)+'px,'+(dy*0.28-12)+'px) scale(.98) rotate('+(rot*0.4)+'deg)',opacity:1,offset:.65},
        {transform:'perspective(900px) translate('+dx+'px,'+dy+'px) scale(.94) rotate('+rot+'deg)',opacity:0,offset:1}
      ],{duration:640,delay:i*48,easing:'cubic-bezier(.5,0,.78,.38)',fill:'both'});
      a.onfinish=function(){ fin++; if(fin===n&&done)done(); };
    });
  }
  function crossfade(builder){
    [].slice.call(grid.querySelectorAll('.scard')).forEach(function(c){ c.animate([{opacity:1},{opacity:0}],{duration:175,fill:'forwards'}); });
    setTimeout(function(){
      builder();
      [].slice.call(grid.querySelectorAll('.scard')).forEach(function(c){
        c.style.opacity='0';
        var a=c.animate([{opacity:0},{opacity:1}],{duration:175,fill:'forwards'});
        a.onfinish=function(){ c.style.opacity=''; };
      });
      transitioning=false; if(cycleBtn)cycleBtn.disabled=false;
    },185);
  }
  function transitionTo(builder){
    if(transitioning) return;
    transitioning=true; if(cycleBtn)cycleBtn.disabled=true;
    if(reduce){ crossfade(builder); return; }
    gather([].slice.call(grid.querySelectorAll('.scard')),function(){
      setTimeout(function(){
        builder();
        var nw=[].slice.call(grid.querySelectorAll('.scard'));
        nw.forEach(function(c){ c.style.opacity='0'; });
        requestAnimationFrame(function(){
          dealIn(nw);
          setTimeout(function(){ transitioning=false; if(cycleBtn)cycleBtn.disabled=false; }, 1000+(nw.length-1)*100+120);
        });
      },140);
    });
  }
  function cycleEffects(){
    if(transitioning) return;
    hideHint();
    var pool=EFFECTS.slice(), picks=[], used={};
    while(picks.length<5){ var e=pool[Math.floor(Math.random()*pool.length)]; if(!used[e.id]){used[e.id]=1;picks.push(e);} }
    SUGGEST=picks; transitionTo(buildSuggestions); armHint(); revealCycleAfter(2520+5000);
  }

  function render(){
    set(card, step==='upload');
    set(inv, step==='upload');
    set(note, step==='frame'||step==='picks');
    set(crop, step==='frame');
    set(curSource, step==='picks' && !!url);
    if(url&&srcThumb)srcThumb.src=url;
    if(step==='picks'){ if(cycleLocked)set(cycleBtn,true); } else set(cycleBtn,false);
    set(grid, step==='upload'||step==='frame'||step==='picks'||step==='pay');
    set(payStage, step==='pay');
    renderTBC();
    if(step==='frame')note.textContent=NOTES.frame;
    if(step==='picks')note.textContent=NOTES.picks;
    indicator();
  }
  function go(s){
    var prev=step; step=s; render();
    if(s==='pay'){ buildPay(); }
  }

  function openPicker(){file.value='';file.click();}
  function enterCrop(f){if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(f);img.src=url;if(srcThumb)srcThumb.src=url;go('frame');}
  function resetToUpload(){if(url){URL.revokeObjectURL(url);url=null;}img.src='';go('upload');}

  if(card)card.addEventListener('click',openPicker);
  if(file)file.addEventListener('change',function(){var f=file.files&&file.files[0];if(f)enterCrop(f);});
  if(cont)cont.addEventListener('click',function(){go('picks');});
  if(another)another.addEventListener('click',function(){resetToUpload();openPicker();});
  if(changePhoto)changePhoto.addEventListener('click',function(){openPicker();});
  /* Name your pieces — visible prompt between Craft and Pay */
  function nameRowHtml(e,i){
    return '<div class="name-row" data-i="'+i+'">'+
      '<div class="nnf"><span class="nd"></span>'+e.label+'</div>'+
      '<div class="name-field">'+
        '<input class="name-inp" data-i="'+i+'" placeholder="Name your piece" value="'+esc(e.name||'').replace(/"/g,'&quot;')+'">'+
        '<button class="name-reroll" data-i="'+i+'" title="Suggest another name">\u21bb <span>suggest</span></button>'+
      '</div></div>';
  }
  function rerenderNames(){ nameList.innerHTML=bag.map(function(e,i){ return nameRowHtml(e,i); }).join(''); wireNameRows(); }
  function wireNameRows(){
    [].slice.call(nameList.querySelectorAll('.name-inp')).forEach(function(inp){
      inp.addEventListener('input',function(){ var i=+inp.getAttribute('data-i'); bag[i].name=inp.value; inp.style.borderColor=''; });
      inp.addEventListener('blur',function(){
        var i=+inp.getAttribute('data-i'); var r=moderate(inp.value);
        if(r.ok){ bag[i].name=r.clean; inp.style.borderColor=''; nameMsg.textContent=''; }
        else { inp.style.borderColor='var(--oxblood)'; nameMsg.textContent='Please choose a different name'; }
      });
    });
    [].slice.call(nameList.querySelectorAll('.name-reroll')).forEach(function(rr){
      rr.addEventListener('click',function(){ var i=+rr.getAttribute('data-i'); bag[i].name=aiName(); var inp=nameList.querySelector('.name-inp[data-i="'+i+'"]'); if(inp){ inp.value=bag[i].name; inp.style.borderColor=''; } nameMsg.textContent=''; });
    });
  }
  function openNaming(){
    if(!bag.length)return;
    rerenderNames(); nameMsg.textContent='';
    set(nameStage,true);
  }
  if(tbcCraft)tbcCraft.addEventListener('click',function(){ openNaming(); });
  if(nameBack)nameBack.addEventListener('click',function(){ set(nameStage,false); });
  if(nameContinue)nameContinue.addEventListener('click',function(){
    var bad=false;
    bag.forEach(function(e,i){
      var r=moderate(e.name||'');
      if(r.ok){ e.name=r.clean; } else { bad=true; var inp=nameList.querySelector('.name-inp[data-i="'+i+'"]'); if(inp)inp.style.borderColor='var(--oxblood)'; }
    });
    if(bad){ nameMsg.textContent='Please choose a different name for the highlighted piece.'; return; }
    set(nameStage,false); go('pay');
  });
  if(payBack)payBack.addEventListener('click',function(){go('picks');});
  if(payBtn)payBtn.addEventListener('click',function(){ craftSequence(); });
  if(cycleBtn)cycleBtn.addEventListener('click',cycleEffects);

  /* ===== craft -> crafting -> My Collection ===== */
  var SERIES=['View All','Portraits','Houses','Groups','Pets','Landscapes','Action','Mobile Wallpapers'];
  var collection=[];  // crafted pieces this session: {label,id,fresh}
  var SEED=[
    {name:'Marcus',id:'stone',label:'Stone',pick:true},
    {name:'Amara',id:'walnut',label:'Walnut'},
    {name:'Emily',id:'nebula_resin',label:'Nebula Resin'},
    {name:'Daniel',id:'reclaimed_bronze',label:'Reclaimed Bronze'}
  ];
  var SETS=[
    {key:'earth-and-ore',      name:'Earth & Ore',       hero:'portrait-bust',     of:5, unlock:'Molten Gold & Iron Veins', have:[], desc:'Discover timeless materials shaped by earth, metal, and craftsmanship.', complete:'Collect all five foundational material effects to unlock Molten Gold & Iron Veins.', effects:['Bronze','Iron','Stone','Walnut','Alabaster']},
    {key:'curiosities',        name:'Curiosities',       hero:'portrait-bust',     of:6, unlock:'Prismatic Specimen',      have:[], desc:'Assemble a cabinet of rare wonders, mysterious artifacts, and impossible materials.', complete:'Collect all six curiosity effects to unlock Prismatic Specimen.', effects:['Amber Inclusion','Blown Art Glass','Enchanted Crystal','Fantasy Crystal','Nebula Resin','Driftwood & Resin']},
    {key:'artists-gallery',    name:'Artists Gallery',   hero:'portrait-bust',     of:5, unlock:'Museum Masterpiece',      have:[], desc:'Build a gallery celebrating history’s greatest artistic styles and traditions.', complete:'Collect every featured artistic effect to unlock Museum Masterpiece.', effects:['Impressionist','Watercolor','Charcoal & Chalk','Pen & Ink','Pencil Sketch']},
    {key:'best-friends',       name:'Best Friends',      hero:'pets-cat-dog',      of:5, unlock:'Shared Adventure',        have:[], desc:'Celebrate the joy, loyalty, and unforgettable bond between people and their companions.', complete:'Collect all five companion-themed effects to unlock Shared Adventure.', effects:['Plushy','Regal','Sailor','Elizabethan Ruff','Garden Statue']},
    {key:'foundations',        name:'Foundations',       hero:'house-gold-leaf',   of:5, unlock:"Architect's Blueprint",    have:[], desc:'Explore the craftsmanship, structure, and beauty behind extraordinary architecture.', complete:'Collect all five architectural effects to unlock Architect’s Blueprint.', effects:['Carved Wood','Carved Stone','Glass','Wax','Marble']},
    {key:'seasons-of-home',    name:'Seasons of Home',   hero:'house-gold-leaf',   of:8, unlock:'Four Seasons',            have:[], desc:'Experience every season as your home transforms through the passage of time.', complete:'Collect all eight seasonal and story effects to unlock Four Seasons.', effects:['Spring','Summer','Fall','Winter','Haunted','Fire','Explosion','Abandoned'], prestige:true},
    {key:'stories-of-home',    name:'Stories of Home',   hero:'house-gold-leaf',   of:5, unlock:'Living Memories',         have:[], desc:'Every home has a story waiting to be discovered.', complete:'Collect all five story-inspired effects to unlock Living Memories.', effects:['Dollhouse','Gingerbread','Snow Globe','Film Noir','Daguerreotype']},
    {key:'natures-canvas',     name:"Nature's Canvas",   hero:'landscape',         of:5, unlock:'Living Landscape',        have:[], desc:'Where landscapes, forests, mountains, and rivers become works of art.', complete:'Collect all five nature-inspired effects to unlock Living Landscape.', effects:['Topiary','Stained Glass','Driftwood & Resin','Wood','Ceramic']},
    {key:'motion-and-momentum',name:'Motion & Momentum', hero:'action-skateboard', of:7, unlock:'Energy Trails',           have:[], desc:'Capture the power, speed, and energy of movement in every creation.', complete:'Collect all seven action effects to unlock Energy Trails.', effects:['Resin','Metals','Bronze','Terracotta','Ceramic','Wax','Wood'], prestige:true},
    {key:'together',           name:'Together',          hero:'groups-three-busts',of:6, unlock:'Legacy Edition',          have:[], desc:'A celebration of the finest creations from across the entire Litenco collection.', complete:'Collect all six featured effects to unlock Legacy Edition.', effects:['Cubism','Art Nouveau','Ukiyo-e','Chocolate','Pewter','Folded Book']}
  ];
  var crafting=document.getElementById('crafting');
  var craftBar=document.getElementById('craftBar');
  var craftSub=document.getElementById('craftSub');
  var craftTitle=document.getElementById('craftTitle');
  var collView=document.getElementById('collView');
  var stageEl=document.querySelector('.stage');
  var navCollection=document.getElementById('navCollection');
  var navWorkshop=document.getElementById('navWorkshop');

  function craftSequence(){
    if(!bag.length)return;
    payBtn.disabled=true; payBtn.textContent='Processing\u2026';
    set(payStage,false);
    var pieces=bag.slice();
    set(crafting,true); craftBar.style.width='0'; craftTitle.textContent='Crafting '+pieces.length+' piece'+(pieces.length>1?'s':'')+'\u2026'; craftSub.textContent='Please hold a moment';
    var done=0, N=pieces.length;
    var iv=setInterval(function(){
      done++; craftBar.style.width=Math.min(100,Math.round(done/N*100))+'%';
      craftSub.textContent=done<=N?('Crafted '+done+' of '+N):'Finishing';
      if(done>=N){
        clearInterval(iv);
        setTimeout(function(){
          pieces.forEach(function(p){ collection.unshift({name:p.name||'Untitled',id:p.id,label:p.label,fresh:true}); });
          bag=[]; refreshAddedState(); renderTBC();
          set(crafting,false);
          go('picks');
          showCollection();
        },520);
      }
    }, 480);
  }

  function tabRow(active){
    return SERIES.map(function(s){ return '<div class="coll-tab'+(s===active?' on':'')+'">'+s+'</div>'; }).join('');
  }
  var collAll=[], featIndex=0;
  var selected={};
  function selCount(){ return Object.keys(selected).length; }
  function miniHtml(p,i){
    var t=esc((p.name||'Untitled')+' \u2014 '+p.label).replace(/"/g,'&quot;');
    return '<div class="mini'+(p.fresh?' fresh':'')+(selected[p.id]?' sel':'')+'" data-i="'+i+'" title="'+t+'">'+
      (p.pick?'<span class="pickdot" title="Curator\u2019s pick"></span>':'')+
      '<span class="mini-check" data-sel="'+i+'">\u2713</span>'+
      '<img src="'+src(p.id)+'" alt=""></div>';
  }
  function ensureBulkBar(){
    var cv=document.getElementById('collView');
    var bb=document.getElementById('bulkBar');
    if(!bb){ bb=document.createElement('div'); bb.id='bulkBar'; bb.className='bulkbar';
      bb.innerHTML='<span class="bcount"></span><button class="fill" data-b="dl">Download</button><button data-b="pr">Send to Print Shop</button><button class="bclear" data-b="cl">Clear</button>';
      cv.appendChild(bb);
      bb.addEventListener('click',function(e){ var b=e.target.getAttribute('data-b'); if(!b)return;
        if(b==='cl'){ selected={}; refreshSel(); }
        else if(b==='dl'){ var n=selCount(); e.target.textContent=n>1?('Downloading '+n+' as .zip \u2713'):'Downloading .jpg \u2713'; setTimeout(function(){ e.target.textContent='Download'; },1500); }
        else if(b==='pr'){ var n2=selCount(); e.target.textContent='Sent '+n2+' to Print Shop \u2713'; setTimeout(function(){ e.target.textContent='Send to Print Shop'; },1600); }
      });
    }
    return bb;
  }
  function updateBulk(){
    var bb=ensureBulkBar(); var n=selCount();
    bb.querySelector('.bcount').textContent=n+' selected';
    bb.classList.toggle('show', n>0);
  }
  function refreshSel(){
    [].slice.call(document.querySelectorAll('.mini')).forEach(function(m){
      var i=+m.getAttribute('data-i'); var p=collAll[i];
      if(p) m.classList.toggle('sel', !!selected[p.id]);
    });
    updateBulk();
  }
  function wireChecks(scope){
    [].slice.call((scope||document).querySelectorAll('.mini-check')).forEach(function(c){
      c.addEventListener('click',function(e){ e.stopPropagation();
        var i=+c.getAttribute('data-sel'); var p=collAll[i]; if(!p)return;
        if(selected[p.id])delete selected[p.id]; else selected[p.id]=true;
        refreshSel();
      });
    });
  }
  function renderLatest(){
    collAll=collection.map(function(p){return {name:p.name,id:p.id,label:p.label,fresh:true};}).concat(SEED);
    var mini=collAll.map(function(p,i){ return miniHtml(p,i); }).join('');
    document.getElementById('collLatest').innerHTML='<div class="feat" id="featBox"></div><div class="mini-col"><div class="minimap" id="miniBox">'+mini+'</div><div class="feat-acts"><button class="cv-act fill" id="actDownload">Download</button><button class="cv-act" id="actPrint">Send to Print Shop</button></div></div>';
    [].slice.call(document.querySelectorAll('#miniBox .mini')).forEach(function(m){
      m.addEventListener('click',function(){ setFeatured(+m.getAttribute('data-i')); });
    });
    wireChecks(document.getElementById('miniBox')); updateBulk();
    var fb=document.getElementById('featBox');
    if(fb)fb.addEventListener('click',function(){ openLightbox(featIndex); });
    var ad=document.getElementById('actDownload'), ap=document.getElementById('actPrint');
    if(ad)ad.addEventListener('click',function(){ ad.textContent='Downloaded \u2713'; setTimeout(function(){ ad.textContent='Download'; },1400); });
    if(ap)ap.addEventListener('click',function(){ ap.textContent='Sent to Print Shop \u2713'; setTimeout(function(){ ap.textContent='Send to Print Shop'; },1600); });
    setFeatured(0);
  }
  function setFeatured(i){
    if(!collAll[i])return; featIndex=i; var p=collAll[i];
    var box=document.getElementById('featBox');
    box.className='feat'+(p.fresh?' fresh':'');
    box.innerHTML='<img src="'+src(p.id)+'" alt="">'+
      '<div class="feat-meta"><div class="feat-nm">'+esc(p.name||'Untitled')+'</div>'+
      '<div class="feat-fx">'+p.label+(p.fresh?' \u00b7 crafted today':'')+'</div>'+
      '<div class="feat-hint">Click to view full &rarr;</div></div>';
    [].slice.call(document.querySelectorAll('#miniBox .mini')).forEach(function(m,mi){ m.classList.toggle('on', mi===i); });
  }
  function setsRows(){
    return SETS.map(function(st){
      var slots=st.have.map(function(id){ return '<div class="slot"><img src="'+src(id)+'" alt=""></div>'; }).join('');
      for(var g=0,gn=st.of-st.have.length;g<gn;g++) slots+='<div class="slot ghost">+</div>';
      slots+='<div class="slot unlock"><div class="u">Unlock</div><div class="n">'+st.unlock+'</div><div class="f">free</div></div>';
      var have=st.have.length;
      return '<div class="strip"><div class="info"><div class="sn">'+st.name+'</div><div class="pg">'+have+' OF '+st.of+'</div><a class="cta">Craft the rest \u2192</a></div><div class="slots">'+slots+'</div></div>';
    }).join('');
  }
  function renderSideSet(){
    // promo card: feature the set with the most owned effects (tie -> first)
    var st=SETS.reduce(function(a,c){ return c.have.length>a.have.length?c:a; }, SETS[0]);
    var have=st.have.length, total=st.of, acc=ACCENT[st.key]||'#b68a53';
    var inset=RWINSET[st.key];
    var art = inset ? '<img class="cs-art" src="/rewards-insets/'+inset+'.png" alt="">' : '<div class="cs-art reserve"></div>';
    var segs=''; for(var i=0;i<total;i++) segs+='<div class="cs-seg'+(i<have?' on':'')+'"></div>';
    var box=document.getElementById('collSets');
    box.style.setProperty('--acc',acc);
    box.innerHTML=
      '<div class="cs-nm">'+st.name+'</div>'+
      '<div class="cs-reward">'+art+'</div>'+
      '<div class="cs-rnm">'+st.unlock+'</div>'+
      '<div class="cs-sub">Exclusive Set Effect</div>'+
      '<div class="cs-prog"><div class="cs-segs">'+segs+'</div><div class="cs-ct">'+have+' / '+total+' Effects</div></div>'+
      '<a class="cs-cta">Complete this Set \u2192</a>';
    var cta=box.querySelector('.cs-cta');
    if(cta)cta.addEventListener('click',openSets);
  }
  /* ===== YOUR SETS — full view ===== */
  var setsView=document.getElementById('setsView');
  var BG='/backgrounds/', HERO='/icons/';
  var ACCENT={
    'earth-and-ore':'#c08a3e','artists-gallery':'#8a3d3d','curiosities':'#3f8f7d',
    'best-friends':'#7f9a4a','foundations':'#b0965f','seasons-of-home':'#9a7db0',
    'stories-of-home':'#9e7b4f','natures-canvas':'#6b8a4a','motion-and-momentum':'#6a83a0','together':'#5a6aa0'
  };
  var RWINSET={
    'earth-and-ore':'molten-gold-iron-veins','artists-gallery':'museum-masterpiece','curiosities':'prismatic-specimen',
    'best-friends':null,'foundations':null,'seasons-of-home':'four-seasons','stories-of-home':'living-memories',
    'natures-canvas':'living-landscape','motion-and-momentum':'energy-trails','together':'legacy-edition'
  };
  function hexRgba(h,a){ h=h.replace('#',''); var r=parseInt(h.substr(0,2),16),g=parseInt(h.substr(2,2),16),b=parseInt(h.substr(4,2),16); return 'rgba('+r+','+g+','+b+','+a+')'; }
  function slug(n){ return n.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); }
  /* map set-effect display names to real Portraits preview ids where one exists;
     unmapped names (future-series / not-yet-built effects) fall back to a slug and 404 until assets land */
  var EFFECT_ID={
    'Bronze':'bronze','Iron':'iron','Stone':'stone','Walnut':'walnut','Alabaster':'alabaster',
    'Impressionist':'impressionist','Charcoal & Chalk':'charcoal_chalk','Pencil Sketch':'pencil_sketch',
    'Amber Inclusion':'amber','Blown Art Glass':'blown_glass','Fantasy Crystal':'fantasy_crystal',
    'Nebula Resin':'nebula_resin','Folded Book':'folded_book'
  };
  function effId(nm){ return EFFECT_ID[nm]||slug(nm); }
  var TROPHY='<svg viewBox="0 0 24 24"><path d="M7 4h10v3a5 5 0 01-10 0z"/><path d="M7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3"/><path d="M12 12v4M9 20h6M10 20l.5-4h3l.5 4"/></svg>';
  var featKey=null, browsePage=0;
  function pageSize(){ return window.innerWidth<1500?2:4; }
  var CHK='<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 6"/></svg>';
  var CHEV='<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>';
  // per-set enamel-plaque CTA: [light, base, dark, accent]
  var CTAMAP={
    'earth-and-ore':['#C88A44','#B67B3A','#7A522B','#E0B066'],
    'curiosities':['#4E8E80','#3F7668','#29544B','#63A694'],
    'artists-gallery':['#A25055','#914449','#6B2D30','#B86D71'],
    'best-friends':['#849C5A','#73874D','#526339','#A5BE73'],
    'foundations':['#AC8E56','#92784A','#6A5635','#C7A066'],
    'seasons-of-home':['#8E6FB0','#775B96','#554069','#B298D4'],
    'stories-of-home':['#AC7A58','#94664A','#6A4A34','#C99973'],
    'natures-canvas':['#5E8D65','#4D7853','#35553A','#7FB587'],
    'motion-and-momentum':['#5A81C0','#4A6EA8','#334A73','#79A7EA'],
    'together':['#B5904E','#977A3E','#6A5330','#D8C078']
  };
  function setCard(st,mode){
    var acc=ACCENT[st.key]||'#b68a53';
    var owned=st.have.length, total=st.of, remaining=total-owned, done=remaining<=0;
    var CTA=CTAMAP[st.key]||CTAMAP['earth-and-ore'];
    var vars='--acc:'+acc+';--acc-soft:'+hexRgba(acc,.22)+';--acc-mid:'+hexRgba(acc,.42)+';--acc-strong:'+hexRgba(acc,.34)+
      ';--cta-light:'+CTA[0]+';--cta-base:'+CTA[1]+';--cta-dark:'+CTA[2]+';--cta-acc:'+CTA[3]+';--cta-glow:'+hexRgba(CTA[3],.20);
    var footer='';
    if(mode==='featured'){
      var missing=st.effects.filter(function(nm,idx){ return idx>=owned; });
      var pills=missing.map(function(nm){return '<span class="pill">'+nm+'</span>';}).join('');
      footer='<div class="svc-footer">'+
        (st.complete?'<div class="svc-complete">'+st.complete+'</div>':'')+
        '<div class="svc-pills">'+pills+'</div></div>';
    }
    var header='<div class="svc-header" style="background-image:url(/backgrounds/'+st.key+'.jpg)">'+
      '<div class="svc-title">'+st.name+'</div>'+
      (mode==='featured'?'<div class="svc-desc">'+(st.desc||'')+'</div>':'')+
      footer+
      (st.prestige?'<div class="svc-prestige">Prestige</div>':'')+'</div>';
    var inset=RWINSET[st.key];
    var art = inset ? '<img class="rw-art" src="/rewards-insets/'+inset+'.png" alt="">' : '<div class="rw-art reserve"></div>';
    var rlbl = done ? '<div class="rw-lbl unlocked">'+TROPHY+'Reward Unlocked</div>' : '<div class="rw-lbl">'+TROPHY+'Exclusive Reward</div>';
    var reward='<div class="svc-reward"><div class="rw-text">'+rlbl+
      '<div class="rw-nm">'+st.unlock+'</div><div class="rw-sub">Exclusive Set Effect</div></div>'+art+'</div>';
    var segs=''; for(var i=0;i<total;i++) segs+='<div class="seg'+(i<owned?' on':'')+'"></div>';
    var prog='<div class="svc-seg"><div class="segs">'+segs+'</div><div class="ct"><b>'+owned+' / '+total+'</b> Effects</div></div>';
    var cta = done
      ? '<div class="svc-cta done"><span class="l">Set complete</span><span class="r">All effects crafted</span></div>'
      : '<div class="svc-cta" data-set="'+st.key+'"><span class="l">Complete this Set</span><span class="r">Craft '+remaining+' more to unlock '+CHEV+'</span></div>';
    return '<div class="svcard '+mode+'" data-key="'+st.key+'" style="'+vars+'">'+header+
      '<div class="svc-body">'+reward+prog+cta+'</div></div>';
  }
  function renderSets(){
    var g=document.getElementById('svGrid'); if(!g)return;
    if(!featKey) featKey=SETS[0].key;
    var feat=SETS.filter(function(s){return s.key===featKey;})[0]||SETS[0];
    var pool=SETS.filter(function(s){return s.key!==featKey;});
    var ps=pageSize(), pages=Math.max(1,Math.ceil(pool.length/ps));
    if(browsePage>pages-1)browsePage=pages-1; if(browsePage<0)browsePage=0;
    var items=pool.slice(browsePage*ps,browsePage*ps+ps);
    var browse=items.map(function(st){return setCard(st,'browse');}).join('');
    g.innerHTML='<div class="sv-body">'+
      '<div class="sv-featured">'+setCard(feat,'featured')+'</div>'+
      '<div class="sv-browse-wrap">'+
        '<button class="sv-arrow" id="svPrev"'+(browsePage<=0?' disabled':'')+'><svg viewBox="0 0 24 40"><path d="M18 2 L4 20 L18 38 Z"/></svg></button>'+
        '<div class="sv-browse">'+browse+'</div>'+
        '<button class="sv-arrow" id="svNext"'+(browsePage>=pages-1?' disabled':'')+'><svg viewBox="0 0 24 40"><path d="M6 2 L20 20 L6 38 Z"/></svg></button>'+
      '</div></div>';
    var prev=document.getElementById('svPrev'), next=document.getElementById('svNext');
    if(prev)prev.onclick=function(){ if(browsePage>0){browsePage--;renderSets();} };
    if(next)next.onclick=function(){ if(browsePage<pages-1){browsePage++;renderSets();} };
    // click a browse card -> promote to featured
    [].slice.call(g.querySelectorAll('.svcard.browse')).forEach(function(c){
      c.addEventListener('click',function(){ featKey=c.getAttribute('data-key'); browsePage=0; renderSets(); });
    });
  }
  function openSets(){ renderSets(); setsView.classList.add('open'); }
  function closeSets(){ setsView.classList.remove('open'); }
  var svBack=document.getElementById('svBack');
  if(svBack)svBack.addEventListener('click',closeSets);
  function renderAllGrid(){
    var grid=collAll.map(function(p,i){ return miniHtml(p,i); }).join('');
    document.getElementById('collLatest').innerHTML='<div class="allgrid" id="allGrid">'+grid+'</div>';
    var ag=document.getElementById('allGrid');
    [].slice.call(ag.querySelectorAll('.mini')).forEach(function(m){
      m.addEventListener('click',function(){ openLightbox(+m.getAttribute('data-i')); });
    });
    wireChecks(ag); updateBulk();
  }
  function renderCollection(){
    document.getElementById('collTabs').innerHTML=tabRow('Portraits');
    renderLatest();
    renderSideSet();
    var line=document.getElementById('collLine');
    line.textContent=collection.length?('Freshly crafted \u2014 '+collection.length+' new piece'+(collection.length>1?'s':'')+' in your collection.'):'Your crafted pieces live here.';
    [].slice.call(document.querySelectorAll('.coll-tab')).forEach(function(t){
      t.addEventListener('click',function(){ [].slice.call(document.querySelectorAll('.coll-tab')).forEach(function(x){x.classList.remove('on')}); t.classList.add('on');
        if(t.textContent==='View All') renderAllGrid(); else renderLatest();
      });
    });
  }

  /* Lightbox — full-height piece view */
  var lightbox=document.getElementById('lightbox');
  var lbImg=document.getElementById('lbImg');
  var lbName=document.getElementById('lbName');
  var lbFx=document.getElementById('lbFx');
  var lbIndex=0;
  function paintLightbox(){
    var p=collAll[lbIndex]; if(!p)return;
    lbImg.src=src(p.id);
    lbName.textContent=p.name||'Untitled';
    lbFx.textContent=p.label+(p.fresh?' \u00b7 crafted today':'');
  }
  function openLightbox(i){ lbIndex=i; paintLightbox(); if(lightbox){ lightbox.hidden=false; lightbox.style.display='flex'; } }
  function closeLightbox(){ if(lightbox){ lightbox.hidden=true; lightbox.style.display='none'; } }
  function lbStep(d){ if(!collAll.length)return; lbIndex=(lbIndex+d+collAll.length)%collAll.length; paintLightbox(); }
  var lbClose=document.getElementById('lbClose'), lbPrev=document.getElementById('lbPrev'), lbNext=document.getElementById('lbNext');
  if(lbClose)lbClose.addEventListener('click',closeLightbox);
  if(lbPrev)lbPrev.addEventListener('click',function(){lbStep(-1);});
  if(lbNext)lbNext.addEventListener('click',function(){lbStep(1);});
  if(lightbox)lightbox.addEventListener('click',function(e){ if(e.target===lightbox)closeLightbox(); });
  document.addEventListener('keydown',function(e){
    if(lightbox.hidden)return;
    if(e.key==='Escape')closeLightbox();
    else if(e.key==='ArrowLeft')lbStep(-1);
    else if(e.key==='ArrowRight')lbStep(1);
  });
  function showCollection(){
    closeSets();
    renderCollection();
    collView.classList.add('open');
    if(navWorkshop)navWorkshop.classList.remove('on'); if(navCollection)navCollection.classList.add('on');
  }
  function showWorkshop(){
    closeSets();
    collView.classList.remove('open');
    if(navCollection)navCollection.classList.remove('on'); if(navWorkshop)navWorkshop.classList.add('on');
  }
  document.addEventListener('keydown',function(e){ if(e.key==='Escape' && setsView.classList.contains('open')) closeSets(); });
  if(navCollection)navCollection.addEventListener('click',function(e){e.preventDefault();showCollection();});
  if(navWorkshop)navWorkshop.addEventListener('click',function(e){e.preventDefault();showWorkshop();});

  dealSuggestions();
  armHint();
  render();
})();
