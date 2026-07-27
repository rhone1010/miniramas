#!/usr/bin/env python3
"""
build_b2.py — Portraits build 2

BASE:   public/portraits-b1.html
OUTPUT: public/portraits-b2.html

CHANGE — the call-path swap (CREDITS-AND-CODES-SPEC-v4 §4)

  runAll diverts every unpaid item to startCheckout and RETURNS, so
  craftPending() is never reached. The render sits behind a payment page.

  Worse, hosted checkout redirects: the page unloads, in-memory state dies,
  and the sessionStorage restore is unreliable. Observed on the walk — Stripe
  completed, the page came back empty, nothing crafted. The file's own comment
  predicted it: "the page unloads and all in-memory state dies."

  A1 ruled credits govern. This replaces the divert with a credits gate call.
  No redirect, no snapshot, no state loss — on ok the items are entitled and
  execution falls straight through to the existing, untouched craftPending().

  startCheckout is left in place but unreferenced from runAll; it remains the
  Aug 15 funding path for buying credits.

REQUIRES an owner. /api/v1/credits/gate resolves the caller via getUser().
Sign in once (any surface — the cookie is shared) before crafting, or the
gate returns no_owner and says so.

GATE
  Fails and writes nothing on: a lost id, a lost function, a JS syntax error,
  markup drift, a duplicate id, a surviving startCheckout call inside runAll,
  or craftPending no longer being reachable from runAll.
"""

import re, sys, subprocess, os

SRC = 'public/portraits-b1.html'
OUT = 'public/portraits-b2.html'

if not os.path.exists(SRC):
    print(f'BASE NOT FOUND: {SRC}\nRun build_b1.py first.'); sys.exit(1)

before = open(SRC, encoding='utf-8').read()
h      = before
CRLF   = '\r\n' in before
nl     = lambda s: s.replace('\n', '\r\n') if CRLF else s

# ---------------------------------------------------------------- 1. the swap
OLD = nl("""  // ── PAYMENT GATE — money is gathered before crafting. The single
  // free preview (is_preview) is the only thing that crafts unpaid. ──
  const unpaid = state.queue.filter(q => q.status === 'pending' && !q.paid && !q.is_preview)
  if (unpaid.length){
    startCheckout('pieces', unpaid.map(q => q.id))
    return
  }""")

NEW = nl("""  // ── CREDITS GATE — spec v4 §4. Replaces the Stripe divert.
  // Hosted checkout redirected, the page unloaded, and in-memory state died;
  // the render never fired. The gate spends server-side and returns, so we
  // fall through to the existing craftPending() with nothing lost.
  // The single free preview (is_preview) still crafts unspent.
  const unpaid = state.queue.filter(q => q.status === 'pending' && !q.paid && !q.is_preview)
  if (unpaid.length){
    const spent = await spendCredits(unpaid)
    if (!spent) return
  }""")

if h.count(OLD) != 1:
    print(f'ANCHOR FAIL: payment gate block found {h.count(OLD)} times, expected 1')
    sys.exit(1)
h = h.replace(OLD, NEW, 1)

# ---------------------------------------------------------------- 2. the helper
ANCHOR = nl('async function runAll(){')
HELPER = nl("""// ── CREDITS ──────────────────────────────────────────────────
// One Crafted Image costs 10 credits (spec v4 §1). The gate is server-side
// and authoritative: it resolves the owner from the auth cookie, spends,
// and writes the craft_events + credit_ledger audit rows. The client only
// reports the outcome.
const CREDIT_COST_PER_IMAGE = 10
const CREDITS_GATE_URL = '/api/v1/credits/gate'

async function spendCredits(items){
  try {
    const res = await fetch(CREDITS_GATE_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        count:    items.length,
        cost_per: CREDIT_COST_PER_IMAGE,
        series:   'portraits',
        presets:  items.map(q => q.preset || null),
      }),
    })
    const data = await res.json().catch(() => ({ ok: false, reason: 'bad_response' }))

    if (!data.ok){
      const needed = data.needed != null ? data.needed : items.length * CREDIT_COST_PER_IMAGE
      if (data.reason === 'no_owner'){
        creditsNotice('Sign in to craft — credits are held against your account.')
      } else if (data.reason === 'insufficient_credits'){
        creditsNotice('Not enough credits. You have ' + (data.balance || 0) +
                      ', this needs ' + needed + '.')
      } else {
        creditsNotice('The studio could not start this craft. ' + (data.reason || ''))
      }
      return false
    }

    items.forEach(q => { q.paid = true })
    if (typeof console !== 'undefined' && console.log){
      console.log('[credits] spent ' + (items.length * CREDIT_COST_PER_IMAGE) +
                  ' — balance now ' + data.balance_after + (data.admin ? ' (admin, no charge)' : ''))
    }
    return true

  } catch (e){
    creditsNotice('Could not reach the studio. Try again.')
    return false
  }
}

function creditsNotice(msg){
  if (typeof setGStatus === 'function') setGStatus(msg)
  alert(msg)
}

async function runAll(){""")

if h.count(ANCHOR) != 1:
    print(f'ANCHOR FAIL: runAll declaration found {h.count(ANCHOR)} times'); sys.exit(1)
h = h.replace(ANCHOR, HELPER, 1)

# ---------------------------------------------------------------- gate
fail = []

def ids_of(d):  return re.findall(r'(?<![-\w])id="([^"]+)"', d)
def funcs(d):
    s = ' '.join(re.findall(r'<script[^>]*>(.*?)</script>', d, re.S))
    return set(re.findall(r'function\s+([A-Za-z_$][\w$]*)', s))
def fetches(d): return len(re.findall(r'\bfetch\s*\(', d))

b_ids, a_ids = set(ids_of(before)), set(ids_of(h))
b_fn,  a_fn  = funcs(before), funcs(h)

if b_ids - a_ids: fail.append(f'LOST IDS: {sorted(b_ids - a_ids)}')
if b_fn  - a_fn:  fail.append(f'LOST FUNCTIONS: {sorted(b_fn - a_fn)}')

dupes = {i for i in ids_of(h) if ids_of(h).count(i) > 1}
if dupes: fail.append(f'DUPLICATE IDS: {sorted(dupes)}')

# the swap must have actually happened inside runAll
m = re.search(r'async function runAll\(\)\s*\{', h)
body = h[m.end():h.index('\nasync function', m.end() + 10)] if m else ''
if 'startCheckout(' in body:
    fail.append('startCheckout STILL CALLED FROM runAll')
if 'spendCredits(' not in body:
    fail.append('spendCredits NOT CALLED FROM runAll')
if 'craftPending()' not in body:
    fail.append('craftPending NO LONGER REACHABLE FROM runAll')

# the new helper must exist and be the only definition
if h.count('async function spendCredits(') != 1:
    fail.append('spendCredits not defined exactly once')
if 'CREDIT_COST_PER_IMAGE = 10' not in h:
    fail.append('credit cost is not 10 (spec v4 §1)')

# one new fetch call, no others gained or lost
if fetches(h) != fetches(before) + 1:
    fail.append(f'FETCH COUNT: {fetches(before)} -> {fetches(h)}, expected +1')

# markup untouched
strip = lambda d: re.sub(r'<script[^>]*>.*?</script>', '', d, flags=re.S)
if strip(h) != strip(before): fail.append('MARKUP DRIFT — b2 is a script-only change')

for i, s in enumerate(re.findall(r'<script[^>]*>(.*?)</script>', h, re.S)):
    if not s.strip(): continue
    fn = f'/tmp/b2_{i}.js'
    open(fn, 'w', encoding='utf-8').write(s)
    r = subprocess.run(['node', '--check', fn], capture_output=True, text=True)
    if r.returncode != 0:
        fail.append(f'SCRIPT[{i}] SYNTAX: ' + r.stderr.strip().split("\n")[0][:110])

if fail:
    print('GATE FAILED — nothing written:')
    for f in fail: print('  ' + f)
    sys.exit(1)

open(OUT, 'w', encoding='utf-8', newline='').write(h)

print('ALL GATES PASSED')
print(f'  ids        {len(b_ids)} -> {len(a_ids)}   (none lost)')
print(f'  functions  {len(b_fn)} -> {len(a_fn)}   (+1 spendCredits, +1 creditsNotice)')
print(f'  fetch      {fetches(before)} -> {fetches(h)}   (+1 credits/gate)')
print(f'  runAll     startCheckout removed, craftPending reachable')
print(f'  markup     unchanged')
print(f'WROTE {OUT}')
print('')
print('Sign in first (the auth cookie is shared across surfaces), then')
print('view localhost:3000/portraits-b2.html and craft.')
