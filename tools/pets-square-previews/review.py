from pathlib import Path
from PIL import Image, ImageDraw
import json, html, shutil

stage=Path('staging/pets-square-2026-10-22')
m=json.loads((stage/'manifest.json').read_text(encoding='utf-8'))
notes=json.loads((stage/'visual-review.json').read_text(encoding='utf-8-sig')) if (stage/'visual-review.json').exists() else {}
(stage/'sources').mkdir(exist_ok=True)
for name in {j['source_filename'] for j in m['jobs']}:
    shutil.copyfile(Path(m['source_directory'])/name,stage/'sources'/name)
ready=[j for j in m['jobs'] if j.get('output_sha256')]
sheet=Image.new('RGB',(1200,max(1,(len(ready)+4)//5)*280),'white')
draw=ImageDraw.Draw(sheet)
for n,j in enumerate(ready):
    im=Image.open(stage/j['output']);im.thumbnail((230,230))
    x=n%5*240;y=n//5*280;sheet.paste(im,(x,y))
    draw.text((x+3,y+232),j['label'],fill='black')
    draw.text((x+3,y+248),j['status'],fill='black')
sheet.save(stage/'contact-sheet.jpg')
parts=['<!doctype html><html><meta charset="utf-8"><title>Pets staged preview review</title><h1>Pets — native square preview review</h1><p>Staged only. Existing customer previews are unchanged.</p><a href="sources.jpg">Source inventory contact sheet</a>']
for silo in dict.fromkeys(j['silo'] for j in m['jobs']):
    parts+=['<h2>'+html.escape(silo)+'</h2><div style="display:flex;flex-wrap:wrap;gap:24px">']
    for j in m['jobs']:
        if j['silo']!=silo:continue
        parts+=['<article style="width:280px"><h3>'+html.escape(j['label'])+'</h3>']
        if j.get('output_sha256'):parts+=['<a href="'+j['output']+'"><img width="280" height="280" alt="'+html.escape(j['label'])+'" src="'+j['output']+'"></a>']
        parts+=['<p>'+html.escape(j['status'])+' · '+html.escape(str(j.get('dimensions','')))+'</p><a href="sources/'+j['source_filename']+'">Source: '+j['source_filename']+'</a><p>'+html.escape(j.get('reason',''))+'</p><p>'+html.escape(notes.get(j['effect_id'],''))+'</p></article>']
    parts+=['</div>']
(stage/'index.html').write_text(''.join(parts),encoding='utf-8')
print('Review images:',len(ready))
