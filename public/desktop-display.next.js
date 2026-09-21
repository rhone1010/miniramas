/* Local display preference only; no authentication or commerce state. */
(function(){
  var key = 'liten.desktopDisplay', scales = {small:.9, standard:1, large:1.15};
  function read(){try{return localStorage.getItem(key) || 'standard';}catch(_){return 'standard';}}
  function apply(){
    var value = read(); if (!Object.prototype.hasOwnProperty.call(scales,value)) value = 'standard';
    document.documentElement.style.setProperty('--desktop-display-scale',String(scales[value]));
    var control = document.getElementById('desktopDisplaySize'); if (control) control.value = value;
  }
  var control = document.getElementById('desktopDisplaySize');
  if (control) control.addEventListener('change',function(){
    if (!Object.prototype.hasOwnProperty.call(scales,control.value)) return;
    try{localStorage.setItem(key,control.value);}catch(_){}
    apply();
  });
  window.addEventListener('storage',apply); window.addEventListener('pageshow',apply); apply();
})();
