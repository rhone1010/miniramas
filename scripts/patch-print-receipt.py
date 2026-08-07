#!/usr/bin/env python3
"""
THE RECEIPT

Stripe has been returning the customer to  ?print=1&session={CHECKOUT_SESSION_ID}
since the print lane was built, and nothing has ever read it. They paid, the
page reloaded, and the studio said nothing at all.

This adds the panel that catches it: what is being made, at what size and
finish, where it is going, and what it cost.

WHERE IT LIVES
  Inside the Print Shop, not on a page of its own. That is where they were
  standing when they paid, and the surface already covers the floor and the
  rail while leaving the Curator visible. A receipt on a separate page would
  be the third full-screen surface in a flow that already has two.

WHY IT IS BUILT IN JAVASCRIPT
  One anchor instead of four. Markup, styles and wiring all go in at a single
  unique line rather than three separate insertions into a 9,000-line file,
  so the patch either applies whole or not at all.

WHAT IT DOES NOT DO
  It does not claim the order reached the lab unless the server says so.
  A withheld or errored order says what actually happened. A receipt that
  reassures where the truth is otherwise is worse than no receipt.

Usage:  python scripts\\patch-print-receipt.py public\\portraits.html
"""
import io
import sys

ANCHOR = "  window.__showPrintShop = showPrintShop;"

BLOCK = r"""
  /* ======================================================================
     THE RECEIPT · after the money has moved
     ======================================================================
     Reads /api/v1/print/order, which is scoped to the caller's owner_key as
     well as the session id — a shared link cannot pull somebody's address.

     Status is reported, never assumed:
       placed    · the lab has it, with its reference
       paid      · we have the money and it has not gone out yet
       withheld  · fulfilment is off for this account, deliberately
       error     · it failed, and the row says why
     ================================================================== */
  var psReceiptEl = null;

  function psMoney(c){
    var n = Number(c) || 0;
    return '$' + (n / 100).toFixed(2);
  }
  function psEsc(s){
    return String(s == null ? '' : s).replace(/[&<>"]/g, function(m){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m];
    });
  }

  function psReceiptStyles(){
    if (document.getElementById('ps-receipt-style')) return;
    var st = document.createElement('style');
    st.id = 'ps-receipt-style';
    st.textContent = [
      '.ps-rc{ position:absolute; inset:0; z-index:6; display:none;',
      '  overflow-y:auto; padding:clamp(28px,3vw,56px) clamp(24px,4vw,72px); }',
      '.ps-rc.is-on{ display:block }',
      '.ps-rc-in{ max-width:900px; margin:0 auto }',
      '.ps-rc-eyebrow{ font-family:var(--sans,system-ui,sans-serif); font-size:12px;',
      '  font-weight:600; letter-spacing:.2em; text-transform:uppercase;',
      '  color:var(--brass,#75623a); margin:0 0 10px }',
      '.ps-rc h2{ font-family:var(--serif,Georgia,serif); font-weight:500;',
      '  font-size:clamp(2rem,3vw,2.9rem); line-height:1.1; margin:0 0 10px;',
      '  color:var(--ink,#2a241e) }',
      '.ps-rc-say{ font-family:var(--serif,Georgia,serif); font-size:23px;',
      '  line-height:1.5; color:var(--ink-soft,#4f382a); margin:0 0 8px; max-width:34em }',
      '.ps-rc-ref{ font-family:var(--mono,ui-monospace,monospace); font-size:13px;',
      '  color:var(--brass,#75623a); margin:0 0 32px }',
      '.ps-rc-rule{ height:1px; margin:0 0 28px;',
      '  background:linear-gradient(90deg,rgba(137,105,67,.34),rgba(137,105,67,0)) }',
      '.ps-rc-item{ display:flex; gap:clamp(16px,2vw,28px); align-items:flex-start;',
      '  padding:0 0 24px; margin:0 0 24px;',
      '  border-bottom:1px solid rgba(137,105,67,.18) }',
      '.ps-rc-item:last-of-type{ border-bottom:0 }',
      '.ps-rc-art{ flex:0 0 auto; width:clamp(110px,12vw,168px); aspect-ratio:1/1;',
      '  border-radius:12px; overflow:hidden; background:rgba(42,36,30,.06);',
      '  box-shadow:0 8px 24px rgba(0,0,0,.08) }',
      '.ps-rc-art img{ width:100%; height:100%; object-fit:cover; display:block }',
      '.ps-rc-meta{ flex:1; min-width:0 }',
      '.ps-rc-name{ font-family:var(--serif,Georgia,serif); font-size:1.5rem;',
      '  color:var(--ink,#2a241e); margin:0 0 6px }',
      '.ps-rc-spec{ font-family:var(--serif,Georgia,serif); font-size:20px;',
      '  color:var(--ink-soft,#4f382a); margin:0 }',
      '.ps-rc-price{ font-family:var(--serif,Georgia,serif); font-size:1.35rem;',
      '  color:var(--ink,#2a241e); font-variant-numeric:tabular-nums;',
      '  flex:0 0 auto; padding-left:12px }',
      '.ps-rc-cols{ display:grid; gap:clamp(24px,3vw,48px);',
      '  grid-template-columns:1fr 1fr; margin-top:8px }',
      '@media(max-width:760px){ .ps-rc-cols{ grid-template-columns:1fr }',
      '  .ps-rc-item{ flex-wrap:wrap } }',
      '.ps-rc-h3{ font-family:var(--sans,system-ui,sans-serif); font-size:12px;',
      '  font-weight:600; letter-spacing:.18em; text-transform:uppercase;',
      '  color:var(--brass,#75623a); margin:0 0 10px }',
      '.ps-rc-addr{ font-family:var(--serif,Georgia,serif); font-size:20px;',
      '  line-height:1.5; color:var(--ink,#2a241e); margin:0 }',
      '.ps-rc-tot{ font-family:var(--serif,Georgia,serif); font-size:20px;',
      '  color:var(--ink,#2a241e) }',
      '.ps-rc-tot div{ display:flex; justify-content:space-between; gap:20px;',
      '  padding:5px 0; font-variant-numeric:tabular-nums }',
      '.ps-rc-tot .sum{ margin-top:8px; padding-top:12px; font-size:1.3rem;',
      '  border-top:1px solid rgba(137,105,67,.28) }',
      '.ps-rc-acts{ margin-top:clamp(32px,3.5vw,56px); display:flex; gap:14px;',
      '  flex-wrap:wrap }',
      '.ps-rc-btn{ font-family:var(--serif,Georgia,serif); font-style:italic;',
      '  font-size:1.15rem; padding:.6rem 1.5rem; border-radius:999px;',
      '  cursor:pointer; border:1px solid var(--oxblood,#7d4242);',
      '  background:var(--oxblood,#7d4242); color:#f6f1e7 }',
      '.ps-rc-btn.ghost{ background:transparent; color:var(--oxblood,#7d4242) }',
      '.ps-rc-btn:hover{ filter:brightness(1.07) }',
      '.ps-rc-note{ font-family:var(--sans,system-ui,sans-serif); font-size:14px;',
      '  line-height:1.5; color:#8d3b3b; margin:18px 0 0; max-width:42em }'
    ].join('\n');
    document.head.appendChild(st);
  }

  function psReceiptMount(){
    if (psReceiptEl || !pshop) return psReceiptEl;
    psReceiptStyles();
    psReceiptEl = document.createElement('section');
    psReceiptEl.className = 'ps-rc';
    psReceiptEl.id = 'psReceipt';
    pshop.appendChild(psReceiptEl);
    return psReceiptEl;
  }

  /* The wall and the order form are siblings inside the shop. The receipt
     covers them rather than replacing them, so nothing about psView has to
     change and nothing it owns can be left in a half state. */
  function psReceiptShow(on){
    var el = psReceiptMount();
    if (!el) return;
    el.classList.toggle('is-on', !!on);
  }

  function psReceiptSay(o){
    if (o.status === 'placed') {
      return ['Your order is with the lab.',
              'It is being made now. We will email you when it ships.'];
    }
    if (o.status === 'withheld') {
      return ['Paid, and held here.',
              'This account is not cleared to send work to the lab yet, so ' +
              'nothing has been manufactured. Nothing further is owed.'];
    }
    if (o.status === 'error') {
      return ['Paid, and not yet sent.',
              'Something went wrong between us and the lab. Your payment is ' +
              'safe and the studio has been told. We will put it right.'];
    }
    return ['Payment received.',
            'The order is being prepared for the lab.'];
  }

  function psReceiptPaint(o){
    var el = psReceiptMount();
    if (!el) return;

    var say  = psReceiptSay(o);
    var ship = o.shipTo || {};
    var addr = [ship.name, ship.line1, ship.line2,
                [ship.city, ship.state || ship.region, ship.postcode]
                  .filter(Boolean).join(' '),
                ship.countryCode || ship.country_code]
               .filter(Boolean).map(psEsc).join('<br>');

    var items = (o.items || []).map(function(it){
      var art = it.art
        ? '<img src="' + psEsc(it.art) + '" alt="">'
        : '';
      var spec = [it.size, it.finish].filter(Boolean).join(' \u00b7 ');
      if (it.copies > 1) spec += ' \u00b7 ' + it.copies + ' copies';
      return '<div class="ps-rc-item">' +
               '<div class="ps-rc-art">' + art + '</div>' +
               '<div class="ps-rc-meta">' +
                 '<h3 class="ps-rc-name">' + psEsc(it.label || 'Your piece') + '</h3>' +
                 '<p class="ps-rc-spec">' + psEsc(spec) + '</p>' +
               '</div>' +
               '<div class="ps-rc-price">' + psMoney(it.retailCents) + '</div>' +
             '</div>';
    }).join('');

    el.innerHTML =
      '<div class="ps-rc-in">' +
        '<p class="ps-rc-eyebrow">Your order</p>' +
        '<h2>' + psEsc(say[0]) + '</h2>' +
        '<p class="ps-rc-say">' + psEsc(say[1]) + '</p>' +
        (o.prodigiId
          ? '<p class="ps-rc-ref">Lab reference ' + psEsc(o.prodigiId) + '</p>'
          : '<p class="ps-rc-ref"></p>') +
        '<div class="ps-rc-rule"></div>' +
        items +
        '<div class="ps-rc-cols">' +
          '<div>' +
            '<p class="ps-rc-h3">Shipping to</p>' +
            '<p class="ps-rc-addr">' + (addr || '&mdash;') + '</p>' +
          '</div>' +
          '<div>' +
            '<p class="ps-rc-h3">Total</p>' +
            '<div class="ps-rc-tot">' +
              '<div><span>Pieces</span><span>' + psMoney(o.subtotalCents) + '</span></div>' +
              '<div><span>' + psEsc(o.shippingMethod || 'Shipping') + '</span>' +
                '<span>' + psMoney(o.shippingCents) + '</span></div>' +
              '<div class="sum"><span>Paid</span><span>' +
                psMoney(o.totalCents) + '</span></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        (o.status === 'error' && o.errorMessage
          ? '<p class="ps-rc-note">' + psEsc(o.errorMessage) + '</p>' : '') +
        '<div class="ps-rc-acts">' +
          '<button class="ps-rc-btn" type="button" data-rc="close">' +
            'Back to the studio</button>' +
          '<button class="ps-rc-btn ghost" type="button" data-rc="shop">' +
            'Order another print</button>' +
        '</div>' +
      '</div>';

    el.addEventListener('click', function(e){
      var b = e.target.closest && e.target.closest('[data-rc]');
      if (!b) return;
      psReceiptShow(false);
      if (b.getAttribute('data-rc') === 'close' &&
          typeof hidePrintShop === 'function') hidePrintShop();
    });
  }

  /* On arrival. The session id is taken out of the address bar once read —
     a receipt should not reload into itself, and the id should not sit in
     history on a shared machine. */
  (function psReceiptArrival(){
    var q;
    try { q = new URLSearchParams(window.location.search); } catch (_) { return; }
    if (q.get('print') !== '1') return;
    var session = q.get('session');
    if (!session || session.indexOf('{') === 0) return;

    if (typeof showPrintShop === 'function') showPrintShop();
    psReceiptShow(true);
    psReceiptMount().innerHTML =
      '<div class="ps-rc-in"><p class="ps-rc-eyebrow">Your order</p>' +
      '<h2>Reading your order&hellip;</h2></div>';

    fetch('/api/v1/print/order?session=' + encodeURIComponent(session), {
      credentials: 'same-origin'
    }).then(function(r){ return r.json(); }).then(function(d){
      if (d && d.ok && d.order) { psReceiptPaint(d.order); return; }
      psReceiptMount().innerHTML =
        '<div class="ps-rc-in"><p class="ps-rc-eyebrow">Your order</p>' +
        '<h2>Your payment went through.</h2>' +
        '<p class="ps-rc-say">We could not read the order back just now. ' +
        'Nothing is lost &mdash; it is in your account under Prints.</p>' +
        '<div class="ps-rc-acts"><button class="ps-rc-btn" type="button" ' +
        'data-rc="close">Back to the studio</button></div></div>';
    }).catch(function(){});

    try {
      var clean = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', clean);
    } catch (_) {}
  })();
"""


def crlf(t):
    return t.replace("\n", "\r\n")


def main(path):
    with io.open(path, encoding="utf-8", newline="") as fh:
        doc = fh.read()

    for anchor, block in ((ANCHOR, BLOCK), (crlf(ANCHOR), crlf(BLOCK))):
        n = doc.count(anchor)
        if n == 1:
            doc = doc.replace(anchor, anchor + "\n" + block, 1)
            break
        if n > 1:
            raise SystemExit("FAIL: anchor matched %d times, expected 1" % n)
    else:
        raise SystemExit("FAIL: anchor not found. Nothing was written.")

    if doc.count("psReceiptArrival") != 1:
        raise SystemExit("FAIL: arrival handler not written exactly once")
    if doc.count("'/api/v1/print/order?session='") != 1:
        raise SystemExit("FAIL: order read not written exactly once")
    if "window.__showPrintShop = showPrintShop;" not in doc:
        raise SystemExit("FAIL: the anchor line itself was lost")

    with io.open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(doc)

    print("Patched %s" % path)
    print("  ?print=1&session=... now opens the Print Shop with the receipt")
    print("  status is reported, never assumed")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: patch-print-receipt.py <file.html>")
    main(sys.argv[1])
