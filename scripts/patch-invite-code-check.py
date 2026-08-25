#!/usr/bin/env python3
"""
patch-invite-code-check.py

/api/v1/invite verifies the passcode itself. Ships in the SAME PR as the
open-doors middleware, and the ordering is the whole point:

The route has never checked the passcode - it trusted the middleware wall,
which only forwarded emails after verifying ?access= itself. The wall is
coming off in this PR. Without this check, the moment that deploys, ANY
POST with an email gets recorded, granted 50 credits, and mailed a magic
link. The endpoint is guessable and the grant is money.

The check: `code` field in the body, compared to LITEN_ACCESS_CODE
server-side. Wrong or missing answers { ok:false, reason:'bad_code' } 403
and records NOTHING - no row, no mail. The glass shows it plainly at the
sign-in card and the person fixes or clears the field.

ENV ABSENT = OPEN, deliberately: the old middleware ran gate-off when
LITEN_ACCESS_CODE was unset ("Local dev stays open"), and this preserves
that parity - local dev grants without a code. Production has the var set;
it was reset to letsmakesomefun on 24 August.

Dry run by default. --write to write.
"""
import os, sys

PATH = os.path.join('app', 'api', 'v1', 'invite', 'route.ts')

OLD = """    const email = clean(body?.email)
    if (!email) {
      return NextResponse.json({ ok: false, reason: 'bad_email' }, { status: 400 })
    }"""

NEW = """    const email = clean(body?.email)
    if (!email) {
      return NextResponse.json({ ok: false, reason: 'bad_email' }, { status: 400 })
    }

    /* THE PASSCODE IS CHECKED HERE NOW, NOT AT A WALL. Until 25 August the
       middleware gated the whole site and only forwarded emails it had
       already verified ?access= for. The wall is gone - the site is open,
       and this endpoint is reachable by anyone. The code is the coupon
       that makes an invite worth 50 credits, so the coupon is verified
       where it is redeemed.

       Wrong or missing records NOTHING - no row, no mail. bad_code is the
       glass's cue to let the person fix or clear the field; it must never
       block plain sign-in, which does not come through here.

       Env absent = open, matching the old middleware's gate-off behaviour
       so local dev still works without secrets. */
    const expected = process.env.LITEN_ACCESS_CODE
    if (expected) {
      const suppliedCode = typeof body?.code === 'string' ? body.code.trim() : ''
      if (suppliedCode !== expected) {
        return NextResponse.json({ ok: false, reason: 'bad_code' }, { status: 403 })
      }
    }"""

def main():
    write = '--write' in sys.argv
    if not os.path.exists(PATH):
        raise SystemExit('REFUSED: %s not found. Run from the repo root.' % PATH)
    with open(PATH, 'r', encoding='utf-8', newline='') as f:
        src = f.read()
    eol = '\r\n' if src.count('\r\n') > src.count('\n') - src.count('\r\n') else '\n'
    if 'bad_code' in src:
        raise SystemExit('REFUSED: code check already present. Nothing written.')
    o = OLD.replace('\n', eol)
    if src.count(o) != 1:
        raise SystemExit('REFUSED: anchor not found exactly once. Nothing written.')
    out = src.replace(o, NEW.replace('\n', eol), 1)
    if out.count('bad_code') != 2:  # comment + return
        raise SystemExit('REFUSED: check not placed cleanly. Nothing written.')
    print('  %s' % PATH)
    print('  passcode verified server-side; bad_code 403 records nothing')
    print('  %+d bytes' % (len(out) - len(src)))
    if not write:
        print('  DRY RUN. Re-run with --write.')
        return
    with open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write(out)
    print('  WRITTEN. Run: npx tsc --noEmit 2>&1 | findstr /C:"invite"')

if __name__ == '__main__':
    main()
