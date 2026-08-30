#!/usr/bin/env python3
"""
patch-polish-piece-ring-r1.py
CUI 45, 30 Aug 2026.

Polishes the existing .piece__ring spinner -- the fallback that's
becoming the ONLY state again after the Unicorn Studio scene revert.
CSS-only, no JS, no assets, no per-tile cost -- scales to any number
of concurrent crafting tiles for free, which was the whole reason to
drop the WebGL approach.

Changes, each with a reason:
- weight 2px -> 2.5px: more presence at 2.6rem size, was reading thin
- +0.4rem size (2.6rem -> 3rem): same reason, better proportioned
- +soft gold glow (box-shadow): reads as "crafted," not a generic
  loading spinner
- duration 1.05s -> 1.4s: slower pace reads as considered/patient,
  matches the brand's unhurried register rather than urgent-loading

One anchor, dry-run default, refuses on drift, verifies after write.

Usage:
  python patch-polish-piece-ring-r1.py <path-to-file.html>
  python patch-polish-piece-ring-r1.py <path-to-file.html> --apply
"""
import sys
import argparse

ANCHOR = (
    b".piece__ring{\r\n"
    b"  width:2.6rem; height:2.6rem;\r\n"
    b"  border:2px solid rgba(201,166,96,.22);\r\n"
    b"  border-top-color:rgba(201,166,96,.85);\r\n"
    b"  border-radius:50%;\r\n"
    b"  animation:mcSpin 1.05s linear infinite;\r\n"
    b"}"
)

REPLACEMENT = (
    b".piece__ring{\r\n"
    b"  width:3rem; height:3rem;\r\n"
    b"  border:2.5px solid rgba(201,166,96,.22);\r\n"
    b"  border-top-color:rgba(201,166,96,.9);\r\n"
    b"  border-radius:50%;\r\n"
    b"  box-shadow:0 0 14px rgba(201,166,96,.18);\r\n"
    b"  animation:mcSpin 1.4s linear infinite;\r\n"
    b"}"
)

MUST_APPEAR = b"box-shadow:0 0 14px rgba(201,166,96,.18);"
MUST_VANISH = b"animation:mcSpin 1.05s linear infinite;"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    with open(args.path, "rb") as f:
        content = f.read()

    count = content.count(ANCHOR)
    if count == 0:
        print("REFUSED: anchor not found (byte-exact, CRLF). File may have drifted.")
        print("Run: Select-String -Path <file> -Pattern 'piece__ring' -Context 0,6")
        print("and paste the output so the anchor can be re-cut.")
        sys.exit(1)
    if count > 1:
        print(f"REFUSED: anchor matched {count} times, expected exactly 1.")
        sys.exit(1)

    new_content = content.replace(ANCHOR, REPLACEMENT)

    if not args.apply:
        print("[DRY RUN] Anchor found exactly once. Would replace:")
        print(ANCHOR.decode("utf-8"))
        print("---with---")
        print(REPLACEMENT.decode("utf-8"))
        print("\nRe-run with --apply to write the change.")
        return

    with open(args.path, "wb") as f:
        f.write(new_content)

    with open(args.path, "rb") as f:
        verify = f.read()
    ok_appear = MUST_APPEAR in verify
    ok_vanish = MUST_VANISH not in verify
    print(f"MUST_APPEAR present: {ok_appear}")
    print(f"MUST_VANISH absent:  {ok_vanish}")
    if ok_appear and ok_vanish:
        print("Done. Verified. File byte-count delta:", len(new_content) - len(content))
    else:
        print("WARNING: post-write verification failed. Check the file by hand.")
        sys.exit(1)

if __name__ == "__main__":
    main()
