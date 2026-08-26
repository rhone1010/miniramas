#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-qa-doc-r1.py  -  CUI 41A  -  26 August 2026

QA-BEFORE-LAUNCH learns what the admin-panel review found (25 Aug):

  A  The Prodigi test has a silent killer: prints reach Prodigi ONLY
     for accounts whose fulfilment flag is on. Flip the test account
     first or the print never sends and looks like a bug.

  B  Day-of gains the panel: Health tab open, fulfilment flags default
     off, QA sliders confirmed at launch values per Series.
"""
import os, sys, io

FILES = [os.path.join("docs", "GOVERNANCE", "QA-BEFORE-LAUNCH-2026-08-24.md")]

EDITS = [

("A . the fulfilment flag precedes the Prodigi test",
 "- [ ] Print order end-to-end: quote -> checkout -> Stripe webhook ->\n"
 "      Prodigi order visible in their dashboard. One real cheap print.",
 "- [ ] FIRST: flip the test account's fulfilment flag ON in the admin\n"
 "      panel (Controls). Prints reach Prodigi only for flagged\n"
 "      accounts - unflagged, the order silently never sends and\n"
 "      reads as a bug. (Panel review, 25 Aug.)\n"
 "- [ ] Print order end-to-end: quote -> checkout -> Stripe webhook ->\n"
 "      Prodigi order visible in their dashboard. One real cheap print."),

("B . day-of gains the admin panel",
 "- [ ] H: mounted, FileActions log rolling, Save-Work green.",
 "- [ ] Admin panel: Health tab OPEN through the evening (incidents\n"
 "      badge); fulfilment flags default OFF for guests; per-Series QA\n"
 "      sliders confirmed at launch values. /admin, one screen.\n"
 "- [ ] H: mounted, FileActions log rolling, Save-Work green."),
]

MUST_APPEAR = ["fulfilment flag ON in the admin", "Health tab OPEN through the evening"]

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
