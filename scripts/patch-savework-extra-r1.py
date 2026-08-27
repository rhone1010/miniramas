#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-savework-extra-r1.py  -  CUI 41A  -  26 August 2026

THE -Extra BUG, FIXED AT LAST. powershell -File marshals every argument
as a flat string - the [string[]] never reconstitutes, extras silently
vanish, and twice now files meant for a commit stayed untracked until a
hand-run git add caught them.

Two edits: -Extra swallows all remaining arguments, and each one is
split on commas - so every calling style lands:
    -Extra "a","b"        (array - now arrives as remaining args)
    -Extra "a,b"          (one comma string)
    -Extra a b            (bare remaining args)
"""
import os, sys, io

FILES = [os.path.join("scripts", "Save-Work-CUI41A.ps1")]

EDITS = [

("A . -Extra swallows the remaining arguments",
 "  [string[]]$Extra = @()\n)",
 "  [Parameter(ValueFromRemainingArguments=$true)]\n"
 "  [string[]]$Extra = @()\n)"),

("B . commas split, blanks dropped",
 "$toStage = @()\n"
 "foreach ($f in ($CUI_FILES + $Extra)) {",
 "# -File flattens arrays; remaining-args + comma-split makes every\n"
 "# calling style work. CUI 41A, 26 Aug 2026.\n"
 "$ExtraFlat = @()\n"
 "foreach ($e in $Extra) {\n"
 "  foreach ($piece in ($e -split ',')) {\n"
 "    $p = $piece.Trim()\n"
 "    if ($p -ne '') { $ExtraFlat += $p }\n"
 "  }\n"
 "}\n"
 "$toStage = @()\n"
 "foreach ($f in ($CUI_FILES + $ExtraFlat)) {"),
]

MUST_APPEAR = ["ValueFromRemainingArguments", "$ExtraFlat"]

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
