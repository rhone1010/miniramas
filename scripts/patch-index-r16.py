#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-index-r16.py  -  CUI 41A  -  24 August 2026

ONE MASTER CLOCK REPLACES THREE INDEPENDENT ONES.

The previous three columns ran at different intervals and drifted apart.
No gate could fix it -- the columns simply never showed the same Series at
the same moment.

One setInterval(tick, 4000) drives all three columns simultaneously.
Every tick all three advance together. When the group ends all three jump
to the next group and the headline changes at that exact moment.

Also fixes the 404 flood: root-level Portraits plates skip tall-small/
because that folder only has subfoldered plates.

The OLD anchor is derived from the live file at runtime (between the two
sentinel comments), so this patch cannot drift if earlier patches change
the interior.

Reads <repo>\\public. Writes to Downloads. Must be installed to scripts\\.
"""

import os, sys, io

FILES = ["index.html"]

NEW_BODY = """\
  /* ---- the triptych ------------------------------------------------- */
  /* CUI 41A, 24 Aug 2026. ONE MASTER CLOCK.

     The previous three independent clocks drifted further apart with
     every tick. The gate waiting for all three to agree just made the
     headline arrive late -- the columns never showed the same Series at
     the same moment.

     Now: one setInterval drives all three columns simultaneously. Each
     tick, every column shows the next plate in the current group. When
     the group ends, all three jump to the next group together and the
     headline changes at the same instant.

     Visual variety at load: each column starts at a different offset
     within the first group (0, 1, 2), so they don't show the same plate.
     After that they move in lockstep.

     404 fix: root-level plates (Portraits) skip tall-small/ because it
     only has subfoldered plates. Subfoldered plates still try tall-small/
     first since those exist at half the weight. */

  var GROUP_META = [
    { label:'Portraits',
      say:'Photographs, <em>reimagined.</em><br>A likeness, recrafted.',
      go:'Craft a portrait', href:'/portraits' },
    { label:'Halloween',
      say:'Some faces are better <em>after dark.</em>',
      go:'Enter Halloween', href:'/halloween' },
    { label:'Groups',
      say:'Everyone, <em>in one piece.</em>',
      go:'Craft a group portrait', href:'/groups' },
    { label:'Pets',
      say:'They sat for you <em>once.</em>',
      go:'Craft a pet portrait', href:'/pets/portraits' },
    { label:'Pets Halloween',
      say:'The other season, <em>for the other half of the house.</em>',
      go:'Enter the Pet Halloween room', href:'/pets/halloween' }
  ];

  var PLATES_PER_GROUP = 3;
  var NUM_GROUPS = GROUP_META.length;

  /* One painter per column. */
  function makePainter(panel){
    var pair  = panel.querySelectorAll('.trip-layer');
    var front = pair[0], back = pair[1];
    return function paint(filename){
      /* Root-level plates: straight to tall/ (tall-small/ doesn't have them).
         Subfoldered plates: try tall-small/ first, fall back to tall/. */
      var hasFolder = filename.indexOf('/') > -1;
      var first  = S + (hasFolder ? 'tall-small/' : 'tall/') + filename;
      var second = hasFolder ? S + 'tall/' + filename : null;
      var plain  = S + filename.replace('?v=2','');
      var img = new Image();
      img.onload = function(){
        var url = img.src;
        back.classList.toggle('is-short', !/\\/tall(-small)?\\//.test(url));
        back.style.backgroundImage = 'url("' + url + '")';
        back.classList.add('show');
        front.classList.remove('show');
        var t = front; front = back; back = t;
      };
      img.onerror = function(){
        if (second && img.src === first){ img.src = second; return; }
        if (img.src !== plain){ img.src = plain; return; }
      };
      img.src = first;
    };
  }

  var panels = document.querySelectorAll('#trip .trip-panel');
  if (!panels.length) return;
  var painters = [].map.call(panels, makePainter);

  /* Headline controls. */
  var tripSayEl = document.getElementById('tripSay');
  var tripH1    = document.getElementById('tripH1');
  var tripEye   = document.getElementById('tripEye');
  var tripGo    = document.getElementById('tripGo');

  function updateCopy(g){
    var m = GROUP_META[g];
    if (!m) return;
    if (tripSayEl){
      tripSayEl.classList.add('is-fading');
      setTimeout(function(){
        if (tripH1)  tripH1.innerHTML    = m.say;
        if (tripEye) tripEye.textContent = m.label;
        if (tripGo){ tripGo.textContent  = m.go; tripGo.href = m.href; }
        tripSayEl.classList.remove('is-fading');
      }, 450);
    } else {
      if (tripH1)  tripH1.innerHTML    = m.say;
      if (tripEye) tripEye.textContent = m.label;
      if (tripGo){ tripGo.textContent  = m.go; tripGo.href = m.href; }
    }
  }

  /* Master state. */
  var group      = 0;
  var plateInGrp = 0;
  var lastGroup  = -1;

  function tick(){
    plateInGrp = (plateInGrp + 1) % PLATES_PER_GROUP;
    if (plateInGrp === 0){
      group = (group + 1) % NUM_GROUPS;
    }
    painters.forEach(function(paint, c){
      var globalIdx = group * PLATES_PER_GROUP + plateInGrp;
      paint(COLS[c][globalIdx] || COLS[c][0]);
    });
    if (group !== lastGroup){
      lastGroup = group;
      updateCopy(group);
    }
  }

  /* Initial paint: each column at a different offset within group 0. */
  painters.forEach(function(paint, c){
    paint(COLS[c][c % PLATES_PER_GROUP]);
  });
  plateInGrp = painters.length - 1;

  /* Warm the next few plates. */
  painters.forEach(function(paint, c){
    COLS[c].slice(0, 4).forEach(function(f){
      var hasFolder = f.indexOf('/') > -1;
      new Image().src = S + (hasFolder ? 'tall-small/' : 'tall/') + f;
    });
  });

  /* One clock. Four seconds per plate. */
  setInterval(tick, 4000);\
"""

SENTINEL_START = "  /* ---- the triptych"
SENTINEL_END   = "  /* ---- the proof wall"

MUST_APPEAR = [
    "function makePainter(panel){",
    "var PLATES_PER_GROUP = 3;",
    "function tick(){",
    "setInterval(tick, 4000);",
]
MUST_VANISH = [
    "setInterval(turn,",
    "window.__tripTick = function(",
]


def run(src_dir, out_dir, apply):
    ok = True
    for name in FILES:
        src = os.path.join(src_dir, name)
        print("")
        print("=" * 66)
        print(name)
        print("=" * 66)

        if not os.path.isfile(src):
            print("  REFUSED: not found -- %s" % src)
            ok = False; continue

        f = io.open(src, "r", encoding="utf-8", newline="")
        text = f.read(); f.close()
        before = len(text)

        # Find the block between the two sentinels
        s = text.find(SENTINEL_START)
        e = text.find(SENTINEL_END)
        if s < 0 or e < 0 or e <= s:
            print("  REFUSED: sentinel comments not found")
            ok = False; continue

        old_block = text[s:e].rstrip()

        # Already applied?
        if "setInterval(tick, 4000)" in old_block:
            print("  REFUSED: already applied")
            ok = False; continue

        # Sanity: old clock must be in the block
        if "setInterval(turn," not in old_block:
            print("  REFUSED: expected old clock not in block")
            ok = False; continue

        # Replace
        new_text = text[:s] + NEW_BODY + "\n\n" + text[e:]

        # Post-write assertions
        halt = False
        for s2 in MUST_APPEAR:
            if s2 not in new_text:
                print("  REFUSED: missing after edit -- %s" % s2)
                halt = True
        for s2 in MUST_VANISH:
            if s2 in new_text:
                print("  REFUSED: still present -- %s" % s2)
                halt = True
        if halt:
            ok = False; continue

        print("  ok   triptych replaced with master clock")
        print("  %d bytes -> %d  (+%d)" % (before, len(new_text), len(new_text) - before))

        if apply:
            dst = os.path.join(out_dir, name)
            g = io.open(dst, "w", encoding="utf-8", newline="")
            g.write(new_text); g.close()
            print("  WROTE %s" % dst)
        else:
            print("  DRY RUN -- nothing written")

    print("")
    if not ok:
        print("ONE OR MORE FILES REFUSED.")
        return 1
    print("All files clean.")
    return 0


if __name__ == "__main__":
    apply = "--apply" in sys.argv
    home = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    downloads = os.path.join(home, "Downloads")
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)
    out_dir = downloads
    src_dir = ""
    for a in sys.argv[1:]:
        if a.startswith("--src="): src_dir = a[6:]
        if a.startswith("--out="): out_dir = a[6:]
    if not src_dir:
        src_dir = os.path.join(repo, "public")
    if not os.path.isdir(src_dir):
        print("REFUSED: no public/ at %s -- install to scripts\\ first." % src_dir)
        sys.exit(1)
    print("\nreading  %s\nwriting  %s" % (src_dir, out_dir))
    sys.exit(run(src_dir, out_dir, apply))
