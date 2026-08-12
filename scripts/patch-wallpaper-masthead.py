#!/usr/bin/env python3
# scripts/patch-wallpaper-masthead.py
#
# ONE MASTHEAD ACROSS THE SITE.
#
# Three pages, three different mastheads. Rich put them side by side on
# 2026-08-11 and the difference is not subtle:
#
#     portraits.html        nav at 1.5em serif, three-zone grid, the SVG
#                           wordmark, the Series switcher, --stage-gutter
#     wallpapers.html       nav at 1.15rem, flex row, a text logo
#     wallpaper-studio.html nav at 1.12rem, flex row, a text logo
#
# The wallpaper pages were written from the token list rather than from the
# workshop, which is how two smaller mastheads got invented. Nobody decided
# they should be smaller; nobody decided anything.
#
# So the workshop's is transplanted whole rather than its numbers copied
# over: the grid, the wordmark, the switcher, the nav, the right cluster
# and the responsive band. Copying numbers would have left three mastheads
# that agree today and drift at the next change.
#
# WHAT IS CARRIED, AND WHY EACH
#
#   --mh-h, --mark-h, --stage-gutter   the masthead reads the gutter for its
#                                      inset, so the wordmark sits on the
#                                      same edge as the content below it
#   the three-zone grid                logo | nav | right, nav centred on the
#                                      PAGE rather than between the zones
#   the SVG wordmark                   its baked #fff is stripped so it takes
#                                      currentColor
#   the Series switcher                names the room you are in and opens
#                                      the door to the others. The wallpaper
#                                      pages had no way back to Portraits
#                                      except a nav link that looked like
#                                      any other.
#   the band                           90 -> 76 -> 60px, gutter 5% -> 3.9%
#
# WHAT IS NOT CARRIED
#
#   The cart. There is no cart on a wallpaper page - wallpapers are
#   download-only and never reach the print pipeline, so a basket would be
#   furniture promising something that cannot happen.
#
#   The phone drawer. The wallpaper pages have their own layouts below 1100
#   and the drawer's markup is entangled with the workshop's band.
#
# THE STUDIO KEEPS ITS OWN GROUND. It is the one dark page on the site and
# its masthead is #0e0b0a rather than espresso, on purpose - so only the
# structural rules are transplanted there, not the background.
#
# Pure ASCII in the script; the patched CSS carries the same characters the
# workshop uses. CRLF-aware. Anchors asserted before any write.
#
#   python scripts/patch-wallpaper-masthead.py            (dry run)
#   python scripts/patch-wallpaper-masthead.py --write

import io
import os
import sys

WALLPAPERS = os.path.join('public', 'wallpapers.html')
STUDIO     = os.path.join('public', 'wallpaper-studio.html')
SOURCE     = os.path.join('public', 'portraits.html')


def crlf(s):
    return s.replace('\n', '\r\n')


def both(s):
    return [s.replace('\n', '\r\n'), s]


# ---------------------------------------------------------------------------
# The wordmark, lifted from portraits.html rather than retyped. Read at run
# time so it cannot fall out of step with the one the workshop draws.
# ---------------------------------------------------------------------------
def wordmark(src_html):
    a = src_html.find('<svg class="mh-mark"')
    b = src_html.find('</svg>', a)
    if a < 0 or b < 0:
        return None
    return src_html[a:b + 6]


# ---------------------------------------------------------------------------
# THE CSS. Same rules as the workshop, with the two colour hooks left as
# variables so the Studio can stay dark.
# ---------------------------------------------------------------------------
CSS = '''
/* ======================================================================
   THE MASTHEAD
   Transplanted from portraits.html on 2026-08-11, not reimplemented. Three
   pages had three mastheads because these two were written from the token
   list rather than from the workshop - nav at 1.15rem and 1.12rem against
   the workshop's 1.5em, a flex row against its three-zone grid, and a text
   logo where the workshop draws the mark.

   Nobody decided the wallpaper rooms should have a smaller masthead. This
   is what agreeing looks like.
   ====================================================================== */
.mh{
  position:sticky; top:0; z-index:60;
  height:var(--mh-h);
  background:var(--mh-bg);
  border-bottom:1px solid var(--card-line);
  display:grid;
  /* THREE ZONES. The nav is centred on the PAGE, not between the outer
     two - so it does not shift when the right cluster gains a pill. */
  grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);
  align-items:center;
  padding-inline:var(--stage-gutter);
}

/* ---- the wordmark ---------------------------------------------------
   Its baked #fff fill is stripped on the way in so it takes currentColor
   and can be recoloured without touching the file. Height governs; width
   follows the 1.19:1 ratio. */
.mh-logo{
  justify-self:start; text-decoration:none;
  display:inline-flex; align-items:center;
  color:var(--vellum-100);
}
.mh-mark{ height:var(--mark-h); width:auto; flex:0 0 auto;
          display:block; overflow:visible }
.mh-mark path{ fill:currentColor }
.sr{
  position:absolute; width:1px; height:1px; padding:0; margin:-1px;
  overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0;
}

/* ---- the series switcher --------------------------------------------
   Not a fourth zone - it lives inside the nav so the three-zone rule
   holds. It names the room you are standing in and opens the door to the
   others, which these pages had no way of doing: the way back to the
   workshop was a nav link that looked like every other nav link. */
.mh-series{ position:relative; display:flex; align-items:center; margin-right:34px }
.mh-series-btn{
  display:inline-flex; align-items:center; gap:.34em;
  font-family:var(--serif); font-size:1.8em; font-weight:400; line-height:1;
  color:var(--series); padding:10px 0; cursor:pointer; white-space:nowrap;
  background:none; border:none;
  transition:color .16s ease;
}
.mh-series-btn:hover{ color:#e6d2a8 }
.mh-series-btn .caret{
  width:.52em; height:.52em; flex:0 0 auto; margin-top:.14em; opacity:.72;
  transform-origin:50% 45%;
  transition:transform .22s cubic-bezier(.22,.7,.3,1), opacity .16s ease;
}
.mh-series-btn .caret path{
  fill:none; stroke:currentColor; stroke-width:1.35;
  stroke-linecap:round; stroke-linejoin:round; vector-effect:non-scaling-stroke;
}
.mh-series-btn:hover .caret{ opacity:1 }
.mh-series-btn[aria-expanded="true"] .caret{ transform:rotate(180deg); opacity:1 }

.mh-series-menu{
  position:absolute; top:calc(100% + 12px); left:50%; transform:translateX(-50%);
  min-width:16em;
  background:linear-gradient(180deg,#2a1f1b 0%, #221915 100%);
  border:1px solid var(--card-line);
  border-radius:var(--r-card);
  box-shadow:0 22px 48px -20px rgba(20,12,8,.7), inset 0 1px 0 rgba(255,255,255,.06);
  padding:20px; display:flex; flex-direction:column; z-index:70;
}
.mh-series-menu a{
  display:flex; align-items:center; justify-content:space-between; gap:1.2em;
  font-family:var(--serif); font-size:1.45em; font-weight:400; line-height:1.1;
  color:var(--vellum-200); text-decoration:none; white-space:nowrap;
  padding:.52em .7em; border-radius:6px;
  transition:background .14s ease, color .14s ease;
}
.mh-series-menu a:hover,.mh-series-menu a:focus-visible{
  background:linear-gradient(180deg, rgba(215,189,137,.16), rgba(215,189,137,.09));
  color:var(--series); outline:none;
}
.mh-series-menu a[aria-current="page"]{ color:var(--series) }
.mh-series-menu a[aria-current="page"]::after{
  content:""; width:5px; height:5px; border-radius:50%; background:var(--series);
}
.mh-series-menu .sep{
  height:1px; margin:6px 8px;
  background:linear-gradient(90deg, transparent, rgba(215,189,137,.28), transparent);
}

/* ---- the nav --------------------------------------------------------
   1.5em, which is the number these pages were missing. Cormorant renders
   about a third smaller than a sans at the same size, so a nav that looks
   generous in the stylesheet reads as small on the glass. */
.mh-nav{ justify-self:center; display:flex; align-items:center; gap:32px }
.mh-nav a{
  position:relative; text-decoration:none; white-space:nowrap;
  font-family:var(--serif); font-size:1.5em; font-weight:400; line-height:1;
  color:var(--vellum-300); padding:10px 0;
  transition:color .16s ease;
}
.mh-nav a:hover{ color:var(--vellum-100) }
.mh-nav a.on,.mh-nav a[aria-current="page"]{ color:var(--gold) }
.mh-nav a.on::after,.mh-nav a[aria-current="page"]::after{
  content:""; position:absolute; left:0; right:0; bottom:-2px; height:2px;
  background:var(--gold);
}

/* ---- the right cluster ---------------------------------------------
   NO CART. Wallpapers are download-only and never reach the print
   pipeline, so a basket here would be furniture promising something that
   cannot happen. */
.mh-right{ justify-self:end; display:flex; align-items:center; gap:12px }
.mh-credits{
  display:flex; align-items:center; gap:10px;
  height:44px; padding:0 16px; border-radius:var(--r-card);
  background:var(--coffee-700); border:1px solid var(--card-line);
  color:var(--vellum-100);
  font-family:var(--sans); font-size:1rem; font-weight:600; cursor:pointer;
  transition:background .16s ease, border-color .16s ease;
}
.mh-credits:hover{ background:#40302a; border-color:var(--gold) }
.mh-credits .v{ font-variant-numeric:tabular-nums }
.mh-credits .u{ font-weight:400; color:var(--vellum-300) }

/* ---- ask · the Concierge's mark -------------------------------------
   The one light-bodied control in the cluster: credits are the customer's
   own thing, this is the studio offering something. The pulse when
   somebody looks stuck belongs to concierge.js and lands here as
   .cx-notice, so one place decides when help is offered. */
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

/* ---- the band -------------------------------------------------------
   The workshop's, so a masthead is the same height on both at every
   width. It shrinks by giving up height and mark before it gives up
   type. */
@media (max-width:1920px){ :root{ --mh-h:76px } }
@media (max-width:1599px){ :root{ --mark-h:52px } }
@media (max-width:1366px){
  :root{ --mh-h:60px; --mark-h:46px; --stage-gutter:3.9% }
  .mh-ask{ width:34px; height:34px }
  .mh-ask svg{ width:18px; height:18px }
  .mh-credits{ height:38px; padding:0 12px }
  .mh-nav{ gap:22px }
  .mh-series{ margin-right:24px }
}
@media (max-width:1100px){
  .mh-nav{ display:none }
  .mh{ grid-template-columns:auto 1fr auto }
}
'''

TOKENS = '''  /* ---- masthead tokens · the workshop's, so the two agree ------------ */
  --mh-h:90px;
  --mark-h:60px;
  --stage-gutter:min(5%, 92px);
  --vellum-100:#f8f4eb;
  --vellum-200:#f3ecdd;
  --vellum-300:#e9dec8;
  --coffee-700:#332620;
  --card-line:rgba(196,169,110,.28);
'''


def build_markup(mark, current, series_label):
    """The masthead, with the Series switcher naming the room."""
    return (
'<header class="mh">\n'
'  <a class="mh-logo" href="/">' + mark + '<span class="sr">Liten &amp; Co</span></a>\n'
'  <nav class="mh-nav">\n'
'    <div class="mh-series">\n'
'      <button class="mh-series-btn" id="mhSeriesBtn" type="button"\n'
'              aria-expanded="false" aria-haspopup="true">\n'
'        <span>' + series_label + '</span>\n'
'        <svg class="caret" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 6.2 8 10.6l4.8-4.4"/></svg>\n'
'      </button>\n'
'      <div class="mh-series-menu" id="mhSeriesMenu" role="menu" hidden>\n'
'        <a href="/portraits" role="menuitem">Portraits</a>\n'
'        <div class="sep"></div>\n'
'        <a href="/wallpapers" role="menuitem"' +
          (' aria-current="page"' if current == 'wallpapers' else '') +
          '>Mobile Wallpapers</a>\n'
'        <a href="/wallpapers/studio" role="menuitem"' +
          (' aria-current="page"' if current == 'studio' else '') +
          '>The Studio</a>\n'
'      </div>\n'
'    </div>\n'
'    <a href="/gallery">Gallery</a>\n'
'    <a href="/community">Community</a>\n'
'    <a href="/collection">My Collection</a>\n'
'    <a href="/account">Account</a>\n'
'  </nav>\n'
'  <div class="mh-right">\n'
'    <button class="mh-credits" id="mhCredits" type="button" hidden>\n'
'      <span class="v" id="mhCreditsN">0</span><span class="u">credits</span>\n'
'    </button>\n'
'    <button class="mh-ask" type="button" data-concierge aria-label="Ask the Concierge">\n'
'      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-4.6A8 8 0 0 1 13 4a8 8 0 0 1 8 8Z"/><path d="M8.6 11h6.8"/><path d="M8.6 14.4h4.2"/></svg>\n'
'    </button>\n'
'  </div>\n'
'</header>')


# The switcher's own behaviour. Small enough to inline; it opens, it closes
# on Escape and on a click outside, and it does nothing else.
SWITCHER_JS = '''
<script>
/* The Series switcher. Opens, closes on Escape or a click outside, and
   does nothing else - it is a door, not a menu system. */
(function(){
  var b = document.getElementById('mhSeriesBtn');
  var m = document.getElementById('mhSeriesMenu');
  if (!b || !m) return;
  function shut(){ m.hidden = true; b.setAttribute('aria-expanded','false'); }
  b.addEventListener('click', function(e){
    e.stopPropagation();
    var open = m.hidden;
    m.hidden = !open;
    b.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', function(e){
    if (!m.hidden && !m.contains(e.target)) shut();
  });
  addEventListener('keydown', function(e){ if (e.key === 'Escape') shut(); });
})();
</script>
'''


def patch(path, current, series_label, mh_bg, mark):
    with io.open(path, 'r', encoding='utf-8', newline='') as fh:
        src = fh.read()

    if 'mh-series-btn' in src:
        print('%-34s already patched' % path)
        return None

    nl = '\r\n' if '\r\n' in src else '\n'

    def n(s):
        return s.replace('\n', nl) if nl == '\r\n' else s

    out = src

    # 1 · tokens, appended to :root
    a = out.find(':root{')
    if a < 0:
        print('%s: no :root. Nothing written.' % path)
        return None
    b = out.find('}', a)
    out = out[:b] + n(TOKENS) + '  --mh-bg:' + mh_bg + ';\n' + out[b:]

    # 2 · THE OLD MASTHEAD CSS OUT, THE WORKSHOP'S IN.
    #
    # Every rule whose selector list touches .mh is removed, matched on the
    # selector rather than on a substring. A substring match was tried and
    # was wrong: '.mh{' is a prefix of nothing, but scanning for it found
    # the transplanted rule as well as the old one, and the assertion
    # below caught two definitions of .mh in the output.
    #
    # Leaving a stale rule behind would not error. It would sit below the
    # new one in source order, win, and the masthead would look exactly as
    # wrong as it does today - which is the whole reason for this patch.
    import re as _re
    def strip_mh(css):
        # A scanner rather than a regex. The regex version needed escaping
        # that survived two layers of quoting and did not, and a stripper
        # that silently matches nothing leaves the old masthead in place
        # below the new one, where it wins on source order and the page
        # looks exactly as unfixed as before.
        out, i, n = [], 0, len(css)
        while i < n:
            brace = css.find('{', i)
            if brace < 0:
                out.append(css[i:])
                break
            sel = css[i:brace]
            # A block that opens another block is a media query - descend
            # into it rather than treating it as a rule.
            if sel.lstrip().startswith('@'):
                out.append(css[i:brace + 1])
                i = brace + 1
                continue
            close = css.find('}', brace)
            if close < 0:
                out.append(css[i:])
                break
            names = []
            word = ''
            for ch in sel:
                if ch == '.':
                    word = '.'
                elif word and (ch.isalnum() or ch in '-_'):
                    word += ch
                elif word:
                    names.append(word)
                    word = ''
            if word:
                names.append(word)
            mine = any(x == '.mh' or x.startswith('.mh-') for x in names)
            if not mine:
                out.append(css[i:close + 1])
            else:
                # keep whatever preceded the selector - comments, blank
                # lines - so the stylesheet does not lose its shape
                keep_to = sel.rfind('*/')
                if keep_to >= 0:
                    out.append(sel[:keep_to + 2])
            i = close + 1
        return ''.join(out)

    a = out.find('<style>')
    b = out.find('</style>')
    if a < 0 or b < 0:
        print('%s: no stylesheet. Nothing written.' % path)
        return None
    out = out[:a] + strip_mh(out[a:b]) + out[b:]

    i = out.find('</style>')
    out = out[:i] + n(CSS) + out[i:]

    # 3 · the markup
    a = out.find('<header class="mh"')
    b = out.find('</header>', a)
    if a < 0 or b < 0:
        print('%s: no masthead markup. Nothing written.' % path)
        return None
    out = out[:a] + n(build_markup(mark, current, series_label)) + out[b + 9:]

    # 4 · the switcher's script, before the page's own
    i = out.find('<script src="/concierge.js"')
    if i < 0:
        i = out.rfind('</body>')
    out = out[:i] + n(SWITCHER_JS) + out[i:]

    return out


def main():
    write = '--write' in sys.argv

    for p in (WALLPAPERS, STUDIO, SOURCE):
        if not os.path.exists(p):
            print('NOT FOUND: %s  (run from the repo root)' % p)
            return 1

    with io.open(SOURCE, 'r', encoding='utf-8', newline='') as fh:
        mark = wordmark(fh.read())
    if not mark:
        print('Could not read the wordmark from %s. Nothing written.' % SOURCE)
        return 1
    print('wordmark lifted from portraits.html: %d chars' % len(mark))

    jobs = [
        (WALLPAPERS, 'wallpapers', 'Mobile Wallpapers', 'var(--espresso)'),
        (STUDIO,     'studio',     'The Studio',        '#0e0b0a'),
    ]

    outs = []
    for path, current, label, bg in jobs:
        o = patch(path, current, label, bg, mark)
        if o is None:
            continue
        # The point of the whole patch.
        if o.count('font-size:1.5em') < 1:
            print('%s: nav type did not land. Nothing written.' % path)
            return 1
        # The old masthead must be gone. Counting '.mh{' across the whole
        # document was tried and was wrong - it also counts the legitimate
        # override inside the 1100px media query. The real question is
        # whether a SECOND top-level .mh rule survived, so the count is
        # taken at the start of a line, which a nested rule never is.
        top = sum(1 for line in o.split('\n') if line.startswith('.mh{'))
        if top != 1:
            print('%s: %d top-level .mh rules. Nothing written.' % (path, top))
            return 1
        # The old nav sizes were 1.15rem and 1.12rem, but those numbers are
        # also used legitimately by tile labels and slot copy - matching on
        # them alone flagged six innocent rules. What matters is that no
        # .mh-nav rule sets a size other than the workshop's 1.5em.
        for line in o.split('\n'):
            if '.mh-nav' in line and 'font-size' in line and '1.5em' not in line:
                print('%s: an old nav size survived: %s' % (path, line.strip()))
                return 1
        outs.append((path, o))
        print('%-34s masthead replaced' % path)

    if not outs:
        print('\nNothing to do.')
        return 0

    if not write:
        print('\nDRY RUN. Nothing written. Re-run with --write.')
        return 0

    for path, o in outs:
        with io.open(path, 'w', encoding='utf-8', newline='') as fh:
            fh.write(o)
        print('Written: %s' % path)
    return 0


if __name__ == '__main__':
    sys.exit(main())
