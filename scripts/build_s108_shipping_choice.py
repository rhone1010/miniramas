# -*- coding: utf-8 -*-
"""
build_s108_shipping_choice.py  ·  2026-08-03  ·  CUI V25

Shipping becomes a choice.

    There are no shipping SKUs. Prodigi treats it as an order-level method
    and the Quote endpoint returns every method actually available for that
    basket to that country — availability varies by product and destination,
    so a hard-coded list would offer options that fail at checkout.

    s101 sent 'Budget' and read quotes[0], which threw the rest of the
    answer away. The route now asks without a method and returns them all;
    this puts them in front of the customer.

    It also matters for baskets. Prodigi consolidates — the largest item
    carries the main charge and each piece after it adds less — so the real
    numbers only appear when the whole basket is quoted at once, which is
    what happens here.

  · Five methods, named as Rich named them: Economy, Standard, Priority,
    Express, Overnight. The names come back from the route, so a method
    Prodigi adds appears without a build.
  · Cheapest first, and that one is chosen by default.
  · The choice survives a re-quote where the method is still offered. Change
    the country and Overnight may vanish; the choice falls back rather than
    silently keeping a price for a service that is gone.
  · Checkout sends the method that was actually chosen.

Run from the repo root:  python scripts\\build_s108_shipping_choice.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s107.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s108.html')

EXPECTED_ROUTES = 15


def die(msg):
    print('GATE FAILED · ' + msg)
    sys.exit(1)


def rep(text, old, new, label):
    """Anchors are written with CRLF. Earlier builds wrote some blocks with
    bare LF, so an anchor that misses is retried in the other ending before
    it is called a miss — the alternative is every future build carrying a
    note about which section came from which script."""
    for a, b in ((old, new),
                 (old.replace('\r\n', '\n'), new.replace('\r\n', '\n'))):
        if text.count(a) == 1:
            return text.replace(a, b)
    n = text.count(old)
    die('anchor "%s" appears %d times, expected 1' % (label, n))


with open(SRC, encoding='utf-8', newline='') as f:
    src = f.read()

doc = src

# ───────────────────────────────────────────────────────────────────── 1 · CSS

doc = rep(
    doc,
    ".ps-summ{\r\n",
    "/* the shipping choices. Same shape as the size options in the flyout —\r\n"
    "   this is the same kind of decision and should not look like a new one. */\r\n"
    ".ps-ship{ margin:1.2em 0 }\r\n"
    ".ps-ship-opt{\r\n"
    "  display:flex; align-items:baseline; gap:.7em; width:100%;\r\n"
    "  padding:.55em .8em; margin-bottom:.35em;\r\n"
    "  border:1px solid rgba(196,169,110,.22); border-radius:7px;\r\n"
    "  background:rgba(255,255,255,.02); cursor:pointer; text-align:left;\r\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.1rem;\r\n"
    "  color:rgba(243,237,225,.86);\r\n"
    "  transition:border-color 160ms ease, background 160ms ease;\r\n"
    "}\r\n"
    ".ps-ship-opt:hover{ border-color:rgba(196,169,110,.5) }\r\n"
    ".ps-ship-opt.is-on{\r\n"
    "  border-color:var(--gold); background:rgba(196,169,110,.12); color:#fff;\r\n"
    "}\r\n"
    ".ps-ship-opt .car{\r\n"
    "  font-family:var(--sans); font-style:normal; font-size:.72rem;\r\n"
    "  color:var(--taupe);\r\n"
    "}\r\n"
    ".ps-ship-opt .pr{\r\n"
    "  margin-left:auto; font-family:var(--sans); font-style:normal; font-size:.95rem;\r\n"
    "}\r\n"
    ".ps-summ{\r\n",
    'shipping css',
)

# ───────────────────────────────────────────────── 2 · hold the offers and the pick

doc = rep(
    doc,
    "  var PS_SHIP  = null;    /* the last quote, or null when it is stale */\r\n",
    "  var PS_SHIP  = null;    /* the last quote, or null when it is stale */\r\n"
    "  var PS_SHIP_OPTS = [];  /* every method Prodigi offered for this basket */\r\n"
    "  var PS_METHOD = null;   /* the one chosen. null until a quote lands. */\r\n",
    'shipping state',
)

# ─────────────────────────────────────────────────────── 3 · read the whole answer

doc = rep(
    doc,
    "    }).then(function(r){ return r.json(); }).then(function(d){\r\n"
    "      if (!d || d.error || typeof d.retailShippingCents !== 'number'){\r\n"
    "        console.warn('[print] quote failed:', (d && d.error) || 'no shipping');\r\n"
    "        PS_SHIP = null; renderCart(); return;\r\n"
    "      }\r\n",

    "    }).then(function(r){ return r.json(); }).then(function(d){\r\n"
    "      if (!d || d.error || !Array.isArray(d.shipping) || !d.shipping.length){\r\n"
    "        console.warn('[print] quote failed:', (d && d.error) || 'no shipping');\r\n"
    "        PS_SHIP = null; PS_SHIP_OPTS = []; PS_METHOD = null; renderCart(); return;\r\n"
    "      }\r\n",
    'quote guard',
)

doc = rep(
    doc,
    "      if (now !== want) return;\r\n"
    "      PS_SHIP = d;\r\n"
    "      renderCart();\r\n",

    "      if (now !== want) return;\r\n"
    "      PS_SHIP_OPTS = d.shipping;\r\n"
    "      /* Keep the customer's choice if it is still on offer. Change the\r\n"
    "         country and Overnight may simply not exist — falling back to the\r\n"
    "         cheapest is honest; keeping a price for a service that is gone\r\n"
    "         is not. */\r\n"
    "      var kept = null;\r\n"
    "      PS_SHIP_OPTS.forEach(function(o){ if (o.method === PS_METHOD) kept = o; });\r\n"
    "      PS_METHOD = (kept || PS_SHIP_OPTS[0]).method;\r\n"
    "      PS_SHIP = kept || PS_SHIP_OPTS[0];\r\n"
    "      renderCart();\r\n",
    'quote landing',
)

# ────────────────────────────────────────────────── 4 · the choices, in the order

doc = rep(
    doc,
    "      '<div class=\"ps-summ\">' +\r\n"
    "        '<div class=\"rows\">Prints <b>' + money(sub) + '</b><br>' +\r\n"
    "          'Shipping <b>' + (ship == null ? 'once we have your address' : money(ship)) + '</b></div>' +\r\n",

    "      (PS_SHIP_OPTS.length\r\n"
    "        ? '<div class=\"ps-lab\">How it travels</div><div class=\"ps-ship\">' +\r\n"
    "            PS_SHIP_OPTS.map(function(o){\r\n"
    "              return '<button class=\"ps-ship-opt' +\r\n"
    "                (o.method === PS_METHOD ? ' is-on' : '') +\r\n"
    "                '\" type=\"button\" data-ship=\"' + esc(o.method) + '\">' +\r\n"
    "                '<span>' + esc(o.label) +\r\n"
    "                  (o.carrier ? '<span class=\"car\"> \\u00b7 ' + esc(o.carrier) + '</span>' : '') +\r\n"
    "                '</span>' +\r\n"
    "                '<span class=\"pr\">' +\r\n"
    "                  (o.retailShippingCents ? money(o.retailShippingCents) : 'included') +\r\n"
    "                '</span></button>';\r\n"
    "            }).join('') +\r\n"
    "          '</div>'\r\n"
    "        : '') +\r\n"
    "      '<div class=\"ps-summ\">' +\r\n"
    "        '<div class=\"rows\">Prints <b>' + money(sub) + '</b><br>' +\r\n"
    "          'Shipping <b>' + (ship == null ? 'once we have your address' : money(ship)) + '</b></div>' +\r\n",
    'shipping options markup',
)

# ────────────────────────────────────────────────────────── 5 · choosing one

doc = rep(
    doc,
    "    if (e.target.closest('#psCo')) printCheckout();\r\n",
    "    var shipBtn = e.target.closest('[data-ship]');\r\n"
    "    if (shipBtn){\r\n"
    "      if (shipBtn.dataset.ship === PS_METHOD) return;\r\n"
    "      PS_METHOD = shipBtn.dataset.ship;\r\n"
    "      PS_SHIP_OPTS.forEach(function(o){ if (o.method === PS_METHOD) PS_SHIP = o; });\r\n"
    "      renderCart();\r\n"
    "      return;\r\n"
    "    }\r\n"
    "    if (e.target.closest('#psCo')) printCheckout();\r\n",
    'shipping click',
)

# ─────────────────────────────────── 6 · the order is placed on what was chosen

doc = rep(
    doc,
    "        shippingMethod: 'Budget',\r\n"
    "        successUrl: back + '?print=1&session={CHECKOUT_SESSION_ID}',\r\n",
    "        shippingMethod: PS_METHOD || 'Budget',\r\n"
    "        successUrl: back + '?print=1&session={CHECKOUT_SESSION_ID}',\r\n",
    'checkout method',
)

# the quote asks for everything, so it must stop naming one
doc = rep(
    doc,
    "        destination: { countryCode:a.countryCode, postcode:a.postcode },\r\n"
    "        shippingMethod: 'Budget'\r\n"
    "      })\r\n",
    "        destination: { countryCode:a.countryCode, postcode:a.postcode }\r\n"
    "        /* No method named. Prodigi answers with every one available for\r\n"
    "           this basket to this country, and the customer chooses. */\r\n"
    "      })\r\n",
    'quote asks for all',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# the quote no longer names a method, and checkout no longer assumes one
if "shippingMethod: 'Budget'\r\n      })" in doc:
    die('the quote still asks for one method')
if doc.count("shippingMethod: PS_METHOD || 'Budget'") != 1:
    die('checkout does not send the chosen method')

# the whole answer is read
if 'Array.isArray(d.shipping)' not in doc:
    die('the quote response is still read as a single option')
if 'PS_SHIP_OPTS = d.shipping;' not in doc:
    die('the offered methods are not kept')

# a choice that is no longer offered must not survive
if 'PS_METHOD = (kept || PS_SHIP_OPTS[0]).method;' not in doc:
    die('a method that vanished could still be charged for')

# every class carries a rule
for sel in ('.ps-ship{', '.ps-ship-opt{', '.ps-ship-opt.is-on{',
            '.ps-ship-opt .car{', '.ps-ship-opt .pr{'):
    if sel not in doc:
        die('no rule for %s' % sel)

# declared above their readers
for name in ('var PS_SHIP_OPTS', 'var PS_METHOD'):
    if probe.index(name) > probe.index('function renderCart('):
        die('%s is declared below renderCart' % name)

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

print('GATE PASSED · every method Prodigi offers, priced and chosen · %d routes' % routes)
print('wrote ' + OUT)
