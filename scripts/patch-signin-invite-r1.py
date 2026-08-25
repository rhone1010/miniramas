#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-signin-invite-r1.py  -  CUI 41A  -  25 August 2026

OPEN DOORS, GLASS SIDE - per CENG's spec of this morning and Rich's
rulings: browse free, account at the moment of intent, passcode becomes
an optional coupon worth 50 credits.

This patch is the sign-in card work, prototyped on portraits:

  A  The card gains an OPTIONAL invite-code field. Empty, nothing
     changes. Filled, the code is posted to /api/v1/invite with the
     email BEFORE the sign-in link is sent; a bad code is said plainly
     and the send halts so they can fix or clear it - clearing it and
     sending again proceeds, so the code never blocks sign-in.

  B  The grant announcement stops hardcoding "eight pictures". It now
     counts from what the server actually granted - fifty credits reads
     "five pictures". The engine's number is the only number.

  C  launch_grant rows in the account ledger get a label. DRAFT:
     "Welcome credits" - the word is Rich's to replace.

  DRAFT copy in this patch, all for Rich's eye:
     - the invite field label "Have an invite code? 50 credits on us"
     - the bad-code line "That code is not one of ours. Fix it or
       clear the field and the link will still come."
     - the ledger label "Welcome credits"

Applies to portraits.html first; the same edits replicate to the other
rooms once their fresh files arrive.
"""
import os, sys, io

FILES = ["portraits.html"]

EDITS = [

("A1. the field, under the email",
 """      <input class="signin-in" id="signinEmail" type="email" autocomplete="email"
             placeholder="you@example.com" spellcheck="false">
      <div class="signin-err" id="signinErr"></div>""",
 """      <input class="signin-in" id="signinEmail" type="email" autocomplete="email"
             placeholder="you@example.com" spellcheck="false">
      <!-- CUI 41A, 25 Aug 2026. The coupon, not the wall. Optional; an
           empty field is the common case and costs nothing. DRAFT copy. -->
      <label class="signin-lbl signin-lbl-opt" for="signinCode">Have an invite code?
        <span class="signin-opt">50 credits on us &middot; optional</span></label>
      <input class="signin-in" id="signinCode" type="text" autocomplete="off"
             autocapitalize="characters" spellcheck="false" placeholder="">
      <div class="signin-err" id="signinErr"></div>"""),

("A2. the field's clothes",
 ".signin-err{",
 """.signin-lbl-opt{ margin-top:14px }
.signin-opt{ font-style:italic; color:var(--ink-soft); font-weight:400 }
.signin-err{"""),

("A3. the code rides ahead of the link",
 """    signinSend.disabled = true;
    signinSend.textContent = 'Sending';
    if (signinErr) signinErr.textContent = '';

    /* Held BEFORE the request. If the send succeeds they may leave for their
       inbox within seconds, and on another device the tab never runs again. */
    saveResume();

    fetch(AUTH_SIGNIN_URL, {""",
 """    signinSend.disabled = true;
    signinSend.textContent = 'Sending';
    if (signinErr) signinErr.textContent = '';

    /* CUI 41A, 25 Aug 2026. A filled code goes to /api/v1/invite first,
       so the 50 credits are waiting when the link lands. A bad code is
       said plainly and the send halts - fix it or clear it; an empty
       field never blocks the link. The route checks the code itself
       server-side, so nothing here is trusted with an amount. */
    var codeEl = document.getElementById('signinCode');
    var inviteCode = codeEl ? codeEl.value.trim() : '';
    if (inviteCode){
      signinSend.textContent = 'Checking the code';
      fetch('/api/v1/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email: email, code: inviteCode })
      }).then(function(res){
        return res.json().catch(function(){ return { ok:false }; });
      }).then(function(d){
        if (d && d.ok){ reallySend(email); return; }
        signinSend.disabled = false;
        signinSend.textContent = 'Send the link';
        if (signinErr) signinErr.textContent =
          'That code is not one of ours. Fix it or clear the field and the link will still come.';
      }).catch(function(){
        signinSend.disabled = false;
        signinSend.textContent = 'Send the link';
        if (signinErr) signinErr.textContent =
          'The code could not be checked just now. Clear it to sign in without it.';
      });
      return;
    }
    reallySend(email);
  }

  function reallySend(email){
    signinSend.textContent = 'Sending';

    /* Held BEFORE the request. If the send succeeds they may leave for their
       inbox within seconds, and on another device the tab never runs again. */
    saveResume();

    fetch(AUTH_SIGNIN_URL, {"""),

("B . the announcement counts what was granted",
 """          say('<span class="line">Welcome. I\\u2019ve put <b>' + d.credits +
              ' credits</b> in your account \\u2014 enough for eight ' +
              'pictures. Start with a photograph.</span>' +
              '<span class="sign">\\u2014 C.</span>');""",
 """          /* The engine's number is the only number. Fifty credits at ten
             a piece reads "five pictures"; whatever is granted, the words
             follow it. CUI 41A, 25 Aug 2026. */
          var pieces = Math.max(1, Math.floor(d.credits / 10));
          var W = ['','one','two','three','four','five','six','seven','eight','nine','ten'];
          var pw = W[pieces] || String(pieces);
          say('<span class="line">Welcome. I\\u2019ve put <b>' + d.credits +
              ' credits</b> in your account \\u2014 enough for ' + pw +
              ' picture' + (pieces === 1 ? '' : 's') +
              '. Start with a photograph.</span>' +
              '<span class="sign">\\u2014 C.</span>');"""),

("C . the ledger learns the grant's name",
 """  var AC_REASON = {
    purchase: 'Credits bought',
    craft:    'A piece crafted',
    refund:   'Returned',
    grant:    'Granted',
    admin:    'Adjusted by the studio'
  };""",
 """  var AC_REASON = {
    purchase: 'Credits bought',
    craft:    'A piece crafted',
    refund:   'Returned',
    grant:    'Granted',
    launch_grant: 'Welcome credits',   /* DRAFT - the word is Rich's */
    admin:    'Adjusted by the studio'
  };"""),
]

MUST_APPEAR = [
    'id="signinCode"',
    "function reallySend(email){",
    "JSON.stringify({ email: email, code: inviteCode })",
    "var pieces = Math.max(1, Math.floor(d.credits / 10));",
    "launch_grant: 'Welcome credits'",
]
MUST_VANISH = [
    "enough for eight ",
]

def normalise(s): return s.replace("\r\n", "\n").replace("\r", "\n")

def run(src_dir, out_dir, apply):
    ok = True
    for name in FILES:
        src = os.path.join(src_dir, name)
        print("\n" + "="*66 + "\n" + name + "\n" + "="*66)
        if not os.path.isfile(src): print("  REFUSED: not found"); ok=False; continue
        text = normalise(io.open(src,"rb").read().decode("utf-8"))
        before = len(text)
        halt = False
        for label, old, new in EDITS:
            n = text.count(old)
            if n != 1:
                if new in text: print("  REFUSED: already applied -- %s" % label)
                else: print("  REFUSED: anchor %d times -- %s" % (n, label))
                halt = True
        if halt: ok=False; continue
        for label, old, new in EDITS:
            text = text.replace(old, new, 1)
            print("  ok   %s" % label)
        for s in MUST_APPEAR:
            if s not in text: print("  REFUSED: missing -- %s" % s); halt=True
        for s in MUST_VANISH:
            if s in text: print("  REFUSED: still present -- %s" % s); halt=True
        if halt: ok=False; continue
        print("  %d -> %d (+%d)" % (before, len(text), len(text)-before))
        if apply:
            io.open(os.path.join(out_dir,name),"w",encoding="utf-8",newline="\n").write(text)
            print("  WROTE %s" % os.path.join(out_dir,name))
        else: print("  DRY RUN -- nothing written")
    print("\n" + ("All files clean." if ok else "ONE OR MORE FILES REFUSED."))
    return 0 if ok else 1

if __name__ == "__main__":
    apply = "--apply" in sys.argv
    home = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)
    out_dir = os.path.join(home,"Downloads"); src_dir = ""
    for a in sys.argv[1:]:
        if a.startswith("--src="): src_dir=a[6:]
        if a.startswith("--out="): out_dir=a[6:]
    if not src_dir: src_dir = os.path.join(repo,"public")
    if not os.path.isdir(src_dir): print("REFUSED: install to scripts\\ first."); sys.exit(1)
    print("\nreading  %s\nwriting  %s" % (src_dir, out_dir))
    sys.exit(run(src_dir, out_dir, apply))
