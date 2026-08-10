/* public/concierge.js
 *
 * THE CONCIERGE, EVERYWHERE.
 *
 * One implementation, loaded by every page that wants her. She used to
 * live inside help.html; a second copy in the workshop would be two
 * panels to keep in step, and the first time they drifted the customer
 * would meet two different people.
 *
 * TO PUT HER ON A PAGE
 *     <script src="/concierge.js" defer></script>
 * and give something a data-concierge attribute. Any element works — a
 * button in a masthead, a tab in a bottom bar, a pill in a section bar.
 * She styles herself and cleans up after herself.
 *
 * TWO SHAPES
 *     VEIL (default) — a modal over a darkened page. Right for the
 *     gallery and the help page, where the page behind is a document
 *     and covering it costs nothing.
 *
 *     DOCK — <script src="/concierge.js" defer data-dock></script>
 *     A panel at the bottom right with no backdrop. The page stays live
 *     underneath: they can keep clicking, keep uploading, keep choosing
 *     while she talks. Right for the workshop, where the whole reason
 *     somebody asks a question is that they are trying to do something.
 *     Below 900px a dock becomes a sheet anyway — a phone has no room
 *     for a panel beside the work.
 *
 * SHE CAN POINT AT THINGS
 *     A page publishes what she is allowed to point at:
 *
 *         window.CONCIERGE_POINTS = [
 *           { sel:'#curSlot', phrases:['photograph','upload'] }, ...
 *         ];
 *
 *     When her answer contains one of those words and the element is
 *     actually on the glass, the word becomes a quiet link and the
 *     element takes a gold ring. Nothing is invented: a phrase whose
 *     element is missing or hidden is left as plain text, so she can
 *     never point at a control that is not there.
 *
 *     THE RING IS DRAWN OVER THE ELEMENT, NEVER ON IT. Adding a class
 *     to a control inside a ten-thousand-line workshop is how a layout
 *     breaks at the moment somebody asked for help. The ring is a fixed
 *     overlay that tracks the rect and touches nothing.
 *
 * SHE NOTICES SOMEBODY STUCK
 *     data-attention on the script tag. The page reports real progress
 *     by dispatching document.dispatchEvent(new Event('concierge:acted')).
 *     If somebody is plainly moving around the page and nothing has been
 *     achieved, her trigger scales and pulses. It stops for good the
 *     moment they act, or the moment they open her — offering help three
 *     times to somebody who is doing fine is nagging.
 *
 * WHAT SHE CAN DO
 *     Answer questions. That is all, and she says so. She cannot see an
 *     account, cannot issue credits, cannot refund. When somebody needs
 *     something done she takes a message, which goes to hello@litenco.com
 *     through /api/v1/support — the row is written before the mail is
 *     sent, so nothing a customer typed is lost to a bounce.
 *
 * WHY NOT GIVE HER THE ACCOUNT
 *     Because the guardrails are not built. A model with an unbounded
 *     refund tool eventually meets a conversation that talks it past a
 *     rule written in prose, and the limits have to live in the tool
 *     rather than the prompt. Until then she hands off cleanly, which is
 *     honest, rather than half-helping, which is not.
 *     See docs/GOVERNANCE/CONCIERGE-GUIDANCE-2026-08-08.md.
 */
(function () {
  'use strict';

  if (window.__conciergeReady) return;
  window.__conciergeReady = true;

  /* Read from the tag that loaded us, so a page opts in with an
     attribute rather than a global that has to exist before we run. */
  var SELF      = document.currentScript;
  var WANT_DOCK = !!(SELF && SELF.hasAttribute('data-dock'));
  var WANT_EYE  = !!(SELF && SELF.hasAttribute('data-attention'));

  var SAGE = '#4a6b4a';
  var GOLD = '#b68a53';

  var history = [];
  var busy = false;
  var veil = null, log = null, input = null, send = null, seeds = null;
  var mode = 'ask';          /* 'ask' | 'message' | 'sent' */

  function narrow(){
    return window.matchMedia && window.matchMedia('(max-width:900px)').matches;
  }
  /* A dock on a phone is a sheet. Decided at open, not at load — a
     tablet turned on its side changes the answer. */
  function docked(){ return WANT_DOCK && !narrow(); }

  /* ── STYLE ──────────────────────────────────────────────────────────
     Injected rather than required in a stylesheet, so a page adopts her
     with one script tag and nothing else. Every rule is scoped under
     .cx- : this drops into a 10,000-line workshop with its own :root and
     its own box-sizing, and an unscoped rule here would reach into it. */
  var css = [
    /* THE SHELL. Two shapes off one element: .cx-veil covers the page,
       .cx-dock sits in the corner of it. */
    '.cx-veil{position:fixed;inset:0;z-index:2147482000;display:grid;place-items:center;',
      'padding:4vh 4vw;background:rgba(30,24,18,.52);backdrop-filter:blur(3px);',
      'font-size:16px}',
    '.cx-veil *{box-sizing:border-box}',
    '.cx-veil[hidden]{display:none}',

    /* The dock has no backdrop and does not fill the screen, so it needs
       pointer-events off on the shell itself — otherwise an invisible
       full-page layer would eat every click on the workshop under it. */
    '.cx-veil.is-dock{display:block;inset:auto;right:20px;bottom:20px;',
      'padding:0;background:none;backdrop-filter:none;pointer-events:none;',
      'max-height:none}',
    '.cx-veil.is-dock .cx{pointer-events:auto}',
    /* Half-visible while she points at something underneath her. */
    '.cx-veil.is-ghost .cx{opacity:.16;transition:opacity .2s ease}',

    '.cx{width:min(620px,100%);max-height:86vh;display:flex;flex-direction:column;',
      'background:#f8f4eb;border:1px solid rgba(74,107,74,.22);border-radius:14px;',
      'box-shadow:0 30px 80px rgba(0,0,0,.34);overflow:hidden;transition:opacity .2s ease}',
    '.cx-veil.is-dock .cx{width:min(420px,calc(100vw - 40px));max-height:min(620px,74vh)}',

    '.cx-hd{display:flex;align-items:center;gap:.7em;flex:0 0 auto;padding:1em 1.15em;',
      'background:rgba(74,107,74,.07);border-bottom:1px solid rgba(74,107,74,.22)}',
    '.cx-dot{width:9px;height:9px;border-radius:50%;background:' + SAGE + ';flex:none}',
    '.cx-hd b{font-family:Georgia,serif;font-weight:400;font-style:italic;',
      'font-size:1.35em;color:' + SAGE + '}',
    '.cx-x{margin-left:auto;font-size:1.6em;line-height:1;color:#aba39a;',
      'background:none;border:none;padding:.1em .35em;cursor:pointer}',
    '.cx-x:hover{color:#2a241e}',

    '.cx-log{flex:1 1 auto;min-height:170px;overflow-y:auto;padding:1.15em;',
      'display:flex;flex-direction:column;gap:.85em}',
    '.cx-veil.is-dock .cx-log{min-height:130px}',
    '.cx-msg{max-width:86%;font-family:Georgia,serif;font-size:1.12em;line-height:1.45}',
    '.cx-msg.you{align-self:flex-end;background:#e9dec8;color:#2a241e;',
      'padding:.75em 1em;border-radius:14px 14px 4px 14px}',
    '.cx-msg.con{align-self:flex-start;color:#2a241e;background:#fff;',
      'border:1px solid rgba(74,107,74,.22);padding:.75em 1em;border-radius:14px 14px 14px 4px}',
    '.cx-msg.con b{display:block;font-family:system-ui,Arial,sans-serif;font-size:.62em;',
      'font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:' + SAGE + ';',
      'margin-bottom:.4em}',
    '.cx-msg.err{align-self:flex-start;color:#7d4242;font-style:italic;padding:.3em 0}',

    /* A WORD SHE CAN POINT WITH. Underlined in gold rather than made a
       button — it is a word in a sentence and should still read as one.
       Big enough to hit: this is the same size as the text around it,
       which on a phone is already past the target floor. */
    '.cx-pt{font:inherit;color:#7a5a2e;background:none;border:none;padding:0;',
      'cursor:pointer;text-decoration:underline;text-decoration-color:rgba(182,138,83,.7);',
      'text-underline-offset:.16em;text-decoration-thickness:1.5px}',
    '.cx-pt:hover{color:#5d4322;text-decoration-color:' + GOLD + '}',

    /* THE RING. Drawn over the target, never on it. */
    '.cx-ring{position:fixed;z-index:2147481500;pointer-events:none;border-radius:10px;',
      'opacity:0;box-shadow:0 0 0 3px rgba(182,138,83,.92),0 0 0 11px rgba(182,138,83,.20),',
      '0 0 26px 6px rgba(182,138,83,.30)}',
    '.cx-ring.is-on{animation:cxRing 1.25s ease-out 3}',
    '@keyframes cxRing{0%{opacity:0;transform:scale(1.05)}',
      '18%{opacity:1;transform:scale(1)}70%{opacity:.85}100%{opacity:0;transform:scale(1.02)}}',

    '.cx-dots{display:inline-flex;gap:4px;align-items:center;height:1.3em}',
    '.cx-dots i{width:5px;height:5px;border-radius:50%;background:' + SAGE + ';',
      'opacity:.35;animation:cxBlink 1.1s infinite}',
    '.cx-dots i:nth-child(2){animation-delay:.18s}',
    '.cx-dots i:nth-child(3){animation-delay:.36s}',
    '@keyframes cxBlink{0%,100%{opacity:.25}50%{opacity:.9}}',

    '.cx-seeds{display:flex;flex-wrap:wrap;gap:.45em;padding:0 1.15em 1em;flex:0 0 auto}',
    '.cx-seeds button{font-family:Georgia,serif;font-style:italic;font-size:.98em;',
      'color:' + SAGE + ';background:none;padding:.4em 1em;cursor:pointer;',
      'border:1px solid rgba(74,107,74,.22);border-radius:999px}',
    '.cx-seeds button:hover{background:rgba(74,107,74,.07)}',

    '.cx-ask{display:flex;gap:.6em;flex:0 0 auto;padding:.9em 1.15em;',
      'border-top:1px solid rgba(74,107,74,.22)}',
    '.cx-ask input,.cx-ask textarea{flex:1 1 auto;min-width:0;padding:.85em 1em;',
      'font-family:Georgia,serif;font-size:1.12em;color:#2a241e;background:#fff;',
      'border:1px solid rgba(74,107,74,.22);border-radius:14px;outline:none;resize:none}',
    '.cx-ask input{height:3.2em;border-radius:999px;padding:0 1em}',
    '.cx-ask input::placeholder,.cx-ask textarea::placeholder{color:#aba39a}',
    '.cx-ask input:focus,.cx-ask textarea:focus{border-color:' + SAGE + '}',
    '.cx-send{flex:none;padding:0 1.6em;border-radius:999px;border:none;cursor:pointer;',
      'background:' + SAGE + ';color:#f8f4eb;font-family:Georgia,serif;font-style:italic;',
      'font-size:1.12em}',
    '.cx-send:hover{background:#5d7d5d}',
    '.cx-send:disabled{opacity:.45;cursor:default}',

    '.cx-foot{flex:0 0 auto;padding:0 1.15em 1em;font-family:Georgia,serif;',
      'font-style:italic;font-size:.98em;color:#aba39a}',
    '.cx-foot a{color:' + SAGE + '}',
    '.cx-hand{align-self:flex-start;margin-top:.2em}',
    '.cx-hand button{font-family:Georgia,serif;font-style:italic;font-size:1em;',
      'color:#f8f4eb;background:' + SAGE + ';border:none;cursor:pointer;',
      'padding:.55em 1.3em;border-radius:999px}',
    '.cx-hand button:hover{background:#5d7d5d}',

    /* THE TRIGGER, WHEN SOMEBODY IS PLAINLY STUCK. Scale and a ring, on
       whatever element the page gave a data-concierge. It is applied to
       the trigger and not to a badge of our own, because the answer to
       "where do I get help" should be the thing that was always there. */
    '[data-concierge].cx-notice{animation:cxNotice 2.4s ease-in-out infinite;',
      'border-radius:8px}',
    '@keyframes cxNotice{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(182,138,83,0)}',
      '35%{transform:scale(1.09);box-shadow:0 0 0 4px rgba(182,138,83,.34)}',
      '70%{transform:scale(1);box-shadow:0 0 0 9px rgba(182,138,83,0)}}',

    '@media (prefers-reduced-motion:reduce){',
      '.cx-ring.is-on{animation:none;opacity:1}',
      '[data-concierge].cx-notice{animation:none;box-shadow:0 0 0 3px rgba(182,138,83,.5)}',
    '}',

    '@media (max-width:900px){',
      '.cx-veil.is-dock{position:fixed;inset:0;right:0;bottom:0;display:grid;',
        'place-items:center;background:rgba(30,24,18,.52);backdrop-filter:blur(3px);',
        'pointer-events:auto}',
      '.cx-veil.is-dock .cx{width:100%;max-height:100vh}',
    '}',
    '@media (max-width:600px){',
      '.cx-veil{padding:0}',
      '.cx{width:100%;height:100%;max-height:100vh;border:none;border-radius:0}',
      '.cx-veil.is-dock .cx{height:100%;max-height:100vh;border-radius:0}',
      '.cx-ask{flex-wrap:wrap;padding-bottom:calc(.9em + env(safe-area-inset-bottom))}',
      '.cx-send{width:100%;padding:.85em 0}',
    '}',
  ].join('');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ── PANEL ──────────────────────────────────────────────────────── */
  function build() {
    veil = document.createElement('div');
    veil.className = 'cx-veil';
    veil.innerHTML =
      '<div class="cx" role="dialog" aria-label="The Concierge">' +
        '<div class="cx-hd">' +
          '<span class="cx-dot"></span><b>The Concierge</b>' +
          '<button class="cx-x" type="button" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="cx-log" role="log" aria-live="polite"></div>' +
        '<div class="cx-seeds"></div>' +
        '<div class="cx-ask">' +
          '<input type="text" placeholder="Ask a question" autocomplete="off" ' +
                 'aria-label="Ask the Concierge">' +
          '<button class="cx-send" type="button">Ask</button>' +
        '</div>' +
        '<p class="cx-foot"></p>' +
      '</div>';
    document.body.appendChild(veil);

    log   = veil.querySelector('.cx-log');
    input = veil.querySelector('.cx-ask input');
    send  = veil.querySelector('.cx-send');
    seeds = veil.querySelector('.cx-seeds');

    veil.querySelector('.cx-x').addEventListener('click', close);
    /* Only the veil closes on a click outside itself. A dock does not:
       the page under it is meant to be used, and a click on the floor
       that closed her would make her impossible to keep open while
       following what she said. */
    veil.addEventListener('click', function (e) {
      if (e.target === veil && !docked()) close();
    });
    send.addEventListener('click', function () { submit(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });
    seeds.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) ask(b.textContent);
    });

    /* A pointed word, wherever it lands in the log. */
    log.addEventListener('click', function (e) {
      var p = e.target.closest('.cx-pt');
      if (!p) return;
      point(p.getAttribute('data-cx-sel'));
    });

    greet();
  }

  function shape() {
    if (!veil) return;
    var d = docked();
    veil.classList.toggle('is-dock', d);
    /* aria-modal is a lie in a dock — the page behind it is live and a
       screen reader should be able to reach it. */
    var box = veil.querySelector('.cx');
    if (box){
      if (d) box.removeAttribute('aria-modal');
      else   box.setAttribute('aria-modal', 'true');
    }
  }
  window.addEventListener('resize', shape);

  function greet() {
    bubble('con',
      'Good day. Ask me anything about how Liten & Co works \u2014 finishes, ' +
      'photographs, prints, what becomes of your picture. I can answer ' +
      'questions, though I cannot look at your account.');

    seeds.innerHTML = '';
    (window.CONCIERGE_SEEDS || [
      'What makes a good photograph?',
      'How long does a craft take?',
      'What happens to my picture?'
    ]).forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = t;
      seeds.appendChild(b);
    });

    foot('For anything to do with your own account, I can take a message.');
  }

  function foot(html) {
    var f = veil.querySelector('.cx-foot');
    f.innerHTML = html;
  }

  function open() {
    if (!veil) build();
    shape();
    veil.hidden = false;
    quiet();                      /* she has been found; stop asking */
    setTimeout(function () { input && input.focus(); }, 40);
  }
  function close() { if (veil) veil.hidden = true; }

  addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  /* Any element with data-concierge opens her. Delegated, so a trigger
     drawn by script after this file ran still works. */
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-concierge]');
    if (!t) return;
    e.preventDefault();
    open();
  });
  window.__openConcierge = open;

  /* ── POINTING ────────────────────────────────────────────────────────
     The page says what may be pointed at; this decides whether it is
     currently true. An element that is missing, hidden, or off the glass
     is not pointed at and its word stays plain text — she should never
     appear to gesture at something that is not there. */
  function points() {
    var p = window.CONCIERGE_POINTS;
    return (p && p.length) ? p : [];
  }

  function liveTarget(sel) {
    if (!sel) return null;
    var el;
    try { el = document.querySelector(sel); } catch (e) { return null; }
    if (!el) return null;
    if (el.hasAttribute('hidden')) return null;
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    var cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return null;
    return el;
  }

  var ring = null, ringTimer = null, ringTrack = null;

  function point(sel, el) {
    var t = el || liveTarget(sel);
    if (!t) return false;

    if (!ring) {
      ring = document.createElement('div');
      ring.className = 'cx-ring';
      document.body.appendChild(ring);
    }

    /* Bring it onto the glass first. A ring around something below the
       fold is a ring nobody sees. */
    try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}

    function seat() {
      var r = t.getBoundingClientRect();
      ring.style.top    = Math.round(r.top - 4) + 'px';
      ring.style.left   = Math.round(r.left - 4) + 'px';
      ring.style.width  = Math.round(r.width + 8) + 'px';
      ring.style.height = Math.round(r.height + 8) + 'px';
      /* If she is sitting on top of the thing she is pointing at, she
         gets out of the way for as long as the ring runs. */
      if (veil && !veil.hidden && docked()) {
        var v = veil.querySelector('.cx').getBoundingClientRect();
        var over = !(r.right < v.left || r.left > v.right ||
                     r.bottom < v.top || r.top > v.bottom);
        veil.classList.toggle('is-ghost', over);
      }
    }

    ring.classList.remove('is-on');
    void ring.offsetWidth;                    /* restart the animation */
    seat();
    ring.classList.add('is-on');

    clearInterval(ringTrack);
    ringTrack = setInterval(seat, 120);       /* it may be scrolling */
    clearTimeout(ringTimer);
    ringTimer = setTimeout(function () {
      ring.classList.remove('is-on');
      clearInterval(ringTrack);
      if (veil) veil.classList.remove('is-ghost');
    }, 3900);

    return true;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Wrap the first occurrence of each pointable phrase. At most three in
     one answer: a paragraph of underlined words reads as a link farm and
     stops meaning anything. */
  function linkify(text) {
    var html = esc(text);
    var list = points();
    if (!list.length) return { html: html, first: null };

    var found = [], first = null;

    list.forEach(function (p) {
      if (found.length >= 3) return;
      if (!liveTarget(p.sel)) return;
      var phrases = p.phrases || [];
      for (var i = 0; i < phrases.length; i++) {
        var rx = new RegExp('(^|[^\\w-])(' +
          phrases[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![\\w-])', 'i');
        var m = rx.exec(html);
        if (!m) continue;
        found.push({ at: m.index + m[1].length, len: m[2].length, sel: p.sel });
        break;
      }
    });

    found.sort(function (a, b) { return b.at - a.at; });   /* back to front */
    found.forEach(function (f) {
      html = html.slice(0, f.at) +
        '<button type="button" class="cx-pt" data-cx-sel="' + esc(f.sel) + '">' +
        html.slice(f.at, f.at + f.len) + '</button>' +
        html.slice(f.at + f.len);
    });

    if (found.length) first = found[found.length - 1].sel;  /* earliest */
    return { html: html, first: first };
  }

  /* ── ATTENTION ───────────────────────────────────────────────────────
     Two ways to be stuck, and they look different. One is a person
     moving around the page achieving nothing; the other is a person who
     has stopped moving at all. Both get the same offer, once.

     Real progress is reported by the page, because only the page knows
     what progress is here. A scroll is not progress. */
  var acts = 0, fidget = 0, since = Date.now(), shown = 0, eyeTimer = null;

  function triggers() {
    return document.querySelectorAll('[data-concierge]');
  }
  function louder() {
    if (shown >= 2) return;
    shown++;
    [].forEach.call(triggers(), function (t) { t.classList.add('cx-notice'); });
  }
  function quiet() {
    [].forEach.call(triggers(), function (t) { t.classList.remove('cx-notice'); });
  }

  function acted() {
    acts++;
    fidget = 0;
    since = Date.now();
    quiet();
  }
  document.addEventListener('concierge:acted', acted);

  if (WANT_EYE) {
    ['mousemove', 'pointerdown', 'wheel', 'keydown', 'touchstart'].forEach(function (ev) {
      addEventListener(ev, function () { fidget++; }, { passive: true });
    });

    eyeTimer = setInterval(function () {
      if (acts) return;                          /* they are getting on with it */
      if (veil && !veil.hidden) return;          /* she is already open */
      if (shown >= 2) { clearInterval(eyeTimer); return; }
      var idle = Date.now() - since;
      /* Wandering: plainly here, plainly busy, nothing achieved. */
      if (fidget > 40 && idle > 45000) { since = Date.now(); fidget = 0; louder(); return; }
      /* Stalled: nothing at all for a minute and a half. */
      if (idle > 90000) { since = Date.now(); louder(); }
    }, 5000);
  }

  /* ── MESSAGES ───────────────────────────────────────────────────── */
  function bubble(who, text, link) {
    var d = document.createElement('div');
    d.className = 'cx-msg ' + who;
    if (who === 'con') {
      var b = document.createElement('b');
      b.textContent = 'Concierge';
      d.appendChild(b);
      /* Only her ANSWERS carry pointable words. Her greeting says she
         cannot look at your account, and underlining "account" there
         would point at the Account link as if that were the offer.
         Nothing a customer types ever becomes markup. */
      if (link) {
        var body = document.createElement('span');
        var made = linkify(text);
        body.innerHTML = made.html;
        d.appendChild(body);
        d.__firstPoint = made.first;
      } else {
        d.appendChild(document.createTextNode(text));
      }
    } else {
      d.textContent = text;
    }
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }

  function err(text) {
    var d = document.createElement('div');
    d.className = 'cx-msg err';
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }

  function submit() {
    if (mode === 'message') return leaveMessage(input.value);
    ask(input.value);
  }

  function ask(text) {
    text = String(text || '').trim();
    if (!text || busy) return;

    busy = true;
    send.disabled = true;
    input.value = '';
    if (seeds) seeds.innerHTML = '';

    bubble('you', text);
    history.push({ role: 'user', content: text });

    var wait = document.createElement('div');
    wait.className = 'cx-msg con';
    wait.innerHTML = '<b>Concierge</b><span class="cx-dots"><i></i><i></i><i></i></span>';
    log.appendChild(wait);
    log.scrollTop = log.scrollHeight;

    fetch('/api/v1/concierge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-20) }),
    })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (d) {
        wait.remove();
        if (d && d.ok && d.reply) {
          var said = bubble('con', d.reply, true);
          history.push({ role: 'assistant', content: d.reply });
          /* Point at the first thing she named, once, after a beat — the
             ring and the sentence arriving together is two things at
             once and neither gets read. */
          if (said.__firstPoint) {
            setTimeout(function () { point(said.__firstPoint); }, 550);
          }
          offerHandoff();
        } else {
          err('I could not reach the desk just then. Try again in a moment, ' +
              'or write to hello@litenco.com.');
        }
      })
      .catch(function () {
        wait.remove();
        err('I could not reach the desk just then. Try again in a moment.');
      })
      .then(function () {
        busy = false;
        send.disabled = false;
        input.focus();
      });
  }

  /* THE HANDOFF. Offered once, after she has actually said something —
     a "leave a message" button sitting there from the first paint tells
     somebody with a simple question that she is not going to answer it. */
  var handedOff = false;
  function offerHandoff() {
    if (handedOff || history.length < 2) return;
    handedOff = true;

    var wrap = document.createElement('div');
    wrap.className = 'cx-hand';
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'Leave a message instead';
    wrap.appendChild(b);
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;

    b.addEventListener('click', function () {
      wrap.remove();
      startMessage();
    });
  }

  function startMessage() {
    mode = 'message';
    bubble('con',
      'Of course. Write what you need and I will pass it to the studio \u2014 ' +
      'somebody reads every one of these, and you will hear back at the ' +
      'address on your account.');

    var ask = veil.querySelector('.cx-ask');
    ask.innerHTML =
      '<textarea rows="4" placeholder="What do you need?" ' +
        'aria-label="Your message"></textarea>' +
      '<button class="cx-send" type="button">Send</button>';

    input = ask.querySelector('textarea');
    send  = ask.querySelector('.cx-send');
    send.addEventListener('click', function () { leaveMessage(input.value); });
    input.focus();

    foot('Goes to hello@litenco.com.');
  }

  function leaveMessage(text) {
    text = String(text || '').trim();
    if (text.length < 5 || busy) return;

    busy = true;
    send.disabled = true;
    input.value = '';
    bubble('you', text);

    var wait = document.createElement('div');
    wait.className = 'cx-msg con';
    wait.innerHTML = '<b>Concierge</b><span class="cx-dots"><i></i><i></i><i></i></span>';
    log.appendChild(wait);

    /* Whatever the page knows. It costs the customer nothing and saves
       Rich a round trip asking where they were and what they had. */
    var ctx = { page: location.pathname };
    try {
      if (window.__creditBalance !== undefined) ctx.credits = window.__creditBalance;
    } catch (e) {}

    fetch('/api/v1/support', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: text,
        subject: 'A message from the workshop',
        context: ctx,
        /* The transcript so far, so nobody has to be told twice. */
        history: history.slice(-8),
      }),
    })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (d) {
        wait.remove();
        if (d && d.ok) {
          mode = 'sent';
          bubble('con',
            'Sent. Somebody will come back to you \u2014 usually the same day.');
          veil.querySelector('.cx-ask').remove();
          foot('');
        } else if (d && d.reason === 'need_email') {
          err('I need an address to answer. Sign in, or write to ' +
              'hello@litenco.com directly.');
        } else if (d && d.reason === 'too_many') {
          err('That is a few messages in a short while \u2014 give us a chance ' +
              'to answer the first ones.');
        } else {
          err('That did not send. Write to hello@litenco.com and it will ' +
              'reach the same desk.');
        }
      })
      .catch(function () {
        wait.remove();
        err('That did not send. Write to hello@litenco.com and it will reach ' +
            'the same desk.');
      })
      .then(function () {
        busy = false;
        if (send) send.disabled = false;
      });
  }

  /* What a page is allowed to ask of her. Deliberately small. */
  window.Concierge = {
    open:  open,
    close: close,
    acted: acted,
    point: function (sel) { return point(sel); },
    isOpen: function () { return !!(veil && !veil.hidden); }
  };
})();
