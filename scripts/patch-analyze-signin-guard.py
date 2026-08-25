#!/usr/bin/env python3
"""
patch-analyze-signin-guard.py

Every analyze route refuses unsigned callers. Seven files, one guard.

-- THE RULING ----------------------------------------------------------------

Rich, 25 August, on whether analyze stays open as a tease or gates with
everything else: "we want to keep things connected. moment of intent
becomes the moment of capture."

Upload IS analyze. The person who uploads a photograph has arrived at the
moment of intent, and that is where the account begins - not later at the
craft. The Curator works for people who have given an email; the
try-before-signing tease is dead deliberately, as posture rather than
oversight.

-- WHAT THIS CLOSES ----------------------------------------------------------

The site opened to the public this morning (PR #86) and a sweep found
not_signed_in on exactly three routes - the money ones. Every analyze
route answered anybody: each call a vision-model bill with no account
behind it. An open compute tap on a public site, and also a glass gate
with no engine backstop - the upload card catches 401s, and no analyze
route sent one.

-- THE GUARD -----------------------------------------------------------------

The house pattern, verbatim from the money routes: getUser, null answers
{ ok:false, reason:'not_signed_in' } 401. The glass upload card is built
on exactly this answer.

GENERATE ROUTES ARE DELIBERATELY NOT TOUCHED. A craft cannot spend
without the gate, which already refuses unsigned - the analyze family was
the unguarded surface, and one patch with one job is auditable.

Idempotent per file: a route already carrying not_signed_in is reported
and skipped, never double-guarded.

USAGE (from the repo root)
  python scripts/patch-analyze-signin-guard.py          dry run
  python scripts/patch-analyze-signin-guard.py --write
"""
import os, sys

FILES = [
    os.path.join('app', 'api', 'v1', p, 'analyze', 'route.ts')
    for p in ['portraits', 'groups', 'pets', 'moments', 'sportsmem', 'actionmini', 'global']
]

POST_ANCHOR = 'export async function POST(req: NextRequest) {'
IMPORT_NEEDLE = "from 'next/server'"

IMPORT_LINE = "import { getUser } from '@/lib/store/auth'"

GUARD = """  /* THE MOMENT OF INTENT IS THE MOMENT OF CAPTURE. Rich, 25 August.
     Upload is analyze, and analyze is where the account begins - the site
     is public now and this was an open vision-model tap with no account
     behind it. Same answer the money routes give; the glass upload card
     is built on catching exactly this 401. */
  const authedUser = await getUser().catch(() => null)
  if (!authedUser) {
    return NextResponse.json({ ok: false, reason: 'not_signed_in' }, { status: 401 })
  }

"""

def eol_of(s):
    return '\r\n' if s.count('\r\n') > s.count('\n') - s.count('\r\n') else '\n'

def main():
    write = '--write' in sys.argv
    patched, skipped, refused = [], [], []

    for path in FILES:
        if not os.path.exists(path):
            refused.append((path, 'missing'))
            continue
        with open(path, 'r', encoding='utf-8', newline='') as f:
            src = f.read()
        eol = eol_of(src)

        if 'not_signed_in' in src:
            skipped.append(path)
            continue
        if src.count(POST_ANCHOR) != 1:
            refused.append((path, 'POST anchor not found exactly once'))
            continue
        if IMPORT_NEEDLE not in src:
            refused.append((path, 'next/server import not found'))
            continue
        if 'NextResponse' not in src:
            refused.append((path, 'NextResponse not imported'))
            continue
        if 'getUser' in src:
            refused.append((path, 'getUser already present in another role'))
            continue

        # Import: after the last existing import line.
        lines = src.split(eol)
        last_import = max(i for i, l in enumerate(lines) if l.startswith('import '))
        lines.insert(last_import + 1, IMPORT_LINE)
        out = eol.join(lines)

        # Guard: immediately inside POST.
        out = out.replace(POST_ANCHOR, POST_ANCHOR + eol + GUARD.replace('\n', eol), 1)

        if out.count('not_signed_in') != 1:  # the guard's return
            refused.append((path, 'guard not placed cleanly'))
            continue

        patched.append((path, len(out) - len(src)))
        if write:
            with open(path, 'w', encoding='utf-8', newline='') as f:
                f.write(out)

    print('')
    for p, d in patched:
        print('  %s   %-52s %+d bytes' % ('WROTE ' if write else 'would ', p, d))
    for p in skipped:
        print('  skip    %-52s already guarded' % p)
    for p, why in refused:
        print('  REFUSED %-52s %s' % (p, why))
    print('')
    print('  %d to patch, %d already guarded, %d refused'
          % (len(patched), len(skipped), len(refused)))
    if refused:
        print('  Refusals patch NOTHING in their file - read the reason, upload the live file if it drifted.')
    if not write:
        print('  DRY RUN. Re-run with --write.')
    else:
        print('  Run: npx tsc --noEmit 2>&1 | findstr /C:"analyze"')

if __name__ == '__main__':
    main()
