/* ---- POST TO COMMUNITY --------------------------------------------
   The board has been readable, heartable and commentable since V28 and
   there has never been a way to put anything ON it. This is that way.

   POST /api/v1/community/posts { piece_id, consent:true }
   GET/PUT /api/v1/community/handle

   The consent string is copied verbatim from lib/community/db.ts. It is
   stored on every post as agreed, so changing it here changes what the
   NEXT person agrees to and nothing about anybody already on the board.
   If that file's CONSENT_TEXT_V1 changes, change this with it.

   Consent is checked server-side too. A tick in a browser is a statement
   about a browser; the row is what we would have to stand behind. */
(function(){
  var CONSENT =
    'This is my own photograph, or I have the permission of the person in it. ' +
    'I understand it will be visible to anyone who visits Liten & Co, with my ' +
    'handle beneath it, and that I can take it down at any time.';

  var R_POSTS  = '/api/v1/community/posts';
  var R_HANDLE = '/api/v1/community/handle';

  var scrim  = document.getElementById('pcmScrim');
  if (!scrim) return;
  var art    = document.getElementById('pcmArt');
  var hField = document.getElementById('pcmHandleField');
  var hInput = document.getElementById('pcmHandle');
  var tick   = document.getElementById('pcmConsent');
  var say    = document.getElementById('pcmSay');
  var go     = document.getElementById('pcmGo');
  var cancel = document.getElementById('pcmCancel');

  document.getElementById('pcmConsentText').textContent = CONSENT;

  var PIECE  = null;
  var HANDLE = null;
  var busy   = false;
  var generation = 0, submitted = false, priorFocus = null, inertSiblings = [];

  function tell(msg, good){
    say.textContent = msg || '';
    say.classList.toggle('is-good', !!good);
  }

  /* Post is available when consent is ticked and a handle exists - either
     one already claimed, or something typed into the box. */
  function paint(){
    var named = !!HANDLE || (hInput && String(hInput.value || '').trim().length > 0);
    go.disabled = busy || submitted || !tick.checked || !named;
    cancel.disabled = submitted && busy;
  }

  function shut(){
    if (submitted && busy) return;
    generation++;
    scrim.classList.remove('is-open');
    inertSiblings.forEach(function(el){el.inert=false;}); inertSiblings=[];
    if(priorFocus && priorFocus.isConnected) priorFocus.focus();
    PIECE = null; busy = false;
  }

  window.openPostToCommunity = function(piece){
    if (!piece || piece.locked || busy) return;
    /* No serverId means no row in collection_pieces yet - a tile that
       is still crafting. There is nothing to post, and opening the
       dialog only to refuse at the end is the worse of the two. The
       same test guards printing and archiving. */
    if (!piece.serverId && !piece.previewId) return;
    var token = ++generation;
    submitted = false; HANDLE = null; hInput.value = '';
    PIECE = Object.assign({},piece);
    busy = false;
    tick.checked = false;
    tell('');
    go.textContent = 'Post it';
    if (art) art.src = piece.art || '';
    priorFocus = document.activeElement;
    inertSiblings = Array.from(document.body.children).filter(function(el){return el !== scrim && !el.inert;});
    inertSiblings.forEach(function(el){el.inert=true;});
    scrim.classList.add('is-open');
    tick.focus();
    paint();

    /* Asked for in place. Sending somebody to another page to claim a
       handle loses the piece they were trying to post. */
    fetch(R_HANDLE, { credentials:'same-origin' })
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(d){
        if(token !== generation) return;
        HANDLE = (d && d.handle) || null;
        if (hField) hField.hidden = !!HANDLE;
        if (!HANDLE && hInput && d && d.suggestion) hInput.value = d.suggestion;
        paint();
      })
      .catch(function(){ if(token !== generation) return; if (hField) hField.hidden = false; paint(); });
  };

  tick.addEventListener('change', paint);
  if (hInput) hInput.addEventListener('input', paint);
  cancel.addEventListener('click', shut);
  scrim.addEventListener('click', function(e){ if (e.target === scrim) shut(); });
  addEventListener('keydown', function(e){
    if(e.key === 'Tab' && scrim.classList.contains('is-open')){
      var targets=Array.from(scrim.querySelectorAll('button,input')).filter(function(el){return !el.disabled && !el.closest('[hidden]');});
      var i=targets.indexOf(document.activeElement);e.preventDefault();targets[(i+(e.shiftKey?targets.length-1:1))%targets.length].focus();
    }
    if (e.key === 'Escape' && scrim.classList.contains('is-open')) shut();
  });

  /* Every reason the route can give, said plainly. A bare "that did not
     work" on a thing somebody chose to do in public is the worst of the
     available answers. */
  var WHY = {
    signed_out:     'Sign in first, then this will go straight up.',
    no_piece:       'I cannot find that piece any more.',
    archived:       'That one is archived. Bring it back first and it can go up.',
    no_consent:     'Tick the box and it can go up.',
    need_handle:    'Choose a handle first - it sits beneath your work.',
    already_posted: 'This one is already on the board.',
    slow_down:      'That is three in an hour. Give it a little while.',
    unavailable:    'The board is not answering just now. Try again shortly.'
  };

  function post(){
    if(!PIECE || !tick.checked || submitted) return;
    var token = generation, selected = PIECE;
    submitted = true;
    busy = true; paint(); tell('');
    fetch(R_POSTS, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      credentials:'same-origin',
      /* serverId, NOT id. PIECE.id is a client id - 'q3' while the
         piece is crafting, 'srv_<uuid>' once it has been read back.
         Neither exists in collection_pieces, so the route answered
         no_piece over a piece that was plainly there. */
      body: JSON.stringify(selected.previewId ? {preview_id:selected.previewId,consent:true} : {piece_id:selected.serverId,consent:true})
    })
      .then(function(r){ return r.json().then(function(d){ d.__s = r.status; return d; }); })
      .then(function(d){
        if(token !== generation) return;
        busy = false;
        if (d && d.ok){
          
          tell('It is on the board.', true);
          go.textContent = 'Posted';
          go.disabled = true;
          cancel.disabled = false;
          setTimeout(function(){if(token === generation) shut();}, 1800);
          return;
        }
        submitted = false;
        tell((d && WHY[d.reason]) || 'That did not take. Try again in a moment.');
        paint();
      })
      .catch(function(){
        if(token !== generation) return;
        submitted = false; busy = false;
        tell('That did not take. Try again in a moment.');
        paint();
      });
  }

  go.addEventListener('click', function(){
    if (!PIECE || busy || submitted || !tick.checked) return;
    var token = generation;
    if (HANDLE) return post();
    /* Claim the handle, then post - one press, two calls, because two
       presses to do one thing is how somebody abandons it halfway. */
    var want = String(hInput.value || '').trim();
    if (!want) return;
    busy = true; paint(); tell('');
    fetch(R_HANDLE, {
      method:'PUT',
      headers:{ 'Content-Type':'application/json' },
      credentials:'same-origin',
      body: JSON.stringify({ handle: want })
    })
      /* Carry the status through, exactly as post() does. Without it the
         branch below cannot tell a refused handle from a broken studio. */
      .then(function(r){ return r.json().then(function(d){ d.__s = r.status; return d; }); })
      .then(function(d){
        if(token !== generation) return;
        busy = false;
        if (d && d.ok){
          HANDLE = d.handle;
          if (hField) hField.hidden = true;
          return post();
        }
        if (d && d.reason === 'taken') tell('Somebody already writes under that one.');
        else if (d && d.message)       tell(d.message);
        else if (d && d.reason === 'signed_out') tell(WHY.signed_out);
        /* A FAULT IS NOT A BAD NAME. This branch used to end by telling
           everybody to try another handle, including when the answer was a
           500 with reason:'failed' -- so a database fault read as a
           rejected name and the customer tried other names against a
           server that was not listening. The status is already on the
           response; it was simply never read here. */
        else if (d && (d.__s >= 500 || d.reason === 'failed'))
          tell('The studio could not do that just now. Nothing is wrong with that name - try again in a moment.');
        else tell('That handle did not take. Try another.');
        paint();
      })
      .catch(function(){
        if(token !== generation) return;
        submitted = false; busy = false;
        tell('That did not take. Try again in a moment.');
        paint();
      });
  });
})();
