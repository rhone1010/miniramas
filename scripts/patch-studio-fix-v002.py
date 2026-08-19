#!/usr/bin/env python3
"""
patch-studio-fix-v002.py

  reads   public/wallpaper-studio-V001.html   (never modified)
  writes  public/wallpaper-studio-V002.html

TWO FAULTS, BOTH FROM THE SAME MISTAKE: overriding the properties I was
thinking about rather than the ones that were already there.

1 · THE STEP BARS WRAP ONE WORD PER LINE
    `.step { display:grid; grid-template-columns:98px 1fr }` is still in the
    stylesheet from the design this replaced. My rules added a border to
    `.step` and never touched `display`, so every `.step-bar` has been
    living in a 98px column. The old rule is 130 lines earlier and lost on
    specificity to nothing, because nothing contested it.

    Scoped to `#steps .step` rather than deleting the old rule - it is the
    accordion that needs a block, and anything else still wearing `.step`
    keeps what it had.

2 · THE FIELD LANDS IN THE GAPS
    `inset:var(--pad)` came across from the mockup, where the grid carried
    18px of padding. This one does not: `.grid` is `display:grid; gap:16px`
    with no padding at all. So every mask band starts 18px late and is cut
    18px narrow, which puts the field down the gaps between the cards
    instead of behind them - the thin bright strips at each card's right
    edge.

    The bands are computed from the grid's own box, so the inset has to be
    zero for band one to start where card one starts.

Nothing is deleted and nothing is overwritten. Dry run by default.
"""

import argparse
import re
import sys
from pathlib import Path

SRC = Path('public/wallpaper-studio-V001.html')
STEM = 'wallpaper-studio-V'

# ---- 1 · the accordion is not a two-column grid -------------------------
A_STEP = """.step{
  border-bottom:1px solid rgba(215,189,137,.16);
}
.step:first-child{ border-top:1px solid rgba(215,189,137,.16) }"""

A_STEP_NEW = """/* display:block IS THE LOAD-BEARING LINE. `.step` is declared far above
   this as `display:grid; grid-template-columns:98px 1fr`, which was right
   for the four fixed rows and puts the accordion's bar in a 98px column -
   every title wrapping one word per line, and the body stranded in a
   second column that is empty whenever the step is shut.

   Scoped to #steps so anything else still wearing .step keeps what it
   had. padding and border-top are reset for the same reason: the old rule
   set both, and its border-top under this rule's border-bottom draws
   every divider twice. */
#steps .step{
  display:block;
  padding:0;
  border-top:none;
  border-bottom:1px solid rgba(215,189,137,.16);
}
#steps .step:first-child{ border-top:1px solid rgba(215,189,137,.16) }"""

# ---- 2 · the mask starts where the cards start --------------------------
A_MASK = """.grid.has-scene .scene-field{
  inset:var(--pad);
  --gap:16px;"""

A_MASK_NEW = """.grid.has-scene .scene-field{
  /* ZERO, NOT --pad. The mockup's grid had 18px of padding and this one
     has none - .grid is display:grid with gap:16px and nothing else. An
     18px inset puts every band in the gutter instead of behind a card,
     which reads as a bright seam down the right edge of each. The bands
     are measured from the grid's own box, so band one only lands on card
     one when that box is the box the cards are in. */
  inset:0;
  --gap:16px;"""

# The pad is now referenced by nothing. Left as a declaration would have
# somebody wire it back in.
A_PAD = "  --pad:18px;\n"
A_PAD_NEW = ""

EDITS = [
    ('the accordion step box', A_STEP, A_STEP_NEW),
    ('the mask inset',         A_MASK, A_MASK_NEW),
    ('the dead pad variable',  A_PAD,  A_PAD_NEW),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true')
    args = ap.parse_args()

    if not SRC.exists():
        print(f'MISSING: {SRC}')
        return 1

    raw = SRC.read_bytes()
    crlf = b'\r\n' in raw
    text = raw.decode('utf-8').replace('\r\n', '\n')

    fail = False
    for name, old, _new in EDITS:
        n = text.count(old)
        print(f'ANCHOR {name}: expected 1, found {n}')
        if n != 1:
            fail = True
    if fail:
        print('\nNo write. An anchor did not match exactly once.')
        return 1

    out = text
    for _name, old, new in EDITS:
        out = out.replace(old, new, 1)

    # Delta, not absolute - this file is not brace-balanced to begin with.
    for o, c, label in (('{', '}', 'braces'), ('(', ')', 'parens')):
        if (text.count(o) - text.count(c)) != (out.count(o) - out.count(c)):
            print(f'\nREFUSED: {label} imbalance changed.')
            return 1
    for m in re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', out, re.S):
        if re.search(r'^\s*\.[A-Za-z][\w-]*\s*\{', m.group(1), re.M):
            print('\nREFUSED: a CSS rule ended up inside a <script> block.')
            return 1

    n = 1
    while (SRC.parent / f'{STEM}{n:03d}.html').exists():
        n += 1
    dst = SRC.parent / f'{STEM}{n:03d}.html'

    print(f'\nwould write  {dst}')
    print(f'source       {SRC}  (not modified)')

    if not args.write:
        print('\nDry run. Re-run with --write.')
        return 0

    if crlf:
        out = out.replace('\n', '\r\n')
    dst.write_bytes(out.encode('utf-8'))
    print(f'\nWritten: {dst}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
