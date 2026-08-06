# -*- coding: utf-8 -*-
"""
build_s102_route_url_order.py  ·  2026-08-03  ·  CUI V25

    GET http://localhost:3000/undefined 404
      whoAmI  → afterPurchase  → (boot)

AUTH_ME_URL and AUTH_SIGNIN_URL were declared at ~5604. afterPurchase runs
during boot at ~4988 and calls whoAmI, which reads AUTH_ME_URL. `var` hoists
the NAME and not the VALUE, so at that moment the URL is undefined and the
fetch goes to /undefined. Shipped in s93 and unnoticed because the fault only
appears on the one path that returns from Stripe.

    A customer comes back from paying, the page asks who they are, the
    request 404s, ME stays null, the work is never restored and the rail
    never re-reads. Rich hit it three times in a row this afternoon.

THE FIX
    Every route URL is declared once, at the top, above everything. They are
    constants; there was never a reason for them to be scattered through five
    thousand lines in the order the routes happened to be built.

AND THE SAME CLASS, ONE LINE OVER
    [timing] analyze answered in NaNms — SRC.t0 is set when a photograph is
    uploaded and never on the resume path, so a session restored from an
    email link measures from undefined. runAnalyze now sets it if nothing
    else has.

THE GATE THAT STOPS IT RECURRING
    Every *_URL var must be declared above every line that reads it. This
    catches the whole family, not the one instance.

Run from the repo root:  python scripts\\build_s102_route_url_order.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s101.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s102.html')

EXPECTED_ROUTES = 15


def die(msg):
    print('GATE FAILED · ' + msg)
    sys.exit(1)


def rep(text, old, new, label):
    n = text.count(old)
    if n != 1:
        die('anchor "%s" appears %d times, expected 1' % (label, n))
    return text.replace(old, new)


with open(SRC, encoding='utf-8', newline='') as f:
    src = f.read()

doc = src

# ── 1 · lift every route URL to one block at the top ────────────────────────

MOVED = [
    ("  var CREDITS_GATE_URL = '/api/v1/credits/gate';\r\n"
     "  var GENERATE_URL     = '/api/v1/portraits/generate';\r\n"
     "  var CREDITS_REFUND_URL = '/api/v1/credits/refund';\r\n", 'credits + generate'),
    ("  var SKUS_URL     = '/api/v1/skus';\r\n"
     "  var PURCHASE_URL = '/api/v1/credits/purchase';\r\n", 'skus + purchase'),
    ("  var AUTH_ME_URL     = '/api/v1/auth/me';\r\n"
     "  var AUTH_SIGNIN_URL = '/api/v1/auth/signin';\r\n", 'auth'),
]

for block, label in MOVED:
    if doc.count(block) != 1:
        die('the %s block is not where it was expected' % label)
    doc = doc.replace(block, '')

doc = rep(
    doc,
    "  var GATE_URL       = '/api/v1/portraits/gate';\r\n"
    "  var ANALYZE_URL    = '/api/v1/portraits/analyze';\r\n"
    "  var CURATE_URL     = '/api/v1/portraits/curate-effects';\r\n",

    "  /* ---- every route, in one place ----------------------------------------\r\n"
    "     These were scattered across five thousand lines in the order the\r\n"
    "     routes were built. The auth one sat at 5604 while afterPurchase called\r\n"
    "     whoAmI at 4988 — during boot, before the assignment — so a customer\r\n"
    "     returning from Stripe fetched /undefined, ME stayed null, and their\r\n"
    "     work was never restored. `var` hoists the name and never the value.\r\n"
    "\r\n"
    "     They are constants. They live here, above everything that reads\r\n"
    "     them, and the gate now asserts that. */\r\n"
    "  var GATE_URL           = '/api/v1/portraits/gate';\r\n"
    "  var ANALYZE_URL        = '/api/v1/portraits/analyze';\r\n"
    "  var CURATE_URL         = '/api/v1/portraits/curate-effects';\r\n"
    "  var GENERATE_URL       = '/api/v1/portraits/generate';\r\n"
    "  var PIECES_URL         = '/api/v1/portraits/pieces';\r\n"
    "  var CREDITS_GATE_URL   = '/api/v1/credits/gate';\r\n"
    "  var CREDITS_REFUND_URL = '/api/v1/credits/refund';\r\n"
    "  var PURCHASE_URL       = '/api/v1/credits/purchase';\r\n"
    "  var SKUS_URL           = '/api/v1/skus';\r\n"
    "  var AUTH_ME_URL        = '/api/v1/auth/me';\r\n"
    "  var AUTH_SIGNIN_URL    = '/api/v1/auth/signin';\r\n"
    "  var QUOTE_URL          = '/api/v1/print/quote';\r\n"
    "  var PRINT_CO_URL       = '/api/v1/print/checkout';\r\n",
    'the one block',
)

# the two that were declared inside the later blocks are now above them
doc = rep(
    doc,
    "  var PIECES_URL = '/api/v1/portraits/pieces';\n"
    "  var SERIES_LABEL = ",
    "  var SERIES_LABEL = ",
    'pieces url dedupe',
)

doc = rep(
    doc,
    "  var QUOTE_URL    = '/api/v1/print/quote';\r\n"
    "  var PRINT_CO_URL = '/api/v1/print/checkout';\r\n"
    "\r\n"
    "  var PRINT_OPTS = [",
    "  var PRINT_OPTS = [",
    'print urls dedupe',
)

# ── 2 · the clock starts even when the photograph came back from an email ───

doc = rep(
    doc,
    "  function runAnalyze(){\r\n"
    "    var seq = SRC.seq = SRC.seq + 1;\r\n",

    "  function runAnalyze(){\r\n"
    "    var seq = SRC.seq = SRC.seq + 1;\r\n"
    "    /* t0 is set at the upload. A session restored from an email link has\r\n"
    "       no upload, so every timing read NaN on exactly the path that is\r\n"
    "       hardest to watch. */\r\n"
    "    if (!SRC.t0) SRC.t0 = Date.now();\r\n",
    't0 fallback',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

# THE GATE THIS BUILD EXISTS FOR — every route URL above every reader of it.
# Comments name these tokens when they explain them, so the position check
# runs against a copy with the block comments blanked — offsets preserved.
probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

decls = {}
for m in re.finditer(r'^\s*var ([A-Z_]*URL)\s*=', probe, re.M):
    name = m.group(1)
    if name in decls:
        die('%s is declared twice' % name)
    decls[name] = m.start()
if len(decls) < 13:
    die('only %d route URLs found, expected 13' % len(decls))

for name, at in decls.items():
    for m in re.finditer(r'\b' + name + r'\b', probe):
        if m.start() < at:
            line = probe[:m.start()].count('\n') + 1
            die('%s is read at line %d, above its declaration' % (name, line))

# they are all in one block, so nobody adds the fourteenth somewhere else
first = min(decls.values())
last = max(decls.values())
if probe[first:last].count('\n') > 20:
    die('the route URLs are no longer one block')

# the fault this build was reported for
if "whoAmI().then" not in doc:
    die('afterPurchase no longer asks who the customer is')
if 'if (!SRC.t0) SRC.t0 = Date.now();' not in doc:
    die('the timing clock has no fallback')

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

print('GATE PASSED · %d route URLs, all above every reader · %d routes'
      % (len(decls), routes))
print('wrote ' + OUT)
