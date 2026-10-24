"""Import approved photography unchanged; author code-native SVG surface masks."""
from pathlib import Path
from PIL import Image
import hashlib, json, shutil

SOURCE = Path(r'H:\liteneco art files\Litenco Gift Product Shots Beauty')
DEST = Path('public/gift-wizard/beauty-scenes')
# Measured visible artwork corners, clockwise from top left, in source pixels.
SURFACES = {
 'fine_art_print_square': ('fine_art',1,[(170,165),(853,165),(853,849),(170,849)]),
 'fine_art_print_portrait': ('fine_art',2/3,[(260,136),(759,136),(759,884),(260,884)]),
 'fine_art_print_landscape': ('fine_art',1.5,[(189,188),(1010,188),(1010,709),(189,709)]),
 'matted_frame_square': ('matted',1,[(276,272),(741,272),(741,748),(276,748)]),
 'matted_frame_portrait': ('matted',2/3,[(315,186),(708,186),(708,749),(315,749)]),
 'matted_frame_landscape': ('matted',1.5,[(187,168),(1017,168),(1017,742),(187,742)]),
 'framed_canvas_square': ('framed_canvas',1,[(149,126),(860,126),(860,839),(149,839)]),
 'framed_canvas_portrait': ('framed_canvas',2/3,[(280,141),(742,141),(742,842),(280,842)]),
 'framed_canvas_landscape': ('framed_canvas',1.5,[(146,137),(1054,137),(1054,759),(146,759)]),
 'framed_print_square': ('framed',1,[(177,162),(843,162),(843,821),(177,821)]),
 'framed_print_portrait': ('framed',2/3,[(259,122),(764,122),(764,862),(259,862)]),
 'framed_print_landscape': ('framed',1.5,[(122,127),(1079,127),(1079,777),(122,777)]),
 'wrapped_canvas_sqaure': ('canvas',1,[(157,130),(857,130),(857,815),(157,815)]),
 'wrapped_canvas_portrait': ('canvas',2/3,[(482,245),(1565,245),(1565,1803),(482,1803)]),
 'wrapped_canvas_landscape': ('canvas',1.5,[(123,122),(1065,122),(1065,749),(123,749)]),
 'greeting_card': ('card',5/7,[(259,184),(744,183),(744,869),(259,866)]),
 'mug': ('mug',2670/1110,[(380,455),(1420,455),(1420,1750),(380,1750)]),
}
inventory=[]
FRAMES={
 'matted_frame_square':((169,165,848,853),(191,188,830,833)),
 'matted_frame_portrait':((241,107,781,829),(263,128,760,811)),
 'matted_frame_landscape':((100,75,1101,834),(125,97,1084,818)),
 'framed_print_square':((163,147,862,838),(177,162,843,821)),
 'framed_print_portrait':((241,101,783,884),(259,122,764,862)),
 'framed_print_landscape':((103,108,1096,794),(122,127,1079,777)),
 'framed_canvas_square':((127,104,885,865),(149,126,860,839)),
 'framed_canvas_portrait':((257,119,764,865),(280,141,742,842)),
 'framed_canvas_landscape':((115,110,1085,786),(146,137,1054,759)),
}
for name,(family,aspect,corners) in SURFACES.items():
    source=SOURCE/('product_beauty_'+name+'.jpeg')
    folder=DEST/name; folder.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source,folder/source.name)
    w,h=Image.open(source).size
    shape='<polygon fill="white" points="'+' '.join(f'{x},{y}' for x,y in corners)+'"/>'
    if family=='mug':
        # Curved body, excluding the rim, base and handle. Coordinates are display
        # calibration only; physical margin/print geometry remains backend-owned.
        shape='<path fill="white" d="M380 455 Q900 530 1420 455 L1414 1640 Q900 1800 386 1640 Z"/>'
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><rect width="{w}" height="{h}" fill="black"/>{shape}</svg>\n'
    (folder/'artwork-mask.svg').write_bytes(svg.encode())
    scene=dict(id='beauty-'+name,family=family,dimensions=[w,h],sourceImage=source.name,artworkMask='artwork-mask.svg',cornersPixels=corners,
      maskBounds=dict(x0=corners[0][0],y0=corners[0][1],x1=corners[2][0],y1=corners[2][1]),
      surfaceAspectRatio=aspect,projection='photographed-plane',status='display-only',productionPrintFile=False,
      sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),sourceRevision='Owner-supplied beauty photographs 2026-10-24')
    if name in FRAMES:
        outer,inner=FRAMES[name]
        def rect(r,fill):
            x0,y0,x1,y1=r
            return f'<rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}" fill="{fill}"/>'
        def ring(filename,outer,inner):
            content=rect((0,0,w,h),'black')+rect(outer,'white')+rect(inner,'black')
            (folder/filename).write_bytes(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{content}</svg>\n'.encode())
        ring('frame-mask.svg',outer,inner);scene['frameMask']='frame-mask.svg'
        if family=='matted':
            ring('matte-mask.svg',inner,(*corners[0],*corners[2]));scene['matteMask']='matte-mask.svg'
        scene['finishPolicy']='Supplied photographic finish retained. Frame/matte masks provided for backend-supported finish integration.'
    if family=='mug':
        scene.update(artworkLayout='full-wrap',mapping=dict(type='cylindrical',centerX=.5,radiusX=.5,top=dict(edgeY=0,ellipseDepth=75/1295),bottom=dict(edgeY=1185/1295,ellipseDepth=80/1295),assumedWrapAngleRadians=6.283185307179586),backendDependency='Full wrap artwork with subject aligned to the visible face; no square-panel synthesis.')
    (folder/'scene.next.json').write_bytes((json.dumps(scene,indent=2)+'\n').encode())
    inventory.append(scene)
(DEST/'manifest.next.json').write_bytes((json.dumps(dict(version=1,scenes=inventory,sharedFamilies={'premium':'fine_art'}),indent=2)+'\n').encode())
print(f'Imported {len(inventory)} unchanged photographs and SVG masks.')
