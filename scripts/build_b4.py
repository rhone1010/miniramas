#!/usr/bin/env python3
"""
build_b4.py — r81 INTERFACE onto b2 ENGINE, in one move
CUI V22 · 2026-07-27 · supersedes the eight-increment plan

  in : public/portraits-b2.html                       engine · 203 fn · 10 fetch
       docs/SURFACES/portraits/litenco-portraits-2026-07-24-r81.html   interface · 0 fetch
       (masthead component r2 is inlined below, per MASTHEAD-DIRECTIVE-v1)
  out: public/portraits-b4.html

WHAT YOU WILL SEE
  r81's interface, with the canonical 72px masthead in place of r81's 68px one.

WHAT WILL STILL BE WRONG
  Behaviour. b2's 203 functions address ~150 ids that r81's markup does not
  have. Every one of those is stubbed (§SHIM) so nothing throws on boot, but a
  stubbed control does nothing when clicked. Rewiring is per-function work from
  here, and each rewire is visible progress rather than a leap of faith.

CONSTRUCTION
  <style>   b2's stylesheet first, r81's second — later rules win at equal
            specificity, so r81 governs every collision while b2's orphan
            rules still style the markup b2's JS generates at runtime.
  <body>    r81's markup entirely. Its masthead is swapped for the component.
            Its dev switcher bar is dropped (PROCEDURES §6 — bench tooling is
            never ported forward).
  <script>  the shim, then b2's engine, then r81's own inline scripts.

GATE — writes nothing unless every assertion passes.
"""
import re, sys, os

B2   = 'public/portraits-b2.html'
R81  = 'docs/SURFACES/portraits/litenco-portraits-2026-07-24-r81.html'
OUT  = 'public/portraits-b4.html'

for p in (B2, R81):
    if not os.path.exists(p):
        sys.exit(f"FAIL — {p} not found. Run from the repo root.")

b2  = open(B2,  encoding='utf-8').read()
r81 = open(R81, encoding='utf-8').read()

ids_of    = lambda t: re.findall(r'\bid\s*=\s*"([^"]+)"', t)
fetch_of  = lambda t: len(re.findall(r'\bfetch\s*\(', t))
funcs_of  = lambda t: len(re.findall(r'\bfunction\s+[A-Za-z0-9_$]+', t))

B2_IDS, B2_FETCH, B2_FUNCS = set(ids_of(b2)), fetch_of(b2), funcs_of(b2)
print(f"b2  : {len(B2_IDS)} ids · {B2_FETCH} fetch · {B2_FUNCS} functions")
print(f"r81 : {len(set(ids_of(r81)))} ids · {fetch_of(r81)} fetch")

# ── extract the pieces ────────────────────────────────────────────────────
def style_of(t):
    m = re.findall(r'<style>(.*?)</style>', t, re.S)
    return '\n'.join(m)

def body_of(t):
    i = t.find('<body>'); j = t.rfind('</body>')
    return t[i+len('<body>'):j]

b2_style   = style_of(b2)

r81_style  = style_of(r81)
def release(css, label):
    n = [f for f in re.findall(r'min-width:\s*(\d+)px', css) if int(f) >= 1200]
    if n: print(f"  released {len(n)} horizontal floor(s) from {label}: {n}")
    return re.sub(r'min-width:\s*(1[2-9]\d\d|[2-9]\d\d\d)px', 'min-width:0', css)
b2_style  = release(b2_style,  "b2")
r81_style = release(r81_style, "r81")
r81_body   = body_of(r81)

# b2's engine: its inline script blocks, in order
b2_scripts = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', b2, re.S)
if not b2_scripts:
    sys.exit("FAIL — no inline script found in b2")
print(f"  b2 engine: {len(b2_scripts)} block(s), "
      f"{sum(s.count(chr(10)) for s in b2_scripts)} lines")

# r81's scripts, minus the dev switcher bar
r81_scripts = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', r81_body, re.S)
kept_r81 = [s for s in r81_scripts if 'review switcher' not in s and "'Interrupted'" not in s]
dropped  = len(r81_scripts) - len(kept_r81)
print(f"  r81 scripts: {len(r81_scripts)} found, {dropped} dropped (bench tooling)")

# strip all script tags out of r81's markup — they are re-emitted in order below
r81_markup = re.sub(r'<script(?![^>]*\bsrc=)[^>]*>.*?</script>', '', r81_body, flags=re.S)

# ── replace r81's masthead with the component ─────────────────────────────
mh = re.search(r'<header class="masthead[^"]*">.*?</header>', r81_markup, re.S)
if not mh:
    sys.exit("FAIL — r81 masthead not found")

MASTHEAD = '''<header class="mh" id="masthead">
  <a class="mh-logo" href="/"><span class="mark">Liten <em>&amp; Co</em></span></a>
  <button class="mh-menu" id="mhMenuBtn" aria-label="Menu" aria-expanded="false">
    <svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" stroke-linecap="round"/></svg>
  </button>
  <nav class="mh-nav">
    <a href="/portraits" class="on">Crafted Portraits</a>
    <a href="/workshop" id="navWorkshop">Workshop</a>
    <a href="/gallery">Gallery</a>
    <a href="/print">Print Shop</a>
    <a href="/account" id="navCollection">My Collection</a>
    <a href="/help">Help</a>
  </nav>
  <div class="mh-right">
    <button class="mh-credits" id="mhCreditsBtn" hidden>
      <span class="v" id="creditsCount">0</span><span class="u">credits</span>
    </button>
    <button class="mh-cart" id="mhCartBtn">
      <svg viewBox="0 0 24 24"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.4 12.5a1 1 0 0 0 1 .8h9a1 1 0 0 0 1-.8L21 7H6"/></svg>
      <span class="lbl">Cart</span>
      <span class="cnt" id="mhCartCount" data-empty="true">0</span>
    </button>
  </div>
  <nav class="mh-drawer" id="mhDrawer" hidden>
    <a href="/portraits" class="on">Crafted Portraits</a>
    <a href="/workshop">Workshop</a>
    <a href="/gallery">Gallery</a>
    <a href="/print">Print Shop</a>
    <a href="/account">My Collection</a>
    <a href="/help">Help</a>
  </nav>
</header>'''
r81_markup = r81_markup[:mh.start()] + MASTHEAD + r81_markup[mh.end():]

# ── SHIM · every b2 id that r81 lacks gets a hidden stub ──────────────────
present = set(ids_of(r81_markup)) | {'masthead','mhMenuBtn','mhDrawer',
                                     'mhCartBtn','mhCartCount',
                                     'mhCreditsBtn','creditsCount',
                                     'navWorkshop','navCollection'}
# template-literal ids are runtime-built, not real
missing = sorted(i for i in B2_IDS if i not in present and '${' not in i)
print(f"  shim: {len(missing)} b2 ids stubbed")

SHIM = ('<div id="b2-shim" hidden aria-hidden="true">\n'
        + '\n'.join(f'  <div id="{i}"></div>' for i in missing)
        + '\n</div>\n')

MASTHEAD_CSS = '''
/* ===================== BEGIN MASTHEAD COMPONENT ========================== */
:root{
  --container:86%; --container-max:2200px; --container-min:1850px; --mh-h:72px;
  --radius-pill:8px;
}
@media (max-width:1849px){ :root{ --container-min:0; --container:92%; } }
@media (max-width:1199px){ :root{ --container:94%; } }
@media (max-width:767px) { :root{ --container:100%; } }
[hidden]{display:none!important}
.mh{position:sticky;top:0;z-index:60;height:var(--mh-h);width:100%;
  background:var(--espresso);border-bottom:1px solid var(--card-line);
  display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;
  padding-inline:max(calc((100% - var(--container))/2),calc((100% - var(--container-max))/2))}
.mh-logo{justify-self:start;text-decoration:none;display:inline-flex;align-items:baseline}
.mh-logo .mark{font-family:var(--serif);font-size:2.267rem;font-weight:400;line-height:1;
  color:var(--vellum-100);white-space:nowrap}
.mh-logo .mark em{font-style:italic;color:var(--gold)}
.mh-nav{justify-self:center;display:flex;align-items:center;gap:2rem}
.mh-nav a{position:relative;text-decoration:none;white-space:nowrap;font-family:var(--serif);
  font-size:1.6rem;font-weight:400;line-height:1;color:var(--vellum-300);padding:6px 0;
  transition:color .16s ease}
.mh-nav a:hover{color:var(--vellum-100)}
.mh-nav a.on{color:var(--oxblood)}
.mh-nav a.on::after{content:"";position:absolute;left:0;right:0;bottom:-2px;height:2px;
  background:var(--oxblood)}
.mh-right{justify-self:end;display:flex;align-items:center;gap:12px}
.mh-credits,.mh-cart{display:flex;align-items:center;gap:10px;height:44px;padding:0 16px;
  border-radius:var(--radius-pill);background:var(--coffee-700);
  border:1px solid var(--card-line);color:var(--vellum-100);font-family:var(--sans);
  font-size:1rem;font-weight:600;transition:background .16s ease,border-color .16s ease}
.mh-credits:hover,.mh-cart:hover{background:var(--coffee-600);border-color:var(--gold)}
.mh-credits .v,.mh-cart .cnt{font-variant-numeric:tabular-nums}
.mh-credits .u{font-weight:400;color:var(--vellum-300)}
.mh-cart svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.6}
.mh-cart .cnt{min-width:24px;height:24px;padding:0 6px;border-radius:50%;display:grid;
  place-items:center;background:var(--oxblood);color:#fff;font-size:.867rem;font-weight:600}
.mh-cart .cnt[data-empty="true"]{background:rgba(233,222,200,.22);color:var(--vellum-300)}
.mh-menu{display:none;align-items:center;justify-content:center;width:44px;height:44px;
  border-radius:var(--radius-pill);background:var(--coffee-700);
  border:1px solid var(--card-line);color:var(--vellum-100)}
.mh-menu svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.6}
.mh-drawer{position:absolute;top:var(--mh-h);left:0;right:0;background:var(--espresso);
  border-bottom:1px solid var(--card-line);padding:12px 0 20px;display:flex;
  flex-direction:column}
.mh-drawer a{text-decoration:none;color:var(--vellum-300);font-family:var(--serif);
  font-size:1.6rem;font-weight:400;padding:12px max(calc((100% - var(--container))/2),16px)}
.mh-drawer a.on{color:var(--oxblood)}
@media (max-width:1849px){ .mh-nav{gap:1.6rem} }
@media (max-width:1400px){ .mh-nav a{font-size:1.467rem} .mh-nav{gap:1.2rem} }
@media (max-width:1199px){ .mh{grid-template-columns:auto 1fr auto}
  .mh-nav{display:none} .mh-menu{display:flex;justify-self:start;margin-left:12px} }
@media (max-width:767px){ .mh{padding-inline:16px}
  .mh-logo .mark{font-size:1.933rem} .mh-credits{display:none} }
/* ====================== END MASTHEAD COMPONENT =========================== */

/* r81 released its own horizontal floor; b2's 1440 floor must not return */
body{min-width:0!important;overflow-x:hidden}
'''

DRAWER_JS = '''
(function(){
  var btn=document.getElementById('mhMenuBtn'), drawer=document.getElementById('mhDrawer');
  if(!btn||!drawer)return;
  btn.addEventListener('click',function(){
    var open=drawer.hasAttribute('hidden');
    if(open){drawer.removeAttribute('hidden');}else{drawer.setAttribute('hidden','');}
    btn.setAttribute('aria-expanded',String(open));
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&!drawer.hasAttribute('hidden')){
      drawer.setAttribute('hidden','');btn.setAttribute('aria-expanded','false');}
  });
})();'''

# ── assemble ──────────────────────────────────────────────────────────────
head = b2[:b2.find('<style>')]
if '<title>' in head:
    head = re.sub(r'<title>.*?</title>',
                  '<title>Liten &amp; Co — Crafted Portraits · b4</title>', head, flags=re.S)

out = (head
  + '<style>\n/* ---- b2 stylesheet, first: r81 wins every collision ---- */\n'
  + b2_style
  + '\n/* ---- r81 stylesheet, canonical ---- */\n'
  + r81_style
  + MASTHEAD_CSS
  + '</style>\n</head>\n<body>\n'
  + r81_markup
  + '\n<!-- SHIM · b2 ids with no r81 element. Stubbed so nothing throws on boot;\n'
    '     each is removed as its function is rewired to the real element. -->\n'
  + SHIM
  + '\n<script>' + DRAWER_JS + '\n</script>\n'
  + '\n<!-- ================= b2 ENGINE ================= -->\n'
  + '\n'.join(f'<script>{s}</script>' for s in b2_scripts)
  + '\n<!-- ================= r81 SCRIPTS =============== -->\n'
  + '\n'.join(f'<script>{s}</script>' for s in kept_r81)
  + '\n</body>\n</html>\n')

# ══════════════════════════════ GATE ══════════════════════════════════════
fails = []
def check(c, m):
    if not c: fails.append(m)

markup_only = re.sub(r'<script(?![^>]*\bsrc=)[^>]*>.*?</script>', '', out, flags=re.S)
new_ids = ids_of(markup_only)
check(fetch_of(out) == B2_FETCH,  f"fetch {fetch_of(out)} != {B2_FETCH}")
check(funcs_of(out) >= B2_FUNCS,  f"functions {funcs_of(out)} < {B2_FUNCS}")
dupes = sorted({i for i in new_ids if new_ids.count(i) > 1})
check(not dupes, f"duplicate ids: {dupes[:8]}")

all_ids = set(ids_of(out))
lost = B2_IDS - all_ids
lost = {l for l in lost if '${' not in l}
check(not lost, f"b2 ids unresolvable: {sorted(lost)[:8]}")

r81_ids = {i for i in ids_of(r81) if '${' not in i}
check(not (r81_ids - all_ids), f"r81 ids lost: {sorted(r81_ids-all_ids)[:8]}")

check('class="mh"' in out,                  "canonical masthead absent")
check('--mh-h:72px' in out,                 "masthead not 72px")
check('padding-inline:max(' in out,         "inset not container-tracked")
check('[hidden]{display:none!important}' in out, "no [hidden] reset")
check("'Interrupted'" not in out,           "dev switcher bar ported forward")
check('review switcher' not in out,         "dev switcher bar ported forward")
check('min-width:1440px' not in out.replace(' ',''), "b2's 1440 floor survived")

for m in re.finditer(r'min-width:\s*(\d+)px', out):
    v = int(m.group(1))
    if v >= 1200 and f'max-width:{v-1}px' not in out.replace(' ', ''):
        fails.append(f"unreleased min-width:{v}px")

st = out[out.find('<style>'):out.find('</style>')]
check(st.count('{') == st.count('}'), f"style braces {st.count('{')}/{st.count('}')}")

if fails:
    print("\nGATE FAIL — nothing written")
    for f in fails: print("  -", f)
    sys.exit(1)

open(OUT, 'w', encoding='utf-8', newline='\n').write(out)
print(f"\nout : {out.count(chr(10))+1} lines · {len(set(new_ids))} ids · "
      f"{fetch_of(out)} fetch · {funcs_of(out)} functions")
print(f"ALL GATES PASS → {OUT}")
print(f"\n{len(missing)} stubbed ids are the rewiring backlog.")
