# -*- coding: utf-8 -*-
"""
build_s126_account_cards.py  ·  2026-08-05  ·  CUI V25

The Account page rebuilt to Rich's mockup. Cards, not a sidebar.

    Five cards on a two-column grid: Credits across the left, Your Details
    on the right, then Activity and Purchases side by side under the first,
    and Prints under the second.

    The sidebar navigation is gone. Five sections behind five clicks was
    hiding four of them; a customer opening their account wants to see the
    balance, what they have spent and where their prints are, at once.

THE COINS ARE REAL AND THEY ARE SIZED BY THE PURCHASE
    public/icons/acount/ — the folder name is spelled that way on disk and
    this uses it verbatim rather than quietly correcting it and 404ing.

      litenco_credit.png       one coin   · the balance and the small rows
      credits_2_coins.png      two coins  · a small block
      credits_small_stack.png  a stack    · a middling block
      credits_big_stack.png    three      · the largest blocks

    A hundred credits should not look like ten.

WHAT THE MOCKUP SHOWS THAT THE DATABASE DOES NOT HOLD
    Omitted rather than invented. Each returns the day it is real:

      · Name           — magic link gives an email and nothing else
      · Password       — there isn't one, and that is a feature
      · Fulfilment address — typed fresh at every checkout, stored nowhere
      · Re-craft credits, "1 of 2" — the 7/29 ruling exists; nothing counts
      · Communication preferences — no storage, and no email is sent
      · View receipt   — Stripe issues one; we do not keep the URL
      · Shipped / Delivered — status stops at `placed`; the rest is
                          Prodigi's callback, which is not wired

    A placeholder that looks like data is worse than a gap. The gaps are
    visible and honest.

Run from the repo root:  python scripts\\build_s126_account_cards.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-04-s125.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-05-s126.html')
ICONS = os.path.join(ROOT, 'public', 'icons', 'acount')

EXPECTED_ROUTES = 17

WANT = ['litenco_credit.png', 'credits_2_coins.png',
        'credits_small_stack.png', 'credits_big_stack.png']


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


# ── the coins must exist before anything asks for them ──────────────────────
if not os.path.isdir(ICONS):
    die('public/icons/acount/ not found — that is the spelling on disk')
missing = [f for f in WANT if not os.path.exists(os.path.join(ICONS, f))]
if missing:
    die('missing coin art: ' + ', '.join(missing))

with open(SRC, encoding='utf-8', newline='') as f:
    src = f.read()

doc = src

# ───────────────────────────────────────────────────────────────────── 1 · CSS

CSS = """
/* ---- the account, as cards ----------------------------------------------
   Five cards on two columns. The sidebar is gone: five sections behind five
   clicks was hiding four of them, and a customer opening their account wants
   the balance, what they have spent and where their prints are at once. */
.ac-head{ margin-bottom:clamp(14px,1.2vw,24px) }
.ac-head h2{
  font-family:var(--serif); font-size:clamp(1.9rem,2.2vw,2.6rem);
  font-weight:400; color:var(--ink); line-height:1.1;
}
.ac-head p{
  font-family:var(--sans); font-size:.88rem; color:var(--ink-soft);
  margin-top:.3em;
}
.ac-cards{
  display:grid; gap:clamp(12px,1.1vw,20px);
  grid-template-columns:1.35fr 1fr;
  align-items:start;
  padding-bottom:2rem;
}
@media (max-width:1279px){ .ac-cards{ grid-template-columns:1fr } }
.ac-card{
  padding:clamp(16px,1.3vw,26px);
  border-radius:10px;
  background:rgba(255,255,255,.5);
  border:1px solid rgba(137,105,67,.22);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.65), 0 .4rem 1.2rem rgba(59,41,25,.07);
}
.ac-card h3{
  display:flex; align-items:center; gap:.5em;
  font-family:var(--serif); font-size:1.45rem; font-weight:400; color:var(--ink);
}
.ac-card h3 img{ width:1.3em; height:1.3em; object-fit:contain }
.ac-card > p.note{
  font-family:var(--sans); font-size:.78rem; color:var(--ink-soft);
  margin:.25em 0 1em;
}
/* Credits spans the left column; the pair under it share it. */
.ac-credits{ grid-column:1; grid-row:1 }
.ac-you{ grid-column:2; grid-row:1 }
.ac-pair{ grid-column:1; grid-row:2; display:grid; gap:inherit;
  grid-template-columns:1fr 1fr }
.ac-prints{ grid-column:2; grid-row:2 }
@media (max-width:1279px){
  .ac-credits,.ac-you,.ac-pair,.ac-prints{ grid-column:1; grid-row:auto }
  .ac-pair{ grid-template-columns:1fr }
}
@media (max-width:900px){ .ac-pair{ grid-template-columns:1fr } }

/* the balance */
.ac-balance{ position:relative; display:flex; align-items:flex-start; gap:1.4em }
.ac-balance .fig{ flex:1; min-width:0 }
.ac-balance .n{
  font-family:var(--serif); font-size:clamp(3rem,4.4vw,4.4rem); line-height:.95;
  color:var(--oxblood); font-variant-numeric:tabular-nums;
}
.ac-balance .u{
  font-family:var(--serif); font-size:1.15rem; color:var(--ink); margin-top:.1em;
}
/* The coin, quietly behind the number. */
.ac-balance .seal{
  width:clamp(74px,7vw,116px); height:auto; flex:0 0 auto;
  opacity:.5; align-self:center;
}
.ac-acts{ display:flex; gap:.6em; flex-wrap:wrap; margin-top:1.2em }
.ac-acts button{
  padding:.7em 1.4em; border-radius:8px; cursor:pointer;
  font-family:var(--serif); font-style:italic; font-size:1.15rem;
}
.ac-buy{ border:0; background:var(--oxblood); color:var(--vellum-100) }
.ac-second{
  background:transparent; border:1px solid rgba(137,105,67,.34); color:var(--ink);
}
.ac-second:hover{ background:rgba(125,66,66,.07); border-color:var(--oxblood) }
.ac-second:disabled{ opacity:.45; cursor:default }

/* rows — activity, purchases, prints */
.ac-list{ margin-top:.2em }
.ac-item{
  display:flex; align-items:center; gap:.8em;
  padding:.6em 0; border-bottom:1px solid rgba(137,105,67,.14);
}
.ac-item:last-child{ border-bottom:0 }
.ac-item .ic{
  width:38px; height:38px; flex:0 0 auto;
  display:flex; align-items:center; justify-content:center;
}
.ac-item .ic img{ max-width:100%; max-height:100%; object-fit:contain }
.ac-item .body{ flex:1; min-width:0 }
.ac-item .t{
  font-family:var(--sans); font-size:.86rem; color:var(--ink);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.ac-item .s{
  font-family:var(--sans); font-size:.74rem; color:var(--ink-soft); margin-top:.15em;
}
.ac-item .v{
  font-family:var(--sans); font-size:.9rem; color:var(--ink);
  font-variant-numeric:tabular-nums; white-space:nowrap;
}
.ac-item .v.is-out{ color:var(--oxblood) }
.ac-item .v.is-in{ color:#4a6141 }

/* your details */
.ac-row{
  display:flex; align-items:baseline; gap:1em;
  padding:.65em 0; border-bottom:1px solid rgba(137,105,67,.14);
  font-family:var(--sans); font-size:.86rem;
}
.ac-row .k{ flex:0 0 34%; color:var(--ink-soft) }
.ac-row .v{ flex:1; min-width:0; color:var(--ink); word-break:break-word }
.ac-out{
  width:100%; margin-top:1.2em; padding:.7em;
  border:0; border-radius:8px; background:var(--oxblood);
  font-family:var(--serif); font-style:italic; font-size:1.15rem;
  color:var(--vellum-100); cursor:pointer;
}

/* the one nudge on this page, and only when it is true */
.ac-nudge{
  display:flex; align-items:center; gap:1em; flex-wrap:wrap;
  padding:.9em 1.1em; margin-bottom:1em; border-radius:8px;
  background:rgba(196,169,110,.12); border:1px solid rgba(196,169,110,.3);
  font-family:var(--sans); font-size:.84rem; color:var(--ink); line-height:1.45;
}
.ac-nudge button{
  margin-left:auto; padding:.55em 1.1em; border:0; border-radius:7px;
  background:var(--oxblood); color:var(--vellum-100); cursor:pointer;
  font-family:var(--serif); font-style:italic; font-size:1.05rem;
  white-space:nowrap;
}
.ac-gap{
  font-family:var(--sans); font-size:.78rem; color:rgba(60,48,34,.5);
  padding:.8em 0; line-height:1.5;
}
"""

doc = rep(
    doc,
    "/* ---- the two columns ---------------------------------------------------- */\n",
    CSS + "\n/* ---- the two columns ---------------------------------------------------- */\n",
    'account cards css',
)

# ────────────────────────────────────────────────────────────────── 2 · markup

doc = rep(
    doc,
    "    <div class=\"ac-body\">\r\n"
    "      <nav class=\"ac-side\" id=\"acNav\">\r\n"
    "        <button class=\"ac-nav is-on\" type=\"button\" data-sec=\"credits\">Credits</button>\r\n"
    "        <button class=\"ac-nav\" type=\"button\" data-sec=\"activity\">Activity</button>\r\n"
    "        <button class=\"ac-nav\" type=\"button\" data-sec=\"purchases\">Purchases</button>\r\n"
    "        <button class=\"ac-nav\" type=\"button\" data-sec=\"prints\">Prints</button>\r\n"
    "        <button class=\"ac-nav\" type=\"button\" data-sec=\"you\">Your details</button>\r\n"
    "      </nav>\r\n"
    "      <div class=\"ac-main\" id=\"acMain\"></div>\r\n"
    "    </div>\r\n",

    "    <!-- Cards, not a sidebar. Five sections behind five clicks was hiding\r\n"
    "         four of them. -->\r\n"
    "    <div class=\"ac-main\" id=\"acMain\"></div>\r\n",
    'account markup',
)

# ────────────────────────────────────────────────────────────────────── 3 · JS

JS = '''  /* ---- the coins ----------------------------------------------------------
     public/icons/acount/ — spelled that way on disk, and used verbatim
     rather than quietly corrected into a 404.

     Sized by the purchase, because a hundred credits should not look like
     ten. */
  var COIN = '/icons/acount/';
  function coinFor(n){
    if (n >= 100) return COIN + 'credits_big_stack.png';
    if (n >= 50)  return COIN + 'credits_small_stack.png';
    if (n >= 20)  return COIN + 'credits_2_coins.png';
    return COIN + 'litenco_credit.png';
  }

  function acItem(icon, title, sub, value, cls){
    return '<div class="ac-item">' +
      '<span class="ic">' + (icon ? '<img src="' + esc(icon) + '" alt="">' : '') + '</span>' +
      '<span class="body"><span class="t">' + esc(title) + '</span>' +
        (sub ? '<span class="s">' + esc(sub) + '</span>' : '') + '</span>' +
      (value ? '<span class="v' + (cls ? ' ' + cls : '') + '">' + esc(value) + '</span>' : '') +
    '</div>';
  }

  /* A section that could not be read says so. A section that is genuinely
     empty says that instead — they are different facts and a customer can
     tell them apart. */
  function acRows(rows, render, empty){
    if (!rows) return '<p class="ac-gap">This could not be read just now.</p>';
    if (!rows.length) return '<p class="ac-gap">' + esc(empty) + '</p>';
    return '<div class="ac-list">' + rows.map(render).join('') + '</div>';
  }

  function acCardCredits(){
    var bal = ACCT && ACCT.credits ? ACCT.credits.balance : null;
    var pieces = ACCT && ACCT.pieces ? ACCT.pieces : null;
    var flags = ACCT && ACCT.flags ? ACCT.flags : null;
    var some = pieces && pieces.total > 0;

    return '<div class="ac-card ac-credits">' +
      '<h3>Credits</h3>' +
      '<div class="ac-balance">' +
        '<span class="fig">' +
          '<span class="n">' + (bal == null ? '\\u2014' : bal) + '</span>' +
          '<span class="u" style="display:block">' +
            (bal === 1 ? 'credit available' : 'credits available') + '</span>' +
          '<p class="note" style="margin-top:.7em">Ten credits create one piece.<br>' +
            'Credits never expire.</p>' +
        '</span>' +
        '<img class="seal" src="' + COIN + 'litenco_credit.png" alt="">' +
      '</div>' +
      '<div class="ac-acts">' +
        '<button class="ac-buy" id="acBuy" type="button">Buy credits</button>' +
        '<button class="ac-second" id="acDlAll" type="button"' +
          (some ? '' : ' disabled') + '>Download all</button>' +
      '</div>' +
      (pieces
        ? '<p class="note" style="margin:1em 0 0">' + pieces.total +
          (pieces.total === 1 ? ' piece' : ' pieces') + ' crafted' +
          (pieces.archived ? ' \\u00b7 ' + pieces.archived + ' archived' : '') + '</p>'
        : '') +
      (flags && flags.fulfilment === false
        ? '<p class="note" style="margin:.4em 0 0">This account is set up for ' +
          'testing. Prints are recorded but nothing is sent to the fulfilment lab.</p>'
        : '') +
    '</div>';
  }

  function acCardYou(){
    var u = ACCT ? ACCT.user : null;
    return '<div class="ac-card ac-you">' +
      '<h3>Your details</h3>' +
      '<p class="note">Signing in is by email. There is no password to remember ' +
        'or to lose.</p>' +
      '<div class="ac-row"><span class="k">Email</span>' +
        '<span class="v">' + esc((u && u.email) || '\\u2014') + '</span></div>' +
      (u && u.since
        ? '<div class="ac-row"><span class="k">With the studio since</span>' +
          '<span class="v">' + esc(acDate(u.since)) + '</span></div>'
        : '') +
      /* Name, a saved address and communication preferences are all in the
         mockup and none of them is stored yet. Omitted rather than shown as
         a row a customer could try to edit. */
      '<button class="ac-out" id="acOut" type="button">Sign out</button>' +
    '</div>';
  }

  function acCardActivity(){
    var rows = ACCT ? ACCT.ledger : null;
    return '<div class="ac-card">' +
      '<h3>Activity</h3>' +
      '<p class="note">Everything the studio has taken and given back.</p>' +
      acRows(rows, function(r){
        var out = r.delta < 0;
        return acItem(
          coinFor(Math.abs(r.delta)),
          AC_REASON[r.reason] || r.reason,
          acDate(r.created_at),
          (out ? '' : '+') + r.delta,
          out ? 'is-out' : 'is-in');
      }, 'Nothing yet.') +
    '</div>';
  }

  function acCardPurchases(){
    var rows = ACCT ? ACCT.purchases : null;
    return '<div class="ac-card">' +
      '<h3>Purchases</h3>' +
      '<p class="note">Credit blocks bought. A checkout closed before paying ' +
        'shows as unfinished and was never charged.</p>' +
      acRows(rows, function(r){
        var n = parseInt(String(r.sku_id || '').replace(/[^0-9]/g, ''), 10) || 0;
        return acItem(
          coinFor(n),
          (n ? n + ' credits' : (r.sku_id || 'Credits')),
          acDate(r.created_at) + (r.status === 'paid' ? '' : ' \\u00b7 unfinished'),
          acMoney(r.amount_cents), '');
      }, 'Nothing bought yet.') +
    '</div>';
  }

  function acCardPrints(){
    var rows = ACCT ? ACCT.prints : null;
    var pieces = ACCT && ACCT.pieces ? ACCT.pieces : null;
    /* One nudge on this page, and only when it is true: they have work and
       have never printed any of it. */
    var nudge = (pieces && pieces.total > 0 && rows && !rows.length)
      ? '<div class="ac-nudge">Your pieces can be printed on fine art paper, ' +
        'canvas or framed.' +
        '<button id="acToPrint" type="button">Visit the Print Shop</button></div>'
      : '';
    return '<div class="ac-card ac-prints">' +
      '<h3>Prints</h3>' +
      '<p class="note">Orders sent to the fulfilment lab.</p>' +
      nudge +
      acRows(rows, function(r){
        return acItem(
          null,
          r.prodigi_order_id || 'Order',
          acDate(r.created_at) + ' \\u00b7 ' + (r.status || ''),
          acMoney(r.retail_total_cents), '');
      }, 'No prints ordered yet.') +
    '</div>';
  }

  function renderAccount(){
    var main = document.getElementById('acMain');
    var who  = document.getElementById('acWho');
    if (!main) return;
    if (who) who.textContent = (ACCT && ACCT.user && ACCT.user.email) || '';
    main.innerHTML =
      '<div class="ac-head"><h2>Your Account</h2>' +
        '<p>Manage your credits, your work and your details.</p></div>' +
      '<div class="ac-cards">' +
        acCardCredits() +
        acCardYou() +
        '<div class="ac-pair">' + acCardActivity() + acCardPurchases() + '</div>' +
        acCardPrints() +
      '</div>';
  }

'''

# replace the five section builders and the renderer in one go
m = re.search(r'  function acCredits\(\)\{.*?\n  function renderAccount\(\)\{.*?\r?\n  \}\r?\n', doc, re.S)
if not m:
    die('the account section builders were not found')
if doc[m.start():m.end()].count('\n') > 140:
    die('the account match ran past its own close — %d lines'
        % doc[m.start():m.end()].count('\n'))
doc = doc[:m.start()] + JS + doc[m.end():]

# the nav is gone
m = re.search(r'  var acNav = document\.getElementById\(\'acNav\'\);.*?\r?\n  \}\);\r?\n', doc, re.S)
if not m:
    die('the account nav handler was not found')
doc = doc[:m.start()] + (
    "  /* The section nav is gone with the sidebar. */\r\n"
) + doc[m.end():]

# new buttons on the page
doc = rep(
    doc,
    "    if (e.target.closest('#acOut')){\r\n",
    "    if (e.target.closest('#acDlAll')){\r\n"
    "      /* Everything on the wall, not the archive — putting something away\r\n"
    "         is a request not to be handed it again. */\r\n"
    "      var all = PIECES.filter(function(p){ return p.art && !p.archived; });\r\n"
    "      if (all.length && typeof downloadMany === 'function') downloadMany(all);\r\n"
    "      return;\r\n"
    "    }\r\n"
    "    if (e.target.closest('#acToPrint')){\r\n"
    "      if (typeof showPrintShop === 'function') showPrintShop();\r\n"
    "      return;\r\n"
    "    }\r\n"
    "    if (e.target.closest('#acOut')){\r\n",
    'account buttons',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != EXPECTED_ROUTES:
    die('route count is %d, expected %d' % (routes, EXPECTED_ROUTES))

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# cards, not a sidebar
if 'id="acNav"' in doc:
    die('the sidebar survived')
if doc.count('class="ac-card') < 5:
    die('there are not five cards')
for fn in ('function acCardCredits(', 'function acCardYou(', 'function acCardActivity(',
           'function acCardPurchases(', 'function acCardPrints('):
    if doc.count(fn) != 1:
        die('%s is not declared exactly once' % fn)

# the coins, at the spelling on disk, sized by the purchase
if "var COIN = '/icons/acount/';" not in doc:
    die('the coin path is not the one on disk')
for f in WANT:
    if f not in doc:
        die('%s is never used' % f)
if 'function coinFor(' not in doc:
    die('the coins are not sized by the purchase')

# nothing invented
for word in ('Password', 'Fulfillment Address', 'Fulfilment Address',
             'Communication Preferences', 'View receipt', 'Re-craft credits'):
    if word in probe:
        die('the mockup showed %s and it is not stored — it must not be drawn' % word)

# the one nudge is conditional on being true
if "pieces.total > 0 && rows && !rows.length" not in doc:
    die('the Print Shop nudge is not conditional on having work and no orders')

# declared above their readers
at = probe.index("var COIN = ")
for m2 in re.finditer(r'\bCOIN\b', probe):
    if m2.start() < at:
        die('COIN is read above its declaration')

for sel in ('.ac-cards{', '.ac-card{', '.ac-balance{', '.ac-item{', '.ac-nudge{',
            '.ac-gap{', '.ac-pair{', '.ac-head h2{'):
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

print('GATE PASSED · five cards, real coins, nothing invented · %d routes' % routes)
print('wrote ' + OUT)
