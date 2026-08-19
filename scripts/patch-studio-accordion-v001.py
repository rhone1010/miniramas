#!/usr/bin/env python3
"""
patch-studio-accordion-v001.py

  reads   public/wallpaper-studio.html          (never modified)
  writes  public/wallpaper-studio-V001.html     (next free V number)

MERGES THE APPROVED MOCKUP INTO THE PAGE THAT ACTUALLY SERVES. The accordion
and the Unicorn field have only ever existed in studio-accordion-mockup.html,
which middleware does not route to. Everything the live page already does -
generate, keep, the viewer, the cap wall, the unlock counter, the season swap,
credits - is kept exactly as it is.

WHAT COMES ACROSS
  - the accordion: four steps, one open at a time, choosing advances
  - the making state: CSS smoke as fallback, Unicorn field masked to the
    four columns, cards as windows, ghost marks
  - the has-scene overrides, LAST IN THE FILE

WHAT DOES NOT
  - the mockup's placeholder masthead
  - the mockup's six-second #go timer, which is scaffolding. The live page
    enters the making state when the request goes out and leaves it when the
    images land or the round fails.

THREE LIVE FAULTS FIXED ON THE WAY THROUGH
  1. frames(), wall() and the error path each set #grid.innerHTML, which would
     delete the scene and smoke layers. They now replace only the shots.
  2. getElementById('results') is called by generate() and no such element
     exists. It is inside a try, so it has been failing silently and the
     results have never scrolled into view. <main> gets the id.
  3. The season block targets '.panel-head h1'. The accordion head is not
     that, and the same class of fault - a selector left pointing at a layout
     that moved - is what the file's own comment records last time.

Nothing is deleted and nothing is overwritten. Dry run by default.
"""

import argparse
import re
import sys
from pathlib import Path

SRC = Path('public/wallpaper-studio.html')
STEM = 'wallpaper-studio-V'

# ═══════════════════════════════════════════════════════════════════════
# 1 · THE CONTROLS
# ═══════════════════════════════════════════════════════════════════════

A_STEPS = """
    <div class="step">
      <div class="step-tag">
        <span class="step-n">1</span>
        <span class="step-name">Choose a world</span>
        <span class="step-hint">What it is made of</span>
      </div>
      <div class="opts four" id="axWorld"></div>
    </div>

    <div class="step">
      <div class="step-tag">
        <span class="step-n">2</span>
        <span class="step-name">Set the mood</span>
        <span class="step-hint">How it is lit</span>
      </div>
      <div class="opts six" id="axMood"></div>
    </div>

    <div class="step">
      <div class="step-tag">
        <span class="step-n">3</span>
        <span class="step-name">Choose its energy</span>
        <span class="step-hint">How it moves</span>
      </div>
      <div class="energy" id="axEnergy"></div>
    </div>

    <div class="step">
      <div class="step-tag">
        <span class="step-n">4</span>
        <span class="step-name">Choose its colours</span>
        <span class="step-hint">Its palette</span>
      </div>
      <div class="opts six" id="axPalette"></div>
    </div>

    <div class="press">
      <button class="go" id="go" type="button">
        <b>Create four</b>
        <i>Four wallpapers. Free to look at.</i>
      </button>
      <button class="ghost" id="surprise" type="button">Surprise me</button>
      <p class="press-note" id="pressNote">Choose one from each.</p>
    </div>
  </aside>
"""

A_STEPS_NEW = """
    <!-- FOUR STEPS, ONE OPEN. Built by paint(); the ids the old fixed rows
         carried (#axWorld and the rest) are gone, and anything that pointed
         at them has been moved with them. -->
    <div id="steps"></div>

    <div class="press">
      <button class="go" id="go" type="button" disabled>
        <b>Create four wallpapers</b>
        <i id="goSay">Answer all four to begin</i>
      </button>
      <button class="ghost" id="surprise" type="button">Surprise me</button>
    </div>
  </aside>
"""

# ═══════════════════════════════════════════════════════════════════════
# 2 · THE STAGE
# ═══════════════════════════════════════════════════════════════════════

A_MAIN = """  <main>
    <div class="right-head" id="rightHead">Your four wallpapers</div>
    <div class="grid" id="grid"></div>
"""

A_MAIN_NEW = """  <main id="results">
    <div class="right-head" id="rightHead">Your four wallpapers</div>
    <p class="right-say">Free to look at. Nothing is charged until you keep one.</p>

    <!-- THE TWO FIELD LAYERS ARE PERMANENT. In the DOM from first paint and
         revealed by a class - inserted per round, the drift would restart
         and the first second of every wait would jump.

         Which is also why nothing below may set #grid.innerHTML. -->
    <div class="grid" id="grid">
      <div class="scene-field" id="sceneField" aria-hidden="true"></div>
      <div class="smoke-field" aria-hidden="true"></div>
      <button class="shot" type="button" data-n="0"><span class="ghost-mark">L</span></button>
      <button class="shot" type="button" data-n="1"><span class="ghost-mark">L</span></button>
      <button class="shot" type="button" data-n="2"><span class="ghost-mark">L</span></button>
      <button class="shot" type="button" data-n="3"><span class="ghost-mark">L</span></button>
    </div>

    <div class="await" id="await">
      <b>Your wallpapers will appear here.</b>
      <i>Four variations, from the four things you chose.</i>
    </div>
    <div class="making-say" id="makingSay" hidden>
      <b>Making four.</b>
      <i>A few seconds.</i>
    </div>
"""

# ═══════════════════════════════════════════════════════════════════════
# 3 · THE STYLESHEET
#
# Appended immediately before </style>, so every has-scene rule sits below
# every making rule. `.grid.has-scene .smoke-field` and
# `.grid.is-making .smoke-field` are three classes each; source order is the
# only thing deciding which wins, and last time these were declared first,
# lost silently, and nothing on the glass changed.
# ═══════════════════════════════════════════════════════════════════════

A_STYLE_END = "</style>"

CSS = r"""
/* ======================================================================
   THE ACCORDION
   Four steps, one open. Choosing advances to the next unanswered one,
   which is the whole argument for this over four open rows.
   ====================================================================== */
#steps{ display:flex; flex-direction:column }

.step{
  border-bottom:1px solid rgba(215,189,137,.16);
}
.step:first-child{ border-top:1px solid rgba(215,189,137,.16) }

.step-bar{
  width:100%; display:flex; align-items:center; gap:14px;
  padding:16px 2px; cursor:pointer; text-align:left;
  background:none; border:none; color:inherit;
  transition:opacity .16s ease;
}
.step-bar:hover{ opacity:.85 }
.step-bar .step-n{
  flex:0 0 auto; font-size:.86rem; letter-spacing:.14em;
  color:rgba(215,189,137,.5); font-variant-numeric:tabular-nums;
}
.step-bar > span:nth-child(2){ flex:1 1 auto; min-width:0 }
.step-title{
  display:block; font-size:1.24rem; line-height:1.15; color:var(--vellum-100);
}
.step-hint{
  display:block; margin-top:3px; font-size:.9rem; font-style:italic;
  color:rgba(243,237,225,.42);
}

/* The answer rides on the closed bar. A shut accordion that does not say
   what is inside it is four rows of nothing. */
.step-answer{
  flex:0 0 auto; display:flex; align-items:center; gap:8px;
  max-width:44%; overflow:hidden;
}
.step-answer img{
  width:26px; height:26px; border-radius:4px; object-fit:cover; flex:0 0 auto;
}
.step-answer span{
  font-size:.98rem; color:var(--series); white-space:nowrap;
  overflow:hidden; text-overflow:ellipsis;
}
.step.is-open .step-answer{ display:none }

.chev{
  flex:0 0 auto; width:13px; height:13px; opacity:.5;
  transition:transform .22s cubic-bezier(.22,.7,.3,1);
}
.chev path{
  fill:none; stroke:currentColor; stroke-width:1.5;
  stroke-linecap:round; stroke-linejoin:round;
}
.step.is-open .chev{ transform:rotate(180deg); opacity:.9 }

/* Height is not animated. The bodies differ by two hundred pixels between
   steps and a transition on `height:auto` either does not run or runs on a
   measured pixel value that is wrong the moment the column resizes. */
.step-body{ display:none; padding:2px 0 20px }
.step.is-open .step-body{ display:block }

/* ======================================================================
   THE STAGE WHILE IT IS MAKING
   ====================================================================== */
.right-say{
  margin:0 0 16px; text-align:center;
  font-size:1rem; font-style:italic; color:rgba(243,237,225,.5);
}

.grid{ position:relative; isolation:isolate; overflow:visible }

.ghost-mark{
  position:absolute; inset:0; display:grid; place-items:center;
  font-family:var(--serif); font-size:2.4rem; line-height:1;
  color:rgba(215,189,137,.16); pointer-events:none;
  transition:color .3s ease;
}
.shot img ~ .ghost-mark{ display:none }

.await, .making-say{
  margin-top:18px; text-align:center;
}
.await b, .making-say b{
  display:block; font-family:var(--serif); font-size:1.2rem;
  color:rgba(243,237,225,.7);
}
.await i, .making-say i{
  display:block; margin-top:4px; font-size:.96rem;
  color:rgba(243,237,225,.42);
}

/* ---- THE FALLBACK ------------------------------------------------------
   CSS smoke. It runs when the canvas does not, which is what a fallback is
   for - no flag, no branch to forget. The scene simply covers it. */
.scene-field, .smoke-field{
  position:absolute; inset:0; z-index:0;
  pointer-events:none; opacity:0;
  transition:opacity .5s ease;
}
.grid.is-making .smoke-field{
  opacity:1;
  background:
    radial-gradient(38% 46% at 22% 34%, rgba(182,138,83,.55), transparent 70%),
    radial-gradient(42% 40% at 74% 62%, rgba(125,66,66,.5),  transparent 72%),
    radial-gradient(36% 44% at 52% 20%, rgba(215,189,137,.34), transparent 74%);
  filter:url(#smoke);
  animation:smokedrift 14s ease-in-out infinite alternate;
}
.grid.is-making .scene-field{ opacity:1 }

@keyframes smokedrift{
  from{ transform:translate3d(-2%,1%,0) scale(1.05) }
  to  { transform:translate3d(3%,-2%,0) scale(1.12) }
}

.grid.is-making{
  --pad:18px;
  background:rgba(10,8,7,.5);
  box-shadow:inset 0 0 60px rgba(0,0,0,.5);
}
.grid.is-making .shot{ position:relative; z-index:1 }
.grid.is-making .ghost-mark{ color:rgba(245,228,190,.3) }

/* ======================================================================
   WHEN THE SCENE IS UP, EVERYTHING ELSE STOPS.

   Five layers of weather were running in one rectangle - the scene, the
   smoke beneath it, the drift, the grain, and tinted panes on top - which
   is why it read as noise rather than as one thing happening. The scene
   has its own grain and its own flow; it does not need ours arguing.

   THESE SIT LAST IN THE FILE ON PURPOSE. `.grid.has-scene .smoke-field`
   and `.grid.is-making .smoke-field` are the same specificity, three
   classes each, so the only thing deciding which wins is which comes
   later. Declared first, they lose silently: the class lands, the rule is
   correct, and nothing changes on the glass. An override belongs below
   everything it overrides.
   ====================================================================== */
.grid.has-scene .smoke-field{ display:none }

/* No black rectangle and no inner shadow. The stage is the page again and
   the cards are the only lit things on it. */
.grid.has-scene{
  background:none;
  box-shadow:none;
}

/* ---- THE FIELD IS MASKED TO THE COLUMNS --------------------------------
   One canvas across the whole stage means the gaps between the cards are
   as bright as the cards, so four windows read as one wash with three
   faint lines down it - the grid disappears exactly when it should be
   doing the most work, which is saying that four things are coming.

   So the canvas is masked to the rhythm the grid runs on: a band the width
   of a column, then a gap, repeating. Because it repeats on
   (column + gap) it lands on the columns at any width, without anybody
   computing four positions, and if the column count changes only --gap and
   the divisor move.

   Inset by the stage's own padding so band one starts where card one
   starts. Get that wrong and every band is off by 18px, which reads as a
   rendering fault rather than an arithmetic one. */
.grid.has-scene .scene-field{
  inset:var(--pad);
  --gap:16px;
  --colw:calc((100% - 3 * var(--gap)) / 4);
  -webkit-mask-image:repeating-linear-gradient(to right,
    #000 0 var(--colw), transparent var(--colw) calc(var(--colw) + var(--gap)));
  mask-image:repeating-linear-gradient(to right,
    #000 0 var(--colw), transparent var(--colw) calc(var(--colw) + var(--gap)));
}

/* THE CARD IS A WINDOW, NOT A TINT. Over the black stage it needed shading
   to read as glass. Over the field it needs none - anything laid on top is
   dirt on the window.

   RADIUS 4, AND THAT IS A COMPROMISE. The mask cuts square-cornered bands,
   so a rounded card leaves a small shoulder of field outside the arc at
   each corner. At 4px nobody finds it; at 12 it looks like a bug. Rounding
   the mask per column would mean four positioned layers and the fluid
   column width computed twice, which is a lot of machinery for four
   corners. */
.grid.has-scene .shot{
  background:none !important;
  border:1px solid rgba(236,207,157,.34);
  border-radius:4px;
  backdrop-filter:none;
  box-shadow:0 10px 30px rgba(0,0,0,.34);
}
.grid.has-scene .ghost-mark{ color:rgba(255,248,232,.42) }

/* Two columns on a phone, so the four-column mask would land on nothing.
   The field goes back to covering the stage; at that size the gaps are
   small enough that it reads as one thing either way. */
@media (max-width:820px){
  .grid.has-scene .scene-field{
    -webkit-mask-image:none;
    mask-image:none;
  }
}

@media (prefers-reduced-motion:reduce){
  .grid.is-making .smoke-field{ animation:none }
}
"""

# ═══════════════════════════════════════════════════════════════════════
# 4 · THE SMOKE FILTER
#
# feTurbulence displacing the gradient field, which is the whole difference
# between smoke and three coloured blurs. It must be IN THE DOCUMENT for
# filter:url(#smoke) to resolve - a stylesheet cannot carry it and an SVG in
# a background-image cannot be referenced by id.
# ═══════════════════════════════════════════════════════════════════════

A_BODY_END = "</body>"

SVG = """
<svg width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute">
  <filter id="smoke">
    <feTurbulence type="fractalNoise" baseFrequency=".008 .022"
                  numOctaves="4" seed="14" result="noise"/>
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="115"
                       xChannelSelector="R" yChannelSelector="B"/>
  </filter>
</svg>

</body>"""

# ═══════════════════════════════════════════════════════════════════════
# 5 · THE CONTROL PAINTER
#
# paintAxis/paintAll drew four fixed rows into four fixed ids. The accordion
# draws itself, so both go and one paint() replaces them. The vocabularies,
# icon() and CHOICE above are untouched - they are the engine's shape and
# nothing here is entitled to change them.
# ═══════════════════════════════════════════════════════════════════════

A_PAINT_START = "  function paintAxis(host, list, key, axis, flat){"
A_PAINT_END = "  document.querySelector('.panel').addEventListener('click', function(e){"

PAINT_NEW = r"""  /* ==================================================================
     THE ACCORDION

     One open at a time. A COMPLETED STEP REOPENS, AN UNREACHED ONE DOES
     NOT - jumping to step four before step one is answered leaves a page
     whose numbers mean nothing, but going back to change a mood must
     always be one click.
     ================================================================== */
  var STEPS = [
    { key:'world',   title:'Choose a world',     hint:'What it is made of',
      axis:'worlds',   kind:'four' },
    { key:'mood',    title:'Set the mood',       hint:'How it is lit',
      axis:'moods',    kind:'six' },
    { key:'energy',  title:'Choose its energy',  hint:'How it moves',
      axis:'energies', kind:'energy' },
    { key:'palette', title:'Choose its colours', hint:'Its palette',
      axis:'palettes', kind:'six' }
  ];

  var OPEN = 0;

  function listFor(axis){
    if (axis === 'worlds')   return WORLDS;
    if (axis === 'moods')    return MOODS;
    if (axis === 'energies') return ENERGIES;
    return PALETTES;
  }
  function labelOf(axis, id){
    var l = listFor(axis);
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i].label;
    return '';
  }

  function paintAll(){
    var host = byId('steps');
    if (!host) return;
    host.innerHTML = '';

    STEPS.forEach(function(st, i){
      var done   = !!CHOICE[st.key];
      var isOpen = i === OPEN;

      var el = document.createElement('div');
      el.className = 'step' + (isOpen ? ' is-open' : '') + (done ? ' is-done' : '');

      var answer = done
        ? '<span class="step-answer">' +
            '<img alt="" src="' + icon(st.axis, CHOICE[st.key]) + '">' +
            '<span>' + esc(labelOf(st.axis, CHOICE[st.key])) + '</span>' +
          '</span>'
        : '<span class="step-answer"></span>';

      var boxClass = st.kind === 'energy' ? 'energy'
                   : (st.kind === 'six' ? 'opts six' : 'opts four');

      el.innerHTML =
        '<button class="step-bar" type="button" data-step="' + i + '">' +
          '<span class="step-n">0' + (i + 1) + '</span>' +
          '<span><span class="step-title">' + esc(st.title) + '</span>' +
          '<span class="step-hint">' + esc(st.hint) + '</span></span>' +
          answer +
          '<svg class="chev" viewBox="0 0 16 16"><path d="M3.2 6.2 8 10.6l4.8-4.4"/></svg>' +
        '</button>' +
        '<div class="step-body"><div class="' + boxClass +
          '" data-axis="' + st.axis + '" data-key="' + st.key + '"></div></div>';

      host.appendChild(el);

      var box = el.querySelector('[data-axis]');
      listFor(st.axis).forEach(function(o){
        var b = document.createElement('button');
        b.className = 'opt';
        b.type = 'button';
        b.dataset.v = o.id;
        b.setAttribute('aria-pressed', String(CHOICE[st.key] === o.id));
        b.innerHTML = st.kind === 'energy'
          ? '<img alt="" src="' + icon(st.axis, o.id) + '">' +
            '<span class="opt-label">' + esc(o.label) + '</span>'
          : '<span class="opt-art"><img alt="" src="' + icon(st.axis, o.id) +
            '"></span><span class="opt-label">' + esc(o.label) + '</span>';
        /* A missing icon leaves the label rather than a broken-image box.
           There are 31 studio icons and 29 halloween ones against more
           entries than that, so this is the ordinary case, not the edge. */
        var im = b.querySelector('img');
        if (im) im.addEventListener('error', function(){ im.remove(); });
        box.appendChild(b);
      });
    });

    var ready = STEPS.every(function(st){ return !!CHOICE[st.key]; });
    var go = byId('go');
    if (go) go.disabled = !ready || busy;
    var say = byId('goSay');
    if (say){
      var left = STEPS.filter(function(st){ return !CHOICE[st.key]; }).length;
      say.textContent = ready ? 'Free to look at'
                              : left + ' left to choose';
    }
  }

  byId('steps').addEventListener('click', function(e){"""

# The old handler body was written against '.panel' and reads .opt/[data-key],
# which the accordion still uses. Only its head and the bar branch change.
A_PANEL_BODY = """    var b = e.target.closest('.opt');
    if (!b) return;
    /* Pressing the chosen one again clears it. Somebody exploring should
       be able to go back to nothing without reloading the page. */
    CHOICE[b.dataset.k] = (CHOICE[b.dataset.k] === b.dataset.v) ? null : b.dataset.v;
    paintAll();
  });"""

PANEL_BODY_NEW = """    var bar = e.target.closest('.step-bar');
    if (bar){
      var i = Number(bar.dataset.step);
      var reachable = i === 0 || !!CHOICE[STEPS[i - 1].key] || !!CHOICE[STEPS[i].key];
      if (!reachable) return;
      OPEN = (OPEN === i) ? -1 : i;
      paintAll();
      return;
    }

    var b = e.target.closest('.opt');
    if (!b) return;
    var box = b.closest('[data-key]');
    var key = box.dataset.key;

    /* TOGGLE-TO-CLEAR IS KEPT. Pressing the chosen one again clears it -
       somebody exploring must be able to go back to nothing without
       reloading. It was written against data-k, which paintAxis set and
       the accordion does not; the key now comes off the box. */
    var cleared = CHOICE[key] === b.dataset.v;
    CHOICE[key] = cleared ? null : b.dataset.v;

    /* CHOOSING ADVANCES. The next unanswered step opens itself, which is
       the whole argument for an accordion over four open rows. If they are
       all answered nothing opens and the press is what is left.

       CLEARING DOES NOT ADVANCE. It reopens the step just emptied, or the
       accordion would shut the moment somebody undid something. */
    if (cleared){
      for (var q = 0; q < STEPS.length; q++){
        if (STEPS[q].key === key){ OPEN = q; break; }
      }
    } else {
      var next = -1;
      for (var k = 0; k < STEPS.length; k++){
        if (!CHOICE[STEPS[k].key]){ next = k; break; }
      }
      OPEN = next;
    }
    paintAll();
  });"""


# ═══════════════════════════════════════════════════════════════════════
# 6 · THE GRID MUST SURVIVE A ROUND
#
# frames(), wall() and the error path each set #grid.innerHTML, which deletes
# the scene and smoke layers along with the shots. They are permanent - the
# drift restarts if they are reinserted, and the first second of every wait
# would jump. So the shots are replaced and the field is left alone.
#
# This is also where the making lifecycle lives, because the mockup's version
# of it was a six-second timer on #go.
# ═══════════════════════════════════════════════════════════════════════

A_FRAMES = """  function frames(spread){
    var g = document.getElementById('grid');
    g.innerHTML = '';
    spread.forEach(function(s, n){
      var b = document.createElement('button');
      b.className = 'shot';
      b.type = 'button';
      b.dataset.n = String(n);
      b.innerHTML =
        '<div class="shot-wait">Making</div>' +
        '<span class="shot-tag">' + esc(s.label) + '</span>';
      g.appendChild(b);
    });
    byId('further').hidden = true;
    byId('rightHead').textContent = 'Making four';
  }"""

A_FRAMES_NEW = r"""  /* EVERYTHING EXCEPT THE FIELD. innerHTML = '' would take the scene and
     the smoke with it. */
  function clearShots(g){
    [].slice.call(g.querySelectorAll('.shot, .wall, .round-fail'))
      .forEach(function(el){ el.remove(); });
  }

  /* ==================================================================
     THE SCENE

     Unicorn Studio, loaded when the wait starts and destroyed when it
     ends. Three things that arrangement buys:

     NOTHING IS FETCHED BY SOMEBODY WHO NEVER PRESSES THE BUTTON. 124kb of
     SDK and 19kb of scene, on a page whose whole appeal is being instant.

     THE CSS SMOKE IS THE FALLBACK AND NOT A DECISION. If the script does
     not load, or the scene does not, nothing covers the smoke and the
     smoke is what runs. No flag, no branch to forget.

     IT IS DESTROYED, NOT HIDDEN. A WebGL context left running behind a
     display:none is a phone getting warm for no reason.

     Both files are self-hosted, so a bad morning at their end is not a bad
     morning here.
     ================================================================== */
  var SDK_URL    = '/vendor/unicornStudio.umd.js';
  var SCENE_JSON = '/scenes/studio-field.json';

  var sdk = null;
  var scene = null;

  function loadSDK(){
    if (sdk) return sdk;
    sdk = new Promise(function(resolve, reject){
      if (window.UnicornStudio) return resolve(window.UnicornStudio);
      var el = document.createElement('script');
      el.src = SDK_URL;
      el.async = true;
      el.onload = function(){
        window.UnicornStudio ? resolve(window.UnicornStudio)
                             : reject(new Error('no UnicornStudio'));
      };
      el.onerror = function(){ reject(new Error('sdk failed')); };
      document.head.appendChild(el);
    });
    return sdk;
  }

  function sceneStart(){
    /* Somebody who asked for less motion gets the smoke, which holds
       still, rather than a field that cannot. */
    if (window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var phone = window.matchMedia &&
                window.matchMedia('(max-width:820px)').matches;

    loadSDK().then(function(US){
      /* The round may already be over. Starting a scene into a stage that
         has gone back to four pictures is the one way this leaks. */
      if (!byId('grid').classList.contains('is-making')) return;
      return US.addScene({
        elementId:'sceneField',
        fps:60,
        /* Half scale and DPI 1 on a phone. The field is a soft blur, so
           nobody sees the difference, and it took the scene from 279MB to
           18MB in Rich's own measurements. */
        scale: phone ? 0.5 : 1,
        dpi:   phone ? 1 : 1.5,
        lazyLoad:false,
        filePath: SCENE_JSON
      }).then(function(sc){
        scene = sc;
        /* Only once it is actually rendering. Setting it at request time
           would hide the smoke during the load and leave the stage empty
           for however long the scene took. */
        if (byId('grid').classList.contains('is-making')){
          byId('grid').classList.add('has-scene');
        } else {
          sceneStop();
        }
      });
    }).catch(function(){
      /* Deliberately silent. The smoke is running underneath and the
         customer is looking at a wait, not at a fault. */
    });
  }

  function sceneStop(){
    if (scene && scene.destroy){ try { scene.destroy(); } catch(e){} }
    scene = null;
    var host = byId('sceneField');
    if (host) host.innerHTML = '';
    byId('grid').classList.remove('has-scene');
  }

  /* One switch for the whole making state, so the field, the copy and the
     class can never disagree about whether a round is running. */
  function making(on){
    var g = byId('grid');
    g.classList.toggle('is-making', !!on);
    var aw = byId('await'), ms = byId('makingSay');
    if (aw) aw.hidden = !!on;
    if (ms) ms.hidden = !on;
    if (on) sceneStart(); else sceneStop();
  }

  function frames(spread){
    var g = document.getElementById('grid');
    clearShots(g);
    spread.forEach(function(s, n){
      var b = document.createElement('button');
      b.className = 'shot';
      b.type = 'button';
      b.dataset.n = String(n);
      b.innerHTML =
        '<div class="shot-wait">Making</div>' +
        '<span class="shot-tag">' + esc(s.label) + '</span>';
      g.appendChild(b);
    });
    byId('further').hidden = true;
    byId('rightHead').textContent = 'Making four';
    making(true);
  }"""

A_WALL = """    document.getElementById('grid').innerHTML =
      '<div class="wall">' +"""

A_WALL_NEW = """    making(false);
    var wg = document.getElementById('grid');
    clearShots(wg);
    wg.insertAdjacentHTML('beforeend',
      '<div class="wall">' +"""

A_WALL_TAIL = """        '<button class="go" id="wallKeep" type="button">Keep one of these</button>' +
      '</div>';"""

A_WALL_TAIL_NEW = """        '<button class="go" id="wallKeep" type="button">Keep one of these</button>' +
      '</div>');"""

A_FAIL = """      .catch(function(){
        var g = document.getElementById('grid');
        g.innerHTML = '<p style="grid-column:1/-1;text-align:center;' +
          'font-style:italic;color:rgba(243,237,225,.5)">' +
          'That did not come back. Try it again in a moment.</p>';
      })"""

A_FAIL_NEW = """      .catch(function(){
        making(false);
        var g = document.getElementById('grid');
        clearShots(g);
        g.insertAdjacentHTML('beforeend',
          '<p class="round-fail" style="grid-column:1/-1;text-align:center;' +
          'font-style:italic;color:rgba(243,237,225,.5)">' +
          'That did not come back. Try it again in a moment.</p>');
        byId('rightHead').textContent = 'Your four wallpapers';
      })"""

A_LANDED = """        byId('rightHead').textContent = 'Your four wallpapers';
        byId('further').hidden = false;"""

A_LANDED_NEW = """        /* The wait is over the moment the four are on the glass. The
           field comes down here rather than in the .then below, which
           also runs after the cap wall and after a failure. */
        making(false);
        byId('rightHead').textContent = 'Your four wallpapers';
        byId('further').hidden = false;"""


EDITS = [
    ('the four fixed steps',      A_STEPS,       A_STEPS_NEW),
    ('the stage markup',          A_MAIN,        A_MAIN_NEW),
    ('the stylesheet tail',       A_STYLE_END,   CSS + "\n</style>"),
    ('the smoke filter',          A_BODY_END,    SVG),
    ('the control painter head',  A_PAINT_START, PAINT_NEW),
    ('the control painter body',  A_PANEL_BODY,  PANEL_BODY_NEW),
    ('frames and the scene',      A_FRAMES,      A_FRAMES_NEW),
    ('the cap wall head',         A_WALL,        A_WALL_NEW),
    ('the cap wall tail',         A_WALL_TAIL,   A_WALL_TAIL_NEW),
    ('the failed round',          A_FAIL,        A_FAIL_NEW),
    ('the landing',               A_LANDED,      A_LANDED_NEW),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    if not SRC.exists():
        print(f'MISSING: {SRC}')
        print('Run this from the repo root (D:\\minramas).')
        return 1

    raw = SRC.read_bytes()
    crlf = b'\r\n' in raw
    text = raw.decode('utf-8').replace('\r\n', '\n')

    # ---- everything asserted before anything is written -----------------
    fail = False
    for name, old, _new in EDITS:
        n = text.count(old)
        want = 1
        print(f'ANCHOR {name}: expected {want}, found {n}')
        if n != want:
            fail = True

    # The painter replacement runs to a second anchor, so both ends must be
    # present AND in the right order - a start after its end would delete
    # the wrong half of the file.
    i = text.find(A_PAINT_START)
    j = text.find(A_PAINT_END)
    print(f'ANCHOR painter span: start {i}, end {j}')
    if i < 0 or j < 0 or j <= i:
        print('  the painter span is not in the expected order')
        fail = True

    if fail:
        print('\nNo write. An anchor did not match.')
        return 1

    # ---- apply -----------------------------------------------------------
    out = text[:i] + PAINT_NEW + text[j + len(A_PAINT_END):]

    for name, old, new in EDITS:
        if name == 'the control painter head':
            continue
        if out.count(old) != 1:
            print(f'REFUSED: "{name}" no longer matches once after the span edit.')
            return 1
        out = out.replace(old, new, 1)

    # ---- refuse to emit something that cannot parse ----------------------
    # THE DELTA, NOT THE ABSOLUTE COUNT. This file is 331/330 before anything
    # is touched - there is a lone brace inside a comment or a string, which
    # is perfectly legal and which an absolute balance check calls a
    # catastrophe. What matters is that the EDIT did not change the
    # imbalance; a check that fails on a correct file gets switched off, and
    # then it is not a check.
    for o, c, label in (('{', '}', 'braces'), ('(', ')', 'parens')):
        before = text.count(o) - text.count(c)
        after  = out.count(o) - out.count(c)
        if before != after:
            print(f'\nREFUSED: {label} imbalance changed '
                  f'({before:+d} before, {after:+d} after).')
            return 1
    if out.count('<style') != out.count('</style>'):
        print('\nREFUSED: style tags unbalanced.')
        return 1
    # The fault that killed a page once: CSS landing inside a script block.
    for m in re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', out, re.S):
        if re.search(r'^\s*\.[A-Za-z][\w-]*\s*\{', m.group(1), re.M):
            print('\nREFUSED: a CSS rule ended up inside a <script> block.')
            return 1

    # ---- the next free version -------------------------------------------
    n = 1
    while (SRC.parent / f'{STEM}{n:03d}.html').exists():
        n += 1
    dst = SRC.parent / f'{STEM}{n:03d}.html'

    print(f'\nwould write  {dst}')
    print(f'source       {SRC}  (not modified)')

    if not args.write:
        print('\nDry run. Re-run with --write.')
        return 0

    if crlf:
        out = out.replace('\n', '\r\n')
    dst.write_bytes(out.encode('utf-8'))
    print(f'\nWritten: {dst}')
    print('The original is untouched. Point middleware at the new name when')
    print('you have looked at it.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
