/* Rich's Print Shop phone flow. This adapter uses the existing print state and operations. */
window.initPrintPhone = function(api){
  if(location.pathname!=='/print'||new URLSearchParams(location.search).has('session'))return;
  const mq=matchMedia('(max-width:767px)');
  let stage=0, selecting=false, submitting=false, filter={series:'all',sort:'newest'},draft,selectionError='';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=api.money, names=['Select','Finish','Size','Review'];
  const root=document.createElement('main');root.id='printPhone';root.hidden=true;
  root.innerHTML='<div class="pm-fixed"><h1>PrintShop</h1><ol class="pm-steps" aria-label="Print Shop progress"></ol></div><div class="pm-scroll"><section class="pm-stage"></section></div>';
  document.body.append(root);
  const back=document.createElement('button');back.type='button';back.className='pm-back';back.hidden=true;back.textContent='←';document.getElementById('masthead').append(back);
  const scroller=root.querySelector('.pm-scroll'),panel=root.querySelector('.pm-stage');
  function enable(){const on=mq.matches;document.documentElement.classList.toggle('print-phone',on);root.hidden=!on;back.hidden=!on||stage===0;if(on)render();}
  mq.addEventListener('change',enable);
  function go(n){if(selecting||submitting)return;stage=n;scroller.scrollTop=0;render();panel.querySelector('h2')?.focus({preventScroll:true});}
  back.onclick=()=>go(Math.max(0,stage-1));
  function title(t,sub){return '<h2 tabindex="-1">'+t+'</h2>'+(sub?'<p class="pm-intro">'+sub+'</p>':'');}
  function context(p){const series=p?.series?String(p.series).replace(/^./,s=>s.toUpperCase()):'';const d=p?.createdAt||p?.created_at;return esc(series)+(d&&!isNaN(Date.parse(d))?' · Crafted '+esc(new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})):'');}
  function render(){
    if(!mq.matches)return;
    const s=api.state(),p=s.piece,f=s.families[s.family],z=f?.sizes[s.size];
    root.dataset.stage=names[stage].toLowerCase();back.hidden=stage===0;back.disabled=selecting||submitting;back.setAttribute('aria-label','Back to '+names[Math.max(0,stage-1)]);
    document.getElementById('mhMenuBtn').hidden=stage!==0;
    root.querySelector('.pm-steps').innerHTML=names.map((n,i)=>'<li class="'+(i===stage?'current':i<stage?'complete':'')+'"'+(i===stage?' aria-current="step"':'')+'><span>'+n+'</span></li>').join('');
    if(stage===0){
      let items=s.collection.slice();if(p&&!items.some(x=>x.id===p.id))items.unshift(p);
      if(filter.series!=='all')items=items.filter(x=>String(x.series).toLowerCase()===filter.series);
      items=items.map((p,i)=>({p,i})).sort((a,b)=>{const d=(Date.parse(b.p.createdAt)||0)-(Date.parse(a.p.createdAt)||0)||a.i-b.i;return filter.sort==='oldest'?-d:d;}).map(x=>x.p);
      panel.innerHTML=title('Select Your Image','Choose from your collection or use the currently selected image.')+
        (p?'<button class="pm-selected" aria-label="Continue with '+esc(api.artworkLabel(p))+'" '+(selecting?'disabled':'')+'><img src="'+esc(p.art)+'" alt="'+esc(api.artworkLabel(p))+'"></button>':'')+
        '<div class="pm-collection-head"><h3>My Collection <small>('+items.length+')</small></h3><button class="pm-filter" type="button" aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 4h18l-7 8v8l-4-2v-6z"/></svg>Filter⌄</button></div><div class="pm-grid">'+items.map(x=>'<button type="button" class="pm-thumb '+(p?.id===x.id?'selected':'')+'" data-art="'+esc(x.id)+'" aria-label="Select '+esc(api.artworkLabel(x))+'" aria-pressed="'+(p?.id===x.id)+'" '+(selecting?'disabled':'')+'><img src="'+esc(x.art)+'" alt=""></button>').join('')+'</div><p class="pm-status" role="status">'+esc(selecting?'Checking artwork…':selectionError||s.collectionMessage)+'</p>';
    }else if(stage===1){
      panel.innerHTML=title('Choose Your Finish','Each option is museum-quality and made to last.')+'<div class="pm-finishes">'+s.families.map((x,i)=>'<button type="button" class="pm-finish '+(i===s.family?'selected':'')+'" data-finish="'+i+'" aria-pressed="'+(i===s.family)+'">'+api.finishArt(x)+'<h3>'+esc(x.label)+'</h3><p>'+esc(x.note)+'</p><span>From '+money(api.fromPrice(x))+'</span></button>').join('')+'</div>';
    }else if(stage===2){
      const ratio=p?.width&&p?.height?api.ratio(p.width,p.height):'';
      panel.innerHTML=title('Select Your Size','Available sizes for '+esc(f?.label||'')+(ratio?'<br>('+esc(ratio)+' aspect ratio).':'.'))+'<div class="pm-sizes">'+(f?.sizes||[]).map((x,i)=>'<button type="button" data-size="'+i+'" class="pm-size '+(i===s.size&&x.compatibility!=='unavailable'?'selected':'')+'" '+(x.compatibility==='unavailable'?'disabled':'')+' aria-pressed="'+(i===s.size)+'"><span>'+(x.compatibility==='unavailable'?'⊘ ':'')+esc(x.label)+'</span><small>'+(x.compatibility==='unavailable'?'Not available':money(x.cents))+'</small></button>').join('')+'</div>'+
        ((f?.sizes||[]).some(x=>x.compatibility==='unavailable')?'<div class="pm-size-note"><span aria-hidden="true">ⓘ</span><p>'+((f.sizes.filter(x=>x.compatibility!=='unavailable').every(x=>{const a=x.size.split('x');return a[0]===a[1];}))?'Only square sizes are available for this image. ':'')+'Other sizes are not available due to the image’s aspect ratio.</p></div>':'')+'<button type="button" class="pm-primary" data-review '+(!z||z.compatibility==='unavailable'?'disabled':'')+'>Continue to Review</button>';
    }else{
      const a=s.address, address=[a.name,a.line1,a.line2,[a.city,a.state,a.postcode].filter(Boolean).join(', '),s.countryName].filter(Boolean);
      panel.innerHTML=title('Review Your Order','Almost there. Please review your selection<br>and shipping details before placing your order.')+
        '<article class="pm-review-art pm-card"><img src="'+esc(p?.art)+'" alt="'+esc(api.artworkLabel(p))+'"><div><h3>'+esc(api.artworkLabel(p))+'</h3><p class="pm-context">'+context(p)+'</p><dl><dt>Product</dt><dd>'+esc(f?.label)+'</dd><dt>Size</dt><dd>'+esc(z?.label)+'</dd><dt>Finish</dt><dd>'+esc(f?.note)+'</dd><dt>Quantity</dt><dd>'+s.quantity+'</dd></dl><button type="button" class="pm-edit" data-edit-selection>Edit Selection</button></div></article>'+
        '<section class="pm-card pm-address-card"><div class="pm-card-heading"><h3>Shipping Address</h3><button type="button" class="pm-edit" data-edit-address>Edit</button></div>'+(address.length?'<p>'+address.map(esc).join('<br>')+'</p>':'')+'</section>'+
        '<section class="pm-card pm-summary"><h3>Order Summary</h3><dl><dt>Print</dt><dd>'+money(z.cents*s.quantity)+'</dd>'+(s.shipping?'<dt>Shipping ('+esc(s.shipping.label)+')</dt><dd>'+money(s.shipping.retailShippingCents)+'</dd>':'')+'</dl></section>'+
        '<button type="button" class="pm-primary" data-checkout '+(!s.checkoutReady||submitting?'disabled':'')+'>Continue to Checkout</button>';
    }
  }
  panel.addEventListener('click',async e=>{
    const b=e.target.closest('button');if(!b||b.disabled)return;
    if(b.matches('.pm-selected'))go(1);
    if(b.dataset.art){selecting=true;selectionError='';render();try{await api.selectArtwork(b.dataset.art);}catch(_){selectionError='This artwork is unavailable for printing.';}finally{selecting=false;render();}}
    if(b.dataset.finish!==undefined){api.chooseFinish(Number(b.dataset.finish));go(2);}
    if(b.dataset.size!==undefined){api.chooseSize(Number(b.dataset.size));render();}
    if(b.hasAttribute('data-review')){api.prepareReview();go(3);}
    if(b.hasAttribute('data-edit-selection'))go(0);
    if(b.matches('.pm-filter'))openFilter();
    if(b.hasAttribute('data-edit-address'))openAddress();
    if(b.hasAttribute('data-checkout')&&!submitting){submitting=true;render();try{await api.checkout();}finally{submitting=false;render();}}
  });
  const filterModal=document.createElement('dialog');filterModal.className='pm-filter-modal';filterModal.setAttribute('aria-labelledby','pmFilterTitle');document.body.append(filterModal);
  function openFilter(){draft={...filter};paintFilter();filterModal.showModal();}
  function paintFilter(){filterModal.innerHTML='<h2 id="pmFilterTitle">Filter</h2><p>Refine what you see in your collection.</p><fieldset><legend>Series</legend><div>'+[['all','All'],['portraits','Portraits'],['groups','Groups'],['pets','Pets']].map(([v,t])=>'<button type="button" data-series="'+v+'" aria-pressed="'+(draft.series===v)+'">'+t+'</button>').join('')+'</div></fieldset><fieldset><legend>Sort</legend><div>'+[['newest','Newest First'],['oldest','Oldest First']].map(([v,t])=>'<button type="button" data-sort="'+v+'" aria-pressed="'+(draft.sort===v)+'">'+t+'</button>').join('')+'</div></fieldset><button class="pm-primary" type="button" data-apply>Apply</button>';}
  filterModal.onclick=e=>{const b=e.target.closest('button');if(e.target===filterModal)filterModal.close();if(!b)return;if(b.dataset.series){draft.series=b.dataset.series;paintFilter();}if(b.dataset.sort){draft.sort=b.dataset.sort;paintFilter();}if(b.hasAttribute('data-apply')){filter={...draft};filterModal.close();render();}};
  const addressModal=document.createElement('dialog');addressModal.className='pm-address-modal';addressModal.setAttribute('aria-label','Shipping Address');document.body.append(addressModal);let addressHome=null;
  function openAddress(){const order=document.getElementById('psOrder');addressHome={parent:order.parentNode,next:order.nextSibling};addressModal.append(order);order.querySelector('details').open=true;addressModal.showModal();}
  addressModal.addEventListener('close',()=>{const order=document.getElementById('psOrder');if(addressHome){addressHome.parent.insertBefore(order,addressHome.next);addressHome=null;}render();});
  addressModal.addEventListener('click',e=>{if(e.target===addressModal)addressModal.close();if(e.target.closest('#printAddressDone'))queueMicrotask(()=>{if(!document.querySelector('#psAddressEdit')?.open)addressModal.close();});});
  api.subscribe(()=>{if(addressModal.open&&!document.querySelector('#psAddressEdit')?.open)addressModal.close();render();});
  enable();
};
