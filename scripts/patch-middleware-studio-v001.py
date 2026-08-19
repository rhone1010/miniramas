#!/usr/bin/env python3
"""
patch-middleware-studio-v001.py

  /wallpapers/studio  ->  /wallpaper-studio-V001.html

MIDDLEWARE IS THE ONE FILE THAT CANNOT BE VERSIONED. Next.js loads it only
as middleware.ts at the repo root; middleware-V001.ts would sit there doing
nothing and the route would not move. So this does what Install-File.ps1
does, in Python:

  1. MOVES middleware.ts to H:\\minramas\\middleware_001.ts
  2. writes a fresh middleware.ts in its place

Nothing is overwritten and nothing is deleted - the original is a whole file
at a new address, and putting it back is one move in the other direction.

If the archive drive is not there, this refuses and touches nothing.

Dry run by default. --write to apply.
"""

import argparse
import shutil
import sys
from pathlib import Path

SRC = Path('middleware.ts')
ARCHIVE_ROOT = Path('H:/minramas')

OLD = "  '/wallpapers/studio': '/wallpaper-studio.html',"

NEW = """  /* THE ACCORDION AND THE FIELD, merged 19 August. The previous page is
     still in the repo as wallpaper-studio.html and this line is the whole
     way back - point it at the old name and the old Studio returns, with
     no file operation and no deploy of anything but this. */
  '/wallpapers/studio': '/wallpaper-studio-V001.html',"""


def next_free(base: Path, stem: str, ext: str) -> Path:
    n = 1
    while (base / f'{stem}_{n:03d}{ext}').exists():
        n += 1
    return base / f'{stem}_{n:03d}{ext}'


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true')
    ap.add_argument('--archive-root', default=str(ARCHIVE_ROOT))
    args = ap.parse_args()

    if not SRC.exists():
        print(f'MISSING: {SRC}')
        print('Run this from the repo root (D:\\minramas).')
        return 1

    raw = SRC.read_bytes()
    crlf = b'\r\n' in raw
    text = raw.decode('utf-8').replace('\r\n', '\n')

    n = text.count(OLD)
    print(f'ANCHOR the studio route: expected 1, found {n}')

    if 'wallpaper-studio-V001.html' in text:
        print('\nAlready pointed at V001. No write.')
        return 0
    if n != 1:
        print('\nNo write. The anchor did not match exactly once.')
        return 1

    # The target must exist, or this maps the route onto a 404 - which is
    # the same symptom as a broken deploy and takes an hour to tell apart.
    page = Path('public/wallpaper-studio-V001.html')
    print(f'TARGET {page}: {"present" if page.exists() else "MISSING"}')
    if not page.exists():
        print('\nREFUSED: that page is not in public/. Run the accordion patch first.')
        return 1

    archive_root = Path(args.archive_root)
    if not archive_root.exists():
        print(f'\nREFUSED: the archive drive {archive_root} is not there.')
        print('Nothing was moved. middleware.ts is untouched.')
        return 1

    dst = next_free(archive_root, 'middleware', '.ts')
    print(f'ARCHIVE  {SRC} -> {dst}')

    out = text.replace(OLD, NEW, 1)

    for o, c, label in (('{', '}', 'braces'), ('(', ')', 'parens')):
        if (text.count(o) - text.count(c)) != (out.count(o) - out.count(c)):
            print(f'\nREFUSED: {label} imbalance changed.')
            return 1

    if not args.write:
        print('\nDry run. Nothing moved. Re-run with --write.')
        return 0

    # Move first. If this fails, the new file is never written and the
    # original is still exactly where it was.
    shutil.move(str(SRC), str(dst))

    if crlf:
        out = out.replace('\n', '\r\n')
    SRC.write_bytes(out.encode('utf-8'))

    print(f'\nWritten. /wallpapers/studio now serves the V001 page.')
    print(f'The previous middleware is at {dst} - nothing was deleted.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
