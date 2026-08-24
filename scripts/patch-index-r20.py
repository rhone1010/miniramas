#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-index-r20.py  -  CUI 41A  -  24 August 2026

Five rulings from Rich, one pass:

  A  man_renaissance -> man_neon in the desktop columns.
  B  Cache-bust (?v=2) the five re-outpainted plates: three halloween,
     two pets. tall-small has NOT been recompressed for them, so a query
     string also tells both painters to skip tall-small and go straight
     to tall/ -- otherwise the CDN would keep serving the stale small.
  C  plague_beast -> posessed_beast, desktop and mobile.
  D  The 5px shift on mobile: the auto-advance was calling go() with a
     direction, which plays the swipe-acknowledgement nudge. Automatic
     turns now pass 0 -- the nudge is an answer to a thumb, and there
     was no thumb.
  E  The dots sat mid-headline. They move into the copy block, above the
     h1, in normal flow -- anchored to the text, not to a bottom offset
     that guesses how many lines the text runs.
"""
import os, sys, io

FILES = ["index.html"]

EDITS = [

("A . man_renaissance -> man_neon (desktop col 0)",
 "    ['man_renaissance.jpg',                     'woman_watercolor.jpg',              'woman_forest_guardian.jpg'],",
 "    ['man_neon.jpg',                            'woman_watercolor.jpg',              'woman_forest_guardian.jpg'],"),

("B1. cache-bust the halloween row (desktop)",
 "    ['halloween/man_haunted_scarecrow.jpg',     'halloween/woman_swamp_creature.jpg','halloween/man_clockwork_corpse.jpg'],",
 "    ['halloween/man_haunted_scarecrow.jpg?v=2', 'halloween/woman_swamp_creature.jpg?v=2','halloween/man_clockwork_corpse.jpg?v=2'],"),

("B2. cache-bust the pets pair (desktop)",
 "    ['pets/pets_quilted.jpg',                   'pets/pets_impressionist.jpg',       'pets/pets_clockwork.jpg'],",
 "    ['pets/pets_quilted.jpg?v=2',               'pets/pets_impressionist.jpg',       'pets/pets_clockwork.jpg?v=2'],"),

("B3. pets_clockwork in the Pets row too (desktop)",
 "    ['pets/pets_victorian.jpg?v=2',             'pets/pets_impressionist.jpg',       'pets/pets_clockwork.jpg'],",
 "    ['pets/pets_victorian.jpg?v=2',             'pets/pets_impressionist.jpg',       'pets/pets_clockwork.jpg?v=2'],"),

("B4. cache-bust the mobile halloween plates",
 "        ['man_haunted_scarecrow.jpg','Or something that waits after dark'],",
 "        ['man_haunted_scarecrow.jpg?v=2','Or something that waits after dark'],"),

("B5. mobile swamp creature",
 "        ['woman_swamp_creature.jpg', 'We have a room for October'],",
 "        ['woman_swamp_creature.jpg?v=2', 'We have a room for October'],"),

("B6. mobile clockwork corpse",
 "        ['man_clockwork_corpse.jpg', 'Twenty-eight ways to be unrecognisable'] /* DRAFT */",
 "        ['man_clockwork_corpse.jpg?v=2', 'Twenty-eight ways to be unrecognisable'] /* DRAFT */"),

("B7. mobile pets_quilted",
 "        ['pets_quilted.jpg',       'Thirty-four finishes, for the ones who will not hold still'], /* DRAFT */",
 "        ['pets_quilted.jpg?v=2',   'Thirty-four finishes, for the ones who will not hold still'], /* DRAFT */"),

("B8. mobile pets_clockwork",
 "        ['pets_clockwork.jpg',     'Nobody has ever asked us for a small one']  /* DRAFT */",
 "        ['pets_clockwork.jpg?v=2', 'Nobody has ever asked us for a small one']  /* DRAFT */"),

("B9. mobile builder: a query string skips stale tall-small",
 """    var PANELS = REEL_SERIES.map(function(s){
      return {
        id:s.id, label:s.label, href:s.href, go:s.go,
        frames:s.plates.map(function(p){
          return {
            big:   S + 'tall-small/' + s.dir + p[0],
            mid:   S + 'tall/'       + s.dir + p[0],
            small: S + s.dir + p[0],
            say:   p[1]
          };
        })
      };""",
 """    var PANELS = REEL_SERIES.map(function(s){
      return {
        id:s.id, label:s.label, href:s.href, go:s.go,
        frames:s.plates.map(function(p){
          /* A ?v= query marks a re-outpainted plate whose tall-small has
             not been recompressed yet -- skip straight to tall/ for it.
             CUI 41A, 24 Aug 2026. */
          var fresh = p[0].indexOf('?') > -1;
          return {
            big:   S + (fresh ? 'tall/' : 'tall-small/') + s.dir + p[0],
            mid:   S + 'tall/'       + s.dir + p[0],
            small: S + s.dir + p[0].replace('?v=2',''),
            say:   p[1]
          };
        })
      };"""),

("B10. desktop painter: same rule",
 """      var hasFolder = filename.indexOf('/') > -1;
      var first  = S + (hasFolder ? 'tall-small/' : 'tall/') + filename;
      var second = hasFolder ? S + 'tall/' + filename : null;
      var plain  = S + filename.replace('?v=2','');""",
 """      var hasFolder = filename.indexOf('/') > -1;
      /* A ?v= query marks a re-outpainted plate whose tall-small is
         stale -- go straight to tall/. CUI 41A, 24 Aug 2026. */
      var fresh  = filename.indexOf('?') > -1;
      var first  = S + ((hasFolder && !fresh) ? 'tall-small/' : 'tall/') + filename;
      var second = (hasFolder && !fresh) ? S + 'tall/' + filename : null;
      var plain  = S + filename.replace('?v=2','');"""),

("C1. plague -> posessed (mobile)",
 "        ['plague_beast.jpg',       'Twenty-seven of them, and they all bite']   /* DRAFT */",
 "        ['posessed_beast.jpg',     'Twenty-seven of them, and they all bite']   /* DRAFT */"),

("C2. plague -> posessed (desktop)",
 "    ['pets-halloween/harvest_god_beast.jpg',    'pets-halloween/plague_beast.jpg',   'pets-halloween/hellborn_beast.jpg'],",
 "    ['pets-halloween/harvest_god_beast.jpg',    'pets-halloween/posessed_beast.jpg', 'pets-halloween/hellborn_beast.jpg'],"),

("D . the automatic turn does not nudge",
 """        if (i === frames.length - 1 && Date.now() > held){
          go(panel + 1, 1);
          return;
        }""",
 """        if (i === frames.length - 1 && Date.now() > held){
          /* 0: an automatic turn. The nudge is an answer to a thumb,
             and there was no thumb. CUI 41A, 24 Aug 2026. */
          go(panel + 1, 0);
          return;
        }"""),

("E1. dots move into the copy block, above the h1",
 """    <div class="m-say">
      <h1 id="mSay">Imagine yourself in the Renaissance.</h1>""",
 """    <div class="m-say">
      <!-- CUI 41A, 24 Aug 2026. Above the text, in its flow -- a bottom
           offset was a guess at how many lines the headline runs, and it
           guessed wrong. -->
      <div class="m-dots" id="mDots"></div>
      <h1 id="mSay">Imagine yourself in the Renaissance.</h1>"""),

("E2. the old dots markup goes",
 """    <!-- Which of five, and how far along. Tappable, because a dot that
         shows position and refuses to take you there is a tease. -->
    <div class="m-dots" id="mDots"></div>""",
 """    <!-- The dots live inside .m-say now, above the headline. -->"""),

("E3. dots CSS: normal flow, not absolute",
 """  .m-dots{
    position:absolute; left:0; right:0; z-index:4;
    bottom:calc(66px + env(safe-area-inset-bottom) + 143px);
    display:flex; justify-content:center; gap:10px;
    pointer-events:none;
  }""",
 """  .m-dots{
    display:flex; justify-content:center; gap:10px;
    margin-bottom:16px; pointer-events:none;
  }"""),
]

MUST_APPEAR = [
    "man_neon.jpg',                            'woman_watercolor.jpg'",
    "posessed_beast.jpg",
    "man_haunted_scarecrow.jpg?v=2",
    "pets_quilted.jpg?v=2",
    "var fresh = p[0].indexOf('?') > -1;",
    "(hasFolder && !fresh)",
    "go(panel + 1, 0);",
    '<div class="m-dots" id="mDots"></div>\n      <h1 id="mSay">',
]
MUST_VANISH = [
    "plague_beast.jpg',",
    "position:absolute; left:0; right:0; z-index:4;\n    bottom:calc(66px",
]


def normalise(s): return s.replace("\r\n", "\n").replace("\r", "\n")

def run(src_dir, out_dir, apply):
    ok = True
    for name in FILES:
        src = os.path.join(src_dir, name)
        print("\n" + "="*66 + "\n" + name + "\n" + "="*66)
        if not os.path.isfile(src): print("  REFUSED: not found"); ok=False; continue
        text = normalise(io.open(src,"rb").read().decode("utf-8"))
        before = len(text)
        halt = False
        for label, old, new in EDITS:
            n = text.count(old)
            if n != 1:
                if new in text: print("  REFUSED: already applied -- %s" % label)
                else: print("  REFUSED: anchor %d times -- %s" % (n, label))
                halt = True
        if halt: ok=False; continue
        for label, old, new in EDITS:
            text = text.replace(old, new, 1)
            print("  ok   %s" % label)
        for s in MUST_APPEAR:
            if s not in text: print("  REFUSED: missing -- %s" % s); halt=True
        for s in MUST_VANISH:
            if s in text: print("  REFUSED: still present -- %s" % s); halt=True
        if halt: ok=False; continue
        print("  %d -> %d (+%d)" % (before, len(text), len(text)-before))
        if apply:
            io.open(os.path.join(out_dir,name),"w",encoding="utf-8",newline="\n").write(text)
            print("  WROTE %s" % os.path.join(out_dir,name))
        else: print("  DRY RUN -- nothing written")
    print("\n" + ("All files clean." if ok else "ONE OR MORE FILES REFUSED."))
    return 0 if ok else 1

if __name__ == "__main__":
    apply = "--apply" in sys.argv
    home = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)
    out_dir = os.path.join(home,"Downloads"); src_dir = ""
    for a in sys.argv[1:]:
        if a.startswith("--src="): src_dir=a[6:]
        if a.startswith("--out="): out_dir=a[6:]
    if not src_dir: src_dir = os.path.join(repo,"public")
    if not os.path.isdir(src_dir): print("REFUSED: install to scripts\\ first."); sys.exit(1)
    print("\nreading  %s\nwriting  %s" % (src_dir, out_dir))
    sys.exit(run(src_dir, out_dir, apply))
