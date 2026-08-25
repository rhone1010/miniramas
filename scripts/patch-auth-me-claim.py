#!/usr/bin/env python3
"""
patch-auth-me-claim.py

Hooks claimLaunchGrant() into /api/v1/auth/me, and updates the header that
says the route never grants - because now it does, once, for invited
people.

WHY HERE. The claim must fire however somebody arrives signed in - magic
link, restored session, an old browser. /auth/me is the read every surface
makes on boot. Hooking it makes the grant self-healing.

ORDER MATTERS: the claim runs BEFORE the balance read, so the very first
/auth/me an invited person ever makes already shows their 50 in the
masthead - not zero until refresh.

Dry run by default. --write to write. Anchors must match exactly once.
"""
import os, sys

PATH = os.path.join('app', 'api', 'v1', 'auth', 'me', 'route.ts')

OLD_IMPORT = "import { supabaseAdmin } from '@/lib/supabase'"
NEW_IMPORT = ("import { supabaseAdmin } from '@/lib/supabase'\n"
              "import { claimLaunchGrant } from '@/lib/v1/launch/claim-grant'")

OLD_HDR = ("//   READ ONLY. Nothing here spends, grants, or reconciles. credit_balances\n"
           "//   is maintained by the RPCs; this only looks at it.")
NEW_HDR = ("//   ONE EXCEPTION TO READ-ONLY, 2026-08-24: the launch grant is claimed\n"
           "//   here. /api/v1/invite records a promise against an email; its header\n"
           "//   said claimLaunchGrant() pays it on first sign-in, and that function\n"
           "//   was never written - every invited person signed in to zero. This is\n"
           "//   the read every surface makes on boot, so claiming here makes the\n"
           "//   grant self-healing and shows the credits on the very first paint.\n"
           "//   Idempotent by ledger ref (invite_<email>); nothing else writes.")

OLD_BAL = "  let credits: number | null = null"
NEW_BAL = ("  // The claim runs before the read, so an invited person's first ever\n"
           "  // /auth/me already answers with their grant in the balance.\n"
           "  await claimLaunchGrant(supabaseAdmin, user)\n"
           "\n"
           "  let credits: number | null = null")

def main():
    write = '--write' in sys.argv
    if not os.path.exists(PATH):
        raise SystemExit('REFUSED: %s not found. Run from the repo root.' % PATH)
    with open(PATH, 'r', encoding='utf-8', newline='') as f:
        src = f.read()
    eol = '\r\n' if src.count('\r\n') > src.count('\n') - src.count('\r\n') else '\n'
    if 'claimLaunchGrant' in src:
        raise SystemExit('REFUSED: already hooked. Nothing written.')
    for name, a in (('import', OLD_IMPORT), ('header', OLD_HDR.replace('\n', eol)),
                    ('balance line', OLD_BAL)):
        if src.count(a) != 1:
            raise SystemExit('REFUSED: anchor "%s" not found exactly once. Nothing written.' % name)
    out = src.replace(OLD_IMPORT, NEW_IMPORT.replace('\n', eol), 1)
    out = out.replace(OLD_HDR.replace('\n', eol), NEW_HDR.replace('\n', eol), 1)
    out = out.replace(OLD_BAL, NEW_BAL.replace('\n', eol), 1)
    # import + header mention + call site
    if out.count('claimLaunchGrant') != 3:
        raise SystemExit('REFUSED: hook not placed cleanly. Nothing written.')
    print('  %s' % PATH)
    print('  import added, header corrected, claim placed before the balance read')
    print('  %+d bytes' % (len(out) - len(src)))
    if not write:
        print('  DRY RUN. Nothing written. Re-run with --write.')
        return
    with open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write(out)
    print('  WRITTEN.')
    print('  Run: npx tsc --noEmit 2>&1 | findstr /C:"auth/me"')

if __name__ == '__main__':
    main()
