#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-welcome42-mobile-r1.py  -  CUI 41A  -  27 August 2026

CUI 42'S WELCOME, TAUGHT TO FIT A PHONE. (Rich's mobile screenshots;
cross-lane by Rich's ruling - 42 gets the note after it ships.)

The card had no max-height and no overflow: a 300px portrait plus
full desktop type stood taller than a phone, flex centred it, both
ends sheared off, and the button lived below the fold. Tap-anywhere
dismissal already existed - invisible while the layout overflowed.

  A  The card caps at 88dvh and scrolls; anchors position:relative
     for the new close.
  B  A visible X. Tap-anywhere stays; the X makes it discoverable.
  C  Phone scale under 640px: 140px portrait, tightened type/padding.

Once-per-day stays exactly as 42 built it - Rich's ruling.
"""
import os, sys, io

FILES = [os.path.join("public", "welcome.js")]

EDITS = [

("A . the card fits and scrolls",
 "    '.lw-card{max-width:680px;width:100%;padding:44px 48px 40px;' +",
 "    '.lw-card{max-width:680px;width:100%;padding:44px 48px 40px;' +\n"
 "      /* fit the screen, scroll the rest - the phone shear, 27 Aug */\n"
 "      'position:relative;max-height:88dvh;overflow:auto;' +"),

("B1. the X's clothes + C. the phone scale",
 "    '.lw-in:hover{background:#7d4242;color:#f3ede1}';",
 "    '.lw-in:hover{background:#7d4242;color:#f3ede1}' +\n"
 "    '.lw-x{position:absolute;top:8px;right:12px;font-size:26px;' +\n"
 "      'line-height:1;padding:6px 10px;background:none;border:none;' +\n"
 "      'color:#7d4242;cursor:pointer}' +\n"
 "    '@media(max-width:640px){' +\n"
 "      '.lw-card{padding:26px 20px 24px}' +\n"
 "      '.lw-card .lw-img{width:140px;height:140px}' +\n"
 "      '.lw-card h2{font-size:1.8rem}' +\n"
 "      '.lw-card .lw-open{font-size:1.2rem}' +\n"
 "      '.lw-card p{font-size:1.12rem}' +\n"
 "      '.lw-card .lw-note{font-size:.95rem}}';"),

("B2. the X in the card",
 "  scrim.innerHTML =\n    '<div class=\"lw-card\">' +",
 "  scrim.innerHTML =\n    '<div class=\"lw-card\">' +\n"
 "      '<button class=\"lw-x\" type=\"button\" aria-label=\"Close\">&times;</button>' +"),
]

MUST_APPEAR = ["max-height:88dvh", "lw-x", "@media(max-width:640px)"]

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
        if halt: ok=False; continue
        print("  %d -> %d (+%d)" % (before, len(text), len(text)-before))
        if apply:
            dst = os.path.join(out_dir, os.path.basename(name))
            io.open(dst,"w",encoding="utf-8",newline="\n").write(text)
            print("  WROTE %s" % dst)
        else: print("  DRY RUN -- nothing written")
    print("\n" + ("All files clean." if ok else "ONE OR MORE FILES REFUSED."))
    return 0 if ok else 1

if __name__ == "__main__":
    apply = "--apply" in sys.argv
    home = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)
    out_dir = os.path.join(home,"Downloads"); src_dir = repo
    for a in sys.argv[1:]:
        if a.startswith("--src="): src_dir=a[6:]
        if a.startswith("--out="): out_dir=a[6:]
    print("\nreading  %s\nwriting  %s" % (src_dir, out_dir))
    sys.exit(run(src_dir, out_dir, apply))
