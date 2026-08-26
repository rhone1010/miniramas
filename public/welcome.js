/* welcome.js - CUI 42 - 25 August 2026
   THE WELCOME SCREEN. Grand-opening greeting on any arrival, per Rich:
   shows on every visit but at most once per day per browser, and turns
   itself off entirely on 15 September 2026 - no second deploy needed.
   A screen, not a wall: one click anywhere dismisses it. It greets,
   it does not collect. Copy is Rich's locked pass of 25 Aug. */
(function(){
  'use strict';
  var OFF_AFTER = new Date('2026-09-15T00:00:00');
  if (new Date() >= OFF_AFTER) return;

  var KEY = 'liten_welcome_day';
  var today = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem(KEY) === today) return;
  } catch(e){ /* storage refused: greet anyway, once per load */ }

  var css = document.createElement('style');
  css.textContent =
    '.lw-scrim{position:fixed;inset:0;z-index:9999;display:flex;' +
      'align-items:center;justify-content:center;padding:24px;' +
      'background:rgba(26,20,16,.55);backdrop-filter:blur(3px);' +
      'opacity:0;transition:opacity .45s ease;cursor:pointer}' +
    '.lw-scrim.is-in{opacity:1}' +
    '.lw-card{max-width:560px;width:100%;padding:44px 48px 40px;' +
      'background:#f3ede1;border:1px solid rgba(117,98,58,.35);' +
      'border-radius:8px;box-shadow:0 24px 64px rgba(0,0,0,.35);' +
      'cursor:default;text-align:center}' +
    '.lw-card h2{margin:0 0 6px;font:600 2rem/1.2 "Cormorant Garamond",serif;' +
      'color:#2a241e}' +
    '.lw-card .lw-open{margin:0 0 18px;font:italic 1.25rem/1.3 ' +
      '"Cormorant Garamond",serif;color:#7d4242}' +
    '.lw-card p{margin:0 0 14px;font:400 1.02rem/1.55 "Cormorant Garamond",serif;' +
      'color:#2a241e;text-align:left}' +
    '.lw-card .lw-note{font-size:.95rem;color:rgba(42,36,30,.75)}' +
    '.lw-in{display:inline-flex;align-items:center;margin-top:10px;' +
      'padding:.55rem 1.6rem;border-radius:999px;border:1.5px solid #7d4242;' +
      'font:italic 600 1.15rem/1 "Cormorant Garamond",serif;color:#7d4242;' +
      'background:transparent;cursor:pointer;transition:background .3s,color .3s}' +
    '.lw-in:hover{background:#7d4242;color:#f3ede1}';
  document.head.appendChild(css);

  var scrim = document.createElement('div');
  scrim.className = 'lw-scrim';
  scrim.setAttribute('role', 'dialog');
  scrim.setAttribute('aria-label', 'Welcome to Liten and Co');
  scrim.innerHTML =
    '<div class="lw-card">' +
      '<h2>Welcome to Liten &amp; Co.</h2>' +
      '<div class="lw-open">We\u2019re officially open.</div>' +
      '<p>Turn the people and pets you love into something wonderfully ' +
      'unexpected. Explore handcrafted transformations for portraits, pets, ' +
      'groups, and Halloween, each designed to turn an ordinary photo into a ' +
      'one-of-a-kind piece of impossible portraiture.</p>' +
      '<p class="lw-note">A little grand-opening note: We\u2019re still ' +
      'fine-tuning a few corners of the site, though everything available ' +
      'for purchase is ready to go. Please send us anything you spot that ' +
      'could be better, and we\u2019d love to hear your ideas for new effects ' +
      'you\u2019d like to see.</p>' +
      '<p class="lw-note" style="text-align:center;margin-bottom:0">' +
      'Enjoy creating.</p>' +
      '<button class="lw-in" type="button">Come in</button>' +
    '</div>';

  function dismiss(){
    try { localStorage.setItem(KEY, today); } catch(e){}
    scrim.classList.remove('is-in');
    setTimeout(function(){ if (scrim.parentNode) scrim.parentNode.removeChild(scrim); }, 480);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e){ if (e.key === 'Escape' || e.key === 'Enter') dismiss(); }

  /* One click anywhere. The card itself included - it is a greeting,
     not a form, and nothing on it needs protecting from a click. */
  scrim.addEventListener('click', dismiss);
  document.addEventListener('keydown', onKey);

  function mount(){
    document.body.appendChild(scrim);
    requestAnimationFrame(function(){ scrim.classList.add('is-in'); });
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
