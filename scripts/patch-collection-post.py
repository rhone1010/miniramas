#!/usr/bin/env python3
"""
patch-collection-post.py - put a piece on the board, from My Collection.

  python scripts\\patch-collection-post.py public\\portraits.html
  python scripts\\patch-collection-post.py public\\portraits.html --apply

Dry run by default. CRLF file.

WHY THIS IS THE MISSING PIECE. community.html reads the board, hearts,
comments, reports, claims a handle and takes a post down. It has never had a
way to PUT one up - and neither has anywhere else. That is why the board has
never had one real post through it, and why an empty board and a broken view
have been indistinguishable since V28.

The route has existed and been finished this whole time:
POST /api/v1/community/posts { piece_id, consent: true }.

WHERE IT GOES. The featured piece in My Collection already carries Download
and Send to Print Shop. Post to Community is the third thing you can do with
a piece you own, so it is the third button, same row, same class.

NO CAP. Ruled 20 August. lib/community/db.ts argues it and the argument
holds: posting already costs a craft, the customer has paid it, and "you
have posted enough this month" is a strange thing for a shop to say to
somebody spending money. postsPerHour of 3 is the only brake and it is a
burst brake. The unique constraint on piece_id means a piece can be posted
once ever, so there is no cycling to prevent either.

CONSENT IS COPIED VERBATIM FROM lib/community/db.ts. If that string ever
changes, this one must change with it - but note that changing it does NOT
change what anybody already agreed to, because every post stores its own
copy. That is the whole reason it is stored.

THE HANDLE IS ASKED FOR IN PLACE. A post needs one, and sending somebody to
another page to claim it loses the piece they were trying to post. Same
route community.html uses - GET to read, PUT to claim.

WHAT IS NOT HERE, AND WHY. Withdraw. The board can already take a post down,
but My Collection has no way to know a piece IS posted - the pieces payload
carries no flag and there is no "my posts" query. Until one exists this panel
would have to guess, and a Take it down button that appears on everything is
worse than none. One line for CENG; the glass is a small follow-up.
"""

import sys
import os

EDITS = []

# ---- 1 · styles, appended last in the sheet -------------------------------
EDITS.append((
    "styles",
    ".room--footer{ display:none !important }\r\n",
    ".room--footer{ display:none !important }\r\n"
    "\r\n"
    "/* ---- POST TO COMMUNITY ----------------------------------------------\r\n"
    "   Its own scrim and card rather than a state inside the intake modal.\r\n"
    "   That one is a gallery of studio failures; this is a thing somebody\r\n"
    "   chose to do, and dressing a choice in the clothes of a failure is how\r\n"
    "   a choice starts to feel like one.\r\n"
    "\r\n"
    "   Everything is scoped under .pcm- so nothing here can reach into the\r\n"
    "   workshop's own .modal, .btn or .field.\r\n"
    "   -------------------------------------------------------------------- */\r\n"
    ".pcm-scrim{\r\n"
    "  position:fixed; inset:0; z-index:140;\r\n"
    "  display:none; align-items:center; justify-content:center; padding:1.5rem;\r\n"
    "  background:rgba(20,14,10,.72);\r\n"
    "}\r\n"
    ".pcm-scrim.is-open{ display:flex }\r\n"
    ".pcm-card{\r\n"
    "  width:min(92vw,560px); max-height:88vh; overflow:auto;\r\n"
    "  padding:30px 32px 26px; border-radius:8px;\r\n"
    "  background:linear-gradient(180deg,#3a2c26 0%, #2c211c 100%);\r\n"
    "  border:1px solid rgba(196,169,110,.26);\r\n"
    "  box-shadow:0 30px 70px -24px rgba(20,12,8,.8), inset 0 1px 0 rgba(255,255,255,.06);\r\n"
    "  color:var(--vellum-200);\r\n"
    "}\r\n"
    ".pcm-h{\r\n"
    "  font-family:var(--serif); font-size:1.9rem; line-height:1.15;\r\n"
    "  color:var(--series); margin:0 0 .3em;\r\n"
    "}\r\n"
    ".pcm-sub{\r\n"
    "  font-family:var(--serif); font-size:1.22rem; line-height:1.45;\r\n"
    "  color:rgba(243,237,225,.82); margin:0 0 22px;\r\n"
    "}\r\n"
    ".pcm-art{\r\n"
    "  width:132px; aspect-ratio:1; float:left; margin:0 20px 14px 0;\r\n"
    "  border-radius:6px; object-fit:cover;\r\n"
    "  border:1px solid rgba(196,169,110,.24); background:rgba(0,0,0,.25);\r\n"
    "}\r\n"
    ".pcm-field{ clear:both; margin:0 0 18px }\r\n"
    ".pcm-field label{\r\n"
    "  display:block; margin:0 0 .45em;\r\n"
    "  font-family:var(--sans); font-size:.82rem; font-weight:600;\r\n"
    "  letter-spacing:.16em; text-transform:uppercase; color:var(--brass);\r\n"
    "}\r\n"
    ".pcm-field input{\r\n"
    "  width:100%; height:48px; padding:0 14px;\r\n"
    "  font-family:var(--serif); font-size:1.22rem; color:var(--vellum-200);\r\n"
    "  background:rgba(0,0,0,.22); border:1px solid rgba(196,169,110,.3);\r\n"
    "  border-radius:6px; outline:none;\r\n"
    "}\r\n"
    ".pcm-field input:focus{ border-color:var(--gold) }\r\n"
    "/* THE CONSENT IS A LABEL AROUND THE BOX, so the words are the target.\r\n"
    "   A 16px square is a small thing to ask somebody to hit before they\r\n"
    "   agree to something in public. */\r\n"
    ".pcm-consent{\r\n"
    "  display:flex; gap:12px; align-items:flex-start; cursor:pointer;\r\n"
    "  padding:14px 16px; margin:0 0 20px; border-radius:6px;\r\n"
    "  background:rgba(0,0,0,.18); border:1px solid rgba(196,169,110,.18);\r\n"
    "}\r\n"
    ".pcm-consent input{ width:20px; height:20px; margin-top:.18em; flex:0 0 auto; cursor:pointer }\r\n"
    ".pcm-consent span{\r\n"
    "  font-family:var(--serif); font-size:1.1rem; line-height:1.45;\r\n"
    "  color:rgba(243,237,225,.86);\r\n"
    "}\r\n"
    ".pcm-acts{ display:flex; gap:12px; justify-content:flex-end; align-items:center }\r\n"
    ".pcm-b{\r\n"
    "  padding:.55em 1.25em; border-radius:6px; cursor:pointer;\r\n"
    "  font-family:var(--serif); font-style:italic; font-size:1.18rem;\r\n"
    "  border:1px solid rgba(196,169,110,.34);\r\n"
    "  background:rgba(255,255,255,.03); color:rgba(243,237,225,.88);\r\n"
    "  transition:background 160ms ease, color 160ms ease;\r\n"
    "}\r\n"
    ".pcm-b:hover{ background:rgba(196,169,110,.16); color:#fff }\r\n"
    ".pcm-b.is-fill{\r\n"
    "  background:linear-gradient(180deg, var(--oxblood) 0%, #6a3737 100%);\r\n"
    "  border-color:rgba(196,169,110,.4); color:#fff;\r\n"
    "}\r\n"
    ".pcm-b[disabled]{ opacity:.45; cursor:default }\r\n"
    ".pcm-b[disabled]:hover{ background:rgba(255,255,255,.03); color:rgba(243,237,225,.88) }\r\n"
    "/* Sized so the card does not jump when a refusal arrives. */\r\n"
    ".pcm-say{\r\n"
    "  clear:both; min-height:1.5em; margin:0 0 14px;\r\n"
    "  font-family:var(--serif); font-size:1.1rem; line-height:1.4;\r\n"
    "  color:#e0a5a5;\r\n"
    "}\r\n"
    ".pcm-say.is-good{ color:var(--series) }\r\n",
))

# ---- 2 · the third button --------------------------------------------------
EDITS.append((
    "post button",
    "            '<button class=\"mc-act\" id=\"mcPr1\" type=\"button\">Send to Print Shop</button>' +\r\n",
    "            '<button class=\"mc-act\" id=\"mcPr1\" type=\"button\">Send to Print Shop</button>' +\r\n"
    "            /* The third thing you can do with a piece you own. */\r\n"
    "            '<button class=\"mc-act\" id=\"mcPost1\" type=\"button\">Post to Community</button>' +\r\n",
))

# ---- 3 · wiring ------------------------------------------------------------
EDITS.append((
    "wiring",
    "      if (p1) p1.addEventListener('click', function(){\r\n",
    "      var q1 = wrap.querySelector('#mcPost1');\r\n"
    "      if (q1) q1.addEventListener('click', function(){\r\n"
    "        var one = featuredPiece();\r\n"
    "        if (one && typeof openPostToCommunity === 'function') openPostToCommunity(one);\r\n"
    "      });\r\n"
    "      if (p1) p1.addEventListener('click', function(){\r\n",
))

# ---- 4 · markup and behaviour, at the tail --------------------------------
EDITS.append((
    "modal",
    "</script>\r\n\r\n</body>\r\n</html>\r\n",
    "</script>\r\n"
    "\r\n"
    "<div class=\"pcm-scrim\" id=\"pcmScrim\">\r\n"
    "  <div class=\"pcm-card\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"pcmH\">\r\n"
    "    <h2 class=\"pcm-h\" id=\"pcmH\">Put this on the board</h2>\r\n"
    "    <p class=\"pcm-sub\">Community is where people show what they have made.</p>\r\n"
    "    <img class=\"pcm-art\" id=\"pcmArt\" alt=\"\">\r\n"
    "    <div class=\"pcm-field\" id=\"pcmHandleField\" hidden>\r\n"
    "      <label for=\"pcmHandle\">Your handle</label>\r\n"
    "      <input id=\"pcmHandle\" type=\"text\" maxlength=\"40\" autocomplete=\"off\"\r\n"
    "             placeholder=\"What should sit under your work?\">\r\n"
    "    </div>\r\n"
    "    <label class=\"pcm-consent\">\r\n"
    "      <input type=\"checkbox\" id=\"pcmConsent\">\r\n"
    "      <span id=\"pcmConsentText\"></span>\r\n"
    "    </label>\r\n"
    "    <p class=\"pcm-say\" id=\"pcmSay\"></p>\r\n"
    "    <div class=\"pcm-acts\">\r\n"
    "      <button class=\"pcm-b\" id=\"pcmCancel\" type=\"button\">Not now</button>\r\n"
    "      <button class=\"pcm-b is-fill\" id=\"pcmGo\" type=\"button\" disabled>Post it</button>\r\n"
    "    </div>\r\n"
    "  </div>\r\n"
    "</div>\r\n"
    "\r\n"
    "<script>\r\n"
    "/* ---- POST TO COMMUNITY --------------------------------------------\r\n"
    "   The board has been readable, heartable and commentable since V28 and\r\n"
    "   there has never been a way to put anything ON it. This is that way.\r\n"
    "\r\n"
    "   POST /api/v1/community/posts { piece_id, consent:true }\r\n"
    "   GET/PUT /api/v1/community/handle\r\n"
    "\r\n"
    "   The consent string is copied verbatim from lib/community/db.ts. It is\r\n"
    "   stored on every post as agreed, so changing it here changes what the\r\n"
    "   NEXT person agrees to and nothing about anybody already on the board.\r\n"
    "   If that file's CONSENT_TEXT_V1 changes, change this with it.\r\n"
    "\r\n"
    "   Consent is checked server-side too. A tick in a browser is a statement\r\n"
    "   about a browser; the row is what we would have to stand behind. */\r\n"
    "(function(){\r\n"
    "  var CONSENT =\r\n"
    "    'This is my own photograph, or I have the permission of the person in it. ' +\r\n"
    "    'I understand it will be visible to anyone who visits Liten & Co, with my ' +\r\n"
    "    'handle beneath it, and that I can take it down at any time.';\r\n"
    "\r\n"
    "  var R_POSTS  = '/api/v1/community/posts';\r\n"
    "  var R_HANDLE = '/api/v1/community/handle';\r\n"
    "\r\n"
    "  var scrim  = document.getElementById('pcmScrim');\r\n"
    "  if (!scrim) return;\r\n"
    "  var art    = document.getElementById('pcmArt');\r\n"
    "  var hField = document.getElementById('pcmHandleField');\r\n"
    "  var hInput = document.getElementById('pcmHandle');\r\n"
    "  var tick   = document.getElementById('pcmConsent');\r\n"
    "  var say    = document.getElementById('pcmSay');\r\n"
    "  var go     = document.getElementById('pcmGo');\r\n"
    "  var cancel = document.getElementById('pcmCancel');\r\n"
    "\r\n"
    "  document.getElementById('pcmConsentText').textContent = CONSENT;\r\n"
    "\r\n"
    "  var PIECE  = null;\r\n"
    "  var HANDLE = null;\r\n"
    "  var busy   = false;\r\n"
    "\r\n"
    "  function tell(msg, good){\r\n"
    "    say.textContent = msg || '';\r\n"
    "    say.classList.toggle('is-good', !!good);\r\n"
    "  }\r\n"
    "\r\n"
    "  /* Post is available when consent is ticked and a handle exists - either\r\n"
    "     one already claimed, or something typed into the box. */\r\n"
    "  function paint(){\r\n"
    "    var named = !!HANDLE || (hInput && String(hInput.value || '').trim().length > 0);\r\n"
    "    go.disabled = busy || !tick.checked || !named;\r\n"
    "  }\r\n"
    "\r\n"
    "  function shut(){\r\n"
    "    scrim.classList.remove('is-open');\r\n"
    "    PIECE = null; busy = false;\r\n"
    "  }\r\n"
    "\r\n"
    "  window.openPostToCommunity = function(piece){\r\n"
    "    if (!piece) return;\r\n"
    "    PIECE = piece;\r\n"
    "    busy = false;\r\n"
    "    tick.checked = false;\r\n"
    "    tell('');\r\n"
    "    go.textContent = 'Post it';\r\n"
    "    if (art) art.src = piece.art || '';\r\n"
    "    scrim.classList.add('is-open');\r\n"
    "    paint();\r\n"
    "\r\n"
    "    /* Asked for in place. Sending somebody to another page to claim a\r\n"
    "       handle loses the piece they were trying to post. */\r\n"
    "    fetch(R_HANDLE, { credentials:'same-origin' })\r\n"
    "      .then(function(r){ return r.ok ? r.json() : null; })\r\n"
    "      .then(function(d){\r\n"
    "        HANDLE = (d && d.handle) || null;\r\n"
    "        if (hField) hField.hidden = !!HANDLE;\r\n"
    "        if (!HANDLE && hInput && d && d.suggestion) hInput.value = d.suggestion;\r\n"
    "        paint();\r\n"
    "      })\r\n"
    "      .catch(function(){ if (hField) hField.hidden = false; paint(); });\r\n"
    "  };\r\n"
    "\r\n"
    "  tick.addEventListener('change', paint);\r\n"
    "  if (hInput) hInput.addEventListener('input', paint);\r\n"
    "  cancel.addEventListener('click', shut);\r\n"
    "  scrim.addEventListener('click', function(e){ if (e.target === scrim) shut(); });\r\n"
    "  addEventListener('keydown', function(e){\r\n"
    "    if (e.key === 'Escape' && scrim.classList.contains('is-open')) shut();\r\n"
    "  });\r\n"
    "\r\n"
    "  /* Every reason the route can give, said plainly. A bare \"that did not\r\n"
    "     work\" on a thing somebody chose to do in public is the worst of the\r\n"
    "     available answers. */\r\n"
    "  var WHY = {\r\n"
    "    signed_out:     'Sign in first, then this will go straight up.',\r\n"
    "    no_piece:       'I cannot find that piece any more.',\r\n"
    "    archived:       'That one is archived. Bring it back first and it can go up.',\r\n"
    "    no_consent:     'Tick the box and it can go up.',\r\n"
    "    need_handle:    'Choose a handle first - it sits beneath your work.',\r\n"
    "    already_posted: 'This one is already on the board.',\r\n"
    "    slow_down:      'That is three in an hour. Give it a little while.',\r\n"
    "    unavailable:    'The board is not answering just now. Try again shortly.'\r\n"
    "  };\r\n"
    "\r\n"
    "  function post(){\r\n"
    "    busy = true; paint(); tell('');\r\n"
    "    fetch(R_POSTS, {\r\n"
    "      method:'POST',\r\n"
    "      headers:{ 'Content-Type':'application/json' },\r\n"
    "      credentials:'same-origin',\r\n"
    "      body: JSON.stringify({ piece_id: PIECE.id, consent: true })\r\n"
    "    })\r\n"
    "      .then(function(r){ return r.json().then(function(d){ d.__s = r.status; return d; }); })\r\n"
    "      .then(function(d){\r\n"
    "        busy = false;\r\n"
    "        if (d && d.ok){\r\n"
    "          /* Ten live pieces earns a craft. The route says so; saying it\r\n"
    "             here is the only place the customer finds out. */\r\n"
    "          tell(d.earned\r\n"
    "            ? 'It is on the board - and that is ten, so a craft is on us.'\r\n"
    "            : 'It is on the board.', true);\r\n"
    "          go.textContent = 'Posted';\r\n"
    "          go.disabled = true;\r\n"
    "          setTimeout(shut, 1800);\r\n"
    "          return;\r\n"
    "        }\r\n"
    "        tell((d && WHY[d.reason]) || 'That did not take. Try again in a moment.');\r\n"
    "        paint();\r\n"
    "      })\r\n"
    "      .catch(function(){\r\n"
    "        busy = false;\r\n"
    "        tell('That did not take. Try again in a moment.');\r\n"
    "        paint();\r\n"
    "      });\r\n"
    "  }\r\n"
    "\r\n"
    "  go.addEventListener('click', function(){\r\n"
    "    if (!PIECE || busy) return;\r\n"
    "    if (HANDLE) return post();\r\n"
    "    /* Claim the handle, then post - one press, two calls, because two\r\n"
    "       presses to do one thing is how somebody abandons it halfway. */\r\n"
    "    var want = String(hInput.value || '').trim();\r\n"
    "    if (!want) return;\r\n"
    "    busy = true; paint(); tell('');\r\n"
    "    fetch(R_HANDLE, {\r\n"
    "      method:'PUT',\r\n"
    "      headers:{ 'Content-Type':'application/json' },\r\n"
    "      credentials:'same-origin',\r\n"
    "      body: JSON.stringify({ handle: want })\r\n"
    "    })\r\n"
    "      .then(function(r){ return r.json(); })\r\n"
    "      .then(function(d){\r\n"
    "        busy = false;\r\n"
    "        if (d && d.ok){\r\n"
    "          HANDLE = d.handle;\r\n"
    "          if (hField) hField.hidden = true;\r\n"
    "          return post();\r\n"
    "        }\r\n"
    "        if (d && d.reason === 'taken') tell('Somebody already writes under that one.');\r\n"
    "        else if (d && d.message)       tell(d.message);\r\n"
    "        else if (d && d.reason === 'signed_out') tell(WHY.signed_out);\r\n"
    "        else tell('That handle did not take. Try another.');\r\n"
    "        paint();\r\n"
    "      })\r\n"
    "      .catch(function(){\r\n"
    "        busy = false;\r\n"
    "        tell('That did not take. Try again in a moment.');\r\n"
    "        paint();\r\n"
    "      });\r\n"
    "  });\r\n"
    "})();\r\n"
    "</script>\r\n"
    "\r\n"
    "</body>\r\n"
    "</html>\r\n",
))

MARKER = "POST TO COMMUNITY"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    apply_it = "--apply" in sys.argv

    if not args:
        print(__doc__)
        return 1

    path = args[0]
    if not os.path.isfile(path):
        print("MISSING   " + path)
        return 1

    with open(path, "r", encoding="utf-8", newline="") as f:
        original = f.read()

    print("patch-collection-post")
    print("  target   " + path)
    print("  mode     " + ("APPLY" if apply_it else "dry run - nothing will be written"))

    if MARKER in original:
        print("  SKIP     already present")
        return 0

    text = original
    failed = 0
    for name, anchor, new in EDITS:
        n = text.count(anchor)
        if n != 1:
            print("  FAIL     " + name + " - anchor matches " + str(n) + " times")
            failed += 1
            continue
        text = text.replace(anchor, new, 1)
        print("  OK       " + name)

    if failed:
        print("  REFUSED  " + str(failed) + " anchor problem(s). Nothing written.")
        return 1

    # pre-write assertions
    assert text.count('id="pcmScrim"') == 1, "modal duplicated"
    assert text.count('id="mcPost1"') == 1, "button markup missing or duplicated"
    assert text.count("querySelector('#mcPost1')") == 1, "button wiring missing or duplicated"
    assert text.count('.pcm-scrim{') == 1, "styles missing or duplicated"
    # The definition, plus any references. patch-feat-acts adds two of its
    # own in the action row, so an exact count here is wrong the moment the
    # two patches meet - assert the definition exists instead.
    assert text.count("window.openPostToCommunity = function(piece)") == 1, \
        "opener missing or defined twice"
    assert text.count('</body>') == 1 and text.count('</html>') == 1, "document closed twice"
    assert text.rstrip().endswith('</html>'), "content after the document"
    assert text.index('.pcm-scrim{') < text.index('</style>'), "styles outside the sheet"
    assert text.index('id="pcmScrim"') > text.index('</style>'), "markup inside the sheet"
    # the earlier panel-boot hook must survive and still run
    # patch-portraits-panel-boot.py has only ever run against portraits.html,
    # so this hook is absent from a Series clone. Assert it survives where it
    # exists rather than requiring it everywhere.
    if 'ARRIVE ON A PANEL' in original:
        assert text.count('ARRIVE ON A PANEL') == 1, "panel boot hook lost"
    assert text.count('window.__showCollection') == 1, "collection opener disturbed"
    # the consent must match db.ts verbatim
    assert 'This is my own photograph, or I have the permission of the person in it. ' in text, \
        "consent wording altered"
    assert text.count('mcDl1') == original.count('mcDl1'), "download button disturbed"
    assert text.count('mcPr1') == original.count('mcPr1'), "print button disturbed"
    assert "\r\n" in text, "line endings lost"

    if not apply_it:
        print("  Would write " + str(len(text) - len(original)) + " more bytes. Re-run with --apply.")
        return 0

    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print("  WROTE    " + path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
