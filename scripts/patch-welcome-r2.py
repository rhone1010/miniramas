#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-welcome-r2.py  -  CUI 41A  -  27 August 2026

RICH'S MOBILE NOTES ON THE WELCOME (screenshot, this morning):
"formatted badly for mobile and no way to close it."

  A  A visible way out: an always-on-screen X in the card's corner,
     wired to the same dismiss-and-remember as the button. On a phone
     the button sat below the fold - the screen read as a wall.
  B  The card learns phone type: body drops to 18px serif under 640px,
     the headline to 26px, padding tightens, height caps at 88dvh so
     the button is reachable.

If any anchor refuses: someone else has edited the welcome since r1
(the circular portrait in Rich's screenshot is not r1's markup) - stop
and report WHICH edit refused rather than forcing anything.
"""
import os, sys, io

FILES = ["index.html"]

EDITS = [

("A1. the X, first thing in the card",
 '  <div class="welcome-card">\n    <h2 class="welcome-h">Welcome to Liten &amp; Co.</h2>',
 '  <div class="welcome-card">\n'
 '    <button class="welcome-x" id="welcomeX" aria-label="Close">&times;</button>\n'
 '    <h2 class="welcome-h">Welcome to Liten &amp; Co.</h2>'),

("A2. the card anchors the X",
 "  background:#f3ede1; color:#2a241e;\n  max-width:560px; max-height:86vh; overflow:auto;",
 "  position:relative;\n  background:#f3ede1; color:#2a241e;\n  max-width:560px; max-height:86vh; overflow:auto;"),

("A3+B. the X's clothes and the phone scale",
 ".welcome-go:hover{ background:#6d3838 }",
 ".welcome-go:hover{ background:#6d3838 }\n"
 ".welcome-x{\n"
 "  position:absolute; top:8px; right:12px;\n"
 "  font-size:26px; line-height:1; padding:6px 10px;\n"
 "  background:none; border:none; color:#7d4242; cursor:pointer;\n"
 "}\n"
 "/* Phone scale - Rich's note 27 Aug: the desktop sizes ran the card\n"
 "   past the fold and hid the only way out. */\n"
 "@media (max-width:640px){\n"
 "  .welcome{ padding:14px }\n"
 "  .welcome-card{ font-size:18px; padding:22px 20px; max-height:88dvh }\n"
 "  .welcome-h{ font-size:26px }\n"
 "  .welcome-go{ font-size:18px; padding:.5rem 1.3rem }\n"
 "}"),

("A4. the X dismisses and remembers, same as the button",
 "  el.hidden = false;\n"
 "  go.addEventListener('click', function(){\n"
 "    el.hidden = true;\n"
 "    try { localStorage.setItem(KEY, String(Date.now())); } catch(e){}\n"
 "  });",
 "  el.hidden = false;\n"
 "  function leave(){\n"
 "    el.hidden = true;\n"
 "    try { localStorage.setItem(KEY, String(Date.now())); } catch(e){}\n"
 "  }\n"
 "  go.addEventListener('click', leave);\n"
 "  var x = document.getElementById('welcomeX');\n"
 "  if (x) x.addEventListener('click', leave);"),
]

MUST_APPEAR = ['id="welcomeX"', "function leave()", "@media (max-width:640px){\n  .welcome{ padding:14px }"]

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
