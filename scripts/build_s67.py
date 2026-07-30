#!/usr/bin/env python3
"""
BUILD s66 -> s67   MY COLLECTION
CUI V23 · 2026-07-29 · ruled by Rich in session

A slide-over, not a route. It covers the workshop floor and the queue rail and
leaves the Curator standing, so the workshop still feels reachable — because it
is. Ruled by Rich: "curator remains... we want the user to feel they still have
access to the workshop, which they do."

HARVESTED FROM r81 (docs/SURFACES/portraits/litenco-portraits-2026-07-24-r81.html)
  The gesture is r81's and the mechanism is r81's:
    .collview{ left:calc(rail + curator + gap); transform:translateX(101%) }
    .collview.open{ transform:translateX(0) }
  Also its multi-select shape (a check per tile, a bulk bar that rises when the
  count is non-zero), and its two actions — Download and Send to Print Shop.

FOUR CORRECTIONS ON THE WAY IN
  a) r81 pins top:68px. The masthead is 90/76/60 by band in the s-line, so
     this reads var(--mh-h) and follows it.
  b) r81's left: offset is hardcoded px. Rebuilt from --stage-gutter,
     --spine-w and --room-gap, so it tracks every band without a second edit.
  c) r81 uses border-radius:12px on cards. Brought to the .silo-card clamp so
     a piece curves like a finish.
  d) r81 sizes .coll-tab at 25px and .coll-line at 22px, fixed. The stage type
     ramps now, so these are relative.

NOT PORTED, DELIBERATELY
  r81's .cv-trust badges say "Museum-grade materials and exceptional
  craftsmanship". A Crafted Image is a digital file. Material claims about a
  file are the physical-object language the positioning rules exist to keep
  out, so the badges do not come across. The trust that matters here — the
  piece is yours, it is kept, you can have it again — is said by the Curator.

  r81's Sets view. Rewards are post-launch.

  r81's featured-plus-filmstrip layout. Rich ruled a grid, because in-progress
  pieces "hold their space with animation in the grid until they land", and a
  filmstrip has no space to hold.

RULED THIS SESSION
  · two entrances: the masthead link, and arrival on the FIRST completion with
    the rest still rendering
  · in-progress pieces occupy their tile from arrival, animated, and resolve
    in place
  · filters alphabetical, all five shown whether or not they hold anything
  · five seeds, one of them in progress
  · a customer may ask for a re-render TWICE PER ACCOUNT, then the action is
    gone. Gate-triggered re-renders are the studio's own and never spend it.

THE SEEDS COME OUT WITH ONE WORD
  SEED_ON = true. Set it false and the panel is empty, which is the state the
  running scripts have to be confirmed against.

THE SEAMS — named, absent, not invented
  window.__RERENDERS_USED   read-only glass, defaults 0. The account column is
                            CC's when the wiring lands; the schema is not mine
                            to invent, so the glass only reads it.
  window.__openPaywall      still absent (item 5)
  window.__openIntake(1..4) ALREADY EXISTS in s66 and is reused for failures.
                            BUILD-INVENTORY §2.7 says the eight modals are
                            pre-craft only. Four of them are not: 1 recraft,
                            2 quality gate, 3 at capacity, 4 refunded. The
                            post-render remedy surface partly exists and this
                            build calls it rather than building a second one.

  State 4 quotes "$9.99" and "refunds settle in 5-10 days, on the card you
  used". Rich ruled failures return CREDITS, with money only via Help. That
  copy is wrong and it is CENG's to rewrite — flagged, not silently changed.
"""

import re, sys, subprocess, os, json, tempfile

SRC = "/home/claude/litenco-stage-2026-07-29-s66.html"
OUT = "/home/claude/litenco-stage-2026-07-29-s67.html"

src = open(SRC, encoding="utf-8").read()

# ══════════════════════════════════════════════════════════════════
# 1 · CSS
# ══════════════════════════════════════════════════════════════════

CSS_ANCHOR = """.tbc:not(.has-items) .tbc-open{ display:none }"""

CSS_NEW = CSS_ANCHOR + """


/* ======================================================================
   MY COLLECTION · the slide-over
   ======================================================================
   It covers the floor and the rail. It does NOT cover the Curator — she is
   the reason the workshop still feels reachable while you are looking at
   what you already own.

   The left edge is computed, not typed: gutter + spine + one room gap. r81
   hardcoded this and had to be re-tuned at every band. */
.mycoll{
  position:fixed; z-index:55;
  top:var(--mh-h); bottom:0; right:0;
  left:calc(var(--stage-gutter) + var(--spine-w) + var(--room-gap));
  display:flex; flex-direction:column;
  padding:clamp(16px,1.2vw,26px) clamp(14px,1vw,22px) 0;
  background:#1a1613;
  border-left:1px solid rgba(174,133,78,.2);
  box-shadow:-1.2rem 0 3rem rgba(18,12,8,.4);
  transform:translateX(101%);
  transition:transform .72s cubic-bezier(.16,1,.3,1);
  overflow:hidden;
}
.mycoll.is-open{ transform:translateX(0) }
.mycoll::before{
  content:""; position:absolute; inset:0; z-index:0; pointer-events:none;
  background-image:url('/textures/noise.png');
  background-size:13rem; opacity:.12; mix-blend-mode:soft-light;
}
.mycoll > *{ position:relative; z-index:1 }

/* ---- head ------------------------------------------------------------- */
.mc-head{
  display:flex; align-items:baseline; gap:.6em;
  padding-bottom:.5em;
  border-bottom:1px solid rgba(196,169,110,.18);
}
.mc-title{
  font-family:var(--serif); font-style:italic; font-size:1.7rem;
  color:var(--series);
}
.mc-n{
  font-family:var(--sans); font-size:.8rem; letter-spacing:.09em;
  text-transform:uppercase; color:rgba(233,222,200,.42);
}
.mc-close{
  margin-left:auto;
  display:inline-flex; align-items:center; gap:.45em;
  height:38px; padding:0 .9em;
  border:1px solid rgba(196,169,110,.3); border-radius:6px;
  background:rgba(255,255,255,.03);
  font-family:var(--serif); font-style:italic; font-size:1.15rem;
  color:rgba(243,237,225,.82); cursor:pointer;
  transition:background 160ms ease, color 160ms ease;
}
.mc-close:hover{ background:rgba(196,169,110,.14); color:#fff }
.mc-close svg{ width:15px; height:15px; fill:none; stroke:currentColor; stroke-width:1.6 }

.mc-say{
  padding:.7em .2em .1em;
  font-family:var(--serif); font-style:italic; font-size:1.12rem; line-height:1.5;
  color:rgba(233,222,200,.6);
}

/* ---- filters ---------------------------------------------------------- */
/* Alphabetical, and every Series shows whether or not it holds anything —
   an absent tab reads as a Series that does not exist. */
.mc-filters{
  display:flex; flex-wrap:wrap; gap:.45em;
  padding:.8em 0 .9em;
}
.mc-filter{
  padding:.4em .9em;
  border:1px solid rgba(196,169,110,.24); border-radius:99px;
  background:transparent;
  font-family:var(--serif); font-style:italic; font-size:1.1rem;
  color:rgba(233,222,200,.6); cursor:pointer; white-space:nowrap;
  transition:background 160ms ease, color 160ms ease, border-color 160ms ease;
}
.mc-filter:hover{ color:#fff; border-color:rgba(196,169,110,.44) }
.mc-filter.is-on{
  background:linear-gradient(180deg,#caa064 0%,#ba8d50 100%);
  border-color:rgba(225,189,126,.28);
  color:#2d1f14;
}
.mc-filter[data-empty="1"]:not(.is-on){ color:rgba(233,222,200,.3) }

/* ---- the grid --------------------------------------------------------- */
.mc-grid{
  flex:1; min-height:0; overflow-y:auto;
  display:grid;
  grid-template-columns:repeat(auto-fill, minmax(clamp(150px,11vw,215px),1fr));
  gap:clamp(10px,.8vw,16px);
  padding-bottom:clamp(16px,1.2vw,26px);
  align-content:start;   /* never center: with overflow, centred rows overlap */
}
.mc-empty{
  padding:2.4em .4em;
  font-family:var(--serif); font-style:italic; font-size:1.25rem; line-height:1.55;
  color:rgba(233,222,200,.4);
}

/* ---- a piece ---------------------------------------------------------- */
.piece{
  position:relative; isolation:isolate; overflow:hidden;
  aspect-ratio:var(--card-ratio);
  border:1px solid rgba(88,65,42,.3);
  border-radius:clamp(.55rem,.55vw,.8rem);
  background:#241c16;
  cursor:pointer;
  transition:transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}
.piece:hover{ transform:translateY(-.15rem); box-shadow:0 .7rem 1.5rem rgba(18,12,8,.34) }
.piece__img{
  position:absolute; inset:0; width:100%; height:100%;
  object-fit:cover; object-position:50% 22%;
}
.piece__veil{
  position:absolute; inset:auto 0 0 0; height:52%;
  background:linear-gradient(180deg, transparent, rgba(18,12,8,.82));
  pointer-events:none;
}
.piece__body{
  position:absolute; z-index:2; left:0; right:0; bottom:0;
  padding:.7em .8em;
}
.piece__name{
  margin:0;
  font-family:var(--serif); font-size:1.12rem; font-weight:400; line-height:1.15;
  color:#f7f2e9;
  text-shadow:0 .08rem .18rem rgba(18,12,8,.8);
}
.piece__series{
  display:block; margin-top:.15em;
  font-family:var(--sans); font-size:.62rem; letter-spacing:.1em;
  text-transform:uppercase; color:rgba(239,205,148,.8);
}

/* the check. Multi-select is r81's shape — a mark per tile, a bar that rises. */
.piece__pick{
  position:absolute; z-index:3; top:.5rem; left:.5rem;
  display:grid; place-items:center;
  width:1.7rem; height:1.7rem;
  border:1px solid rgba(243,237,225,.5); border-radius:50%;
  background:rgba(18,12,8,.5);
  font-family:var(--sans); font-size:.85rem; line-height:1;
  color:transparent;
  transition:background 150ms ease, color 150ms ease, border-color 150ms ease;
}
.piece:hover .piece__pick{ border-color:rgba(243,237,225,.8) }
.piece.is-picked .piece__pick{
  background:rgba(201,166,96,.95); border-color:rgba(201,166,96,.95); color:#3a2a12;
}
.piece.is-picked{ border-color:rgba(201,166,96,.62) }

/* ---- in progress ------------------------------------------------------ */
/* The tile is held from the moment the customer arrives, so the piece has a
   place before it has an image. Ruled: "they hold their space with animation
   in the grid until they land." */
.piece.is-crafting{ cursor:default; background:#201914 }
.piece.is-crafting:hover{ transform:none; box-shadow:none }
.piece.is-crafting .piece__pick{ display:none }
.piece__wait{
  position:absolute; inset:0; z-index:1;
  display:grid; place-items:center;
}
.piece__wait::after{
  content:""; position:absolute; inset:0;
  background:linear-gradient(115deg, transparent 30%, rgba(243,237,225,.09) 50%, transparent 70%);
  background-size:220% 100%;
  animation:mcShim 2.4s linear infinite;
}
@keyframes mcShim{ from{ background-position:120% 0 } to{ background-position:-120% 0 } }
.piece__ring{
  width:2.6rem; height:2.6rem;
  border:2px solid rgba(201,166,96,.22);
  border-top-color:rgba(201,166,96,.85);
  border-radius:50%;
  animation:mcSpin 1.05s linear infinite;
}
@keyframes mcSpin{ to{ transform:rotate(360deg) } }
.piece.is-crafting .piece__name{ color:rgba(247,242,233,.62) }

@media (prefers-reduced-motion:reduce){
  .piece__wait::after,.piece__ring{ animation:none }
  .piece__ring{ border-top-color:rgba(201,166,96,.5) }
}

/* ---- the bulk bar ---------------------------------------------------- */
.mc-bulk{
  position:absolute; z-index:4; left:50%; bottom:1.2rem;
  transform:translate(-50%, 150%);
  display:flex; align-items:center; gap:.7em;
  padding:.7em .9em;
  border:1px solid rgba(196,169,110,.28); border-radius:8px;
  background:rgba(26,22,19,.96);
  box-shadow:0 .9rem 2rem rgba(18,12,8,.5);
  transition:transform .34s cubic-bezier(.16,1,.3,1);
}
.mc-bulk.is-up{ transform:translate(-50%, 0) }
.mc-bulk-n{
  font-family:var(--sans); font-size:.72rem; letter-spacing:.09em;
  text-transform:uppercase; color:rgba(233,222,200,.5);
}
/* Substantial, never a micro-link. */
.mc-act{
  padding:.5em 1em;
  border:1px solid rgba(196,169,110,.34); border-radius:6px;
  background:rgba(255,255,255,.03);
  font-family:var(--serif); font-style:italic; font-size:1.1rem;
  color:rgba(243,237,225,.88); cursor:pointer; white-space:nowrap;
  transition:background 160ms ease, color 160ms ease;
}
.mc-act:hover{ background:rgba(196,169,110,.16); color:#fff }
.mc-act.is-fill{
  background:linear-gradient(180deg, var(--oxblood) 0%, #6a3737 100%);
  border-color:rgba(60,28,28,.6); color:var(--vellum-100);
}
.mc-act.is-fill:hover{ background:linear-gradient(180deg,#8f4e4e 0%, #7d4242 100%) }

/* ---- the lightbox ---------------------------------------------------- */
/* This one DOES cover everything. Looking properly at a piece is the one
   moment the workshop should get out of the way. */
.lbox{
  position:fixed; inset:0; z-index:80;
  display:none; place-items:center;
  padding:clamp(20px,3vw,60px);
  background:rgba(14,10,8,.93);
}
.lbox.is-open{ display:grid }
.lbox__frame{
  display:flex; flex-direction:column; align-items:center; gap:1em;
  max-width:min(86vw, 940px); max-height:100%;
}
.lbox__img{
  max-width:100%; max-height:68vh;
  border:1px solid rgba(196,169,110,.26); border-radius:6px;
  box-shadow:0 1.6rem 4rem rgba(0,0,0,.6);
  object-fit:contain;
}
.lbox__name{
  font-family:var(--serif); font-style:italic; font-size:1.5rem;
  color:#f7f2e9; text-align:center;
}
.lbox__series{
  display:block; margin-top:.25em;
  font-family:var(--sans); font-size:.68rem; letter-spacing:.1em;
  text-transform:uppercase; color:rgba(239,205,148,.7);
}
.lbox__acts{ display:flex; flex-wrap:wrap; justify-content:center; gap:.6em }
.lbox__nav{
  position:absolute; top:50%; transform:translateY(-50%);
  display:grid; place-items:center;
  width:3rem; height:3rem;
  border:1px solid rgba(196,169,110,.26); border-radius:50%;
  background:rgba(26,22,19,.8);
  color:rgba(243,237,225,.8); cursor:pointer;
  transition:background 160ms ease;
}
.lbox__nav:hover{ background:rgba(196,169,110,.2) }
.lbox__nav svg{ width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.8 }
.lbox__nav.is-prev{ left:clamp(10px,2vw,34px) }
.lbox__nav.is-next{ right:clamp(10px,2vw,34px) }
.lbox__x{
  position:absolute; top:clamp(12px,1.4vw,26px); right:clamp(12px,1.4vw,26px);
  display:grid; place-items:center;
  width:2.6rem; height:2.6rem;
  border:1px solid rgba(196,169,110,.22); border-radius:50%;
  background:rgba(26,22,19,.7);
  color:rgba(243,237,225,.75); cursor:pointer;
}
.lbox__x:hover{ background:rgba(196,169,110,.18); color:#fff }
.lbox__x svg{ width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:1.8 }

/* the collection is behind the lightbox, so it must not scroll under it */
body.is-lboxed{ overflow:hidden }

@media (max-width:1366px){
  .mc-title{ font-size:1.45rem }
  .mc-filter{ font-size:1rem; padding:.35em .75em }
  .piece__name{ font-size:1rem }
}"""

# ══════════════════════════════════════════════════════════════════
# 2 · MARKUP — the panel and the lightbox, after the queue-full modal
# ══════════════════════════════════════════════════════════════════

MK_ANCHOR = """<div class="scrim m-scrim" id="intakeModal" data-role="modal">"""

MK_NEW = """  <!-- ============================================================
       MY COLLECTION · slides over the floor and the rail, never the Curator
       ============================================================ -->
  <section class="mycoll" id="mycoll" aria-hidden="true" aria-label="My Collection">
    <div class="mc-head">
      <span class="mc-title">Your Collection</span>
      <span class="mc-n" id="mcN"></span>
      <button class="mc-close" id="mcClose" type="button">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3 11 8l-5 5"/></svg>
        Back to the workshop
      </button>
    </div>
    <p class="mc-say" id="mcSay"></p>
    <div class="mc-filters" id="mcFilters"></div>
    <div class="mc-grid" id="mcGrid"></div>
    <div class="mc-bulk" id="mcBulk">
      <span class="mc-bulk-n" id="mcBulkN"></span>
      <button class="mc-act is-fill" id="mcDownload" type="button">Download</button>
      <button class="mc-act" id="mcPrint" type="button">Send to Print Shop</button>
      <button class="mc-act" id="mcClear" type="button">Clear</button>
    </div>
  </section>

  <!-- ============================================================
       THE LIGHTBOX · the one thing that does cover the Curator
       ============================================================ -->
  <div class="lbox" id="lbox" aria-hidden="true">
    <button class="lbox__x" id="lboxX" type="button" aria-label="Close">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>
    </button>
    <button class="lbox__nav is-prev" id="lboxPrev" type="button" aria-label="Previous">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>
    </button>
    <div class="lbox__frame">
      <img class="lbox__img" id="lboxImg" alt="">
      <p class="lbox__name" id="lboxName"></p>
      <div class="lbox__acts" id="lboxActs"></div>
    </div>
    <button class="lbox__nav is-next" id="lboxNext" type="button" aria-label="Next">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>
    </button>
  </div>

""" + MK_ANCHOR

# ══════════════════════════════════════════════════════════════════
# 3 · JS
# ══════════════════════════════════════════════════════════════════

JS_ANCHOR = """  window.POSES  = POSES;
  window.__POSE = POSE;"""

JS_NEW = JS_ANCHOR + """


  /* ==================================================================
     MY COLLECTION
     ==================================================================
     Slides over the floor and the rail. The Curator stays, because the
     workshop stays reachable and the surface should say so.

     Two ways in, both ruled: the masthead link, and arriving on the FIRST
     completion while the rest are still rendering. */

  /* Alphabetical. Every Series shows whether or not it holds anything — a
     missing tab reads as a Series that does not exist. */
  var MC_SERIES = ['Action','Groups','Mobile Wallpapers','Pets','Portraits'];

  /* ---- the seeds --------------------------------------------------------
     SEED_ON is the whole switch. Set it false and the panel is empty, which
     is the state the running scripts have to be confirmed against.
     Art is real and already on disk — no placeholder files to keep. */
  var SEED_ON = true;
  var SEED = [
    { id:'p1', name:'Portraits - Alabaster - Rich - 001',      series:'Portraits', art:'/previews/silos/earth-ore.jpg' },
    { id:'p2', name:'Portraits - Bronze - Rich - 002',         series:'Portraits', art:'/previews/portraits/bronze/1.jpg' },
    { id:'p3', name:'Portraits - Walnut - Rich - 003',         series:'Portraits', art:'/previews/portraits/walnut/1.jpg' },
    { id:'p4', name:'Portraits - Charcoal & Chalk - Rich - 004', series:'Portraits', art:'/previews/silos/artists-gallery.jpg' },
    /* one in progress, so the animation can be judged against finished work */
    { id:'p5', name:'Portraits - Dragon Skin - Rich - 005',    series:'Portraits', art:null, crafting:true }
  ];

  var PIECES  = SEED_ON ? SEED.slice() : [];
  var MC_FILT = 'all';
  var PICKED  = {};

  /* Read-only glass. The account column is CC's when the wiring lands — the
     schema is not mine to invent, so this only reads what will be there.
     Ruled: two customer-requested re-renders PER ACCOUNT, then the action is
     gone. A gate-triggered re-render is the studio's own failure and never
     spends the customer's allowance. */
  var RERENDER_CAP = 2;
  if (typeof window.__RERENDERS_USED !== 'number') window.__RERENDERS_USED = 0;

  var mycoll   = document.getElementById('mycoll');
  var mcGrid   = document.getElementById('mcGrid');
  var mcFilters= document.getElementById('mcFilters');
  var mcN      = document.getElementById('mcN');
  var mcSay    = document.getElementById('mcSay');
  var mcBulk   = document.getElementById('mcBulk');
  var mcBulkN  = document.getElementById('mcBulkN');

  function mcVisible(){
    if (MC_FILT === 'all') return PIECES;
    return PIECES.filter(function(p){ return p.series === MC_FILT; });
  }
  function mcCount(){ return Object.keys(PICKED).length; }
  function esc(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function pieceTile(p){
    var a = document.createElement('article');
    a.className = 'piece' + (p.crafting ? ' is-crafting' : '') + (PICKED[p.id] ? ' is-picked' : '');
    a.dataset.piece = p.id;
    if (!p.crafting) a.tabIndex = 0;
    if (p.crafting){
      a.innerHTML =
        '<div class="piece__wait"><div class="piece__ring"></div></div>' +
        '<div class="piece__veil"></div>' +
        '<div class="piece__body"><h3 class="piece__name">Crafting\\u2026</h3>' +
        '<span class="piece__series">' + esc(p.series) + '</span></div>';
    } else {
      a.innerHTML =
        '<img class="piece__img" src="' + esc(p.art) + '" alt="" loading="lazy">' +
        '<span class="piece__pick" data-pick="' + esc(p.id) + '">\\u2713</span>' +
        '<div class="piece__veil"></div>' +
        '<div class="piece__body"><h3 class="piece__name">' + esc(p.name) + '</h3>' +
        '<span class="piece__series">' + esc(p.series) + '</span></div>';
    }
    return a;
  }

  function renderFilters(){
    if (!mcFilters) return;
    var rows = [{ id:'all', label:'View All' }].concat(
      MC_SERIES.map(function(s){ return { id:s, label:s }; })
    );
    mcFilters.innerHTML = rows.map(function(r){
      var held = r.id === 'all'
        ? PIECES.length
        : PIECES.filter(function(p){ return p.series === r.id; }).length;
      return '<button class="mc-filter' + (MC_FILT === r.id ? ' is-on' : '') + '" type="button"' +
             ' data-filter="' + esc(r.id) + '" data-empty="' + (held ? '0' : '1') + '">' +
             esc(r.label) + '</button>';
    }).join('');
  }

  function renderCollection(){
    if (!mcGrid) return;
    var list = mcVisible();
    mcGrid.innerHTML = '';
    if (!list.length){
      var e = document.createElement('p');
      e.className = 'mc-empty';
      e.textContent = PIECES.length
        ? 'Nothing in this Series yet.'
        : 'Nothing crafted yet. What you make will be kept here.';
      mcGrid.appendChild(e);
    } else {
      list.forEach(function(p){ mcGrid.appendChild(pieceTile(p)); });
    }
    var done = PIECES.filter(function(p){ return !p.crafting; }).length;
    var wip  = PIECES.length - done;
    if (mcN){
      mcN.textContent = !PIECES.length ? ''
        : done + (done === 1 ? ' piece' : ' pieces') + (wip ? ' \\u00b7 ' + wip + ' on the way' : '');
    }
    if (mcSay){
      mcSay.textContent = !PIECES.length
        ? ''
        : wip
          ? 'The rest are still on the bench. They will appear here as they land.'
          : 'Yours to keep. Download any of them, or send one to the Print Shop.';
    }
    renderFilters();
    updateBulk();
  }

  function updateBulk(){
    if (!mcBulk) return;
    var n = mcCount();
    if (mcBulkN) mcBulkN.textContent = n + ' selected';
    mcBulk.classList.toggle('is-up', n > 0);
  }

  function togglePick(id){
    if (PICKED[id]) delete PICKED[id]; else PICKED[id] = true;
    var el = mcGrid.querySelector('[data-piece="' + id + '"]');
    if (el) el.classList.toggle('is-picked', !!PICKED[id]);
    updateBulk();
  }

  function showCollection(){
    if (!mycoll) return;
    renderCollection();
    mycoll.classList.add('is-open');
    mycoll.setAttribute('aria-hidden', 'false');
  }
  function hideCollection(){
    if (!mycoll) return;
    mycoll.classList.remove('is-open');
    mycoll.setAttribute('aria-hidden', 'true');
  }

  /* Entrance two: the first completion arrives and we come here, with the
     rest still rendering and holding their tiles. Named for the wiring to
     call — this build does not invent how a render reports itself. */
  window.__pieceLanded = function(piece){
    if (piece && piece.id){
      var at = -1;
      PIECES.forEach(function(p, i){ if (p.id === piece.id) at = i; });
      if (at >= 0) PIECES[at] = piece; else PIECES.unshift(piece);
    }
    var firstLanding = PIECES.filter(function(p){ return !p.crafting; }).length === 1;
    if (firstLanding) showCollection(); else renderCollection();
  };

  /* ---- the lightbox ---------------------------------------------------- */
  var lbox     = document.getElementById('lbox');
  var lboxImg  = document.getElementById('lboxImg');
  var lboxName = document.getElementById('lboxName');
  var lboxActs = document.getElementById('lboxActs');
  var LB_AT    = 0;

  function lbList(){ return mcVisible().filter(function(p){ return !p.crafting; }); }

  function paintLightbox(){
    var list = lbList(); var p = list[LB_AT];
    if (!p) return;
    lboxImg.src = p.art || '';
    lboxName.innerHTML = esc(p.name) + '<span class="lbox__series">' + esc(p.series) + '</span>';
    /* The re-render offer lives HERE and not on the tile. Rejecting a piece is
       a considered act, taken while looking at it properly — not a hover. */
    var left = RERENDER_CAP - window.__RERENDERS_USED;
    var acts = '<button class="mc-act is-fill" data-lb="dl">Download</button>' +
               '<button class="mc-act" data-lb="pr">Send to Print Shop</button>';
    if (left > 0){
      acts += '<button class="mc-act" data-lb="re">' +
              (left === 1 ? 'Craft this again \\u00b7 last one' : 'Craft this again') +
              '</button>';
    }
    lboxActs.innerHTML = acts;
  }
  function openLightbox(id){
    var list = lbList(); var at = -1;
    list.forEach(function(p, i){ if (p.id === id) at = i; });
    if (at < 0) return;
    LB_AT = at;
    paintLightbox();
    lbox.classList.add('is-open');
    lbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-lboxed');
  }
  function closeLightbox(){
    lbox.classList.remove('is-open');
    lbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-lboxed');
  }
  function stepLightbox(d){
    var n = lbList().length; if (!n) return;
    LB_AT = (LB_AT + d + n) % n;
    paintLightbox();
  }

  /* ---- wiring ---------------------------------------------------------- */
  if (mcGrid){
    mcGrid.addEventListener('click', function(e){
      var chk = e.target.closest('[data-pick]');
      if (chk){ e.stopPropagation(); togglePick(chk.dataset.pick); return; }
      var tile = e.target.closest('.piece');
      if (tile && !tile.classList.contains('is-crafting')) openLightbox(tile.dataset.piece);
    });
    mcGrid.addEventListener('keydown', function(e){
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var tile = e.target.closest('.piece');
      if (tile && !tile.classList.contains('is-crafting')){ e.preventDefault(); openLightbox(tile.dataset.piece); }
    });
  }
  if (mcFilters){
    mcFilters.addEventListener('click', function(e){
      var b = e.target.closest('[data-filter]'); if (!b) return;
      MC_FILT = b.dataset.filter;
      renderCollection();
    });
  }

  /* Download and Print report on the button and settle back. The real calls
     are the wiring's; this build must not invent their contract. */
  function flash(btn, said, back){
    btn.textContent = said;
    setTimeout(function(){ btn.textContent = back; }, 1600);
  }
  var mcDownload = document.getElementById('mcDownload');
  var mcPrint    = document.getElementById('mcPrint');
  var mcClear    = document.getElementById('mcClear');
  if (mcDownload) mcDownload.addEventListener('click', function(){
    var n = mcCount();
    flash(mcDownload, n > 1 ? ('Downloading ' + n + ' as .zip \\u2713') : 'Downloading \\u2713', 'Download');
  });
  if (mcPrint) mcPrint.addEventListener('click', function(){
    flash(mcPrint, 'Sent ' + mcCount() + ' to the Print Shop \\u2713', 'Send to Print Shop');
  });
  if (mcClear) mcClear.addEventListener('click', function(){
    PICKED = {};
    [].forEach.call(mcGrid.querySelectorAll('.piece'), function(el){ el.classList.remove('is-picked'); });
    updateBulk();
  });

  if (lboxActs) lboxActs.addEventListener('click', function(e){
    var b = e.target.closest('[data-lb]'); if (!b) return;
    var what = b.dataset.lb;
    if (what === 'dl') flash(b, 'Downloading \\u2713', 'Download');
    else if (what === 'pr') flash(b, 'Sent to the Print Shop \\u2713', 'Send to Print Shop');
    else if (what === 're'){
      /* Two per account, then the action is gone. The count is glass here and
         the account column is CC's — this reads and reports, it does not own. */
      window.__RERENDERS_USED = Math.min(RERENDER_CAP, window.__RERENDERS_USED + 1);
      if (typeof window.__requestRerender === 'function') window.__requestRerender(lbList()[LB_AT]);
      paintLightbox();
    }
  });

  var lboxX = document.getElementById('lboxX');
  if (lboxX) lboxX.addEventListener('click', closeLightbox);
  var lboxPrev = document.getElementById('lboxPrev');
  var lboxNext = document.getElementById('lboxNext');
  if (lboxPrev) lboxPrev.addEventListener('click', function(){ stepLightbox(-1); });
  if (lboxNext) lboxNext.addEventListener('click', function(){ stepLightbox(1); });
  if (lbox) lbox.addEventListener('click', function(e){ if (e.target === lbox) closeLightbox(); });

  addEventListener('keydown', function(e){
    if (!lbox || !lbox.classList.contains('is-open')) return;
    if (e.key === 'Escape'){ closeLightbox(); return; }
    if (e.key === 'ArrowLeft')  stepLightbox(-1);
    if (e.key === 'ArrowRight') stepLightbox(1);
  });

  var mcClose = document.getElementById('mcClose');
  if (mcClose) mcClose.addEventListener('click', hideCollection);
  addEventListener('keydown', function(e){
    if (e.key !== 'Escape') return;
    if (lbox && lbox.classList.contains('is-open')) return;   /* lightbox first */
    if (mycoll && mycoll.classList.contains('is-open')) hideCollection();
  });

  /* Entrance one: the masthead link, which had nothing behind it until now. */
  [].forEach.call(document.querySelectorAll('.mh-nav a, .mh-drawer a'), function(a){
    if ((a.textContent || '').trim().toLowerCase() === 'my collection'){
      a.addEventListener('click', function(e){ e.preventDefault(); showCollection(); });
    }
  });

  renderCollection();

  window.__showCollection = showCollection;
  window.__hideCollection = hideCollection;"""

# ══════════════════════════════════════════════════════════════════
# 4 · BANNED VOCABULARY — my own error, four revisions old
#     I wrote 'sculpts' into the Curator's line for goofy in s61. sculpt /
#     sculpture / sculpted are banned everywhere because they imply a physical
#     object, and a Crafted Image is a file. It survived four accepted
#     revisions because nothing was checking. The gate below now checks.
# ══════════════════════════════════════════════════════════════════

VOCAB_OLD = """      'and it always sculpts well. Something about a face that is not behaving.' +"""
VOCAB_NEW = """      'and it always crafts well. Something about a face that is not behaving.' +"""

EDITS = [
    ("collection css",    CSS_ANCHOR, CSS_NEW),
    ("collection markup", MK_ANCHOR,  MK_NEW),
    ("collection js",     JS_ANCHOR,  JS_NEW),
    ("banned vocab",      VOCAB_OLD,  VOCAB_NEW),
]

# ── measure ───────────────────────────────────────────────────────
def count_ids(s):   return len(set(re.findall(r'id="([^"]*)"', s)))
def count_fetch(s): return len(re.findall(r'\bfetch\s*\(', s))
def count_fns(s):   return len(re.findall(r'^\s*(?:async\s+)?function\s+[A-Za-z_$]', s, re.M))
def count_faces(s): return len(re.findall(r'class="face face--', s))

before = dict(ids=count_ids(src), fetch=count_fetch(src), fns=count_fns(src),
              faces=count_faces(src))

for name, old, new in EDITS:
    n = src.count(old)
    assert n == 1, f"anchor '{name}' found {n} times, expected 1"

out = src
for name, old, new in EDITS:
    out = out.replace(old, new, 1)

after = dict(ids=count_ids(out), fetch=count_fetch(out), fns=count_fns(out),
             faces=count_faces(out))

fails = []

# ══════════════════════════════════════════════════════════════════
# GATES
# ══════════════════════════════════════════════════════════════════

if after["fetch"] != 0:
    fails.append(f"FETCH: must stay fetchless, found {after['fetch']}")
if after["faces"] != 3:
    fails.append(f"FACES: the collection is an overlay, not a fourth face — got {after['faces']}")
if after["ids"] <= before["ids"]:
    fails.append(f"IDS: expected new ids, {before['ids']} -> {after['ids']}")
if after["fns"] <= before["fns"]:
    fails.append(f"FNS: expected new functions, {before['fns']} -> {after['fns']}")

MUST = [
    'id="mycoll"', 'id="mcGrid"', 'id="mcFilters"', 'id="mcBulk"', 'id="lbox"',
    'function showCollection', 'function hideCollection', 'function renderCollection',
    'function pieceTile', 'function openLightbox', 'function stepLightbox',
    'var SEED_ON = true', 'var RERENDER_CAP = 2',
    'window.__pieceLanded', 'window.__RERENDERS_USED',
    'left:calc(var(--stage-gutter) + var(--spine-w) + var(--room-gap))',
    'top:var(--mh-h)',
    '.mycoll.is-open{ transform:translateX(0) }',
    'align-content:start',
    "var MC_SERIES = ['Action','Groups','Mobile Wallpapers','Pets','Portraits']",
]
for m in MUST:
    if m not in out:
        fails.append(f"MUST-EXIST: {m}")

# the Curator must NOT be covered — the panel's left edge starts past the spine
seg = re.search(r'\.mycoll\{(.*?)\n\}', out, re.S).group(1)
if "left:calc(var(--stage-gutter) + var(--spine-w)" not in seg:
    fails.append("CURATOR: the panel must start to the right of the spine")
if re.search(r'\.mycoll\{[^}]*left:\s*0', out):
    fails.append("CURATOR: the panel must not start at the viewport edge")

# r81's hardcoded masthead offset must not survive
if "top:68px" in out:
    fails.append("BAND: r81's hardcoded top:68px survived — must read var(--mh-h)")

# banned physical-object language, and r81's material claims about a file
for bad in ("Museum-grade", "museum-grade", "sculpt", "Sculpt", "sculpture",
            "Sculpture", "In-Situ", "In Situ"):
    if bad in out:
        fails.append(f"POSITIONING: '{bad}' must not appear — a Crafted Image is a file")
if "and it always crafts well" not in out:
    fails.append("VOCAB: the goofy line must read 'crafts well', not 'sculpts well'")

# filters alphabetical, five, and View All first
m = re.search(r"var MC_SERIES = \[(.*?)\]", out)
got = re.findall(r"'([^']+)'", m.group(1)) if m else []
if got != sorted(got):
    fails.append(f"FILTERS: must be alphabetical, got {got}")
if len(got) != 5:
    fails.append(f"FILTERS: expected the locked five, got {len(got)}")

# five seeds, exactly one in progress
seedblock = re.search(r'var SEED = \[(.*?)\n  \];', out, re.S).group(1)
if seedblock.count("{ id:'") != 5:
    fails.append(f"SEED: expected 5 pieces, got {seedblock.count(chr(123) + chr(32) + chr(105))}")
if seedblock.count("crafting:true") != 1:
    fails.append("SEED: exactly one seed must be in progress")

# seed art must be real paths already on disk
for art in re.findall(r"art:'([^']+)'", seedblock):
    if not art.startswith('/previews/'):
        fails.append(f"SEED ART: {art} is not a real preview path")

# grid must never centre rows — align-content:center with overflow overlaps them
if re.search(r'\.mc-grid\{[^}]*align-content:\s*center', out):
    fails.append("GRID: align-content:center with overflow makes rows overlap")

# radius: card curves, pills, or circles — never the middle
for v in re.findall(r'border-radius:\s*(\d+)px', out):
    if 13 < int(v) < 99:
        fails.append(f"RADIUS: {v}px is neither a card curve nor a pill")

# style braces
for sm in re.findall(r'<style[^>]*>(.*?)</style>', out, re.S):
    if sm.count("{") != sm.count("}"):
        fails.append(f"BRACE: style block unbalanced {sm.count('{')} vs {sm.count('}')}")

# node --check
for i, sm in enumerate(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', out, re.S)):
    if not sm.strip():
        continue
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False, encoding="utf-8") as fh:
        fh.write(sm); p = fh.name
    r = subprocess.run(["node", "--check", p], capture_output=True, text=True)
    os.unlink(p)
    if r.returncode != 0:
        fails.append(f"NODE --CHECK: block {i} — {r.stderr.strip().splitlines()[0]}")

# ══════════════════════════════════════════════════════════════════
# BOOT GATE — and it drives the collection, not just the workshop
# ══════════════════════════════════════════════════════════════════

BOOT_HARNESS = r"""
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push(e.message.split('\n')[0]));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
const dom = new JSDOM(fs.readFileSync(process.argv[2], 'utf8'), {
  runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
});
setTimeout(() => {
  const w = dom.window, d = w.document;
  const q = s => d.querySelectorAll(s).length;
  const txt = id => { const e = d.getElementById(id); return e ? e.textContent.trim() : null; };
  const probes = {
    verb: txt('tbcGoVerb'), siloCards: q('.face--silos .silo-card'), faces: q('.face'),
    poses: typeof w.POSES,
    tiles: q('#mcGrid .piece'),
    crafting: q('#mcGrid .piece.is-crafting'),
    filters: q('#mcFilters .mc-filter'),
    filterFirst: (d.querySelector('#mcFilters .mc-filter') || {}).textContent,
    n: txt('mcN'),
    openAtRest: d.getElementById('mycoll').classList.contains('is-open'),
    rerenders: w.__RERENDERS_USED,
    hasShow: typeof w.__showCollection,
    hasLanded: typeof w.__pieceLanded,
  };
  // drive it: open, filter, pick, lightbox
  const acts = {};
  try {
    w.__showCollection();
    acts.opens = d.getElementById('mycoll').classList.contains('is-open');
    const pets = [...d.querySelectorAll('#mcFilters .mc-filter')]
      .find(b => b.dataset.filter === 'Pets');
    pets.click();
    acts.petsEmpty = q('#mcGrid .mc-empty') === 1;
    [...d.querySelectorAll('#mcFilters .mc-filter')].find(b => b.dataset.filter === 'all').click();
    acts.backToAll = q('#mcGrid .piece');
    d.querySelector('#mcGrid .piece:not(.is-crafting) [data-pick]').click();
    acts.bulkUp = d.getElementById('mcBulk').classList.contains('is-up');
    acts.bulkText = txt('mcBulkN');
    d.querySelector('#mcGrid .piece:not(.is-crafting)').click();
    acts.lboxOpen = d.getElementById('lbox').classList.contains('is-open');
    acts.lboxActs = q('#lboxActs .mc-act');
  } catch (e) { acts.error = e.message; }
  console.log(JSON.stringify({ errors, probes, acts }));
}, 800);
"""

html_path = "/home/claude/.gate-boot.html"
harness   = "/home/claude/.gate-boot.js"
open(html_path, "w", encoding="utf-8").write(out)
open(harness,   "w", encoding="utf-8").write(BOOT_HARNESS)
boot = subprocess.run(["node", harness, html_path], capture_output=True, text=True,
                      cwd="/home/claude")

rep = None
line = [l for l in boot.stdout.splitlines() if l.startswith("{")]
if not line:
    fails.append(f"BOOT GATE: no report — {boot.stderr.strip()[:250]}")
else:
    rep = json.loads(line[-1])
    for e in rep["errors"]:
        fails.append(f"BOOT ERROR: {e}")
    p, a = rep["probes"], rep["acts"]
    # the workshop still works
    if p["verb"] != "Next":       fails.append(f"BOOT: verb {p['verb']!r}")
    if p["siloCards"] != 8:       fails.append(f"BOOT: silo cards {p['siloCards']}")
    if p["faces"] != 3:           fails.append(f"BOOT: faces {p['faces']}")
    if p["poses"] != "object":    fails.append(f"BOOT: window.POSES {p['poses']!r}")
    # the collection rendered
    if p["tiles"] != 5:           fails.append(f"BOOT: expected 5 tiles, got {p['tiles']}")
    if p["crafting"] != 1:        fails.append(f"BOOT: expected 1 in-progress tile, got {p['crafting']}")
    if p["filters"] != 6:         fails.append(f"BOOT: expected 6 filters, got {p['filters']}")
    if (p["filterFirst"] or "").strip() != "View All":
        fails.append(f"BOOT: first filter should be View All, got {p['filterFirst']!r}")
    if p["n"] != "4 pieces \u00b7 1 on the way":
        fails.append(f"BOOT: count line reads {p['n']!r}")
    if p["openAtRest"]:           fails.append("BOOT: the panel must be closed at rest")
    if p["rerenders"] != 0:       fails.append(f"BOOT: __RERENDERS_USED should start 0, got {p['rerenders']}")
    if p["hasShow"] != "function":   fails.append("BOOT: __showCollection missing")
    if p["hasLanded"] != "function": fails.append("BOOT: __pieceLanded missing")
    # and it behaves
    if a.get("error"):            fails.append(f"BOOT DRIVE: {a['error']}")
    if not a.get("opens"):        fails.append("BOOT DRIVE: panel did not open")
    if not a.get("petsEmpty"):    fails.append("BOOT DRIVE: Pets filter should show the empty line")
    if a.get("backToAll") != 5:   fails.append(f"BOOT DRIVE: View All should restore 5, got {a.get('backToAll')}")
    if not a.get("bulkUp"):       fails.append("BOOT DRIVE: bulk bar did not rise on a pick")
    if a.get("bulkText") != "1 selected":
        fails.append(f"BOOT DRIVE: bulk reads {a.get('bulkText')!r}")
    if not a.get("lboxOpen"):     fails.append("BOOT DRIVE: lightbox did not open")
    if a.get("lboxActs") != 3:
        fails.append(f"BOOT DRIVE: expected 3 lightbox actions (dl/print/re-render), got {a.get('lboxActs')}")

# ── report ────────────────────────────────────────────────────────
print("BUILD s66 -> s67   My Collection")
print("-" * 58)
for k in ("ids", "fetch", "fns", "faces"):
    print(f"  {k:<7} {before[k]:>6}  ->  {after[k]:>6}")
if rep:
    p, a = rep["probes"], rep["acts"]
    print("-" * 58)
    print(f"  boot errors   {len(rep['errors'])}")
    print(f"  tiles         {p['tiles']}  ({p['crafting']} in progress)")
    print(f"  filters       {p['filters']}  first={p['filterFirst']!r}")
    print(f"  count line    {p['n']!r}")
    print(f"  opens         {a.get('opens')}")
    print(f"  pets empty    {a.get('petsEmpty')}")
    print(f"  bulk          {a.get('bulkText')!r} up={a.get('bulkUp')}")
    print(f"  lightbox      open={a.get('lboxOpen')} actions={a.get('lboxActs')}")
print("-" * 58)

if fails:
    print("GATE FAILED — nothing written")
    for f_ in fails:
        print("  x " + f_)
    sys.exit(1)

open(OUT, "w", encoding="utf-8").write(out)
print("GATE PASSED")
print(f"written: {OUT}")
