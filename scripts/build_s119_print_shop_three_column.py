# -*- coding: utf-8 -*-
"""
build_s119_print_shop_three_column.py  ·  2026-08-04  ·  CUI V25

The Print Shop to Rich's redesign. Three columns, all visible at once.

    gallery (2-up) │ configurator │ your order

    The tab is gone. An order you cannot see while you are building it is an
    order you lose track of, and the tab meant every check of "what have I
    got so far" cost the piece you were configuring.

RICH'S FIVE RULINGS, 2026-08-04

  1 · Only what was sent to the shop appears. "Showing 8 of 53" was leftover
      text from the mockup; the ruling from this morning stands.
  2 · The order panel is coffee against the vellum, deliberately. It carries
      the most information and the clearest steps, and the contrast is what
      separates browsing from paying.
  3 · The mockup says "Shipping calculated at checkout". We have live
      Prodigi quotes with five named methods and real prices, chosen before
      paying. Ruled: keep what is built. The mockup is a mockup.
  4 · No names on the tiles.
  5 · Checkout is brass, not oxblood — the one action in the product that
      takes real money reads differently from the ones that do not.

Run from the repo root:  python scripts\\build_s119_print_shop_three_column.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-04-s118.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-04-s119.html')

EXPECTED_ROUTES = 17


def die(msg):
    print('GATE FAILED · ' + msg)
    sys.exit(1)


def rep(text, old, new, label):
    lf = (old.replace('\r\n', '\n'), new.replace('\r\n', '\n'))
    crlf = (lf[0].replace('\n', '\r\n'), lf[1].replace('\n', '\r\n'))
    for a, b in ((old, new), lf, crlf):
        if text.count(a) == 1:
            return text.replace(a, b)
    die('anchor "%s" appears %d times, expected 1' % (label, text.count(old)))


with open(SRC, encoding='utf-8', newline='') as f:
    src = f.read()

doc = src

# ───────────────────────────────────────────────────────────────── 1 · markup

doc = rep(
    doc,
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
    "    </div>\r\n",

    "      <span class=\"mc-title\" id=\"psTitle\">Print Shop</span>\r\n"
    "      <span class=\"mc-n\" id=\"psN\"></span>\r\n"
    "    </div>\r\n"
    "    <p class=\"mc-say\" id=\"psSay\"></p>\r\n"
    "\r\n"
    "    <!-- Three columns, all of them visible. The tab that used to hide the\r\n"
    "         order is gone: an order you cannot see while you build it is an\r\n"
    "         order you lose track of. -->\r\n"
    "    <div class=\"ps-body\" id=\"psWallBody\">\r\n"
    "      <div class=\"ps-wall\" id=\"psGrid\"></div>\r\n"
    "      <aside class=\"ps-fly\" id=\"psFly\" hidden></aside>\r\n"
    "      <aside class=\"ps-order\" id=\"psOrder\"></aside>\r\n"
    "    </div>\r\n",
    'three columns',
)

# ───────────────────────────────────────────────────────────────────── 2 · CSS

doc = rep(
    doc,
    ".ps-body{\n"
    "  flex:1; min-height:0; display:flex; gap:4rem; overflow:hidden;\n"
    "  margin:30px 30px 20px 30px;\n"
    "}\n",

    "/* Gallery, configurator, order. The gallery gives ground first when the\n"
    "   window narrows; the order panel never does — it is where the money is\n"
    "   and it must not be the thing that gets squeezed. */\n"
    ".ps-body{\n"
    "  flex:1; min-height:0; display:flex; gap:1.6rem; overflow:hidden;\n"
    "  margin:22px 22px 18px 22px;\n"
    "}\n",
    'ps-body three column',
)

doc = rep(
    doc,
    ".ps-wall{\n"
    "  flex:1; min-width:0; overflow-y:auto; padding-bottom:1.4rem;\n"
    "  display:grid; grid-template-columns:repeat(4, minmax(0,1fr));\n"
    "  gap:1.4rem; align-content:start;\n"
    "}\n"
    "@media (max-width:1500px){ .ps-wall{ grid-template-columns:repeat(3, minmax(0,1fr)) } }\n"
    "@media (max-width:1100px){ .ps-wall{ grid-template-columns:repeat(2, minmax(0,1fr)) } }\n",

    "/* Two up. The gallery is now one of three columns rather than the whole\n"
    "   screen, and four across in a third of the width is thumbnails again. */\n"
    ".ps-wall{\n"
    "  flex:1 1 26%; min-width:210px; overflow-y:auto; padding-right:.4rem;\n"
    "  display:grid; grid-template-columns:repeat(2, minmax(0,1fr));\n"
    "  gap:.8rem; align-content:start;\n"
    "}\n"
    "@media (max-width:1400px){ .ps-wall{ grid-template-columns:repeat(1, minmax(0,1fr)) } }\n",
    'gallery two up',
)

doc = rep(
    doc,
    ".ps-fly{\n"
    "  width:35%; flex:0 0 auto; align-self:flex-start;\n"
    "  max-height:100%; overflow-y:auto;\n"
    "  padding:1.4rem 1.5rem 1.6rem;\n"
    "  background:var(--coffee-700); border:1px solid rgba(196,169,110,.22);\n"
    "  border-radius:10px;\n"
    "}\n",

    "/* the configurator */\n"
    ".ps-fly{\n"
    "  flex:1 1 36%; min-width:300px; align-self:flex-start;\n"
    "  max-height:100%; overflow-y:auto;\n"
    "  padding:1.4rem 1.5rem 1.6rem;\n"
    "  background:var(--coffee-700); border:1px solid rgba(196,169,110,.22);\n"
    "  border-radius:10px;\n"
    "}\n"
    "\n"
    "/* ---- the order, in coffee ----------------------------------------------\n"
    "   Ruled 2026-08-04: deliberate contrast. It carries the most information\n"
    "   and the clearest steps, and the change of ground is what separates\n"
    "   browsing from paying. */\n"
    ".ps-order{\n"
    "  flex:0 0 30%; min-width:320px; max-width:440px;\n"
    "  display:flex; flex-direction:column; min-height:0;\n"
    "  overflow-y:auto;\n"
    "  padding:1.3rem 1.4rem 1.5rem;\n"
    "  border-radius:10px;\n"
    "  background:linear-gradient(180deg,#221a16 0%, #1b1512 100%);\n"
    "  border:1px solid rgba(196,169,110,.2);\n"
    "  box-shadow:0 1rem 2.4rem rgba(28,18,10,.28);\n"
    "}\n"
    ".ps-or-h{\n"
    "  display:flex; align-items:baseline; gap:.6em;\n"
    "  font-family:var(--serif); font-size:1.5rem; color:var(--vellum-100);\n"
    "}\n"
    ".ps-or-h .n{\n"
    "  font-family:var(--sans); font-size:.7rem; letter-spacing:.14em;\n"
    "  text-transform:uppercase; color:var(--gold);\n"
    "}\n"
    ".ps-or-sub{\n"
    "  font-family:var(--sans); font-size:.8rem; color:rgba(243,237,225,.55);\n"
    "  margin:.3em 0 1.1em; line-height:1.5;\n"
    "}\n"
    ".ps-or-line{\n"
    "  display:flex; align-items:center; gap:.8em;\n"
    "  padding:.7em; margin-bottom:.6em; border-radius:8px;\n"
    "  background:rgba(255,255,255,.035);\n"
    "  border:1px solid rgba(196,169,110,.14);\n"
    "}\n"
    ".ps-or-line img{\n"
    "  width:56px; height:56px; flex:0 0 auto; object-fit:cover; border-radius:5px;\n"
    "}\n"
    ".ps-or-line .info{ flex:1; min-width:0 }\n"
    ".ps-or-line .ti{\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.05rem;\n"
    "  color:var(--vellum-100); line-height:1.2;\n"
    "}\n"
    ".ps-or-line .pf{\n"
    "  font-family:var(--sans); font-size:.72rem; color:var(--taupe); margin-top:.25em;\n"
    "}\n"
    ".ps-or-line .lp{\n"
    "  font-family:var(--sans); font-size:.95rem; color:var(--vellum-100);\n"
    "  white-space:nowrap;\n"
    "}\n"
    ".ps-or-add{\n"
    "  width:100%; margin:.3em 0 1.2em; padding:.7em;\n"
    "  border:1px dashed rgba(196,169,110,.34); border-radius:8px;\n"
    "  background:transparent; cursor:pointer;\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.05rem;\n"
    "  color:rgba(243,237,225,.72);\n"
    "}\n"
    ".ps-or-add:hover{ border-color:var(--gold); color:var(--vellum-100) }\n"
    ".ps-or-lab{\n"
    "  font-family:var(--serif); font-size:1.15rem; color:var(--gold);\n"
    "  margin:.2em 0 .6em;\n"
    "}\n"
    ".ps-or-tot{\n"
    "  margin-top:1em; padding-top:.9em; border-top:1px solid rgba(196,169,110,.2);\n"
    "}\n"
    ".ps-or-row{\n"
    "  display:flex; justify-content:space-between; align-items:baseline;\n"
    "  font-family:var(--sans); font-size:.86rem; color:rgba(243,237,225,.62);\n"
    "  padding:.2em 0;\n"
    "}\n"
    ".ps-or-row b{ color:var(--vellum-100); font-weight:500 }\n"
    ".ps-or-row.is-total{\n"
    "  margin-top:.5em; padding-top:.6em; border-top:1px solid rgba(196,169,110,.16);\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.4rem;\n"
    "  color:var(--vellum-100);\n"
    "}\n"
    ".ps-or-row.is-total b{ font-family:var(--sans); font-style:normal; font-size:1.6rem }\n"
    "/* Brass, ruled 2026-08-04. The one action in the product that takes real\n"
    "   money should not look like the ones that do not. */\n"
    ".ps-or-go{\n"
    "  width:100%; margin-top:1em; padding:.85em;\n"
    "  border:0; border-radius:8px; cursor:pointer;\n"
    "  background:linear-gradient(180deg,#c4a96e 0%, #a3874d 100%);\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.3rem;\n"
    "  color:#241a12;\n"
    "  box-shadow:inset 0 1px 0 rgba(255,255,255,.28);\n"
    "}\n"
    ".ps-or-go:hover{ background:linear-gradient(180deg,#d3ba80 0%, #b0935a 100%) }\n"
    ".ps-or-go:disabled{ opacity:.4; cursor:default }\n"
    ".ps-or-safe{\n"
    "  display:flex; gap:.5em; align-items:center; justify-content:center;\n"
    "  margin-top:.8em;\n"
    "  font-family:var(--sans); font-size:.74rem; color:rgba(243,237,225,.45);\n"
    "}\n"
    ".ps-or-empty{\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.1rem;\n"
    "  color:rgba(243,237,225,.4); padding:1.4em 0; line-height:1.5;\n"
    "}\n",
    'order panel css',
)

# the order panel is coffee, so the address fields inside it are too
doc = rep(
    doc,
    ".pshop .ps-addr input,.pshop .ps-addr select{\n"
    "  background:rgba(255,255,255,.66); color:var(--ink);\n"
    "  border-color:rgba(137,105,67,.28);\n"
    "}\n"
    ".pshop .ps-addr input::placeholder{ color:rgba(60,48,34,.42) }\n",

    "/* The address lives in the coffee panel now, not on vellum. */\n"
    ".pshop .ps-addr input,.pshop .ps-addr select{\n"
    "  background:rgba(255,255,255,.05); color:var(--vellum-100);\n"
    "  border-color:rgba(196,169,110,.22);\n"
    "}\n"
    ".pshop .ps-addr input::placeholder{ color:rgba(243,237,225,.34) }\n"
    ".pshop .ps-addr input:focus,.pshop .ps-addr select:focus{ outline:1px solid var(--gold) }\n"
    ".pshop .ps-ship-opt{\n"
    "  background:rgba(255,255,255,.035); border-color:rgba(196,169,110,.18);\n"
    "  color:rgba(243,237,225,.86);\n"
    "}\n"
    ".pshop .ps-ship-opt:hover{ border-color:rgba(196,169,110,.5) }\n"
    ".pshop .ps-ship-opt.is-on{ border-color:var(--gold); background:rgba(196,169,110,.14); color:#fff }\n"
    ".pshop .ps-ship-opt .car{ color:var(--taupe) }\n",
    'address on coffee',
)

# ─────────────────────────────────────────────────────────────────────── 3 · JS

ORDER_JS = (
    "  /* ---- the order, always in view -----------------------------------------\n"
    "     Rebuilt for the three-column shop. It used to be a second view behind\n"
    "     a tab, so checking what you had cost you the piece you were\n"
    "     configuring.\n"
    "\n"
    "     The shipping choices stay. The mockup said \"calculated at checkout\";\n"
    "     we have live Prodigi quotes with five named methods and real prices,\n"
    "     and ruled to keep them. */\n"
    "  function renderOrder(){\n"
    "    var o = document.getElementById('psOrder');\n"
    "    if (!o) return;\n"
    "    var n = document.getElementById('psN');\n"
    "    if (n) n.textContent = '';\n"
    "\n"
    "    var count = orderCount();\n"
    "    var head =\n"
    "      '<div class=\"ps-or-h\">Your Print Order' +\n"
    "        (count ? '<span class=\"n\">' + count + (count === 1 ? ' print' : ' prints') +\n"
    "                 '</span>' : '') +\n"
    "      '</div>';\n"
    "\n"
    "    if (!ORDER.length){\n"
    "      o.innerHTML = head +\n"
    "        '<p class=\"ps-or-empty\">Nothing chosen yet. Pick a piece, then a ' +\n"
    "        'finish and a size, and it will be listed here.</p>';\n"
    "      return;\n"
    "    }\n"
    "\n"
    "    var a = addrValues();\n"
    "    var lines = ORDER.map(function(l){\n"
    "      var fam = null, sz = null;\n"
    "      PRINT_FAMILIES.forEach(function(f){\n"
    "        f.sizes.forEach(function(s){\n"
    "          if (s.size === l.size && s.finish === l.finish){ fam = f; sz = s; }\n"
    "        });\n"
    "      });\n"
    "      return '<div class=\"ps-or-line ps-line\" data-lid=\"' + l.lid + '\">' +\n"
    "        '<img src=\"' + esc(l.art) + '\" alt=\"\">' +\n"
    "        '<div class=\"info\">' +\n"
    "          '<div class=\"ti\">' + esc(l.name || 'Crafted Image') + '</div>' +\n"
    "          '<div class=\"pf\">' + esc((sz && sz.label) || l.size) + ' \\u00b7 ' +\n"
    "            esc((fam && fam.label) || l.finish) + '</div>' +\n"
    "          '<div class=\"ps-qty\" style=\"margin-top:.45em\">' +\n"
    "            '<button type=\"button\" data-q=\"-\">\\u2212</button>' +\n"
    "            '<span>' + l.copies + '</span>' +\n"
    "            '<button type=\"button\" data-q=\"+\">+</button>' +\n"
    "          '</div>' +\n"
    "        '</div>' +\n"
    "        '<div class=\"lp\">' + money(l.cents * l.copies) + '</div>' +\n"
    "        '<button class=\"ps-rm\" type=\"button\" data-rm=\"1\">\\u00d7</button>' +\n"
    "      '</div>';\n"
    "    }).join('');\n"
    "\n"
    "    var sub = orderSubtotal();\n"
    "    var ship = PS_SHIP ? PS_SHIP.retailShippingCents : null;\n"
    "    var tot = ship == null ? null : sub + ship;\n"
    "    var ready = addrComplete(a) && PS_SHIP;\n"
    "\n"
    "    o.innerHTML = head +\n"
    "      '<p class=\"ps-or-sub\">Review your pieces and complete your purchase.</p>' +\n"
    "      lines +\n"
    "      '<button class=\"ps-or-add\" id=\"psAddMore\" type=\"button\">+ Add another piece</button>' +\n"
    "      '<div class=\"ps-or-lab\">Where it goes</div>' +\n"
    "      '<div class=\"ps-addr\">' +\n"
    "        '<input class=\"wide\" id=\"psEmail\" type=\"email\" placeholder=\"Email for the receipt\" value=\"' +\n"
    "          esc(a.email || (ME && ME.email) || '') + '\">' +\n"
    "        '<input class=\"wide\" id=\"psName\"  placeholder=\"Full name\" value=\"' + esc(a.name) + '\">' +\n"
    "        '<input class=\"wide\" id=\"psL1\"    placeholder=\"Address\" value=\"' + esc(a.line1) + '\">' +\n"
    "        '<input class=\"wide\" id=\"psL2\"    placeholder=\"Apartment, suite (optional)\" value=\"' + esc(a.line2) + '\">' +\n"
    "        '<input id=\"psCity\"  placeholder=\"City\" value=\"' + esc(a.city) + '\">' +\n"
    "        '<input id=\"psState\" placeholder=\"State or county\" value=\"' + esc(a.state) + '\">' +\n"
    "        '<input id=\"psZip\"   placeholder=\"Postcode\" value=\"' + esc(a.postcode) + '\">' +\n"
    "        '<select id=\"psCountry\">' +\n"
    "          '<option value=\"US\">United States</option>' +\n"
    "          '<option value=\"CA\">Canada</option>' +\n"
    "          '<option value=\"GB\">United Kingdom</option>' +\n"
    "          '<option value=\"AU\">Australia</option>' +\n"
    "        '</select>' +\n"
    "      '</div>' +\n"
    "      (PS_SHIP_OPTS.length\n"
    "        ? '<div class=\"ps-or-lab\">How it travels</div><div class=\"ps-ship\">' +\n"
    "            PS_SHIP_OPTS.map(function(s){\n"
    "              return '<button class=\"ps-ship-opt' +\n"
    "                (s.method === PS_METHOD ? ' is-on' : '') +\n"
    "                '\" type=\"button\" data-ship=\"' + esc(s.method) + '\">' +\n"
    "                '<span>' + esc(s.label) +\n"
    "                  (s.carrier ? '<span class=\"car\"> \\u00b7 ' + esc(s.carrier) + '</span>' : '') +\n"
    "                '</span><span class=\"pr\">' +\n"
    "                  (s.retailShippingCents ? money(s.retailShippingCents) : 'included') +\n"
    "                '</span></button>';\n"
    "            }).join('') + '</div>'\n"
    "        : '') +\n"
    "      '<div class=\"ps-or-tot\">' +\n"
    "        '<div class=\"ps-or-row\">Prints (' + count + ')<b>' + money(sub) + '</b></div>' +\n"
    "        '<div class=\"ps-or-row\">Shipping<b>' +\n"
    "          (ship == null ? 'once we have your address' : money(ship)) + '</b></div>' +\n"
    "        '<div class=\"ps-or-row is-total\">Total<b>' +\n"
    "          (tot == null ? '\\u2014' : money(tot)) + '</b></div>' +\n"
    "      '</div>' +\n"
    "      '<button class=\"ps-or-go\" id=\"psCo\" type=\"button\"' +\n"
    "        (ready ? '' : ' disabled') + '>Checkout</button>' +\n"
    "      '<div class=\"ps-or-safe\">Prints are made and posted by our fulfilment lab.</div>';\n"
    "\n"
    "    var sel = document.getElementById('psCountry');\n"
    "    if (sel) sel.value = a.countryCode || 'US';\n"
    "  }\n"
    "\n"
    "  /* One name for it, so nothing has to know which panel it lives in. */\n"
    "  function renderCart(){ renderOrder(); }\n"
    "\n"
)

# replace renderCart wholesale
# \n alone does not match this file's CRLF closes, so the first cut of this
# ran past every real one and swallowed 270 lines.
m = re.search(r'  function renderCart\(\)\{.*?\r?\n  \}\r?\n', doc, re.S)
if not m:
    die('renderCart not found')
if doc[m.start():m.end()].count('\n') > 120:
    die('the renderCart match ran past its own close — %d lines'
        % doc[m.start():m.end()].count('\n'))
doc = doc[:m.start()] + ORDER_JS + doc[m.end():]

# psView and the tab are gone
m = re.search(r'  function psView\(which\)\{.*?\r?\n  \}\r?\n', doc, re.S)
if not m:
    die('psView not found')
if doc[m.start():m.end()].count('\n') > 40:
    die('the psView match ran past its own close — %d lines'
        % doc[m.start():m.end()].count('\n'))
doc = doc[:m.start()] + (
    "  /* psView is gone with the tab — all three columns are visible now. It\n"
    "     is kept as a no-op because three callers ask for a view before\n"
    "     opening the shop and none of them should have to care. */\n"
    "  function psView(){ }\n"
) + doc[m.end():]

doc = rep(
    doc,
    "  var psTab = document.getElementById('psTab');\r\n"
    "  if (psTab) psTab.addEventListener('click', function(){\r\n"
    "    var c = document.getElementById('psCartBody');\r\n"
    "    psView(c && c.hidden ? 'cart' : 'wall');\r\n"
    "  });\r\n",
    "",
    'tab handler gone',
)

doc = rep(
    doc,
    "  function updateTab(){\r\n"
    "    var b = document.getElementById('psTabN');\r\n"
    "    if (b) b.textContent = String(orderCount());\r\n"
    "  }\r\n",
    "  /* The count lives in the order panel's own heading now. */\r\n"
    "  function updateTab(){ }\r\n",
    'updateTab gone',
)

# the wall repaint must repaint the order too
doc = rep(
    doc,
    "    updateTab();\r\n"
    "    renderFly();\r\n"
    "  }\r\n",
    "    renderFly();\r\n"
    "    renderOrder();\r\n"
    "  }\r\n",
    'wall repaints order',
)

# the order panel's own clicks
doc = rep(
    doc,
    "  var psCartEl = document.getElementById('psCart');\r\n"
    "  if (psCartEl) psCartEl.addEventListener('click', function(e){\r\n",
    "  var psCartEl = document.getElementById('psOrder');\r\n"
    "  if (psCartEl) psCartEl.addEventListener('click', function(e){\r\n"
    "    /* Back to the gallery to choose another piece. */\r\n"
    "    if (e.target.closest('#psAddMore')){\r\n"
    "      PS_PIECE = null;\r\n"
    "      renderWall();\r\n"
    "      var g = document.getElementById('psGrid');\r\n"
    "      if (g) g.scrollTop = 0;\r\n"
    "      return;\r\n"
    "    }\r\n",
    'order clicks',
)

doc = rep(
    doc,
    "  var psQuoteTimer = null;\r\n"
    "  if (psCartEl) psCartEl.addEventListener('input', function(){\r\n",
    "  var psQuoteTimer = null;\r\n"
    "  if (psCartEl) psCartEl.addEventListener('input', function(){\r\n",
    'input handler stays',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# three columns, one body
if doc.count('<div class="ps-body"') != 1:
    die('there is still more than one body')
if 'id="psOrder"' not in doc:
    die('there is no order panel')
if 'id="psCartBody"' in doc:
    die('the second view survived')
# The button and its handler must be gone. Its CSS rules are left where
# they are — dead, harmless, and cheaper than five more anchors on a build
# this size. Worth sweeping when something else touches that block.
if 'class="ps-tab"' in doc:
    die('the tab button survived')
if "getElementById('psTab')" in doc:
    die('the tab handler survived')

# the order is always rendered alongside the wall
if doc.count('function renderOrder(') != 1:
    die('renderOrder is not declared exactly once')
if 'renderFly();\r\n    renderOrder();' not in doc and 'renderFly();\n    renderOrder();' not in doc:
    die('the wall does not repaint the order')

# Rich's rulings
# probe, not doc — the comment explaining why we did NOT take the mockup's
# line contains the line. Second time today a gate has caught its own prose.
if re.search(r'calculated at checkout', probe, re.I):
    die("the mockup's shipping line reached the build")
if 'data-ship=' not in doc:
    die('the shipping choices were dropped')
if '.ps-or-go{' not in doc or '#c4a96e' not in doc:
    die('checkout is not brass')
if '.ps-pc .nm{ display:none }' not in doc:
    die('the tiles have names again')
if 'PS_SENT[p.id];' not in doc:
    die('the shop shows more than what was sent')
if 'Showing' in probe and 'of 53' in probe:
    die("the mockup's leftover count reached the build")

# add another piece
if 'id="psAddMore"' not in doc:
    die('there is no way back to the gallery')

for sel in ('.ps-order{', '.ps-or-h{', '.ps-or-line{', '.ps-or-add{', '.ps-or-lab{',
            '.ps-or-tot{', '.ps-or-row{', '.ps-or-go{', '.ps-or-safe{', '.ps-or-empty{',
            '.ps-or-sub{'):
    if sel not in doc:
        die('no rule for %s' % sel)

if len(re.findall(r'data-s="[0-9]"', doc)) != 8:
    die('intake states are not 8')
for st in re.findall(r'<style[^>]*>(.*?)</style>', doc, re.S):
    if st.count('{') != st.count('}'):
        die('style block brace imbalance')

blocks = re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', doc, re.S)
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

print('GATE PASSED · gallery, configurator and order, all in view · %d routes' % routes)
print('wrote ' + OUT)
