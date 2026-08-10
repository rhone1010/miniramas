#!/usr/bin/env python3
# scripts/patch-sitter-name-collision.py
#
# WHY THE FLOOR WAS EIGHT MEN.
#
# Two things in this file were called COIN and coinFor, in the same
# scope, about six hundred lines apart:
#
#   7632   var COIN = {};                  the sitter dealt to each card
#   7686   function coinFor(tree, id)
#
#  10540   var COIN = '/icons/acount/';    the Account panel's credit icons
#  10541   function coinFor(n)
#
# Function declarations hoist and the later one wins, so plateFrom's call
# to coinFor reached the ACCOUNT function and got back
# '/icons/acount/litenco_credit.png'. That is neither 'man' nor 'woman',
# so `want` fell empty and every card in every tree took f[0] - the man's
# plate. The original silo-only coin was dead the same way, which is why
# the floor was eight men on a page whose code deals four and four.
#
# One edit: the sitter side is renamed off the collision. The Account
# panel keeps COIN and coinFor - it is the one that has been working.
#
#   SITTER, SITTER_DEALT, dealSitters, dealEffectSitters, sitterFor
#
# Pure ASCII. CRLF-aware. Anchors asserted before any write.
#
#   python scripts/patch-sitter-name-collision.py            (dry run)
#   python scripts/patch-sitter-name-collision.py --write

import io
import os
import sys

TARGET = os.path.join('public', 'portraits.html')


def crlf(s):
    return s.replace('\n', '\r\n')


BLOCK_ANCHOR = crlf('''  var COIN = {};
  var COIN_DEALT = {};''')

BLOCK_NEW = crlf('''  /* NAMED SITTER, NOT COIN. Ruled 2026-08-10 after the floor came back
     eight men on a page that deals four and four. The Account panel
     three thousand lines below declares its own COIN and its own picker
     under the same two names, in this same scope; declarations hoist,
     the later one wins, and every call from here was reaching the
     credit-icon picker and getting a PNG path back. A PNG path is not
     'woman', so every card fell to the man's plate.

     Nothing here is namespaced by accident any more. If a name in this
     scope is not obviously about sitters, it is not ours. */
  var SITTER = {};
  var SITTER_DEALT = {};''')


CALLS = [
    ("if (!COIN[key]) COIN[key] = want[m];",
     "if (!SITTER[key]) SITTER[key] = want[m];"),

    ("  function deal(ns, list){",
     "  function dealSitters(ns, list){"),

    ("  function dealEffects(tree){",
     "  function dealEffectSitters(tree){"),

    ("      deal('files', list);",
     "      dealSitters('files', list);"),

    ("    deal('files', rest);",
     "    dealSitters('files', rest);"),

    ("  function coinFor(tree, id){",
     "  function sitterFor(tree, id){"),

    ("    if (COIN[key]) return COIN[key];",
     "    if (SITTER[key]) return SITTER[key];"),

    ("    if (!COIN_DEALT[ns]){\r\n      COIN_DEALT[ns] = true;\r\n"
     "      if (ns === 'files') dealEffects(tree);\r\n"
     "      else deal(ns, Object.keys(tree));",
     "    if (!SITTER_DEALT[ns]){\r\n      SITTER_DEALT[ns] = true;\r\n"
     "      if (ns === 'files') dealEffectSitters(tree);\r\n"
     "      else dealSitters(ns, Object.keys(tree));"),

    ("    return COIN[key] || 'man';",
     "    return SITTER[key] || 'man';"),

    ("    if (!who) who = coinFor(tree, id);",
     "    if (!who) who = sitterFor(tree, id);"),
]

EDITS = [('sitter block header', BLOCK_ANCHOR, BLOCK_NEW)] + \
        [('call %d' % (i + 1), a, b) for i, (a, b) in enumerate(CALLS)]


def main():
    write = '--write' in sys.argv

    if not os.path.exists(TARGET):
        print('NOT FOUND: %s  (run from the repo root)' % TARGET)
        return 1

    with io.open(TARGET, 'r', encoding='utf-8', newline='') as fh:
        src = fh.read()

    if 'SITTER_DEALT' in src:
        print('Already patched. Nothing to do.')
        return 0

    braces_before = src.count('{') - src.count('}')

    fail = False
    for name, anchor, _ in EDITS:
        n = src.count(anchor)
        if n != 1:
            print('ANCHOR %-20s expected 1, found %d' % (name, n))
            fail = True
    if fail:
        print('\nNothing written. An anchor has moved - read the live file.')
        return 1
    print('all %d anchors ok' % len(EDITS))

    out = src
    for _, anchor, new in EDITS:
        out = out.replace(anchor, new, 1)

    # THE POINT OF THE WHOLE PATCH: exactly one coinFor and one COIN left,
    # and they are the Account panel's.
    if out.count('function coinFor') != 1:
        print('\ncoinFor declared %d times. Nothing written.'
              % out.count('function coinFor'))
        return 1
    if out.count('var COIN ') != 1:
        print('\nCOIN declared %d times. Nothing written.'
              % out.count('var COIN '))
        return 1
    if out.count('function sitterFor') != 1:
        print('\nsitterFor not unique. Nothing written.')
        return 1

    braces_after = out.count('{') - out.count('}')
    if braces_before != braces_after:
        print('\nBRACE BALANCE CHANGED (%d -> %d). Nothing written.'
              % (braces_before, braces_after))
        return 1

    if '\n' in out.replace('\r\n', ''):
        print('\nBARE NEWLINE INTRODUCED. Nothing written.')
        return 1

    print('  function coinFor  : 1  (the Account panel, untouched)')
    print('  function sitterFor: 1')

    if not write:
        print('\nDRY RUN. Nothing written. Re-run with --write.')
        return 0

    with io.open(TARGET, 'w', encoding='utf-8', newline='') as fh:
        fh.write(out)
    print('\nWritten: %s' % TARGET)
    return 0


if __name__ == '__main__':
    sys.exit(main())
