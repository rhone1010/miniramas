#!/usr/bin/env python3
"""
build_b6.py — CURATOR'S PICK BUNDLE + WORKSHOP FOOTER
CUI V22 · 2026-07-27 · to Rich's mockup

  in : public/portraits-b5.html
  out: public/portraits-b6.html

TWO SURFACES, both requiring markup rather than CSS alone.

1 · SLOT 6 BECOMES THE BUNDLE OFFER
    Replaces "Add All 5". Reads as an editorial recommendation, not a sale
    badge. Built from the locked ladder, not the mockup's figures:

      5 images x 10 credits = 50 credits
      5 x $4.99 = $24.95, less 25% = $18.71  (saves $6.24)

    The mockup's $96.75 / save $32.25 reconciles with no locked price and is
    not used. Credits lead; the dollar figure is shown as the equivalent
    because a customer buying credits needs to see what they cost.

    The five thumbnails and the collection name are read from whatever the
    recommendation logic produced. Nothing is hard-coded to Earth & Ore.

2 · WORKSHOP FOOTER
    New element after .stagegrid inside .main. .main becomes a column so the
    grid gives up exactly the footer's height and stays 3x2.

    Four of the five mockup items are carried verbatim. "Preview Before You
    Commit" is NOT — preview-then-unlock is superseded by credits, and the
    copy would promise a flow that no longer exists. Replaced with a credits
    fact that is true.

WHAT WILL STILL BE WRONG
    Quality tiers. Type scale. Seven silos. All separate passes.
"""
import re, sys, os

SRC = 'public/portraits-b5.html'
OUT = 'public/portraits-b6.html'

if not os.path.exists(SRC):
    sys.exit(f"FAIL — {SRC} not found. Run from the repo root.")
src = open(SRC, encoding='utf-8').read()

ids_of   = lambda t: re.findall(r'\bid\s*=\s*"([^"]+)"', t)
fetch_of = lambda t: len(re.findall(r'\bfetch\s*\(', t))
funcs_of = lambda t: len(re.findall(r'\bfunction\s+[A-Za-z0-9_$]+', t))
B_IDS, B_FETCH, B_FUNCS = set(ids_of(src)), fetch_of(src), funcs_of(src)
print(f"in  : {src.count(chr(10))+1} lines · {len(B_IDS)} ids · "
      f"{B_FETCH} fetch · {B_FUNCS} functions")

out = src

# ── 1 · the add-all card becomes the bundle offer ─────────────────────────
OLD = ("    a.innerHTML='<span class=\"aa-plus\">+</span>"
       "<span class=\"aa-lbl\">Add All 5</span>';")
if OLD not in out:
    sys.exit("FAIL — add-all card builder not found; b5 structure has changed")

NEW = r"""    a.innerHTML = bundleCardHTML(list);"""
out = out.replace(OLD, NEW, 1)

# the builder, inserted just above the card factory that uses it
ANCHOR = "  function bindTilt(c){"
if ANCHOR not in out:
    sys.exit("FAIL — bindTilt anchor not found")

BUILDER = r'''  /* Curator's Pick bundle — slot 6.
     Priced from the locked ladder: 10 credits an image, -25% at five.
     Nothing here is hard-coded to a material or a silo. */
  var CREDITS_PER_IMAGE = 10, BASE_USD = 4.99;
  function bundleDiscount(n){
    if(n<=1)return 0; if(n===2)return .10; if(n===3)return .15;
    if(n===4)return .20; if(n>=10)return .30; return .25+(n-5)*.01;
  }
  function bundleCardHTML(list){
    var items = (list||[]).slice(0,5);
    var n = items.length || 5;
    var pct = Math.round(bundleDiscount(n)*100);
    var credits = n * CREDITS_PER_IMAGE;
    var full = BASE_USD * n;
    var now  = full * (1 - bundleDiscount(n));
    var saved = full - now;
    var group = '';
    for (var i=0;i<items.length;i++){
      if (items[i] && items[i].group){ group = items[i].group; break; }
    }
    var title = group ? ('Complete the ' + group + ' Collection')
                      : ('Take all ' + n + ' finishes');
    var thumbs = items.map(function(e){
      var src = (typeof previewFor === 'function') ? previewFor(e) : '';
      var nm  = (e && (e.label || e.name || e.id)) || '';
      return '<figure class="bx-th">'
           +   (src ? '<img src="'+src+'" alt="" loading="lazy">' : '<span class="bx-ph"></span>')
           +   '<figcaption>'+nm+'</figcaption>'
           + '</figure>';
    }).join('');
    return ''
      + '<div class="bx">'
      +   '<p class="bx-eyebrow">Curator&rsquo;s Pick</p>'
      +   '<h3 class="bx-title">'+title+'</h3>'
      +   '<p class="bx-sub">'+n+' finishes. One sitting.</p>'
      +   '<div class="bx-thumbs">'+thumbs+'</div>'
      +   '<p class="bx-save">Add all '+n+' and save <strong>'+pct+'%</strong></p>'
      +   '<button class="bx-cta" type="button">'
      +     '<span class="bx-cta-main">Add all '+n+' &middot; '+credits+' credits</span>'
      +     '<span class="bx-cta-sub">'+credits+' credits &asymp; $'+now.toFixed(2)
      +       ' &middot; saves $'+saved.toFixed(2)+'</span>'
      +   '</button>'
      +   '<p class="bx-fine">Compare them side by side once they are crafted.</p>'
      + '</div>';
  }

'''
out = out.replace(ANCHOR, BUILDER + ANCHOR, 1)

# ── 2 · the footer, appended inside .main after the grid ──────────────────
FOOTER = r'''<footer class="wsfoot" id="workshopFooter">
  <div class="wsfoot-item">
    <span class="wsfoot-ic" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 21h18M5 21V10M9 21V10M15 21V10M19 21V10M12 3 3 8h18Z"/></svg></span>
    <div class="wsfoot-tx">
      <p class="wsfoot-t">Museum-Quality Art</p>
      <p class="wsfoot-p">Printed with archival inks and premium materials.</p>
    </div>
  </div>
  <div class="wsfoot-item">
    <span class="wsfoot-ic" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg></span>
    <div class="wsfoot-tx">
      <p class="wsfoot-t">Credits Never Expire</p>
      <p class="wsfoot-p">Buy once and craft whenever it suits you.</p>
    </div>
  </div>
  <div class="wsfoot-item">
    <span class="wsfoot-ic" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>
    <div class="wsfoot-tx">
      <p class="wsfoot-t">Your Art. Your Collection.</p>
      <p class="wsfoot-p">Each piece is crafted to order and kept to your account.</p>
    </div>
  </div>
  <div class="wsfoot-item">
    <span class="wsfoot-ic" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6Z"/><path d="m9 12 2 2 4-4"/></svg></span>
    <div class="wsfoot-tx">
      <p class="wsfoot-t">Satisfaction Guaranteed</p>
      <p class="wsfoot-p">If the likeness misses, we craft it again at no cost.</p>
    </div>
  </div>
  <div class="wsfoot-item">
    <span class="wsfoot-ic" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M4 12a8 8 0 0 1 13.7-5.7L20 8"/><path d="M20 4v4h-4"/>
        <path d="M20 12a8 8 0 0 1-13.7 5.7L4 16"/><path d="M4 20v-4h4"/></svg></span>
    <div class="wsfoot-tx">
      <p class="wsfoot-t">Cycle Effects</p>
      <p class="wsfoot-p">See more finishes without starting over.</p>
    </div>
  </div>
</footer>
'''

m = re.search(r'(<div[^>]*class="[^"]*\bstagegrid\b[^"]*"[^>]*>)', out)
if not m:
    sys.exit("FAIL — .stagegrid element not found in markup")
# close of the grid element: insert the footer immediately after its subtree
depth, i = 0, m.start()
while i < len(out):
    if out.startswith('<div', i): depth += 1
    elif out.startswith('</div>', i):
        depth -= 1
        if depth == 0:
            i += len('</div>')
            break
    i += 1
out = out[:i] + '\n' + FOOTER + out[i:]

# ── 3 · CSS for both ──────────────────────────────────────────────────────
CSS = r'''
/* ======================================================================== */
/* BUILD 6 · Curator's Pick bundle + workshop footer                         */
/* ======================================================================== */

/* main becomes a column so the grid yields exactly the footer's height */
.main{ flex-direction:column; }
.stagegrid{ flex:1 1 auto; height:auto; min-height:0; }

/* ---- footer ------------------------------------------------------------ */
.wsfoot{
  flex:0 0 auto;
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(min(100%,11rem), 1fr));
  gap:clamp(.75rem,1.25vw,1.5rem);
  width:100%;
  margin-top:clamp(.8rem,1.1vw,1.4rem);
  padding:clamp(.85rem,1.1vw,1.3rem) clamp(1rem,1.4vw,1.7rem);
  border-radius:clamp(.6rem,.7vw,.9rem);
  background:linear-gradient(145deg, rgba(255,253,248,.78), rgba(225,214,198,.6));
  border:1px solid rgba(111,82,50,.15);
  box-shadow:0 .75rem 1.8rem rgba(55,39,24,.08), inset 0 1px 0 rgba(255,255,255,.62);
  overflow:hidden;
}
.wsfoot-item{
  display:grid;
  grid-template-columns:clamp(1.8rem,2.2vw,2.4rem) minmax(0,1fr);
  gap:clamp(.55rem,.75vw,.85rem);
  align-items:center; min-width:0;
}
.wsfoot-ic{
  display:grid; place-items:center; width:100%; aspect-ratio:1;
  border-radius:50%; color:var(--brass);
  background:linear-gradient(145deg, rgba(255,255,255,.9), rgba(230,221,207,.78));
  border:1px solid rgba(108,78,45,.14);
}
.wsfoot-ic svg{ width:48%; height:48%; }
.wsfoot-tx{ min-width:0; }
.wsfoot-t{ margin:0 0 .2em; color:var(--ink); }
.wsfoot-p{ margin:0; line-height:1.4; color:var(--ink-soft,#5a5248); }

/* ---- slot 6 · the bundle ----------------------------------------------- */
.scard.addall{
  display:block; overflow:hidden; padding:0;
  background:
    radial-gradient(circle at 30% 4%, rgba(255,255,255,.5), transparent 42%),
    linear-gradient(160deg, rgba(252,247,236,.98), rgba(233,220,197,.96));
  border:1px solid rgba(132,93,43,.34);
}
.scard.addall::before, .scard.addall::after{ content:none; }
.bx{
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  gap:.35em; height:100%; width:100%;
  padding:clamp(.9rem,1.1vw,1.4rem) clamp(.85rem,1vw,1.3rem);
  text-align:center; box-sizing:border-box; overflow:hidden;
}
.bx-eyebrow{
  margin:0; color:var(--brass); font-family:var(--sans);
  letter-spacing:.14em; text-transform:uppercase;
}
.bx-title{ margin:0; color:var(--ink); font-weight:400; line-height:1.15; }
.bx-sub{ margin:0; color:var(--ink-soft,#5a5248); }
.bx-thumbs{
  display:flex; justify-content:center; gap:.5em;
  width:100%; margin:.35em 0; min-height:0;
}
.bx-th{ margin:0; min-width:0; display:flex; flex-direction:column; align-items:center; gap:.25em; }
.bx-th img, .bx-ph{
  display:block; width:clamp(2.2rem,3.4vw,3.4rem); aspect-ratio:1;
  object-fit:cover; border-radius:50%;
  border:1px solid rgba(132,93,43,.3);
  background:linear-gradient(145deg, rgba(240,232,218,1), rgba(214,200,178,1));
}
.bx-th figcaption{
  color:var(--ink-soft,#5a5248); max-width:5.5rem;
  overflow:hidden; white-space:nowrap; text-overflow:ellipsis;
}
.bx-save{ margin:.15em 0 0; color:var(--ink); }
.bx-save strong{ color:var(--oxblood); font-weight:400; }
.bx-cta{
  display:flex; flex-direction:column; align-items:center; gap:.15em;
  width:100%; margin-top:.5em;
  padding:.6em 1em;
  color:var(--vellum-100,#f8f4eb);
  background:linear-gradient(180deg, var(--oxblood) 0%, #6a3737 100%);
  border:1px solid rgba(60,28,28,.5);
  border-radius:clamp(.45rem,.5vw,.7rem);
  box-shadow:0 .4rem 1rem rgba(60,28,28,.22), inset 0 1px 0 rgba(255,255,255,.12);
  cursor:pointer;
  transition:transform 160ms ease, box-shadow 160ms ease;
}
.bx-cta:hover{
  transform:translateY(-.08rem);
  box-shadow:0 .6rem 1.3rem rgba(60,28,28,.28), inset 0 1px 0 rgba(255,255,255,.16);
}
.bx-cta-sub{ opacity:.82; }
.bx-fine{ margin:.35em 0 0; color:var(--taupe,#aba39a); }
@media (prefers-reduced-motion:reduce){
  .bx-cta, .bx-cta:hover{ transition:none; transform:none; }
}
/* ==================== END BUILD 6 ======================================= */
'''
i = out.rfind('</style>')
out = out[:i] + CSS + out[i:]

# ══════════════════════════════ GATE ══════════════════════════════════════
fails = []
def check(c, m):
    if not c: fails.append(m)

check(fetch_of(out) == B_FETCH,  f"fetch {fetch_of(out)} != {B_FETCH}")
check(funcs_of(out) >= B_FUNCS,  f"functions {funcs_of(out)} < {B_FUNCS}")
markup_only = re.sub(r'<script(?![^>]*\bsrc=)[^>]*>.*?</script>', '', out, flags=re.S)
m_ids = ids_of(markup_only)
new_ids = ids_of(out)
check(len(m_ids) == len(set(m_ids)),
      f"duplicate ids in markup: {sorted({i for i in m_ids if m_ids.count(i)>1})}")
check(not (B_IDS - set(new_ids)), f"ids lost: {sorted(B_IDS-set(new_ids))[:6]}")

check('id="workshopFooter"' in out,        "footer not inserted")
check(out.count('class="wsfoot-item"') == 5, "footer item count != 5")
check('bundleCardHTML' in out,             "bundle builder missing")
check('aa-lbl">Add All 5' not in out,      "old Add All 5 card label survives")

# copy that would promise a superseded flow
for phrase in ['Preview Before You Commit', 'Preview before you commit',
               'preview before you']:
    check(phrase not in out, f"superseded preview copy present: {phrase}")

# pricing must come from the ladder, never the mockup's figures
for bad in ['96.75', '32.25', '3.99']:
    check(bad not in CSS and bad not in BUILDER, f"unlocked price literal: {bad}")
check('CREDITS_PER_IMAGE = 10' in out, "credits per image not 10")
check('BASE_USD = 4.99' in out,        "base price not 4.99")

# no hard-coded silo or material in the bundle
for bad in ['Earth &amp; Ore', 'Earth & Ore', 'Walnut', 'Bronze', 'Alabaster']:
    check(bad not in BUILDER, f"bundle hard-codes {bad}")

# standing gates
for m2 in re.finditer(r'min-width:\s*(\d+)px', CSS):
    if int(m2.group(1)) >= 1200: fails.append(f"new floor min-width:{m2.group(1)}px")
check(not re.search(r'font-size:\s*[\d.]+rem', CSS),
      "new rem font-size — typography is preserved this pass")
check(CSS.count('{') == CSS.count('}'), "css braces unbalanced")

st = out[out.find('<style>'):out.rfind('</style>')]
check(st.count('{') == st.count('}'), f"style braces {st.count('{')}/{st.count('}')}")

if fails:
    print("\nGATE FAIL — nothing written")
    for f in fails: print("  -", f)
    sys.exit(1)

open(OUT, 'w', encoding='utf-8', newline='\n').write(out)
print(f"out : {out.count(chr(10))+1} lines · {len(set(new_ids))} ids · "
      f"{fetch_of(out)} fetch · {funcs_of(out)} functions")
print(f"\nALL GATES PASS → {OUT}")
print("\nBundle maths, from the locked ladder:")
print("  5 images = 50 credits = $18.71 (5 x $4.99 less 25%), saves $6.24")
print("Footer item 2 replaces 'Preview Before You Commit' — that flow is superseded.")
