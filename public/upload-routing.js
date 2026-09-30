/* Shared upload wiring for the existing subject-redirect decisions and
   portraits.html Curator's Note. No classifier or age policy lives here. */
(function(){
  var paths = { portraits:'/discovery', pets:'/pets/discovery', groups:'/groups' };
  var foyerPaths = { portraits:'/', pets:'/pets' };
  var transferring = false;
  var current = null, settle = null, checkedPhoto = null, checkedSeries = null;
  var api = { pending:false, blocked:false, skipRedirect:false, routing:null };
  var markup = "<div class=\"scrim m-scrim\" id=\"uploadRoutingModal\" data-role=\"modal\">\r\n  <div class=\"modal m-card\">\r\n    <button class=\"m-x\" id=\"uploadRoutingX\" aria-label=\"Close\">&times;</button>\r\n    <div class=\"m-head\"><img class=\"m-mark\" src=\"/icons/curator-c.svg\" alt=\"\">\r\n      <div class=\"m-title\">Curator&rsquo;s Note</div></div>\r\n    <div class=\"m-rule\"><span class=\"m-fleuron\">&#10086;</span></div>\r\n    <div class=\"m-say\" id=\"uploadRoutingSay\"></div>\r\n    <div class=\"m-rule m-rule--plain\"><span class=\"m-fleuron\"></span></div>\r\n    <div class=\"m-body\">\r\n      <div class=\"m-photo\"><img id=\"uploadRoutingPhoto\" alt=\"\"></div>\r\n      <div class=\"acts\">\r\n        <div class=\"btn fill\" id=\"uploadRoutingNew\">Use a different photograph</div>\r\n        <div class=\"btn ghost\" id=\"uploadRoutingAnyway\">Craft it in Portraits anyway</div>\r\n      </div>\r\n    </div>\r\n    <div class=\"m-safe\" id=\"uploadRoutingWarn\">A group photograph crafted as a Portrait\r\n      will follow the most prominent person &mdash; the results can be unexpected.\r\n      Nothing further is charged if you would rather not.</div>\r\n  </div>\r\n</div>";
  function shell(){
    var modal = document.getElementById('uploadRoutingModal');
    if (modal) return modal;
    var host = document.createElement('div');
    host.className = 'upload-routing-shell'; host.innerHTML = markup;
    document.body.appendChild(host);
    modal = document.getElementById('uploadRoutingModal');
    ['uploadRoutingNew','uploadRoutingAnyway'].forEach(function(id){
      var button=document.getElementById(id);
      button.setAttribute('role','button'); button.tabIndex=0;
      button.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();button.click();}});
    });
    document.getElementById('uploadRoutingAnyway').onclick=function(){finish(true,true);};
    document.getElementById('uploadRoutingX').onclick=function(){finish(false,false);};
    document.getElementById('uploadRoutingNew').onclick=function(){
      if(transferring)return;
      var target=current && current.decision.redirectSeries;
      if(!paths[target] || !window.LitenHandoff)return;
      var info=Object.assign({},current.info,{routing:current.info.routing,routingAccepted:null,skipRedirect:false});
      var destination=api.foyer && foyerPaths[target] ? foyerPaths[target]+'?foyerFrom='+current.series : paths[target];
      transferring=true;
      LitenHandoff.put(current.photo,info).then(function(){window.location.assign(destination);}).catch(function(e){
        transferring=false;console.warn('[foyer] routing handoff not written',e);
      });
    };
    return modal;
  }
  function finish(accepted,override){
    if(transferring)return;
    var modal=document.getElementById('uploadRoutingModal');
    if(modal)modal.classList.remove('is-open');
    api.pending=false;api.blocked=!accepted;api.skipRedirect=!!override;
    if(accepted && current){checkedPhoto=current.photo;checkedSeries=current.series;}
    var done=settle;settle=null;current=null;if(done)done(accepted);
  }
  api.reset=function(){finish(false,false);checkedPhoto=null;checkedSeries=null;api.routing=null;api.blocked=false;};
  api.review=function(info,photo,series){
    info=info||{};
    api.routing=info.routing||null;
    if(checkedPhoto===photo && checkedSeries===series){api.pending=false;return Promise.resolve(true);}
    if(info.routingAccepted===series){checkedPhoto=photo;checkedSeries=series;api.pending=false;api.skipRedirect=!!info.skipRedirect;return Promise.resolve(true);}
    var decision=info.routing && info.routing.decisions && info.routing.decisions[series];
    if(!decision || decision.match || !paths[decision.redirectSeries]){
      checkedPhoto=photo;checkedSeries=series;api.pending=false;api.skipRedirect=false;return Promise.resolve(true);
    }
    if(settle)finish(false,false);
    var modal=shell();
    current={info:info,photo:photo,series:series,decision:decision};api.pending=true;
    document.getElementById('uploadRoutingSay').textContent=decision.userMessage||'';
    document.getElementById('uploadRoutingPhoto').src=photo;
    document.getElementById('uploadRoutingNew').textContent=decision.ctaLabel;
    document.getElementById('uploadRoutingAnyway').textContent=decision.stayLabel;
    // The old warning is Portraits-specific. The shared engine message
    // supplies the applicable series explanation for this same card.
    document.getElementById('uploadRoutingWarn').hidden=true;
    modal.classList.add('is-open');
    return new Promise(function(resolve){settle=resolve;});
  };
  window.LitenSubjectGate=api;
})();
