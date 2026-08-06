# -*- coding: utf-8 -*-
"""
build_s107_credits_and_curator.py  ·  2026-08-03  ·  CUI V25

Two of Rich's four.

 4 · THE CREDITS NEVER SHOWED
      #mhCreditsBtn has been in the masthead since r02, styled, with a
      count span inside it — and `hidden`, because nothing ever wrote to
      it. This is a wiring job, not a build.

      The reason it could not be written is that nothing told the page its
      balance. /credits/gate answers with balance_after, and only after
      money has moved; so the number could not be shown before the first
      craft, or on arrival, or after a purchase. auth/me now carries it —
      see the route beside this script. It is the read every surface
      already makes on boot.

      It updates in four places: on arrival, after a spend, after a refund,
      and while the studio waits for a webhook to land. A number that lags
      the ledger is worse than no number.

      Never a zero over an unknown. A balance that could not be read stays
      hidden rather than telling somebody with sixty credits they have none.

 1 · CLICKING THE CURATOR BRINGS THE WORKSHOP BACK
      Rich asked, and agreed in part: the panel holds two buttons of its
      own, and making the whole container clickable would swallow them.
      So the photograph and the letter are the way back, and the buttons
      keep doing their own jobs.

      It only acts when something is covering the workshop. Clicking the
      Curator while already in the workshop does nothing, which is right —
      there is nowhere to go.

Run from the repo root:  python scripts\\build_s107_credits_and_curator.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s106.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s107.html')

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

# ───────────────────────────────────────────────────── 4 · the balance, shown

doc = rep(
    doc,
    "  function whoAmI(){\r\n"
    "    return fetch(AUTH_ME_URL, { credentials: 'same-origin' })\r\n"
    "      .then(function(res){ return res.ok ? res.json() : null; })\r\n"
    "      .then(function(d){ ME = (d && d.user) ? d.user : null; return ME; })\r\n"
    "      .catch(function(){ ME = null; return null; });\r\n"
    "  }\r\n",

    "  /* ---- the balance, in the masthead --------------------------------------\r\n"
    "     #mhCreditsBtn has been in the markup since r02 with nothing writing to\r\n"
    "     it, because nothing told this page its balance. /credits/gate answers\r\n"
    "     with balance_after and only after money has moved — no use on arrival,\r\n"
    "     and no use to somebody who has not crafted yet.\r\n"
    "\r\n"
    "     auth/me carries it now. One writer, called from everywhere the number\r\n"
    "     could have changed: arrival, a spend, a refund, and the wait for a\r\n"
    "     webhook. A masthead that lags the ledger is worse than an empty one. */\r\n"
    "  var CREDITS = null;\r\n"
    "  var mhCreditsBtn = document.getElementById('mhCreditsBtn');\r\n"
    "  var mhCreditsCount = document.getElementById('mhCreditsCount');\r\n"
    "\r\n"
    "  function paintCredits(){\r\n"
    "    if (!mhCreditsBtn || !mhCreditsCount) return;\r\n"
    "    /* Signed out, or a balance we could not read. Show nothing rather\r\n"
    "       than a zero — a zero over an unknown tells someone with sixty\r\n"
    "       credits they have none. */\r\n"
    "    if (!ME || CREDITS == null){ mhCreditsBtn.hidden = true; return; }\r\n"
    "    mhCreditsBtn.hidden = false;\r\n"
    "    mhCreditsCount.textContent = String(CREDITS);\r\n"
    "    mhCreditsBtn.setAttribute('aria-label',\r\n"
    "      CREDITS + (CREDITS === 1 ? ' credit' : ' credits') + ' \\u00b7 buy more');\r\n"
    "  }\r\n"
    "\r\n"
    "  function setCredits(n){\r\n"
    "    if (typeof n !== 'number' || n < 0) return;\r\n"
    "    CREDITS = n;\r\n"
    "    paintCredits();\r\n"
    "  }\r\n"
    "\r\n"
    "  function whoAmI(){\r\n"
    "    return fetch(AUTH_ME_URL, { credentials: 'same-origin' })\r\n"
    "      .then(function(res){ return res.ok ? res.json() : null; })\r\n"
    "      .then(function(d){\r\n"
    "        ME = (d && d.user) ? d.user : null;\r\n"
    "        CREDITS = (d && typeof d.credits === 'number') ? d.credits : null;\r\n"
    "        paintCredits();\r\n"
    "        return ME;\r\n"
    "      })\r\n"
    "      .catch(function(){ ME = null; CREDITS = null; paintCredits(); return null; });\r\n"
    "  }\r\n"
    "\r\n"
    "  /* The masthead is a way to buy, not only a readout. */\r\n"
    "  if (mhCreditsBtn) mhCreditsBtn.addEventListener('click', function(){\r\n"
    "    if (typeof window.__openPaywall === 'function'){\r\n"
    "      window.__openPaywall({ needed: 0, balance: CREDITS || 0, reason: 'browse' });\r\n"
    "    }\r\n"
    "  });\r\n",
    'whoAmI and the balance',
)

# the ledger moved — say so in the masthead
doc = rep(
    doc,
    "      console.log('[credits] spent ' + (items.length * CREDITS_PER_IMAGE) +\r\n",
    "      if (typeof data.balance_after === 'number') setCredits(data.balance_after);\r\n"
    "      console.log('[credits] spent ' + (items.length * CREDITS_PER_IMAGE) +\r\n",
    'credits after spend',
)

# ─────────────────────────────────── 1 · the Curator is the way back

doc = rep(
    doc,
    "  if (curChange) curChange.addEventListener('click', function(){\r\n"
    "    pickSource();\r\n"
    "  });",

    "  if (curChange) curChange.addEventListener('click', function(){\r\n"
    "    pickSource();\r\n"
    "  });\r\n"
    "\r\n"
    "  /* ---- the Curator is the way back ---------------------------------------\r\n"
    "     Ruled 2026-08-03. Not the whole panel: it holds two buttons of its own\r\n"
    "     and a container listener would swallow both. The photograph and the\r\n"
    "     letter are the way back, and they only act when something is covering\r\n"
    "     the workshop — clicking the Curator while already there does nothing,\r\n"
    "     because there is nowhere to go. */\r\n"
    "  function backToWorkshop(){\r\n"
    "    var moved = false;\r\n"
    "    if (typeof hidePrintShop === 'function' &&\r\n"
    "        pshop && pshop.classList.contains('is-open')){ hidePrintShop(); moved = true; }\r\n"
    "    if (typeof hideCollection === 'function' &&\r\n"
    "        mycoll && mycoll.classList.contains('is-open')){ hideCollection(); moved = true; }\r\n"
    "    return moved;\r\n"
    "  }\r\n"
    "\r\n"
    "  ['curSlot', 'curSay'].forEach(function(id){\r\n"
    "    var el = document.getElementById(id);\r\n"
    "    if (!el) return;\r\n"
    "    el.addEventListener('click', function(e){\r\n"
    "      /* Anything with its own job keeps it. */\r\n"
    "      if (e.target.closest('button, a, input')) return;\r\n"
    "      backToWorkshop();\r\n"
    "    });\r\n"
    "  });",
    'curator back',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# one writer for the number
if doc.count('function paintCredits(') != 1:
    die('paintCredits is not the single writer')
if doc.count('mhCreditsCount.textContent') != 1:
    die('something else writes the credit count')

# never a zero over an unknown
if 'if (!ME || CREDITS == null){ mhCreditsBtn.hidden = true; return; }' not in doc:
    die('an unread balance would show as a number')

# it updates where the ledger moves
if 'CREDITS = (d && typeof d.credits === \'number\') ? d.credits : null;' not in doc:
    die('the balance is not read on arrival')
if doc.count('setCredits(') < 2:
    die('the balance is not updated after a spend')

# declared above their readers
for name, reader in (('var CREDITS ', 'function paintCredits('),
                     ('var mhCreditsBtn', 'function paintCredits(')):
    if probe.index(name) > probe.index(reader):
        die('%s is declared below %s' % (name.strip(), reader))

# the Curator, and only where it should act
if 'function backToWorkshop(' not in doc:
    die('the Curator is not a way back')
if "e.target.closest('button, a, input')" not in doc:
    die('the buttons inside the panel would be swallowed')
if "['curSlot', 'curSay']" not in doc:
    die('the whole panel was made clickable')

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

print('GATE PASSED · the balance is shown and kept true · the Curator is a way back'
      ' · %d routes' % routes)
print('wrote ' + OUT)
