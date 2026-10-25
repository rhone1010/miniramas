"""Contact sheets for the mug experiment dataset (run from the dataset root: E:/Dev/_recovery-staging/mug-experiment)."""
from PIL import Image, ImageDraw
import json, os

idx = json.load(open('dataset-index.json'))['cases']
done = [r for r in idx if r['status'] == 'done']

def row(r):
    d = f"cases/{r['count']:02d}_{r['effect']}"
    m = json.load(open(d + '/meta.json')); g = m['generation']
    raw = Image.open(d + '/raw-nb21.png').convert('RGB'); raw.thumbnail((300, 300))
    wrap = Image.open(d + '/wrap-2670x1110.png').convert('RGB').resize((600, 249))
    f = Image.open(d + '/preview-front.png').convert('RGB').resize((300, 300))
    b = Image.open(d + '/preview-back.png').convert('RGB').resize((300, 300))
    cf = Image.open(d + '/curvature-front.png').convert('RGB').resize((230, 300))
    cb = Image.open(d + '/curvature-back.png').convert('RGB').resize((230, 300))
    im = Image.new('RGB', (300 + 600 + 300 + 300 + 230 + 230, 322), 'white')
    d2 = ImageDraw.Draw(im); x = 0
    for t in (raw, wrap, f, b, cf, cb):
        im.paste(t, (x, 22)); x += t.width
    d2.text((4, 4), f"{r['count']} people | {r['effect']} | {m['strategy']} {m['format']} | analyzer {r['analyzerCountOfRaw']} / scored {r['routeScoredFigures']} | {g['quality']} ({g.get('reason')}) | attempts {g['attempts']}   [raw | wrap 2670x1110 | front | back | curvature front | curvature back]", fill='black')
    return im

os.makedirs('gallery-sheets', exist_ok=True)
for part, (a, b) in enumerate([(0, 6), (6, 12), (12, 16)]):
    rows = [row(r) for r in done[a:b]]
    sh = Image.new('RGB', (rows[0].width, sum(r.height for r in rows)), 'white'); y = 0
    for r in rows:
        sh.paste(r, (0, y)); y += r.height
    sh.save(f'gallery-sheets/sheet-{part + 1}.jpg', quality=88)
print('sheets written for', len(done), 'cases')
