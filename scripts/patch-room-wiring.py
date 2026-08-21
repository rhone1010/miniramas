#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
patch-room-wiring.py  --  point a cloned room at its own engine.

    python scripts\\patch-room-wiring.py public\\pets.html
    python scripts\\patch-room-wiring.py public\\pets.html --apply
    python scripts\\patch-room-wiring.py public\\halloween.html
    python scripts\\patch-room-wiring.py public\\halloween.html --apply

Dry run by default. Output to %USERPROFILE%\\Downloads\\<leafname>; put it
back with Install-File.ps1 so the version it replaces is archived.

WHY THIS EXISTS. build-pets-page.py and build-halloween-page.py cloned the
glass and repointed the registry, the plates and the Series name -- and
left every API URL pointing at /api/v1/portraits/*. Both rooms would have
sent a pet, or a Halloween sitter, to the Portraits engine and charged for
it. Groups repointed ANALYZE_URL and GENERATE_URL on day one; this is the
same edit, arriving late.

WHAT EACH ROOM GETS. Confirmed against the route directory, 21 August:
app/api/v1 holds pets/analyze, pets/generate and halloween/generate, and
nothing else for either room.

  PETS
    analyze   /api/v1/pets/analyze
    generate  /api/v1/pets/generate
    gate      REMOVED. There is no /api/v1/pets/gate. Pointing it at the
              Portraits gate would put a dog in front of a check written
              for a human face, which would reject or redirect every
              photograph in the room. Analyze carries the verdict, exactly
              as Groups does.

  HALLOWEEN
    analyze   /api/v1/portraits/analyze   -- Rich, 21 August
    gate      /api/v1/portraits/gate      -- KEPT. Human sitter, same
              quality check. NOTE: that route can also answer
              'redirected', so a group photograph brought into this room
              will be offered Groups. Correct, but it is a behaviour Rich
              should see before it meets a customer.
    generate  /api/v1/halloween/generate

  BOTH
    pieces    /api/v1/portraits/pieces -- unchanged. My Collection is not
              a Series; it holds every piece whatever room made it, and it
              sits under the portraits namespace only because Portraits
              was built first. Pointing it at a room path would give that
              room a private collection.

    curate    REMOVED. Rich, 21 August: no curate route in either room
              until there is a Curator engagement model. The function is
              KEPT as a stub because four call sites reach it and a
              missing name throws -- it clears the recommendations rather
              than leaving stale ones from a previous photograph. Same
              shape Groups uses.

    plates    previewFor() now calls the registry's plateFor(id).
              The build script baked a manifest of the filenames it found
              on disk; the registry works the path out fresh. Both agree
              today, but the manifest is a snapshot and goes stale the
              moment a plate is added or renamed. CENG's note on both
              registries says to use plateFor and not to build a path.
              The manifest is left in place for silo and pose art, which
              the registry has no equivalent for.
"""

import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
DOWNLOADS = os.path.join(
    os.environ.get('USERPROFILE', os.path.expanduser('~')), 'Downloads')

ROOMS = {
    'pets': {
        'analyze':  '/api/v1/pets/analyze',
        'generate': '/api/v1/pets/generate',
        'gate':     None,
        'gate_why': (
            "There is no /api/v1/pets/gate and none is coming. The Portraits\n"
            "     gate reads a human face for quality and for whether the\n"
            "     photograph belongs in another Series; an animal fails both\n"
            "     questions on their own terms. The Pets analyze route carries\n"
            "     the verdict instead, exactly as Groups does."),
    },
    'halloween': {
        'analyze':  '/api/v1/portraits/analyze',
        'generate': '/api/v1/halloween/generate',
        'gate':     '/api/v1/portraits/gate',
        'gate_why': None,
    },
}

# The WHOLE function, comment banner through closing brace. An earlier cut
# of this script prepended the stub and tried to comment the old one out --
# JS has no nested block comments, so that would have shipped a broken file.
OLD_CURATE = """  /* ---- /portraits/curate-effects ----------------------------------------
     b2 7225. b2 painted its own five cards; the floor already paints cards,
     so this only decides WHICH. Every returned id is checked against the
     registry and anything not live is dropped \u2014 the registry governs what
     may be offered, and a recommendation is not an exception to that. */
  function curatorEnterEffects(){
    var rotation = 0;
    try {
      var stored = parseInt(localStorage.getItem('liten_curator_rotation') || '0', 10);
      rotation = isFinite(stored) ? stored : 0;
      localStorage.setItem('liten_curator_rotation', String(rotation + 1));
    } catch (e){ /* no persistence \u2014 stay at 0 */ }

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
  }"""

NEW_CURATE = """  /* ---- no curate route in this room -------------------------------------
     Ruled by Rich, 21 August: the Curator does not recommend effects here
     until there is an engagement model to recommend them within. Nothing
     equivalent to /portraits/curate-effects exists for this room, and a
     client-side guess would be the studio pretending to have looked.

     Kept as a function because four call sites reach it and a missing name
     throws. It clears the recommendations rather than leaving stale ones
     from a previous photograph. */
  function curatorEnterEffects(){
    SRC.recs = null;
    window.__RECS = null;
    return Promise.resolve();
  }
"""

OLD_PREVIEW_FOR = """  function previewFor(tileId){
    /* false, not true: Pets plates are flat in /previews/pets/, one per
       effect, not in a per-effect folder the way Portraits keeps them. */
    return plateFrom(PV.files, PV.base, tileId, false);
  }"""

OLD_PREVIEW_FOR_H = """  function previewFor(tileId){
    /* false, not true: Halloween plates are flat in /previews/halloween/,
       one per effect, not in a per-effect folder the way Portraits keeps
       them. The sitter prefix is inside the filename, not a folder. */
    return plateFrom(PV.files, PV.base, tileId, false);
  }"""

NEW_PREVIEW_FOR = """  function previewFor(tileId){
    /* THE REGISTRY DECIDES, not the baked manifest. Both answer the same
       today; only one of them keeps answering correctly after a plate is
       added or renamed. The manifest below is a snapshot taken by the
       build script and goes stale silently. CENG's note on both registries
       says to call plateFor and never to build a path.

       Falls back to the manifest if the registry is an older one without
       plateFor, so this cannot blank a floor that used to paint. */
    if (R && typeof R.plateFor === 'function'){
      var p = R.plateFor(tileId);
      if (p) return p;
    }
    return plateFrom(PV.files, PV.base, tileId, false);
  }"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('target', help='e.g. public\\pets.html')
    ap.add_argument('--apply', action='store_true')
    args = ap.parse_args()

    target = args.target.replace('/', os.sep).replace('\\', os.sep)
    path = target if os.path.isabs(target) else os.path.join(REPO, target)
    if not os.path.isfile(path):
        sys.exit('FAIL: no file at %s' % path)

    leaf = os.path.basename(path)
    room = os.path.splitext(leaf)[0]
    if room not in ROOMS:
        sys.exit('FAIL: %s is not a room this script knows. Known: %s'
                 % (room, ', '.join(sorted(ROOMS))))
    spec = ROOMS[room]

    with open(path, 'r', encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = '\r\n' in raw
    text = raw.replace('\r\n', '\n')
    start_len = len(text)

    print('file   : %s  (%d bytes, %s)' % (path, len(raw), 'CRLF' if crlf else 'LF'))
    print('room   : %s' % room)

    edits = []

    edits.append((
        'ANALYZE_URL',
        "  var ANALYZE_URL        = '/api/v1/portraits/analyze';",
        "  var ANALYZE_URL        = '%s';" % spec['analyze'], 1))

    edits.append((
        'GENERATE_URL',
        "  var GENERATE_URL       = '/api/v1/portraits/generate';",
        "  var GENERATE_URL       = '%s';" % spec['generate'], 1))

    if spec['gate'] is None:
        edits.append((
            'GATE_URL removed',
            "  var GATE_URL           = '/api/v1/portraits/gate';",
            "  /* NO GATE ROUTE IN THIS ROOM.\n     %s */"
            % spec['gate_why'], 1))
        edits.append((
            'gate call removed',
            "    return fetch(GATE_URL, {",
            "    /* The fetch that stood here called a route this room does not\n"
            "       have. Resolved rather than removed: four call sites await\n"
            "       this and analyze already carries the verdict. */\n"
            "    return Promise.resolve();\n"
            "    /* eslint-disable-next-line no-unreachable */\n"
            "    return fetch('', {", 1))

    edits.append(('curate-effects', OLD_CURATE, NEW_CURATE.rstrip('\n'), 1))
    edits.append((
        'CURATE_URL removed',
        "  var CURATE_URL         = '/api/v1/portraits/curate-effects';",
        "  /* CURATE_URL removed with the function below. */", 1))

    old_pf = OLD_PREVIEW_FOR if room == 'pets' else OLD_PREVIEW_FOR_H
    edits.append(('previewFor -> plateFor', old_pf, NEW_PREVIEW_FOR, 1))

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
        ("analyze points at the room",  "'%s'" % spec['analyze'] in text),
        ("generate points at the room", "'%s'" % spec['generate'] in text),
        ("no portraits/generate left",
         "'/api/v1/portraits/generate'" not in text),
        ("pieces still shared",
         "'/api/v1/portraits/pieces'" in text),
        ("curate is a stub",
         "function curatorEnterEffects(){\n    SRC.recs = null;" in text),
        ("no live CURATE_URL fetch",
         "fetch(CURATE_URL" not in text),
        ("previewFor asks the registry",
         "R.plateFor(tileId)" in text),
        ("file did not collapse", len(text) > start_len * 0.9),
    ]
    if spec['gate'] is None:
        checks.append(("no gate route referenced",
                       "'/api/v1/portraits/gate'" not in text))
    else:
        checks.append(("gate kept",
                       "'%s'" % spec['gate'] in text))

    for label, ok in checks:
        print('  %-30s %s' % (label, 'ok' if ok else 'FAIL'))
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
