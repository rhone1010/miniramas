#!/usr/bin/env python3
"""
patch-add-discovery-preview-route-r1.py
CUI 45, 30 Aug 2026.

Adds one line to middleware.ts's PAGES table: '/discovery-preview' ->
'/discovery-preview.html'. Not linked from any nav/menu -- only
reachable by typing the URL directly, per Rich's isolated-preview
pattern (same as wallpaper-studio-V001 being kept alive alongside V002).

CAVEAT, stated plainly: this anchor is built from middleware.ts content
pasted into chat, NOT a byte-tested upload like the portraits.html
patches were. Real risk of drift (whitespace, line endings, or the
file having changed since). Written to refuse safely rather than
corrupt if the anchor doesn't match -- if it refuses, that is the
correct behavior, not a bug. Paste the Select-String output below and
the anchor gets re-cut, not forced.

ROUTING FLAG: per portraits.html's own comment, any PR touching
middleware.ts needs "ROUTING" in the title and Rich's explicit
approval before merge -- this is that file.

Usage:
  python patch-add-discovery-preview-route-r1.py <path-to-middleware.ts>
  python patch-add-discovery-preview-route-r1.py <path-to-middleware.ts> --apply

If REFUSED:
  Select-String -Path <path> -Pattern "'/help'" -Context 3,1
  paste that output back so the anchor can be re-cut against the real file.
"""
import sys
import argparse

ANCHOR = (
    b"  '/help': '/help.html',\r\n"
    b"};"
)

REPLACEMENT = (
    b"  '/help': '/help.html',\r\n"
    b"  /* DISCOVERY PREVIEW. Isolated test route, not linked from any nav\r\n"
    b"     or menu -- reachable only by typing the URL directly. Added\r\n"
    b"     30 Aug 2026 to test the icon-nav/continuous-scroll Discovery\r\n"
    b"     redesign without touching any live traffic. Same pattern as\r\n"
    b"     wallpaper-studio-V001 staying live alongside V002. */\r\n"
    b"  '/discovery-preview': '/discovery-preview.html',\r\n"
    b"};"
)

MUST_APPEAR = b"'/discovery-preview': '/discovery-preview.html',"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    with open(args.path, "rb") as f:
        content = f.read()

    count = content.count(ANCHOR)
    if count == 0:
        print("REFUSED: anchor not found (byte-exact, CRLF). This is expected risk,")
        print("stated up front -- this anchor was never tested against a real file.")
        print('Run: Select-String -Path <file> -Pattern "\'/help\'" -Context 3,1')
        print("and paste the output so the anchor can be re-cut correctly.")
        sys.exit(1)
    if count > 1:
        print(f"REFUSED: anchor matched {count} times, expected exactly 1.")
        sys.exit(1)

    new_content = content.replace(ANCHOR, REPLACEMENT)

    if not args.apply:
        print("[DRY RUN] Anchor found exactly once. Would insert:")
        print(REPLACEMENT.decode("utf-8"))
        print("\nRe-run with --apply to write the change.")
        return

    with open(args.path, "wb") as f:
        f.write(new_content)

    with open(args.path, "rb") as f:
        verify = f.read()
    ok = MUST_APPEAR in verify
    print(f"MUST_APPEAR present: {ok}")
    if ok:
        print("Done. Verified. File byte-count delta:", len(new_content) - len(content))
        print("\nREMINDER: this PR needs 'ROUTING' in the title and your explicit approval.")
    else:
        print("WARNING: post-write verification failed. Check the file by hand.")
        sys.exit(1)

if __name__ == "__main__":
    main()
