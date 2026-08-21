#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch-floor-and-post.py  --  two faults, both found on live rooms.

    python scripts\\patch-floor-and-post.py public\\pets.html
    python scripts\\patch-floor-and-post.py public\\pets.html --apply

Dry run by default. Output to %USERPROFILE%\\Downloads\\<leafname>; install
with Install-File.ps1. Each fix is skipped in a file that does not need it,
and the script says which it applied.


FIX 1 -- THE EMPTY FLOOR.  pets.html, halloween.html

ROUTE_ACCEPTS is a hand-written list of preset ids the room's route will
take, and craftable() drops anything not on it:

    function craftable(e){
      return e && e.body === 'live' && ROUTE_ACCEPTS.indexOf(e.id) >= 0; }

Portraits keeps a list of its 63. Groups was given its own. Both clones
inherited the PORTRAITS list unedited, and neither was noticed because the
failure is silent -- a dropped effect is simply not drawn.

  Halloween  none of its 28 ids appear in the Portraits list, so every
             effect was dropped. The room rendered as one silo card with
             nothing behind it and the Curator said, correctly and
             uselessly, "that room is still in the studio".

  Pets       exactly seven of its 34 ids also exist in Portraits --
             bronze, ebony, plushy, stone, victorian, elizabethan and
             persian_court. So the floor showed seven cards and an upsell
             offering "all 7 of them", which read as a deliberate room of
             seven rather than 27 effects being filtered away.

The list is not deleted. It is DERIVED FROM THE REGISTRY, which is the
thing that already governs what may be offered and is generated from the
same catalogue the route reads. A hand-kept copy of a generated fact goes
stale the moment CENG adds an effect; this one cannot.

craftable() itself is untouched, so `body === 'live'` still decides and an
authored-but-not-built effect is still refused.


FIX 2 -- THE WRONG REASON.  every room

Posting to the board fails and the modal says:

    That handle did not take. Try another.

The handle was fine. That line is the last resort of the HANDLE branch,
which is reached whenever the handle call answers anything the branch does
not recognise -- including reason:'failed', which is what the route returns
for a database fault it could not classify. So a 500 in Supabase is
reported to the customer as a bad choice of name, and they sit there trying
other names against a server that is not listening.

This is the same fault shape as the credits gate, still open: a refusal for
ANY reason is reported as one specific reason. The customer is told
something false about their own input and given an action that cannot work.

The fix keeps every real refusal exactly as it reads now -- 'taken' still
says somebody already writes under that one -- and separates the two cases
the branch was collapsing:

  a 4xx with no known reason   the handle really was refused. Ask for
                               another, as now.
  a 5xx, or reason:'failed'    the studio broke. Say so, and do not
                               suggest a different name.

The status is already carried into the post() branch as d.__s and is simply
not read in the handle branch. This reads it.

WHAT THIS DOES NOT FIX. The route logs the real error and returns
'failed'. The message behind it is in the Vercel function log for the
request -- '[community/posts] insert failed:' or '[handle] ...'. The board
has never had a successful post through it and that log line is the only
thing that will say why. This patch stops the glass lying about it; it does
not make the post work.
"""

import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DOWNLOADS = os.path.join(
    os.environ.get('USERPROFILE', os.path.expanduser('~')), 'Downloads')

# Only the two clones. Portraits and Groups each curate a real list for a
# route that genuinely refuses ids outside it -- deriving theirs from the
# registry would offer effects the route would 400 on, after charging.
DERIVE_ROOMS = ('pets.html', 'halloween.html')

NEW_ACCEPTS = """  /* DERIVED, not kept by hand. Was a verbatim copy of the Portraits list
     of 63 preset ids, inherited by the clone and never edited -- so
     craftable() below dropped every effect whose id was not a Portraits
     id. Halloween lost all 28 and rendered an empty room; Pets lost 27 of
     34 and rendered seven, which read as a room of seven rather than a
     fault.

     The registry is generated from the same catalogue the route reads, so
     it cannot disagree with the route the way a hand-kept list can. If an
     effect is in here and the route refuses it, the registry is wrong and
     that is where the fix belongs. */
  var ROUTE_ACCEPTS = ((window.EFFECT_REGISTRY && window.EFFECT_REGISTRY.effects) || [])
    .map(function(e){ return e.id; });
"""

OLD_HANDLE_TAIL = """        if (d && d.reason === 'taken') tell('Somebody already writes under that one.');
        else if (d && d.message)       tell(d.message);
        else if (d && d.reason === 'signed_out') tell(WHY.signed_out);
        else tell('That handle did not take. Try another.');"""

NEW_HANDLE_TAIL = """        if (d && d.reason === 'taken') tell('Somebody already writes under that one.');
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
        else tell('That handle did not take. Try another.');"""

OLD_HANDLE_FETCH = """      .then(function(r){ return r.json(); })
      .then(function(d){
        busy = false;
        if (d && d.ok){
          HANDLE = d.handle;"""

NEW_HANDLE_FETCH = """      /* Carry the status through, exactly as post() does. Without it the
         branch below cannot tell a refused handle from a broken studio. */
      .then(function(r){ return r.json().then(function(d){ d.__s = r.status; return d; }); })
      .then(function(d){
        busy = false;
        if (d && d.ok){
          HANDLE = d.handle;"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('target')
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()

    target = args.target.replace('/', os.sep).replace('\\', os.sep)
    path = target if os.path.isabs(target) else os.path.join(REPO, target)
    if not os.path.isfile(path):
        sys.exit('FAIL: no file at %s' % path)

    leaf = os.path.basename(path)
    with open(path, 'r', encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = '\r\n' in raw
    text = raw.replace('\r\n', '\n')
    start_len = len(text)

    print('file   : %s  (%d bytes, %s)' % (path, len(raw), 'CRLF' if crlf else 'LF'))

    edits = []

    # ---- fix 1 ------------------------------------------------------
    if leaf in DERIVE_ROOMS:
        m = re.search(r"  var ROUTE_ACCEPTS = \[.*?\];\n", text, re.S)
        if not m:
            sys.exit('FAIL: ROUTE_ACCEPTS not found in its expected shape.')
        ids = re.findall(r"'([a-z0-9_]+)'", m.group(0))
        print('\nfix 1  : ROUTE_ACCEPTS -> derived')
        print('  the inherited list holds %d ids' % len(ids))
        edits.append(('ROUTE_ACCEPTS derived', m.group(0), NEW_ACCEPTS, 1))
    else:
        print('\nfix 1  : skipped - %s curates a real list for its own route'
              % leaf)

    # ---- fix 2 ------------------------------------------------------
    if OLD_HANDLE_TAIL in text:
        print('fix 2  : handle branch -> tells the truth about a 5xx')
        edits.append(('handle status carried', OLD_HANDLE_FETCH,
                      NEW_HANDLE_FETCH, 1))
        edits.append(('handle fault message', OLD_HANDLE_TAIL,
                      NEW_HANDLE_TAIL, 1))
    else:
        print('fix 2  : skipped - no Post to Community modal in this file')

    if not edits:
        print('\nNothing to do here.')
        return

    print('\nchecking anchors:')
    bad = []
    for label, old, new, n in edits:
        found = text.count(old)
        ok = found == n
        print('  %-24s %s  (found %d, expected %d)' %
              (label, 'ok ' if ok else 'FAIL', found, n))
        if not ok:
            bad.append(label)
    if bad:
        print('\nNOTHING WRITTEN. Failed: %s' % ', '.join(bad))
        sys.exit(1)

    for label, old, new, n in edits:
        text = text.replace(old, new, n)

    print('\nverifying result:')
    checks = [
        ('craftable() still gates on live',
         "e.body === 'live'" in text),
        ('file did not collapse', len(text) > start_len * 0.75),
    ]
    if leaf in DERIVE_ROOMS:
        checks += [
            ('ROUTE_ACCEPTS reads the registry',
             'window.EFFECT_REGISTRY.effects) || [])' in text),
            ('no literal id list left',
             re.search(r"var ROUTE_ACCEPTS = \[", text) is None),
        ]
    if any(l.startswith('handle') for l, _, _, _ in edits):
        checks += [
            ('handle branch reads the status', 'd.__s >= 500' in text),
            ('taken still reads as taken',
             "Somebody already writes under that one." in text),
        ]
    for label, ok in checks:
        print('  %-34s %s' % (label, 'ok' if ok else 'FAIL'))
    if not all(ok for _, ok in checks):
        sys.exit('\nNOTHING WRITTEN. Post-write verification failed.')

    out = os.path.join(DOWNLOADS, leaf)
    if not args.apply:
        print('\nDRY RUN. Re-run with --apply to write')
        print('  %s' % out)
        return

    if crlf:
        text = text.replace('\n', '\r\n')
    with open(out, 'w', encoding='utf-8', newline='') as fh:
        fh.write(text)
    print('\nWROTE %s  (%d bytes)' % (out, len(text)))
    print('\nInstall-File.ps1 %s' % target)


if __name__ == '__main__':
    main()
