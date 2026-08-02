#!/usr/bin/env python3
"""
build_s92_real_curator_mark.py  —  CUI V24, 2026-08-02
IN   public/litenco-stage-2026-08-01-s91.html
OUT  public/litenco-stage-2026-08-02-s92.html

Rich: "we need the correct C mark with that screen you have the old temporary
mocked one"

The Curator panel has always used the real mark:

    <img class="cur-mark" src="/icons/curator-c.svg" alt="">

Every modal used a letter C in an oxblood disc, which I drew in s89 from the
mockup without checking whether the studio already had its own. It did, six
inches to the left, and it has been in the panel since s72.

Twelve marks, all replaced with the file. The disc goes: the mark is a mark,
and putting a drawn C behind a real one would be dressing the thing twice.

Route calls stay at 8. Markup and CSS.
"""

import os, re, sys, subprocess, tempfile

SRC_DEFAULT = 'public/litenco-stage-2026-08-01-s91.html'
DST_DEFAULT = 'public/litenco-stage-2026-08-02-s92.html'
REG_DEFAULT = 'public/effect-registry.js'

MARK_SRC = '/icons/curator-c.svg'

# the two drawn discs become one rule for a real image
DISC_1 = '''.m-head .m-mark{
  width:2rem; height:2rem; flex:0 0 auto; border-radius:50%;
  background:var(--oxblood); color:var(--vellum-100);
  display:grid; place-items:center;
  font-family:var(--serif, 'Cormorant Garamond', Georgia, serif);
  font-size:1.15rem; font-style:italic; line-height:1;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.28);
}'''

DISC_1_NEW = '''/* The studio's own mark, the same file the Curator panel has used since s72.
   s89 drew a letter C in a disc from the mockup without checking whether one
   already existed. It did, six inches to the left of where I was working.

   No disc, no ground: the mark carries its own. */
.m-head .m-mark{
  width:2.4rem; height:2.4rem; flex:0 0 auto; display:block;
}'''

DISC_2 = '''.m-scrim .modal .mc-mark{
  width:2rem; height:2rem; flex:0 0 auto; border-radius:50%;
  background:var(--oxblood); color:var(--vellum-100);
  display:grid; place-items:center;
  font-family:var(--serif, 'Cormorant Garamond', Georgia, serif);
  font-size:1.15rem; font-style:italic; line-height:1;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.28);
}'''

DISC_2_NEW = '''/* Same mark for the r02 intake states. */
.m-scrim .modal .mc-mark{
  width:2.4rem; height:2.4rem; flex:0 0 auto; display:block;
}'''

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


def gate(before, after, n):
    sa = styles(after); mk = markup(after)

    # no drawn letter survives anywhere
    if re.search(r'class="(m-mark|mc-mark)"[^>]*>\s*C\s*<', mk):
        die('a letter-C mark survives in markup')
    got = len(re.findall(r'class="(?:m-mark|mc-mark)"[^>]*src="' + re.escape(MARK_SRC), mk))
    if got != n: die('%d of %d marks carry the file' % (got, n))
    # every mark is an <img>, not a div with a letter in it
    for m in re.finditer(r'<(\w+)[^>]*class="(?:m-mark|mc-mark)"', mk):
        if m.group(1) != 'img': die('a mark is a <%s>, not an image' % m.group(1))
    # and the drawn disc is gone from the CSS
    for sel in ['.m-head .m-mark', '.m-scrim .modal .mc-mark']:
        r = re.search(re.escape(sel) + r'\{([^}]*)\}', sa)
        if not r: die('%s lost its rule' % sel)
        if 'background:var(--oxblood)' in r.group(1):
            die('%s still paints a disc behind the real mark' % sel)
        if 'border-radius:50%' in r.group(1):
            die('%s still rounds a mark that is already shaped' % sel)

    if inline_script(before) != inline_script(after): die('script changed; this build declares none')
    ids = re.findall(r'\bid="([^"]+)"', mk)
    if len(ids) != EXPECT_IDS: die('id count %d, expected %d' % (len(ids), EXPECT_IDS))
    if sa.count('{') != sa.count('}'): die('style braces unbalanced')

    vis = re.sub(r'<!--.*?-->', '', mk, flags=re.S)
    vis = re.sub(r'<div class="readout">.*?</table>\s*</div>', '', vis, flags=re.S | re.I)
    vis = re.sub(r'<[^>]+>', ' ', vis).lower()
    for w in BANNED:
        if re.search(r'\b' + re.escape(w) + r'\w*', vis):
            die('banned vocabulary in customer-visible text: %r' % w)

    print('  gate: %d marks carry /icons/curator-c.svg, no drawn letter, no disc' % n)


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
w.console = { log(){}, warn(){}, error(){} };

const j = (o) => Promise.resolve({ ok:true, status:200, json:() => Promise.resolve(o) });
w.fetch = (url) => {
  if (url.includes('/auth/me')) return j({ user:{ id:'uid-1', email:'r@x.com' } });
  if (url.includes('/analyze')) return j({ result:{ quality_verdict:'green', smallest_face_min_dim_px:500 } });
  if (url.includes('/portraits/gate')) return j({ status:'ok' });
  if (url.includes('/curate-effects')) return j({ ok:true, recommendations: [] });
  return j({});
};
w.Image = class { set src(v){ this.naturalWidth=1200; this.naturalHeight=1600;
  if (this.onload) setTimeout(() => this.onload(), 0); } };

try { w.eval(reg); } catch (e) { console.log('FAIL registry'); process.exit(1); }
try { w.eval(html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/)[1]); }
catch (e) { console.log('FAIL boot threw: ' + e.message); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = m => { console.log('FAIL ' + m); process.exit(1); };

(async () => {
  await sleep(80);

  // the panel's mark is the reference; every modal must match it
  const panel = d.querySelector('.cur-mark');
  if (!panel) fail('the Curator panel has no mark to match');
  const want = panel.getAttribute('src');

  const marks = d.querySelectorAll('.m-mark, .mc-mark');
  if (!marks.length) fail('no marks in any modal');
  for (const m of marks){
    if (m.tagName !== 'IMG') fail('a mark is a <' + m.tagName + '>');
    if (m.getAttribute('src') !== want)
      fail('a mark points at ' + m.getAttribute('src') + ', panel uses ' + want);
    if (m.textContent.trim()) fail('a mark still carries a letter');
  }

  // walk all eight intake states — each one must show its mark
  for (let n = 1; n <= 8; n++){
    w.__openIntake(n);
    const on = [...d.querySelectorAll('#intakeModal .state')]
      .filter(s => w.getComputedStyle(s).display !== 'none');
    if (on.length !== 1) fail('state ' + n + ': ' + on.length + ' visible');
    if (on[0].dataset.s !== String(n)) fail('__openIntake(' + n + ') showed ' + on[0].dataset.s);
    const mk = on[0].querySelector('.mc-mark');
    if (!mk) fail('state ' + n + ' has no mark');
    if (mk.getAttribute('src') !== want) fail('state ' + n + ' mark is wrong');
  }
  w.__closeIntake();
  if (d.getElementById('intakeModal').classList.contains('is-open'))
    fail('the intake modal would not close');

  if (errs.length) fail(errs.join(' | '));
  console.log('OK  every mark is the studio\'s own · all eight states carry it');
  process.exit(0);
})();
'''


def boot(path, registry):
    open('.boot_gate_s92.js', 'w', encoding='utf-8').write(BOOT)
    r = subprocess.run(['node', '.boot_gate_s92.js', path, registry], capture_output=True, text=True)
    print('  ' + (r.stdout.strip() or r.stderr.strip()[:400]))
    if r.returncode != 0 or 'FAIL' in r.stdout: die('boot gate')


if __name__ == '__main__':
    SRC = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    DST = sys.argv[2] if len(sys.argv) > 2 else DST_DEFAULT
    REG = sys.argv[3] if len(sys.argv) > 3 else REG_DEFAULT

    before = open(SRC, encoding='utf-8').read()
    if MARK_SRC not in before:
        die('%s is not referenced anywhere — has the mark moved?' % MARK_SRC)
    for nm, a in [('disc1', DISC_1), ('disc2', DISC_2)]:
        if before.count(a) != 1:
            die('%s anchor appears %d times, expected 1' % (nm, before.count(a)))

    after = before.replace(DISC_1, DISC_1_NEW).replace(DISC_2, DISC_2_NEW)

    # every drawn mark becomes the file
    img = '<img class="\\1" src="' + MARK_SRC + '" alt="">'
    after, n1 = re.subn(r'<div class="(m-mark|mc-mark)">C</div>', img, after)
    after, n2 = re.subn(r'<span class="(m-mark|mc-mark)">C</span>', img, after)
    n = n1 + n2
    if not n: die('no drawn marks found to replace')
    print('  replaced %d drawn marks' % n)

    gate(before, after, n)
    cand = DST + '.candidate'
    open(cand, 'w', encoding='utf-8', newline='').write(after)
    boot(cand, REG)
    os.replace(cand, DST)
    print('  written: %s' % DST)
