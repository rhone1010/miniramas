#!/usr/bin/env python3
"""
build_b5.py — WORKSHOP REFINEMENT (CSS only)
CUI V22 · 2026-07-27 · to Rich's directive of the same date

  in : public/portraits-b4.html
  out: public/portraits-b5.html

WHAT YOU WILL SEE
  Limestone ground with stronger radial gradients. A 3x2 grid that fills the
  main area and scales with it instead of a viewport subtraction. Cards with a
  bottom gradient instead of a brass plaque; the label sits on the artwork and
  the plus becomes a separate light disc. Curator panel rebalanced, with a
  large opening quote mark and a hairline under the header. Cycle hint gets a
  disc icon.

WHAT WILL STILL BE WRONG
  - Quality tiers still present. Cut list, not this pass.
  - Type scale unchanged. The directive says preserve typography; the size
    complaint is a separate pass and needs Rich's inspection numbers.
  - Curator's Pick NOT applied — the directive says badge-on-a-card, the mockup
    shows slot 6 as a bundle offer. Held for Rich's ruling.
  - Footer NOT added — needs markup, and its copy references a superseded
    preview flow. Held.
  - Seven silos absent by design.

METHOD
  Every rule is appended after the existing stylesheet so it wins collisions at
  equal specificity. Nothing is deleted from the original sheet — a later pass
  can remove what is now dead, but this build must be reversible by dropping
  one block.
"""
import re, sys, os

SRC = 'public/portraits-b4.html'
OUT = 'public/portraits-b5.html'

if not os.path.exists(SRC):
    sys.exit(f"FAIL — {SRC} not found. Run from the repo root.")
src = open(SRC, encoding='utf-8').read()

ids_of   = lambda t: re.findall(r'\bid\s*=\s*"([^"]+)"', t)
fetch_of = lambda t: len(re.findall(r'\bfetch\s*\(', t))
funcs_of = lambda t: len(re.findall(r'\bfunction\s+[A-Za-z0-9_$]+', t))
BASE = (set(ids_of(src)), fetch_of(src), funcs_of(src))
print(f"in  : {src.count(chr(10))+1} lines · {len(BASE[0])} ids · "
      f"{BASE[1]} fetch · {BASE[2]} functions")

OVERRIDES = r'''
/* ======================================================================== */
/* WORKSHOP REFINEMENT · build 5 · 2026-07-27                               */
/* Appended so these win collisions. Delete this block to revert.           */
/* ======================================================================== */

/* 1 · limestone ground ---------------------------------------------------- */
.workshop-background{
  position:relative; isolation:isolate;
  background-color:#f1ece3;
  background-image:
    radial-gradient(circle at 16% 8%,
      rgba(255,255,255,.82) 0%, rgba(255,255,255,.26) 24%, transparent 48%),
    radial-gradient(circle at 86% 24%,
      rgba(211,187,151,.20) 0%, transparent 43%),
    radial-gradient(ellipse at 50% 112%,
      rgba(92,66,40,.11) 0%, transparent 58%),
    linear-gradient(135deg, rgba(255,255,255,.20) 0%, rgba(221,208,189,.12) 42%,
      rgba(255,255,255,.09) 68%, rgba(191,166,130,.10) 100%),
    url("/textures/limestone.png");
  background-repeat:no-repeat,no-repeat,no-repeat,no-repeat,repeat;
  background-size:72% 72%,58% 66%,100% 58%,cover,2048px 2048px;
  background-position:top left,top right,bottom center,center,center;
}
.workshop-background::before{
  content:""; position:absolute; inset:0; z-index:-1; pointer-events:none;
  background-image:url("/textures/noise.png");
  background-repeat:repeat; background-size:15rem 15rem;
  opacity:.025; mix-blend-mode:multiply;
}
.workshop-background::after{
  content:""; position:absolute; inset:0; z-index:5; pointer-events:none;
  box-shadow:inset 0 0 7rem rgba(69,44,29,.045), inset 0 1px 0 rgba(255,255,255,.32);
}

/* 2 · stage containment --------------------------------------------------- */
.stage{
  display:flex; align-items:stretch; gap:0;
  height:calc(100vh - var(--mh-h)); min-width:0; overflow:hidden; position:relative;
}
.stage > .adv, .stage > .curator, .stage > .main, .stage > .colrail,
.main, .stagegrid, .scard{ min-width:0; }

/* 3 · main absorbs the remainder ------------------------------------------ */
.main{
  flex:1 1 auto; min-width:0; display:flex; position:relative;
  padding:clamp(.8rem,1vw,1.25rem) clamp(.75rem,.9vw,1.15rem);
}

/* 4 · grid fills main instead of subtracting from the viewport ------------- */
.stagegrid{
  position:relative; isolation:isolate; box-sizing:border-box;
  width:100%; height:100%; min-width:0; min-height:0;
  display:grid;
  grid-template-columns:repeat(3, minmax(0,1fr));
  grid-template-rows:repeat(2, minmax(0,1fr));
  gap:clamp(.75rem,1vw,1.5rem);
  padding:clamp(.7rem,1vw,1.25rem);
  margin:0;
}
.stagegrid::before{
  content:""; position:absolute; z-index:-1; inset:-2rem; pointer-events:none;
  background:radial-gradient(ellipse at 48% 32%, rgba(255,245,220,.22), transparent 62%);
  filter:blur(1rem);
}
@media (max-width:74rem){
  .stagegrid{
    grid-template-columns:repeat(2, minmax(0,1fr));
    grid-template-rows:none; grid-auto-rows:minmax(14rem,1fr); overflow-y:auto;
  }
}

/* 5 · card proportions ---------------------------------------------------- */
.scard{
  position:relative; isolation:isolate;
  width:100%; min-width:0; min-height:0; overflow:hidden; padding:0;
  border:1px solid rgba(107,82,54,.24);
  border-radius:clamp(.55rem,.55vw,.8rem);
  background:linear-gradient(145deg, rgba(246,239,227,.98), rgba(211,198,178,.95));
  box-shadow:0 .7rem 1.5rem rgba(52,36,25,.13),
             0 .15rem .4rem rgba(52,36,25,.08),
             inset 0 1px 0 rgba(255,255,255,.42);
  transition:transform 170ms ease, border-color 170ms ease, box-shadow 170ms ease;
}
.scard.pick:hover, .scard:not(.addall):hover{
  transform:translateY(-.15rem);
  border-color:rgba(159,119,61,.45);
  box-shadow:0 1rem 2rem rgba(52,36,25,.18),
             0 .25rem .65rem rgba(52,36,25,.09),
             inset 0 1px 0 rgba(255,255,255,.48);
}

/* 6 · artwork fill -------------------------------------------------------- */
.scard img{
  position:absolute; inset:0; width:100%; height:100%;
  object-fit:cover; object-position:center;
  opacity:0; transition:opacity 1200ms ease-in-out;
}
.scard img.show{ display:block; opacity:1; }

/* 7 · bottom gradient replaces the plaque --------------------------------- */
.scard:not(.addall)::after{
  content:""; position:absolute; inset:auto 0 0; height:42%;
  z-index:3; pointer-events:none;
  background:linear-gradient(180deg,
    rgba(19,13,9,0) 0%, rgba(19,13,9,.08) 24%,
    rgba(19,13,9,.34) 62%, rgba(19,13,9,.68) 100%);
}
.scard:not(.addall)::before{ z-index:2; }

/* 8 · label without plaque ------------------------------------------------ */
.scard .plabel{
  position:absolute; z-index:4;
  left:4.5%; right:3.8%; bottom:4.2%;
  display:flex; align-items:center; justify-content:space-between;
  min-height:0; gap:5%; padding:0;
  color:rgba(255,252,246,.98);
  background:transparent; border:0; border-radius:0; box-shadow:none;
  overflow:visible;
}
.scard .plabel::before{ display:none; }
.scard .pl-nm{
  position:relative; z-index:1; min-width:0; flex:1 1 auto;
  display:block; padding:0;
  overflow:hidden; white-space:nowrap; text-overflow:ellipsis;
  color:inherit;
  text-shadow:0 .08rem .15rem rgba(18,12,8,.76), 0 .25rem .7rem rgba(18,12,8,.42);
}

/* 9 · separate light plus ------------------------------------------------- */
.scard .pl-add{
  position:relative; z-index:5; flex:0 0 auto;
  display:grid; place-items:center;
  width:clamp(2rem,2.25vw,2.65rem); min-width:0; aspect-ratio:1; padding:0;
  color:var(--ink); font-family:var(--sans); line-height:1; font-weight:400;
  background:linear-gradient(145deg, rgba(255,255,255,.98), rgba(231,224,213,.96));
  border:1px solid rgba(73,54,35,.20); border-radius:50%;
  box-shadow:0 .35rem .9rem rgba(31,21,13,.24), inset 0 1px 0 rgba(255,255,255,.85);
  transition:transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
}
.scard .pl-add:hover{
  transform:translateY(-.08rem) scale(1.03); filter:none;
  background:linear-gradient(145deg, rgba(255,255,255,1), rgba(241,234,223,1));
  box-shadow:0 .5rem 1.1rem rgba(31,21,13,.28), inset 0 1px 0 rgba(255,255,255,.9);
}
.scard.pick.added .pl-add{ color:transparent; }
.scard.pick.added .pl-add::after{
  content:"\2713"; position:absolute; inset:0;
  display:grid; place-items:center; color:#2d1d0f;
}
.scard .pl-add:focus-visible{ outline:.15rem solid currentColor; outline-offset:.15rem; }

/* 10 · curator surface ---------------------------------------------------- */
.curator{
  width:clamp(20rem,19.5vw,25rem); flex:0 0 auto; align-self:stretch;
  margin:clamp(.8rem,1.1vw,1.4rem) 0 clamp(.8rem,1.1vw,1.4rem) clamp(.9rem,1.35vw,1.8rem);
  padding:clamp(1.15rem,1.35vw,1.7rem) clamp(1.1rem,1.25vw,1.55rem) clamp(1.25rem,1.55vw,1.9rem);
  overflow-y:auto; overflow-x:hidden;
  border-radius:clamp(.55rem,.55vw,.8rem);
  background:
    radial-gradient(circle at 28% 3%, rgba(255,255,255,.70), transparent 38%),
    linear-gradient(155deg, rgba(250,247,239,.95), rgba(229,218,201,.88));
  border:1px solid rgba(119,91,58,.18);
  box-shadow:0 1rem 2.3rem rgba(54,37,22,.10), inset 0 1px 0 rgba(255,255,255,.65);
}
.curator::before{
  background-image:url("/textures/noise.png");
  background-size:12rem 12rem; opacity:.035;
}

/* 11 · curator header and hairline ---------------------------------------- */
.cur-head{
  position:relative; display:flex; align-items:center; gap:4%;
  margin-bottom:0; padding-bottom:clamp(.9rem,1vw,1.2rem);
  border-bottom:1px solid rgba(123,92,58,.20);
}
.cur-head::after{
  content:""; position:absolute; left:10%; right:10%; bottom:0; height:1px;
  background:linear-gradient(90deg, transparent, rgba(181,138,72,.45), transparent);
  pointer-events:none;
}

/* 12 · invitation and the opening quote ----------------------------------- */
.inv-letter{
  position:relative;
  margin-top:clamp(1rem,1.2vw,1.45rem);
  padding:clamp(1.7rem,1.9vw,2.2rem) 4% 0 12%;
  background:transparent; border:0; border-radius:0; filter:none;
}
.inv-letter p{ max-width:30ch; margin-inline:auto; line-height:1.5; }
.inv-letter::before{
  content:"\201C"; position:absolute; top:-8%; left:0;
  font-family:inherit; font-size:5.75em; line-height:1;
  color:rgba(125,66,66,.15); pointer-events:none; user-select:none;
}

/* 13 · cycle button ------------------------------------------------------- */
.cyclebtn{
  margin-top:clamp(.8rem,1vw,1.2rem);
  border-radius:clamp(.45rem,.5vw,.7rem);
  padding:.55em 1.1em;
  box-shadow:0 .3rem .8rem rgba(71,32,37,.16), inset 0 1px 0 rgba(255,255,255,.12);
}

/* 14 · hint with disc icon ------------------------------------------------ */
.pickhint{
  position:relative; display:grid;
  grid-template-columns:clamp(2rem,2.25vw,2.5rem) minmax(0,1fr);
  gap:clamp(.6rem,.75vw,.85rem); align-items:center;
  margin-top:clamp(.7rem,.9vw,1rem);
  padding:clamp(.7rem,.85vw,.95rem);
  color:var(--brass);
  background:linear-gradient(145deg, rgba(255,253,248,.75), rgba(224,213,196,.58));
  border:1px solid rgba(125,66,66,.16);
  border-radius:clamp(.5rem,.55vw,.75rem);
  opacity:0; max-height:0; overflow:hidden;
}
.pickhint.show{ opacity:1; max-height:12rem; }
.pickhint::before{
  content:"\21BB"; display:grid; place-items:center;
  width:100%; aspect-ratio:1; border-radius:50%;
  color:var(--oxblood);
  background:linear-gradient(145deg, rgba(255,255,255,.96), rgba(231,222,207,.86));
  border:1px solid rgba(125,66,66,.18);
  box-shadow:0 .3rem .75rem rgba(54,37,22,.09);
  font-family:var(--sans); font-style:normal;
}

/* 16 · add-all radius and depth only -------------------------------------- */
.scard.addall{
  border-radius:clamp(.55rem,.55vw,.8rem);
  box-shadow:0 .7rem 1.5rem rgba(66,29,35,.15), inset 0 1px 0 rgba(255,255,255,.08);
}

/* 17 · collection rail ---------------------------------------------------- */
.colrail{
  flex:0 0 clamp(12rem,10.5vw,18rem); min-width:0;
  max-height:calc(100% - clamp(1.5rem,2vw,2.5rem));
  margin:clamp(.75rem,1vw,1.15rem) clamp(.75rem,1vw,1.15rem) clamp(.75rem,1vw,1.15rem) 0;
  overflow:hidden;
}

/* 18 · responsive panel widths -------------------------------------------- */
@media (max-width:100rem){
  .adv{ width:clamp(13rem,15vw,16rem); }
  .curator{ width:clamp(18rem,21vw,22rem); }
  .colrail{ flex-basis:clamp(11rem,12vw,14rem); }
  .main{ padding-inline:.7rem; }
}
@media (max-width:84rem){
  .adv.closed{ width:4.25rem; }
  .curator{ width:clamp(17rem,22vw,19rem); margin-left:.7rem; }
  .colrail{ flex-basis:11rem; }
}

/* 19 · reduced motion ----------------------------------------------------- */
@media (prefers-reduced-motion:reduce){
  .scard, .scard .pl-add, .cyclebtn, .scard.addall{ transition:none; }
  .scard:hover, .scard.pick:hover, .scard .pl-add:hover,
  .cyclebtn:hover, .scard.addall:hover{ transform:none; }
}
/* ===================== END WORKSHOP REFINEMENT ========================== */
'''

i = src.rfind('</style>')
if i < 0:
    sys.exit("FAIL — no </style> found")
out = src[:i] + OVERRIDES + src[i:]

# ══════════════════════════════ GATE ══════════════════════════════════════
fails = []
def check(c, m):
    if not c: fails.append(m)

check(fetch_of(out) == BASE[1], f"fetch {fetch_of(out)} != {BASE[1]}")
check(funcs_of(out) == BASE[2], f"functions {funcs_of(out)} != {BASE[2]}")
check(set(ids_of(out)) == BASE[0], "id set changed — this pass is CSS only")

# every selector the directive names must already exist in the file
for sel in ['.workshop-background','.stage','.adv','.curator','.cur-head','.c-mark',
            '.cur-title','.inv-letter','.cyclebtn','.pickhint','.main','.stagegrid',
            '.scard','.plabel','.pl-nm','.pl-add','.addall','.colrail']:
    check(src.count(sel) > 0, f"{sel} absent from input — directive assumed it exists")

# the fragile viewport subtraction must now be overridden
check('.stagegrid{' in out.replace(' ', ''), "stagegrid override missing")
check(out.count('grid-template-columns:repeat(3, minmax(0,1fr))') >= 1,
      "3-column grid rule missing")

# standing design gates
for m in re.finditer(r'([^\n{]{0,140})border-radius:\s*999px', OVERRIDES):
    ctx = m.group(1)
    d = re.search(r'(?:min-)?height:\s*(\d+)px', ctx)
    if d and int(d.group(1)) > 72:
        fails.append(f"999px on a {d.group(1)}px element")
for m in re.finditer(r'min-width:\s*(\d+)px', OVERRIDES):
    if int(m.group(1)) >= 1200:
        fails.append(f"new horizontal floor min-width:{m.group(1)}px")
check('font-family:var(--serif)' not in OVERRIDES.replace(' ', ''),
      "pass introduces a serif declaration — typography must be preserved")
check(not re.search(r'font-size:\s*[\d.]+rem', OVERRIDES),
      "pass introduces a rem font-size — typography must be preserved")
check(OVERRIDES.count('{') == OVERRIDES.count('}'),
      f"override braces {OVERRIDES.count('{')}/{OVERRIDES.count('}')}")

st = out[out.find('<style>'):out.rfind('</style>')]
check(st.count('{') == st.count('}'), f"style braces {st.count('{')}/{st.count('}')}")

# held items must NOT appear
check('curator-pick' not in OVERRIDES, "Curator's Pick applied — held for ruling")
check('workshop-footer' not in OVERRIDES, "footer applied — held for ruling")

if fails:
    print("\nGATE FAIL — nothing written")
    for f in fails: print("  -", f)
    sys.exit(1)

open(OUT, 'w', encoding='utf-8', newline='\n').write(out)
print(f"out : {out.count(chr(10))+1} lines · {len(set(ids_of(out)))} ids · "
      f"{fetch_of(out)} fetch · {funcs_of(out)} functions")
print(f"\nALL GATES PASS → {OUT}")
print("\nHELD, pending Rich: Curator's Pick treatment · the footer.")
print("REQUIRED ON DISK: public/textures/limestone.png")
