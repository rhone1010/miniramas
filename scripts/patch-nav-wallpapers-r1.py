#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-nav-wallpapers-r1.py  -  CUI 41A  -  25 August 2026

Ruled by Rich, from the masthead screenshot: the Mobile Wallpapers
submenu (Portraits / Pets / Studio) leaves the Series menu. Wallpapers
is one line, one door - everything happens in the main room.

Applies to the six rooms this lane owns. Gallery, community and the
wallpaper pages carry the same canonical menu and belong to 41B and 42 -
the SYNC note rides separately.
"""
import os, sys, io

FILES = ["portraits.html", "pets.html", "groups.html",
         "halloween.html", "pets-halloween.html", "pets-chooser.html"]

OLD = """        <a href="/wallpapers" role="menuitem">Mobile Wallpapers</a>
        <a href="/wallpapers/portraits" class="sub" role="menuitem">Portraits</a>
        <a href="/wallpapers/pets" class="sub" role="menuitem">Pets</a>
        <a href="/wallpapers/studio" class="sub" role="menuitem">Studio</a>"""

NEW = """        <!-- One line, one door - the sub-rooms left the menu, Rich's
             ruling 25 Aug 2026. Everything happens in the main room. -->
        <a href="/wallpapers" role="menuitem">Mobile Wallpapers</a>"""

def normalise(s): return s.replace("\r\n", "\n").replace("\r", "\n")

def run(src_dir, out_dir, apply):
    ok = True
    for name in FILES:
        src = os.path.join(src_dir, name)
        print("\n" + "="*66 + "\n" + name + "\n" + "="*66)
        if not os.path.isfile(src): print("  REFUSED: not found"); ok=False; continue
        text = normalise(io.open(src,"rb").read().decode("utf-8"))
        before = len(text)
        n = text.count(OLD)
        if n == 0 and NEW in text:
            print("  REFUSED: already applied"); ok=False; continue
        if n != 1:
            print("  REFUSED: anchor %d times, need 1" % n); ok=False; continue
        text = text.replace(OLD, NEW, 1)
        print("  ok   submenu out, one line stays")
        if 'class="sub" role="menuitem">Studio' in text:
            print("  REFUSED: a sub link survived"); ok=False; continue
        print("  %d -> %d (%+d)" % (before, len(text), len(text)-before))
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
