
  /* ==================================================================
     BUYING CREDITS  ·  the shortfall, answered in place
     ==================================================================
     The gate refuses with insufficient_credits and until now that was the
     end of the road: one line under the button saying how short they were,
     and nothing to do about it. A customer who wants to spend money and
     cannot is the worst state in the product.

     It slides out from the rail, because that is where the shortfall was
     discovered and where their chosen pieces are sitting. Not a page.

     STRIPE IS EMBEDDED, ruled 2026-08-02. Hosted checkout took the whole
     window, so buying meant leaving the studio mid-craft and finding the way
     back. The form renders inside our own panel and the workshop never goes
     away.

     THE PRICES ARE NEVER COMPUTED HERE. ladderPct() exists in this file and
     disagrees with the locked ladder above ten images; the blocks come from
     /api/v1/skus, which reads the same rows Stripe is checked against. A
     price in two places is a price that will disagree with itself. */

  var SKUS_URL     = '/api/v1/skus';
  var PURCHASE_URL = '/api/v1/credits/purchase';

  var BLOCKS  = null;     /* from the route, never from arithmetic */
  var SHORT   = null;     /* { needed, balance } */
  var STRIPE_EMBED = null;

  var buyPanel = document.getElementById('buyPanel');
  var buyList  = document.getElementById('buyList');
  var buySay   = document.getElementById('buySay');
  var buyForm  = document.getElementById('buyForm');
  var buyBack  = document.getElementById('buyBack');
  var buyX     = document.getElementById('buyX');
  var buyErr   = document.getElementById('buyErr');

  function usd(cents){ return '$' + (cents / 100).toFixed(2); }

  /* ---- the blocks --------------------------------------------------------
     Fetched once and held. Five rows; the route marks which is recommended
     and the price is whatever the row says. */
  function loadBlocks(){
    if (BLOCKS) return Promise.resolve(BLOCKS);
    return fetch(SKUS_URL, { credentials: 'same-origin' })
      .then(function(r){ return r.json(); })
      .then(function(d){
        BLOCKS = ((d && d.skus) || [])
          .filter(function(s){ return s.kind === 'credits' && s.active !== false; })
          .sort(function(a, b){ return a.count - b.count; });
        var bad = BLOCKS.filter(function(s){ return !priceOf(s); });
        if (bad.length){
          console.error('[credits] ' + bad.length + ' blocks came back with no price — ' +
                        'the panel cannot show what it cannot price', bad);
          BLOCKS = BLOCKS.filter(function(s){ return priceOf(s); });
        }
        return BLOCKS;
      })
      .catch(function(){ BLOCKS = []; return BLOCKS; });
  }

  /* Per-image is the honest comparison and the customer can check it against
     the top of the column. No percentages: 'save', 'off' and 'discount' are
     banned customer-side and the build gate rejects them. The value is
     visible without being claimed. */
  /* The route camelCases what the database snake_cases — priceCents, not
     price_cents. My gate stubbed the DB shape, so it asserted against a
     response the server never sends and five blocks read $NaN on the glass.
     Both are accepted here: the route's own shape first, the row's as a
     fallback, so this cannot break again if either side is refactored. */
  function priceOf(s){
    var c = (s.priceCents != null) ? s.priceCents : s.price_cents;
    return Number(c) || 0;
  }

  function blockRow(s){
    var images = Math.round(s.count / CREDITS_PER_IMAGE);
    var cents  = priceOf(s);
    var each   = cents / images;
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'buy-block' + (s.recommended ? ' is-pick' : '');
    el.dataset.sku = s.id;
    if (SHORT && s.count < SHORT.needed) el.classList.add('is-short');

    var n = document.createElement('div');
    n.className = 'buy-block__n';
    n.textContent = s.count + ' credits';

    var i = document.createElement('div');
    i.className = 'buy-block__i';
    i.textContent = images === 1 ? 'one piece' : images + ' pieces';

    var p = document.createElement('div');
    p.className = 'buy-block__p';
    p.textContent = usd(cents);

    var e = document.createElement('div');
    e.className = 'buy-block__e';
    e.textContent = usd(each) + ' each';

    el.appendChild(n); el.appendChild(i); el.appendChild(p); el.appendChild(e);
    if (s.recommended){
      var tag = document.createElement('span');
      tag.className = 'buy-block__tag';
      tag.textContent = 'The Curator\u2019s choice';
      el.appendChild(tag);
    }
    el.addEventListener('click', function(){ beginPurchase(s); });
    return el;
  }

  function renderBlocks(){
    if (!buyList) return;
    buyList.innerHTML = '';
    (BLOCKS || []).forEach(function(s){ buyList.appendChild(blockRow(s)); });
  }

  /* ---- the shortfall -----------------------------------------------------
     Money is the studio's second register — plain, unsigned, no charm. The
     Curator does not sell; the studio states a number. */
  function openBuy(short){
    SHORT = short || null;
    if (!buyPanel) return;
    if (buyErr) buyErr.textContent = '';
    if (buyForm) buyForm.innerHTML = '';
    if (buyList) buyList.hidden = false;
    if (buyBack) buyBack.hidden = true;

    if (buySay && SHORT){
      buySay.textContent = 'This craft needs ' + SHORT.needed + ' credits and you have ' +
                           (SHORT.balance || 0) + '. Choose a block and I will hold your ' +
                           'pieces while you do.';
    }
    loadBlocks().then(function(){
      renderBlocks();
      buyPanel.classList.add('is-open');
    });
  }

  function closeBuy(){
    if (buyPanel) buyPanel.classList.remove('is-open');
    if (STRIPE_EMBED && STRIPE_EMBED.destroy){
      try { STRIPE_EMBED.destroy(); } catch (e){}
    }
    STRIPE_EMBED = null;
  }

  /* The named hook s72 left undone, and the reason the Craft button used to
     stop dead. It has a destination now. */
  window.__openPaywall = function(short){ openBuy(short); };

  /* ---- Stripe, inside our own panel --------------------------------------
     The session is created server-side; the client sends a SKU id and never
     an amount. The publishable key travels back with the secret because a
     static page cannot read NEXT_PUBLIC_*.

     Stripe.js is loaded on first use rather than on every page view — a
     third-party script on the workshop's critical path for a panel most
     customers never open is a cost with no return. */
  function loadStripeJs(){
    if (window.Stripe) return Promise.resolve();
    return new Promise(function(res, rej){
      var s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.onload = res;
      s.onerror = function(){ rej(new Error('stripe_js_unreachable')); };
      document.head.appendChild(s);
    });
  }

  function beginPurchase(sku){
    if (!ME || !ME.id){
      if (buyErr) buyErr.textContent = 'Sign in first and I will bring you straight back.';
      return;
    }
    if (buyErr) buyErr.textContent = '';
    if (buyList) buyList.hidden = true;
    if (buyBack) buyBack.hidden = false;
    if (buySay) buySay.textContent = sku.count + ' credits \u00b7 ' + usd(priceOf(sku));

    /* Their work is held before the payment begins. The return is a fresh
       page load, exactly as the magic link is, and the same machinery
       carries the finishes, the pose and the photograph across it. */
    if (typeof saveResume === 'function') saveResume();

    Promise.all([
      loadStripeJs(),
      fetch(PURCHASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          skuId:     sku.id,
          ownerKey:  ME.id,
          returnUrl: location.origin + location.pathname
        })
      }).then(function(r){ return r.json(); })
    ]).then(function(out){
      var d = out[1];
      if (!d || !d.clientSecret){
        throw new Error(d && d.error ? d.error : 'no_session');
      }
      if (!d.publishableKey){
        throw new Error('no_publishable_key');
      }
      var stripe = window.Stripe(d.publishableKey);
      return stripe.initEmbeddedCheckout({ clientSecret: d.clientSecret });
    }).then(function(embed){
      STRIPE_EMBED = embed;
      embed.mount('#buyForm');
    }).catch(function(e){
      if (buyList) buyList.hidden = false;
      if (buyBack) buyBack.hidden = true;
      if (buyErr){
        buyErr.textContent = (e && e.message === 'no_publishable_key')
          ? 'The studio is not set up to take payment yet.'
          : 'The payment form could not be opened. Try again in a moment.';
      }
      console.error('[credits] embedded checkout failed', e);
    });
  }

  if (buyX)    buyX.addEventListener('click', closeBuy);
  if (buyBack) buyBack.addEventListener('click', function(){
    if (STRIPE_EMBED && STRIPE_EMBED.destroy){ try { STRIPE_EMBED.destroy(); } catch (e){} }
    STRIPE_EMBED = null;
    if (buyForm) buyForm.innerHTML = '';
    if (buyList) buyList.hidden = false;
    buyBack.hidden = true;
    if (buySay && SHORT){
      buySay.textContent = 'This craft needs ' + SHORT.needed + ' credits and you have ' +
                           (SHORT.balance || 0) + '.';
    }
  });
  addEventListener('keydown', function(e){
    if (e.key === 'Escape' && buyPanel && buyPanel.classList.contains('is-open')) closeBuy();
  });

  /* ---- coming back from a payment ----------------------------------------
     Stripe returns them here with ?credits=1. The webhook lands the credits,
     not this — the page only clears the flag, restores the work and gets out
     of the way. Trusting a query parameter for anything else would be
     trusting the customer's address bar with the balance. */
  (function afterPurchase(){
    if (location.search.indexOf('credits=1') < 0) return;
    history.replaceState(null, '', location.pathname);
    console.log('[credits] returned from checkout');
    if (typeof whoAmI === 'function'){
      whoAmI().then(function(u){ if (u && typeof restoreResume === 'function') restoreResume(); });
    }
    if (tbcGoSub) SUB_NOTE = 'Your credits are on their way \u00b7 press Craft when you are ready';
    if (typeof labelGo === 'function') labelGo();
  })();
