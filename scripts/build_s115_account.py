# -*- coding: utf-8 -*-
"""
build_s115_account.py  ·  2026-08-03  ·  CUI V25

The Account page. Ruled on 2026-07-27 as where first login lands; never built.

WHAT IT SHOWS
    The balance and a way to buy. What the studio has taken and given back,
    line by line, from the ledger itself. Purchases. Print orders and where
    they are. How much work the customer has. Their email, and the door out.

THE SHAPE
    Vellum and limestone, the same surface as the Print Shop — this is the
    other place a customer stands still and reads. Sidebar 17% / main 83%,
    per the global layout lock.

DECISIONS TAKEN, LOGGED FOR RICH

  1 · THE LEDGER IS SHOWN IN FULL, PLAINLY. Not a summary. A customer who
      wonders where ten credits went can see the exact line, with what it was
      for and what the balance became. Money in the second register
      throughout — no charm anywhere on this page.

  2 · A PENDING PURCHASE IS SHOWN. Four of Rich's own sit in the table from
      checkouts opened while the webhook was off. A customer who abandoned
      one deserves to see that it did not charge them, rather than wondering.

  3 · TESTER STATE IS SHOWN WHEN THE FLAG IS OFF. An account that cannot
      place a real print order should know before it tries, not at the
      webhook. It says what it is; it does not apologise.

  4 · NO DELETE BUTTON. The route has DELETE, it has no confirmation, no undo
      and it presently reports the wrong forfeiture. Wiring a button to that
      today would be handing a customer a lever that destroys their balance
      and misreports what they lost. Rich rules when it goes on.

  5 · NOTHING HERE COMPUTES MONEY. The balance comes from credit_balances.
      The ledger is printed, never summed. Two numbers that could disagree is
      how drift starts.

Run from the repo root:  python scripts\\build_s115_account.py
"""

import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s114.html')
OUT = os.path.join(ROOT, 'public', 'litenco-stage-2026-08-03-s115.html')

ROUTES_BEFORE = 16
ROUTES_AFTER = 17


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
    die('expected %d routes in s114, found %d' % (ROUTES_BEFORE, src.count('fetch(')))

doc = src

# ───────────────────────────────────────────────────────────────────── 1 · CSS

CSS = """
/* ======================================================================
   THE ACCOUNT
   The same vellum and limestone as the Print Shop — the two places a
   customer stands still and reads. Sidebar 17% / main 83%, per the
   global layout lock.
   ====================================================================== */
.acct{
  position:fixed; z-index:57;
  top:var(--mh-h); bottom:0; right:0;
  left:calc(var(--stage-gutter) + var(--spine-w) + var(--room-gap));
  display:flex; flex-direction:column;
  padding:clamp(16px,1.2vw,26px) clamp(14px,1vw,22px) 0;
  isolation:isolate;
  background-color:var(--limestone);
  background-image:
    radial-gradient(circle at 8% 0%, rgba(255,255,255,.4), transparent 44%),
    radial-gradient(circle at 94% 96%, rgba(118,82,45,.04), transparent 46%),
    linear-gradient(0deg,
      rgba(241,236,227,var(--ls-wash)), rgba(241,236,227,var(--ls-wash))),
    url("/textures/limestone.jpg");
  background-repeat:no-repeat,no-repeat,repeat,repeat;
  background-size:auto,auto,auto,var(--ls-tile) var(--ls-tile);
  border-left:1px solid rgba(137,105,67,.24);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.6), -1.2rem 0 2.4rem rgba(46,32,18,.18);
  transform:translateX(101%);
  transition:transform .72s cubic-bezier(.16,1,.3,1);
  overflow:hidden;
}
.acct.is-open{ transform:translateX(0) }
.acct::before{
  content:""; position:absolute; inset:0; z-index:-1; pointer-events:none;
  background-image:url("/textures/noise.png");
  background-repeat:repeat; background-size:14rem 14rem;
  opacity:.045; mix-blend-mode:multiply;
}
.acct > *{ position:relative; z-index:1 }
.acct .mc-head{ border-bottom-color:rgba(137,105,67,.22) }
.acct .mc-close{ color:var(--ink-soft) }
.acct .mc-close:hover{ color:var(--oxblood) }
.acct .mc-title{ color:var(--ink) }
.acct .mc-n{ color:var(--ink-soft) }

/* ---- the two columns ---------------------------------------------------- */
.ac-body{ flex:1; min-height:0; display:flex; gap:clamp(16px,1.6vw,32px); overflow:hidden }
.ac-side{
  flex:0 0 17%; min-width:150px;
  display:flex; flex-direction:column; gap:.15em;
  padding-top:.4em;
}
.ac-nav{
  display:block; width:100%; text-align:left;
  padding:.6em .8em; border:0; border-radius:5px; background:transparent;
  font-family:var(--serif); font-size:1.1875rem; line-height:1.2;
  color:var(--ink-soft); cursor:pointer;
  transition:background .2s ease, color .2s ease;
}
.ac-nav:hover{ background:rgba(125,66,66,.07); color:var(--ink) }
.ac-nav.is-on{ background:rgba(125,66,66,.1); color:var(--oxblood) }
.ac-nav:focus-visible{ outline:2px solid var(--gold); outline-offset:2px }

.ac-main{ flex:1; min-width:0; overflow-y:auto; padding-bottom:2rem }
.ac-sec{ margin-bottom:2.2rem }
.ac-sec[hidden]{ display:none }
.ac-h{
  font-family:var(--serif); font-size:1.5rem; color:var(--ink);
  margin-bottom:.15em;
}
.ac-sub{
  font-family:var(--sans); font-size:.82rem; color:var(--ink-soft);
  margin-bottom:1em; line-height:1.5;
}

/* ---- the balance -------------------------------------------------------- */
.ac-bal{
  display:flex; align-items:center; gap:1.4em; flex-wrap:wrap;
  padding:1.4em 1.6em; border-radius:10px;
  background:rgba(255,255,255,.6);
  border:1px solid rgba(137,105,67,.28);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.7);
}
.ac-bal .n{
  font-family:var(--serif); font-size:3rem; line-height:1;
  color:var(--ink); font-variant-numeric:tabular-nums;
}
.ac-bal .u{ font-family:var(--sans); font-size:.82rem; color:var(--ink-soft) }
.ac-bal .sp{ flex:1 }
.ac-buy{
  padding:.7em 1.4em; border:0; border-radius:8px; background:var(--oxblood);
  font-family:var(--serif); font-style:italic; font-size:1.2rem;
  color:var(--vellum-100); cursor:pointer;
}

/* ---- rows: the ledger, purchases, orders -------------------------------- */
.ac-rows{ border-top:1px solid rgba(137,105,67,.18) }
.ac-row{
  display:flex; align-items:baseline; gap:1em;
  padding:.7em .2em;
  border-bottom:1px solid rgba(137,105,67,.14);
  font-family:var(--sans); font-size:.86rem; color:var(--ink-soft);
}
.ac-row .what{ flex:1; min-width:0; color:var(--ink) }
.ac-row .when{ flex:0 0 auto; font-size:.78rem }
.ac-row .amt{
  flex:0 0 5.5em; text-align:right; font-variant-numeric:tabular-nums;
  color:var(--ink);
}
.ac-row .amt.is-out{ color:var(--oxblood) }
.ac-row .amt.is-in{ color:#4a6141 }
.ac-row .bal{
  flex:0 0 6em; text-align:right; font-size:.78rem;
  font-variant-numeric:tabular-nums;
}
.ac-tag{
  display:inline-block; padding:.1em .5em; border-radius:999px;
  font-size:.68rem; letter-spacing:.04em;
  background:rgba(137,105,67,.14); color:var(--ink-soft);
}
.ac-tag.is-live{ background:rgba(74,97,65,.16); color:#3f5637 }
.ac-tag.is-held{ background:rgba(125,66,66,.12); color:var(--oxblood) }
.ac-empty{
  font-family:var(--serif); font-style:italic; font-size:1.1rem;
  color:rgba(60,48,34,.5); padding:1.2em 0;
}

/* ---- the notice about fulfilment ---------------------------------------- */
.ac-note{
  display:flex; gap:.7em; align-items:flex-start;
  padding:.9em 1.1em; margin-bottom:1.2em; border-radius:8px;
  background:rgba(125,66,66,.07);
  border:1px solid rgba(125,66,66,.24);
  font-family:var(--sans); font-size:.84rem; line-height:1.5;
  color:var(--ink);
}

/* ---- the door out ------------------------------------------------------- */
.ac-out{
  padding:.65em 1.3em; border-radius:8px; cursor:pointer;
  background:transparent; border:1px solid rgba(137,105,67,.34);
  font-family:var(--serif); font-style:italic; font-size:1.15rem;
  color:var(--ink);
}
.ac-out:hover{ background:rgba(125,66,66,.08); border-color:var(--oxblood) }
.ac-id{
  font-family:var(--mono, ui-monospace, monospace); font-size:.72rem;
  color:rgba(60,48,34,.45); word-break:break-all;
}
"""

doc = rep(
    doc,
    "/* ---- head ------------------------------------------------------------- */\r\n"
    ".mc-head{",
    CSS + "\r\n/* ---- head ------------------------------------------------------------- */\r\n"
    ".mc-head{",
    'account css',
)

# ────────────────────────────────────────────────────────────────── 2 · markup

MARKUP = """  <!-- ============================================================
       THE ACCOUNT · ruled 2026-07-27 as where a first login lands
       ============================================================ -->
  <section class="acct" id="acct" aria-hidden="true" aria-label="Your account">
    <div class="mc-head">
      <button class="mc-close" id="acClose" type="button">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>
        Back to the workshop
      </button>
      <span class="mc-title">Your Account</span>
      <span class="mc-n" id="acWho"></span>
    </div>

    <div class="ac-body">
      <nav class="ac-side" id="acNav">
        <button class="ac-nav is-on" type="button" data-sec="credits">Credits</button>
        <button class="ac-nav" type="button" data-sec="activity">Activity</button>
        <button class="ac-nav" type="button" data-sec="purchases">Purchases</button>
        <button class="ac-nav" type="button" data-sec="prints">Prints</button>
        <button class="ac-nav" type="button" data-sec="you">Your details</button>
      </nav>
      <div class="ac-main" id="acMain"></div>
    </div>
  </section>

"""

doc = rep(
    doc,
    "  <!-- ============================================================\r\n"
    "       THE PRINT SHOP",
    MARKUP + "  <!-- ============================================================\r\n"
    "       THE PRINT SHOP",
    'account markup',
)

# ────────────────────────────────────────────────────────────────────── 3 · JS

JS = """  /* ======================================================================
     THE ACCOUNT

     Ruled 2026-07-27 as where a first login lands, and never built. One
     read — /api/v1/account returns the balance, the ledger, purchases,
     print orders, a piece count and the fulfilment flag together, because
     six round trips would be six chances to half-load.

     MONEY IS IN THE SECOND REGISTER THROUGHOUT. No charm on this page. A
     customer reading a ledger wants facts, and warmth here reads as
     something to be suspicious of.
     ====================================================================== */
  var ACCOUNT_URL = '/api/v1/account';
  var ACCT   = null;      /* the last read, or null */
  var AC_SEC = 'credits';
  var acct   = document.getElementById('acct');

  function acMoney(c){ return '$' + ((c || 0) / 100).toFixed(2); }
  function acDate(s){
    if (!s) return '';
    var d = new Date(s);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' });
  }

  /* The ledger's own words, not ours. `reason` is what the database
     recorded; this only makes it readable. */
  var AC_REASON = {
    purchase: 'Credits bought',
    craft:    'A piece crafted',
    refund:   'Returned',
    grant:    'Granted',
    admin:    'Adjusted by the studio'
  };

  function showAccount(){
    if (!acct) return;
    if (typeof hideCollection === 'function') hideCollection();
    if (typeof hidePrintShop === 'function') hidePrintShop();
    acct.classList.add('is-open');
    acct.setAttribute('aria-hidden', 'false');
    renderAccount();
    loadAccount();
  }
  function hideAccount(){
    if (!acct) return;
    acct.classList.remove('is-open');
    acct.setAttribute('aria-hidden', 'true');
  }

  function loadAccount(){
    return fetch(ACCOUNT_URL, { credentials:'same-origin' })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        if (!d || !d.user) return null;
        ACCT = d;
        /* The masthead and this page read the same number from the same
           place, so they cannot disagree. */
        if (d.credits && typeof d.credits.balance === 'number'){
          setCredits(d.credits.balance);
        }
        renderAccount();
        return d;
      })
      .catch(function(e){
        console.warn('[account] not loaded:', e.message || e);
        return null;
      });
  }

  function acRows(rows, render){
    if (!rows) return '<p class="ac-empty">This could not be read just now.</p>';
    if (!rows.length) return '<p class="ac-empty">Nothing here yet.</p>';
    return '<div class="ac-rows">' + rows.map(render).join('') + '</div>';
  }

  function acCredits(){
    var bal = ACCT && ACCT.credits ? ACCT.credits.balance : null;
    var pieces = ACCT && ACCT.pieces ? ACCT.pieces : null;
    var flags = ACCT && ACCT.flags ? ACCT.flags : null;

    var note = '';
    /* An account that cannot place a real print order should know before it
       tries, not at the webhook. */
    if (flags && flags.fulfilment === false){
      note =
        '<div class="ac-note">This account is set up for testing. ' +
        'Prints can be ordered and will be recorded, but nothing is sent to ' +
        'the fulfilment lab.</div>';
    }

    return note +
      '<div class="ac-h">Credits</div>' +
      '<p class="ac-sub">Ten credits craft one piece. Credits do not expire.</p>' +
      '<div class="ac-bal">' +
        '<div><div class="n">' + (bal == null ? '\\u2014' : bal) + '</div>' +
        '<div class="u">' + (bal === 1 ? 'credit' : 'credits') + '</div></div>' +
        '<span class="sp"></span>' +
        '<button class="ac-buy" id="acBuy" type="button">Buy credits</button>' +
      '</div>' +
      (pieces
        ? '<p class="ac-sub" style="margin-top:1.2em">' +
          pieces.total + (pieces.total === 1 ? ' piece' : ' pieces') + ' crafted' +
          (pieces.archived ? ' \\u00b7 ' + pieces.archived + ' archived' : '') +
          '</p>'
        : '');
  }

  function acActivity(){
    var rows = ACCT ? ACCT.ledger : null;
    return '<div class="ac-h">Activity</div>' +
      '<p class="ac-sub">Everything the studio has taken and given back.</p>' +
      acRows(rows, function(r){
        var out = r.delta < 0;
        return '<div class="ac-row">' +
          '<span class="what">' + esc(AC_REASON[r.reason] || r.reason) + '</span>' +
          '<span class="when">' + esc(acDate(r.created_at)) + '</span>' +
          '<span class="amt ' + (out ? 'is-out' : 'is-in') + '">' +
            (out ? '' : '+') + r.delta + '</span>' +
          '<span class="bal">' + (r.balance_after != null ? r.balance_after : '') + '</span>' +
        '</div>';
      });
  }

  function acPurchases(){
    var rows = ACCT ? ACCT.purchases : null;
    return '<div class="ac-h">Purchases</div>' +
      '<p class="ac-sub">Credit blocks bought. A checkout that was closed ' +
      'before paying shows here as unfinished and was never charged.</p>' +
      acRows(rows, function(r){
        var paid = r.status === 'paid';
        return '<div class="ac-row">' +
          '<span class="what">' + esc(r.sku_id || 'Credits') + ' ' +
            '<span class="ac-tag' + (paid ? ' is-live' : ' is-held') + '">' +
            (paid ? 'paid' : 'unfinished') + '</span></span>' +
          '<span class="when">' + esc(acDate(r.created_at)) + '</span>' +
          '<span class="amt">' + acMoney(r.amount_cents) + '</span>' +
        '</div>';
      });
  }

  function acPrints(){
    var rows = ACCT ? ACCT.prints : null;
    return '<div class="ac-h">Prints</div>' +
      '<p class="ac-sub">Orders sent to the fulfilment lab.</p>' +
      acRows(rows, function(r){
        var st = String(r.status || '');
        var cls = st === 'placed' ? ' is-live' : (st === 'error' || st === 'withheld' ? ' is-held' : '');
        return '<div class="ac-row">' +
          '<span class="what">' + esc(r.prodigi_order_id || 'Order') + ' ' +
            '<span class="ac-tag' + cls + '">' + esc(st) + '</span></span>' +
          '<span class="when">' + esc(acDate(r.created_at)) + '</span>' +
          '<span class="amt">' + acMoney(r.retail_total_cents) + '</span>' +
        '</div>';
      });
  }

  function acYou(){
    var u = ACCT ? ACCT.user : null;
    return '<div class="ac-h">Your details</div>' +
      '<p class="ac-sub">Signing in is by email. There is no password to ' +
      'remember or to lose.</p>' +
      '<div class="ac-rows">' +
        '<div class="ac-row"><span class="what">Email</span>' +
          '<span class="when">' + esc((u && u.email) || '\\u2014') + '</span></div>' +
        (u && u.since
          ? '<div class="ac-row"><span class="what">With the studio since</span>' +
            '<span class="when">' + esc(acDate(u.since)) + '</span></div>'
          : '') +
      '</div>' +
      '<p style="margin-top:1.6em"><button class="ac-out" id="acOut" type="button">' +
        'Sign out</button></p>' +
      /* No delete. The route has one, with no confirmation and no undo, and
         it presently reports the wrong forfeiture — it counts entitlements,
         which the credit model superseded. Rich rules when it goes on. */
      '<p class="ac-id" style="margin-top:2em">' + esc((u && u.id) || '') + '</p>';
  }

  function renderAccount(){
    var main = document.getElementById('acMain');
    var who  = document.getElementById('acWho');
    if (!main) return;
    if (who) who.textContent = (ACCT && ACCT.user && ACCT.user.email) || '';
    var body =
      AC_SEC === 'activity'  ? acActivity()  :
      AC_SEC === 'purchases' ? acPurchases() :
      AC_SEC === 'prints'    ? acPrints()    :
      AC_SEC === 'you'       ? acYou()       : acCredits();
    main.innerHTML = '<div class="ac-sec">' + body + '</div>';
    var nav = document.getElementById('acNav');
    if (nav){
      nav.querySelectorAll('[data-sec]').forEach(function(b){
        b.classList.toggle('is-on', b.dataset.sec === AC_SEC);
      });
    }
  }

  var acNav = document.getElementById('acNav');
  if (acNav) acNav.addEventListener('click', function(e){
    var b = e.target.closest('[data-sec]'); if (!b) return;
    AC_SEC = b.dataset.sec;
    renderAccount();
  });

  var acMainEl = document.getElementById('acMain');
  if (acMainEl) acMainEl.addEventListener('click', function(e){
    if (e.target.closest('#acBuy')){
      if (typeof window.__openPaywall === 'function'){
        window.__openPaywall({ needed: 0, balance: (ACCT && ACCT.credits && ACCT.credits.balance) || 0,
                               reason: 'browse' });
      }
      return;
    }
    if (e.target.closest('#acOut')){
      /* Sign-out is the server's to do; until that route exists this is the
         honest thing rather than a button that lies. */
      console.log('[account] sign out requested — no route yet');
    }
  });

  var acCloseBtn = document.getElementById('acClose');
  if (acCloseBtn) acCloseBtn.addEventListener('click', hideAccount);

  window.__showAccount = showAccount;

"""

doc = rep(
    doc,
    "  window.__showPrintShop = showPrintShop;\r\n",
    "  window.__showPrintShop = showPrintShop;\r\n\r\n" + JS,
    'account js',
)

# ────────────────────────────────── 4 · the Curator's way back covers it too

doc = rep(
    doc,
    "    if (typeof hideCollection === 'function' &&\r\n"
    "        mycoll && mycoll.classList.contains('is-open')){ hideCollection(); moved = true; }\r\n",
    "    if (typeof hideCollection === 'function' &&\r\n"
    "        mycoll && mycoll.classList.contains('is-open')){ hideCollection(); moved = true; }\r\n"
    "    if (typeof hideAccount === 'function' &&\r\n"
    "        acct && acct.classList.contains('is-open')){ hideAccount(); moved = true; }\r\n",
    'curator back covers account',
)

# ═══════════════════════════════════════════════════════════════════════ THE GATE

if doc == src:
    die('nothing changed')

routes = doc.count('fetch(')
if routes != ROUTES_AFTER:
    die('route count is %d, expected %d' % (routes, ROUTES_AFTER))
if doc.count('fetch(ACCOUNT_URL') != 1:
    die('the account is not read exactly once')

probe = re.sub(r'/\*.*?\*/', lambda m: ' ' * (m.end() - m.start()), doc, flags=re.S)

# no way to destroy an account from the glass
for bad in ("method: 'DELETE'", 'method:"DELETE"', 'Delete account', 'Delete my account'):
    if bad in probe:
        die('the glass can delete an account: %s' % bad)

# nothing computes a balance
if re.search(r'reduce\([^)]*delta', probe):
    die('the balance is being summed from the ledger')
if 'd.credits.balance' not in doc:
    die('the balance is not read from the server')

# every section exists and is reachable
for fn in ('function acCredits(', 'function acActivity(', 'function acPurchases(',
           'function acPrints(', 'function acYou(', 'function renderAccount('):
    if doc.count(fn) != 1:
        die('%s is not declared exactly once' % fn)
for sec in ('data-sec="credits"', 'data-sec="activity"', 'data-sec="purchases"',
            'data-sec="prints"', 'data-sec="you"'):
    if sec not in doc:
        die('no nav for %s' % sec)

# an unreadable section says so rather than showing a zero
if "'<p class=\"ac-empty\">This could not be read just now.</p>'" not in doc:
    die('a section that fails to load would show as empty')

# the tester notice
if 'flags.fulfilment === false' not in doc:
    die('a tester account is not told it cannot print')

# every class carries a rule
for sel in ('.acct{', '.ac-body{', '.ac-side{', '.ac-nav{', '.ac-main{', '.ac-sec{',
            '.ac-h{', '.ac-sub{', '.ac-bal{', '.ac-buy{', '.ac-rows{', '.ac-row{',
            '.ac-tag{', '.ac-empty{', '.ac-note{', '.ac-out{', '.ac-id{'):
    if sel not in doc:
        die('no rule for %s' % sel)

# the layout lock: sidebar 17%
if 'flex:0 0 17%' not in doc:
    die('the sidebar is not 17% — the global layout lock')

# vellum and stone, like the Print Shop
acss = doc[doc.index('.acct{'):doc.index('.acct.is-open{')]
if 'limestone.jpg' not in acss:
    die('the account has no stone under it')

# declared above their readers
for name, reader in (('var ACCT ', 'function acCredits('),
                     ('var AC_SEC', 'function renderAccount('),
                     ('var acct ', 'function showAccount(')):
    if probe.index(name) > probe.index(reader):
        die('%s is declared below %s' % (name.strip(), reader))

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

print('GATE PASSED · five sections, one read, no delete · %d routes' % routes)
print('wrote ' + OUT)
