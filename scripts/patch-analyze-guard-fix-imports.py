#!/usr/bin/env python3
"""
patch-analyze-guard-fix-imports.py

Repairs the import misplacement from patch-analyze-signin-guard.py.

THE BUG, MINE: that patch inserted the getUser import "after the last line
starting with 'import '". A multi-line import's OPENING LINE is `import {`
- it starts with 'import ' and the insertion landed INSIDE the braces:

    import {
    import { getUser } from '@/lib/store/auth'    <- syntax error
      groupsCreditCost,

The simulation passed because the project-knowledge copies had single-line
imports where the live files have multi-line - the exact staleness the
governance docs warn about, caught this time by the build instead of a
customer.

THE REPAIR: wherever the getUser import line sits directly below a bare
`import {` opener, move it above that opener. Files where it landed
legally are recognised and skipped.

USAGE (repo root)
  python scripts/patch-analyze-guard-fix-imports.py          dry run
  python scripts/patch-analyze-guard-fix-imports.py --write
"""
import os, sys

FILES = [
    os.path.join('app', 'api', 'v1', p, 'analyze', 'route.ts')
    for p in ['portraits', 'groups', 'pets', 'moments', 'sportsmem', 'actionmini', 'global']
]

NEEDLE = "import { getUser } from '@/lib/store/auth'"

def eol_of(s):
    return '\r\n' if s.count('\r\n') > s.count('\n') - s.count('\r\n') else '\n'

def main():
    write = '--write' in sys.argv
    fixed, fine, refused = [], [], []

    for path in FILES:
        if not os.path.exists(path):
            refused.append((path, 'missing')); continue
        with open(path, 'r', encoding='utf-8', newline='') as f:
            src = f.read()
        eol = eol_of(src)
        lines = src.split(eol)

        idxs = [i for i, l in enumerate(lines) if l.strip() == NEEDLE]
        if len(idxs) != 1:
            refused.append((path, 'getUser import found %d times, expected 1' % len(idxs)))
            continue
        i = idxs[0]

        prev = lines[i - 1].strip() if i > 0 else ''
        if prev != 'import {':
            fine.append(path)          # landed after a complete import; legal
            continue

        # Move the needle line above the multi-line opener.
        del lines[i]
        lines.insert(i - 1, NEEDLE)
        out = eol.join(lines)

        # The opener must now be directly followed by its original members.
        j = lines.index(NEEDLE)
        if lines[j + 1].strip() != 'import {':
            refused.append((path, 'repair produced unexpected shape'))
            continue

        fixed.append(path)
        if write:
            with open(path, 'w', encoding='utf-8', newline='') as f:
                f.write(out)

    print('')
    for p in fixed:   print('  %s   %s' % ('FIXED ' if write else 'would ', p))
    for p in fine:    print('  ok      %s (import placed legally)' % p)
    for p, w in refused: print('  REFUSED %s - %s' % (p, w))
    print('')
    print('  %d to fix, %d fine, %d refused' % (len(fixed), len(fine), len(refused)))
    if not write:
        print('  DRY RUN. Re-run with --write.')
    else:
        print('  Run: npx tsc --noEmit 2>&1 | findstr /C:"analyze"')

if __name__ == '__main__':
    main()
