#!/usr/bin/env python3
"""
scripts/build-gallery-plates.py

Build 900px gallery plates from the style-ref originals.

    python scripts/build-gallery-plates.py            (dry run — writes nothing)
    python scripts/build-gallery-plates.py --live     (writes)

WHY 900 AND NOT 600
    The gallery draws a tile 430px wide. Most people are on a 2x display,
    so 430 CSS pixels is 860 real ones. A 600px plate still softens on the
    machines most customers are using; 900 covers it with a little room and
    costs about 110KB at quality 78.

WHY ALONGSIDE AND NOT INSTEAD
    These land as man@2x.jpg / woman@2x.jpg beside the existing 390s. The
    gallery shows 112 plates at once and wants the weight; the workshop
    shows seven at a time and does not. Replacing the small ones would
    make the workshop heavier to fix a problem it does not have.

WHAT IT WILL NOT DO
    It will not upscale. A source smaller than 900 is copied at its own
    size and named in the report, because a 900px file built from a 512px
    original is a bigger download of the same blur.

    It does not trust the number in the filename. Thirteen effects had
    their genders swapped once already; the token in the name is what is
    read, and any folder that does not resolve to exactly one man and one
    woman is reported rather than guessed at.
"""

import sys
import shutil
from pathlib import Path

ROOT     = Path(__file__).resolve().parent.parent
SRC_ROOT = ROOT / 'lib' / 'v1' / 'portraits' / 'style-refs'
OUT_ROOT = ROOT / 'public' / 'previews' / 'effects'

WIDTH   = 900
QUALITY = 78
LIVE    = '--live' in sys.argv

try:
    from PIL import Image
except ImportError:
    print('FAIL  Pillow is not installed.')
    print('      pip install Pillow')
    sys.exit(1)


def gender_of(name: str):
    """The token in the filename, not the number in front of it."""
    low = name.lower()
    if 'woman' in low or 'female' in low:
        return 'woman'
    if 'man' in low or 'male' in low:
        return 'man'
    return None


def main():
    if not SRC_ROOT.is_dir():
        print(f'FAIL  no style-refs at {SRC_ROOT}')
        sys.exit(1)

    folders = sorted(p for p in SRC_ROOT.iterdir() if p.is_dir())
    print(f'source   {SRC_ROOT}')
    print(f'output   {OUT_ROOT}')
    print(f'mode     {"LIVE - WRITES FILES" if LIVE else "dry run"}')
    print(f'target   {WIDTH}px wide, quality {QUALITY}')
    print(f'folders  {len(folders)}')
    print('')

    written, skipped, small, problems = 0, 0, [], []

    for folder in folders:
        effect = folder.name
        found = {}

        for f in sorted(folder.iterdir()):
            if not f.is_file() or f.suffix.lower() not in ('.jpg', '.jpeg', '.png', '.webp'):
                continue
            who = gender_of(f.name)
            if who and who not in found:
                found[who] = f

        if len(found) != 2:
            problems.append((effect, sorted(p.name for p in folder.iterdir() if p.is_file())))
            continue

        out_dir = OUT_ROOT / effect
        if not out_dir.is_dir():
            problems.append((effect, ['no matching folder in public/previews/effects']))
            continue

        for who, src in sorted(found.items()):
            dest = out_dir / f'{who}@2x.jpg'

            with Image.open(src) as im:
                w, h = im.size

                if w < WIDTH:
                    small.append(f'{effect}/{who}  {w}x{h}')

                if not LIVE:
                    skipped += 1
                    continue

                im = im.convert('RGB')
                if w > WIDTH:
                    new_h = round(h * WIDTH / w)
                    im = im.resize((WIDTH, new_h), Image.LANCZOS)

                im.save(dest, 'JPEG', quality=QUALITY, optimize=True,
                        progressive=True, subsampling=1)
                written += 1

        if LIVE and written and written % 20 == 0:
            print(f'  ... {written} written')

    print('')
    if problems:
        print(f'PROBLEMS  {len(problems)} folder(s) did not resolve to one man and one woman:')
        for effect, files in problems:
            print(f'  {effect}: {", ".join(files) if files else "(empty)"}')
        print('')

    if small:
        print(f'BELOW TARGET  {len(small)} source(s) narrower than {WIDTH}px — copied at')
        print(f'              their own size rather than upscaled:')
        for s in small:
            print(f'  {s}')
        print('')

    if LIVE:
        print(f'Done. {written} plates written.')
        if written:
            total = sum(f.stat().st_size for f in OUT_ROOT.rglob('*@2x.jpg'))
            print(f'      {total / 1024 / 1024:.1f} MB total across the gallery.')
    else:
        print(f'Dry run. {skipped} plates would be written.')
        print('Re-run with --live to build them.')


if __name__ == '__main__':
    main()
