#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
patch-welcome-r1.py  -  CUI 41A  -  26 August 2026

THE WELCOME SCREEN. Rich's ruling 25 Aug: once per browser, one click
to dismiss, his copy verbatim, signed "Best, Rich" - the first surface
signed by Rich rather than the Curator. Replaces the gate as first
contact under the open-doors model.

One edit to index.html, right after <body>: the overlay markup, its
clothes, and a guard script. localStorage key liten_welcome_v1 - seen
once, never again on that browser. If storage is unavailable (private
mode), the screen shows and dismisses normally, it just cannot
remember - showing again beats never showing.

DRAFT for Rich: the button word ("Enter the studio").
"""
import os, sys, io

FILES = ["index.html"]

OLD = "</style></head><body>\n<div class=\"ground\"></div>"

NEW = """</style></head><body>
<!-- THE WELCOME - CUI 41A, 26 Aug 2026. Rich's copy verbatim, his
     ruling: once per browser, one click, then never again. -->
<div class="welcome" id="welcome" hidden>
  <div class="welcome-card">
    <h2 class="welcome-h">Welcome to Liten &amp; Co.</h2>
    <p class="welcome-open">We&rsquo;re officially open.</p>
    <p>Turn the people and pets you love into something wonderfully
    unexpected. Explore handcrafted transformations for portraits, pets,
    groups, and Halloween, each designed to turn an ordinary photo into a
    one-of-a-kind piece of impossible portraiture.</p>
    <p>A little grand-opening note: We&rsquo;re still fine-tuning a few
    corners of the site, though everything available for purchase is
    ready to go. Please send us anything you spot that could be better,
    and we&rsquo;d love to hear your ideas for new effects you&rsquo;d
    like to see.</p>
    <p>Enjoy creating.</p>
    <p class="welcome-sign">Best, Rich</p>
    <button class="welcome-go" id="welcomeGo" type="button">Enter the studio</button><!-- DRAFT word -->
  </div>
</div>
<style>
/* The welcome's clothes. Vellum card on a dimmed ground, serif voice. */
.welcome{
  position:fixed; inset:0; z-index:80;
  display:flex; align-items:center; justify-content:center;
  background:rgba(26,20,15,.55);
  padding:24px;
}
.welcome-card{
  background:#f3ede1; color:#2a241e;
  max-width:560px; max-height:86vh; overflow:auto;
  padding:clamp(28px,4vw,48px);
  border:1px solid rgba(125,66,66,.25); border-radius:8px;
  box-shadow:0 1.2rem 3rem rgba(20,14,9,.35);
  font-family:'Cormorant Garamond', Georgia, serif;
  font-size:22px; line-height:1.5;
}
.welcome-card p{ margin:0 0 1em }
.welcome-h{
  margin:0 0 .2em; font-weight:400;
  font-size:clamp(28px,3vw,38px); line-height:1.15;
}
.welcome-open{ font-style:italic; color:#7d4242 }
.welcome-sign{ font-style:italic }
.welcome-go{
  display:block; margin:1.4em auto 0;
  font-family:inherit; font-style:italic; font-size:22px;
  padding:.55rem 1.6rem; border-radius:999px;
  border:1px solid rgba(125,66,66,.55);
  background:#7d4242; color:#f3ede1; cursor:pointer;
}
.welcome-go:hover{ background:#6d3838 }
</style>
<script>
(function(){
  var KEY = 'liten_welcome_v1';
  var el = document.getElementById('welcome');
  var go = document.getElementById('welcomeGo');
  if (!el || !go) return;
  var seen = false;
  try { seen = !!localStorage.getItem(KEY); } catch(e){ /* private mode:
    show it; it just cannot remember. */ }
  if (seen) return;
  el.hidden = false;
  go.addEventListener('click', function(){
    el.hidden = true;
    try { localStorage.setItem(KEY, String(Date.now())); } catch(e){}
  });
})();
</script>
<div class="ground"></div>"""

MUST_APPEAR = ['id="welcome"', "liten_welcome_v1", "Best, Rich"]

def normalise(s): return s.replace("\r\n", "\n").replace("\r", "\n")

def run(src_dir, out_dir, apply):
    ok = True
    for name in FILES:
        src = os.path.join(src_dir, name)
        print("\n" + "="*66 + "\n" + name + "\n" + "="*66)
        if not os.path.isfile(src): print("  REFUSED: not found"); ok=False; continue
        text = normalise(io.open(src,"rb").read().decode("utf-8"))
        before = len(text)
        n = text.count(OLD)
        if n != 1:
            if 'id="welcome"' in text: print("  REFUSED: already applied")
            else: print("  REFUSED: anchor %d times" % n)
            ok=False; continue
        text = text.replace(OLD, NEW, 1)
        print("  ok   the welcome stands after <body>")
        halt = False
        for s in MUST_APPEAR:
            if s not in text: print("  REFUSED: missing -- %s" % s); halt=True
        if halt: ok=False; continue
        print("  %d -> %d (+%d)" % (before, len(text), len(text)-before))
        if apply:
            io.open(os.path.join(out_dir,name),"w",encoding="utf-8",newline="\n").write(text)
            print("  WROTE %s" % os.path.join(out_dir,name))
        else: print("  DRY RUN -- nothing written")
    print("\n" + ("All files clean." if ok else "ONE OR MORE FILES REFUSED."))
    return 0 if ok else 1

if __name__ == "__main__":
    apply = "--apply" in sys.argv
    home = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    here = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.dirname(here)
    out_dir = os.path.join(home,"Downloads"); src_dir = ""
    for a in sys.argv[1:]:
        if a.startswith("--src="): src_dir=a[6:]
        if a.startswith("--out="): out_dir=a[6:]
    if not src_dir: src_dir = os.path.join(repo,"public")
    if not os.path.isdir(src_dir): print("REFUSED: install to scripts\\ first."); sys.exit(1)
    print("\nreading  %s\nwriting  %s" % (src_dir, out_dir))
    sys.exit(run(src_dir, out_dir, apply))
