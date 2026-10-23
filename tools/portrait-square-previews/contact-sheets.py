"""Review thumbnails only; never rewrites native generated assets or originals."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

stage = Path('staging/portrait-square-2026-10-22')
manifest = json.loads((stage / 'manifest.json').read_text())
review = stage / 'review'
review.mkdir(exist_ok=True)
for silo in dict.fromkeys(job['silo'] for job in manifest['jobs']):
    jobs = [job for job in manifest['jobs'] if job['silo'] == silo]
    sheet = Image.new('RGB', (1200, ((len(jobs) + 3) // 4) * 340), 'white')
    draw = ImageDraw.Draw(sheet)
    for index, job in enumerate(jobs):
        x, y = index % 4 * 300, index // 4 * 340
        if job.get('output_dimensions'):
            image = Image.open(stage / job['output_filename']).convert('RGB')
            image.thumbnail((300, 300))
            sheet.paste(image, (x, y))
        else:
            draw.text((x + 5, y + 140), 'No generated image', fill='black')
        draw.text((x + 5, y + 302), job['effect_id'], fill='black')
        draw.text((x + 5, y + 317), job['variant'] + ' / ' + job['generation_status'], fill='black')
    sheet.save(review / (silo + '.jpg'))
print('Review contact sheets written; native assets unchanged.')
