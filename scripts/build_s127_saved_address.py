# -*- coding: utf-8 -*-
"""
build_s127_saved_address.py  ·  2026-08-05  ·  CUI V25

The address is typed once and kept.

    A customer filled in seven fields at every print order and nothing kept
    them. Ruled 2026-08-05: store it, pre-fill from it, and a repeat order
    becomes two clicks.

WHAT LANDS

  · The Print Shop pre-fills from the saved address on arrival, and saves
    what was typed when an order goes through. Saved at checkout rather than
    on every keystroke — a half-typed street is not an address, and the
    moment they press Checkout is the moment they have told us it is right.
  · Account shows it, in the card the mockup put it in, with the edit going
    back to the Print Shop rather than a second form in a second place that
    could disagree with the first.
  · Nothing is saved for somebody who never orders. The store is a
    convenience for a returning customer, not a record we keep because we
    can.

Needs migration 015 and app/api/v1/account/address/route.ts.

ROUTE COUNT 17 -> 19: the address GET and PUT.

Run from the repo root:  python scripts\\build_s127_saved_address.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-05-s126.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-05-s127.html')

ROUTES_BEFORE = 17
ROUTES_AFTER = 19


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

if src.count('fetch(') != ROUTES_BEFORE:
    die('expected %d routes in s126, found %d' % (ROUTES_BEFORE, src.count('fetch(')))

doc = src

# ── 1 · the route, and the store ───────────────────────────────────────────

doc = rep(
    doc,
    "  var ACCOUNT_URL = '/api/v1/account';\r\n",
    "  var ACCOUNT_URL = '/api/v1/account';\r\n"
    "  var ADDRESS_URL = '/api/v1/account/address';\r\n",
    'address url',
)

JS = (
    "  /* ---- the address, typed once ---------------------------------------------\n"
    "     Seven fields at every print order, kept nowhere. Ruled 2026-08-05.\n"
    "\n"
    "     Read on arrival so the form is already filled, written when an order\n"
    "     goes through — not on every keystroke, because a half-typed street is\n"
    "     not an address and pressing Checkout is the moment the customer has\n"
    "     told us it is right.\n"
    "\n"
    "     Whose address it is comes from the session at the route. The client\n"
    "     sends an address and never an owner. */\n"
    "  var ADDR = null;\n"
    "\n"
    "  function loadAddress(){\n"
    "    return fetch(ADDRESS_URL, { credentials:'same-origin' })\n"
    "      .then(function(r){ return r.ok ? r.json() : null; })\n"
    "      .then(function(d){\n"
    "        ADDR = (d && d.address) || null;\n"
    "        if (ADDR) fillAddressForm();\n"
    "        return ADDR;\n"
    "      })\n"
    "      .catch(function(e){\n"
    "        console.warn('[address] not loaded:', e.message || e);\n"
    "        return null;\n"
    "      });\n"
    "  }\n"
    "\n"
    "  /* Only into empty fields. A customer part-way through typing a\n"
    "     different address must not have it overwritten by one that arrives\n"
    "     late. */\n"
    "  function fillAddressForm(){\n"
    "    if (!ADDR) return;\n"
    "    var map = {\n"
    "      psName: ADDR.full_name, psL1: ADDR.line1, psL2: ADDR.line2,\n"
    "      psCity: ADDR.city, psState: ADDR.region, psZip: ADDR.postcode\n"
    "    };\n"
    "    Object.keys(map).forEach(function(id){\n"
    "      var el = document.getElementById(id);\n"
    "      if (el && !el.value && map[id]) el.value = map[id];\n"
    "    });\n"
    "    var c = document.getElementById('psCountry');\n"
    "    if (c && ADDR.country_code) c.value = ADDR.country_code;\n"
    "  }\n"
    "\n"
    "  function saveAddress(){\n"
    "    var a = addrValues();\n"
    "    if (!addrComplete(a)) return Promise.resolve(false);\n"
    "    return fetch(ADDRESS_URL, {\n"
    "      method:'PUT',\n"
    "      headers:{ 'Content-Type':'application/json' },\n"
    "      credentials:'same-origin',\n"
    "      body: JSON.stringify({\n"
    "        full_name: a.name, line1: a.line1, line2: a.line2,\n"
    "        city: a.city, region: a.state, postcode: a.postcode,\n"
    "        country_code: a.countryCode\n"
    "      })\n"
    "    }).then(function(r){ return r.json(); }).then(function(d){\n"
    "      if (d && d.ok){ ADDR = d.address; return true; }\n"
    "      console.warn('[address] not saved:', (d && d.reason) || 'unknown');\n"
    "      return false;\n"
    "    }).catch(function(e){\n"
    "      /* Never blocks the order. The print is what they came for. */\n"
    "      console.warn('[address] not saved:', e.message || e);\n"
    "      return false;\n"
    "    });\n"
    "  }\n"
    "\n"
)

doc = rep(
    doc,
    "  function loadAccount(){\n",
    JS + "  function loadAccount(){\n",
    'address js',
)

# ── 2 · read it on arrival, and fill the form when the shop opens ──────────

doc = rep(
    doc,
    "    if (typeof loadPieces === 'function') loadPieces();\r\n",
    "    if (typeof loadPieces === 'function') loadPieces();\r\n"
    "    if (typeof loadAddress === 'function') loadAddress();\r\n",
    'load on boot',
)

doc = rep(
    doc,
    "  function renderOrder(){\n"
    "    var o = document.getElementById('psOrder');\n"
    "    if (!o) return;\n",
    "  function renderOrder(){\n"
    "    var o = document.getElementById('psOrder');\n"
    "    if (!o) return;\n",
    'renderOrder unchanged',
)

doc = rep(
    doc,
    "    var sel = document.getElementById('psCountry');\n"
    "    if (sel) sel.value = a.countryCode || 'US';\n"
    "  }\n",
    "    var sel = document.getElementById('psCountry');\n"
    "    if (sel) sel.value = a.countryCode || 'US';\n"
    "    /* The form is rebuilt on every render, so the saved address has to be\n"
    "       put back each time — into empty fields only. */\n"
    "    if (typeof fillAddressForm === 'function') fillAddressForm();\n"
    "  }\n",
    'fill after render',
)

# ── 3 · saved when the order goes through ──────────────────────────────────

doc = rep(
    doc,
    "    var btn = document.getElementById('psCo');\r\n"
    "    if (btn){ btn.disabled = true; btn.textContent = 'One moment\\u2026'; }\r\n",
    "    var btn = document.getElementById('psCo');\r\n"
    "    if (btn){ btn.disabled = true; btn.textContent = 'One moment\\u2026'; }\r\n"
    "    /* Kept for next time. Not awaited — the print is what they came for\r\n"
    "       and a slow write must not hold up a checkout. */\r\n"
    "    if (typeof saveAddress === 'function') saveAddress();\r\n",
    'save at checkout',
)

# ── 4 · Account shows it ───────────────────────────────────────────────────

doc = rep(
    doc,
    "      (u && u.since\n"
    "        ? '<div class=\"ac-row\"><span class=\"k\">With the studio since</span>' +\n"
    "          '<span class=\"v\">' + esc(acDate(u.since)) + '</span></div>'\n"
    "        : '') +\n",

    "      (u && u.since\n"
    "        ? '<div class=\"ac-row\"><span class=\"k\">With the studio since</span>' +\n"
    "          '<span class=\"v\">' + esc(acDate(u.since)) + '</span></div>'\n"
    "        : '') +\n"
    "      /* Shown, not edited here. One form for an address, in the place it\n"
    "         is used — two would eventually disagree with each other. */\n"
    "      '<div class=\"ac-row\"><span class=\"k\">Where prints go</span>' +\n"
    "        '<span class=\"v\">' + (ADDR\n"
    "          ? esc([ADDR.full_name, ADDR.line1, ADDR.line2, ADDR.city,\n"
    "                 ADDR.region, ADDR.postcode, ADDR.country_code]\n"
    "                .filter(Boolean).join(', '))\n"
    "          : 'Saved when you place your first print order.') +\n"
    "        '</span></div>' +\n",
    'address in account',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != ROUTES_AFTER:
    die('route count is %d, expected %d' % (routes, ROUTES_AFTER))
if doc.count('fetch(ADDRESS_URL') != 2:
    die('the address is not read once and written once')

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# the client never says whose address it is
if re.search(r'owner_key\s*:', probe):
    die('the client is naming an owner — that is the session\'s to decide')

# read on arrival, written at checkout, and never on a keystroke
if 'loadAddress();' not in doc:
    die('the address is never read')
if 'saveAddress();' not in doc:
    die('the address is never written')
addr_saves = len(re.findall(r'saveAddress\(\)', probe))
if addr_saves != 2:
    die('saveAddress is called %d times — expected the declaration and checkout'
        % addr_saves)
if re.search(r"addEventListener\('input'[^)]*saveAddress", probe):
    die('the address is being written on every keystroke')

# a late arrival must not overwrite what is being typed
if 'if (el && !el.value && map[id]) el.value = map[id];' not in doc:
    die('a saved address could overwrite a half-typed one')

# a failed save must not cost the order
if 'Never blocks the order' not in doc:
    die('the save is not documented as non-blocking')
if 'return saveAddress().then' in doc:
    die('checkout is waiting on the address write')

# shown in Account, not editable there
if 'Where prints go' not in doc:
    die('the account does not show the saved address')
if "id=\"acAddrForm\"" in doc:
    die('a second address form exists and will disagree with the first')

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

print('GATE PASSED · typed once, kept, pre-filled · %d routes' % routes)
print('wrote ' + OUT)
