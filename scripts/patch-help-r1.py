#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-help-r1.py  -  CUI 41A  -  24 August 2026

  1  NAV HAS THREE LINKS. Should match rooms: Portraits / Groups / Pets /
     Halloween / Wallpapers / Gallery / Community.

  2  MOBILE SIDE MARGINS. --stage-gutter is 20px but the help content
     needs explicit padding at the section level on a phone.
"""
import os, sys, io

FILES = ["help.html"]

A_OLD = (
    '  <nav class="mh-nav">\n'
    '    <a href="/portraits">Portraits</a>\n'
    '    <a href="/gallery">Gallery</a>\n'
    '    <a href="/community">Community</a>\n'
    '  </nav>'
)
A_NEW = (
    '  <!-- CUI 41A, 24 Aug 2026. Match room nav. -->\n'
    '  <nav class="mh-nav">\n'
    '    <a href="/portraits">Portraits</a>\n'
    '    <a href="/groups">Groups</a>\n'
    '    <a href="/pets">Pets</a>\n'
    '    <a href="/halloween">Halloween</a>\n'
    '    <a href="/wallpapers">Wallpapers</a>\n'
    '    <a href="/gallery">Gallery</a>\n'
    '    <a href="/community">Community</a>\n'
    '  </nav>'
)

B_OLD = "  .open{ padding:26px 0 14px }"
B_NEW = (
    "  /* CUI 41A, 24 Aug 2026. Side margins on a phone. */\n"
    "  .open{ padding:26px 5% 14px }\n"
    "  .doc, .jump-in{ padding-left:5%; padding-right:5% }\n"
    "  .q-btn{ padding-left:5% }\n"
    "  .q-body{ padding-left:calc(5% + 1.75rem) }"
)

EDITS = [
    ("A . nav links match rooms",    A_OLD, A_NEW),
    ("B . mobile side margins 5%",   B_OLD, B_NEW),
]
MUST_APPEAR = ['href="/groups">Groups', 'padding:26px 5%']
MUST_VANISH = ['<a href="/gallery">Gallery</a>\n  </nav>']


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
            if n != 1: print("  REFUSED: anchor %d times -- %s" % (n, label)); halt=True
            elif new in text: print("  REFUSED: already applied -- %s" % label); halt=True
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
            dst = os.path.join(out_dir, name)
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
    out_dir = os.path.join(home,"Downloads"); src_dir = ""
    for a in sys.argv[1:]:
        if a.startswith("--src="): src_dir=a[6:]
        if a.startswith("--out="): out_dir=a[6:]
    if not src_dir: src_dir = os.path.join(repo,"public")
    if not os.path.isdir(src_dir): print("REFUSED: install to scripts\\ first."); sys.exit(1)
    print("\nreading  %s\nwriting  %s" % (src_dir, out_dir))
    sys.exit(run(src_dir, out_dir, apply))
