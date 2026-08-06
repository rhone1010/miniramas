# -*- coding: utf-8 -*-
"""
build_s101_print_shop.py  ·  2026-08-03  ·  CUI V25

The Print Shop. "Send to Print Shop" has been a named, absent no-op since
s72; four routes have existed and none has ever been called from the glass.

STRUCTURE — from litenco-printshop-workspace-2026-07-08, which is a
specification and not a file to wire. Wall of pieces, flyout to configure
one, cart, and the drop-alert for anything left unconfigured.

WHAT THE MOCKUP GOT WRONG, AND WHY THIS DIFFERS
    It was drawn on 8 July against Canvas, 12×12 through 24×24, and an edge
    wrap. None of that exists. lib/v1/print/sku-map.ts is the price
    authority and it holds four things: 8×10, 12×16 and 18×24 unframed, and
    12×16 framed. This build READS THAT FILE and inlines what it finds, so
    the shop cannot offer a size Prodigi has no SKU for. Prices move there,
    not here.

DECISIONS TAKEN, LOGGED FOR RICH

  1 · Only a persisted piece can be printed. renderUrl must be fetchable by
      Prodigi, and that means the signed URL from the collection bucket. A
      piece still living as a data URL in this tab has no such URL, so it is
      shown greyed with "saving…" rather than offered and then failing.

  2 · The cart collects the address. The checkout route wants a full one in
      the body because the Prodigi quote has to happen before the Stripe
      session exists. Stripe cannot collect it for us.

  3 · Hosted Stripe, not embedded. The route returns a checkoutUrl and this
      build wires to what exists rather than to what it wishes existed.
      OPEN FOR RICH: credits buy embedded and prints would leave the studio.
      Same fix as the credits route — ui_mode 'embedded' — and it is a route
      change, not a glass one.

  4 · The quote is asked for when the country and postcode are both present,
      and again on any change to the order. Shipping is never guessed.

  5 · Nothing upscales yet. 8×10 wants 2400×3000 and a 2K render is 2048².
      The shop sells at the locked prices regardless; the webhook is where
      the upscale belongs and Rich has measured it at 1.8s for 4×.

ROUTE COUNT 13 -> 15: /print/quote and /print/checkout.

Run from the repo root:  python scripts\\build_s101_print_shop.py
"""

import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s100.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s101.html')
SKU_MAP = os.path.join(ROOT, 'lib', 'v1', 'print', 'sku-map.ts')

ROUTES_BEFORE = 13
ROUTES_AFTER = 15

SIZE_LABEL = {'8x10': '8 × 10″', '12x16': '12 × 16″', '18x24': '18 × 24″'}


def die(msg):
    print('GATE FAILED · ' + msg)
    sys.exit(1)


def rep(text, old, new, label):
    n = text.count(old)
    if n != 1:
        die('anchor "%s" appears %d times, expected 1' % (label, n))
    return text.replace(old, new)


# ── the price authority, read today ─────────────────────────────────────────
if not os.path.exists(SKU_MAP):
    die('sku-map.ts not found at ' + SKU_MAP)

with open(SKU_MAP, encoding='utf-8') as f:
    ts = f.read()

OPTS = []
# "unframed" contains "framed" — a bare search for the second matched inside
# the first and gave the framed shelf three unframed prices at unframed money.
# The lookbehind is the whole fix.
for finish in ('unframed', 'framed'):
    key = r'\bunframed:' if finish == 'unframed' else r'(?<!un)\bframed:'
    m = re.search(key + r'\s*\{(.*?)\n  \},', ts, re.S)
    if not m:
        m = re.search(key + r'\s*\{(.*?)\n  \}', ts, re.S)
    if not m:
        die('could not read the %s block from sku-map.ts' % finish)
    block = m.group(1)
    for sm in re.finditer(r"'([0-9]+x[0-9]+)':\s*\{(.*?)\n    \}", block, re.S):
        size, body = sm.group(1), sm.group(2)
        cents = re.search(r'retailCents:\s*([0-9]+)', body)
        desc = re.search(r"description:\s*'([^']*)'", body)
        if not cents:
            die('no retailCents for %s %s' % (finish, size))
        OPTS.append({
            'size': size,
            'finish': finish,
            'cents': int(cents.group(1)),
            'label': SIZE_LABEL.get(size, size),
            'note': 'Framed, ready to hang' if finish == 'framed'
                    else 'Enhanced matte art paper',
            'desc': desc.group(1) if desc else '',
        })

seen = set()
for o in OPTS:
    k = (o['size'], o['finish'])
    if k in seen:
        die('%s %s read twice from sku-map.ts' % k)
    seen.add(k)
for o in OPTS:
    if o['finish'] == 'framed':
        base = [x for x in OPTS if x['size'] == o['size'] and x['finish'] == 'unframed']
        if base and o['cents'] <= base[0]['cents']:
            die('framed %s is not dearer than unframed — the blocks were misread'
                % o['size'])

if len(OPTS) < 3:
    die('only %d print options read from sku-map.ts — refusing to build a shop with no shelf' % len(OPTS))

OPTS.sort(key=lambda o: (o['finish'] != 'unframed', o['cents']))

opt_lines = ['  var PRINT_OPTS = [']
for n, o in enumerate(OPTS):
    opt_lines.append(
        "    { size:%s, finish:%s, cents:%d, label:%s, note:%s }%s" % (
            json.dumps(o['size']), json.dumps(o['finish']), o['cents'],
            json.dumps(o['label']), json.dumps(o['note']),
            ',' if n < len(OPTS) - 1 else ''))
opt_lines.append('  ];')
PRINT_OPTS = '\r\n'.join(opt_lines)

# ── apply ───────────────────────────────────────────────────────────────────
with open(SRC, encoding='utf-8', newline='') as f:
    src = f.read()

if src.count('fetch(') != ROUTES_BEFORE:
    die('expected %d routes in s100, found %d' % (ROUTES_BEFORE, src.count('fetch(')))

doc = src

# ───────────────────────────────────────────────────────────────────── 1 · CSS

doc = rep(
    doc,
    "/* ---- head ------------------------------------------------------------- */\r\n"
    ".mc-head{",

    "/* ======================================================================\n"
    "   THE PRINT SHOP\n"
    "   Same geometry as My Collection — it slides over the floor and the rail\n"
    "   and leaves the Curator standing. Two views inside it: the wall, and the\n"
    "   order. Never both.\n"
    "   ====================================================================== */\n"
    ".pshop{\n"
    "  position:fixed; z-index:56;\n"
    "  top:var(--mh-h); bottom:0; right:0;\n"
    "  left:calc(var(--stage-gutter) + var(--spine-w) + var(--room-gap));\n"
    "  display:flex; flex-direction:column;\n"
    "  padding:clamp(16px,1.2vw,26px) clamp(14px,1vw,22px) 0;\n"
    "  background:#1a1613;\n"
    "  border-left:1px solid rgba(174,133,78,.26);\n"
    "  transform:translateX(101%);\n"
    "  transition:transform .72s cubic-bezier(.16,1,.3,1);\n"
    "  overflow:hidden;\n"
    "}\n"
    ".pshop.is-open{ transform:translateX(0) }\n"
    ".pshop::before{\n"
    "  content:\"\"; position:absolute; inset:0; z-index:0; pointer-events:none;\n"
    "  background-image:url('/textures/noise.png');\n"
    "  background-size:13rem; opacity:.12; mix-blend-mode:soft-light;\n"
    "}\n"
    ".pshop > *{ position:relative; z-index:1 }\n"
    "\n"
    "/* the order tab lives in the head and carries the count */\n"
    ".ps-tab{\n"
    "  margin-left:auto;\n"
    "  display:inline-flex; align-items:center; gap:.5em;\n"
    "  height:38px; padding:0 1em;\n"
    "  border:1px solid rgba(196,169,110,.3); border-radius:6px;\n"
    "  background:rgba(255,255,255,.03);\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.15rem;\n"
    "  color:rgba(243,237,225,.82); cursor:pointer;\n"
    "  transition:background 160ms ease, color 160ms ease;\n"
    "}\n"
    ".ps-tab:hover{ background:rgba(196,169,110,.14); color:#fff }\n"
    ".ps-tab b{\n"
    "  font-family:var(--sans); font-style:normal; font-size:.78rem;\n"
    "  min-width:1.5em; padding:.15em .45em; border-radius:999px;\n"
    "  background:var(--oxblood); color:var(--vellum-100);\n"
    "}\n"
    "\n"
    "/* ---- the wall and the flyout ------------------------------------------ */\n"
    ".ps-body{ flex:1; min-height:0; display:flex; gap:1.1rem; overflow:hidden }\n"
    ".ps-body[hidden]{ display:none }\n"
    ".ps-wall{\n"
    "  flex:1; min-width:0; overflow-y:auto; padding-bottom:1.4rem;\n"
    "  display:grid; grid-template-columns:repeat(auto-fill, minmax(190px,1fr));\n"
    "  gap:1rem; align-content:start;\n"
    "}\n"
    ".ps-pc{\n"
    "  position:relative; border-radius:6px; overflow:hidden; cursor:pointer;\n"
    "  background:var(--coffee-700); border:1px solid rgba(196,169,110,.16);\n"
    "  transition:border-color 200ms ease;\n"
    "}\n"
    ".ps-pc:hover{ border-color:rgba(196,169,110,.42) }\n"
    ".ps-pc.is-on{ border-color:var(--gold); box-shadow:0 0 0 1px var(--gold) inset }\n"
    ".ps-pc img{ width:100%; aspect-ratio:1; object-fit:cover; display:block }\n"
    ".ps-pc .nm{\n"
    "  padding:.5em .7em; font-family:var(--serif); font-style:italic;\n"
    "  font-size:1.05rem; color:rgba(243,237,225,.86); text-align:center;\n"
    "}\n"
    ".ps-pc .tag{\n"
    "  position:absolute; top:.5em; right:.5em;\n"
    "  font-family:var(--sans); font-size:.68rem; letter-spacing:.05em;\n"
    "  padding:.2em .6em; border-radius:999px;\n"
    "  background:var(--oxblood); color:var(--vellum-100);\n"
    "}\n"
    "/* a piece that has not finished saving has no URL Prodigi could fetch */\n"
    ".ps-pc.is-waiting{ opacity:.42; cursor:default }\n"
    ".ps-pc.is-waiting .tag{ background:rgba(255,255,255,.12) }\n"
    "\n"
    ".ps-fly{\n"
    "  width:clamp(280px, 24%, 380px); flex:0 0 auto;\n"
    "  overflow-y:auto; padding:1rem 1.1rem 1.4rem;\n"
    "  background:var(--coffee-700); border:1px solid rgba(196,169,110,.22);\n"
    "  border-radius:10px;\n"
    "}\n"
    ".ps-fly[hidden]{ display:none }\n"
    ".ps-fly img.art{\n"
    "  width:100%; aspect-ratio:1; object-fit:cover;\n"
    "  border-radius:8px; margin-bottom:.7em; display:block;\n"
    "}\n"
    ".ps-fly h3{\n"
    "  font-family:var(--serif); font-style:italic; font-weight:400;\n"
    "  font-size:1.4rem; color:var(--vellum-100); margin-bottom:.15em;\n"
    "}\n"
    ".ps-lab{\n"
    "  font-family:var(--sans); font-size:.7rem; letter-spacing:.16em;\n"
    "  text-transform:uppercase; color:var(--gold); margin:1em 0 .5em;\n"
    "}\n"
    ".ps-opt{\n"
    "  display:flex; align-items:baseline; gap:.6em; width:100%;\n"
    "  padding:.6em .8em; margin-bottom:.4em;\n"
    "  border:1px solid rgba(196,169,110,.22); border-radius:7px;\n"
    "  background:rgba(255,255,255,.02); cursor:pointer; text-align:left;\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.12rem;\n"
    "  color:rgba(243,237,225,.88);\n"
    "  transition:border-color 160ms ease, background 160ms ease;\n"
    "}\n"
    ".ps-opt:hover{ border-color:rgba(196,169,110,.5) }\n"
    ".ps-opt.is-on{ border-color:var(--gold); background:rgba(196,169,110,.12); color:#fff }\n"
    ".ps-opt .pr{ margin-left:auto; font-family:var(--sans); font-style:normal; font-size:.95rem }\n"
    ".ps-opt .note{\n"
    "  display:block; font-family:var(--sans); font-style:normal;\n"
    "  font-size:.72rem; color:var(--taupe); margin-top:.2em;\n"
    "}\n"
    ".ps-add{\n"
    "  width:100%; margin-top:.9em; padding:.75em;\n"
    "  border:0; border-radius:8px; background:var(--oxblood);\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.25rem;\n"
    "  color:var(--vellum-100); cursor:pointer;\n"
    "}\n"
    ".ps-add:disabled{ opacity:.45; cursor:default }\n"
    "\n"
    "/* ---- the order --------------------------------------------------------- */\n"
    ".ps-cart{ flex:1; min-width:0; overflow-y:auto; padding-bottom:1.4rem }\n"
    ".ps-line{\n"
    "  display:flex; align-items:center; gap:1em;\n"
    "  padding:.7em .9em; margin-bottom:.6em;\n"
    "  background:var(--coffee-700); border:1px solid rgba(196,169,110,.16);\n"
    "  border-radius:8px;\n"
    "}\n"
    ".ps-line img{ width:64px; height:64px; border-radius:6px; object-fit:cover; flex:0 0 auto }\n"
    ".ps-line .info{ flex:1; min-width:0 }\n"
    ".ps-line .ti{\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.2rem;\n"
    "  color:var(--vellum-100);\n"
    "}\n"
    ".ps-line .pf{ font-family:var(--sans); font-size:.78rem; color:var(--taupe); margin-top:.2em }\n"
    ".ps-qty{\n"
    "  display:flex; align-items:center; gap:.55em;\n"
    "  border:1px solid rgba(196,169,110,.22); border-radius:999px; padding:.2em .35em;\n"
    "}\n"
    ".ps-qty button{\n"
    "  width:26px; height:26px; border-radius:50%; border:0; cursor:pointer;\n"
    "  background:rgba(255,255,255,.06); color:rgba(243,237,225,.8); font-size:1rem;\n"
    "}\n"
    ".ps-qty span{ font-family:var(--sans); font-size:.9rem; min-width:1.2em; text-align:center;\n"
    "  color:var(--vellum-100) }\n"
    ".ps-line .lp{ font-family:var(--sans); font-size:1rem; width:5em; text-align:right;\n"
    "  color:var(--vellum-100) }\n"
    ".ps-rm{ border:0; background:none; color:var(--taupe); font-size:1.2rem; cursor:pointer }\n"
    "\n"
    "/* the address. Second register throughout — this is a form, not a letter. */\n"
    ".ps-addr{ display:grid; grid-template-columns:1fr 1fr; gap:.5em; margin:1.2em 0 }\n"
    ".ps-addr .wide{ grid-column:1 / -1 }\n"
    ".ps-addr input, .ps-addr select{\n"
    "  width:100%; padding:.6em .7em;\n"
    "  border:1px solid rgba(196,169,110,.22); border-radius:6px;\n"
    "  background:rgba(255,255,255,.03); color:var(--vellum-100);\n"
    "  font-family:var(--sans); font-size:.88rem;\n"
    "}\n"
    ".ps-addr input:focus, .ps-addr select:focus{ outline:1px solid var(--gold) }\n"
    ".ps-addr input::placeholder{ color:rgba(243,237,225,.36) }\n"
    "\n"
    ".ps-summ{\n"
    "  display:flex; align-items:center; gap:1em; flex-wrap:wrap;\n"
    "  padding:1em 1.2em; border-radius:8px;\n"
    "  background:rgba(196,169,110,.1); border:1px solid rgba(196,169,110,.28);\n"
    "}\n"
    ".ps-summ .rows{ flex:1; min-width:180px; font-family:var(--sans); font-size:.86rem;\n"
    "  color:rgba(243,237,225,.7); line-height:1.7 }\n"
    ".ps-summ .rows b{ float:right; color:var(--vellum-100); font-weight:500 }\n"
    ".ps-summ .tot{ font-family:var(--serif); font-style:italic; font-size:1.3rem;\n"
    "  color:var(--vellum-100) }\n"
    ".ps-summ .tot b{ font-family:var(--sans); font-style:normal; font-size:1.5rem;\n"
    "  margin-left:.4em }\n"
    ".ps-co{\n"
    "  padding:.75em 1.6em; border:0; border-radius:8px; background:var(--oxblood);\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.25rem;\n"
    "  color:var(--vellum-100); cursor:pointer;\n"
    "}\n"
    ".ps-co:disabled{ opacity:.45; cursor:default }\n"
    ".ps-note{\n"
    "  font-family:var(--sans); font-size:.8rem; color:var(--taupe);\n"
    "  margin-top:.7em; line-height:1.5;\n"
    "}\n"
    ".ps-empty{\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.2rem;\n"
    "  color:rgba(243,237,225,.5); padding:2em 0;\n"
    "}\n"
    "\n"
    "/* ---- head ------------------------------------------------------------- */\r\n"
    ".mc-head{",
    'print shop css',
)

# ────────────────────────────────────────────────────────────────── 2 · markup

doc = rep(
    doc,
    "  <!-- ============================================================\r\n"
    "       THE LIGHTBOX · the one thing that does cover the Curator\r\n"
    "       ============================================================ -->",

    "  <!-- ============================================================\r\n"
    "       THE PRINT SHOP · the same slide-over as My Collection, and the\r\n"
    "       same promise: the Curator is never covered.\r\n"
    "       ============================================================ -->\r\n"
    "  <section class=\"pshop\" id=\"pshop\" aria-hidden=\"true\" aria-label=\"Print Shop\">\r\n"
    "    <div class=\"mc-head\">\r\n"
    "      <button class=\"mc-close\" id=\"psClose\" type=\"button\">\r\n"
    "        <svg viewBox=\"0 0 16 16\" aria-hidden=\"true\"><path d=\"M10 3 5 8l5 5\"/></svg>\r\n"
    "        Back to the workshop\r\n"
    "      </button>\r\n"
    "      <span class=\"mc-title\" id=\"psTitle\">Print Shop</span>\r\n"
    "      <span class=\"mc-n\" id=\"psN\"></span>\r\n"
    "      <button class=\"ps-tab\" id=\"psTab\" type=\"button\">Your order <b id=\"psTabN\">0</b></button>\r\n"
    "    </div>\r\n"
    "    <p class=\"mc-say\" id=\"psSay\"></p>\r\n"
    "\r\n"
    "    <div class=\"ps-body\" id=\"psWallBody\">\r\n"
    "      <div class=\"ps-wall\" id=\"psGrid\"></div>\r\n"
    "      <aside class=\"ps-fly\" id=\"psFly\" hidden></aside>\r\n"
    "    </div>\r\n"
    "\r\n"
    "    <div class=\"ps-body\" id=\"psCartBody\" hidden>\r\n"
    "      <div class=\"ps-cart\" id=\"psCart\"></div>\r\n"
    "    </div>\r\n"
    "  </section>\r\n"
    "\r\n"
    "  <!-- ============================================================\r\n"
    "       THE LIGHTBOX · the one thing that does cover the Curator\r\n"
    "       ============================================================ -->",
    'print shop markup',
)

# ────────────────────────────────────────────────────────────────────── 3 · JS

JS = (
    "  /* ======================================================================\r\n"
    "     THE PRINT SHOP\r\n"
    "\r\n"
    "     Four routes have existed since July and none had ever been called from\r\n"
    "     the glass. /print/quote prices the shipping against a live Prodigi\r\n"
    "     call; /print/checkout writes the order row and returns a Stripe URL.\r\n"
    "\r\n"
    "     PRINT_OPTS is generated — read out of lib/v1/print/sku-map.ts at build\r\n"
    "     time, so the shop cannot offer a size Prodigi has no SKU for and the\r\n"
    "     price has exactly one home. The July mockup drew a product and an\r\n"
    "     edge finish that have no SKU behind them; neither is offered here.\r\n"
    "     ====================================================================== */\r\n"
    "  var QUOTE_URL    = '/api/v1/print/quote';\r\n"
    "  var PRINT_CO_URL = '/api/v1/print/checkout';\r\n"
    "\r\n"
    + PRINT_OPTS + "\r\n"
    "\r\n"
    "  var ORDER    = [];      /* {lid, pieceId, renderId, name, art, size, finish, copies, cents} */\r\n"
    "  var PS_PIECE = null;    /* the piece open in the flyout */\r\n"
    "  var PS_OPT   = 0;\r\n"
    "  var PS_SHIP  = null;    /* the last quote, or null when it is stale */\r\n"
    "  var PS_LID   = 0;\r\n"
    "  var pshop    = document.getElementById('pshop');\r\n"
    "\r\n"
    "  function money(c){ return '$' + (c / 100).toFixed(2); }\r\n"
    "\r\n"
    "  /* Prodigi fetches the asset itself, so a piece with no signed URL cannot\r\n"
    "     be printed. That is a piece still saving, not a piece that failed. */\r\n"
    "  function printable(p){\r\n"
    "    return !!(p && p.art && p.serverId && String(p.art).indexOf('data:') !== 0);\r\n"
    "  }\r\n"
    "\r\n"
    "  function orderCount(){\r\n"
    "    return ORDER.reduce(function(n, l){ return n + l.copies; }, 0);\r\n"
    "  }\r\n"
    "  function orderSubtotal(){\r\n"
    "    return ORDER.reduce(function(n, l){ return n + l.cents * l.copies; }, 0);\r\n"
    "  }\r\n"
    "\r\n"
    "  function showPrintShop(){\r\n"
    "    if (!pshop) return;\r\n"
    "    if (typeof hideCollection === 'function') hideCollection();\r\n"
    "    renderWall();\r\n"
    "    pshop.classList.add('is-open');\r\n"
    "    pshop.setAttribute('aria-hidden', 'false');\r\n"
    "  }\r\n"
    "  function hidePrintShop(){\r\n"
    "    if (!pshop) return;\r\n"
    "    pshop.classList.remove('is-open');\r\n"
    "    pshop.setAttribute('aria-hidden', 'true');\r\n"
    "  }\r\n"
    "\r\n"
    "  function psView(which){\r\n"
    "    var w = document.getElementById('psWallBody');\r\n"
    "    var c = document.getElementById('psCartBody');\r\n"
    "    var t = document.getElementById('psTitle');\r\n"
    "    var tab = document.getElementById('psTab');\r\n"
    "    if (!w || !c) return;\r\n"
    "    var cart = which === 'cart';\r\n"
    "    w.hidden = cart; c.hidden = !cart;\r\n"
    "    if (t)   t.textContent = cart ? 'Your Print Order' : 'Print Shop';\r\n"
    "    if (tab) tab.firstChild.nodeValue = cart ? 'Choose more pieces ' : 'Your order ';\r\n"
    "    if (cart) renderCart(); else renderWall();\r\n"
    "  }\r\n"
    "\r\n"
    "  /* ---- the wall ---------------------------------------------------------- */\r\n"
    "  function renderWall(){\r\n"
    "    var g = document.getElementById('psGrid');\r\n"
    "    var say = document.getElementById('psSay');\r\n"
    "    var n = document.getElementById('psN');\r\n"
    "    if (!g) return;\r\n"
    "    var list = PIECES.filter(function(p){ return p.art && !p.crafting; });\r\n"
    "    if (n) n.textContent = list.length + (list.length === 1 ? ' PIECE' : ' PIECES');\r\n"
    "    if (say){\r\n"
    "      say.textContent = list.length\r\n"
    "        ? 'Choose a piece, a size, and how it should be framed.'\r\n"
    "        : 'Nothing to print yet. Craft something first and it will appear here.';\r\n"
    "    }\r\n"
    "    g.innerHTML = '';\r\n"
    "    list.forEach(function(p){\r\n"
    "      var ok = printable(p);\r\n"
    "      var el = document.createElement('article');\r\n"
    "      el.className = 'ps-pc' + (ok ? '' : ' is-waiting') +\r\n"
    "                     (PS_PIECE && PS_PIECE.id === p.id ? ' is-on' : '');\r\n"
    "      el.dataset.pieceId = p.id;\r\n"
    "      var inOrder = ORDER.some(function(l){ return l.pieceId === p.id; });\r\n"
    "      el.innerHTML =\r\n"
    "        (ok ? (inOrder ? '<span class=\"tag\">In your order</span>' : '')\r\n"
    "            : '<span class=\"tag\">saving\\u2026</span>') +\r\n"
    "        '<img src=\"' + esc(p.art) + '\" alt=\"\" loading=\"lazy\">' +\r\n"
    "        '<div class=\"nm\">' + esc(p.name || 'Crafted Image') + '</div>';\r\n"
    "      g.appendChild(el);\r\n"
    "    });\r\n"
    "    updateTab();\r\n"
    "    renderFly();\r\n"
    "  }\r\n"
    "\r\n"
    "  /* ---- the flyout -------------------------------------------------------- */\r\n"
    "  function renderFly(){\r\n"
    "    var f = document.getElementById('psFly');\r\n"
    "    if (!f) return;\r\n"
    "    if (!PS_PIECE){ f.hidden = true; f.innerHTML = ''; return; }\r\n"
    "    f.hidden = false;\r\n"
    "    var opts = PRINT_OPTS.map(function(o, i){\r\n"
    "      return '<button class=\"ps-opt' + (i === PS_OPT ? ' is-on' : '') +\r\n"
    "             '\" type=\"button\" data-opt=\"' + i + '\">' +\r\n"
    "             '<span>' + esc(o.label) +\r\n"
    "             '<span class=\"note\">' + esc(o.note) + '</span></span>' +\r\n"
    "             '<span class=\"pr\">' + money(o.cents) + '</span></button>';\r\n"
    "    }).join('');\r\n"
    "    f.innerHTML =\r\n"
    "      '<img class=\"art\" src=\"' + esc(PS_PIECE.art) + '\" alt=\"\">' +\r\n"
    "      '<h3>' + esc(PS_PIECE.name || 'Crafted Image') + '</h3>' +\r\n"
    "      '<div class=\"ps-lab\">Size and finish</div>' + opts +\r\n"
    "      '<button class=\"ps-add\" id=\"psAdd\" type=\"button\">Add to your order</button>';\r\n"
    "  }\r\n"
    "\r\n"
    "  function addToOrder(){\r\n"
    "    if (!PS_PIECE || !printable(PS_PIECE)) return;\r\n"
    "    var o = PRINT_OPTS[PS_OPT];\r\n"
    "    if (!o) return;\r\n"
    "    /* The same piece may be ordered at more than one size, so a line is\r\n"
    "       keyed by piece AND option rather than by piece alone. */\r\n"
    "    var at = -1;\r\n"
    "    ORDER.forEach(function(l, i){\r\n"
    "      if (l.pieceId === PS_PIECE.id && l.size === o.size && l.finish === o.finish) at = i;\r\n"
    "    });\r\n"
    "    if (at >= 0){ ORDER[at].copies += 1; }\r\n"
    "    else {\r\n"
    "      ORDER.push({\r\n"
    "        lid:      'l' + (++PS_LID),\r\n"
    "        pieceId:  PS_PIECE.id,\r\n"
    "        renderId: PS_PIECE.serverId,\r\n"
    "        name:     PS_PIECE.name,\r\n"
    "        art:      PS_PIECE.art,\r\n"
    "        size:     o.size,\r\n"
    "        finish:   o.finish,\r\n"
    "        copies:   1,\r\n"
    "        cents:    o.cents\r\n"
    "      });\r\n"
    "    }\r\n"
    "    PS_SHIP = null;   /* the order changed; the quote is no longer true */\r\n"
    "    renderWall();\r\n"
    "  }\r\n"
    "\r\n"
    "  function updateTab(){\r\n"
    "    var b = document.getElementById('psTabN');\r\n"
    "    if (b) b.textContent = String(orderCount());\r\n"
    "  }\r\n"
    "\r\n"
    "  /* ---- the order --------------------------------------------------------- */\r\n"
    "  function addrValues(){\r\n"
    "    function v(id){\r\n"
    "      var el = document.getElementById(id);\r\n"
    "      return el ? el.value.trim() : '';\r\n"
    "    }\r\n"
    "    return {\r\n"
    "      name: v('psName'), line1: v('psL1'), line2: v('psL2'),\r\n"
    "      city: v('psCity'), state: v('psState'), postcode: v('psZip'),\r\n"
    "      countryCode: v('psCountry') || 'US', email: v('psEmail')\r\n"
    "    };\r\n"
    "  }\r\n"
    "  function addrComplete(a){\r\n"
    "    return !!(a.name && a.line1 && a.city && a.postcode && a.countryCode && a.email);\r\n"
    "  }\r\n"
    "\r\n"
    "  function renderCart(){\r\n"
    "    var c = document.getElementById('psCart');\r\n"
    "    var say = document.getElementById('psSay');\r\n"
    "    var n = document.getElementById('psN');\r\n"
    "    if (!c) return;\r\n"
    "    updateTab();\r\n"
    "    if (n) n.textContent = orderCount() + (orderCount() === 1 ? ' PRINT' : ' PRINTS');\r\n"
    "    if (!ORDER.length){\r\n"
    "      if (say) say.textContent = '';\r\n"
    "      c.innerHTML = '<p class=\"ps-empty\">Nothing in your order yet.</p>';\r\n"
    "      return;\r\n"
    "    }\r\n"
    "    if (say) say.textContent = 'Where should these go?';\r\n"
    "    var a = addrValues();\r\n"
    "    var lines = ORDER.map(function(l){\r\n"
    "      var o = PRINT_OPTS.filter(function(x){\r\n"
    "        return x.size === l.size && x.finish === l.finish; })[0];\r\n"
    "      return '<div class=\"ps-line\" data-lid=\"' + l.lid + '\">' +\r\n"
    "        '<img src=\"' + esc(l.art) + '\" alt=\"\">' +\r\n"
    "        '<div class=\"info\"><div class=\"ti\">' + esc(l.name || 'Crafted Image') + '</div>' +\r\n"
    "        '<div class=\"pf\">' + esc((o && o.label) || l.size) + ' \\u00b7 ' +\r\n"
    "          esc(l.finish === 'framed' ? 'Framed' : 'Unframed') + '</div></div>' +\r\n"
    "        '<div class=\"ps-qty\">' +\r\n"
    "          '<button type=\"button\" data-q=\"-\">\\u2212</button>' +\r\n"
    "          '<span>' + l.copies + '</span>' +\r\n"
    "          '<button type=\"button\" data-q=\"+\">+</button>' +\r\n"
    "        '</div>' +\r\n"
    "        '<div class=\"lp\">' + money(l.cents * l.copies) + '</div>' +\r\n"
    "        '<button class=\"ps-rm\" type=\"button\" data-rm=\"1\">\\u00d7</button>' +\r\n"
    "      '</div>';\r\n"
    "    }).join('');\r\n"
    "\r\n"
    "    var sub = orderSubtotal();\r\n"
    "    var ship = PS_SHIP ? PS_SHIP.retailShippingCents : null;\r\n"
    "    var tot = ship == null ? null : sub + ship;\r\n"
    "\r\n"
    "    c.innerHTML = lines +\r\n"
    "      '<div class=\"ps-lab\">Where it goes</div>' +\r\n"
    "      '<div class=\"ps-addr\">' +\r\n"
    "        '<input class=\"wide\" id=\"psEmail\" type=\"email\" placeholder=\"Email for the receipt\" value=\"' +\r\n"
    "          esc(a.email || (ME && ME.email) || '') + '\">' +\r\n"
    "        '<input class=\"wide\" id=\"psName\"  placeholder=\"Full name\" value=\"' + esc(a.name) + '\">' +\r\n"
    "        '<input class=\"wide\" id=\"psL1\"    placeholder=\"Address\" value=\"' + esc(a.line1) + '\">' +\r\n"
    "        '<input class=\"wide\" id=\"psL2\"    placeholder=\"Apartment, suite (optional)\" value=\"' + esc(a.line2) + '\">' +\r\n"
    "        '<input id=\"psCity\"  placeholder=\"City\" value=\"' + esc(a.city) + '\">' +\r\n"
    "        '<input id=\"psState\" placeholder=\"State or county\" value=\"' + esc(a.state) + '\">' +\r\n"
    "        '<input id=\"psZip\"   placeholder=\"Postcode\" value=\"' + esc(a.postcode) + '\">' +\r\n"
    "        '<select id=\"psCountry\">' +\r\n"
    "          '<option value=\"US\">United States</option>' +\r\n"
    "          '<option value=\"CA\">Canada</option>' +\r\n"
    "          '<option value=\"GB\">United Kingdom</option>' +\r\n"
    "          '<option value=\"AU\">Australia</option>' +\r\n"
    "        '</select>' +\r\n"
    "      '</div>' +\r\n"
    "      '<div class=\"ps-summ\">' +\r\n"
    "        '<div class=\"rows\">Prints <b>' + money(sub) + '</b><br>' +\r\n"
    "          'Shipping <b>' + (ship == null ? 'once we have your address' : money(ship)) + '</b></div>' +\r\n"
    "        '<span class=\"tot\">Total<b>' + (tot == null ? '\\u2014' : money(tot)) + '</b></span>' +\r\n"
    "        '<button class=\"ps-co\" id=\"psCo\" type=\"button\"' +\r\n"
    "          (tot == null ? ' disabled' : '') + '>Checkout</button>' +\r\n"
    "      '</div>' +\r\n"
    "      '<p class=\"ps-note\">Prints are made and posted by our fulfilment lab. ' +\r\n"
    "        'Payment is taken on the next screen.</p>';\r\n"
    "\r\n"
    "    var sel = document.getElementById('psCountry');\r\n"
    "    if (sel) sel.value = a.countryCode || 'US';\r\n"
    "  }\r\n"
    "\r\n"
    "  /* The shipping is Prodigi's answer, never ours. Asked for whenever the\r\n"
    "     order or the destination changes, and held null in between so a stale\r\n"
    "     number can never reach a total. */\r\n"
    "  function askQuote(){\r\n"
    "    var a = addrValues();\r\n"
    "    if (!ORDER.length || !a.countryCode || !a.postcode){ PS_SHIP = null; return; }\r\n"
    "    var want = JSON.stringify([ORDER.map(function(l){\r\n"
    "      return [l.size, l.finish, l.copies]; }), a.countryCode, a.postcode]);\r\n"
    "    fetch(QUOTE_URL, {\r\n"
    "      method:'POST',\r\n"
    "      headers:{ 'Content-Type':'application/json' },\r\n"
    "      credentials:'same-origin',\r\n"
    "      body: JSON.stringify({\r\n"
    "        items: ORDER.map(function(l){\r\n"
    "          return { size:l.size, finish:l.finish, copies:l.copies }; }),\r\n"
    "        destination: { countryCode:a.countryCode, postcode:a.postcode },\r\n"
    "        shippingMethod: 'Budget'\r\n"
    "      })\r\n"
    "    }).then(function(r){ return r.json(); }).then(function(d){\r\n"
    "      if (!d || d.error || typeof d.retailShippingCents !== 'number'){\r\n"
    "        console.warn('[print] quote failed:', (d && d.error) || 'no shipping');\r\n"
    "        PS_SHIP = null; renderCart(); return;\r\n"
    "      }\r\n"
    "      /* The order may have moved while the quote was in the air. */\r\n"
    "      var now = JSON.stringify([ORDER.map(function(l){\r\n"
    "        return [l.size, l.finish, l.copies]; }),\r\n"
    "        addrValues().countryCode, addrValues().postcode]);\r\n"
    "      if (now !== want) return;\r\n"
    "      PS_SHIP = d;\r\n"
    "      renderCart();\r\n"
    "    }).catch(function(e){\r\n"
    "      console.warn('[print] quote failed:', e.message || e);\r\n"
    "      PS_SHIP = null; renderCart();\r\n"
    "    });\r\n"
    "  }\r\n"
    "\r\n"
    "  function printCheckout(){\r\n"
    "    var a = addrValues();\r\n"
    "    if (!ORDER.length || !addrComplete(a) || !PS_SHIP) return;\r\n"
    "    var btn = document.getElementById('psCo');\r\n"
    "    if (btn){ btn.disabled = true; btn.textContent = 'One moment\\u2026'; }\r\n"
    "    var back = window.location.origin + window.location.pathname;\r\n"
    "    fetch(PRINT_CO_URL, {\r\n"
    "      method:'POST',\r\n"
    "      headers:{ 'Content-Type':'application/json' },\r\n"
    "      credentials:'same-origin',\r\n"
    "      body: JSON.stringify({\r\n"
    "        items: ORDER.map(function(l){\r\n"
    "          return { renderId:l.renderId, renderUrl:l.art,\r\n"
    "                   size:l.size, finish:l.finish, copies:l.copies }; }),\r\n"
    "        email: a.email,\r\n"
    "        shippingAddress: {\r\n"
    "          name:a.name, line1:a.line1, line2:a.line2 || undefined,\r\n"
    "          city:a.city, state:a.state || undefined,\r\n"
    "          postcode:a.postcode, countryCode:a.countryCode\r\n"
    "        },\r\n"
    "        shippingMethod: 'Budget',\r\n"
    "        successUrl: back + '?print=1&session={CHECKOUT_SESSION_ID}',\r\n"
    "        cancelUrl:  back + '?print=0'\r\n"
    "      })\r\n"
    "    }).then(function(r){ return r.json(); }).then(function(d){\r\n"
    "      if (d && d.checkoutUrl){ window.location.href = d.checkoutUrl; return; }\r\n"
    "      console.warn('[print] checkout failed:', (d && d.error) || 'no url');\r\n"
    "      if (btn){ btn.disabled = false; btn.textContent = 'Checkout'; }\r\n"
    "    }).catch(function(e){\r\n"
    "      console.warn('[print] checkout failed:', e.message || e);\r\n"
    "      if (btn){ btn.disabled = false; btn.textContent = 'Checkout'; }\r\n"
    "    });\r\n"
    "  }\r\n"
    "\r\n"
    "  /* ---- the handlers ------------------------------------------------------ */\r\n"
    "  var psGrid = document.getElementById('psGrid');\r\n"
    "  if (psGrid) psGrid.addEventListener('click', function(e){\r\n"
    "    var card = e.target.closest('.ps-pc'); if (!card) return;\r\n"
    "    if (card.classList.contains('is-waiting')) return;\r\n"
    "    var id = card.dataset.pieceId;\r\n"
    "    PS_PIECE = PIECES.filter(function(p){ return p.id === id; })[0] || null;\r\n"
    "    PS_OPT = 0;\r\n"
    "    renderWall();\r\n"
    "  });\r\n"
    "\r\n"
    "  var psFly = document.getElementById('psFly');\r\n"
    "  if (psFly) psFly.addEventListener('click', function(e){\r\n"
    "    var o = e.target.closest('[data-opt]');\r\n"
    "    if (o){ PS_OPT = parseInt(o.dataset.opt, 10) || 0; renderFly(); return; }\r\n"
    "    if (e.target.closest('#psAdd')) addToOrder();\r\n"
    "  });\r\n"
    "\r\n"
    "  var psCartEl = document.getElementById('psCart');\r\n"
    "  if (psCartEl) psCartEl.addEventListener('click', function(e){\r\n"
    "    var line = e.target.closest('.ps-line');\r\n"
    "    if (line){\r\n"
    "      var lid = line.dataset.lid;\r\n"
    "      var at = -1;\r\n"
    "      ORDER.forEach(function(l, i){ if (l.lid === lid) at = i; });\r\n"
    "      if (at < 0) return;\r\n"
    "      if (e.target.closest('[data-rm]')) ORDER.splice(at, 1);\r\n"
    "      else {\r\n"
    "        var q = e.target.closest('[data-q]');\r\n"
    "        if (!q) return;\r\n"
    "        if (q.dataset.q === '+') ORDER[at].copies += 1;\r\n"
    "        else if (ORDER[at].copies > 1) ORDER[at].copies -= 1;\r\n"
    "        else ORDER.splice(at, 1);\r\n"
    "      }\r\n"
    "      PS_SHIP = null;\r\n"
    "      renderCart();\r\n"
    "      askQuote();\r\n"
    "      return;\r\n"
    "    }\r\n"
    "    if (e.target.closest('#psCo')) printCheckout();\r\n"
    "  });\r\n"
    "\r\n"
    "  /* A quote on every keystroke would hammer Prodigi. This waits for the\r\n"
    "     typing to stop. */\r\n"
    "  var psQuoteTimer = null;\r\n"
    "  if (psCartEl) psCartEl.addEventListener('input', function(){\r\n"
    "    PS_SHIP = null;\r\n"
    "    clearTimeout(psQuoteTimer);\r\n"
    "    psQuoteTimer = setTimeout(askQuote, 600);\r\n"
    "  });\r\n"
    "\r\n"
    "  var psTab = document.getElementById('psTab');\r\n"
    "  if (psTab) psTab.addEventListener('click', function(){\r\n"
    "    var c = document.getElementById('psCartBody');\r\n"
    "    psView(c && c.hidden ? 'cart' : 'wall');\r\n"
    "  });\r\n"
    "  var psCloseBtn = document.getElementById('psClose');\r\n"
    "  if (psCloseBtn) psCloseBtn.addEventListener('click', hidePrintShop);\r\n"
    "\r\n"
    "  window.__showPrintShop = showPrintShop;\r\n"
    "\r\n"
)

doc = rep(
    doc,
    "  window.__showCollection = showCollection;",
    JS + "  window.__showCollection = showCollection;",
    'print shop js',
)

# ─────────────────────────────────────────────── 4 · the ways in, now they lead

doc = rep(
    doc,
    "  if (mcPrint) mcPrint.addEventListener('click', function(){\r\n"
    "    flash(mcPrint, 'Sent ' + mcCount() + ' to the Print Shop \\u2713', 'Send to Print Shop');\r\n"
    "  });",

    "  /* Was a flash over nothing. The Print Shop exists now, so this opens it\r\n"
    "     with the picked pieces already on the wall. */\r\n"
    "  if (mcPrint) mcPrint.addEventListener('click', function(){\r\n"
    "    var picked = PIECES.filter(function(p){ return PICKED[p.id] && printable(p); });\r\n"
    "    if (picked.length === 1){ PS_PIECE = picked[0]; PS_OPT = 0; }\r\n"
    "    psView('wall');\r\n"
    "    showPrintShop();\r\n"
    "  });",
    'bulk print',
)

doc = rep(
    doc,
    "      if (p1) p1.addEventListener('click', function(){ flash(p1, "
    "'Sent to the Print Shop \\u2713', 'Send to Print Shop'); });",
    "      if (p1) p1.addEventListener('click', function(){\r\n"
    "        if (printable(feat)){ PS_PIECE = feat; PS_OPT = 0; }\r\n"
    "        psView('wall');\r\n"
    "        showPrintShop();\r\n"
    "      });",
    'featured print',
)

doc = rep(
    doc,
    "    else if (what === 'pr') flash(b, 'Sent to the Print Shop \\u2713', 'Send to Print Shop');",
    "    else if (what === 'pr'){\r\n"
    "      var piece = lbList()[LB_AT];\r\n"
    "      if (printable(piece)){ PS_PIECE = piece; PS_OPT = 0; }\r\n"
    "      closeLightbox();\r\n"
    "      psView('wall');\r\n"
    "      showPrintShop();\r\n"
    "    }",
    'lightbox print',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != ROUTES_AFTER:
    die('route count is %d, expected %d' % (routes, ROUTES_AFTER))
for u in ('fetch(QUOTE_URL', 'fetch(PRINT_CO_URL'):
    if doc.count(u) != 1:
        die('%s is not called exactly once' % u)

# the shelf came from the price authority, not from this file
if 'var PRINT_OPTS = [' not in doc:
    die('the shelf was not inlined')
for o in OPTS:
    if json.dumps(o['size']) not in doc:
        die('size %s did not reach the shelf' % o['size'])
# The shelf may hold nothing the price authority did not name
shelf = doc[doc.index('var PRINT_OPTS = ['):]
shelf = shelf[:shelf.index('];') + 2]
for stray in ('12x12', '16x16', '20x20', '24x24', 'wrap'):
    if stray in shelf:
        die('the July mockup reached the shelf: %s' % stray)
if shelf.count('size:') != len(OPTS):
    die('the shelf holds %d options, sku-map.ts has %d'
        % (shelf.count('size:'), len(OPTS)))

# no flash-over-nothing survives on the print path
if 'Sent to the Print Shop \\u2713' in doc or "Sent ' + mcCount()" in doc:
    die('a flash-only Print Shop action survived')

# every class in the new markup carries a rule
for sel in ('.pshop{', '.ps-tab{', '.ps-wall{', '.ps-pc{', '.ps-fly{', '.ps-opt{',
            '.ps-add{', '.ps-cart{', '.ps-line{', '.ps-qty{', '.ps-rm{',
            '.ps-addr{', '.ps-summ{', '.ps-co{', '.ps-note{', '.ps-empty{',
            '.ps-lab{', '.ps-body{', '.ps-pc.is-waiting{'):
    if sel not in doc:
        die('no rule for %s' % sel)

# a stale quote must never reach a total
if doc.count('PS_SHIP = null') < 4:
    die('the quote is not invalidated on every change')
if 'if (now !== want) return;' not in doc:
    die('a quote that lands late is not discarded')

# only a persisted piece may be printed
if 'function printable(' not in doc:
    die('nothing guards an unprintable piece')
if "String(p.art).indexOf('data:') !== 0" not in doc:
    die('a data URL could still be sent to Prodigi')

# declared above their readers
for name, reader in (('var ORDER ', 'function orderCount('),
                     ('var PRINT_OPTS', 'function renderFly('),
                     ('var pshop ', 'function showPrintShop(')):
    if doc.index(name) > doc.index(reader):
        die('%s is declared below %s' % (name.strip(), reader))

if len(re.findall(r'data-s="[0-9]"', doc)) != 8:
    die('intake states are not 8')
for st in re.findall(r'<style[^>]*>(.*?)</style>', doc, re.S):
    if st.count('{') != st.count('}'):
        die('style block brace imbalance')

blocks = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', doc, re.S)
if not blocks:
    die('no script blocks found')
for n, blk in enumerate(blocks):
    fd, path = tempfile.mkstemp(suffix='.js')
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        f.write(blk)
    r = subprocess.run(['node', '--check', path], capture_output=True, text=True)
    os.unlink(path)
    if r.returncode != 0:
        die('node --check failed on script block %d\n%s' % (n, r.stderr))

boot = None
for name in ('boot.js', 'boot-test.js', 'boot_gate.js', 'boot_check.js'):
    p = os.path.join(ROOT, 'scripts', name)
    if os.path.exists(p):
        boot = p
        break
if boot is None:
    die('boot harness not found in scripts\\ — tell CUI its filename')

with open(OUT, 'w', encoding='utf-8', newline='') as f:
    f.write(doc)

r = subprocess.run(['node', boot, OUT], capture_output=True, text=True)
if r.returncode != 0:
    os.unlink(OUT)
    die('boot harness rejected the output\n%s%s' % (r.stdout, r.stderr))

print('GATE PASSED · %d print options read from sku-map.ts · %d routes'
      % (len(OPTS), routes))
for o in OPTS:
    print('   %-6s %-9s %s' % (o['size'], o['finish'], '$%.2f' % (o['cents'] / 100.0)))
print('wrote ' + OUT)
