// ==========================================================================
// portraits.ui.js
// UI behavior ported from r77. Contains NO backend calls.
// Liten & Co — extracted from portraits r77 (2026-07-22)
// ==========================================================================

/* ---- r77 script block 0 ---- */
/* graceful asset fallback — only fires when a preview/logo asset is missing (review outside the repo).
   In the repo these paths resolve to real assets and this never runs. */
(function(){
  var FB="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'%3E%3Crect%20width='100'%20height='100'%20fill='%23e3d8c1'/%3E%3C/svg%3E";
  document.addEventListener('error',function(e){
    var t=e.target;
    if(!t||t.tagName!=='IMG'||t.getAttribute('data-fb')==='1')return;
    t.setAttribute('data-fb','1');
    if(t.classList.contains('logo-img')){
      t.style.display='none';
      var fb=t.parentNode.querySelector('.logo-fb');
      if(fb)fb.style.display='inline-flex';
    }else{
      t.src=FB;
    }
  },true);
})();

/* ---- r77 script block 1 ---- */
/* advanced panel — swatches, setting, framing, resolution ledger, live recipe */
var ICONMAP={
 ebony:'/icons/Icon_Effect__0000_Ebony.png', walnut:'/icons/Icon_Effect__0001_Walnut.png', stone:'/icons/Icon_Effect__0002_Stone.png',
 bronze:'/icons/Icon_Effect__0003_Bronze.png', iron:'/icons/Icon_Effect__0004_Iron.png', alabaster:'/icons/Icon_Effect__0005_Alabaster.png',
 impressionist:'/icons/Icon_Effect__0006_Impressionist.png', torn_paper:'/icons/Icon_Effect__0007_Torn-Paper.png', folded_book:'/icons/Icon_Effect__0008_Folded-Book.png',
 charcoal_chalk:'/icons/Icon_Effect__0009_Charcoal.png', pencil_sketch:'/icons/Icon_Effect__0010_Pencil-Sketch.png', sheet_music:'/icons/Icon_Effect__0011_Sheet-Music.png',
 deep_sea:'/icons/Icon_Effect__0012_Deep-Sea.png', circuit:'/icons/Icon_Effect__0013_Circuit.png', reclaimed_bronze:'/icons/Icon_Effect__0014_Reclaimed-Bronze.png',
 mercury:'/icons/Icon_Effect__0015_Mercury.png', blown_glass:'/icons/Icon_Effect__0016_Blown-Glass.png', amber:'/icons/Icon_Effect__0017_Amber.png',
 neon:'/icons/Icon_Effect__0018_Neon.png', nebula_resin:'/icons/Icon_Effect__0019_Nebula.png', dragon_skin:'/icons/Icon_Effect__0020_Dragon-Skin.png',
 magic_energy:'/icons/Icon_Effect__0021_Magic-Energy.png', fantasy_crystal:'/icons/Icon_Effect__0022_Fantasy-Crystal.png', armor:'/icons/Icon_Effect__0023_Armor.png'
};
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
var advState={mat:'walnut',set:'on a mantel',frame:'signature pose',base:4.99,extra:0};
function renderSwatches(group){
  var el=document.getElementById('advSwatches');el.innerHTML='';
  MATS[group].forEach(function(m){
    var ic=ICONMAP[m[0]]||('/previews/portraits/'+m[0]+'/1.jpg');
    var d=document.createElement('div');
    d.className='swatch'+(advState.mat===m[0].replace(/_/g,' ')||advState.mat===m[1].toLowerCase()?' on':'');
    d.setAttribute('data-nm',m[1].toLowerCase());
    d.innerHTML='<img class="disc" src="'+ic+'" alt="'+m[1]+'"><span class="nm">'+m[1]+'</span>';
    d.onclick=function(){
      [].slice.call(el.children).forEach(function(x){x.classList.remove('on')});
      d.classList.add('on');advState.mat=m[1].toLowerCase();advRecipe();
    };
    el.appendChild(d);
  });
}
[].slice.call(document.querySelectorAll('#advModes button')).forEach(function(b){
  b.onclick=function(){
    [].slice.call(document.querySelectorAll('#advModes button')).forEach(function(x){x.classList.remove('on')});
    b.classList.add('on');renderSwatches(b.getAttribute('data-g'));
  };
});
renderSwatches('earth');
function advMoney(n){return '$'+n.toFixed(2)}
function advRecipe(){
  document.getElementById('advRecipe').innerHTML='A <span class="w">'+advState.mat+'</span> portrait, <span class="w">'+advState.set+'</span>, <span class="w">'+advState.frame+'</span>.';
  document.getElementById('advAdd').textContent='Add this piece \u00B7 '+advMoney(advState.base+advState.extra);
}
function advWire(id,key){
  var root=document.getElementById(id);
  [].slice.call(root.children).forEach(function(el){
    el.addEventListener('click',function(){
      [].slice.call(root.children).forEach(function(x){x.classList.remove('on')});
      el.classList.add('on');advState[key]=el.getAttribute('data-nm');advRecipe();
    });
  });
}
advWire('advGlyphs','set');advWire('advFrames','frame');
[].slice.call(document.querySelectorAll('#advLedger .lrow')).forEach(function(r){
  r.addEventListener('click',function(){
    [].slice.call(document.querySelectorAll('#advLedger .lrow')).forEach(function(x){x.classList.remove('on')});
    r.classList.add('on');advState.extra=parseFloat(r.getAttribute('data-p'));advRecipe();
  });
});
advRecipe();

/* ---- r77 script block 3 ---- */
/* Advanced panel — starts CLOSED (collapsed rail); opens on click, closes on the rail chevron. */
(function(){
  var adv=document.getElementById('adv');
  var open=document.getElementById('advOpen');
  var close=document.getElementById('advClose');
  function syncAdvW(){ document.documentElement.style.setProperty('--adv-w', adv.getBoundingClientRect().width+'px'); }
  if(open)open.addEventListener('click',function(){adv.classList.remove('closed'); setTimeout(syncAdvW,10); setTimeout(syncAdvW,420);});
  if(close)close.addEventListener('click',function(){adv.classList.add('closed'); setTimeout(syncAdvW,10); setTimeout(syncAdvW,420);});
})();

/* ---- r77 script block 4 ---- */
/* deckle — curator card only */
(function(){
  var CURATOR_SCALE=5.5;
  function applyDeckle(el,fill,fid,rx){
    if(!el||el.querySelector(':scope > .deckle-paper'))return;
    var NS='http://www.w3.org/2000/svg';
    var svg=document.createElementNS(NS,'svg');
    svg.setAttribute('class','deckle-paper');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('viewBox','0 0 100 100');
    var rect=document.createElementNS(NS,'rect');
    rect.setAttribute('rx',rx==null?6:rx);rect.setAttribute('fill',fill);rect.setAttribute('stroke','#c4b48f');rect.setAttribute('stroke-width','1.2');
    rect.setAttribute('filter','url(#'+fid+')');
    svg.appendChild(rect);el.insertBefore(svg,el.firstChild);el.classList.add('has-deckle');
    el._dk={svg:svg,rect:rect};sizeDeckle(el);
    if(typeof ResizeObserver!=='undefined'){new ResizeObserver(function(){sizeDeckle(el)}).observe(el);}
  }
  function sizeDeckle(el){
    var d=el._dk;if(!d)return;var w=el.offsetWidth,h=el.offsetHeight;if(!w||!h)return;
    var INS=Math.max(2,Math.ceil(CURATOR_SCALE)+2);
    d.svg.setAttribute('viewBox','0 0 '+w+' '+h);
    d.rect.setAttribute('x',INS);d.rect.setAttribute('y',INS);
    d.rect.setAttribute('width',Math.max(0,w-2*INS));d.rect.setAttribute('height',Math.max(0,h-2*INS));
  }
  function boot(){
    applyDeckle(document.querySelector('.curator'),'#ece2d0','curatorDeckle',6);
    requestAnimationFrame(function(){
      Array.prototype.forEach.call(document.querySelectorAll('.has-deckle'),function(e){sizeDeckle(e)});
    });
  }
  if(document.fonts&&document.fonts.ready){document.fonts.ready.then(boot);setTimeout(boot,80);}
  else{window.addEventListener('load',boot);}
})();
