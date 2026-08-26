#!/usr/bin/env python3
"""
patch-invite-code-set.py

LITEN_ACCESS_CODE becomes a comma-separated SET of codes. Membership, not
equality - the check CUI warned about at the middleware a week ago, landed
where the check now lives.

WHY TONIGHT: Rich wants his brother on his own passcode (bobhasmorefun)
without waiting for the codes table. The env var carries both:

    LITEN_ACCESS_CODE = letsmakesomefun,bobhasmorefun

Adding a code = edit the var in Vercel + redeploy. Whitespace around
commas is tolerated; empty entries are ignored; matching stays exact and
case-sensitive otherwise.

ATTRIBUTION RIDES ALONG: which code opened the door is written to the
row's meta-free schema the cheap way - launch_invites has a `note` column
(nullable text, confirmed 24 Aug) that nothing writes. The accepted code
goes there, so "who came in on Bob's code" is one WHERE clause. No
migration.

Env absent = open stays, matching local-dev parity.

Dry run by default. --write to write.
"""
import os, sys

PATH = os.path.join('app', 'api', 'v1', 'invite', 'route.ts')

OLD = """    const expected = process.env.LITEN_ACCESS_CODE
    if (expected) {
      const suppliedCode = typeof body?.code === 'string' ? body.code.trim() : ''
      if (suppliedCode !== expected) {
        return NextResponse.json({ ok: false, reason: 'bad_code' }, { status: 403 })
      }
    }"""

NEW = """    /* A SET of codes now, comma-separated in the one env var - membership,
       not equality, so Bob's code and the family code coexist and adding
       another is a var edit plus redeploy, not a deploy of code. Which
       code opened the door lands in the row's `note` column below, so
       attribution is one WHERE clause. Rich, 25 August. */
    const codeSet = (process.env.LITEN_ACCESS_CODE || '')
      .split(',').map(c => c.trim()).filter(Boolean)
    let acceptedCode: string | null = null
    if (codeSet.length) {
      const suppliedCode = typeof body?.code === 'string' ? body.code.trim() : ''
      if (!codeSet.includes(suppliedCode)) {
        return NextResponse.json({ ok: false, reason: 'bad_code' }, { status: 403 })
      }
      acceptedCode = suppliedCode
    }"""

OLD_INSERT = """      credits_granted: within ? GRANT_CREDITS : 0,"""
NEW_INSERT = """      credits_granted: within ? GRANT_CREDITS : 0,
      note: acceptedCode,"""

def main():
    write = '--write' in sys.argv
    if not os.path.exists(PATH):
        raise SystemExit('REFUSED: %s not found. Run from the repo root.' % PATH)
    with open(PATH, 'r', encoding='utf-8', newline='') as f:
        src = f.read()
    eol = '\r\n' if src.count('\r\n') > src.count('\n') - src.count('\r\n') else '\n'
    if 'codeSet' in src:
        raise SystemExit('REFUSED: already a code set. Nothing written.')
    o = OLD.replace('\n', eol)
    if src.count(o) != 1:
        raise SystemExit('REFUSED: code-check anchor not found exactly once. Nothing written.')
    oi = OLD_INSERT.replace('\n', eol)
    if src.count(oi) != 1:
        raise SystemExit('REFUSED: insert anchor not found exactly once. Nothing written.')
    out = src.replace(o, NEW.replace('\n', eol), 1)
    out = out.replace(oi, NEW_INSERT.replace('\n', eol), 1)
    if out.count('codeSet.includes') != 1 or 'note: acceptedCode' not in out:
        raise SystemExit('REFUSED: patch not placed cleanly. Nothing written.')
    print('  %s' % PATH)
    print('  code check is now set membership; accepted code recorded in note')
    print('  %+d bytes' % (len(out) - len(src)))
    if not write:
        print('  DRY RUN. Re-run with --write.')
        return
    with open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write(out)
    print('  WRITTEN. Run: npx tsc --noEmit 2>&1 | findstr /C:"invite"')

if __name__ == '__main__':
    main()
