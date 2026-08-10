#!/usr/bin/env python3
# scripts/patch-mixed-sitters.py
#
# THE FLOOR IS MIXED BEFORE A PHOTOGRAPH ARRIVES.
#
# The coin that deals a sitter to each card was written on 2026-08-09 and
# then applied to exactly one of the three trees:
#
#     if (!who && tree === PV.silos) who = coinFor(id, Object.keys(tree));
#
# So the eight rooms were four and four, and every room you opened was a
# wall of men - the effect tiles and the pose tiles fell through to f[0],
# which is the man's plate. The bigger surface was the one still wrong.
#
# Two edits to public/portraits.html:
#
#   1  coinFor is namespaced by tree and deals the effects PER ROOM.
#      A single shuffle over sixty-three effects gives a balanced
#      catalogue and can still deal a room of eight men, and a room is
#      what a customer actually looks at. Seeded once per load, so a card
#      cannot change sitter between two paints of the same screen.
#
#   2  plateFrom asks the coin for all three trees, not just the silos.
#
# repaintSubject is NOT touched. It already flips the effect floor, the
# silo floor, the pose floor and the rail the moment a face is seen, and
# it was read before this was written.
#
# Pure ASCII. CRLF-aware. Anchors asserted before any write.
#
#   python scripts/patch-mixed-sitters.py            (dry run)
#   python scripts/patch-mixed-sitters.py --write

import io
import os
import sys

TARGET = os.path.join('public', 'portraits.html')


def crlf(s):
    return s.replace('\n', '\r\n')


# ---------------------------------------------------------------- 1
COIN_ANCHOR = crlf('''  var COIN = {};
  function coinFor(id, keys){
    if (COIN[id]) return COIN[id];
    var list = (keys || []).slice().sort();
    var half = Math.ceil(list.length / 2);
    var want = [];
    for (var i = 0; i < list.length; i++) want.push(i < half ? 'man' : 'woman');
    /* Fisher-Yates, so the split is exact and the order is not. */
    for (var j = want.length - 1; j > 0; j--){
      var k = Math.floor(Math.random() * (j + 1));
      var t = want[j]; want[j] = want[k]; want[k] = t;
    }
    for (var m = 0; m < list.length; m++) COIN[list[m]] = want[m];
    return COIN[id] || 'man';
  }''')

COIN_NEW = crlf('''  var COIN = {};
  var COIN_DEALT = {};

  /* An exact half-and-half over one list, shuffled. Fisher-Yates rather
     than a coin per card, because a real coin gives you eight men about
     once in every two hundred and fifty loads and that load is somebody's
     first impression. Keys are namespaced by tree: a silo and an effect
     could one day share an id, and finding that out through a picture of
     the wrong person is not how it should be found out. */
  function deal(ns, list){
    var l = (list || []).slice().sort();
    if (!l.length) return;
    var half = Math.ceil(l.length / 2);
    var want = [];
    for (var i = 0; i < l.length; i++) want.push(i < half ? 'man' : 'woman');
    for (var j = want.length - 1; j > 0; j--){
      var k = Math.floor(Math.random() * (j + 1));
      var t = want[j]; want[j] = want[k]; want[k] = t;
    }
    /* Never re-deal a card that already has a sitter. The same card must
       not change person between two paints of the same screen. */
    for (var m = 0; m < l.length; m++){
      var key = ns + ':' + l[m];
      if (!COIN[key]) COIN[key] = want[m];
    }
  }

  /* THE EFFECTS ARE DEALT ROOM BY ROOM. One shuffle across all sixty-three
     balances the catalogue and still deals a room of eight men often
     enough to matter, and a room is the thing a customer stands in. Each
     room gets its own exact half. */
  function dealEffects(tree){
    var seen = {};
    var silos = (R && R.silos) ? R.silos : [];
    for (var i = 0; i < silos.length; i++){
      var list = [];
      var rows = R.offerableTilesBySilo ? R.offerableTilesBySilo(silos[i].id)
               : R.offerableBySilo     ? R.offerableBySilo(silos[i].id)
               : [];
      for (var j = 0; j < rows.length; j++){
        if (!tree[rows[j].id]) continue;      /* no plate, nothing to deal */
        list.push(rows[j].id);
        seen[rows[j].id] = 1;
      }
      deal('files', list);
    }
    /* Anything the registry did not put in a room still needs a sitter,
       or it silently reverts to the man. */
    var rest = [];
    var all = Object.keys(tree);
    for (var k = 0; k < all.length; k++) if (!seen[all[k]]) rest.push(all[k]);
    deal('files', rest);
  }

  function coinFor(tree, id){
    var ns = tree === PV.silos ? 'silos' : tree === PV.poses ? 'poses' : 'files';
    var key = ns + ':' + id;
    if (COIN[key]) return COIN[key];
    if (!COIN_DEALT[ns]){
      COIN_DEALT[ns] = true;
      if (ns === 'files') dealEffects(tree);
      else deal(ns, Object.keys(tree));
    }
    return COIN[key] || 'man';
  }''')


# ---------------------------------------------------------------- 2
PLATE_ANCHOR = crlf('''    var who = SUBJECT;
    if (!who && tree === PV.silos) who = coinFor(id, Object.keys(tree));''')

PLATE_NEW = crlf('''    var who = SUBJECT;
    /* Was: silos only. The rooms were four and four and every room you
       opened was eight men, because the effect and pose trees fell
       through to f[0]. All three trees now, and the customer's own sitter
       still wins over all of it the moment a face is seen. */
    if (!who) who = coinFor(tree, id);''')


EDITS = [
    ('coin, dealt per room', COIN_ANCHOR,  COIN_NEW),
    ('plateFrom, all trees', PLATE_ANCHOR, PLATE_NEW),
]


def main():
    write = '--write' in sys.argv

    if not os.path.exists(TARGET):
        print('NOT FOUND: %s  (run from the repo root)' % TARGET)
        return 1

    with io.open(TARGET, 'r', encoding='utf-8', newline='') as fh:
        src = fh.read()

    braces_before = src.count('{') - src.count('}')

    fail = False
    for name, anchor, _ in EDITS:
        n = src.count(anchor)
        if n != 1:
            print('ANCHOR %-22s expected 1, found %d' % (name, n))
            fail = True
        else:
            print('anchor %-22s ok' % name)
    if fail:
        print('\nNothing written. An anchor has moved - read the live file.')
        return 1

    if 'COIN_DEALT' in src:
        print('\nAlready patched. Nothing to do.')
        return 0

    out = src
    for _, anchor, new in EDITS:
        out = out.replace(anchor, new, 1)

    braces_after = out.count('{') - out.count('}')
    if braces_before != braces_after:
        print('\nBRACE BALANCE CHANGED (%d -> %d). Nothing written.'
              % (braces_before, braces_after))
        return 1

    if '\n' in out.replace('\r\n', ''):
        print('\nBARE NEWLINE INTRODUCED. Nothing written.')
        return 1

    print('\n  coinFor call sites : %d' % out.count('coinFor('))
    print('  trees dealt        : %d' % out.count("COIN_DEALT[ns]"))
    print('  lines: %d -> %d' % (src.count('\r\n') + 1, out.count('\r\n') + 1))

    if not write:
        print('\nDRY RUN. Nothing written. Re-run with --write.')
        return 0

    with io.open(TARGET, 'w', encoding='utf-8', newline='') as fh:
        fh.write(out)
    print('\nWritten: %s' % TARGET)
    return 0


if __name__ == '__main__':
    sys.exit(main())
