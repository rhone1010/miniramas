#!/usr/bin/env python3
"""
build_s90_note_width_aspect_timing.py  —  CUI V24, 2026-08-01
IN   public/litenco-stage-2026-08-01-s89.html
OUT  public/litenco-stage-2026-08-01-s90.html

Four rulings from Rich on the glass.

1 · THE NOTE IS WIDER, AND THE LETTER TIGHTER
    560px made six lines of what should be three. 680px, and the leading
    Rich gave verbatim:

        .m-say{ font-family:var(--serif); font-size:1.2rem;
                line-height:1.4; color:var(--ink) }

2 · THE PREVIEW TAKES THE PHOTOGRAPH'S OWN SHAPE
    The frame was a fixed 46% column and cropped to fill, so a bride was
    shown from collarbone to waist while the Curator described three women.
    The evidence has to be the evidence.

    Width holds; height follows the photograph. Nothing is cropped.

3 · 9:16 IS THE CEILING, AND IT IS REFUSED POLITELY
    A photograph taller than 9:16 is turned away at the upload, before the
    routes are called — a shape the studio will not craft well is not worth
    six seconds of anyone's time to confirm. Told, not scolded, and the
    picker reopens.

    Measured on the natural dimensions the client already reads for the
    focal checks; nothing new is fetched.

4 · TIMINGS, LOGGED
    Rich asked how long the offer takes to appear. Marked at the upload and
    read when the gate answers, printed with the analyze and gate times
    beside it. Counting seconds by eye is not measurement.

Route calls stay at 8.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT = 'public/litenco-stage-2026-08-01-s89.html'
DST_DEFAULT = 'public/litenco-stage-2026-08-01-s90.html'
REG_DEFAULT = 'public/effect-registry.js'

# ---- 1 · width and leading ----------------------------------------------
WIDTH_OLD = '''  width:min(560px, 100%);'''
WIDTH_NEW = '''  /* 680, ruled 2026-08-01. At 560 the Curator's three sentences broke to
     six lines and read as a wall rather than a note. */
  width:min(680px, 100%);'''

SAY_OLD = '''.m-say{
  font-family:var(--serif, 'Cormorant Garamond', Georgia, serif);
  font-size:1.28rem; line-height:1.55; color:var(--ink);
}'''
SAY_NEW = '''/* Rich's, verbatim. */
.m-say{
  font-family:var(--serif, 'Cormorant Garamond', Georgia, serif);
  font-size:1.2rem;
  line-height:1.4;
  color:var(--ink);
}'''

# ---- 2 · the preview takes the photograph's shape ------------------------
PHOTO_OLD = '''.m-body{ display:flex; gap:1.1rem; align-items:stretch }
.m-body .m-photo{
  flex:0 0 46%;
  border-radius:4px; overflow:hidden;
  border:1px solid rgba(147,111,67,.32);
  background:var(--vellum-300);
  box-shadow:0 2px 8px rgba(31,27,20,.16);
}
.m-body .m-photo img{ width:100%; height:100%; object-fit:cover; display:block }
.m-body .acts{ flex:1; display:flex; flex-direction:column; gap:.6rem; justify-content:center; margin:0 }'''

PHOTO_NEW = '''/* The photograph is the evidence, so it is shown whole. The frame was a
   fixed column cropping to fill, which showed a bride from collarbone to
   waist while the note described three women — the one thing the customer
   needed to see was the thing being cut away.

   The width holds; the height follows the image. `align-items:flex-start`
   rather than `stretch`, or the frame is forced to the height of the
   buttons beside it and we are cropping again. */
.m-body{ display:flex; gap:1.1rem; align-items:flex-start }
.m-body .m-photo{
  flex:0 0 46%;
  border-radius:4px; overflow:hidden;
  border:1px solid rgba(147,111,67,.32);
  background:var(--vellum-300);
  box-shadow:0 2px 8px rgba(31,27,20,.16);
  /* 9:16 is the tallest shape the studio accepts, so the frame need never
     be taller than that. Anything beyond it was turned away at the upload. */
  max-height:calc((680px - 4.4rem) * 0.46 * 16 / 9);
}
.m-body .m-photo img{ width:100%; height:auto; display:block }
.m-body .acts{ flex:1; display:flex; flex-direction:column; gap:.6rem; justify-content:center; margin:0 }'''

# ---- 3 · the 9:16 ceiling, and 4 · timings ------------------------------
PROBE_OLD = '''      var probe = new Image();
      probe.onload = function(){
        SRC.dims  = { w: probe.naturalWidth, h: probe.naturalHeight };
        SRC.flags = localPhotoCheck(probe);
        runAnalyze();
        precheckSourceGate();
      };'''

PROBE_NEW = '''      SRC.t0 = Date.now();     /* the upload. Everything else is measured from here. */

      /* A new photograph closes any note still standing about the last one.
         Found by the gate: upload, get the note, upload again from the
         Curator slot, and the old note stayed up describing a photograph
         that had already been replaced. */
      if (typeof closeRedirect === 'function') closeRedirect();

      var probe = new Image();
      probe.onload = function(){
        SRC.dims  = { w: probe.naturalWidth, h: probe.naturalHeight };

        /* 9:16 is the tallest shape the studio will craft — ruled
           2026-08-01. Refused HERE, before a single route is called: six
           seconds of analysis to confirm a shape we already know we will
           not accept wastes the customer's time and ours. */
        var h = probe.naturalHeight, w2 = probe.naturalWidth;
        if (w2 > 0 && (h / w2) > (16 / 9) + 0.02){
          console.log('[intake] refused at ' + w2 + '\\u00d7' + h +
                      ' \\u2014 taller than 9:16');
          offerAspectRefusal(w2, h);
          return;
        }

        SRC.flags = localPhotoCheck(probe);
        runAnalyze();
        precheckSourceGate();
      };'''

# the refusal wears the same note
REFUSE_ANCHOR = '''  function offerRedirect(redirect){'''
REFUSE_ADD = '''  /* A photograph the studio will not craft well, turned away kindly and at
     once. Ruled 2026-08-01: taller than 9:16 is out.

     It is the Curator's Note, not an error — the shape is a fact about the
     photograph, not a failing of the person who took it, and nothing has
     been spent. The filled action reopens the picker because choosing
     another photograph is the only way forward; there is no "anyway" for a
     shape the studio cannot hold. */
  function offerAspectRefusal(w, h){
    if (!redirectModal) return;
    REDIRECTED = null;
    ASPECT_REFUSED = true;
    if (redirectSay){
      redirectSay.textContent =
        'This photograph is taller than I can hold \\u2014 ' + w + ' by ' + h +
        '. A little squarer and I can craft it properly. Anything up to a ' +
        'phone screen\\u2019s shape suits me well.';
      var sig = document.createElement('span');
      sig.className = 'sig'; sig.textContent = '\\u2014\\u2009C.';
      redirectSay.appendChild(sig);
    }
    if (redirectPhoto && SRC.dataUrl) redirectPhoto.src = SRC.dataUrl;
    if (redirectAnyway) redirectAnyway.hidden = true;
    if (redirectWarn) redirectWarn.textContent =
      'Nothing has been charged. Choose another photograph and we will carry on.';
    if (typeof hideCollection === 'function' &&
        mycoll && mycoll.classList.contains('is-open')) hideCollection();
    redirectModal.classList.add('is-open');
  }

'''

# the shared open must undo the refusal's changes
OPEN_OLD = '''    REDIRECTED = item;
    if (redirectSay){'''
OPEN_NEW = '''    REDIRECTED = item;
    /* The refusal hides the override and rewrites the caution; put both
       back, or the next note inherits the last one's shape. */
    ASPECT_REFUSED = false;
    if (redirectAnyway) redirectAnyway.hidden = false;
    if (redirectWarn) redirectWarn.textContent = REDIRECT_WARN;
    if (redirectSay){'''

VARS_OLD = '''  var REDIRECTED = null;      /* the item the studio declined */'''
VARS_NEW = '''  var REDIRECTED = null;      /* the item the studio declined */
  var ASPECT_REFUSED = false;
  var redirectWarn = document.getElementById('redirectWarn');
  /* Held so the refusal can borrow the card and hand it back unchanged. */
  var REDIRECT_WARN = redirectWarn ? redirectWarn.textContent : '';'''

# timings on the two routes that make the customer wait
ANALYZE_OLD = '''      if (seq !== SRC.seq) return;
      SRC.analyze = (data && data.result) || {};'''
ANALYZE_NEW = '''      if (seq !== SRC.seq) return;
      console.log('[timing] analyze answered in ' + (Date.now() - SRC.t0) + 'ms');
      SRC.analyze = (data && data.result) || {};'''

GATE_TIME_OLD = '''      if (!v || SRC.gateFp !== fp) return;
      SRC.gate = v;'''
GATE_TIME_NEW = '''      if (!v || SRC.gateFp !== fp) return;
      /* What Rich watched, measured. The gate makes a vision call, so this
         is the number that decides how long the offer takes to appear. */
      console.log('[timing] the studio looked for ' + (Date.now() - SRC.t0) + 'ms');
      SRC.gate = v;'''

EXPECT_FETCHES = 8
EXPECT_IDS     = 87
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
    sa = styles(after); a_code = strip_comments(inline_script(after))
    b_code = strip_comments(inline_script(before))

    # 1 · Rich's numbers, exactly
    m = re.search(r'\.m-say\{([^}]*)\}', sa)
    if 'font-size:1.2rem' not in m.group(1): die('the letter is not at 1.2rem')
    if 'line-height:1.4' not in m.group(1): die('the leading is not 1.4')
    if 'min(680px' not in sa: die('the note is not 680 wide')

    # 2 · nothing cropped
    p = re.search(r'\.m-body \.m-photo img\{([^}]*)\}', sa)
    if 'object-fit:cover' in p.group(1): die('the preview still crops')
    if 'height:auto' not in p.group(1): die('the preview height does not follow the image')
    b = re.search(r'\.m-body\{([^}]*)\}', sa)
    if 'flex-start' not in b.group(1): die('the frame is stretched to its neighbour')

    # 3 · refused before any route is called
    if 'function offerAspectRefusal' not in a_code: die('no refusal for an over-tall photograph')
    pr = a_code.index('probe.onload')
    seg = a_code[pr:pr + 900]
    if 'offerAspectRefusal' not in seg: die('the ceiling is not applied at the upload')
    if seg.index('offerAspectRefusal') > seg.index('runAnalyze'):
        die('the routes are called before the shape is checked')
    if 'ASPECT_REFUSED' not in a_code: die('the refusal state is not tracked')

    # 4 · timings
    if a_code.count('[timing]') < 2: die('the wait is still not measured')
    if 'SRC.t0 = Date.now()' not in a_code: die('nothing marks the upload')

    def decls(c): return set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(', c))
    lost = decls(b_code) - decls(a_code)
    if lost: die('functions lost: %s' % sorted(lost))

    nf = len(re.findall(r'\bfetch\s*\(', a_code))
    if nf != EXPECT_FETCHES: die('fetch count %d, expected %d' % (nf, EXPECT_FETCHES))
    ids = re.findall(r'\bid="([^"]+)"', markup(after))
    if len(ids) != EXPECT_IDS: die('id count %d, expected %d' % (len(ids), EXPECT_IDS))
    if markup(before) != markup(after): die('markup changed; this build declares none')
    if sa.count('{') != sa.count('}'): die('style braces unbalanced')

    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
        t.write(inline_script(after)); tmp = t.name
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    os.unlink(tmp)
    if r.returncode != 0: die('node --check: ' + r.stderr.strip().splitlines()[0])

    vis = re.sub(r'<!--.*?-->', '', markup(after), flags=re.S)
    vis = re.sub(r'<div class="readout">.*?</table>\s*</div>', '', vis, flags=re.S | re.I)
    vis = re.sub(r'<[^>]+>', ' ', vis).lower()
    for w in BANNED:
        if re.search(r'\b' + re.escape(w) + r'\w*', vis):
            die('banned vocabulary in customer-visible text: %r' % w)

    print('  gate: 680 wide, 1.2/1.4, nothing cropped, 9:16 refused before the routes, wait measured')


BOOT = r'''
const fs = require('fs'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync(process.argv[2], 'utf8');
const reg  = fs.readFileSync(process.argv[3], 'utf8');
const errs = [], store = {}, logs = [];
const dom = new JSDOM(html, { runScripts:'outside-only', pretendToBeVisual:true, url:'http://localhost/s.html' });
const w = dom.window, d = dom.window.document;
w.addEventListener('error', e => errs.push('window error: ' + e.message));
Object.defineProperty(w, 'localStorage', { value: {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k,v) => { store[k]=String(v); }, removeItem: k => { delete store[k]; }
}, configurable: true });
w.console = { log: (...a) => logs.push(a.join(' ')), warn(){}, error(){} };

const MSG = 'We see three women, one in a wedding dress in your photograph.';
let isGroup = true, dims = { w: 1200, h: 1600 };
const calls = [];
const j = (o) => Promise.resolve({ ok:true, status:200, json:() => Promise.resolve(o) });
w.fetch = (url) => {
  calls.push(url);
  if (url.includes('/auth/me')) return j({ user:{ id:'uid-1', email:'r@x.com' } });
  if (url.includes('/analyze')) return j({ result:{ quality_verdict:'green', smallest_face_min_dim_px:500 } });
  if (url.includes('/portraits/gate'))
    return isGroup ? j({ status:'redirected', redirect:{ series:'groups', message:MSG,
                         ctaLabel:'Step Inside Groups', stayLabel:'Craft it in Portrait anyway' } })
                   : j({ status:'ok' });
  if (url.includes('/curate-effects')) return j({ ok:true, recommendations: [] });
  return j({});
};
w.Image = class { set src(v){ this.naturalWidth = dims.w; this.naturalHeight = dims.h;
  if (this.onload) setTimeout(() => this.onload(), 0); } };

try { w.eval(reg); } catch (e) { console.log('FAIL registry'); process.exit(1); }
try { w.eval(html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1]); }
catch (e) { console.log('FAIL boot threw: ' + e.message); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = m => { console.log('FAIL ' + m); process.exit(1); };
const modal = () => d.getElementById('redirectModal');
async function upload(n){
  const f = new w.File([new w.Uint8Array([1,2,3])], n, { type:'image/jpeg' });
  Object.defineProperty(d.getElementById('srcFile'), 'files', { value:[f], configurable:true });
  d.getElementById('srcFile').dispatchEvent(new w.Event('change'));
  await sleep(400);
}

(async () => {
  await sleep(80);

  // ---- a group photograph: the note, and the numbers
  await upload('group.jpg');
  if (!modal().classList.contains('is-open')) fail('the note did not open');
  const say = w.getComputedStyle(d.getElementById('redirectSay'));
  if (say.lineHeight && !/1\.4|(^|[^\d])(\d+(\.\d+)?)px/.test(say.lineHeight)) { /* jsdom may not resolve */ }
  const img = d.querySelector('.m-photo img');
  if (w.getComputedStyle(img).objectFit === 'cover') fail('the preview still crops');
  if (!logs.some(l => l.indexOf('[timing] the studio looked for') === 0)) fail('the wait was not measured');
  if (!d.getElementById('redirectAnyway').hidden === false) { /* visible, as it should be */ }
  if (d.getElementById('redirectAnyway').hidden) fail('the override is hidden on a group photograph');

  // ---- TALLER THAN 9:16: refused before any route is called
  const before = calls.length;
  dims = { w: 900, h: 2400 };            // 8:21 — well past the ceiling
  await upload('tall.jpg');
  if (!modal().classList.contains('is-open')) fail('an over-tall photograph was accepted silently');
  if (calls.length !== before) fail('routes were called for a shape we refuse');
  if (!d.getElementById('redirectAnyway').hidden) fail('an over-tall photograph offered an override');
  if (!d.getElementById('redirectSay').textContent.match(/taller than I can hold/))
    fail('the refusal does not say what is wrong');
  if (!d.getElementById('redirectSay').textContent.match(/900 by 2400/))
    fail('the refusal does not name the shape');
  if (!d.getElementById('redirectWarn').textContent.match(/Nothing has been charged/))
    fail('the refusal does not say nothing was charged');

  // ---- exactly 9:16 is accepted
  dims = { w: 1080, h: 1920 };
  const b2 = calls.length;
  await upload('phone.jpg');
  if (calls.length === b2) fail('a 9:16 photograph was refused — the ceiling is off by one');

  // ---- and a group note after a refusal must come back whole
  if (d.getElementById('redirectAnyway').hidden) fail('the override stayed hidden after the refusal');
  if (!d.getElementById('redirectWarn').textContent.match(/unexpected/))
    fail('the caution did not come back');

  // ---- an ordinary portrait passes through untouched
  isGroup = false; dims = { w: 1200, h: 1600 };
  await upload('single.jpg');
  if (modal().classList.contains('is-open')) fail('a single-subject photograph raised the note');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  note widened · nothing cropped · 9:16 refused before the routes · 8:21 in, 9:16 through · timings logged');
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s90.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s90.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    REG = sys.argv[3] if len(sys.argv) > 3 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    for nm, a in [('width', WIDTH_OLD), ('say', SAY_OLD), ('photo', PHOTO_OLD),
                  ('probe', PROBE_OLD), ('refuse', REFUSE_ANCHOR), ('open', OPEN_OLD),
                  ('vars', VARS_OLD), ('analyze', ANALYZE_OLD), ('gatetime', GATE_TIME_OLD)]:
        if before.count(a) != 1:
            die('%s anchor appears %d times, expected 1' % (nm, before.count(a)))

    after = before.replace(WIDTH_OLD, WIDTH_NEW)
    after = after.replace(SAY_OLD, SAY_NEW)
    after = after.replace(PHOTO_OLD, PHOTO_NEW)
    after = after.replace(VARS_OLD, VARS_NEW)
    after = after.replace(REFUSE_ANCHOR, REFUSE_ADD + REFUSE_ANCHOR)
    after = after.replace(OPEN_OLD, OPEN_NEW)
    after = after.replace(PROBE_OLD, PROBE_NEW)
    after = after.replace(ANALYZE_OLD, ANALYZE_NEW)
    after = after.replace(GATE_TIME_OLD, GATE_TIME_NEW)

    gate(before, after)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
