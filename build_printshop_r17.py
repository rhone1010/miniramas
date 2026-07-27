import re, sys, subprocess

SRC = '/mnt/user-data/outputs/litenco-printshop-2026-07-24-r16.html'
OUT = '/mnt/user-data/outputs/litenco-printshop-2026-07-24-r17.html'
h = open(SRC).read()

CSS = '''
/* ===== r17: CORRECTIONS AGAINST THE DIRECTIVE =====
   Same structure, same tokens. Five defects from r16 repaired.              */

/* --- 1. HORIZONTAL OVERFLOW (root cause of the clipped masthead) ---
   r16 tray was 12% + 56% + 32% = 100% PLUS two 24px gaps, so the strip was
   wider than the page and the whole document gained a scroll axis. fr units
   divide what is left after the gaps instead of adding to it.               */
.tray{grid-template-columns:12fr 56fr 32fr;min-height:calc(var(--content-h) * .31)}
html,body{max-width:100%;overflow-x:hidden}

/* --- 2. STUDIO STRETCH ---
   r16 forced .st-in to full viewport height and grew sections by 27/25/12.
   Content is shorter than the panel, so the surplus became dead air between
   Finish, Size and Quantity. The directive percentages describe natural
   rhythm, not stretch. Sections size to content on a 16px cadence.          */
.st-in{display:block;min-height:0;padding:var(--space-md)}
.st-head{flex-grow:0;padding-bottom:var(--space-sm)}
.sec{flex:none;margin-top:var(--space-sm)}
.sec:nth-child(3),.sec:nth-child(4),.sec:nth-child(6){flex-grow:0}
.atc{flex:none;margin-top:var(--space-md)}
.addcfg{flex:none;margin-top:var(--space-xs)}
.studio{
  margin-top:var(--space-lg);   /* align with .left padding-top */
  top:104px;                    /* masthead 72 + page padding 32 */
  max-height:none;overflow:visible;
}

/* --- 3. INTENTIONAL WHITESPACE ---
   r16 used padding-bottom:22%, but percentage padding resolves against
   container WIDTH, not height — it produced ~200px of dead space. The reserve
   is vertical: thumbs pack to the top of a full-height column, the remainder
   below them is the 22%.                                                    */
.stage{align-items:stretch}
.stage-mini{
  align-self:stretch;align-content:start;
  padding:0;height:auto;
}

/* --- 4. TOP SECTION HEIGHT ---
   r16 pinned .gallery to 66% and ALSO let the hero run to 52%, so the card
   overshot and pushed the cart strip off the fold. Height now comes from the
   hero cap alone; the card sizes to its content and lands on 66-69%.        */
.gallery{min-height:0}
.stage-featured{align-self:start}
.stage-featured img{max-height:calc(var(--content-h) * .46)}

/* --- 5. HERO / THUMBNAIL RELATIONSHIP ---
   Two thumbnail rows must read as clearly secondary to the hero.            */
.mini-nm{font-size:14px}
'''

anchor = '</style></head><body>'
if h.count(anchor) != 1:
    print('ANCHOR FAIL'); sys.exit(1)
h = h.replace(anchor, CSS + anchor, 1)

must_exist = [
    'r17: CORRECTIONS AGAINST THE DIRECTIVE',
    '.tray{grid-template-columns:12fr 56fr 32fr',
    'html,body{max-width:100%;overflow-x:hidden}',
    '.st-in{display:block;min-height:0;padding:var(--space-md)}',
    '.sec{flex:none;margin-top:var(--space-sm)}',
    'top:104px;',
    '.stage{align-items:stretch}',
    'align-self:stretch;align-content:start;',
    '.gallery{min-height:0}',
    'max-height:calc(var(--content-h) * .46)',
    # r16 tokens must survive
    '--color-bg:#F6F2EC', '--color-burgundy:#7A1E2C', '--color-gold:#B78B4D',
    '--radius-card:12px', '--radius-thumb:10px', '--radius-pill:20px',
    '--space-md:24px', '--space-lg:32px',
    '--shadow-hero:0 20px 40px rgba(0,0,0,.12)',
    'grid-template-columns:minmax(0,78fr) minmax(0,22fr)',
    'flex:0 0 36%;min-width:34%;max-width:38%',
    'grid-template-columns:repeat(4,1fr)',
    # contract hooks
    'id="psFilters"', 'id="psSort"', 'id="psMinimap"', 'id="featBadge"', 'id="featAr"',
    'id="psStudio"', 'id="finGrid"', 'id="sizeGrid"', 'id="styleGrid"', 'id="arNotice"',
    'id="stPriceNote"', 'id="addToCart"', 'id="addCfg"', 'id="cartTray"', 'id="cartItems"',
    'id="cartSubtotal"', 'id="checkoutBtn"', 'id="orderConfirm"', 'data-prodigi-submit="off"',
    'data-owner="masthead-component"', 'data-piece-id="piece-5"', 'data-line-id="line-6"',
]
fail = [f'MISSING: {s}' for s in must_exist if s not in h]

# The cascade decides: only the LAST declaration of a track set is effective.
# Superseded percentage rules from r15/r16 are harmless; the winner must not
# sum to 100% alongside a gap, or the strip overflows the page again.
for sel in ['.tray{', '.shell{', '.stage-mini{']:
    decls = re.findall(re.escape(sel) + r'[^}]*grid-template-columns:([^;}]*)', h)
    if not decls: continue
    winner = decls[-1]
    pcts = [int(x) for x in re.findall(r'(\d+)%', winner)]
    if pcts and sum(pcts) >= 100:
        fail.append(f'TRACK OVERFLOW: effective {sel} -> {winner.strip()}')
# vertical reserve must not be percentage padding (resolves against width)
r17_block = h.split('r17: CORRECTIONS')[1].split('</style>')[0]
r17_block = re.sub(r'/\*.*?\*/', '', r17_block, flags=re.S)   # comments are prose, not rules
if re.search(r'padding[^;}]*\d+%', r17_block):
    fail.append('PERCENT PADDING REGRESSION IN r17')

style = h[h.index('<style>'):h.index('</style>')]
if style.count('{') != style.count('}'):
    fail.append(f"BRACE IMBALANCE {{={style.count('{')} }}={style.count('}')}")
if h.count('<section') != h.count('</section>'): fail.append('SECTION IMBALANCE')
ids = re.findall(r'id="([^"]+)"', h)
dupes = {i for i in ids if ids.count(i) > 1}
if dupes: fail.append('DUPLICATE IDS: ' + str(dupes))
if h.replace(CSS, '', 1) != open(SRC).read():
    fail.append('MARKUP DRIFT — r17 must be CSS-only')

if fail:
    print('GATE FAILED:'); [print('  ' + f) for f in fail]; sys.exit(1)

open(OUT, 'w').write(h)
for i, s in enumerate(re.findall(r'<script>(.*?)</script>', h, re.S)):
    fn = f'/tmp/r17_{i}.js'; open(fn, 'w').write(s)
    r = subprocess.run(['node', '--check', fn], capture_output=True, text=True)
    if r.returncode != 0:
        print(f'script[{i}] FAIL\n{r.stderr}'); sys.exit(1)

print(f'ALL GATES PASSED | {len(must_exist)} assertions | no track overflow | CSS-only | JS valid')
print(f'WROTE {OUT} ({len(h)//1024} KB)')
