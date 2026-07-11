
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
