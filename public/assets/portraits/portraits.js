
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
var advState={mat:'walnut',set:'on a mantel',frame:'signature pose',base:4.99,extra:0};
function renderSwatches(group){
  var el=document.getElementById('advSwatches');el.innerHTML='';
  MATS[group].forEach(function(m){
    var d=document.createElement('div');
    d.className='swatch'+(advState.mat===m[0].replace(/_/g,' ')||advState.mat===m[1].toLowerCase()?' on':'');
    d.setAttribute('data-nm',m[1].toLowerCase());
    d.innerHTML='<img class="disc" src="'+m[2]+'" alt="'+m[1]+'"><span class="nm">'+m[1]+'</span>';
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
    d.innerHTML='<img src="'+p.img+'" alt=""><figcaption>'+p.label+'</figcaption>';
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
