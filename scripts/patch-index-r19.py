#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-index-r19.py  -  CUI 41A  -  24 August 2026

THE FALLBACK CHAIN NEVER WORKED, AND IT LOOPED FOREVER ON A MISS.

makePainter compared img.src to the candidate paths to decide which step
of the chain it was on. img.src returns the RESOLVED absolute URL
(https://litenco.com/previews/...) while the candidates are relative
(/previews/...). They are never equal, so:

  - the tall/ step was always skipped (tall-small 404 jumped to plain)
  - a plain 404 reset src to plain again, forever -- the console flood

Replaced with an attempt index. Three tries, in order, then stop.
"""
import os, sys, io

FILES = ["index.html"]

OLD = """      var img = new Image();
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
      img.src = first;"""

NEW = """      /* CUI 41A, 24 Aug 2026. An attempt index, not a src comparison.
         img.src returns the resolved absolute URL and the candidates are
         relative, so the old comparison never matched -- the tall/ step
         was skipped and a plain 404 looped forever. */
      var tries = [first, second, plain].filter(Boolean);
      var at = 0;
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
        at += 1;
        if (at < tries.length){ img.src = tries[at]; return; }
        /* All three missed. Stop. The layer keeps what it had. */
      };
      img.src = tries[0];"""

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
        if n != 1:
            if NEW in text: print("  REFUSED: already applied")
            else: print("  REFUSED: anchor %d times" % n)
            ok=False; continue
        text = text.replace(OLD, NEW, 1)
        print("  ok   fallback chain uses attempt index")
        if "img.src === first" in text:
            print("  REFUSED: old comparison still present"); ok=False; continue
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
