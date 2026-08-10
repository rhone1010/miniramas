#!/usr/bin/env python3
# scripts/patch-concierge-workshop.py
#
# THE CONCIERGE, IN THE WORKSHOP.
#
# She was already loaded by the gallery and the help page and was not
# loaded here at all, so the one place a customer is actually trying to
# do something was the one place she could not be reached.
#
# Five edits to public/portraits.html:
#   1  the script tag, in DOCK mode - a panel in the corner, not a veil.
#      The workshop must stay usable while she is talking, because the
#      reason anybody asks a question here is that they are mid-task.
#   2  a light chat mark in the masthead's right cluster
#   3  the same, in the phone drawer
#   4  the CSS for it
#   5  a boot block: what she may point at, and what counts as progress
#
# Pure ASCII. CRLF-aware - every anchor is written with LF here and
# converted, because the file is CRLF throughout and a pattern with bare
# newlines matches nothing. Every anchor count is asserted before any
# write, so a moved anchor fails loudly rather than writing an unchanged
# file.
#
#   python scripts/patch-concierge-workshop.py            (dry run)
#   python scripts/patch-concierge-workshop.py --write

import io
import os
import sys

TARGET = os.path.join('public', 'portraits.html')


def crlf(s):
    return s.replace('\n', '\r\n')


# ---------------------------------------------------------------- 1
TRACK_ANCHOR = '<script src="/track.js" defer></script>'

TRACK_NEW = TRACK_ANCHOR + crlf('''
<!-- THE CONCIERGE. data-dock puts her in the corner rather than over the
     page: the workshop stays live underneath, so somebody can follow what
     she says while she is still saying it. data-attention lets her trigger
     pulse when a person is plainly moving around and getting nowhere. -->
<script src="/concierge.js" defer data-dock data-attention></script>''')


# ---------------------------------------------------------------- 2
MH_ANCHOR = crlf('''  <div class="mh-right">
    <button class="mh-credits" id="mhCreditsBtn" hidden>''')

MH_NEW = crlf('''  <div class="mh-right">
    <!-- The way to ask. Light rather than coffee-filled, so it reads as
         open rather than as another control to be operated. It is the
         element that pulses when somebody looks stuck, which is why the
         help lives on the thing that was always there rather than on a
         badge that appears at the bad moment. -->
    <button class="mh-ask" id="mhAskBtn" type="button" data-concierge
            aria-label="Ask the Concierge">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-4.6A8 8 0 0 1 13 4a8 8 0 0 1 8 8Z"/><path d="M8.6 11h6.8"/><path d="M8.6 14.4h4.2"/></svg>
    </button>
    <button class="mh-credits" id="mhCreditsBtn" hidden>''')


# ---------------------------------------------------------------- 3
DRAWER_ANCHOR = crlf('''    <a href="/account">Account</a>
    <a href="/help">Help</a>
  </nav>
</header>''')

DRAWER_NEW = crlf('''    <a href="/account">Account</a>
    <a href="/help">Help</a>
    <a href="#" data-concierge>Ask the Concierge</a>
  </nav>
</header>''')


# ---------------------------------------------------------------- 4
CSS_ANCHOR = ('.mh-menu svg{ width:20px; height:20px; stroke:currentColor; '
              'fill:none; stroke-width:1.6 }')

CSS_NEW = CSS_ANCHOR + crlf('''

/* ---- ASK · the Concierge's mark ---------------------------------------
   The one light-bodied control in the right cluster. Credits and cart are
   coffee-filled because they are the customer's own things; this is the
   studio offering something, so it reads as an opening rather than a
   button. Same 44px box as the menu, so the row keeps its rhythm.

   The pulse when somebody is stuck belongs to concierge.js and lands on
   this element as .cx-notice - it is not written here, so there is one
   place that decides when help is offered. */
.mh-ask{
  display:flex; align-items:center; justify-content:center;
  width:44px; height:44px; border-radius:var(--r-card);
  background:rgba(243,237,225,.10);
  border:1px solid rgba(243,237,225,.34);
  color:var(--vellum-100); cursor:pointer;
  transition:background .16s ease, border-color .16s ease, color .16s ease;
}
.mh-ask:hover{ background:rgba(243,237,225,.20); border-color:var(--gold); color:#fff }
.mh-ask svg{
  width:21px; height:21px; stroke:currentColor; fill:none; stroke-width:1.6;
  stroke-linecap:round; stroke-linejoin:round;
}
/* It shrinks with the pills beside it, and never below the 34px they
   settle at - a help control that becomes a speck is not a help control. */
@media (max-width:1400px){
  .mh-ask{ width:34px; height:34px }
  .mh-ask svg{ width:18px; height:18px }
}''')


# ---------------------------------------------------------------- 5
BOOT_ANCHOR = crlf('''</body>''')

BOOT_NEW = crlf('''<script>
/* ---- WHAT THE CONCIERGE MAY POINT AT, AND WHAT COUNTS AS PROGRESS ------
   concierge.js knows how to draw a ring over an element. It does not know
   what is on this page, and it must not guess - a ring around nothing, or
   around the wrong control, is worse than a plain answer.

   So the workshop publishes a list. When her answer contains one of these
   words AND the element is on the glass at that moment, the word becomes
   a quiet gold link and the control takes a ring. An element that is
   hidden, missing or zero-sized is skipped and the word stays plain, so
   she can never appear to gesture at a control this customer does not
   have - the Series switcher is not in the nav on a phone, the credits
   pill is not there before sign-in, and she stays honest about both.

   ORDER IS PRIORITY. Three links to an answer at most, taken from the
   top, so the specific things are listed above the general ones. */
window.CONCIERGE_POINTS = [
  { sel:'#curSlot',    phrases:['photograph','photo','upload','picture','image'] },
  { sel:'#curSeven',   phrases:['suggest seven','seven effects','suggest effects'] },
  { sel:'#tbc',        phrases:['To Be Crafted','the rail'] },
  { sel:'#tbcGo',      phrases:['Craft button','press Craft','Craft'] },
  { sel:'#mhCreditsBtn', phrases:['credits','credit','balance','buy more'] },
  { sel:'#mhCartBtn',  phrases:['cart','basket'] },
  { sel:'#mhSeriesBtn', phrases:['Series'] },
  { sel:'.mh-nav a[href="/collection"]', phrases:['My Collection','collection'] },
  { sel:'.mh-nav a[href="/print"]',      phrases:['Print Shop','printing','print'] },
  { sel:'.mh-nav a[href="/gallery"]',    phrases:['gallery'] },
  { sel:'.mh-nav a[href="/account"]',    phrases:['account'] },
  { sel:'#mhSignOut',  phrases:['sign out','signed out'] },
];

/* What she opens with, here. The generic three are about the company; in
   the workshop the questions people actually have are about this screen. */
window.CONCIERGE_SEEDS = [
  'How do I start?',
  'What makes a good photograph?',
  'How many credits does a craft cost?'
];

/* ---- PROGRESS IS MEASURED, NOT ASSUMED --------------------------------
   Her trigger pulses at somebody who is moving around the page and
   achieving nothing. That only works if "achieving something" is a real
   test, so this watches OUTCOMES rather than clicks: a photograph in
   hand, an effect on the rail, a room opened. A refused tile click is
   not progress, and neither is scrolling.

   Once anything real happens she never asks again in that session.
   Guidance that keeps coming back after it has been answered reads as a
   page that is not listening. */
(function(){
  function boot(){
    var done = false;
    function progress(){
      if (done) return;
      done = true;
      document.dispatchEvent(new Event('concierge:acted'));
    }
    if (!window.MutationObserver) return;

    /* A photograph landed. The Curator's own state is the truth here -
       it is what every other part of this page already reads. */
    var cur = document.getElementById('cur');
    if (cur){
      if (cur.dataset.state && cur.dataset.state !== 'empty') progress();
      new MutationObserver(function(){
        if (cur.dataset.state && cur.dataset.state !== 'empty') progress();
      }).observe(cur, { attributes:true, attributeFilter:['data-state'] });
    }

    /* Something is on the rail. The rail is the one record of what has
       been chosen; counting selected tiles would be a second record and
       the two would drift. */
    var list = document.getElementById('tbcList');
    if (list){
      if (list.children.length) progress();
      new MutationObserver(function(){
        if (list.children.length) progress();
      }).observe(list, { childList:true });
    }

    /* They got into a room. Browsing the catalogue is not nothing, even
       before a photograph - somebody reading the effects is not stuck. */
    var ws = document.getElementById('workshop');
    if (ws){
      new MutationObserver(function(){
        if (!ws.classList.contains('workshop-view--silos')) progress();
      }).observe(ws, { attributes:true, attributeFilter:['class'] });
    }
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();

/* The phone drawer closes behind her. Every other entry in it navigates
   away, so nothing ever had to close it; this one opens a panel over the
   same page and would otherwise leave the menu standing underneath. */
document.addEventListener('click', function(e){
  if (!e.target.closest('.mh-drawer [data-concierge]')) return;
  var dw = document.getElementById('mhDrawer');
  var mb = document.getElementById('mhMenuBtn');
  if (dw) dw.setAttribute('hidden','');
  if (mb) mb.setAttribute('aria-expanded','false');
});
</script>

</body>''')


EDITS = [
    ('script tag, dock mode', TRACK_ANCHOR, TRACK_NEW),
    ('masthead ask mark',     MH_ANCHOR,     MH_NEW),
    ('phone drawer entry',    DRAWER_ANCHOR, DRAWER_NEW),
    ('masthead ask styles',   CSS_ANCHOR,    CSS_NEW),
    ('points and progress',   BOOT_ANCHOR,   BOOT_NEW),
]


def main():
    write = '--write' in sys.argv

    if not os.path.exists(TARGET):
        print('NOT FOUND: %s  (run from the repo root)' % TARGET)
        return 1

    with io.open(TARGET, 'r', encoding='utf-8', newline='') as fh:
        src = fh.read()

    braces_before = src.count('{') - src.count('}')

    # Assert every anchor before touching anything. A patch that applies
    # four of five edits leaves the file in a state nobody designed.
    fail = False
    for name, anchor, _ in EDITS:
        n = src.count(anchor)
        if n != 1:
            print('ANCHOR %-24s expected 1, found %d' % (name, n))
            fail = True
        else:
            print('anchor %-24s ok' % name)
    if fail:
        print('\nNothing written. An anchor has moved - read the live file.')
        return 1

    if '/concierge.js' in src:
        print('\nAlready patched: concierge.js is loaded. Nothing to do.')
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

    print('\n  data-concierge triggers : %d' % out.count('data-concierge'))
    print('  CONCIERGE_POINTS entries: %d' % out.count("{ sel:'"))
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
