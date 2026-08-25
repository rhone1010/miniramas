#!/usr/bin/env python3
"""
patch-invite-sends-link.py

The gate now sends the magic link. One step, not two.

-- THE CONFUSION THIS REMOVES ------------------------------------------------

As built, typing the passcode and an email at the gate recorded the address
and opened the door - and nothing else. Sign-in was a separate, unstated
step: find the masthead button, type the same email again, wait for a link.
Rich hit it himself on the first live test: "did not get a new magic link.
also not signed in."

Now /api/v1/invite ALSO fires the magic link, so walking through the door IS
requesting sign-in. One email arrives; clicking it signs the person in; the
/auth/me claim pays their credits on the first paint.

-- HOW THE LINK IS SENT ------------------------------------------------------

Exactly the way /api/v1/auth/signin sends it: signInWithOtp against the
auth callback. NOT admin.generateLink - that mints a link without sending
mail, and wiring Resend here would be a second email path to keep alive.

ONE DIFFERENCE, deliberate: signin builds a PKCE cookie client because the
BROWSER posts to it and the verifier cookie must land on that browser. The
invite POST comes from the EDGE MIDDLEWARE, fire-and-forget - no browser,
nowhere for a cookie to land. So this uses the anon client with implicit
flow: the emailed link carries its own tokens and needs no verifier waiting
in the browser. The middleware call site does not change at all.

-- ON already:true, THE LINK IS RESENT ---------------------------------------

The same person at the gate in a new browser wants IN, and their old link
is dead or in another inbox. Recording them without resending would strand
exactly the people the gate exists for. Rich approved resend-on-already.

-- WHAT CAN NOW HAPPEN THAT COULD NOT ----------------------------------------

A wrong-but-plausible email typed at the gate now RECEIVES MAIL. Acceptable
at forty invites; worth remembering the day the passcode leaks somewhere
public, because the gate becomes a way to make Supabase mail strangers.
The cap bounds it at forty rows but resends are uncapped by row count -
they are bounded by Supabase's own OTP rate limit per address.

Dry run by default. --write to write. Anchors must match exactly once.
"""
import os, sys

PATH = os.path.join('app', 'api', 'v1', 'invite', 'route.ts')

OLD_IMPORT = "import { createClient } from '@supabase/supabase-js'"
NEW_IMPORT = "import { createClient } from '@supabase/supabase-js'"  # unchanged; anchor only

OLD_ALREADY = """    if (existing) {
      return NextResponse.json({ ok: true, already: true })
    }"""

NEW_ALREADY = """    if (existing) {
      // Same person, new browser - which happens constantly. Their old
      // magic link is dead or in another tab's inbox, so RESEND rather
      // than strand them. Supabase's own per-address OTP rate limit is
      // the flood control.
      const sent = await sendMagicLink(email, req)
      return NextResponse.json({ ok: true, already: true, link_sent: sent })
    }"""

OLD_RETURN = """    return NextResponse.json({ ok: true, granted: within ? GRANT_CREDITS : 0 })"""

NEW_RETURN = """    // The door and the sign-in are ONE step. The link goes out from here,
    // so nobody has to discover the masthead button and type the same
    // address twice - Rich hit that himself on the first live test.
    const sent = await sendMagicLink(email, req)

    return NextResponse.json({
      ok: true,
      granted: within ? GRANT_CREDITS : 0,
      link_sent: sent,
    })"""

TAIL_MARK = "export async function GET()"

HELPER = """/**
 * Sends the magic link, the same way /api/v1/auth/signin does - with one
 * deliberate difference. Signin runs a PKCE cookie client because the
 * browser posts to it and the verifier cookie lands on that browser. THIS
 * route is called by the edge middleware, fire-and-forget: no browser is
 * attached, so a verifier cookie would be set on a response nobody keeps.
 * The anon client's implicit flow sends a link that carries its own tokens
 * instead.
 *
 * Failure here must never close the door: somebody with the right passcode
 * gets in whether or not the mail went out. The response says link_sent so
 * the glass can tell them to check their inbox - or to use the masthead
 * sign-in if it could not be sent.
 */
async function sendMagicLink(email: string, req: Request): Promise<boolean> {
  try {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) return false

    const auth = createClient(url, anon, { auth: { persistSession: false } })
    const origin = new URL(req.url).origin
    const { error } = await auth.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback?next=%2F` },
    })
    if (error) {
      console.warn('[invite] magic link failed:', error.message)
      return false
    }
    return true
  } catch (e: any) {
    console.warn('[invite] magic link threw:', e?.message || e)
    return false
  }
}

"""


def main():
    write = '--write' in sys.argv
    if not os.path.exists(PATH):
        raise SystemExit('REFUSED: %s not found. Run from the repo root.' % PATH)
    with open(PATH, 'r', encoding='utf-8', newline='') as f:
        src = f.read()
    eol = '\r\n' if src.count('\r\n') > src.count('\n') - src.count('\r\n') else '\n'

    if 'sendMagicLink' in src:
        raise SystemExit('REFUSED: already patched. Nothing written.')

    anchors = [
        ('import', OLD_IMPORT),
        ('already branch', OLD_ALREADY.replace('\n', eol)),
        ('grant return', OLD_RETURN),
        ('GET marker', TAIL_MARK),
    ]
    for name, a in anchors:
        n = src.count(a)
        if n != 1:
            raise SystemExit('REFUSED: anchor "%s" appears %d times, expected 1. Nothing written.' % (name, n))

    out = src
    out = out.replace(OLD_ALREADY.replace('\n', eol), NEW_ALREADY.replace('\n', eol), 1)
    out = out.replace(OLD_RETURN, NEW_RETURN.replace('\n', eol), 1)

    # Helper goes just above the GET, at the bottom of the POST world.
    i = out.index(TAIL_MARK)
    # back up past the comment block that precedes GET
    block_start = out.rfind('/**', 0, i)
    insert_at = block_start if block_start != -1 else i
    out = out[:insert_at] + HELPER.replace('\n', eol) + out[insert_at:]

    if out.count('sendMagicLink') != 3:  # helper def + two call sites
        raise SystemExit('REFUSED: expected 3 sendMagicLink mentions, found %d. Nothing written.'
                         % out.count('sendMagicLink'))

    print('  %s' % PATH)
    print('  link sent on new invite AND on already:true; helper added')
    print('  %+d bytes' % (len(out) - len(src)))
    if not write:
        print('  DRY RUN. Nothing written. Re-run with --write.')
        return
    with open(PATH, 'w', encoding='utf-8', newline='') as f:
        f.write(out)
    print('  WRITTEN.')
    print('  Run: npx tsc --noEmit 2>&1 | findstr /C:"invite"')


if __name__ == '__main__':
    main()
