#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-mobile-rooms3.py  -  CUI 41A  -  23 August 2026

Brings halloween.html, pets-halloween.html and pets-chooser.html up to
where portraits, pets and groups already are: r1 through r5.

It does not restate those patches. It loads the five installed scripts
from this folder and replays their EDITS in order, so the text going into
these three files is the same text by construction rather than by
transcription. Every anchor was confirmed present exactly once in all
three before this was written.

pet-wallpaper.html is deliberately not in the list. It has no masthead,
no drawer and no band -- none of the five have anything to say to it.

Reads <repo>\\public. Writes to Downloads. Must be installed to scripts\\.
"""

import os
import sys
import io

FILES = ["halloween.html", "pets-halloween.html", "pets-chooser.html"]
SOURCES = [
    "patch-mobile-r1.py",
    "patch-mobile-r2.py",
    "patch-mobile-r3.py",
    "patch-mobile-r4.py",
    "patch-mobile-r5.py",
]


def load_edits(folder):
    """Pull EDITS out of each installed patch, in order."""
    try:
        import importlib.util
    except ImportError:
        print("REFUSED: needs Python 3")
        sys.exit(1)

    out = []
    for fname in SOURCES:
        path = os.path.join(folder, fname)
        if not os.path.isfile(path):
            print("REFUSED: %s is not in %s" % (fname, folder))
            print("All five patches must be installed before this one runs.")
            sys.exit(1)
        spec = importlib.util.spec_from_file_location(fname[:-3].replace("-", "_"), path)
        mod = importlib.util.module_from_spec(spec)
        # Each patch guards its work behind __main__, so importing it is
        # inert -- nothing is read and nothing is written.
        spec.loader.exec_module(mod)
        if not hasattr(mod, "EDITS"):
            print("REFUSED: no EDITS in %s" % fname)
            sys.exit(1)
        for label, old, new in mod.EDITS:
            out.append((fname[12:-3] + " . " + label, old, new))
    return out


def crlf(s):
    return s.replace("\n", "\r\n")


def run(src_dir, out_dir, apply, edits):
    ok = True
    for name in FILES:
        src = os.path.join(src_dir, name)
        print("")
        print("=" * 66)
        print(name)
        print("=" * 66)

        if not os.path.isfile(src):
            print("  REFUSED: not found -- %s" % src)
            ok = False
            continue

        f = io.open(src, "r", encoding="utf-8", newline="")
        text = f.read()
        f.close()
        before = len(text)

        # Every anchor is checked against the file as it will be at that
        # point in the sequence, not against the original -- r5 rewrites
        # what r1 inserted, so checking all of them up front would refuse
        # a run that is perfectly sound.
        probe = text
        halt = False
        for label, old, new in edits:
            n = probe.count(crlf(old))
            if n != 1:
                if crlf(new) in probe:
                    print("  REFUSED: already applied -- %s" % label)
                else:
                    print("  REFUSED: anchor found %d times, need 1 -- %s" % (n, label))
                halt = True
                break
            probe = probe.replace(crlf(old), crlf(new), 1)
        if halt:
            ok = False
            continue

        text = probe
        print("  ok   all %d edits, r1 through r5" % len(edits))
        print("  %d bytes -> %d  (+%d)" % (before, len(text), len(text) - before))

        if apply:
            dst = os.path.join(out_dir, name)
            g = io.open(dst, "w", encoding="utf-8", newline="")
            g.write(text)
            g.close()
            print("  WROTE %s" % dst)
        else:
            print("  DRY RUN -- nothing written")

    print("")
    if not ok:
        print("ONE OR MORE FILES REFUSED. Nothing partial was written.")
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
        if a.startswith("--src="):
            src_dir = a[6:]
        if a.startswith("--out="):
            out_dir = a[6:]

    if not src_dir:
        src_dir = os.path.join(repo, "public")

    if not os.path.isdir(src_dir):
        print("")
        print("REFUSED: no public/ at %s" % src_dir)
        print("This script derives the repo from its own location and must")
        print("be installed to scripts\\ before it is run.")
        sys.exit(1)

    edits = load_edits(here)

    print("")
    print("reading  %s" % src_dir)
    print("writing  %s" % out_dir)
    print("replaying %d edits from %d patches" % (len(edits), len(SOURCES)))
    sys.exit(run(src_dir, out_dir, apply, edits))
