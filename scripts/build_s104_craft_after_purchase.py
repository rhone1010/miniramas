# -*- coding: utf-8 -*-
"""
build_s104_craft_after_purchase.py  ·  2026-08-03  ·  CUI V25

One press should mean one thing.

    Craft was pressed twice for one craft: once to discover the shortfall
    and open the buy panel, and again after paying. Rich, on the second
    press: "that's not good UX." He is right — nobody expects to hunt for a
    button after a checkout, and the rail sat on a shortfall message while
    the money was already in the ledger.

    Worse, the shortfall it showed was often stale. The webhook grants the
    credits and the browser returns from Stripe on its own schedule; for a
    few seconds the rail told the customer they were short when they were
    not, with no reason to press anything.

WHAT LANDS

  · The intent to craft is held with the work. saveResume already carried
    the finishes, the pose and the photograph across the trip to Stripe;
    now it carries the fact that the customer was mid-craft when they were
    stopped.
  · On return the studio starts on its own. It retries the credits gate
    every 1.5s for up to twenty seconds, which covers the webhook, and the
    moment they clear it spends and crafts and opens My Collection with a
    place held for every piece.
  · The retries are quiet. Reopening the buy panel on each attempt would
    show a customer who has just paid a demand for money. Only the last
    attempt speaks, and then honestly.
  · Nothing is faked. The balance is never assumed to have arrived — the
    server is asked, and the answer is the answer. A hopeful client would
    only fail one step later, in front of a customer who had already paid.

Run from the repo root:  python scripts\\build_s104_craft_after_purchase.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s103.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s104.html')

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

# ─────────────────────────────────────── 1 · a quiet spend, for the retry loop

doc = rep(
    doc,
    "  function spendCredits(items){\r\n",
    "  /* `quiet` is for the retries after a purchase. The gate is asked the\r\n"
    "     same question and answers honestly; what changes is that a refusal\r\n"
    "     does not throw the buy panel back at a customer who has just paid. */\r\n"
    "  function spendCredits(items, quiet){\r\n",
    'spendCredits signature',
)

doc = rep(
    doc,
    "      if (!data.ok){\r\n"
    "        var needed = data.needed != null ? data.needed : items.length * CREDITS_PER_IMAGE;\r\n"
    "        if (typeof window.__openPaywall === 'function'){\r\n"
    "          window.__openPaywall({ needed: needed, balance: data.balance || 0, reason: data.reason });\r\n"
    "        }\r\n"
    "        creditsNotice(data.reason, data.balance || 0, needed);\r\n"
    "        return false;\r\n"
    "      }\r\n",

    "      if (!data.ok){\r\n"
    "        var needed = data.needed != null ? data.needed : items.length * CREDITS_PER_IMAGE;\r\n"
    "        if (!quiet){\r\n"
    "          if (typeof window.__openPaywall === 'function'){\r\n"
    "            window.__openPaywall({ needed: needed, balance: data.balance || 0, reason: data.reason });\r\n"
    "          }\r\n"
    "          creditsNotice(data.reason, data.balance || 0, needed);\r\n"
    "        }\r\n"
    "        return false;\r\n"
    "      }\r\n",
    'spendCredits refusal',
)

doc = rep(
    doc,
    "    }).catch(function(){\r\n"
    "      creditsNotice('unreachable', 0, items.length * CREDITS_PER_IMAGE);\r\n"
    "      return false;\r\n"
    "    });\r\n"
    "  }\r\n",
    "    }).catch(function(){\r\n"
    "      if (!quiet) creditsNotice('unreachable', 0, items.length * CREDITS_PER_IMAGE);\r\n"
    "      return false;\r\n"
    "    });\r\n"
    "  }\r\n",
    'spendCredits catch',
)

# ─────────────────────────────── 2 · runAll reports whether it got to the work

doc = rep(
    doc,
    "  function runAll(){\r\n"
    "    if (BUSY) return Promise.resolve();\r\n"
    "    var pending = QUEUE.filter(function(q){ return q.status === 'pending'; });\r\n"
    "    if (!pending.length || !SRC.b64) return Promise.resolve();\r\n",

    "  /* Resolves TRUE only when the credits cleared and the work began, so a\r\n"
    "     caller waiting on a webhook can tell \"not yet\" from \"done\". */\r\n"
    "  function runAll(opts){\r\n"
    "    var quiet = !!(opts && opts.quiet);\r\n"
    "    if (BUSY) return Promise.resolve(false);\r\n"
    "    var pending = QUEUE.filter(function(q){ return q.status === 'pending'; });\r\n"
    "    if (!pending.length || !SRC.b64) return Promise.resolve(false);\r\n",
    'runAll head',
)

doc = rep(
    doc,
    "    return spendCredits(pending).then(function(paid){\r\n"
    "      if (!paid){ BUSY = false; return; }\r\n",
    "    return spendCredits(pending, quiet).then(function(paid){\r\n"
    "      if (!paid){ BUSY = false; labelBusy(); return false; }\r\n",
    'runAll spend',
)

doc = rep(
    doc,
    "          tbcGoSub.textContent = SUB_NOTE;\r\n"
    "        });\r\n"
    "      });\r\n"
    "    });\r\n"
    "  }\r\n"
    "  window.__runAll = runAll;\r\n",

    "          tbcGoSub.textContent = SUB_NOTE;\r\n"
    "        });\r\n"
    "      }).then(function(){ return true; });\r\n"
    "    });\r\n"
    "  }\r\n"
    "  window.__runAll = runAll;\r\n",
    'runAll tail',
)

# ────────────────────────────────── 3 · the intent travels with the work

doc = rep(
    doc,
    "    /* Their work is held before the payment begins. The return is a fresh\r\n"
    "       page load, exactly as the magic link is, and the same machinery\r\n"
    "       carries the finishes, the pose and the photograph across it. */\r\n"
    "    if (typeof saveResume === 'function') saveResume();\r\n",

    "    /* Their work is held before the payment begins. The return is a fresh\r\n"
    "       page load, exactly as the magic link is, and the same machinery\r\n"
    "       carries the finishes, the pose and the photograph across it.\r\n"
    "\r\n"
    "       And the INTENT travels with them. They pressed Craft; being short\r\n"
    "       of credits interrupted that, it did not cancel it. Without this the\r\n"
    "       customer pays and then has to find the button again. */\r\n"
    "    if (typeof saveResume === 'function') saveResume();\r\n"
    "    try {\r\n"
    "      localStorage.setItem(INTENT_KEY, JSON.stringify({ at: Date.now() }));\r\n"
    "    } catch (e){\r\n"
    "      console.warn('[intent] could not hold the craft intent', e);\r\n"
    "    }\r\n",
    'intent saved',
)

# ─────────────────────────────────────── 4 · the studio picks it back up

doc = rep(
    doc,
    "  (function afterPurchase(){\r\n"
    "    if (location.search.indexOf('credits=1') < 0) return;\r\n"
    "    history.replaceState(null, '', location.pathname);\r\n"
    "    console.log('[credits] returned from checkout');\r\n"
    "    if (typeof whoAmI === 'function'){\r\n"
    "      whoAmI().then(function(u){ if (u && typeof restoreResume === 'function') restoreResume(); });\r\n"
    "    }\r\n"
    "    if (tbcGoSub) SUB_NOTE = 'Your credits are on their way \\u00b7 press Craft when you are ready';\r\n"
    "    if (typeof labelGo === 'function') labelGo();\r\n"
    "  })();\r\n",

    "  /* ---- coming back with work to finish ------------------------------------\r\n"
    "     The webhook grants the credits and the browser returns on its own\r\n"
    "     schedule, so for a few seconds the ledger and the page disagree. The\r\n"
    "     answer is not to guess the balance — the craft is gated on the server\r\n"
    "     and a hopeful client would only fail one step later, in front of\r\n"
    "     someone who had already paid. The answer is to keep asking.\r\n"
    "\r\n"
    "     Twenty seconds is generous for a webhook that usually lands in under\r\n"
    "     two. If it has not cleared by then the last attempt speaks plainly and\r\n"
    "     the customer is back where they were, with their work still held. */\r\n"
    "  var INTENT_TRIES = 13;    /* × 1.5s ≈ 20 seconds */\r\n"
    "\r\n"
    "  function clearIntent(){\r\n"
    "    try { localStorage.removeItem(INTENT_KEY); } catch (e){}\r\n"
    "  }\r\n"
    "\r\n"
    "  function craftWhenCreditsLand(n){\r\n"
    "    n = n || 0;\r\n"
    "    var last = n >= INTENT_TRIES;\r\n"
    "    return runAll({ quiet: !last }).then(function(began){\r\n"
    "      if (began){ clearIntent(); return true; }\r\n"
    "      if (last){\r\n"
    "        clearIntent();\r\n"
    "        return false;\r\n"
    "      }\r\n"
    "      return new Promise(function(res){ setTimeout(res, 1500); })\r\n"
    "        .then(function(){ return craftWhenCreditsLand(n + 1); });\r\n"
    "    });\r\n"
    "  }\r\n"
    "\r\n"
    "  (function afterPurchase(){\r\n"
    "    if (location.search.indexOf('credits=1') < 0) return;\r\n"
    "    history.replaceState(null, '', location.pathname);\r\n"
    "    console.log('[credits] returned from checkout');\r\n"
    "\r\n"
    "    var intent = null;\r\n"
    "    try {\r\n"
    "      var raw = localStorage.getItem(INTENT_KEY);\r\n"
    "      if (raw) intent = JSON.parse(raw);\r\n"
    "    } catch (e){ intent = null; }\r\n"
    "    /* An hour-old intent is a different visit, not this one. */\r\n"
    "    if (intent && Date.now() - (intent.at || 0) > 60 * 60 * 1000){\r\n"
    "      clearIntent(); intent = null;\r\n"
    "    }\r\n"
    "\r\n"
    "    if (typeof closeBuy === 'function') closeBuy();\r\n"
    "    if (tbcGoSub){\r\n"
    "      SUB_NOTE = intent\r\n"
    "        ? 'Payment received \\u00b7 the studio is starting'\r\n"
    "        : 'Your credits are on their way';\r\n"
    "    }\r\n"
    "    if (typeof labelGo === 'function') labelGo();\r\n"
    "\r\n"
    "    if (typeof whoAmI !== 'function') return;\r\n"
    "    whoAmI().then(function(u){\r\n"
    "      if (!u) return;\r\n"
    "      var back = (typeof restoreResume === 'function') ? restoreResume() : false;\r\n"
    "      if (!intent || !back) return;\r\n"
    "      /* They pressed Craft. Finish what they started. */\r\n"
    "      return craftWhenCreditsLand(0).then(function(began){\r\n"
    "        if (began || !tbcGoSub) return;\r\n"
    "        SUB_NOTE = 'Your credits are taking a moment \\u00b7 press Craft when they land';\r\n"
    "        if (typeof labelGo === 'function') labelGo();\r\n"
    "      });\r\n"
    "    });\r\n"
    "  })();\r\n",
    'afterPurchase',
)

# the key, declared with the other resume constants
doc = rep(
    doc,
    "  var RESUME_KEY      = 'liten_resume_v1';\r\n",
    "  var RESUME_KEY      = 'liten_resume_v1';\r\n",
    'resume key present',
)

doc = rep(
    doc,
    "  var GATE_URL           = '/api/v1/portraits/gate';\r\n",
    "  /* Held beside the work across the trip to Stripe. Declared here because\r\n"
    "     openBuy writes it at ~4940 and afterPurchase reads it at ~4990, both\r\n"
    "     of them above where the resume constants live. */\r\n"
    "  var INTENT_KEY = 'liten_craft_intent_v1';\r\n"
    "\r\n"
    "  var GATE_URL           = '/api/v1/portraits/gate';\r\n",
    'intent key',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# the intent is written before the payment and read after it
if 'localStorage.setItem(INTENT_KEY' not in doc:
    die('the craft intent is never held')
if 'localStorage.getItem(INTENT_KEY)' not in doc:
    die('the craft intent is never read')
if doc.count('clearIntent()') < 3:
    die('the intent is not cleared on every exit')

# declared above both its writer and its reader — the s102 fault class
at = probe.index("var INTENT_KEY = 'liten_craft_intent_v1';")
for m in re.finditer(r'\bINTENT_KEY\b', probe):
    if m.start() < at:
        die('INTENT_KEY is read above its declaration')

# a customer who has just paid is never shown the paywall again mid-retry
if 'function spendCredits(items, quiet)' not in doc:
    die('spendCredits cannot be asked quietly')
if 'runAll({ quiet: !last })' not in doc:
    die('the retries are not quiet')
if 'if (!quiet){' not in doc:
    die('the refusal path ignores quiet')

# runAll must report, or the loop cannot tell "not yet" from "done"
if 'return Promise.resolve(false);' not in doc:
    die('runAll does not report when there is nothing to do')
if '}).then(function(){ return true; });' not in doc:
    die('runAll does not report success')
if 'labelBusy(); return false; }' not in doc:
    die('a refused spend does not report false')

# nothing may fake a balance
if re.search(r'balance\s*=\s*(SHORT\.needed|needed)', probe):
    die('the balance is being assumed rather than asked for')

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

print('GATE PASSED · one press, one craft · 20s of quiet retries · %d routes' % routes)
print('wrote ' + OUT)
