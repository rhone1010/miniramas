#!/usr/bin/env python3
"""
build_s84_redirect_offer.py  —  CUI V24, 2026-08-01
IN   public/litenco-stage-2026-08-01-s83.html
OUT  public/litenco-stage-2026-08-01-s84.html

Rich uploaded a photograph of his wife and two friends. The studio recognised
a group, declined the work, and offered a way through. He saw a card appear
and vanish.

WHAT WAS WRONG
  /generate returns, in full:

    { status: 'redirected',
      redirect: { series, message, ctaLabel, stayLabel } }

  The message is written for the customer and it is good — it names what it
  saw, explains why Portraits is not the place for it, and says where the
  photograph belongs. There are two labelled buttons.

  The client stored the object and said nothing. It withdrew the waiting
  tile, refunded the credits, and left the customer with a card that appeared
  and disappeared for no stated reason. The studio was trying to have a
  conversation and the glass was not listening.

NOW
  The Curator says the engine's own message and offers two choices. Rich's
  framing, ruled 2026-08-01: this is most likely a mistake, so it is asked as
  a question rather than delivered as a verdict.

  · Use a different photograph — reopens the picker.
  · Craft it in Portraits anyway — resends with skip_redirect: true.

  THE OVERRIDE IS REAL AND ALREADY WIRED. generate/route.ts line 351 reads
  body.skip_redirect and passes Gate 0 when it is true, crafting the most
  prominent person. The engine offers it in stayLabel; it was never sent.

  THE WARNING IS RICH'S RULING, VERBATIM IN INTENT: results could be
  unexpected. It sits with the button rather than in the Curator's letter,
  because a caution about an outcome belongs beside the act that causes it.

NO GROUPS BUTTON
  The engine sends ctaLabel 'Step Inside Groups'. Groups is not wired. Ruled:
  leave it off. A button that goes nowhere is worse than two honest choices,
  and the engine's message already names Groups, so the customer knows where
  the photograph belongs even without somewhere to press.
  When Groups ships, the label is already in the payload.

ALSO FIXED
  A redirect and a rejection are now logged. Rich had to read server logs to
  learn why a tile vanished, because the client recorded the reason on the
  item and printed nothing.

Route calls stay at 8 — the anyway path reuses runQueueItem.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT = 'public/litenco-stage-2026-08-01-s83.html'
DST_DEFAULT = 'public/litenco-stage-2026-08-01-s84.html'
REG_DEFAULT = 'public/effect-registry.js'

MARKUP_ANCHOR = '''<div class="scrim m-scrim" id="signinModal" data-role="modal">'''
MARKUP_ADD = '''<div class="scrim m-scrim" id="redirectModal" data-role="modal">
  <div class="modal m-card">
    <button class="m-x" id="redirectX" aria-label="Close">&times;</button>
    <div class="m-cur"><div class="m-cur-mark">C</div>
      <div class="m-cur-say" id="redirectSay"></div></div>
    <div class="pieceframe reject">
      <img class="art" id="redirectPhoto" data-role="their-photo" alt="">
    </div>
    <div class="acts">
      <div class="btn fill" id="redirectNew">Use a different photograph</div>
      <div class="btn ghost" id="redirectAnyway">Craft it in Portraits anyway</div>
    </div>
    <div class="m-safe" id="redirectWarn">A group photograph crafted as a Portrait
      will follow the most prominent person &mdash; the results can be unexpected.
      Nothing further is charged if you would rather not.</div>
  </div>
</div>

'''

SCRIPT_ANCHOR = '''  /* ---- a place held for each piece --------------------------------------'''
SCRIPT_ADD = '''  /* ==================================================================
     THE STUDIO DECLINES, AND OFFERS A WAY THROUGH
     ==================================================================
     /generate can answer 'redirected' — it has looked at the photograph,
     decided this is not a Portrait, and written the customer a message
     naming what it saw and where the photograph belongs.

     That message was being stored and discarded. The tile was withdrawn, the
     credits returned, and nothing was said. This says it.

     The message is the ENGINE'S, printed as written. It knows what it saw;
     this lane does not, and inventing a summary of a judgement it did not
     make would be worse than useless. */

  var redirectModal  = document.getElementById('redirectModal');
  var redirectSay    = document.getElementById('redirectSay');
  var redirectPhoto  = document.getElementById('redirectPhoto');
  var redirectNew    = document.getElementById('redirectNew');
  var redirectAnyway = document.getElementById('redirectAnyway');
  var redirectX      = document.getElementById('redirectX');

  var REDIRECTED = null;      /* the item the studio declined */

  function openRedirect(item){
    if (!redirectModal || !item || !item.redirect) return;
    REDIRECTED = item;
    if (redirectSay){
      /* textContent, never innerHTML — this string comes off the wire and
         the registry has already taught us that real ampersands arrive. */
      redirectSay.textContent = item.redirect.message || '';
      var sig = document.createElement('span');
      sig.className = 'sig';
      sig.textContent = '\\u2014\\u2009C.';
      redirectSay.appendChild(sig);
    }
    if (redirectPhoto && SRC.dataUrl) redirectPhoto.src = SRC.dataUrl;
    redirectModal.classList.add('is-open');
  }

  function closeRedirect(){
    if (redirectModal) redirectModal.classList.remove('is-open');
    REDIRECTED = null;
  }

  /* ---- craft it anyway ---------------------------------------------------
     skip_redirect passes Gate 0 and crafts the most prominent person —
     generate/route.ts line 351. The engine offers this itself in stayLabel;
     it had simply never been sent.

     The credits were already returned when the run ended, so this is a fresh
     charge for a fresh piece, not a resumption of the last one. Putting the
     item back to pending and calling runAll is the honest way to say that:
     it charges once, through the same gate as everything else. */
  function craftAnyway(){
    if (!REDIRECTED) return;
    var item = REDIRECTED;
    closeRedirect();
    item.skipRedirect = true;
    item.status       = 'pending';
    item.paid         = false;
    item.refunded     = false;
    item.redirect     = null;
    item.error        = null;
    if (QUEUE.indexOf(item) < 0) QUEUE.push(item);
    renderQueue();
    labelGo();
    runAll();
  }

  if (redirectNew) redirectNew.addEventListener('click', function(){
    closeRedirect();
    pickSource();
  });
  if (redirectAnyway) redirectAnyway.addEventListener('click', craftAnyway);
  if (redirectX) redirectX.addEventListener('click', closeRedirect);
  if (redirectModal) redirectModal.addEventListener('click', function(e){
    if (e.target === redirectModal) closeRedirect();
  });
  addEventListener('keydown', function(e){
    if (e.key === 'Escape' && redirectModal && redirectModal.classList.contains('is-open')) closeRedirect();
  });

'''

# the payload must carry the override
PAYLOAD_OLD = '''      pose:                  item.pose,
      advanced:              item.advanced
    };
  }
  window.__payloadFor = payloadFor;'''
PAYLOAD_NEW = '''      pose:                  item.pose,
      advanced:              item.advanced,
      /* Gate 0 is passed only when the customer has been shown the studio's
         objection and chosen to proceed. Absent on every ordinary craft. */
      skip_redirect:         item.skipRedirect === true
    };
  }
  window.__payloadFor = payloadFor;'''

# say it, and log it
REDIR_OLD = '''      } else if (data.status === 'redirected'){
        item.status = 'redirected';
        item.redirect = data.redirect || null;
        item.error = (data.redirect && data.redirect.message) || '';'''
REDIR_NEW = '''      } else if (data.status === 'redirected'){
        item.status = 'redirected';
        item.redirect = data.redirect || null;
        item.error = (data.redirect && data.redirect.message) || '';
        /* Logged because Rich had to read the server's output to learn why a
           tile disappeared — the reason was on the item and printed nowhere. */
        console.log('[craft] the studio declined ' + item.preset + ' \\u2014 ' +
                    ((data.redirect && data.redirect.series) || 'another Series') +
                    ' suits this photograph better');
        PENDING_REDIRECT = item;'''

# raised once the run has settled, not mid-flight
TAIL_OLD = '''        withdrawWaiting(owed);'''
TAIL_NEW = '''        withdrawWaiting(owed);
        /* After the run settles, so the offer does not appear over pieces
           that are still arriving. */
        if (PENDING_REDIRECT){
          var it = PENDING_REDIRECT; PENDING_REDIRECT = null;
          setTimeout(function(){ openRedirect(it); }, 260);
        }'''

BUSY_OLD = '''  var RUN_REF = null;'''
BUSY_NEW = '''  var RUN_REF = null;

  /* A declined piece, held until the run finishes. Declared here, above both
     the writer and the reader — a var assigned below its reader hoists the
     name and never the value, which is how s63 shipped inert. */
  var PENDING_REDIRECT = null;'''

EXPECT_FETCHES = 8
EXPECT_IDS_BEFORE = 80
EXPECT_IDS_AFTER  = 87
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

    for need in ['openRedirect', 'closeRedirect', 'craftAnyway']:
        if 'function ' + need not in a_code: die('%s not declared' % need)
    if 'skip_redirect' not in a_code: die('the override never reaches the payload')
    if a_code.index('var PENDING_REDIRECT') > a_code.index('PENDING_REDIRECT = item'):
        die('PENDING_REDIRECT declared below its writer (TDZ)')
    # the message is printed as the engine wrote it, and never as html
    orx = a_code.index('function openRedirect')
    seg = a_code[orx:orx + 900]
    if 'innerHTML' in seg: die('the engine message is written as innerHTML')
    if 'textContent' not in seg: die('the engine message is not printed')
    # no Groups button — ruled, because Groups is not wired
    vis_all = markup(after).lower()
    if 'step inside groups' in vis_all: die('a Groups button that goes nowhere')
    # the warning Rich ruled must be present
    if 'unexpected' not in vis_all: die('the caution about unexpected results is missing')

    nf = len(re.findall(r'\bfetch\s*\(', a_code))
    if nf != EXPECT_FETCHES: die('fetch count %d, expected %d' % (nf, EXPECT_FETCHES))

    def decls(c): return set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(', c))
    lost = decls(b_code) - decls(a_code)
    if lost: die('functions lost: %s' % sorted(lost))

    ids = re.findall(r'\bid="([^"]+)"', markup(after))
    if len(ids) != EXPECT_IDS_AFTER: die('id count %d, expected %d' % (len(ids), EXPECT_IDS_AFTER))
    if len(set(ids)) != len(ids):
        die('duplicate ids: %s' % sorted({i for i in ids if ids.count(i) > 1}))
    if styles(before) != styles(after): die('style block changed; this build declares none')

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

    print('  gate: the message is spoken, the override reaches the wire, no dead Groups button')


BOOT = r'''
const fs = require('fs'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync(process.argv[2], 'utf8');
const reg  = fs.readFileSync(process.argv[3], 'utf8');
const errs = [], store = {};
const dom = new JSDOM(html, { runScripts:'outside-only', pretendToBeVisual:true, url:'http://localhost/s.html' });
const w = dom.window, d = dom.window.document;
w.addEventListener('error', e => errs.push('window error: ' + e.message));
Object.defineProperty(w, 'localStorage', { value: {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k,v) => { store[k]=String(v); }, removeItem: k => { delete store[k]; }
}, configurable: true });

const MSG = 'We see three women in dresses, bride & bridesmaids in your photograph.';
let redirecting = true;
const calls = [];
const j = (o, ok=true, st=200) => Promise.resolve({ ok, status:st, json:() => Promise.resolve(o) });
w.fetch = (url, opt) => {
  calls.push({ url, body: opt && opt.body ? JSON.parse(opt.body) : null });
  if (url.includes('/auth/me')) return j({ user:{ id:'uid-1', email:'r@x.com' } });
  if (url.includes('/analyze')) return j({ result:{ quality_verdict:'green', smallest_face_min_dim_px:500 } });
  if (url.includes('/portraits/gate')) return j({ status:'ok' });
  if (url.includes('/curate-effects')) return j({ ok:true, recommendations: [] });
  if (url.includes('/credits/gate')) return j({ ok:true, ref_id:'craft_x', balance_after:490 });
  if (url.includes('/credits/refund')) return j({ ok:true, refunded:10, balance_after:500 });
  if (url.includes('/generate')){
    const b = JSON.parse(opt.body);
    if (redirecting && !b.skip_redirect)
      return j({ status:'redirected', redirect:{ series:'groups', message:MSG,
                 ctaLabel:'Step Inside Groups', stayLabel:'Craft it in Portrait anyway' } });
    return j({ result:{ image_b64:'AAAA', duration_ms:900, scores:{ likeness:8.4 } } });
  }
  return j({});
};
w.Image = class { set src(v){ this.naturalWidth=1200; this.naturalHeight=1600;
  if (this.onload) setTimeout(() => this.onload(), 0); } };

try { w.eval(reg); } catch (e) { console.log('FAIL registry'); process.exit(1); }
try { w.eval(html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1]); }
catch (e) { console.log('FAIL boot threw: ' + e.message); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = m => { console.log('FAIL ' + m); process.exit(1); };
const hit = u => calls.filter(c => c.url.includes(u)).length;
const modal = () => d.getElementById('redirectModal');

async function openARoom(){
  for (const c of d.querySelectorAll('#siloFloor .silo-card')){
    c.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
    await sleep(900);
    if (d.querySelector('#effectFloor .silo-card[data-effect-id]')) return true;
    const b = d.getElementById('crumbLabel');
    if (b) b.dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
    await sleep(900);
  }
  return false;
}

(async () => {
  await sleep(80);
  const f = new w.File([new w.Uint8Array([1,2,3])], 'g.jpg', { type:'image/jpeg' });
  Object.defineProperty(d.getElementById('srcFile'), 'files', { value:[f], configurable:true });
  d.getElementById('srcFile').dispatchEvent(new w.Event('change'));
  await sleep(300);
  if (!await openARoom()) fail('no room offers anything craftable');
  d.querySelector('#effectFloor .silo-card[data-effect-id]')
   .dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(60);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1100);
  d.getElementById('tbcGo').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1600);

  // ---- the studio must SAY it, in its own words, over their photograph
  if (!modal().classList.contains('is-open')) fail('the redirect was silent — the fault being fixed');
  const said = d.getElementById('redirectSay').textContent;
  if (said.indexOf(MSG) !== 0) fail('the engine message was not printed as written');
  if (d.getElementById('redirectSay').innerHTML.indexOf('&amp;') < 0)
    fail('the message was not escaped — & arrived raw');
  if (d.getElementById('redirectPhoto').getAttribute('src').slice(0,5) !== 'data:')
    fail('their photograph is not shown');
  if (!d.getElementById('redirectWarn').textContent.match(/unexpected/))
    fail('the caution is missing');
  if (hit('/credits/refund') !== 1) fail('the declined piece was not refunded');
  if (d.querySelectorAll('#mcGrid .piece.is-crafting').length) fail('a tile is still spinning');

  // ---- ANYWAY: resends with the override, and crafts
  const before = hit('/generate');
  d.getElementById('redirectAnyway').dispatchEvent(new w.MouseEvent('click', { bubbles:true }));
  await sleep(1800);
  if (modal().classList.contains('is-open')) fail('the offer stayed open');
  if (hit('/generate') !== before + 1) fail('anyway did not re-craft');
  const sent = calls.filter(c => c.url.includes('/generate')).pop().body;
  if (sent.skip_redirect !== true) fail('skip_redirect did not reach the wire');
  if (hit('/credits/gate') !== 2) fail('the second craft was not charged');
  if (hit('/credits/refund') !== 1) fail('the successful craft was refunded');
  if (!d.querySelectorAll('#mcGrid .piece__img, #mcGrid .mc-feat').length)
    fail('the piece never landed');

  // ---- and an ordinary craft never carries the override
  const first = calls.filter(c => c.url.includes('/generate'))[0].body;
  if (first.skip_redirect !== false) fail('the first craft carried the override');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  the studio speaks · their photo shown · caution present · anyway overrides and crafts');
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s84.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s84.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    REG = sys.argv[3] if len(sys.argv) > 3 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    for nm, a in [('markup', MARKUP_ANCHOR), ('script', SCRIPT_ANCHOR), ('payload', PAYLOAD_OLD),
                  ('redir', REDIR_OLD), ('tail', TAIL_OLD), ('busy', BUSY_OLD)]:
        if before.count(a) != 1:
            die('%s anchor appears %d times, expected 1' % (nm, before.count(a)))

    after = before.replace(MARKUP_ANCHOR, MARKUP_ADD + MARKUP_ANCHOR)
    after = after.replace(BUSY_OLD, BUSY_NEW)
    after = after.replace(SCRIPT_ANCHOR, SCRIPT_ADD + SCRIPT_ANCHOR)
    after = after.replace(PAYLOAD_OLD, PAYLOAD_NEW)
    after = after.replace(REDIR_OLD, REDIR_NEW)
    after = after.replace(TAIL_OLD, TAIL_NEW)

    gate(before, after)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
