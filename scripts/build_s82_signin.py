#!/usr/bin/env python3
"""
build_s82_signin.py  —  CUI V24, 2026-08-01
IN   public/litenco-stage-2026-08-01-s81.html
OUT  public/litenco-stage-2026-08-01-s82.html
MOD  scripts/module_signin.js

Board 1.2. Sign-in at craft, magic link, no password.

WHY NOW
  Every credits route resolves the owner from the session and refuses without
  one. /api/v1/auth/me returns 401 in the workshop, so the purchase screen —
  and in truth the whole money path — is blocked behind this.

WHEN IT ASKS
  At Craft, and not before. Ruled 2026-08-01, and it matches LOCKED-DECISIONS.
  They browse, upload, choose finishes and a pose with no account. The email
  is asked for once, at the moment of commitment, before a credit moves.

NOTHING NEW SERVER-SIDE
  /api/v1/auth/signin already exists and its own header names this file as the
  caller. The stage POSTs an email; the route calls signInWithOtp with a
  writable cookie client; /auth/callback exchanges the code. Confirmed working
  — Rich's account was created this way on 26 July.

THE PART THAT IS ACTUALLY HARD
  A magic link takes them away, usually to another device, and brings them
  back to a page that has forgotten everything. Late sign-in beats early ONLY
  if the work survives the trip; a customer who returns to an empty workshop
  has given us an email and received nothing.

  So finishes, pose and photograph are held before the email is sent and
  restored on return. localStorage, because the link commonly opens a new tab
  and sessionStorage does not survive that. The photograph is written
  separately and last: a phone photograph as base64 can exceed the quota by
  itself, and losing it while keeping the finishes is recoverable in one
  click. Losing all three is the failure this exists to prevent.

  Restored only when signed in, and only within two hours.

ROUTE CALLS 6 -> 8.  /auth/me and /auth/signin.

WHAT IS DELIBERATELY NOT DONE
  The masthead credits count stays hidden. Reading a balance needs a route
  whose path I have not read, and guessing a contract cost an afternoon today.
  Next build, once the endpoint is confirmed.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT = 'public/litenco-stage-2026-08-01-s81.html'
DST_DEFAULT = 'public/litenco-stage-2026-08-01-s82.html'
MOD_DEFAULT = 'scripts/module_signin.js'
REG_DEFAULT = 'public/effect-registry.js'

MARKUP_ANCHOR = '''<div class="scrim m-scrim" id="queueFullModal" data-role="modal">'''
MARKUP_ADD = '''<div class="scrim m-scrim" id="signinModal" data-role="modal">
  <div class="modal m-card">
    <button class="m-x" id="signinX" aria-label="Close">&times;</button>
    <div id="signinAsk">
      <div class="m-cur"><div class="m-cur-mark">C</div>
        <div class="m-cur-say">Before I begin &mdash; where shall I send your work?
          I&rsquo;ll email you a link to sign in. There is no password to remember.
          <span class="sig">&mdash;&thinsp;C.</span></div></div>
      <label class="signin-lbl" for="signinEmail">Email</label>
      <input class="signin-in" id="signinEmail" type="email" autocomplete="email"
             placeholder="you@example.com" spellcheck="false">
      <div class="signin-err" id="signinErr"></div>
      <div class="acts"><div class="btn fill" id="signinSend">Send the link</div></div>
      <div class="m-safe">Nothing is charged until your piece is crafted.</div>
    </div>
    <div id="signinSent" hidden>
      <div class="m-cur"><div class="m-cur-mark">C</div>
        <div class="m-cur-say">The link is on its way to <b id="signinAddr"></b>.
          Open it and I&rsquo;ll have everything just as you left it &mdash; the
          link works on any device.<span class="sig">&mdash;&thinsp;C.</span></div></div>
      <div class="acts"><div class="btn fill" id="signinDone">Close</div></div>
    </div>
  </div>
</div>

'''

CSS_ANCHOR = '''@keyframes tbcIn{ from{ opacity:0; transform:translateY(-.4em) } to{ opacity:1; transform:none } }'''
CSS_ADD = '''
/* Sign-in. Borrows the modal shell wholesale; only the field is new. */
.signin-lbl{
  display:block; margin:1.1em 0 .35em;
  font:600 .68rem/1 var(--mono, ui-monospace, monospace);
  letter-spacing:.1em; text-transform:uppercase; color:var(--vellum-300);
}
.signin-in{
  width:100%; padding:.7em .8em;
  font:400 1rem/1.2 var(--sans, system-ui, sans-serif);
  color:var(--ink, #2a241e); background:#fff;
  border:1px solid rgba(42,36,30,.22); border-radius:4px;
}
.signin-in:focus{ outline:none; border-color:var(--gold) }
.signin-err{ min-height:1.2em; margin-top:.5em;
  font:400 .82rem/1.3 var(--sans, system-ui, sans-serif); color:#a05a5a }'''

# the Craft button: stopped for sign-in before anything is spent
GO_OLD = '''      window.__runAll();'''
GO_NEW = '''      /* Sign-in precedes crafting — ruled, and the credits routes enforce
         it anyway by refusing without an owner. Asking here means the
         customer meets the request at the moment they want the thing,
         rather than at the door before they know what it is. */
      if (!ME){ PENDING_CRAFT = true; openSignin(); return; }
      window.__runAll();'''

EXPECT_FETCHES_BEFORE = 6
EXPECT_FETCHES_AFTER  = 8
EXPECT_IDS_BEFORE     = 71
EXPECT_IDS_AFTER      = 80
BANNED = ['sculpt', 'sculpted', 'sculpture', 'discount', 'in-situ', 'in situ',
          'render', 'queue']


def die(m):
    print('GATE FAIL: ' + m); sys.exit(1)


def inline_script(h):
    m = list(re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', h, re.S | re.I))
    if len(m) != 1: die('expected one inline script, found %d' % len(m))
    return m[0].group(1)


def styles(h):
    return ''.join(m.group(1) for m in re.finditer(r'<style[^>]*>(.*?)</style>', h, re.S | re.I))


def markup(h):
    x = re.sub(r'<script[^>]*>.*?</script>', '<script></script>', h, flags=re.S | re.I)
    return re.sub(r'<style[^>]*>.*?</style>', '<style></style>', x, flags=re.S | re.I)


def strip_comments(js):
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
        t.write(js); tmp = t.name
    r = subprocess.run(['node', 'scripts/strip_comments.js', tmp], capture_output=True, text=True)
    os.unlink(tmp)
    if r.returncode != 0: die('comment strip failed: ' + r.stderr.strip())
    return r.stdout


def gate(before, after):
    a_js = inline_script(after); a_code = strip_comments(a_js)
    b_code = strip_comments(inline_script(before))

    if 'function whoAmI' not in a_code: die('identity never asked for')
    if 'function saveResume' not in a_code or 'function restoreResume' not in a_code:
        die('the work is not preserved across the round trip')
    # the guard must sit before the run, not after it
    seg = a_code[a_code.index('tbcGo'):]
    i_guard = a_code.find('if (!ME){ PENDING_CRAFT = true; openSignin(); return; }')
    i_run   = a_code.find('window.__runAll();')
    if i_guard < 0: die('Craft does not require sign-in')
    if i_guard > i_run: die('the run starts before the sign-in guard')
    # state held before the email leaves
    sl = a_code.index('function sendLink')
    body = a_code[sl:sl + 1400]
    if 'saveResume()' not in body: die('sendLink does not hold the work')
    if body.index('saveResume()') > body.index('fetch('):
        die('the work is held after the email is sent — they may already be gone')
    # TDZ
    for name in ['ME', 'RESUME_KEY']:
        d = re.search(r'\bvar\s+' + name + r'\b', a_code)
        if not d: die('%s not declared' % name)
    if a_code.index('var ME') > i_guard: die('ME declared below the guard that reads it (TDZ)')

    nf = len(re.findall(r'\bfetch\s*\(', a_code))
    if nf != EXPECT_FETCHES_AFTER: die('fetch count %d, expected %d' % (nf, EXPECT_FETCHES_AFTER))
    for r_ in ['/api/v1/auth/me', '/api/v1/auth/signin']:
        if a_code.count("'" + r_ + "'") != 1: die('route %s not declared once' % r_)

    def decls(c): return set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(', c))
    lost = decls(b_code) - decls(a_code)
    if lost: die('functions lost: %s' % sorted(lost))

    ids = re.findall(r'\bid="([^"]+)"', markup(after))
    if len(ids) != EXPECT_IDS_AFTER: die('id count %d, expected %d' % (len(ids), EXPECT_IDS_AFTER))
    if len(set(ids)) != len(ids):
        die('duplicate ids: %s' % sorted({i for i in ids if ids.count(i) > 1}))

    sa = styles(after)
    if sa.replace(CSS_ADD, '') != styles(before): die('style changed beyond the declared rules')
    if sa.count('{') != sa.count('}'): die('style braces unbalanced')

    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
        t.write(a_js); tmp = t.name
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    os.unlink(tmp)
    if r.returncode != 0: die('node --check: ' + r.stderr.strip().splitlines()[0])

    vis = re.sub(r'<!--.*?-->', '', markup(after), flags=re.S)
    vis = re.sub(r'<div class="readout">.*?</table>\s*</div>', '', vis, flags=re.S | re.I)
    vis = re.sub(r'<[^>]+>', ' ', vis).lower()
    for w in BANNED:
        if re.search(r'\b' + re.escape(w) + r'\w*', vis):
            die('banned vocabulary in customer-visible text: %r' % w)

    print('  gate: Craft requires sign-in, work held before the email, 8 routes, 80 ids')


BOOT = r'''
const fs = require('fs'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync(process.argv[2], 'utf8');
const reg  = fs.readFileSync(process.argv[3], 'utf8');
const errs = [];
const store = {};
const dom = new JSDOM(html, { runScripts:'outside-only', pretendToBeVisual:true, url:'http://localhost/s.html' });
const w = dom.window, d = dom.window.document;
w.addEventListener('error', e => errs.push('window error: ' + e.message));
Object.defineProperty(w, 'localStorage', { value: {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k,v) => { if (String(v).length > 200000) { const e = new Error('QuotaExceeded'); throw e; } store[k]=String(v); },
  removeItem: k => { delete store[k]; }
}, configurable: true });

let signedIn = false;
const calls = [];
const j = (o, ok=true, st=200) => Promise.resolve({ ok, status:st, json:() => Promise.resolve(o) });
w.fetch = (url, opt) => {
  calls.push({ url, body: opt && opt.body ? JSON.parse(opt.body) : null });
  if (url.includes('/auth/me')) return signedIn ? j({ user:{ id:'uid-1', email:'r@x.com' } })
                                                : j({ user:null }, false, 401);
  if (url.includes('/auth/signin')) return j({ ok:true });
  if (url.includes('/analyze')) return j({ result:{ quality_verdict:'green', smallest_face_min_dim_px:500 } });
  if (url.includes('/portraits/gate')) return j({ status:'ok' });
  if (url.includes('/curate-effects')) return j({ ok:true, recommendations: [] });
  if (url.includes('/credits/gate')) return j({ ok:true, ref_id:'craft_x', balance_after:490 });
  if (url.includes('/generate')) return j({ result:{ image_b64:'AAAA', duration_ms:900, scores:{ likeness:8.4 } } });
  return j({});
};
w.Image = class { set src(v){ this.naturalWidth=1200; this.naturalHeight=1600;
  if (this.onload) setTimeout(() => this.onload(), 0); } };

try { w.eval(reg); } catch (e) { console.log('FAIL registry'); process.exit(1); }
const INLINE = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1];
try { w.eval(INLINE); } catch (e) { console.log('FAIL boot threw: ' + e.message); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = m => { console.log('FAIL ' + m); process.exit(1); };
const hit = u => calls.filter(c => c.url.includes(u)).length;

async function openARoom(doc, win){
  for (const c of doc.querySelectorAll('#siloFloor .silo-card')){
    c.dispatchEvent(new win.MouseEvent('click', { bubbles:true }));
    await sleep(900);
    if (doc.querySelector('#effectFloor .silo-card[data-effect-id]')) return true;
    const b = doc.getElementById('crumbLabel');
    if (b) b.dispatchEvent(new win.MouseEvent('click', { bubbles:true }));
    await sleep(900);
  }
  return false;
}

(async () => {
  if (!d.getElementById('tbcGoVerb').textContent.trim()) fail('rail button never labelled');
  if (d.querySelectorAll('#siloFloor .silo-card').length !== 8) fail('silo floor not 8');
  await sleep(80);
  if (hit('/auth/me') !== 1) fail('identity never asked for on arrival');

  // build a real basket as a visitor with no account
  const f = new w.File([new w.Uint8Array([1,2,3])], 'p.jpg', { type:'image/jpeg' });
  Object.defineProperty(d.getElementById('srcFile'), 'files', { value:[f], configurable:true });
  d.getElementById('srcFile').dispatchEvent(new w.Event('change'));
  await sleep(300);
  if (!await openARoom(d, w)) fail('no room offers anything craftable');
  const chosen = d.querySelector('#effectFloor .silo-card[data-effect-id]');
  const chosenEffect = chosen.dataset.effectId, chosenSilo = chosen.dataset.siloId;
  chosen.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(60);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));   // -> pose
  await sleep(1100);
  d.querySelector('#poseFloor [data-pose="smiling"]').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(60);

  // ---- CRAFT MUST STOP AND ASK, AND SPEND NOTHING
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(200);
  if (!d.getElementById('signinModal').classList.contains('is-open')) fail('Craft did not ask for sign-in');
  if (hit('/credits/gate')) fail('CREDITS SPENT BEFORE SIGN-IN');
  if (hit('/generate'))     fail('CRAFTED BEFORE SIGN-IN');

  // ---- a bad address is refused without sending
  d.getElementById('signinEmail').value = 'nope';
  d.getElementById('signinSend').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(60);
  if (hit('/auth/signin')) fail('sent a link to an invalid address');
  if (!d.getElementById('signinErr').textContent) fail('no error shown for a bad address');

  // ---- a good one sends, and the work is held FIRST
  d.getElementById('signinEmail').value = ' Rich@Example.COM ';
  d.getElementById('signinSend').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(200);
  if (hit('/auth/signin') !== 1) fail('the link was not sent');
  const sent = calls.find(c => c.url.includes('/auth/signin')).body;
  if (sent.email !== 'rich@example.com') fail('email not normalised: ' + sent.email);
  if (sent.next !== '/s.html') fail('next is ' + sent.next + ' — they would return to the wrong page');
  if (!store['liten_resume_v1']) fail('the work was not held');
  const held = JSON.parse(store['liten_resume_v1']);
  if (held.queue.length !== 1 || held.queue[0].effectId !== chosenEffect) fail('finishes not held');
  if (held.pose !== 'smiling') fail('pose not held');
  if (d.getElementById('signinSent').hidden) fail('the sent state never showed');

  // ---- THE RETURN: a fresh page, signed in. The work must be there.
  signedIn = true;
  const dom2 = new JSDOM(html, { runScripts:'outside-only', pretendToBeVisual:true, url:'http://localhost/s.html' });
  const w2 = dom2.window, d2 = dom2.window.document;
  Object.defineProperty(w2, 'localStorage', { value: w.localStorage, configurable: true });
  w2.fetch = w.fetch;
  w2.Image = w.Image;
  w2.addEventListener('error', e => errs.push('return: ' + e.message));
  try { w2.eval(reg); w2.eval(INLINE); } catch (e) { fail('return page threw: ' + e.message); }
  await sleep(400);

  if (w2.__QUEUE_PEEK().length !== 1) fail('they came back to an empty rail');
  if (w2.__QUEUE_PEEK()[0].effectId !== chosenEffect) fail('the wrong finish came back');
  if (w2.__POSE !== 'smiling') fail('the pose did not come back');
  if (!w2.__SRC.b64) fail('the photograph did not come back');
  if (store['liten_resume_v1']) fail('the held work was not cleared after restoring');

  // ---- and now Craft goes through, once
  d2.getElementById('tbcGo').dispatchEvent(new w2.MouseEvent('click', { bubbles:true }));
  await sleep(1100);
  d2.getElementById('tbcGo').dispatchEvent(new w2.MouseEvent('click', { bubbles:true }));
  await sleep(1400);
  if (hit('/credits/gate') !== 1) fail('credits gate called ' + hit('/credits/gate') + ' times');
  if (hit('/generate') !== 1) fail('generate called ' + hit('/generate') + ' times');
  if (d2.getElementById('signinModal').classList.contains('is-open')) fail('asked to sign in twice');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  asks at Craft only · nothing spent before · work survives the round trip · then crafts');
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s82.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s82.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    MOD = sys.argv[3] if len(sys.argv) > 3 else MOD_DEFAULT
    REG = sys.argv[4] if len(sys.argv) > 4 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    module = open(MOD, encoding='utf-8').read()

    for nm, a in [('markup', MARKUP_ANCHOR), ('css', CSS_ANCHOR), ('go', GO_OLD)]:
        if before.count(a) != 1:
            die('%s anchor appears %d times, expected 1' % (nm, before.count(a)))

    nf = len(re.findall(r'\bfetch\s*\(', strip_comments(inline_script(before))))
    if nf != EXPECT_FETCHES_BEFORE:
        die('input has %d fetches, expected %d — wrong base file' % (nf, EXPECT_FETCHES_BEFORE))

    after = before.replace(MARKUP_ANCHOR, MARKUP_ADD + MARKUP_ANCHOR)
    after = after.replace(CSS_ANCHOR, CSS_ANCHOR + CSS_ADD)
    after = after.replace(GO_OLD, GO_NEW)
    # The module goes ABOVE the Craft listener, not at the end of the file.
    # It reads SRC, QUEUE, R, SAY and the rest, all of which are declared
    # further up; and `var ME` must sit above the guard that reads it, or the
    # positional gate rejects it — correctly. Three TDZ faults have shipped
    # from this file and the rule is not negotiable for being inconvenient.
    LISTENER = "  if (tbcGo) tbcGo.addEventListener('click', function(){"
    if after.count(LISTENER) != 1:
        die('Craft listener anchor appears %d times' % after.count(LISTENER))
    after = after.replace(LISTENER, module + '\n' + LISTENER)

    gate(before, after)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
