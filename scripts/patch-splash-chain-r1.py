#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch-splash-chain-r1.py
CUI 41 - 23 August 2026

WHAT IS WRONG

PANELS builds three paths per plate - big (tall-small/), mid (tall/) and
small (the square original). paint() only ever walks big -> small. `mid`
is constructed and never read.

Read from the repo on 23 August:

  previews/home/splash/tall-small/   DOES NOT EXIST
  previews/home/splash/tall/         36 flat + groups, halloween, pets,
                                     pets-halloween, 4 each
  previews/home/splash/              48 flat + halloween, pets,
                                     pets-halloween, 4 each. NO groups.

So every `big` 404s and every plate drops to the square original, shown
contained on the blurred ground rather than edge to edge. Groups drops to
a path that does not exist either, because its only plates are the tall
ones - that panel shows nothing.

THE FIX

paint() walks big -> mid -> small, in order, stopping at the first that
loads. Nothing else changes: tall-small/ can be created later and will be
picked up with no further edit, and a Series with no tall plate still
falls back to its square.

Also widens the is-short test. It asks whether the URL contains '/tall/',
which is false for '/tall-small/' - so the day those plates land they
would arrive 9:16 and be shown contained. Now matches both.

Reads   D:\\minramas\\public\\index.html
Writes  %USERPROFILE%\\Downloads\\index.html

Refuses to write unless every anchor matches exactly.
"""

import os
import sys

SRC = r"D:\minramas\public\index.html"
OUT = os.path.join(os.environ.get("USERPROFILE", ""), "Downloads", "index.html")

OLD_CHAIN = """      var img = new Image();
      img.onload = function(){ show(img.src); };
      img.onerror = function(){
        if (f.small && img.src !== f.small){
          img.src = f.small;
          return;
        }
        show(f.small || f.big);
      };
      img.src = f.big || f.small;
"""

NEW_CHAIN = """      /* CUI 41, 23 Aug 2026. THREE RUNGS, NOT TWO.

         PANELS has always built big, mid and small. This walker read big
         and small and skipped the middle - and since splash/tall-small/
         does not exist, every plate fell past the tall version it had to
         the square original. Groups fell past its only plates to a folder
         that is not there and showed nothing.

         Now it walks the list in order and stops at the first that
         loads, so the best available plate wins on its own. Creating
         tall-small/ later needs no edit here. */
      var chain = [f.big, f.mid, f.small].filter(Boolean);
      var rung  = 0;

      var img = new Image();
      img.onload = function(){ show(img.src); };
      img.onerror = function(){
        rung += 1;
        if (rung < chain.length){ img.src = chain[rung]; return; }
        show(chain[chain.length - 1]);
      };
      if (!chain.length) return;
      img.src = chain[0];
"""

# The is-short test, in both reels.
OLD_SHORT = "        back.classList.toggle('is-short', url.indexOf('/tall/') === -1);"
NEW_SHORT = "        back.classList.toggle('is-short', !/\\/tall(-small)?\\//.test(url));"


def main():
    if not os.path.isfile(SRC):
        print("REFUSED  source not found: %s" % SRC)
        return 1

    with open(SRC, encoding="utf-8", newline="") as f:
        s = f.read()
    before = len(s)

    # The repo file is CRLF. Match on either.
    def sub(old, new, label, expect):
        nonlocal s
        for a, b in ((old, new), (old.replace("\n", "\r\n"), new.replace("\n", "\r\n"))):
            n = s.count(a)
            if n == expect:
                s = s.replace(a, b)
                return True
        print("REFUSED  %s matched %d times, expected %d"
              % (label, s.count(old), expect))
        return False

    if not sub(OLD_CHAIN, NEW_CHAIN, "paint() chain", 1):
        return 1
    if not sub(OLD_SHORT, NEW_SHORT, "is-short test", 2):
        return 1

    if "img.src = f.big || f.small;" in s:
        print("REFUSED  old chain survived")
        return 1
    if s.count("var chain = [f.big, f.mid, f.small]") != 1:
        print("REFUSED  new chain not present exactly once")
        return 1
    if s.count("/tall(-small)?") != 2:
        print("REFUSED  is-short test not replaced twice")
        return 1

    with open(OUT, "w", encoding="utf-8", newline="") as f:
        f.write(s)

    print("  wrote     %s" % OUT)
    print("            %d bytes (was %d)" % (len(s), before))
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
