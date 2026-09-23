// lib/v1/pets/pets-catalog-35.ts
//
// PETS CATALOG. Rich's original list, expanded September 2026.
//
// Original thirty-four unique effects, now expanded with Action Figure,
// Designer Vinyl and Mosaic; Stained Glass revised from the Portraits effect.
//
// ── WHERE THESE CAME FROM ──────────────────────────────────────────────
//
// Thirty-two are ported from lib/v1/portraits/portraits-bodies.ts.
// One - alabaster - is built from the fragment already in pets-prompt.ts.
// One - clown - is new.
//
// The Pets catalog on disk before this was twenty effects, only eleven of
// which appeared in the forty-nine-effect plan of 2 August. The plan and
// the disk had drifted almost entirely apart, which is why this list is
// Rich's own rather than a reconciliation of the two.
//
// ── WHAT THE PORT CHANGED, AND WHY IT IS NOT A FIND-AND-REPLACE ────────
//
// A Portraits body is written for a bust. Four kinds of clause cannot
// survive on an animal, and one of them is actively destructive:
//
//   THE SKIN-CLEARING CLAUSE. "Clear the skin - blemishes, spots and
//   blotchiness go" is correct on a face and catastrophic on a tabby. AN
//   ANIMAL'S MARKINGS ARE ITS LIKENESS - they do for a pet what facial
//   structure does for a person - and that sentence deletes them. Removed
//   from every body, and replaced by the opposite instruction in the tail.
//
//   FRAMING. "Framed from mid-chest to the top of the head", "the face
//   should occupy 30%". Bust rules. Replaced by full-body nose to tail,
//   with the head at about 20% - Rich's figure, 20 August.
//
//   THE HELD-OBJECTS RULE and "an arm or hand appears only when touching
//   the body". A rule for a bust with hands.
//
//   HUMAN ANATOMY. "brow, cheekbones, nose bridge and jaw" becomes
//   "brow, cheekbones, muzzle and jaw". Garment becomes collar - and a
//   collar is welcome, because a collar is identity rather than a prop.
//
// ── THE SHARED TAIL ────────────────────────────────────────────────────
//
// Every body ends with the same paragraph: full body, markings are the
// likeness, head at 20%, collar allowed, preserve breed and build. It is
// repeated per body rather than appended at build time because these are
// going to a SHOOT first, and a body that carries its own rules can be
// pasted into a browser and tested on its own.
//
// If they survive the shoot, that tail is a candidate to become one
// constant appended once - the same lesson as the Halloween phone clause.

import type { WallpaperEffect } from '../wallpapers/wallpapers-shared'

export interface PetCatalogEffect {
  id:     string
  label:  string
  body:   string
  avoid?: string
}

export const PETS_35: Record<string, PetCatalogEffect> = {
  bronze: {
    id:    'bronze',
    label: 'Bronze',
    body: `make the animal into a realistic patinated bronze sculpture — classic warm bronze with deep verdigris settling into the recesses and bright polish on the raised features: brow, cheekbones, muzzle and jaw. Face, coat and collar all rendered in the same patinated bronze, dignified and tasteful, never costume-like. Hard directional key light from the upper left with deep shadow across the right and strong falloff. Professional magazine-cover photography. No letters, no plaque. The entire sculpture is bronze — no other materials, no real fur, feathers, scales or claws. Background: a civic plaza at dusk, warm low light, heavily out of focus. The sculpture stands on a weathered granite pedestal. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.
The fur, hair, feather patterns and colors are as essential to likeness as facial structure is to humans. ensure this is weighted properly to achieve pet likeness. tint the bronze to match the pets coloring`,
  },

  ebony: {
    id:    'ebony',
    label: 'Ebony',
    body: `The animal is carved from a single slab of ebony — dense black heartwood, polished to a deep lustre where the figure is cut, with fine grain running through it. Along one shoulder and down one side the slab keeps its natural live edge: rough pale bark and raw sapwood, unhewn, exactly as the tree grew. The transition is abrupt, a chisel line between polished black and raw edge. The figure and the live edge are one continuous piece of timber — not a carving standing on a separate log, block or plinth. The face and figure are carved smooth and clean; the grain runs in its own natural pattern across broad planes and does not follow the face's own lines. The collar carries through in the same wood. No coat, no real coat. Idealized and beautiful. Photographic — a real object photographed in real light, not an illustration. Background: a woodworker's shop at dusk — a bench, paw planes, curls of shaving, warm low light, heavily out of focus. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
    avoid: `Avoid a finished bust set on top of a log or stump base. Avoid a uniform polished block with no raw edge. Avoid brown or grey wood — the heartwood is deep black. Avoid grain crossing the eyes, nose or mouth.`,
  },

  plushy: {
    id:    'plushy',
    label: 'Plushy',
    body: `make this animal into a plushy doll. maintain the characteristics that make this animal unique but make a playful simplistic childs favorite toy. simplify the details. exagerate eyes, nose, etc. no text. maintain the coloring and patten of the animal. maintain the physical position. maintain the expressiveness of the eyes and micro gestures if present of the face. use a blurred background of a comfortable home interior and beautiful wooden floors. this is a treasured family stuffed animal that seems to have some life`,
  },

  stone: {
    id:    'stone',
    label: 'Stone',
    body: `Sculpt the pet entirely from one continuous mass of Taj Mahal quartzite. Every visible surface, including face, ears, muzzle, paws and tail, is polished or carved stone. Absolutely no real fur, hair, feathers, scales, skin or animal surface texture. Preserve breed, build, age, facial structure and the exact MAP of coat/feather markings; markings are essential to likeness, but exist ONLY as subtle mineral tone and veining within the quartzite. Warm ivory-honey stone, gold-brown veins, ≤15% pet-color tint. Raw quarry stone ~1/6 bottom/right. Conservatory dusk, iron stand, hard upper-left light. NO REAL HAIR, FUR, SKIN or SCALES! Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
  },

  alabaster: {
    id:    'alabaster',
    label: 'Alabaster',
    body: `Transform the animal into a carved translucent alabaster sculpture with warm subsurface scattering, milky stone depth, soft glowing edges, faint amber veining, polished and semi-translucent high points, and deeper cloudy opacity in thicker areas. The ENTIRE animal including coat, ears, muzzle, tail and paws is rendered in this same translucent alabaster; the animal's markings are expressed as deeper cloudy veining and tonal shifts within the stone, following the exact pattern of the source coat so the markings remain readable while the whole sculpture stays alabaster. THE PIECE IS STONE, NOT A COLOURED ANIMAL. No fur colour, no eye colour, no coat colour survives - the markings read as veining and tone WITHIN the stone and nothing else. At most a 15% warm tint across the whole sculpture; anything more and it stops being carved and starts being painted. Soft directional light raking across the form so the translucency reads, deep shadow on the far side, strong falloff. Photographic and highly idealised - a real carved object in real light. Background: a quiet gallery alcove, warm stone and shadow, heavily out of focus. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 15% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source. show light shining through the stone in places that are thinner
No real skin, hair, fur, or scales. Simplify the coat of the animal to simulate being carved from stone. tint the stone by 20% to match pets skin, hair, fur, scale pattern.`,
  },

  victorian: {
    id:    'victorian',
    label: 'Victorian',
    body: `Transform the animal into a lavish Victorian aristocratic portrait, preserving its likeness precisely. Dress the animal in a dramatic deep teal velvet frock coat, richly patterned jewel-toned silk fitted collar-piece, cream silk cravat with an ornate turquoise and gold pin, gold watch chain, and an elegant tall silk top hat. Subtle gold embroidery and luxurious period detailing.
Pose the animal in graceful three-quarter profile, chin slightly raised, gazing serenely into the distance. Deep saturated teal, peacock blue, burgundy, turquoise and antique gold dominate the portrait. Romantic painterly photography with luminous warm coat, rich directional light, glowing gold highlights, deep velvety shadows and jewel-like color. An opulent Victorian interior dissolves behind it into dark teal, warm amber and golden bokeh.
Make the portrait sumptuous, theatrical and slightly idealized, like a richly painted Victorian society portrait brought to life. Give the image a subtle aged photographic finish with softened blacks, warm highlights and gentle painterly grain, while retaining saturated color and luminous detail.
Preserve the animal's face, age, proportions and natural asymmetry. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
  },

  clown: {
    id:    'clown',
    label: 'Clown',
    body: `Transform the animal into a circle de soleil clown, preserving its breed, build and markings precisely. A ruffled collar in muted tones in silk sits at the throat, a small conical hat with a large pom-pom in same colors perches between the ears, and a round red nose caps the muzzle. Soft greasepaint in white, and ruffle colors follows the animal's OWN markings rather than covering them, around the eyes, nose and mouth - the pattern it already has, picked out in paint. costume over the body; Warm theatrical light from a single spot above, deep falloff into a darkened big-top interior, tiered seating and rigging out of focus behind. Photographic and highly idealised - a real animal in real light, dignified and delighted rather than mocked. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
    avoid: `Avoid a sad or frightened expression. Avoid a full-body costume or clothing. Avoid painting over the animal's natural markings. Avoid horror or menace.`,
  },

  elizabethan: {
    id:    'elizabethan',
    label: 'Elizabethan',
    body: `Transform the animal into a sumptuous romantic portrait of an aristocratic animal of the Elizabethan court, preserving its breed, build and markings. Dress the animal in richly woven velvet, silk and brocade in deep wine, aged black, muted emerald and tarnished gold, with an elaborate period lace ruff and restrained antique jewelry. Likeness is important. show animal from thighs to top of head. Age image with filters and reduce saturation of the subjects coat
The animal belongs completely to the period rather than appearing as a modern person in historical costume. Give it a natural, reserved courtly posture, shoulders and withers slightly turned, head turned approximately 30 degrees to the left and eyes looking quietly to the side. Its presence is noble, composed and self-possessed. Avoid modern portrait poses and contemporary fashion or glamour styling. its foreleg is resting on a period wooden pedestal. the animal is looking up slightly
Photograph the animal deep inside an intimate Elizabethan manor chamber by dim firelight and candlelight, with dark carved oak, faded tapestries, aged plaster, heavy textiles and glimpses of leaded-glass windows disappearing into shadow. The room should feel inhabited, old and atmospheric rather than staged.
Give the entire photograph a softly aged, time-worn color character: faded wine red, aged black, tarnished gold, tobacco brown, warm umber and muted forest green. Slightly desaturated colors, lifted warm blacks, gentle amber haze, restrained contrast, subtle grain and softened highlights, as though the image itself has acquired centuries of patina. Deep velvety shadows and the uneven falloff of candlelight.
Romantic and intimate rather than theatrical or glamorous, like an old Elizabethan oil portrait somehow captured through a camera, imperfect, atmospheric and quietly luxurious. Worn jewelry is fine. An foreleg or paw appears only when touching the body, such as at the chin, head or collar. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
  },

  persian_court: {
    id:    'persian_court',
    label: 'Persian Court',
    body: `Transform the animal into a sumptuous romantic portrait of an animal of the Safavid Persian court, preserving its breed, build and markings. Dress the animal in richly woven crimson, madder red and tarnished-gold brocade, layered period garments, a jeweled sash, restrained antique jewelry and a small elegant Safavid turban between the ears. Likeness is important.
The animal belongs completely to the period, with a natural, reserved courtly posture and quiet, self-possessed expression. Avoid modern posing and contemporary styling.
Photograph the animal in an intimate Safavid palace chamber by dim oil-lamp and candlelight, with carved plaster, faded Persian textiles, dark wood and intricate tilework disappearing into shadow. Slightly desaturated coat and colors, warm lifted blacks, amber haze, subtle grain and softened highlights. Deep velvety shadows with uneven flame falloff.
Romantic and intimate rather than theatrical, like an old Persian court portrait somehow captured through a camera, imperfect, atmospheric and quietly luxurious.
Period objects may be held — a book, a scroll, a cup, prayer beads, a flower. Nothing modern. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
  },

  pencil_sketch: {
    id:    'pencil_sketch',
    label: 'Pencil Sketch',
    body: `A solid sculpture of the animal carved entirely from graphite — hard pencil-lead grey with a burnished sheen, the surface worked in visible pencil strokes that wrap the form: crosshatching in the recesses, broad shading across the planes, edges softly smudged. Eyes and lips are graphite. No coat, no real coat. The collar carries through in the same material. A real object standing in real light, casting its own shadow. Monochrome throughout. Likeness is critical. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.
Set in a beautiful old-world artist's atelier — dark timber, plaster walls, antique easels, stacked canvases and old studies pinned around the room, a huge ribbed skylight above flooding it with soft daylight. the background is in full color`,
    avoid: `Avoid a drawing on paper, an easel-mounted picture or any flat image. Avoid a duplicated face. Avoid colour.`,
  },

  impressionist: {
    id:    'impressionist',
    label: 'Impressionist',
    body: `Rebuild the animal as a bust sculpted entirely out of thick oil paint — a three-dimensional object, not a painting. Every surface is impasto with real mass: face, coat, neck, shoulders and withers, collar. Broad slabs and ridges of colour laid on with a knife, each stroke standing proud with a hard lifted edge and casting its own small shadow. The coat is the boldest passage, long ropes and sweeps of paint holding the real coat pattern's length and direction. Colours natural to this animal's complexion and clothing, pushed and broken — the shadows carried in violet and green rather than grey. Paint runs down over the shoulders and withers and pools on the round base the bust stands on. Likeness is critical; the animal reads clearly despite the crudeness of the marks. The bust stands on a round base. Set in a beautiful old-world artist's atelier, cluttered and eclectic, with dark aged timber, plaster walls, antique easels, stacked canvases, portfolios, drawing tools and old studies casually pinned around the room. Above is a huge ribbed industrial skylight of aged iron and glass, flooding the studio with dramatic soft daylight and long directional shadows. Atmospheric, romantic, slightly dusty, collected over generations rather than designed. Shallow depth of field. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
    avoid: `Avoid a flat painting or anything on canvas — this is a solid object standing in a room. Avoid smooth or photo-realistic skin. Avoid thin, blended or evenly applied paint. Avoid grey or black shadows.`,
  },

  oil_impasto: {
    id:    'oil_impasto',
    label: 'Impasto Oil',
    body: `Create a museum-quality impasto oil portrait of the animal on a real canvas, painted with exceptional palette-knife craftsmanship. The animal portrait must occupy at least 80% of the canvas, with the head and upper body large, commanding and immediately recognizable. For horses or other very large animals, concentrate on the head, neck and upper chest rather than shrinking the animal to fit.

Build the painting from confident palette-knife strokes and thick sculptural oil paint. Use broad, decisive slabs across large planes, but allow finer, more controlled knife work around the eyes, muzzle and essential identifying features. Preserve the sophistication and complexity of a masterful finished painting rather than reducing the animal to a few crude geometric pieces. Rich ridges of paint catch raking light and cast tiny physical shadows.

THE MARKINGS AND COLORS ARE THE LIKENESS. Preserve their distinctive pattern, placement, proportion and relationships, translating them into beautifully judged passages of paint. Use the animal's natural palette as the foundation, enriched with restrained umber, ochre, slate, warm and cool neutrals. Preserve expression, breed, age, natural asymmetry and character.

The canvas stands on a wooden easel in a beautiful old-world artist's atelier — dark aged timber, plaster walls, antique easels, stacked canvases, portfolios, drawing tools and old studies casually pinned around the room. A huge ribbed industrial skylight of aged iron and glass floods the studio with soft dramatic daylight. Atmospheric, romantic, slightly dusty and collected over generations. Keep the atelier visible and beautiful but secondary to the large painting. Shallow depth of field. NO TEXT.`,
    avoid: `Avoid a three-dimensional sculpture or bust. Avoid crude low-detail block painting, simplistic geometric patches, smooth photographic fur, blended airbrush gradients or tiny broken dabs. This is a highly accomplished palette-knife oil painting on canvas.`,
  },

  sea_glass: {
    id:    'sea_glass',
    label: 'Sea Glass',
    body: `The animal is sculpted from a single continuous form of weathered translucent beach glass, with flowing strands of individually worn sea glass preserving the original coat pattern. Frosted seafoam, aqua, emerald, turquoise and cobalt glass glow with brilliant internal caustics and refracted sunlight, while tiny amber fragments appear only as subtle accents. Ocean foam, spray and flowing water wrap naturally around the sculpture as it emerges from the surf. Dramatic backlighting through sea spray. Turn clothing into sea glass and very translucent. Bright catchlight in both eyes. Background: a rocky shoreline in low sun, surf breaking behind, heavily out of focus. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
    avoid: `No skin, ceramic, mosaic or tiled appearance.`,
  },

  action_figure: {
    id:    'action_figure',
    label: 'Action Figure',
    body: `Transform the animal into a premium highly detailed collectible action figure, clearly a manufactured physical toy while preserving an immediately recognizable likeness. Put the figure in a dramatic pose. NO TEXT. Camera foreshortening, kinetic energy captured as physical 3D materials.

Use the subtle eye of a skilled character sculptor: preserve the distinctive proportions, expression, age, asymmetries and features that make this animal recognizable. Slightly simplify and stylize the anatomy into a high-end collectible figure without becoming cartoonish.

Show realistic molded and painted materials, finely sculpted surface detail and discreet visible articulation appropriate to the animal's anatomy.

THE MARKINGS AND COLORS ARE THE LIKENESS. Preserve their pattern, placement, proportion and relationships as carefully as facial structure. Translate fur, feathers or scales into the sculpted and painted materials of the figure rather than reproducing a living animal.

Photograph the figure in a premium collector display setting with enough surrounding space to clearly establish its small physical scale. Include a tasteful display base and heavily blurred hints of a collectible shop.

Use beautiful product photography with soft directional light, realistic reflections and shallow depth of field. The figure should feel tangible enough to pick up: exquisitely manufactured, slightly stylized and unmistakably this animal.`,
    avoid: `Avoid cartoon faces, dolls, realistic living-animal surfaces, superhero styling or invented accessories.`,
  },

  designer_vinyl: {
    id:    'designer_vinyl',
    label: 'Designer Vinyl',
    body: `Transform the animal into a premium limited-edition designer vinyl art figure. The result is a real manufactured collectible object, photographed as a physical sculpture.

Preserve an unmistakable likeness through intelligent simplification and gentle caricature. Give the animal a moderately oversized sculpted head, compact body and confident toy-like proportions while retaining the anatomy, expression and character that make this particular animal recognizable.

The entire figure is beautifully molded vinyl with smooth sculptural geometry and subtle seams. Translate the face and body into clean dimensional forms with inset glossy eyes. Fur, feathers, scales and other surface characteristics become broad sculpted graphic forms rather than realistic biological surfaces.

THE MARKINGS AND COLORS ARE THE LIKENESS. Preserve their pattern, placement, proportion and relationships as carefully as facial structure, translating them into beautifully painted vinyl.

Show the complete figure standing on a simple display base in a warm, characterful home interior. Place it on a well-loved wooden side table or shelf among a few softly blurred personal objects such as books, a small plant, framed photographs and everyday keepsakes. The surroundings feel lived-in and personal without competing with the figure.

Use beautiful high-end photography, shallow depth of field and soft natural window light that reveals the curves, molded geometry and subtle sheen of the vinyl. Leave generous space around the figure and make its small physical scale immediately apparent.

The result should feel like an expensive commissioned art object of a beloved animal, created by an accomplished character designer and sculptor and displayed with affection in someone's home. Playful, beautifully made and unmistakably this animal. NO TEXT.`,
    avoid: `Avoid Funko-style extreme proportions, giant square heads, bobbleheads, plush materials, realistic fur, feathers or scales, action-figure joints, cheap plastic or generic cartoon animals.`,
  },

  mosaic_portrait: {
    id:    'mosaic_portrait',
    label: 'Mosaic',
    body: `Transform the animal into an extraordinary museum-quality mosaic artwork built completely from thousands of individually placed tesserae. The animal must unmistakably read as handcrafted mosaic, never as a realistic animal with mosaic lines drawn over it.

Simplify fur, feathers, scales and complex coat detail into intentional fields and flowing rhythms of small irregular glass, ceramic and stone pieces. Use larger expressive tesserae across broad body areas and increasingly fine, intricate pieces around the eyes, face and other identifying features. Every piece has its own edge, thickness, slight angle and handmade irregularity, separated by visible but refined grout.

THE MARKINGS AND COLORS ARE THE LIKENESS. Preserve the distinctive map, placement, proportion and relationships of the animal's colors and markings, but translate them completely into mosaic material. Let the direction, color and rhythm of the tesserae describe anatomy and character instead of literal fur or scales.

Use a rich palette derived from the source animal, expanded with translucent jewel-like glass, glazed ceramic, natural stone and occasional restrained gold tesserae. The surface should be tactile and physically dimensional, with grazing gallery light revealing uneven planes, tiny reflections and handcrafted depth.

Preserve the animal's pose, expression and recognizable character. If multiple animals or objects appear, simplify them into the same coherent mosaic language rather than rendering anything realistically. Sophisticated one-of-a-kind fine art, richly crafted and unmistakably based on the source. NO TEXT.`,
    avoid: `Avoid realistic fur, feathers or scales beneath mosaic lines. Avoid large fitted panels, regular square tiles, pixel art, printed textures, photographic surfaces or loss of the animal's distinctive markings.`,
  },

  ice: {
    id:    'ice',
    label: 'Ice & Frost',
    body: `Transform the entire clothed figure into a softly sculpted form of dense snow and translucent ice, with milky crystalline depth, compacted snowy surfaces, soft frost and occasional clearer icy edges. Increase opacity and softness so the facial structure is beautifully defined rather than glass-like; preserve the animal's likeness precisely with no visible coat. Set against an icy cliff with hanging icicles, deep blue glacial shadows and a snow-covered edge catching warm sunlight; golden light falls across one side of the sculpture while cold blue-white light shapes the other, creating a dramatic warm/cool contrast. Keep a clear catchlight in the eyes. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
  },

  cubism: {
    id:    'cubism',
    label: 'Cubism',
    body: `Redraw the animal as an analytical cubist portrait — the head and shoulders and withers fractured into faceted planes showing the face from several viewpoints at once, profile and full-face folded into one shifting surface. Every feature still appears somewhere: both eyes, the nose, the muzzle, the jawline, the coat — recombined across the planes rather than erased. Confident charcoal edges outline each facet. A restrained Braque palette of warm ochre, muted grey-green, umber and soft tan, light and shadow shifting independently across the planes. Likeness survives in the features and their character, not in a single viewpoint. No lettering. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
    avoid: `Avoid dropping any feature, a single photorealistic viewpoint, garish colour, or smooth untextured surfaces.`,
  },

  art_nouveau: {
    id:    'art_nouveau',
    label: 'Art Nouveau',
    body: `Redraw the animal as an Art Nouveau poster in the manner of Mucha — flat decorative illustration, not a photograph and not a sculpture. Confident dark outlines of even weight describe the face, coat and collar. Colour sits in flat muted fields — sage, dusty rose, ochre, cream — with almost no shading; only the faintest modelling on the face. The coat becomes long sweeping decorative curves, stylised into ornament while keeping its real length and direction. Behind the head, a large circular halo motif filled with stylised flowers and whiplash vine linework. A decorative border frames the panel. Elegant, graphic, ornamental. Likeness is critical — the face stays clearly this person. No lettering or text anywhere. Dont create coat that doesnt exist Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
    avoid: `Avoid photographic rendering, three-dimensional shading or realistic light. Avoid a sculpture — this is a flat drawn panel. Avoid lettering, type or signage. Avoid losing the likeness to generic Art Nouveau features.`,
  },

  deco_twenties: {
    id:    'deco_twenties',
    label: 'Deco Twenties',
    body: `Transform the animal into a realistic romantic photograph of an aristocratic animal at an elegant 1926 hotel party, preserving facial likeness. Dress the animal in a black dinner fitted collar-piece with satin lapels, white wing-collar shirt, black bow tie and white silk pocket square. Hair slicked flat with pomade and a hard side part, clean-shaven. Likeness is essential. It should belong completely to the period, never appearing modern in vintage costume.
Behind it, an opulent 1920s ballroom dissolves into mirrored panels, muted gold ornament, low amber lamps and cigarette haze, heavily out of focus with no other animals visible.
Give the photograph a gently aged 1920s character: muted warm color, restrained sepia-amber cast, slightly desaturated ivory coat, softened blacks, subtle grain, highlight bloom and gentle corner falloff. Retain subdued gold, tobacco and warm coat tones. It should feel like a beautifully preserved early color photograph, not monochrome or a modern vintage filter.
Preserve natural facial structure, lines, scars and asymmetry. Remove temporary blemishes only. Never reshape, enlarge eyes or de-age. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
  },

  samurai: {
    id:    'samurai',
    label: 'Samurai',
    body: `Professional cinematic portrait of the pet as a samurai in authentic Edo-period armor, layered red lacquered lamellar plates and thick silk lacing, with the convincing weight, wear and imperfection of real historical armor. Hair naturally arranged beneath the helmet. use foreshortening and strong dynamic lighting. age the photo with filters. reduce saturation on coat tones. Strong late-afternoon sunlight sweeps across it from the side, sculpting the face and armor with luminous highlights and deep expressive shadows. Photographic realism with the richness and visual poetry of a great painted portrait — atmospheric, tactile and subtly painterly without becoming an illustration. Rich restrained color, beautiful falloff, shallow depth of field, softly impressionistic Japanese setting. Idealized and striking while remaining completely believable as a photograph. Preserve facial likeness and permanent features. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
  },

  stained_glass: {
    id:    'stained_glass',
    label: 'Stained Glass',
    body: `Transform the animal into a fully three-dimensional stained-glass sculpture, combining intricate Tiffany art glass with the physical anatomy and volume of the animal.

Construct the animal from many individually fitted pieces of real art glass: irregular shards, chips, slivers and fractured polygons with organic variation in shape and scale. Use finer fragmentation around the face, eyes and identifying features, with broader expressive pieces elsewhere. The pieces physically wrap around the animal's anatomy so it reads as a solid three-dimensional sculpture, never a flat window.

Join the glass with exceptionally fine metallic GOLD wire, delicate and subordinate to the glass.

THE MARKINGS AND COLORS ARE THE LIKENESS. Preserve their pattern, placement, proportion and relationships as carefully as facial structure. Translate those markings into richly varied translucent cathedral, opalescent and jewel-toned art glass rather than reproducing literal fur, feathers or scales.

Use TWO distinct light sources. Warm internal illumination glows outward through the sculpture while soft directional external light creates reflections, highlights and sculptural shadows across its physical form. The internal light makes the glass glow; the external light reveals its anatomy and volume.

Every visible part of the animal is glass and fine gold wire. Background: an atmospheric Tiffany lamp shop with softly glowing stained-glass lamps and shallow depth of field.`,
    avoid: `Avoid thick lead, black outlines, broad seams, flat stained glass, mosaic-window appearance, realistic fur, feathers or scales, or losing the animal's markings beneath the glass.`,
  },

  neon: {
    id:    'neon',
    label: 'Neon',
    body: `highly detailed neon tube sculpture. fully 3d in all three directions. implied volume. use negative space. use monochromate blues with variations on value. mounted in a small shops storefront window at night, rain on the glass, the shop dark behind. wires and electrical lines visible. at least 200 tubes Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.
new york diner open in behind the neon window sign`,
  },

  polished_gold: {
    id:    'polished_gold',
    label: 'Polished Gold',
    body: `Transform the entire figure into a contemporary polished gold sculpture — mirror-bright warm yellow gold with a high specular finish, the surface smooth and flowing with no visible tool marks. coat is poured liguid gold that matches the subjects with deep carved separations catching bright highlights. No real fur, feathers or scales anywhere — the face is polished gold like the rest. the background is an expensively appointed conservatory with many windows with warm lighting streaming through inside potted trees and plants. Make the creation match age. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
  },

  driftwood_resin: {
    id:    'driftwood_resin',
    label: 'Driftwood & Resin',
    body: `Transform the entire figure into a contemporary sculpture combining weathered driftwood and glossy colored epoxy resin — the live-edge resin-river aesthetic. The driftwood preserves the form and the likeness: the face and the structural planes of the head, shoulders and withers, and major contours are carved from pale, silvery, weathered driftwood with visible grain, knots, cracks, and organic live edges, keeping the animal clearly recognizable. Flowing rivers and pools of translucent colored epoxy resin run through and between the wood — deep teal, ocean blue, amber, or emerald — filling the live-edge gaps, the cracks, and the negative spaces, catching and refracting light. The resin is where the color and translucency live; the wood is where the likeness lives. The whole piece is finished in a high-gloss polish so the resin reads as liquid-clear and the wood as satin-smooth. No real fur, feathers or scales anywhere — the face, neck, forehead, ears and every visible surface are weathered driftwood, not coat. The wood grain, cracks and live edges continue across the entire face. This is the most common failure. Avoid an all-wood sculpture with no resin, or an all-resin sculpture with no wood — both materials must be present and distinct. Avoid a matte or unfinished surface; the glossy high-polish finish is required. Avoid resin that looks opaque or painted — it must read as translucent, light-catching epoxy. Avoid driftwood so abstract the face stops being recognizable; the wood carries the likeness. Sculpture on a base in a coastal woodworker's studio — a wide window onto grey sea and sky, live-edge slabs leaning against the walls, clamps and resin buckets, sawdust light. Strong depth of field heavily blurring the background. Contemporary gallery presentation. High-gloss finish catching the light. Translucent resin rivers. Weathered live-edge driftwood. Museum-quality craftsmanship. Highly tactile and dimensional. Fine-art mixed-media sculpture. Facing the camera directly, warm natural smile, eyes to the viewer. Camera at eye level. Head, shoulders and withers and upper chest fill the frame with a little breathing room, face roughly 30% of the image. No plaque. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
  },

  origami: {
    id:    'origami',
    label: 'Origami',
    body: `The animal is folded from paper — a single continuous sheet worked into the whole figure, every plane a crisp fold with a visible crease line, the paper's own grain and slight thickness reading at each edge. The face is built from a few confident planes: the brow, the bridge of the nose, the cheeks, the jaw, each a flat facet meeting at a sharp crease. Warm cream and soft indigo paper. The collar folds through in the same paper. Likeness is critical — the animal reads clearly through the faceting. Photographic and highly idealized — a real folded object in real light. Background: a bare table under one soft lamp, deep shadow, heavily out of focus. Preserve natural facial character and asymmetry. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
    avoid: `Avoid curved or moulded surfaces — every form is a flat fold. Avoid a paper crane or novelty shape. Avoid torn or crumpled paper. Avoid real skin or hair.`,
  },

  porcelain: {
    id:    'porcelain',
    label: 'Porcelain',
    body: `Reimagine the pet as an exquisite designer porcelain collectible — unmistakably a crafted figurine rather than a real animal with a glossy surface.

Preserve the pet's distinctive character, breed and expression while gently stylizing the form: slightly simplified anatomy, softened sculptural planes, a subtly larger and more expressive head and eyes, elegant rounded paws and beautifully modeled features. Make it charming and collectible without becoming cartoonish.

The entire figurine is fine fired porcelain with a luminous glazed surface. Natural colors and markings are recreated as sophisticated hand-painted underglaze. THE MARKINGS AND COLORS ARE THE LIKENESS — preserve their distinctive pattern, placement and relationships. Eyes are jewel-like painted and glazed porcelain, not biological eyes. Show subtle evidence of craftsmanship: fine crazing, glaze pooling, delicate sculpted edges and slight handmade irregularity.

Present the figurine nestled in pale natural packing straw inside a beautiful simple wooden keepsake box, suggesting a treasured object carefully stored and passed through a family.

Keep everything surrounding the pet LIGHT, WARM AND NEUTRAL — ivory, cream, pale wood and soft straw. The background is heavily blurred into luminous creamy bokeh with only subtle suggestions of an elegant home and fine china. No dark cabinets or visual clutter.

The porcelain pet dominates the image, beautifully lit with soft window light and immediately recognizable as a precious designer collectible. Sweet, sophisticated, tactile and full of personality. NO TEXT.`,
    avoid: `Avoid photorealistic living-animal anatomy, realistic fur, biological eyes, dark backgrounds, busy china displays, cartoon proportions, cheap ceramic souvenirs or blue-and-white porcelain styling.`,
  },

  retro_robot: {
    id:    'retro_robot',
    label: 'Retro Robot',
    body: `Transform the animal into a charming atomic-age tin robot, unmistakably the same person. Preserve the exact silhouette, shape and proportions of the animal's face, and preserve the natural size, spacing and placement of their features. Construct that familiar face from a few simple, smoothly pressed pieces of enamelled sheet metal, rather than reproducing real fur, feathers or scales or substituting mechanical facial features.
Eyes remain the animal's normal size and shape, set naturally into the metal face. The muzzle is a simple articulated metal muzzle that preserves the animal's expression. No camera lenses, mechanical teeth, grille nose or exaggerated robot features. Dont change expression. Cream, red and chrome sheet metal, rivets, seams, gauges and antenna complete the robot.
The feeling is charming vintage tin toy brought to life, not cyborg, android or humanoid machinery. Retro-futurist 1950s city softly out of focus. No text or signage. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
  },

  clockwork: {
    id:    'clockwork',
    label: 'Clockwork',
    body: `The animal is built as a clockwork automaton — brass and steel plate over a visible movement, tiny gears, jewelled bearings and coiled springs turning in the openings at the temple, throat and shoulder. The face is shaped brass, its panels following this animal's own brow, cheekbones and jaw, joints hairline-fine where the plates meet. Eyes stay real in size and spacing. The collar rebuilt in engraved plate. Warm brass, blued steel, a little verdigris in the seams. Likeness is critical. Photographic and highly idealized — a real made object in real light, the finest piece of its kind. Background: a watchmaker's bench, loupes and movements out of focus, warm low light. Preserve natural facial character, asymmetry, lines and scars. No real fur, feathers or scales or coat. Make coat, beards, mustaches flat plates with deep grooves to match the existing hairs style and texture as close as possible.
Place the animal inside an intimate old Swiss watchmaker's workshop, warm, cluttered and handcrafted, with the charm of Geppetto's shop. Behind it, tall divided-light wood windows look out onto a narrow old-European district of crooked stone buildings, weathered plaster facades, shop signs and a cobbled pedestrian lane receding into the distance. Shelves and workbenches filled with watchmaker's tools, tiny drawers, brass instruments and half-finished clocks create layers of depth. Warm amber workshop light inside contrasts with soft cool daylight from the street, atmospheric and cinematic. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
  },

  iron: {
    id:    'iron',
    label: 'Iron',
    body: `paw-forged iron sculpture in deep charcoal-black metal with a soft gunmetal sheen — visible hammer-work texture across every surface, burnished highlights on raised features (brow, cheekbones, nose bridge, coat ridges), and darker oxide patina settling into recesses and undercuts. No orange rust anywhere; the palette is charcoal, graphite, and warm gunmetal only. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
  },

  jade: {
    id:    'jade',
    label: 'Carved Jade',
    body: `make the animal into a realistic carved jade statue, dramatic lighting, sub-surface scattering, highly polished. professional grade photography for a magazine cover. No letters, no plaque. The background should be a japanese temple in a cherry blossom park at night (slightly blurred). The eyes are carved jade like the rest of the piece, holding the animal's own eye shape and gaze — never photoreal, amber, or glass eyes. Light transmits through the thinnest sections; the light originates outside the piece and the jade transmits it, never emits. Do not over illuminate facial features internally. Polished but not glassy — a soft waxy lustre. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
  },

  art_deco: {
    id:    'art_deco',
    label: 'Art Deco',
    body: `Redraw the animal as a 1920s Art Deco poster panel — flat graphic illustration with strong bilateral symmetry, crisp geometry and hard-edged colour. The face is simplified into clean planes with a single sharp shadow edge; the coat becomes a bold sculptural shape in flat black or gold. Stepped chevron and sunburst motifs radiate behind the head; fluted vertical lines frame the panel. A luxe restrained palette — black, cream, deep jade and gold leaf, with chrome accents tracing the key lines. Elegant, confident, machine-age. Likeness is critical — the face stays clearly this person. No lettering or text. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
    avoid: `Avoid photographic rendering, organic curves, three-dimensional shading, a relief or sculpture, or garish colour.`,
  },

  ukiyo_e: {
    id:    'ukiyo_e',
    label: 'Ukiyo-e',
    body: `Redraw the animal as a Japanese ukiyo-e woodblock print on warm washi paper — flat unmodulated colour fields, confident dark key-block outlines, the faint woodgrain of the block pressed into the ink. Build the print from many separate blocks: fine carved line describes the folds and pattern of the collar, the individual strands at the hairline, the shape of the ear, the crease of the eyelid. The coat reads as flat black shape with carved highlight lines following its real fall, keeping its length and silhouette. The collar carries a printed textile pattern — small repeating motif in a second colour, seams and folds drawn in line. A restrained palette of soft indigo, ochre, rose and cream paper showing through, with visible registration where colours meet. Behind, a graded bokashi sky, a stylised cloud band, a blossoming branch reaching in from one edge, distant hills in flat blue. A small red seal at a corner. Likeness is critical — the face stays clearly this person. No lettering or text. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
    avoid: `Avoid photographic rendering, gradients within colour areas, Western shading, or a sculpture. This is a flat printed sheet.`,
  },

  watercolour: {
    id:    'watercolour',
    label: 'Watercolour',
    body: `Create an extraordinary contemporary watercolor portrait from the source, worthy of a major watercolor exhibition. Preserve the animals' poses, interaction, expressions and unmistakable identities, but interpret the photograph boldly rather than simply reproducing it.

Paint on exceptionally heavy, medium-gray watercolor paper with a deep pronounced tooth and luxurious handmade texture. The gray paper remains clearly visible throughout the artwork, acting as a sophisticated midtone rather than an empty background.

Make the animals large and commanding, filling most of the sheet and occasionally extending beyond its edges.

Use dramatic contrast between control and freedom. Paint the eyes, expressions and a handful of identifying features with breathtaking precision, then allow the rest to dissolve into loose transparent washes, wet-on-wet blooms, granulation, pigment explosions, backruns, splashes and long spontaneous drips.

THE MARKINGS AND COLORS ARE THE LIKENESS. Preserve their essential placement and relationships, but simplify them into confident gestures and washes. Let natural colors transition selectively into luminous cobalt, turquoise, violet, quinacridone, ochre and burnt sienna while remaining recognizable.

Leave substantial areas of gray paper exposed. Let some edges disappear completely into water and pigment while others snap into exquisite focus. Use the heavy tooth to catch pigment unevenly, creating beautiful granulation and dry-brush texture.

Show just enough of the physical sheet to reveal a few natural deckled edges and a soft shadow beneath the exceptionally thick paper, without pulling attention away from the artwork. The painting should dominate the frame. Museum-quality contemporary watercolor, expressive, sophisticated and unmistakably handmade. NO TEXT.`,
    avoid: `Avoid white paper, smooth paper, sculpture, ceramic, opaque paint, evenly rendered watercolor, coloring-book outlines, uniform detail, literal photographic reproduction, timid pastel washes or digital illustration.`,
  },

  sheet_music: {
    id:    'sheet_music',
    label: 'Sheet Music',
    body: `Transform the entire figure into a museum-quality sculpture constructed from sheet music, musical notation, manuscript pages, and flowing musical scores. The complete sculpture—including head, coat, shoulders and withers, chest, collar fabric, and forelegs—emerges from thousands of folded, curled, layered, and suspended pages. No conventional real surfaces remain anywhere on the form. Musical staffs sweep across the face, neck, shoulders and withers, chest, collar, and forelegs like topographic contours. Notes, rests, clefs, and dynamic markings become structural elements that define the nose, lips, cheeks, coat, collar, shoulder line, and foreleg contours. Hair is formed from cascading ribbons of sheet music twisting through space like melodies frozen in motion. Portions of the sculpture appear to unravel into floating pages and drifting notes, creating a sense of music escaping the form. No real fur, feathers or scales anywhere — the face, neck, forehead and ears are all built from layered notation pages, not coat. The staffs and notation continue across the entire face. This is the most common failure. Avoid flat printed surfaces, 2D sheet music collage, or pages without dimensional architecture. Avoid losing the likeness — the notation follows the animal's true facial structure so they remain clearly recognizable. Sculpture on a base on the stage of an empty symphony hall — music stands and chairs in rows behind, a cello and timpani left where the players finished, tiered seating receding into the dark, one warm working light overhead. Heavily out of focus. Complete full-body sculpture: the whole animal from nose to tail to paws, nothing omitted, simplified or cropped. IF THE ANIMAL IS A HORSE OR OTHER LARGE ANIMAL, frame the head and neck only - a full horse at this scale leaves the head too small to recognise. THE MARKINGS ARE THE LIKENESS - preserve their pattern, placement and proportion exactly, because they do for an animal what facial structure does for a person. The animal's head occupies about 20% of the image. A collar and tags carry through in the same material and are welcome; they are identity, not props. Preserve breed, build, age and natural asymmetry. Add nothing that is not in the source.`,
  },

  quilted: {
    id:    'quilted',
    label: 'Quilted',
    body: `Reimagine the entire source image as an extraordinary museum-quality art quilt made as a thick luxurious queen-size duvet.

Interpret EVERYTHING depicted in the source through the same textile language. Animals, toys, yarn, furniture, plants and every other object become simplified designed shapes constructed from fabric. Nothing within the pictured scene remains realistic or dimensional outside the quilt.

Simplify complex forms, textures and animal markings into intentional groups of color and strong graphic shapes. Preserve the distinctive patterns, expressions, poses and relationships that make the animals recognizable, while allowing an accomplished textile artist to interpret and simplify them.

Construct the image from exquisitely selected cotton, linen, velvet, woven and patterned fabrics using sophisticated piecing, appliqué, embroidery and quilting. Visible seams, layered fabric edges, intricate hand stitching and flowing quilting lines unify the entire composition. Generous batting creates rich dimensional relief and makes the duvet visibly thick, soft and substantial.

The craftsmanship is exceptional — a one-of-a-kind contemporary fiber artwork worthy of a major museum or textile gallery, with sophisticated color harmony, extraordinary material choices and beautiful handmade detail.

Display the large queen-size duvet hanging vertically from an elegant minimal textile display, its substantial thickness, stitched border, gentle folds and weight clearly visible. The quilt fills most of the frame.

The surrounding gallery or refined interior is LIGHT, neutral and HEAVILY BLURRED into soft luminous bokeh. Beautiful diffused natural light reveals the fabric, stitching and relief while keeping all attention on the quilt. NO TEXT.`,
    avoid: `Avoid realistic objects within the quilt, literal yarn or props sitting on its surface, realistic fur, photographic textures, printed photographs, separate stuffed animals, thin blankets, crude patchwork or hobby-craft quality.`,
  },
}

export const PETS_35_IDS = Object.keys(PETS_35)
