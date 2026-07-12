
/* mural crossfade — slow rotation through the preview pool, one offset per tile */
var MATS={
 earth:[['ebony','Ebony','/previews/portraits/PLACEHOLDER.jpg'],['walnut','Walnut','/previews/portraits/PLACEHOLDER.jpg'],['stone','Stone','/previews/portraits/PLACEHOLDER.jpg'],
        ['bronze','Bronze','/previews/portraits/PLACEHOLDER.jpg'],['iron','Iron','/previews/portraits/PLACEHOLDER.jpg'],['alabaster','Alabaster','/previews/portraits/PLACEHOLDER.jpg']],
 artists:[['impressionist','Impressionist','/previews/portraits/PLACEHOLDER.jpg'],['torn_paper','Torn Paper','/previews/portraits/PLACEHOLDER.jpg'],
          ['folded_book','Folded Book','/previews/portraits/PLACEHOLDER.jpg'],['charcoal_chalk','Charcoal & Chalk','/previews/portraits/PLACEHOLDER.jpg'],
          ['pencil_sketch','Pencil Sketch','/previews/portraits/PLACEHOLDER.jpg'],['sheet_music','Sheet Music','/previews/portraits/PLACEHOLDER.jpg']],
 curios:[['deep_sea','Deep Sea','/previews/portraits/PLACEHOLDER.jpg'],['circuit','Circuit','/previews/portraits/PLACEHOLDER.jpg'],
         ['armor','Armor','/previews/portraits/PLACEHOLDER.jpg'],['mercury','Mercury','/previews/portraits/PLACEHOLDER.jpg'],
         ['blown_glass','Blown Glass','/previews/portraits/PLACEHOLDER.jpg'],['amber','Amber','/previews/portraits/PLACEHOLDER.jpg'],
         ['neon','Neon','/previews/portraits/PLACEHOLDER.jpg'],['nebula_resin','Nebula Resin','/previews/portraits/PLACEHOLDER.jpg'],
         ['dragon_skin','Dragon Skin','/previews/portraits/PLACEHOLDER.jpg'],['magic_energy','Magic Energy','/previews/portraits/PLACEHOLDER.jpg'],
         ['fantasy_crystal','Fantasy Crystal','/previews/portraits/PLACEHOLDER.jpg'],['reclaimed_bronze','Reclaimed Bronze','/previews/portraits/PLACEHOLDER.jpg']]
};
/* Advanced disc grid uses the Icon_Effect set (MASTER-LOCKED §9: icons are ONLY
   the disc grid; render previews are for the mural/collection). Keys → files. */
var ICON={
 ebony:'/Icons/Icon_Effect__0000_Ebony.png', walnut:'/Icons/Icon_Effect__0001_Walnut.png',
 stone:'/Icons/Icon_Effect__0002_Stone.png', bronze:'/Icons/Icon_Effect__0003_Bronze.png',
 iron:'/Icons/Icon_Effect__0004_Iron.png', alabaster:'/Icons/Icon_Effect__0005_Alabaster.png',
 impressionist:'/Icons/Icon_Effect__0006_Impressionist.png', torn_paper:'/Icons/Icon_Effect__0007_Torn-Paper.png',
 folded_book:'/Icons/Icon_Effect__0008_Folded-Book.png', charcoal_chalk:'/Icons/Icon_Effect__0009_Charcoal.png',
 pencil_sketch:'/Icons/Icon_Effect__0010_Pencil-Sketch.png', sheet_music:'/Icons/Icon_Effect__0011_Sheet-Music.png',
 deep_sea:'/Icons/Icon_Effect__0012_Deep-Sea.png', circuit:'/Icons/Icon_Effect__0013_Circuit.png',
 reclaimed_bronze:'/Icons/Icon_Effect__0014_Reclaimed-Bronze.png', mercury:'/Icons/Icon_Effect__0015_Mercury.png',
 blown_glass:'/Icons/Icon_Effect__0016_Blown-Glass.png', amber:'/Icons/Icon_Effect__0017_Amber.png',
 neon:'/Icons/Icon_Effect__0018_Neon.png', nebula_resin:'/Icons/Icon_Effect__0019_Nebula.png',
 dragon_skin:'/Icons/Icon_Effect__0020_Dragon-Skin.png', magic_energy:'/Icons/Icon_Effect__0021_Magic-Energy.png',
 fantasy_crystal:'/Icons/Icon_Effect__0022_Fantasy-Crystal.png', armor:'/Icons/Icon_Effect__0023_Armor.png'
};
var advState={mat:'walnut',set:'on a mantel',frame:'signature pose',base:4.99,extra:0};
/* ── ENGINE HOOKS ── the proto panel is presentational; these route each control
   to the live engine's state functions (defined by the inline engine). Earth&Ore
   and Artists discs set the base material; Curiosities are experimental finishes
   that queue directly (engine requires an uploaded photo first). */
function engineDisc(group,key){
  if(group==='curios'){ if(typeof queueExperimental==='function') queueExperimental(key); return; }
  if(typeof selectMat==='function') selectMat(key);
}
function renderSwatches(group){
  var el=document.getElementById('advSwatches');el.innerHTML='';
  MATS[group].forEach(function(m){
    var d=document.createElement('div');
    d.className='swatch'+(advState.mat===m[0].replace(/_/g,' ')||advState.mat===m[1].toLowerCase()?' on':'');
    d.setAttribute('data-nm',m[1].toLowerCase());
    d.innerHTML='<img class="disc" src="'+(ICON[m[0]]||'')+'" alt="'+m[1]+'" onerror="this.style.visibility=\'hidden\'"><span class="nm">'+m[1]+'</span>';
    d.onclick=function(){
      [].slice.call(el.children).forEach(function(x){x.classList.remove('on')});
      d.classList.add('on');advState.mat=m[1].toLowerCase();advRecipe();
      engineDisc(group,m[0]);   /* HOOK → engine material / experimental */
    };
    el.appendChild(d);
  });
}
[].slice.call(document.querySelectorAll('#advModes button')).forEach(function(b){
  b.onclick=function(){
    [].slice.call(document.querySelectorAll('#advModes button')).forEach(function(x){x.classList.remove('on')});
    b.classList.add('on');
    var g=b.getAttribute('data-g');
    if(g!=='curios'&&typeof onSeriesClick==='function') onSeriesClick(g==='artists'?'artists_gallery':'realistic');   /* HOOK → engine series */
    renderSwatches(g);
  };
});
renderSwatches('earth');
function advMoney(n){return '$'+n.toFixed(2)}
function advRecipe(){
  document.getElementById('advRecipe').innerHTML='A <span class="w">'+advState.mat+'</span> portrait, <span class="w">'+advState.set+'</span>, <span class="w">'+advState.frame+'</span>.';
  document.getElementById('advAdd').textContent='Add this piece \u00B7 '+advMoney(advState.base+advState.extra);
}
function advWire(id,key,hook){
  var root=document.getElementById(id);
  [].slice.call(root.children).forEach(function(el){
    el.addEventListener('click',function(){
      [].slice.call(root.children).forEach(function(x){x.classList.remove('on')});
      el.classList.add('on');advState[key]=el.getAttribute('data-nm');advRecipe();
      if(hook) hook(el.getAttribute('data-nm'));
    });
  });
}
advWire('advGlyphs','set',function(nm){var m={'on a mantel':'mantel','on a pedestal':'pedestal','on a gradient':'gradient'}[nm];if(m&&typeof onLocationPick==='function')onLocationPick(m);});   /* HOOK → engine location */
advWire('advFrames','frame',function(nm){var m={'bust framing':'bust','signature pose':'signature','statuesque':'statuesque'}[nm];if(m&&typeof selectFramingV2==='function')selectFramingV2(m);});   /* HOOK → engine framing */
[].slice.call(document.querySelectorAll('#advLedger .lrow')).forEach(function(r){
  r.addEventListener('click',function(){
    [].slice.call(document.querySelectorAll('#advLedger .lrow')).forEach(function(x){x.classList.remove('on')});
    r.classList.add('on');advState.extra=parseFloat(r.getAttribute('data-p'));advRecipe();
    var res={'0':'1k','2':'2k','4.99':'4k'}[r.getAttribute('data-p')];if(res&&typeof onResolutionPick==='function')onResolutionPick(res);   /* HOOK → engine resolution */
  });
});
advRecipe();
/* Add-this-piece → engine queue; and sync the engine's default selection to the
   proto's default active disc ('walnut') so engine state matches the UI before
   the first click. */
var advAddBtn=document.getElementById('advAdd');
if(advAddBtn) advAddBtn.addEventListener('click',function(){if(typeof addToQueue==='function')addToQueue();});   /* HOOK → engine addToQueue */
if(typeof selectMat==='function') selectMat('walnut');
var POOL=[
 {img:'/previews/portraits/PLACEHOLDER.jpg',label:'Mercury'},
 {img:'/previews/portraits/PLACEHOLDER.jpg',label:'Dragon Skin'},
 {img:'/previews/portraits/PLACEHOLDER.jpg',label:'Pencil Sketch'},
 {img:'/previews/portraits/PLACEHOLDER.jpg',label:'Charcoal & Chalk'},
 {img:'/previews/portraits/PLACEHOLDER.jpg',label:'Nebula Resin'},
 {img:'/previews/portraits/PLACEHOLDER.jpg',label:'Bronze'},
 {img:'/previews/portraits/PLACEHOLDER.jpg',label:'Stone'}
];
/* independent rhythms: no two tiles share a clock, no simultaneous switches,
   and no image appears on two tiles at once */
var HOLDS=[5200,6700,8100,9400];
var OFFSETS=[0,1600,3400,5200];
var tiles=[].slice.call(document.querySelectorAll('#mural .mt'));
var current=[0,1,2,3];
tiles.forEach(function(t,ti){
  POOL.forEach(function(p,pi){
    var d=document.createElement('div');d.className='slide'+(pi===current[ti]?' show':'');
    d.innerHTML='<img src="/previews/portraits/'+p.label.toLowerCase().replace(/ & /g,"_").replace(/ /g,"_")+'/1.jpg" alt="" onerror="this.style.visibility=\'hidden\'"><figcaption>'+p.label+'</figcaption>';
    t.appendChild(d);
  });
});
var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function advance(ti){
  var next=current[ti];
  do{ next=(next+1)%POOL.length; }while(current.indexOf(next)>=0);
  current[ti]=next;
  var slides=tiles[ti].querySelectorAll('.slide');
  for(var i=0;i<slides.length;i++)slides[i].classList.toggle('show',i===next);
  setTimeout(function(){advance(ti)},HOLDS[ti]);
}
if(!reduce){
  tiles.forEach(function(t,ti){
    setTimeout(function(){advance(ti)},HOLDS[ti]+OFFSETS[ti]);
  });
}

/* ── Punch-list #4 (2026-07-11) — restore preview crossfade on the SUGGESTED grid
   tiles. Same mechanism as the empty-state mural: each tile gently cycles through
   its effect's available renders (/previews/portraits/<preset>/N.jpg). The engine
   (renderEffectCards) paints tiles into #curEffectCards; we observe it and attach a
   crossfade per tile. Reduced-motion => tiles stay static. Overlays (Add/magnify/
   name/pick) sit after the slides in the DOM, so they stay on top. */
(function(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var grid = document.getElementById('curEffectCards');
  if(!grid) return;
  function attach(card, ci){
    if(card.getAttribute('data-xf')) return;
    var host = card.querySelector('.v7-rec-img');
    var img  = host && host.querySelector('img');
    if(!img) return;
    var m = (img.getAttribute('src')||'').match(/\/previews\/portraits\/([a-z0-9_]+)\/(\d+)\.(jpg|png)/i);
    if(!m) return;
    card.setAttribute('data-xf','1');
    if(reduce) return;                         /* present but static under reduced-motion */
    var preset=m[1], loaded=parseInt(m[2],10), ext=m[3], N=4;
    var cs=window.getComputedStyle(host); if(cs.position==='static') host.style.position='relative';
    img.style.transition='opacity .9s ease';
    var slides=[img], anchor=img.nextSibling;
    for(var i=1;i<=N;i++){
      if(i===loaded) continue;                 /* the engine already loaded this render */
      var s=document.createElement('img');
      s.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .9s ease';
      (function(sl){ sl.onerror=function(){ sl.setAttribute('data-dead','1'); }; })(s);
      s.src='/previews/portraits/'+preset+'/'+i+'.'+ext;
      host.insertBefore(s, anchor);
      slides.push(s);
    }
    if(slides.length<2) return;                /* nothing to cycle */
    var cur=0;
    function step(){
      var tries=0,next=cur;
      do{ next=(next+1)%slides.length; tries++; }while(slides[next].getAttribute('data-dead') && tries<=slides.length);
      cur=next;
      for(var i=0;i<slides.length;i++) slides[i].style.opacity=(i===cur)?'1':'0';
      setTimeout(step, 5200+(ci%4)*600);       /* staggered, no two tiles in lockstep */
    }
    setTimeout(step, 4200+(ci%4)*600);
  }
  function scan(){ [].slice.call(grid.querySelectorAll('.v7-rec-card')).forEach(attach); }
  new MutationObserver(scan).observe(grid,{childList:true});
  scan();
})();
