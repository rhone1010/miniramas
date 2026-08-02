
  /* ==================================================================
     SIGNING IN  ·  at the moment of crafting, and not before
     ==================================================================
     Ruled 2026-08-01. They browse, upload, choose finishes and a pose with
     no account at all. The email is asked for once — when they press Craft,
     before a single credit moves.

     Nothing new server-side. /api/v1/auth/signin already exists and its own
     header names this file as the caller: the workshop POSTs an email, the
     route calls signInWithOtp with a writable cookie client, and
     /auth/callback exchanges the code. Every credits route already resolves
     the owner from that session.

     THE HARD PART IS NOT THE SIGN-IN. It is that a magic link takes them
     away — to an inbox, often on another device — and brings them back to a
     page that has forgotten everything. Late sign-in converts better than
     early only if the work survives the trip. If they come back to an empty
     workshop we have taken their email and given them nothing, which is
     worse than having asked at the door.

     So the state is saved before the email is sent and restored on return.
     localStorage, not sessionStorage: the link usually opens a new tab, and
     sessionStorage does not survive that. */

  var AUTH_ME_URL     = '/api/v1/auth/me';
  var AUTH_SIGNIN_URL = '/api/v1/auth/signin';
  var RESUME_KEY      = 'liten_resume_v1';

  var ME = null;                 /* { id, email } once known */
  var PENDING_CRAFT = false;     /* they pressed Craft and we stopped them */

  /* ---- who is this ------------------------------------------------------
     401 is the ordinary answer for a visitor, not a fault. */
  function whoAmI(){
    return fetch(AUTH_ME_URL, { credentials: 'same-origin' })
      .then(function(res){ return res.ok ? res.json() : null; })
      .then(function(d){ ME = (d && d.user) ? d.user : null; return ME; })
      .catch(function(){ ME = null; return null; });
  }

  /* ---- holding their work ------------------------------------------------
     The photograph is by far the largest thing here and may not fit — a
     phone photograph as base64 can run past the storage quota on its own.
     So it is written last and separately: if it will not fit, the finishes
     and the pose still survive and only the photograph must be chosen
     again. Losing one of the three is recoverable; losing all three is the
     failure this whole mechanism exists to prevent. */
  function saveResume(){
    var core = {
      at:    Date.now(),
      queue: QUEUE.map(function(q){ return { siloId: q.siloId, effectId: q.effectId }; }),
      pose:  window.__POSE || null
    };
    try {
      localStorage.setItem(RESUME_KEY, JSON.stringify(core));
    } catch (e){
      console.warn('[resume] could not hold the finishes', e);
      return;
    }
    try {
      localStorage.setItem(RESUME_KEY + '_img', SRC.dataUrl || '');
    } catch (e){
      /* Quota. Expected on large photographs and not an error — the finishes
         are already safe and the Curator asks for the photograph again. */
      try { localStorage.removeItem(RESUME_KEY + '_img'); } catch (e2){}
      console.warn('[resume] photograph too large to hold — it will be asked for again');
    }
  }

  function clearResume(){
    try {
      localStorage.removeItem(RESUME_KEY);
      localStorage.removeItem(RESUME_KEY + '_img');
    } catch (e){}
  }

  /* Restored only for someone who came back signed in, and only if it is
     recent. A queue rebuilt from last week would be a surprise, not a
     courtesy. */
  function restoreResume(){
    var raw = null, img = null;
    try {
      raw = localStorage.getItem(RESUME_KEY);
      img = localStorage.getItem(RESUME_KEY + '_img');
    } catch (e){ return false; }
    if (!raw) return false;

    var core;
    try { core = JSON.parse(raw); } catch (e){ clearResume(); return false; }
    if (!core || !core.queue || !core.queue.length){ clearResume(); return false; }
    if (Date.now() - (core.at || 0) > 2 * 60 * 60 * 1000){ clearResume(); return false; }

    if (img){
      SRC.dataUrl = img;
      SRC.b64 = img.split(',')[1] || null;
      var thumb = document.getElementById('curThumb');
      if (thumb) thumb.src = img;
      curatorState('photo', SAY.photo);
      /* The routes were never told about this photograph — this browser is a
         different session from the one that uploaded it. */
      runAnalyze();
      precheckSourceGate();
    }

    core.queue.forEach(function(q){
      if (R.byId(q.effectId)) addToQueue(q.siloId, q.effectId);
    });
    if (core.pose) window.__POSE = core.pose;
    if (core.pose && typeof stampPose === 'function') stampPose(core.pose);

    clearResume();

    if (!img && QUEUE.length){
      /* Say the one true thing: the finishes are here, the photograph is not.
         Placeholder until the Curator lane rules the line. */
      SUB_NOTE = 'Your finishes are here \u00b7 choose your photograph again';
      labelGo();
    }
    return true;
  }

  /* ---- the panel ---------------------------------------------------------
     Two states, exactly as SigninModal has: ask, then told. The wording is
     carried across from that component rather than written here — it is
     already accepted copy and this lane does not author the voice. */
  var signinModal = document.getElementById('signinModal');
  var signinEmail = document.getElementById('signinEmail');
  var signinSend  = document.getElementById('signinSend');
  var signinErr   = document.getElementById('signinErr');
  var signinAsk   = document.getElementById('signinAsk');
  var signinSent  = document.getElementById('signinSent');
  var signinAddr  = document.getElementById('signinAddr');
  var signinX     = document.getElementById('signinX');

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function openSignin(){
    if (!signinModal) return;
    if (signinAsk)  signinAsk.hidden  = false;
    if (signinSent) signinSent.hidden = true;
    if (signinErr)  signinErr.textContent = '';
    signinModal.classList.add('is-open');
    if (signinEmail) setTimeout(function(){ signinEmail.focus(); }, 60);
  }
  function closeSignin(){
    if (signinModal) signinModal.classList.remove('is-open');
    PENDING_CRAFT = false;
  }

  function sendLink(){
    if (!signinEmail || !signinSend) return;
    var email = signinEmail.value.trim().toLowerCase();
    if (!EMAIL_RE.test(email)){
      if (signinErr) signinErr.textContent = 'That does not look like an email address.';
      return;
    }
    signinSend.disabled = true;
    signinSend.textContent = 'Sending';
    if (signinErr) signinErr.textContent = '';

    /* Held BEFORE the request. If the send succeeds they may leave for their
       inbox within seconds, and on another device the tab never runs again. */
    saveResume();

    fetch(AUTH_SIGNIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email: email, next: location.pathname })
    }).then(function(res){
      return res.json().catch(function(){ return { ok: false, reason: 'bad_response' }; });
    }).then(function(d){
      signinSend.disabled = false;
      signinSend.textContent = 'Send the link';
      if (!d || !d.ok){
        clearResume();
        if (signinErr) signinErr.textContent =
          d && d.reason === 'invalid_email' ? 'That does not look like an email address.'
                                            : 'The link could not be sent. Try again in a moment.';
        return;
      }
      if (signinAddr) signinAddr.textContent = email;
      if (signinAsk)  signinAsk.hidden  = true;
      if (signinSent) signinSent.hidden = false;
    }).catch(function(){
      clearResume();
      signinSend.disabled = false;
      signinSend.textContent = 'Send the link';
      if (signinErr) signinErr.textContent = 'The link could not be sent. Try again in a moment.';
    });
  }

  if (signinSend) signinSend.addEventListener('click', sendLink);
  if (signinEmail) signinEmail.addEventListener('keydown', function(e){
    if (e.key === 'Enter'){ e.preventDefault(); sendLink(); }
  });
  if (signinX) signinX.addEventListener('click', closeSignin);
  if (signinModal) signinModal.addEventListener('click', function(e){
    if (e.target === signinModal) closeSignin();
  });
  addEventListener('keydown', function(e){
    if (e.key === 'Escape' && signinModal && signinModal.classList.contains('is-open')) closeSignin();
  });

  /* ---- on arrival --------------------------------------------------------
     Ask who this is, and if they have just come back from their email, give
     them their work. */
  whoAmI().then(function(u){
    if (u) restoreResume();
  });
