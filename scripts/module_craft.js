
  /* ==================================================================
     THE CRAFT  ·  build 1c, lane 3 of 3
     ==================================================================
     The end of the line. Credits are spent, /generate is called once per
     piece, and what comes back lands in My Collection.

     Ported from public/portraits-b2.html, read 2026-07-31:
       spendCredits       8366   /credits/gate
       craftPending       8456   the stagger
       runQueueItem       8517   /generate, both calls
       finalizeRunStatus  8501

     Route calls 3 -> 5. b2 had two /generate calls because it had two
     branches, raw and preset; raw mode is cut, so one call serves.

     THE PROGRESS SURFACE. b2 reported into gDot / gStatus / stageProgress,
     none of which exist here. Rather than port a status light, the rail
     itself reports: each row carries its own state and the button counts
     down. The customer is already looking at the rail — a second place to
     look would be a worse answer, not a richer one. */

  var CREDITS_GATE_URL = '/api/v1/credits/gate';
  var GENERATE_URL     = '/api/v1/portraits/generate';
  var STAGGER_MS       = 3500;   /* b2 8477 — spreads the Replicate burst */

  var BUSY = false;

  /* ---- /credits/gate -----------------------------------------------------
     b2 8366. Returns true only if the credits actually moved. Everything
     downstream depends on that being honest, so a bad response is a false
     and never an optimistic true.

     THE SHORTFALL IS NOT HANDLED HERE. b2 called alert(). Item 1.3 is the
     purchase screen and it is unbuilt; inventing its contract in this lane
     is exactly what __openPaywall was left undone to avoid. So a shortfall
     raises __openPaywall if something has provided one, and otherwise says
     so on the button and stops. Nothing is crafted and nothing is charged. */
  function spendCredits(items){
    return fetch(CREDITS_GATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        count:    items.length,
        cost_per: CREDITS_PER_IMAGE,
        series:   'portraits',
        presets:  items.map(function(q){ return q.preset || null; })
      })
    }).then(function(res){
      return res.json().catch(function(){ return { ok: false, reason: 'bad_response' }; });
    }).then(function(data){
      if (!data.ok){
        var needed = data.needed != null ? data.needed : items.length * CREDITS_PER_IMAGE;
        if (typeof window.__openPaywall === 'function'){
          window.__openPaywall({ needed: needed, balance: data.balance || 0, reason: data.reason });
        }
        creditsNotice(data.reason, data.balance || 0, needed);
        return false;
      }
      items.forEach(function(q){ q.paid = true; });
      console.log('[credits] spent ' + (items.length * CREDITS_PER_IMAGE) +
                  ' — balance now ' + data.balance_after + (data.admin ? ' (admin, no charge)' : ''));
      return true;
    }).catch(function(){
      creditsNotice('unreachable', 0, items.length * CREDITS_PER_IMAGE);
      return false;
    });
  }

  /* Said on the button, not in an alert and not in the Curator's letter.
     Money is the studio's second register — see the voice bible §2 — and
     these are placeholders in it until the Curator lane rules. */
  function creditsNotice(reason, balance, needed){
    if (!tbcGoSub) return;
    tbcGoSub.textContent =
      reason === 'no_owner'             ? 'Sign in to craft'
    : reason === 'insufficient_credits' ? (balance + ' credits \u00b7 this needs ' + needed)
    : reason === 'unreachable'          ? 'Could not reach the studio'
    :                                     'This craft could not be started';
  }

  /* ---- one piece ---------------------------------------------------------
     b2 8517, with the raw branch removed. The three response shapes are kept
     exactly: the engine can return a rejection, a redirect to another Series,
     or a piece, and treating any of them as a crash is how a gate result
     becomes a silent failure. */
  function runQueueItem(item){
    if (item.status === 'running' || item.status === 'done') return Promise.resolve();
    var t0 = Date.now();
    item.status = 'running';
    paintRow(item);

    return fetch(GENERATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadFor(item))
    }).then(function(res){
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function(data){
      if (data.status === 'intake_rejected'){
        item.status = 'rejected';
        item.intakeReject = data.intake || null;
        item.error = ((data.intake && data.intake.reasons) || []).filter(Boolean).join(' \u00b7 ');
        /* The photograph was refused at craft. The same four states that
           speak before a craft speak after one. */
        SRC.gate = { status: 'intake_rejected', intake: data.intake || {} };
        SRC.overridden = false;
        raiseFault();
      } else if (data.status === 'redirected'){
        item.status = 'redirected';
        item.redirect = data.redirect || null;
        item.error = (data.redirect && data.redirect.message) || '';
      } else {
        var r = data.result || (data.image_b64 ? data : {});
        if (r.fatal_error){ item.status = 'failed'; item.error = r.fatal_error; }
        else if (!r.image_b64){
          item.status = 'failed'; item.error = 'no image returned';
          console.warn('[craft] no image_b64 in response:', Object.keys(data));
        } else {
          item.status = 'done';
          item.result = r;
          item.likeness_score = (r.scores && r.scores.likeness) != null ? r.scores.likeness : null;
          land(item);
        }
      }
      item.duration_ms = Date.now() - t0;
    }).catch(function(e){
      item.status = 'failed';
      item.error = e.message || String(e);
      item.duration_ms = Date.now() - t0;
    }).then(function(){ paintRow(item); });
  }

  /* ---- the piece arrives -------------------------------------------------
     __pieceLanded already exists and already decides whether to open the
     collection. This only has to build the record it expects.

     The name has no customer in it. The seeds read "Portraits - Bronze -
     Rich - 003" and there is no signed-in customer until item 1.2, so the
     name carries the room's work and a number and nothing it cannot know. */
  var LANDED = 0;
  function land(item){
    var n = String(++LANDED).padStart(3, '0');
    window.__pieceLanded({
      id:       'q' + item.id,
      name:     'Portraits - ' + effectLabel(item.effectId) + ' - ' + n,
      series:   'Portraits',
      art:      'data:image/png;base64,' + item.result.image_b64,
      crafting: false
    });
  }

  /* ---- the rail reports --------------------------------------------------
     Row state by data attribute, so the CSS decides how it reads and this
     never writes a style. */
  function paintRow(item){
    var rows = tbcList ? tbcList.querySelectorAll('.tbc-row') : [];
    var at = -1;
    QUEUE.forEach(function(q, i){ if (q.id === item.id) at = i; });
    if (at >= 0 && rows[at]) rows[at].dataset.craft = item.status;
    labelBusy();
  }

  function labelBusy(){
    if (!tbcGoVerb || !tbcGoN) return;
    if (!BUSY){ labelGo(); return; }
    var left = QUEUE.filter(function(q){
      return q.status === 'pending' || q.status === 'running';
    }).length;
    tbcGoVerb.textContent = 'Crafting';
    tbcGoN.textContent    = left === 1 ? 'the last one' : (left + ' pieces');
    tbcGoSub.textContent  = 'This takes about half a minute each';
  }

  /* ---- the whole run -----------------------------------------------------
     b2 8456. The stagger is not politeness — firing ten at once trips
     Replicate's per-minute burst limit and the tenth fails for a reason that
     looks like a bad photograph. */
  function craftPending(){
    var pending = QUEUE.filter(function(q){ return q.status === 'pending'; });
    if (!pending.length) return Promise.resolve();
    var chain = Promise.resolve(), promises = [];
    pending.forEach(function(item, i){
      chain = chain.then(function(){
        promises.push(runQueueItem(item));
        if (i < pending.length - 1){
          return new Promise(function(r){ setTimeout(r, STAGGER_MS); });
        }
      });
    });
    return chain.then(function(){ return Promise.allSettled(promises); });
  }

  /* ---- the button --------------------------------------------------------
     Replaces the __openPaywall stub s72 shipped with. Order matters and is
     the whole point of the lane: credits move FIRST, and if they do not
     move, nothing is crafted. */
  function runAll(){
    if (BUSY) return Promise.resolve();
    var pending = QUEUE.filter(function(q){ return q.status === 'pending'; });
    if (!pending.length || !SRC.b64) return Promise.resolve();

    BUSY = true;
    labelBusy();
    return spendCredits(pending).then(function(paid){
      if (!paid){ BUSY = false; return; }
      return craftPending().then(function(){
        BUSY = false;
        labelBusy();
        var failed = QUEUE.filter(function(q){ return q.status === 'failed'; }).length;
        if (failed && tbcGoSub){
          tbcGoSub.textContent = failed === 1
            ? 'One did not hold \u00b7 nothing further was charged'
            : (failed + ' did not hold \u00b7 nothing further was charged');
        }
      });
    });
  }
  window.__runAll = runAll;
  window.__BUSY   = function(){ return BUSY; };
