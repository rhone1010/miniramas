/* public/track.js
 *
 * Liten & Co — client analytics.
 *
 * Standalone so portraits.html needs one line added, not surgery on 9,700.
 * Add before the closing </body>:
 *     <script src="/track.js"></script>
 *
 * Exposes window.track(name, props). Everything else is automatic:
 *   - anon_id cookie (1 year), session_id (30-min idle)
 *   - first-touch campaign capture, stored once and never overwritten
 *   - batching, and a sendBeacon flush on tab close so exits are recorded
 *
 * Never throws. Never blocks. A lost event is never worth a broken craft.
 */
(function () {
  'use strict'

  var ENDPOINT   = '/api/v1/events'
  var ANON_KEY   = 'liten_anon'
  var UTM_KEY    = 'liten_utm'
  var SESS_KEY   = 'liten_sess'
  var SESS_TS    = 'liten_sess_ts'
  var SESSION_MS = 30 * 60 * 1000
  var YEAR_S     = 60 * 60 * 24 * 365

  function uuid () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0
      var v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  function getCookie (name) {
    var m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')
    return m ? decodeURIComponent(m.pop()) : null
  }

  function setCookie (name, value, maxAge) {
    try {
      document.cookie = name + '=' + encodeURIComponent(value) +
        ';path=/;max-age=' + maxAge + ';samesite=lax' +
        (location.protocol === 'https:' ? ';secure' : '')
    } catch (e) {}
  }

  /* ---- identity ---- */

  var anonId = getCookie(ANON_KEY)
  var isNewVisitor = false
  if (!anonId) {
    anonId = uuid()
    isNewVisitor = true
    setCookie(ANON_KEY, anonId, YEAR_S)
  }

  function sessionId () {
    var now = Date.now()
    var id, ts
    try {
      id = sessionStorage.getItem(SESS_KEY)
      ts = parseInt(sessionStorage.getItem(SESS_TS) || '0', 10)
    } catch (e) { return uuid() }
    if (!id || !ts || (now - ts) > SESSION_MS) {
      id = uuid()
      try { sessionStorage.setItem(SESS_KEY, id) } catch (e) {}
    }
    try { sessionStorage.setItem(SESS_TS, String(now)) } catch (e) {}
    return id
  }

  /* ---- first-touch attribution ---- */

  var UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content',
                    'utm_term', 'fbclid', 'gclid', 'ttclid']

  function captureUtm () {
    var existing = getCookie(UTM_KEY)
    if (existing) { try { return JSON.parse(existing) } catch (e) { return null } }

    var params = new URLSearchParams(location.search)
    var found = {}
    var any = false
    UTM_FIELDS.forEach(function (f) {
      var v = params.get(f)
      if (v) { found[f] = v.slice(0, 200); any = true }
    })
    if (document.referrer && document.referrer.indexOf(location.host) === -1) {
      found.referrer = document.referrer.slice(0, 400)
      any = true
    }
    found.landing = location.pathname.slice(0, 200)

    if (!any) return null
    setCookie(UTM_KEY, JSON.stringify(found), YEAR_S)
    return found
  }

  var utm = captureUtm()

  /* ---- owner_key ---- *
   * Read-only. Set by the app; we only report it so the panel can join to
   * identity_map. If the app stores it elsewhere, adjust this one function. */
  function ownerKey () {
    try {
      return localStorage.getItem('liten_owner_key') ||
             localStorage.getItem('owner_key') ||
             getCookie('owner_key') || null
    } catch (e) { return null }
  }

  /* ---- queue & transport ---- */

  var queue = []
  var timer = null
  var FLUSH_MS = 5000
  var FLUSH_MAX = 20

  function payload () {
    var events = queue.splice(0, queue.length)
    return JSON.stringify({ events: events })
  }

  function flush (useBeacon) {
    if (!queue.length) return
    var body = payload()
    try {
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))
        return
      }
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true,
      }).catch(function () {})
    } catch (e) {}
  }

  function schedule () {
    if (timer) return
    timer = setTimeout(function () { timer = null; flush(false) }, FLUSH_MS)
  }

  function track (name, props) {
    try {
      if (!name) return
      queue.push({
        name: name,
        anon_id: anonId,
        session_id: sessionId(),
        owner_key: ownerKey(),
        series: (props && props.series) || null,
        props: props || {},
        path: location.pathname,
        referrer: document.referrer || null,
        utm: utm,
        ts: Date.now(),
      })
      if (queue.length >= FLUSH_MAX) { flush(false) } else { schedule() }
    } catch (e) {}
  }

  window.track = track

  /* ---- automatic events ---- */

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush(true)
  })
  window.addEventListener('pagehide', function () { flush(true) })

  track('session_start', { entry_path: location.pathname, is_new_visitor: isNewVisitor })
  track('page_view', { path: location.pathname, title: document.title })
})()
