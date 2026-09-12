/* public/foyer-handoff.js
   ─────────────────────────────────────────────────────────────────────────
   THE FOYER → DISCOVERY HANDOFF. One photograph, one trip, no second upload.

   The foyer fits the visitor's photograph once (the Portraits fitting) and
   has it examined once (/api/v1/foyer/intake: face, age, gender). When they
   choose Come Inside & Explore, Discovery opens with that same photograph
   and the subject the intake detected -- not the foyer's generated reveal,
   not its effect, nothing owned, selected or unlocked.

     the photograph   IndexedDB, as a Blob -- the fitted bytes exactly. A
                      phone photograph as base64 can overrun localStorage on
                      its own; a Blob in IndexedDB does not, and is not
                      re-encoded on the way through.
     what it says     localStorage, a few dozen bytes: subject, gender, age
                      group, when.

   Same origin, same browser, nothing sent to a server. Discovery takes it
   ONCE and it is gone; one older than the resume lifetime (~2h) is dropped
   unread. The foyer writes it only for a photograph the intake passed.
   ───────────────────────────────────────────────────────────────────────── */
(function(){
  var DB_NAME    = 'liten-handoff';
  var STORE      = 'photos';
  var PHOTO_KEY  = 'foyer-source';
  var META_KEY   = 'liten_foyer_handoff_v1';
  var MAX_AGE_MS = 2 * 60 * 60 * 1000;

  function openDb(){
    return new Promise(function(resolve, reject){
      if (!window.indexedDB) { reject(new Error('indexedDB unavailable')); return; }
      var rq = indexedDB.open(DB_NAME, 1);
      rq.onupgradeneeded = function(){ rq.result.createObjectStore(STORE); };
      rq.onsuccess = function(){ resolve(rq.result); };
      rq.onerror   = function(){ reject(rq.error); };
    });
  }

  /* One request in one transaction; resolves with its result once the
     transaction has committed. */
  function inStore(mode, act){
    return openDb().then(function(db){
      return new Promise(function(resolve, reject){
        var t = db.transaction(STORE, mode), out;
        var rq = act(t.objectStore(STORE));
        rq.onsuccess = function(){ out = rq.result; };
        t.oncomplete = function(){ db.close(); resolve(out); };
        t.onerror = t.onabort = function(){ db.close(); reject(t.error); };
      });
    });
  }

  function dataUrlToBlob(dataUrl){
    var comma = dataUrl.indexOf(',');
    var semi  = dataUrl.indexOf(';');
    var type  = dataUrl.slice(5, semi > -1 && semi < comma ? semi : comma);
    var bin   = atob(dataUrl.slice(comma + 1));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type });
  }

  function blobToDataUrl(blob){
    return new Promise(function(resolve, reject){
      var rd = new FileReader();
      rd.onload  = function(){ resolve(String(rd.result || '')); };
      rd.onerror = function(){ reject(rd.error); };
      rd.readAsDataURL(blob);
    });
  }

  function clear(){
    try { localStorage.removeItem(META_KEY); } catch (e){}
    return inStore('readwrite', function(s){ return s.delete(PHOTO_KEY); }).catch(function(){});
  }

  /* Foyer. The photograph first, then the note that points at it, so the
     note never exists without the photograph behind it. */
  function put(dataUrl, info){
    var blob = dataUrlToBlob(dataUrl);
    return inStore('readwrite', function(s){ return s.put(blob, PHOTO_KEY); }).then(function(){
      localStorage.setItem(META_KEY, JSON.stringify({
        v: 1, at: Date.now(),
        subject:  info && info.subject  || null,
        gender:   info && info.gender   || null,
        ageGroup: info && info.ageGroup || null,
        type: blob.type, bytes: blob.size
      }));
    });
  }

  /* Discovery. Resolves { dataUrl, meta } once, or null. */
  function take(){
    var meta = null;
    try { meta = JSON.parse(localStorage.getItem(META_KEY) || 'null'); } catch (e){}
    if (!meta || meta.v !== 1) return Promise.resolve(null);
    if (Date.now() - (meta.at || 0) > MAX_AGE_MS) return clear().then(function(){ return null; });
    return inStore('readonly', function(s){ return s.get(PHOTO_KEY); })
      .then(function(blob){
        return clear().then(function(){
          if (!blob) return null;
          return blobToDataUrl(blob).then(function(url){ return { dataUrl: url, meta: meta }; });
        });
      })
      .catch(function(){ return clear().then(function(){ return null; }); });
  }

  window.LitenHandoff = { put: put, take: take, clear: clear };
})();
