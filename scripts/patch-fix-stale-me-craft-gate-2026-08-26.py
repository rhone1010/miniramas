#!/usr/bin/env python3
"""
patch-fix-stale-me-craft-gate-2026-08-26.py

Fixes the intermittent sign-in bug: the craft gate (tbcGo click handler)
checked the client-side `ME` variable directly, which is only ever set at
page load or inside whoAmI()'s own callback. It is never refreshed when a
user returns to the tab after clicking a magic link in a new tab -- so a
genuinely-signed-in user could still be gated as signed-out, unpredictably,
depending on whether anything else happened to call whoAmI() first.

Fix: the gate now calls whoAmI() fresh, right at the moment of click, and
decides off ITS result -- not the possibly-stale ME variable. whoAmI()
already updates ME/CREDITS and repaints as a side effect, so nothing
downstream needs to change.

Idempotent: if the fix is already present, the file is skipped, not
re-patched. Refuses (does not touch) the file if the anchor is missing or
appears more than once, rather than guessing.

Usage:
  python patch-fix-stale-me-craft-gate-2026-08-26.py            # dry run
  python patch-fix-stale-me-craft-gate-2026-08-26.py --apply    # writes

Expects to live at <repo>/scripts/patch-fix-stale-me-craft-gate-2026-08-26.py
and self-locates the repo root two levels up.
"""

import sys
import os

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET = os.path.join(REPO_ROOT, "public", "portraits.html")

OLD = (
    "      if (!ME){ PENDING_CRAFT = true; openSignin(); return; }\r\n"
    "      window.__runAll();"
)

GUARD = "whoAmI().then(function(freshUser){"

NEW = (
    "      whoAmI().then(function(freshUser){\r\n"
    "        if (!freshUser){ PENDING_CRAFT = true; openSignin(); return; }\r\n"
    "        window.__runAll();\r\n"
    "      });"
)


def main():
    apply = "--apply" in sys.argv
    mode = "APPLY" if apply else "DRY RUN"
    print(f"=== patch-fix-stale-me-craft-gate-2026-08-26.py -- {mode} ===")
    print(f"Target: {TARGET}")
    print()

    if not os.path.isfile(TARGET):
        print(f"[MISSING] portraits.html not found at {TARGET}")
        sys.exit(1)

    with open(TARGET, "r", encoding="utf-8", newline="") as f:
        content = f.read()

    if GUARD in content:
        print("[SKIP] already patched")
        sys.exit(0)

    count = content.count(OLD)
    if count == 0:
        print("[REFUSE] anchor not found -- file has drifted, not touching it")
        sys.exit(1)
    if count > 1:
        print(f"[REFUSE] anchor found {count} times, expected exactly 1 -- ambiguous, not touching it")
        sys.exit(1)

    if not apply:
        print("[WOULD PATCH] portraits.html")
        print("  old:", repr(OLD))
        print("  new:", repr(NEW))
        sys.exit(0)

    new_content = content.replace(OLD, NEW, 1)
    with open(TARGET, "w", encoding="utf-8", newline="") as f:
        f.write(new_content)

    with open(TARGET, "r", encoding="utf-8", newline="") as f:
        verify = f.read()
    if GUARD not in verify:
        print("[FAIL] wrote but post-write verification did not find the guard")
        sys.exit(1)

    print("[PATCHED] portraits.html")


if __name__ == "__main__":
    main()
