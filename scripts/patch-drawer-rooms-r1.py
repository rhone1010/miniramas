#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-drawer-rooms-r1.py  -  CUI 41A  -  27 August 2026

RICH'S MOBILE NOTE: the drawer has no Pets and no Halloween. It was
built before those rooms existed and never learned them. Pets and
Halloween join, in the Series order the desktop menu already uses:
Portraits, Pets, Groups, Halloween.

Each room's drawer marks its own line class="on", so the anchor comes
in flavours; the first that matches once is taken.
"""
import os, sys, io

FILES = ["portraits.html", "pets.html", "groups.html",
         "halloween.html", "pets-halloween.html", "pets-chooser.html"]

# (old, new) alternates - first that appears exactly once wins.
VARIANTS = [
 # portraits' own drawer
 ('    <a href="/portraits" class="on">Portraits</a>\n    <a href="/groups">Groups</a>',
  '    <a href="/portraits" class="on">Portraits</a>\n'
  '    <a href="/pets">Pets</a>\n'
  '    <a href="/groups">Groups</a>\n'
  '    <a href="/halloween">Halloween</a>'),
 # pets-family rooms: pets on
 ('    <a href="/portraits">Portraits</a>\n    <a href="/pets" class="on">Pets</a>\n    <a href="/groups">Groups</a>',
  '    <a href="/portraits">Portraits</a>\n'
  '    <a href="/pets" class="on">Pets</a>\n'
  '    <a href="/groups">Groups</a>\n'
  '    <a href="/halloween">Halloween</a>'),
 # groups' drawer
 ('    <a href="/portraits">Portraits</a>\n    <a href="/groups" class="on">Groups</a>',
  '    <a href="/portraits">Portraits</a>\n'
  '    <a href="/pets">Pets</a>\n'
  '    <a href="/groups" class="on">Groups</a>\n'
  '    <a href="/halloween">Halloween</a>'),
 # halloween's drawer
 ('    <a href="/portraits">Portraits</a>\n    <a href="/groups">Groups</a>\n    <a href="/halloween" class="on">Halloween</a>',
  '    <a href="/portraits">Portraits</a>\n'
  '    <a href="/pets">Pets</a>\n'
  '    <a href="/groups">Groups</a>\n'
  '    <a href="/halloween" class="on">Halloween</a>'),
 # plain drawer: neither pets nor halloween present, nothing on
 ('    <a href="/portraits">Portraits</a>\n    <a href="/groups">Groups</a>\n    <a href="/wallpapers">Mobile Wallpapers</a>',
  '    <a href="/portraits">Portraits</a>\n'
  '    <a href="/pets">Pets</a>\n'
  '    <a href="/groups">Groups</a>\n'
  '    <a href="/halloween">Halloween</a>\n'
  '    <a href="/wallpapers">Mobile Wallpapers</a>'),
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
        if '<a href="/pets">Pets</a>\n    <a href="/groups">' in text or \
           'href="/halloween">Halloween</a>\n    <a href="/wallpapers">' in text:
            print("  REFUSED: already applied"); ok=False; continue
        hit = None
        for old, new in VARIANTS:
            if text.count(old) == 1:
                hit = (old, new); break
        if not hit:
            print("  REFUSED: no drawer variant matched once"); ok=False; continue
        text = text.replace(hit[0], hit[1], 1)
        print("  ok   Pets and Halloween join the drawer")
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
