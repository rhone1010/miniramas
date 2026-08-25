#!/usr/bin/env python3
"""
patch-claim-ref-unify.py

One grant, one name. The /auth/me claim adopts `launch:<email>` as its
ledger ref, matching /api/v1/invite/claim.

-- THE DOUBLE-PAY THIS CLOSES ------------------------------------------------

Two claim paths existed with two different refs for the same person:

    /api/v1/invite/claim      p_ref = launch:<email>     (glass calls it)
    /auth/me via claim-grant  p_ref = invite_<email>     (self-healing)

grant_credits is idempotent BY REF. Different refs are different grants: the
same person could be paid twice, 100 credits instead of 50. The only thing
preventing it in practice was the claimed_at stamp each path checks - which
is advisory and racy, not atomic. Two requests on a fresh sign-in could
each pass the stamp check and each pay their own ref.

With one ref, the RPC itself is the lock - the second payer, whichever path
it is, finds the ledger row and returns the balance unchanged. That is the
guarantee grant_credits was built to give, and two ref shapes were
squandering it.

-- WHY launch: WINS ----------------------------------------------------------

The older route's shape. Any pre-existing launch: rows in the wild already
block re-pay under the unified name; adopting invite_ instead would let
every one of those people be paid a second time by the older route. As of
25 August the live ledger holds two rows, both invite_ (Rich's two test
accounts, each correctly paid once) - they remain as history and block
nothing, because both accounts are already stamped claimed_at.

Dry run by default. --write to write.
"""
import os, sys

PATH = os.path.join('lib', 'v1', 'launch', 'claim-grant.ts')

OLD = "        p_ref:    `invite_${email}`,"
NEW = ("        // launch:<email> - THE SAME REF /api/v1/invite/claim USES. Two\n"
       "        // claim paths write this grant, and the ref being identical is\n"
       "        // what makes grant_credits the lock between them. Do not rename\n"
       "        // one without the other.\n"
       "        p_ref:    `launch:${email}`,")

def main():
    write = '--write' in sys.argv
    if not os.path.exists(PATH):
        raise SystemExit('REFUSED: %s not found. Run from the repo root.' % PATH)
    with open(PATH, 'r', encoding='utf-8', newline='') as f:
        src = f.read()
    eol = '\r\n' if src.count('\r\n') > src.count('\n') - src.count('\r\n') else '\n'
    if 'launch:${email}' in src:
        raise SystemExit('REFUSED: already unified. Nothing written.')
    if src.count(OLD) != 1:
        raise SystemExit('REFUSED: ref anchor not found exactly once. Nothing written.')
    out = src.replace(OLD, NEW.replace('\n', eol), 1)
    if out.count('launch:${email}') != 1 or 'invite_${email}' in out:
        raise SystemExit('REFUSED: ref not changed cleanly. Nothing written.')
    print('  %s' % PATH)
    print('  ref invite_<email> -> launch:<email>, matching /api/v1/invite/claim')
    if not write:
        print('  DRY RUN. Re-run with --write.')
        return
    with open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write(out)
    print('  WRITTEN. Run: npx tsc --noEmit 2>&1 | findstr /C:"claim-grant"')

if __name__ == '__main__':
    main()
