#!/usr/bin/env python3
# patch-open-doors-glass-r1.py - CUI 42 - 25 August 2026. Lane: D:\lanes\cui42
# Reads  <repo>\public\<page>  for each of the six room pages
# Writes %USERPROFILE%\Downloads\<page>  (install each with Install-File)
#
# Three edits per page, per CENG's open-doors spec and engine contract:
#
#  E1  DOUBLE-EMAIL FIX. The shipped card (PR #88 + replication) calls
#      reallySend() - the signin POST - after /api/v1/invite answers ok.
#      The invite route has ALREADY sent the link (CENG, 25 Aug), so every
#      invited person was mailed twice. On invite ok (including
#      already:true) the sent state now shows directly; no second POST.
#
#  E2  UPLOAD GATE. Unsigned, every analyze route answers 401
#      { ok:false, reason:'not_signed_in' }. That response - anchored on
#      its shape, never on page structure - now raises the sign-in card
#      at the moment of intent. Without this the 401 fell into the
#      nothing_to_craft branch and told a signed-out person their
#      photograph had no faces in it.
#
#  E3  WALLPAPER RE-CRAFT GUARD. "Craft this again" is meaningless on a
#      purchased wallpaper; both collection surfaces (featured pane and
#      lightbox) now suppress it for wallpaper-series pieces. Download
#      and Print Shop already guard themselves.
#
# PER-FILE ALL-OR-NOTHING: a page with any failed anchor is skipped whole
# and reported; the others still write. Nothing partial ever ships.

import os, sys

FILES = ['portraits.html', 'groups.html', 'halloween.html',
         'pets.html', 'pets-chooser.html', 'pets-halloween.html']

MARK = 'CUI 42 \u00b7 open doors glass \u00b7 2026-08-25'

HERE = os.path.dirname(os.path.abspath(__file__))
repo = HERE
while repo and not os.path.isdir(os.path.join(repo, 'public')):
    p = os.path.dirname(repo)
    if p == repo: break
    repo = p
OUTDIR = os.path.join(os.path.expanduser('~'), 'Downloads')

EDITS = [
('E1 double-email',
'''        if (d && d.ok){ reallySend(email); return; }''',
'''        if (d && d.ok){
          /* The invite route has ALREADY sent the sign-in link - CENG's
             contract, 25 Aug 2026. Calling reallySend() here as well
             fired the signin POST on top and mailed every invited
             person twice. The sent state shows directly; already:true
             is the same link going again, also success. Resume is held
             because they are about to leave for their inbox.
             ''' + MARK + ''' */
          saveResume();
          signinSend.disabled = false;
          signinSend.textContent = 'Send the link';
          if (signinAddr) signinAddr.textContent = email;
          if (signinAsk)  signinAsk.hidden  = true;
          if (signinSent) signinSent.hidden = false;
          return;
        }'''),

('E2 upload gate', [
# variant A - groups' rebuilt handler carries {st, d}
('''      if (seq !== SRC.seq) return;
      var data = r.d;
      console.log('[timing] analyze answered''',
'''      if (seq !== SRC.seq) return;
      var data = r.d;
      /* OPEN DOORS \u00b7 ''' + MARK + '''. Unsigned, the analyze routes
         answer 401 { ok:false, reason:'not_signed_in' } - the moment of
         intent is the moment of capture, so the card rises here, before
         this response could fall into the nothing_to_craft branch and
         tell a signed-out person their photograph had no faces.
         Anchored on the response shape, per CENG. */
      if (r.st === 401 && data && data.reason === 'not_signed_in'){
        if (typeof openSignin === 'function') openSignin();
        return;
      }
      console.log('[timing] analyze answered'''),
# variant B - the older handler throws on !res.ok before reading the body
('''    }).then(function(res){
      if (!res.ok) throw new Error('analyze ' + res.status);
      return res.json();''',
'''    }).then(function(res){
      /* OPEN DOORS \u00b7 ''' + MARK + '''. Unsigned, analyze answers 401
         { ok:false, reason:'not_signed_in' }. The card rises at this
         moment of intent; the throw then rides the existing soft-fail
         catch, which returns the person to the floor they were on -
         now behind the sign-in card. Anchored on the response shape,
         per CENG. */
      if (res.status === 401){
        return res.json().catch(function(){ return {}; }).then(function(d){
          if (d && d.reason === 'not_signed_in' &&
              typeof openSignin === 'function') openSignin();
          throw new Error('analyze 401');
        });
      }
      if (!res.ok) throw new Error('analyze ' + res.status);
      return res.json();'''),
]),
('E3a re-craft guard, featured pane',
'''    if (left > 0){
      acts += '<button class="mc-act" data-fa="re" type="button">' +''',
'''    if (left > 0 && !(p && /wallpaper/i.test(String(p.series || '')))){
      /* A purchased wallpaper cannot be crafted again \u00b7 ''' + MARK + ''' */
      acts += '<button class="mc-act" data-fa="re" type="button">' +'''),

('E3b re-craft guard, lightbox',
'''    if (left > 0){
      acts += '<button class="mc-act" data-lb="re">' +''',
'''    if (left > 0 && !(p && /wallpaper/i.test(String(p.series || '')))){
      /* Same guard as the featured pane \u00b7 ''' + MARK + ''' */
      acts += '<button class="mc-act" data-lb="re">' +'''),
]

wrote, skipped = [], []
for name in FILES:
    src = os.path.join(repo, 'public', name)
    if not os.path.isfile(src):
        skipped.append((name, ['file not found at ' + src])); continue
    text = open(src, 'rb').read().decode('utf-8')
    crlf = '\r\n' in text
    nl = (lambda s: s.replace('\n', '\r\n')) if crlf else (lambda s: s)
    if MARK in text:
        skipped.append((name, ['already applied'])); continue
    def variants(e):
        return e[1] if isinstance(e[1], list) else [(e[1], e[2])]
    errs, plan = [], []
    for e in EDITS:
        hits = [(o, w) for o, w in variants(e) if text.count(nl(o)) == 1]
        alls = sum(text.count(nl(o)) for o, w in variants(e))
        if len(hits) == 1 and alls == 1: plan.append(hits[0])
        else: errs.append(e[0] + ': matched ' + str(alls) + ' anchor(s), need exactly 1')
    if errs:
        skipped.append((name, errs)); continue
    for o, w in plan:
        text = text.replace(nl(o), nl(w), 1)
    text = text.replace(nl('<!DOCTYPE html>'),
                        nl('<!DOCTYPE html>\n<!-- ' + MARK + ' -->'), 1)
    post = []
    if 'reallySend(email); return; }' in text and '{ reallySend(email); return; }' in text:
        post.append('old invite path survived')
    if "reason === 'not_signed_in'" not in text: post.append('gate missing')
    if post:
        skipped.append((name, ['post-verify: '] + post)); continue
    out = os.path.join(OUTDIR, name)
    os.makedirs(OUTDIR, exist_ok=True)
    open(out, 'wb').write(text.encode('utf-8'))
    wrote.append((name, os.path.getsize(out)))

print('')
for n, b in wrote: print('[OD] wrote ' + n + '  (' + str(b) + ' bytes)')
for n, es in skipped:
    print('[OD] SKIPPED ' + n + ':')
    for e in es: print('       - ' + e)
print('\n  ' + str(len(wrote)) + ' written, ' + str(len(skipped)) + ' skipped.')
if skipped: sys.exit(1)
print('  Install each from Downloads with Install-File, then commit all six.\n')
