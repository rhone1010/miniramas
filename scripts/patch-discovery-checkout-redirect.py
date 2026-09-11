#!/usr/bin/env python3
"""
patch-discovery-checkout-redirect.py

Two anchored edits to public/discovery-consolidated-draft.html:
  1. startCheckout: take the hosted-redirect URL when the server returns
     one (r.data.url), instead of only checking for embedded-checkout
     fields the server doesn't send.
  2. The layout shim's home.parentNode.insertBefore call: guard against
     a detached comment node (home.parentNode is null after a rail
     re-render), which was throwing on window resize.

Each edit requires its exact anchor text to appear EXACTLY ONCE in the
target file. If an anchor is missing or appears more than once, this
script reports it and makes NO changes at all — it does not partially
patch.

Usage:
    python patch-discovery-checkout-redirect.py --dry-run
    python patch-discovery-checkout-redirect.py

Run from the repo root (D:\\minramas), or pass --file explicitly.
"""

import argparse
import sys

EDITS = [
    {
        "name": "startCheckout: honor hosted redirect URL",
        "old": (
            "var r = out[1];\n"
            "    if (!r.data.clientSecret || !r.data.publishableKey) {"
        ),
        "new": (
            "var r = out[1];\n"
            "    if (r.data.url) { window.location = r.data.url; return; }\n"
            "    if (!r.data.clientSecret || !r.data.publishableKey) {"
        ),
    },
    {
        "name": "layout shim: guard detached home.parentNode",
        "old": "home.parentNode.insertBefore(coll, home.nextSibling);",
        "new": "if (home.parentNode) home.parentNode.insertBefore(coll, home.nextSibling);",
    },
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--file",
        default="public/discovery-consolidated-draft.html",
        help="Path to the target file (default: public/discovery-consolidated-draft.html)",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Check anchors and report what would change, without writing.",
    )
    args = ap.parse_args()

    try:
        with open(args.file, "r", encoding="utf-8") as f:
            text = f.read()
    except FileNotFoundError:
        print(f"ERROR: file not found: {args.file}")
        sys.exit(1)

    original_len = len(text)
    problems = []
    for edit in EDITS:
        count = text.count(edit["old"])
        if count == 0:
            problems.append(f"  - '{edit['name']}': anchor NOT FOUND. No changes made.")
        elif count > 1:
            problems.append(
                f"  - '{edit['name']}': anchor found {count} times (expected exactly 1). "
                "No changes made."
            )

    if problems:
        print("STOPPED — one or more anchors did not match exactly once:")
        for p in problems:
            print(p)
        print("\nNo file was modified. This means the target file's content differs")
        print("from what this script expects — likely already patched, or changed")
        print("since this script was written. Do not force it; investigate first.")
        sys.exit(1)

    for edit in EDITS:
        text = text.replace(edit["old"], edit["new"])

    added_bytes = len(text.encode("utf-8")) - len(
        open(args.file, "r", encoding="utf-8").read().encode("utf-8")
    )

    print("All anchors matched exactly once. Both edits ready:")
    for edit in EDITS:
        print(f"  - {edit['name']}")
    print(f"\nBytes added: {len(text) - original_len}")

    if args.dry_run:
        print("\nDRY RUN — no file written. Re-run without --dry-run to apply.")
        sys.exit(0)

    with open(args.file, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"\nWritten: {args.file}")


if __name__ == "__main__":
    main()
