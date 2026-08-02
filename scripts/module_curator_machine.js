
  /* ==================================================================
     THE SOURCE PHOTOGRAPH  ·  build 1a, the Curator machine
     ==================================================================
     s72 had no photograph in it. The Curator slot set a mood and the panel
     showed a demo bust. This is the first wiring: a real file goes in, three
     routes fire, and a fault routes to the intake state that was drawn for
     it back in r02.

     Ported from public/portraits-b2.html, read 2026-07-31:
       localPhotoCheck        4831   verbatim, canvas Laplacian
       precheckSourceGate     5288   /portraits/gate
       runAnalyze             6585   /portraits/analyze
       curatorEnterEffects    7225   /portraits/curate-effects
       friendlyReject         6462   its regexes become the state chooser

     THE VOICE IS NOT MINE. Every line the Curator says here already existed
     — SAY.photo, SAY.reject, the silo lines, and the intake copy drawn in
     r02. PROCEDURES §2 gives the voice to CENG and board 3.7 already flags
     that this lane has drifted into writing it. So the machine routes to
     copy; it does not author any. The analyze route returns a
     `recommendation` string and it is deliberately not shown — engine copy
     is not Curator copy. */

  var GATE_URL       = '/api/v1/portraits/gate';
  var ANALYZE_URL    = '/api/v1/portraits/analyze';
  var CURATE_URL     = '/api/v1/portraits/curate-effects';

  /* b2 4827-4829 and 4999-5000, carried over unchanged. Board 2.5 says the
     intake thresholds are written nowhere; they are written here now. */
  var LOCAL_BLUR_SOFT      = 110;   /* Laplacian variance below this = soft   */
  var LOCAL_BLUR_VERY_SOFT = 45;    /* ...below this = very soft              */
  var LOCAL_LUMA_DIM       = 62;    /* mean luma 0-255 below this = dim       */
  var FACE_WARN_RED_PX     = 80;
  var FACE_WARN_YELLOW_PX  = 140;

  /* One object, so a replaced photograph clears in one assignment and no
     stale field survives into the next analysis. */
  var SRC = {
    b64: null, dataUrl: null, dims: null, flags: null,
    analyze: null, gate: null, recs: null,
    seq: 0, gateFp: null, overridden: false
  };
  window.__SRC = SRC;

  /* ---- local check, before any route ------------------------------------
     Runs on the client the instant the file lands, so an obviously soft or
     dim photograph is called out without spending a round trip. The analyze
     verdict stays authoritative when it arrives. */
  function localPhotoCheck(imgEl){
    try {
      var W = 256;
      var scale = W / Math.max(imgEl.naturalWidth, 1);
      var H = Math.max(Math.round(imgEl.naturalHeight * scale), 1);
      var cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      var cx = cv.getContext('2d', { willReadFrequently: true });
      if (!cx) return null;
      cx.drawImage(imgEl, 0, 0, W, H);
      var d = cx.getImageData(0, 0, W, H).data;
      var g = new Float32Array(W * H);
      var luma = 0, i, p;
      for (i = 0, p = 0; i < d.length; i += 4, p++){
        var v = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
        g[p] = v; luma += v;
      }
      luma /= (W * H);
      var sum = 0, sumSq = 0, n = 0;
      for (var y = 1; y < H - 1; y++){
        for (var x = 1; x < W - 1; x++){
          var k = y * W + x;
          var lap = g[k-1] + g[k+1] + g[k-W] + g[k+W] - 4 * g[k];
          sum += lap; sumSq += lap * lap; n++;
        }
      }
      var mean = sum / n;
      var variance = sumSq / n - mean * mean;
      return {
        soft:     variance < LOCAL_BLUR_SOFT,
        verySoft: variance < LOCAL_BLUR_VERY_SOFT,
        dim:      luma < LOCAL_LUMA_DIM,
        variance: Math.round(variance), luma: Math.round(luma)
      };
    } catch (e){ return null; }
  }

  /* ---- which intake state -----------------------------------------------
     States 5-8 were drawn against exactly these four fault classes and the
     markup still carries the regexes in its comments. b2's friendlyReject
     chose a sentence; the same test now chooses a state, and the sentence
     is already on the card.

       5  face small      6  soft      7  dim      8  cannot use

     Order is worst-first. A hard rejection outranks an advisory, and the
     face is the one that ruins a craft rather than softening it. Returns 0
     for a photograph with nothing to say about it. */
  function faultState(){
    var g = SRC.gate;
    if (g && g.status === 'intake_rejected'){
      var raw = ((g.intake && g.intake.reasons) || []).join(' ').toLowerCase();
      if (/face|small|close|crop|distance|far/.test(raw))  return 5;
      if (/blur|sharp|focus|soft/.test(raw))               return 6;
      if (/dim|dark|light|expos|bright/.test(raw))         return 7;
      return 8;
    }
    var a = SRC.analyze || {};
    if (a.quality_verdict === 'red') return 8;
    var px = a.smallest_face_min_dim_px;
    if (px != null && px < FACE_WARN_RED_PX) return 5;
    var f = SRC.flags;
    if (f && f.verySoft) return 6;
    if (f && f.dim)      return 7;
    if (px != null && px < FACE_WARN_YELLOW_PX) return 5;
    if (f && f.soft)     return 6;
    return 0;
  }

  /* The modal shows their photograph, which __setIntakePhoto already does.
     'Use this one anyway' is honoured once and remembered, so a second
     analysis of the same file does not ask again. */
  function raiseFault(){
    var n = faultState();
    if (!n || SRC.overridden) return false;
    say(SAY.reject);
    window.__setIntakePhoto(SRC.dataUrl);
    window.__openIntake(n);
    return true;
  }

  /* ---- the file ---------------------------------------------------------- */
  var srcFile = document.getElementById('srcFile');

  function pickSource(){ if (srcFile) srcFile.click(); }

  function onSourceFile(file){
    if (!file) return;
    var rd = new FileReader();
    rd.onload = function(){
      var url = String(rd.result);
      SRC.b64 = url.split(',')[1] || null;
      SRC.dataUrl = url;
      SRC.dims = null; SRC.flags = null; SRC.analyze = null;
      SRC.gate = null;  SRC.recs = null;  SRC.gateFp = null;
      SRC.overridden = false;

      var thumb = document.getElementById('curThumb');
      if (thumb) thumb.src = url;
      curatorState('photo', SAY.photo);

      var probe = new Image();
      probe.onload = function(){
        SRC.dims  = { w: probe.naturalWidth, h: probe.naturalHeight };
        SRC.flags = localPhotoCheck(probe);
        runAnalyze();
        precheckSourceGate();
      };
      /* A file the browser cannot decode is a fault in itself, and state 8
         is the one that says so. */
      probe.onerror = function(){ SRC.analyze = { quality_verdict: 'red' }; raiseFault(); };
      probe.src = url;
    };
    rd.readAsDataURL(file);
  }

  if (srcFile) srcFile.addEventListener('change', function(){
    onSourceFile(srcFile.files && srcFile.files[0]);
    srcFile.value = '';           /* same file twice must still fire change */
  });

  /* ---- /portraits/analyze ------------------------------------------------
     b2 6585. The run token survives: replace the photograph mid-flight and
     the stale response is discarded rather than speaking over the new one. */
  function runAnalyze(){
    var seq = SRC.seq = SRC.seq + 1;
    return fetch(ANALYZE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_image_b64:      SRC.b64,
        additional_images_b64: []
      })
    }).then(function(res){
      if (!res.ok) throw new Error('analyze ' + res.status);
      return res.json();
    }).then(function(data){
      if (seq !== SRC.seq) return;
      SRC.analyze = (data && data.result) || {};
      if (raiseFault()) return;
      curatorEnterEffects();
    }).catch(function(){
      /* Soft fail. b2 fell back to a rail wizard that no longer exists, so
         the fallback is the floor the customer is already looking at. */
      if (seq !== SRC.seq) return;
      SRC.analyze = SRC.analyze || {};
      curatorEnterEffects();
    });
  }

  /* ---- /portraits/gate ---------------------------------------------------
     b2 5288. Advisory, not blocking: it lands after analyze more often than
     not, and when it rejects it raises the same modal. Fingerprinted on the
     first 40 chars so a re-check of the same photograph is free. */
  function precheckSourceGate(){
    if (!SRC.b64) return Promise.resolve();
    var fp = SRC.b64.slice(0, 40);
    if (SRC.gateFp === fp) return Promise.resolve();
    SRC.gateFp = fp;
    return fetch(GATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_image_b64:      SRC.b64,
        additional_images_b64: []
      })
    }).then(function(res){
      if (!res.ok) return null;
      return res.json();
    }).then(function(v){
      if (!v || SRC.gateFp !== fp) return;
      SRC.gate = v;
      raiseFault();
    }).catch(function(){ /* gate is advisory — silence is a pass */ });
  }

  /* ---- /portraits/curate-effects ----------------------------------------
     b2 7225. b2 painted its own five cards; the floor already paints cards,
     so this only decides WHICH. Every returned id is checked against the
     registry and anything not live is dropped — the registry governs what
     may be offered, and a recommendation is not an exception to that. */
  function curatorEnterEffects(){
    var rotation = 0;
    try {
      var stored = parseInt(localStorage.getItem('liten_curator_rotation') || '0', 10);
      rotation = isFinite(stored) ? stored : 0;
      localStorage.setItem('liten_curator_rotation', String(rotation + 1));
    } catch (e){ /* no persistence — stay at 0 */ }

    return fetch(CURATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_image_b64: SRC.b64,
        rotation_index:   rotation
      })
    }).then(function(res){
      if (!res.ok) throw new Error('curate ' + res.status);
      return res.json();
    }).then(function(data){
      var list = (data && data.recommendations) || [];
      SRC.recs = list.map(function(r){
        var e = R.byId(r.preset);
        return (e && e.body === 'live') ? e : null;
      }).filter(Boolean);
      window.__RECS = SRC.recs;
    }).catch(function(){ SRC.recs = null; });
  }

  /* ---- the intake modal's own buttons ------------------------------------
     Drawn in r02, never wired. The filled button always means 'another
     photograph' and reopens the picker; the ghost means 'use this one' and
     is remembered so the same fault is not raised twice about one file. */
  (function wireIntakeActions(){
    var modal = document.getElementById('intakeModal');
    if (!modal) return;
    modal.querySelectorAll('.state[data-s] .acts .btn').forEach(function(b){
      b.addEventListener('click', function(){
        window.__closeIntake();
        if (b.classList.contains('ghost')){ SRC.overridden = true; return; }
        pickSource();
      });
    });
  })();
