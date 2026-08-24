#!/usr/bin/env python3
# patch-groups-42a.py
#
# CUI 42A - Groups room page, 24 August 2026.
# Reads  <repo>\public\groups.html
# Writes %USERPROFILE%\Downloads\groups.html   (never touches public\)
#
#   1. #siloFloor[data-count="5"]  - five rooms, 2 over 3, centred. Rich's call.
#   2. Gender toggle stripped entirely - markup, CSS, SUBJECT, craftIdFor,
#      sitter dealing, repaintSubject, all call sites. No _woman ids exist
#      in Groups any more and nothing infers sex. CENG r02 #4.
#   3. ROUTE_ACCEPTS deleted; craftable() derives from the registry, which
#      is now generated from the same file the route reads. CENG r02 #3,
#      the better answer taken.
#   4. aspect_ratio dropped from the payload - the route ignores it and
#      groupsAspect() reads the source photograph. subject dropped with it.
#      CENG r02 #7.
#
# ALL-OR-NOTHING. Every anchor is asserted exactly-once BEFORE any edit is
# applied. One missing anchor refuses the whole run - there is no partial
# output to mistake for a finished one.

import os, sys

def die(msg):
    print('\n[42A] REFUSED: ' + msg + '\n')
    sys.exit(1)

HERE = os.path.dirname(os.path.abspath(__file__))
# self-locating: the script may sit in the repo root or in scripts\
repo = HERE
while repo and not os.path.isdir(os.path.join(repo, 'public')):
    parent = os.path.dirname(repo)
    if parent == repo: break
    repo = parent
SRC = os.path.join(repo, 'public', 'groups.html')
OUT = os.path.join(os.path.expanduser('~'), 'Downloads', 'groups.html')

if not os.path.isfile(SRC): die('source not found at ' + SRC)

with open(SRC, 'rb') as f:
    raw = f.read()
text = raw.decode('utf-8')
CRLF = '\r\n' in text

MARK = 'CUI 42A \u00b7 2026-08-24'
if MARK in text: die('this patch is already applied - the marker is in the file')

def nl(s):
    return s.replace('\n', '\r\n') if CRLF else s

# ---- THE EDITS --------------------------------------------------------------
# (name, old, new). old must appear exactly once. new may be ''.
EDITS = []

# 1 -- CSS: five rooms lay 2 over 3, centred -----------------------------------
EDITS.append(('css-five-rooms',
'''#siloFloor[data-count="4"] > *{
  /* auto, not `auto / span 2` -- the columns are now the card width
     rather than eighths of the floor, so a span of two would take both. */
  grid-column:auto;
  justify-self:stretch;
  width:var(--silo-w);
}''',
'''#siloFloor[data-count="4"] > *{
  /* auto, not `auto / span 2` -- the columns are now the card width
     rather than eighths of the floor, so a span of two would take both. */
  grid-column:auto;
  justify-self:stretch;
  width:var(--silo-w);
}

/* ---- FIVE SILOS LAY 2 OVER 3, CENTRED --------------------------------
   CUI 42A \u00b7 2026-08-24. Rich's ruling. "Another Time" is gone and two
   rooms arrived, so the floor deals five. Same card width as the 2x2;
   six half-columns so the top pair can sit centred over the bottom row
   of three. The id outranks the generic .floor[data-count="5"] partial-
   row rule, which stays correct for the effects floor. */
#siloFloor[data-count="5"]{
  grid-template-columns:repeat(6, calc(var(--silo-w) / 2));
  grid-template-rows:repeat(2, auto);
  justify-content:center;
  align-content:center;
}
#siloFloor[data-count="5"] > *{
  grid-column:auto / span 2;
  justify-self:stretch;
  width:var(--silo-w);
}
#siloFloor[data-count="5"] > :nth-child(1){ grid-column:2 / span 2 }
#siloFloor[data-count="5"] > :nth-child(3){ grid-column:1 / span 2; grid-row:2 }'''))

# 2a -- CSS: the toggle's main block -------------------------------------------
EDITS.append(('css-agetog-main',
'''.agetog{
  position:absolute; left:50%; top:0; transform:translateX(-50%);
  display:inline-flex; gap:4px;
  height:40px; padding:4px;
  border-radius:4px;
  background:linear-gradient(180deg, rgba(47,36,32,.55) 0%, rgba(36,27,23,.55) 100%);
  border:1px solid rgba(196,169,110,.16);
}
.agetog[hidden]{ display:none }
.agetog-b{
  display:inline-flex; align-items:center;
  height:100%; padding:0 20px;
  border:0; border-radius:3px; background:transparent;
  font-family:var(--serif); font-size:1.3125rem; line-height:1;
  color:var(--vellum-200); opacity:.62;
  cursor:pointer;
  transition:background .38s var(--ease-nav), color .38s var(--ease-nav),
             opacity .38s var(--ease-nav);
}
.agetog-b:hover{ opacity:.85 }
.agetog-b:focus-visible{ outline:2px solid var(--gold); outline-offset:2px }
.agetog-b.is-on{
  opacity:1; color:#fff;
  background:linear-gradient(180deg,#3a2c26 0%, #2c211c 100%);
  border:1px solid rgba(196,169,110,.26);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
}
''',
'''/* The Men/Women toggle lived here. Removed CUI 42A \u00b7 2026-08-24 -
   every costume effect is gone from Groups and material effects
   re-materialise the clothes each person already wears, so there is
   no sex to infer and nothing for a toggle to say. */
'''))

# 2b -- CSS: the toggle inside the phone media block ---------------------------
EDITS.append(('css-agetog-phone',
'''  .agetog{
    position:static; transform:none;
    order:3; width:100%; height:42px;
  }
  .agetog-b{ flex:1; justify-content:center; padding:0 }
''',
''))

# 2c -- CSS: the stray order rule ----------------------------------------------
EDITS.append(('css-agetog-order',
'''  .agetog{ order:3 }
''',
''))

# 2d -- HTML: the toggle itself ------------------------------------------------
EDITS.append(('html-agetog',
'''      <div class="agetog" id="ageTog" role="group" aria-label="Another Age" hidden>
        <button class="agetog-b is-on" id="ageM" type="button" data-age="m">Men</button>
        <button class="agetog-b" id="ageW" type="button" data-age="w">Women</button>
      </div>
''',
''))

# 3 -- payload: aspect_ratio and subject leave the wire ------------------------
EDITS.append(('payload-aspect-subject',
'''      scale:                 'auto_85',
      aspect_ratio:          '1:1',
      resolution:            '1k',
      pose:                  window.__POSE || 'as_photographed',
      /* Whatever the card showed. The engine detects this itself when it
         is absent, but then the Men/Women toggle would be a lie \u2014 a
         customer who flipped to Women would be shown women and sent a
         man. An explicit choice always beats detection. */
      subject:               SUBJECT || null,
''',
'''      scale:                 'auto_85',
      /* aspect_ratio is GONE from the wire \u00b7 CUI 42A. The route never
         read it, and groupsAspect() in groups-generator.ts now measures
         the source photograph and snaps to 1:1, 5:4 or 4:3. Sending
         '1:1' was a lie in the payload waiting for a reader to believe
         it. subject went with it \u2014 nothing in Groups infers sex. */
      resolution:            '1k',
      pose:                  window.__POSE || 'as_photographed',
'''))

# 4 -- ROUTE_ACCEPTS: the list goes, the registry answers ----------------------
EDITS.append(('route-accepts',
'''  /* ==================================================================
     WHAT THE ROUTE WILL ACTUALLY ACCEPT
     ==================================================================
     Read out of lib/v1/portraits/portraits-shared.ts by the build script
     that produced this file, on the day it produced it. Not hand-kept.

     The registry decides what EXISTS and whether it is finished. The route
     decides what it will CRAFT, at line 227 of the generate route, and it
     400s on anything absent from PRESET_LABELS \u2014 before the engine, in
     fifteen milliseconds, after the credits have gone.

     11 live effects were refused when this was built. Offering them is
     charging for a certain failure, so the floor does not.

     THIS IS A GUARD, NOT A DECISION. The answer is the eleven ids reaching
     PRESET_LABELS, PRESET_TIER and STYLE_MATERIALS. When they do, the next
     build reads them and this list grows on its own. */
  var ROUTE_ACCEPTS = ['bronze', 'ebony', 'stone', 'reclaimed_bronze', 
    'porcelain', 'carved_family', 'retro_robot', 'plushy', 'folded_book', 
    'origami', 'balloon_face', 'layered_paper', 'pencil_sketch', 
    'sea_glass', 'cubism', 'art_nouveau', 'ukiyo_e', 
    'family_impressionism', 'family_mosaic', 'neon', 'ice', 'victorian', 
    'elizabethan', 'renaissance', 'persian_court', 'samurai', 'wild_west', 
    'clockwork'];
  function craftable(e){ return e && e.body === 'live' && ROUTE_ACCEPTS.indexOf(e.id) >= 0; }''',
'''  /* ==================================================================
     WHAT THE ROUTE WILL ACTUALLY ACCEPT \u00b7 CUI 42A \u00b7 2026-08-24
     ==================================================================
     The hardcoded ROUTE_ACCEPTS list that stood here drifted for a month
     under a "not hand-kept" banner \u2014 it still offered six costume effects
     removed on 23 August and knew nothing of the thirteen that replaced
     them. It does not get a second chance.

     The registry is now generated by scripts/emit-groups-registry.js from
     lib/v1/groups/groups-effects.ts \u2014 the same catalogue the generate
     route reads \u2014 and the emitter refuses to write an id the catalogue
     does not hold. What the registry offers, the route accepts, by
     construction rather than by a list kept in step by hand. */
  function craftable(e){ return !!(e && e.body === 'live'); }'''))

# 5 -- effectCard keys on the effect id, not a variant lookup ------------------
EDITS.append(('effectcard-id',
"    a.dataset.effectId = craftIdFor(effect.id);",
"    a.dataset.effectId = effect.id;   /* no variants in Groups \u00b7 CUI 42A */"))

# 6 -- the upsell queues the id itself -----------------------------------------
EDITS.append(('upsell-id',
'''      left.slice(0, addN).forEach(function(e2){
        addToQueue(silo, craftIdFor(e2.id));
      });''',
'''      left.slice(0, addN).forEach(function(e2){
        addToQueue(silo, e2.id);
      });'''))

# 7 -- the SUBJECT block: state, subjectFromPhoto, craftIdFor ------------------
EDITS.append(('subject-block',
'''  /* ---- the subject ------------------------------------------------------
     One tile, two faces. The _woman ids are variants sitting behind their
     base tile, not tiles of their own \u2014 s97 had them as a second set and
     flipping the toggle swapped the floor, which is not the ruling. The
     tiles hold still; the faces change.

     The photograph decides first. `subject` is CENG's field and is read
     ahead of everything; detected_gender already ships and carries it
     until then. Neither, and the ungendered plate serves. */
  var AGE_SILO = 'another_age';   /* kept: the room the toggle was born in */
  var SUBJECT  = null;            /* 'man' | 'woman' | null */
  var SUBJECT_FORCED = false;     /* the customer has overridden the photograph */
  var ageTog   = document.getElementById('ageTog');
  var PV       = window.EFFECT_PREVIEWS || { base:'/previews/effects/', files:{} };

  function isVariantId(id){
    return R.isVariant ? R.isVariant(id) : /_woman$/.test(id);
  }

  /* What the photograph says, before any override. */
  /* `subject` arrives at the TOP LEVEL of the analyze response, beside
     `result` rather than inside it, and it is the string the filenames
     already use. It comes from a dedicated vision call \u2014 the old
     result.detected_gender was null on every photograph.

     All three shapes are read, newest first, so a response in the old
     form still works and neither side has to land before the other. */
  function subjectFromPhoto(){
    var top = (SRC && SRC.subject) || null;
    if (top === 'man' || top === 'woman') return top;
    var g = (SRC && SRC.gender) || null;
    if (g === 'm') return 'man';
    if (g === 'f') return 'woman';
    var a = (SRC && SRC.analyze) || {};
    if (a.subject === 'man' || a.subject === 'woman') return a.subject;
    if (a.detected_gender === 'm') return 'man';
    if (a.detected_gender === 'f') return 'woman';
    return null;
  }

  /* The craft id, not just the picture. A woman choosing Victorian queues
     victorian_woman \u2014 but only where that id exists and the route will
     take it, so a room without variants is untouched. */
  function craftIdFor(tileId){
    if (SUBJECT !== 'woman') return tileId;
    if (R.variantFor){
      var v = R.variantFor(tileId, 'woman');
      if (v && v !== tileId && craftableId(v)) return v;
      if (v && v !== tileId) return tileId;
    }
    var guess = tileId + '_woman';
    return craftableId(guess) ? guess : tileId;
  }
  function craftableId(id){
    var e = R.byId ? R.byId(id) : null;
    return !!(e && craftable(e));
  }''',
'''  /* ---- the subject \u00b7 REMOVED \u00b7 CUI 42A \u00b7 2026-08-24 --------------------
     SUBJECT, subjectFromPhoto, craftIdFor and the sitter dealing all
     existed because six costume effects had to guess everybody's sex.
     All six were removed from the catalogue on 23 August; no _woman id
     exists anywhere in Groups and material effects re-materialise the
     clothes each person is already wearing. The registry keeps
     isVariant() and variantFor() as identity functions so this floor
     code never has to test for a toggle that cannot exist here. */
  var PV       = window.EFFECT_PREVIEWS || { base:'/previews/effects/', files:{} };

  function isVariantId(id){
    return R.isVariant ? R.isVariant(id) : /_woman$/.test(id);
  }'''))

# 8 -- the sitter dealing, dead once SUBJECT is gone ---------------------------
EDITS.append(('sitter-block',
'''  /* BEFORE A PHOTOGRAPH ARRIVES, THE FLOOR IS MIXED. Ruled 2026-08-09.
     SUBJECT is null until we have seen a face, and the old fallback took
     f[0] every time \u2014 which is the man's plate on all eight cards. A wall
     of men is a wall that tells half the people who land here that this
     was not made for them.

     Four and four, shuffled once per load. Per load, not per call: the
     same card must not change sitter between two paints of the same
     screen. Once SUBJECT is known this never runs again \u2014 the customer's
     own sitter wins over everything here. */
  /* NAMED SITTER, NOT COIN. Ruled 2026-08-10 after the floor came back
     eight men on a page that deals four and four. The Account panel
     three thousand lines below declares its own COIN and its own picker
     under the same two names, in this same scope; declarations hoist,
     the later one wins, and every call from here was reaching the
     credit-icon picker and getting a PNG path back. A PNG path is not
     'woman', so every card fell to the man's plate.

     Nothing here is namespaced by accident any more. If a name in this
     scope is not obviously about sitters, it is not ours. */
  var SITTER = {};
  var SITTER_DEALT = {};

  /* An exact half-and-half over one list, shuffled. Fisher-Yates rather
     than a coin per card, because a real coin gives you eight men about
     once in every two hundred and fifty loads and that load is somebody's
     first impression. Keys are namespaced by tree: a silo and an effect
     could one day share an id, and finding that out through a picture of
     the wrong person is not how it should be found out. */
  function dealSitters(ns, list){
    var l = (list || []).slice().sort();
    if (!l.length) return;
    var half = Math.ceil(l.length / 2);
    var want = [];
    for (var i = 0; i < l.length; i++) want.push(i < half ? 'man' : 'woman');
    for (var j = want.length - 1; j > 0; j--){
      var k = Math.floor(Math.random() * (j + 1));
      var t = want[j]; want[j] = want[k]; want[k] = t;
    }
    /* Never re-deal a card that already has a sitter. The same card must
       not change person between two paints of the same screen. */
    for (var m = 0; m < l.length; m++){
      var key = ns + ':' + l[m];
      if (!SITTER[key]) SITTER[key] = want[m];
    }
  }

  /* THE EFFECTS ARE DEALT ROOM BY ROOM. One shuffle across all sixty-three
     balances the catalogue and still deals a room of eight men often
     enough to matter, and a room is the thing a customer stands in. Each
     room gets its own exact half. */
  function dealEffectSitters(tree){
    var seen = {};
    var silos = (R && R.silos) ? R.silos : [];
    for (var i = 0; i < silos.length; i++){
      var list = [];
      var rows = R.offerableTilesBySilo ? R.offerableTilesBySilo(silos[i].id)
               : R.offerableBySilo     ? R.offerableBySilo(silos[i].id)
               : [];
      for (var j = 0; j < rows.length; j++){
        if (!tree[rows[j].id]) continue;      /* no plate, nothing to deal */
        list.push(rows[j].id);
        seen[rows[j].id] = 1;
      }
      dealSitters('files', list);
    }
    /* Anything the registry did not put in a room still needs a sitter,
       or it silently reverts to the man. */
    var rest = [];
    var all = Object.keys(tree);
    for (var k = 0; k < all.length; k++) if (!seen[all[k]]) rest.push(all[k]);
    dealSitters('files', rest);
  }

  function sitterFor(tree, id){
    var ns = tree === PV.silos ? 'silos' : tree === PV.poses ? 'poses' : 'files';
    var key = ns + ':' + id;
    if (SITTER[key]) return SITTER[key];
    if (!SITTER_DEALT[ns]){
      SITTER_DEALT[ns] = true;
      if (ns === 'files') dealEffectSitters(tree);
      else dealSitters(ns, Object.keys(tree));
    }
    return SITTER[key] || 'man';
  }

  function plateFrom(tree, base, id, sub){
    var f = tree && tree[id];
    if (!f) return '';
    var who = SUBJECT;
    /* Was: silos only. The rooms were four and four and every room you
       opened was eight men, because the effect and pose trees fell
       through to f[0]. All three trees now, and the customer's own sitter
       still wins over all of it the moment a face is seen. */
    if (!who) who = sitterFor(tree, id);
    var want = who === 'woman' ? f[1] : who === 'man' ? f[0] : '';
    var file = want || f[0] || f[2] || f[1] || '';
    return file ? base + (sub ? id + '/' : '') + file : '';
  }''',
'''  /* The sitter dealing that stood here \u2014 SITTER, dealSitters,
     dealEffectSitters, sitterFor \u2014 left with the subject \u00b7 CUI 42A.
     Groups plates are ungendered and derive from the id. */
  function plateFrom(tree, base, id, sub){
    var f = tree && tree[id];
    if (!f) return '';
    var file = f[0] || f[2] || f[1] || '';
    return file ? base + (sub ? id + '/' : '') + file : '';
  }'''))

# 9 -- roomHasBoth, only ever asked for the toggle -----------------------------
EDITS.append(('roomhasboth',
'''  /* A room earns the toggle by holding a tile with both plates. */
  function roomHasBoth(list){
    for (var i = 0; i < list.length; i++){
      var f = PV.files && PV.files[list[i].id];
      if (f && f[0] && f[1]) return true;
    }
    return false;
  }

''',
''))

# 10 -- paintAgeTog, repaintSubject and the click handler ----------------------
EDITS.append(('repaint-subject',
'''  function paintAgeTog(){
    if (!ageTog) return;
    var want = SUBJECT === 'woman' ? 'w' : 'm';
    var on = ageTog.querySelectorAll('.agetog-b');
    for (var i = 0; i < on.length; i++){
      on[i].classList.toggle('is-on', on[i].dataset.age === want);
      on[i].setAttribute('aria-pressed', on[i].dataset.age === want ? 'true' : 'false');
    }
  }

  /* Same tiles, different faces. Rebuilding the floor here would lose the
     card turn's place and re-order nothing, so each card is edited where
     it stands. */
  function repaintSubject(){
    /* The effect floor \u2014 the cards in front of the customer. */
    var cards = effFloor.querySelectorAll('.silo-card[data-tile-id]');
    for (var i = 0; i < cards.length; i++){
      var c = cards[i];
      var tile = c.dataset.tileId;
      var img = c.querySelector('.silo-card__image');
      var next = previewFor(tile);
      if (img && next) img.src = next;
      c.dataset.effectId = craftIdFor(tile);
      c.classList.toggle('is-selected', inQueue(c.dataset.siloId, c.dataset.effectId));
    }

    /* The silo floor \u2014 the rooms behind them. renderSilos runs once at
       boot, before a photograph exists and so before the subject is
       known, and every card resolved to the man's plate and stayed
       there. A woman chose between eight men.

       Edited in place: the floor carries the card-turn's state and a
       rebuild mid-turn would drop the animation. */
    if (siloFloor){
      var rooms = siloFloor.querySelectorAll('.silo-card[data-silo-id]');
      for (var j = 0; j < rooms.length; j++){
        var rimg = rooms[j].querySelector('.silo-card__image');
        var rnext = siloArt(rooms[j].dataset.siloId);
        if (rimg && rnext) rimg.src = rnext;
      }
    }

    /* The pose floor, when it has been drawn. */
    if (poseFloor){
      var poses = poseFloor.querySelectorAll('.silo-card[data-pose]');
      for (var k = 0; k < poses.length; k++){
        var pimg = poses[k].querySelector('.silo-card__image');
        var pnext = poseArt(poses[k].dataset.pose);
        if (pimg && pnext) pimg.src = pnext;
      }
    }

    /* And the rail. A queued finish shows its room's plate, and that
       plate has a gender now. */
    if (typeof renderQueue === 'function') renderQueue();
  }

  /* The photograph sets the subject; this is the customer disagreeing,
     which they are entitled to do and which sticks for the session. */
  if (ageTog) ageTog.addEventListener('click', function(ev){
    var b = ev.target.closest('.agetog-b'); if (!b) return;
    var want = b.dataset.age === 'w' ? 'woman' : 'man';
    if (want === SUBJECT) return;
    SUBJECT = want;
    SUBJECT_FORCED = true;
    paintAgeTog();
    repaintSubject();
  });

  function openSilo(card){
    var siloId = card.dataset.siloId;
    var silo   = siloById(siloId);
    /* A fresh photograph re-decides the subject every time a room opens,
       unless the customer has already said otherwise. */
    if (!SUBJECT_FORCED) SUBJECT = subjectFromPhoto();
    var list   = siloList(siloId);''',
'''  /* paintAgeTog, repaintSubject and the toggle's click handler stood
     here. Removed with the subject \u00b7 CUI 42A \u00b7 2026-08-24. */

  function openSilo(card){
    var siloId = card.dataset.siloId;
    var silo   = siloById(siloId);
    var list   = siloList(siloId);'''))

# 11 -- openSilo's toggle line -------------------------------------------------
EDITS.append(('opensilo-agetog',
'''      paintEffects(siloId, list);
      if (ageTog){ ageTog.hidden = !roomHasBoth(list); paintAgeTog(); }
      crumbHere.textContent = silo ? silo.label : siloId;''',
'''      paintEffects(siloId, list);
      crumbHere.textContent = silo ? silo.label : siloId;'''))

# 12 -- backToSilos ------------------------------------------------------------
EDITS.append(('backtosilos-agetog',
'''  function backToSilos(){
    if (ageTog) ageTog.hidden = true;
    turn(effFloor, siloFloor, function(){''',
'''  function backToSilos(){
    turn(effFloor, siloFloor, function(){'''))

# 13 -- showSeven --------------------------------------------------------------
EDITS.append(('showseven-agetog',
'''      crumbHere.textContent = 'Chosen for You';
      if (ageTog){ ageTog.hidden = !roomHasBoth(picks.map(function(p){ return p.effect; }));
                   paintAgeTog(); }
      workshop.classList.remove('workshop-view--silos');''',
'''      crumbHere.textContent = 'Chosen for You';
      workshop.classList.remove('workshop-view--silos');'''))

# ---- VALIDATE, THEN APPLY ----------------------------------------------------
errs = []
for name, old, new in EDITS:
    o = nl(old)
    n = text.count(o)
    if n == 0:   errs.append(name + ': anchor NOT FOUND')
    elif n > 1:  errs.append(name + ': anchor found ' + str(n) + ' times, must be exactly 1')
if errs:
    die('anchors failed, NOTHING written:\n  - ' + '\n  - '.join(errs))

for name, old, new in EDITS:
    text = text.replace(nl(old), nl(new), 1)

# marker, so a second run refuses
text = text.replace(nl('<!DOCTYPE html>'),
                    nl('<!DOCTYPE html>\n<!-- ' + MARK + ' -->'), 1)

# ---- POST-VERIFY -------------------------------------------------------------
post = []
# Definition and call forms only - the tombstone comments are allowed to
# name what they buried.
for bad in ['var ROUTE_ACCEPTS', 'function craftIdFor', 'craftIdFor(',
            'function subjectFromPhoto', 'subjectFromPhoto(',
            'function paintAgeTog', 'paintAgeTog(',
            'function repaintSubject', 'repaintSubject(',
            'function roomHasBoth', 'roomHasBoth(',
            'function sitterFor', '= sitterFor(',
            'function dealSitters', 'dealSitters(',
            'SUBJECT_FORCED', 'agetog-b', 'id="ageTog"',
            "aspect_ratio:          '1:1'"]:
    if bad in text: post.append(bad + ' still present after patch')
for want in ['#siloFloor[data-count="5"]', MARK]:
    if want not in text: post.append(want + ' missing after patch')
if post:
    die('post-verify failed, NOTHING written:\n  - ' + '\n  - '.join(post))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n[42A] wrote ' + OUT)
print('  edits applied : ' + str(len(EDITS)))
print('  bytes         : ' + str(os.path.getsize(OUT)))
print('  source bytes  : ' + str(len(raw)))
print('\n  install with Install-File.ps1, dry-run first.\n')
