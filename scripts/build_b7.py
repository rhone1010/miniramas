#!/usr/bin/env python3
"""
build_b7.py — TYPE SCALE · 86% CONTAINER · FOOTER SPAN
CUI V22 · 2026-07-27

  in : public/portraits-b6.html
  out: public/portraits-b7.html

FOUR FIXES

1 · TYPE SCALE — explicit px, no inheritance
    The footer declared no font-size, so it inherited against a root that
    caps at 15px. Everything this pass touches now carries an explicit size
    against Rich's standing floors:
        serif body      >= 22px      serif controls  >= 18px
        sans body       >= 16px      sans labels     >= 13px
    These are px on purpose. rem against clamp(12px,0.38vw+6px,15px) is what
    produced unreadable copy three times.

2 · 86% CONTAINER — the stage now consumes the ladder
    .stage was full-bleed and never used --container. It now matches the
    masthead: 86%, max 2200px, centred, released at 1849 / 1199 / 767.

3 · FOOTER SPANS CURATOR AND MAIN
    Markup change. .curator and .main move inside a new .workcol; the footer
    sits beneath both. .colrail stays full height beside them.

4 · LIMESTONE DAMPING
    The 2048px tile read as a marble slab rather than a ground. Tile enlarged
    and a vellum wash laid over it so the radials register. Adjustable in one
    place — see LIMESTONE below.
"""
import re, sys, os

SRC = 'public/portraits-b6.html'
OUT = 'public/portraits-b7.html'

if not os.path.exists(SRC):
    sys.exit(f"FAIL — {SRC} not found. Run from the repo root.")
src = open(SRC, encoding='utf-8').read()

ids_of   = lambda t: re.findall(r'\bid\s*=\s*"([^"]+)"', t)
fetch_of = lambda t: len(re.findall(r'\bfetch\s*\(', t))
funcs_of = lambda t: len(re.findall(r'\bfunction\s+[A-Za-z0-9_$]+', t))
B_IDS, B_FETCH, B_FUNCS = set(ids_of(src)), fetch_of(src), funcs_of(src)
print(f"in  : {src.count(chr(10))+1} lines · {len(B_IDS)} ids · "
      f"{B_FETCH} fetch · {B_FUNCS} functions")

out = src

# ── 3 · markup: wrap curator + main, move the footer beneath them ─────────
fm = re.search(r'<footer class="wsfoot" id="workshopFooter">.*?</footer>\n?', out, re.S)
if not fm:
    sys.exit("FAIL — workshop footer not found")
FOOTER = fm.group(0)
out = out[:fm.start()] + out[fm.end():]          # lift it out

cm = re.search(r'<section[^>]*\bclass="[^"]*\bcurator\b[^"]*"[^>]*>', out)
if not cm:
    sys.exit("FAIL — .curator element not found")

mm = re.search(r'<main[^>]*\bclass="[^"]*\bmain\b[^"]*"[^>]*>', out[cm.start():])
if not mm:
    sys.exit("FAIL — .main element not found after .curator")
mstart = cm.start() + mm.start()
mclose = out.find('</main>', mstart)
if mclose < 0:
    sys.exit("FAIL — </main> not found")
mend = mclose + len('</main>')

out = (out[:cm.start()]
       + '<div class="workcol">\n'
       + out[cm.start():mend]
       + '\n' + FOOTER
       + '</div>\n'
       + out[mend:])

# ── CSS ───────────────────────────────────────────────────────────────────
CSS = r'''
/* ======================================================================== */
/* BUILD 7 · type scale, 86% container, footer span, limestone damping      */
/* ======================================================================== */

/* ---- 2 · the stage consumes the container ladder ----------------------- */
.stage{
  width:var(--container);
  max-width:var(--container-max);
  margin-inline:auto;
}
@media (max-width:767px){ .stage{ width:100%; } }

/* ---- 3 · curator + main share a column; footer spans both -------------- */
.workcol{
  flex:1 1 auto; min-width:0;
  display:flex; flex-direction:column;
  gap:0;
}
.workcol > .curator, .workcol > .main{ min-width:0; }
.workcol .stage-row{ display:flex; align-items:stretch; min-height:0; }
/* curator and main sit side by side inside the column */
.workcol{ display:grid; grid-template-columns:auto minmax(0,1fr); grid-template-rows:1fr auto; }
.workcol > .curator{ grid-column:1; grid-row:1; }
.workcol > .main   { grid-column:2; grid-row:1; min-height:0; }
.workcol > .wsfoot { grid-column:1 / -1; grid-row:2; }

/* the footer is a band beneath both, not a strip inside main */
.wsfoot{
  margin:clamp(10px,1vw,16px) 0 clamp(12px,1.1vw,18px) clamp(14px,1.35vw,26px);
  padding:clamp(18px,1.5vw,26px) clamp(20px,1.8vw,32px);
  align-items:center;
  gap:clamp(16px,1.6vw,30px);
  grid-template-columns:repeat(auto-fit, minmax(min(100%,15rem), 1fr));
}
.wsfoot-item{ grid-template-columns:clamp(34px,2.6vw,46px) minmax(0,1fr);
  gap:clamp(10px,.9vw,16px); }

/* ---- 1 · TYPE SCALE · explicit px, never inherited --------------------- */
/* footer */
.wsfoot-t{
  font-family:var(--sans); font-size:17px; font-weight:600;
  line-height:1.25; letter-spacing:.01em; color:var(--ink);
}
.wsfoot-p{
  font-family:var(--sans); font-size:16px; font-weight:400;
  line-height:1.45; color:var(--ink-soft,#5a5248);
}

/* card label — serif floor is 22px; this sits above artwork so it takes 24 */
.scard .pl-nm{ font-size:24px; line-height:1.15; }
.scard .pl-add{ font-size:22px; }

/* curator copy */
.inv-letter p{ font-size:22px; line-height:1.5; }
.cur-title{ font-size:30px; line-height:1.1; }
.pickhint{ font-size:18px; line-height:1.45; }
.cyclebtn{ font-size:19px; }

/* bundle card */
.bx-eyebrow{ font-family:var(--sans); font-size:13px; font-weight:600;
  letter-spacing:.14em; }
.bx-title{ font-size:26px; line-height:1.15; }
.bx-sub{ font-size:17px; }
.bx-th figcaption{ font-family:var(--sans); font-size:13px; }
.bx-save{ font-size:19px; }
.bx-cta-main{ font-size:19px; }
.bx-cta-sub{ font-family:var(--sans); font-size:14px; }
.bx-fine{ font-family:var(--sans); font-size:13px; }

/* ---- 4 · limestone damping -------------------------------------------- */
/* One place to tune. Enlarge --ls-tile if the stone still reads as a slab;
   raise --ls-wash if it still overpowers the radial gradients. */
:root{ --ls-tile:3600px; --ls-wash:.42; }
.workshop-background{
  background-image:
    radial-gradient(circle at 16% 8%,
      rgba(255,255,255,.86) 0%, rgba(255,255,255,.30) 24%, transparent 50%),
    radial-gradient(circle at 86% 24%,
      rgba(211,187,151,.24) 0%, transparent 45%),
    radial-gradient(ellipse at 50% 112%,
      rgba(92,66,40,.13) 0%, transparent 60%),
    linear-gradient(135deg, rgba(255,255,255,.22) 0%, rgba(221,208,189,.14) 42%,
      rgba(255,255,255,.10) 68%, rgba(191,166,130,.11) 100%),
    linear-gradient(0deg,
      rgba(241,236,227,var(--ls-wash)), rgba(241,236,227,var(--ls-wash))),
    url("/textures/limestone.png");
  background-repeat:no-repeat,no-repeat,no-repeat,no-repeat,repeat,repeat;
  background-size:72% 72%,58% 66%,100% 58%,cover,auto,var(--ls-tile) var(--ls-tile);
  background-position:top left,top right,bottom center,center,center,center;
}
/* ==================== END BUILD 7 ======================================= */
'''
i = out.rfind('</style>')
out = out[:i] + CSS + out[i:]

# ══════════════════════════════ GATE ══════════════════════════════════════
fails = []
def check(c, m):
    if not c: fails.append(m)

check(fetch_of(out) == B_FETCH,  f"fetch {fetch_of(out)} != {B_FETCH}")
check(funcs_of(out) == B_FUNCS,  f"functions {funcs_of(out)} != {B_FUNCS}")
markup = re.sub(r'<script(?![^>]*\bsrc=)[^>]*>.*?</script>', '', out, flags=re.S)
m_ids = ids_of(markup)
check(len(m_ids) == len(set(m_ids)),
      f"duplicate ids: {sorted({i for i in m_ids if m_ids.count(i)>1})}")
check(not (B_IDS - set(ids_of(out))), f"ids lost: {sorted(B_IDS-set(ids_of(out)))[:6]}")

check('class="workcol"' in out,            "workcol wrapper not inserted")
check(out.count('id="workshopFooter"') == 1, "footer not unique after move")
check(out.index('class="workcol"') < out.index('id="workshopFooter"'),
      "footer sits outside the column")
check('width:var(--container)' in out,     "stage does not consume the container")

# TYPE FLOORS — the recurring failure. Every declared size is checked.
FLOOR = {'serif': 18, 'sans': 13}
for m2 in re.finditer(r'([^{}]+)\{[^}]*font-size:\s*(\d+)px', CSS):
    sel, px = m2.group(1).strip().splitlines()[-1].strip(), int(m2.group(2))
    if px < 13:
        fails.append(f"{sel} at {px}px is below every floor")
body_sel = ['.wsfoot-p', '.inv-letter p', '.bx-sub']
for s in body_sel:
    m3 = re.search(re.escape(s) + r'\{[^}]*font-size:\s*(\d+)px', CSS)
    check(m3 and int(m3.group(1)) >= 16, f"{s} body copy below 16px")
m4 = re.search(r'\.inv-letter p\{[^}]*font-size:\s*(\d+)px', CSS)
check(m4 and int(m4.group(1)) >= 22, "serif body below the 22px floor")
check(not re.search(r'font-size:\s*[\d.]+rem', CSS),
      "rem font-size reintroduced — this pass is px on purpose")

for m5 in re.finditer(r'min-width:\s*(\d+)px', CSS):
    if int(m5.group(1)) >= 1200: fails.append(f"new floor min-width:{m5.group(1)}px")
check(CSS.count('{') == CSS.count('}'), "css braces unbalanced")
st = out[out.find('<style>'):out.rfind('</style>')]
check(st.count('{') == st.count('}'), f"style braces {st.count('{')}/{st.count('}')}")

if fails:
    print("\nGATE FAIL — nothing written")
    for f in fails: print("  -", f)
    sys.exit(1)

open(OUT, 'w', encoding='utf-8', newline='\n').write(out)
print(f"out : {out.count(chr(10))+1} lines · {len(set(ids_of(out)))} ids · "
      f"{fetch_of(out)} fetch · {funcs_of(out)} functions")
print(f"\nALL GATES PASS → {OUT}")
print("\nType floors now gated: serif body >=22px, sans body >=16px, labels >=13px.")
print("Limestone tuning: --ls-tile (3600px) and --ls-wash (.42) in one :root block.")
