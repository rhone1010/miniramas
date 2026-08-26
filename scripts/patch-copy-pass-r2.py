#!/usr/bin/env python3
# patch-copy-pass-r2.py - CUI 42 - 25 August 2026. Lane: D:\lanes\cui42
# Reads <repo>\public\<page> x6 -> writes %USERPROFILE%\Downloads\<page>
#
# Rich's locked copy, 25 Aug, applied where the surfaces already exist:
#
#  C1  Invalid code   -> "That code wasn't recognised. Check it, or leave
#                        it blank and come in anyway."
#  C2  Code check down-> keeps the clear-it escape, reworded to match.
#  C3  Valid code     -> sent state gains "You're in. 50 credits have
#                        been added to your account." (already:true gets
#                        "That invite has already been used. You can
#                        still come in." - both are success)
#  C4  Link sent      -> spam line: "It can take a few minutes to
#                        arrive, and do check your spam folder; some
#                        mailboxes are suspicious of new friends."
#  C5  Ledger labels  -> launch_grant "Welcome credits" (draft made
#                        final), + invite_grant, wallpapers, purchase,
#                        creation added. 'craft' key keeps its shipped
#                        label - flagged, not changed.
#
# Surfaces Rich wrote copy for that DO NOT exist in these pages (low
# credits, empty favourites, purchase history, processing states) are NOT
# invented here - they are listed in the run report for a build decision.

import os, sys

FILES = ['portraits.html', 'groups.html', 'halloween.html',
         'pets.html', 'pets-chooser.html', 'pets-halloween.html']
MARK = 'CUI 42 \u00b7 copy pass r2 \u00b7 2026-08-25'
R1 = 'CUI 42 \u00b7 copy pass \u00b7 2026-08-25'

HERE = os.path.dirname(os.path.abspath(__file__))
repo = HERE
while repo and not os.path.isdir(os.path.join(repo, 'public')):
    p = os.path.dirname(repo)
    if p == repo: break
    repo = p
OUTDIR = os.path.join(os.path.expanduser('~'), 'Downloads')

EDITS = [
('C1+C3 invite result copy',
'''        if (d && d.ok){
          /* The invite route has ALREADY sent the sign-in link - CENG's
             contract, 25 Aug 2026. Calling reallySend() here as well
             fired the signin POST on top and mailed every invited
             person twice. The sent state shows directly; already:true
             is the same link going again, also success. Resume is held
             because they are about to leave for their inbox.
             CUI 42 \u00b7 open doors glass \u00b7 2026-08-25 */
          saveResume();
          signinSend.disabled = false;
          signinSend.textContent = 'Send the link';
          if (signinAddr) signinAddr.textContent = email;
          if (signinAsk)  signinAsk.hidden  = true;
          if (signinSent) signinSent.hidden = false;
          return;
        }
        signinSend.disabled = false;
        signinSend.textContent = 'Send the link';
        if (signinErr) signinErr.textContent =
          'That code is not one of ours. Fix it or clear the field and the link will still come.';''',
'''        if (d && d.ok){
          /* The invite route has ALREADY sent the sign-in link - CENG's
             contract, 25 Aug 2026; the sent state shows directly, no
             second POST. Copy is Rich's locked pass \u00b7 ''' + MARK + ''' */
          saveResume();
          signinSend.disabled = false;
          signinSend.textContent = 'Send the link';
          if (signinAddr) signinAddr.textContent = email;
          if (signinAsk)  signinAsk.hidden  = true;
          if (signinSent) signinSent.hidden = false;
          var okLine = d.already
            ? 'You\\u2019re already on the list \\u2014 we\\u2019ve sent you a fresh link.'
            : 'You\\u2019re in. 50 credits have been added to your account.';
          var sentSay = signinSent ? signinSent.querySelector('.m-say') : null;
          if (sentSay){
            var codeNote = document.createElement('div');
            codeNote.className = 'signin-codenote';
            codeNote.textContent = okLine;
            sentSay.parentNode.insertBefore(codeNote, sentSay);
          }
          return;
        }
        signinSend.disabled = false;
        signinSend.textContent = 'Send the link';
        if (signinErr) signinErr.textContent =
          'That code wasn\\u2019t recognised. Check it, or leave it blank and come in anyway.';'''),

('C2 code check failed',
'''          'The code could not be checked just now. Clear it to sign in without it.';''',
'''          'The code couldn\\u2019t be checked just now. Leave it blank and come in anyway.';'''),

('C4 spam line on sent state',
'''      <div class="m-say">The link is on its way to <b id="signinAddr"></b>.''',
'''      <div class="m-say">The link is on its way to <b id="signinAddr"></b>.
        It can take a few minutes to arrive, and do check your spam folder;
        some mailboxes are suspicious of new friends.'''),

('C5 ledger labels',
'''    launch_grant: 'Welcome credits',   /* DRAFT - the word is Rich's */''',
'''    /* Rich's locked labels against the REAL reason set, per the engine
       correction of 25 Aug: craft, purchase, refund, launch_grant,
       wallpapers, code, grant, recraft. \u00b7 ''' + MARK + ''' */
    launch_grant: 'Welcome credits',
    wallpapers:   'Wallpapers',
    purchase:     'Credit purchase',
    code:         'Code redeemed',
    recraft:      'Crafted again','''),

('C6 existing labels re-keyed to the locked pass',
'''    craft:    'A piece crafted',
    refund:   'Returned',
    grant:    'Granted',''',
'''    craft:    'Creation',
    refund:   'Credits returned',
    grant:    'Studio credit','''),
]

wrote, skipped = [], []
for name in FILES:
    src = os.path.join(repo, 'public', name)
    if not os.path.isfile(src):
        skipped.append((name, ['file not found: ' + src])); continue
    text = open(src, 'rb').read().decode('utf-8')
    crlf = '\r\n' in text
    nl = (lambda s: s.replace('\n', '\r\n')) if crlf else (lambda s: s)
    if MARK in text or R1 in text:
        skipped.append((name, ['a copy pass is already applied'])); continue
    errs = []
    for ename, old, new in EDITS:
        c = text.count(nl(old))
        if c != 1: errs.append(ename + ': anchor count ' + str(c) + ', must be 1')
    if errs:
        skipped.append((name, errs)); continue
    for ename, old, new in EDITS:
        text = text.replace(nl(old), nl(new), 1)
    text = text.replace(nl('<!DOCTYPE html>'),
                        nl('<!DOCTYPE html>\n<!-- ' + MARK + ' -->'), 1)
    for want in ["recognised", "suspicious of new friends", "Code redeemed",
                 "already on the list"]:
        if want not in text: errs.append('post-verify missing: ' + want)
    if errs:
        skipped.append((name, errs)); continue
    out = os.path.join(OUTDIR, name)
    os.makedirs(OUTDIR, exist_ok=True)
    open(out, 'wb').write(text.encode('utf-8'))
    wrote.append((name, os.path.getsize(out)))

print('')
for n, b in wrote: print('[COPY] wrote ' + n + '  (' + str(b) + ' bytes)')
for n, es in skipped:
    print('[COPY] SKIPPED ' + n + ':')
    for e in es: print('        - ' + e)
print('\n  ' + str(len(wrote)) + ' written, ' + str(len(skipped)) + ' skipped.')
print('''
  NOT BUILT (no existing surface in these pages - needs a build ruling):
    low credits / no credits / not-enough-to-craft lines
    empty favourites, no purchase history
    processing / long-processing / failed states (fault copy exists but
    differs per page - a separate reconciliation pass if wanted)
  Welcome screen: waiting on once-per-browser ruling + which pages.
''')
if skipped: sys.exit(1)
