// lib/v1/portraits/portraits-bodies.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// CENG-OWNED. THE PROMPT BODIES.
//
// Every body here is WHOLE. It carries its own framing, background, lighting,
// likeness and idealization language. Nothing is prepended, appended or
// composed at request time — what is written here is what NB2 receives.
//
// That is deliberate. Each body was written and shot as a single paragraph
// against real source images. Wrapping it in a universal block stack would
// ship a prompt that differs from the one that was tested.
//
// Consequences:
//   · no framingBlock, no CRAFT_PERSONALITY, no HUE_LOCK, no STUDIO_DIRECTIVES
//   · no universal tail — the §1.3 idealize language is already inside each body
//   · no outpaint, no Pass 2 — those stages were removed 2026-08-01
//
// Retires: EXPERIMENTAL_EFFECTS in portraits-experimental.ts (Portraits-only,
// nothing else imported it) and the MATERIAL_PHRASE / ARTISTS_BLOCKS split.
//
// After editing here, update `body` in effect-registry.ts ('authored' -> 'live')
// and run: node scripts/emit-effect-registry.js
// ─────────────────────────────────────────────────────────────────────────────

export interface EffectBody {
  /** snake_case. Must match the id in effect-registry.ts EXACTLY. */
  id:     string
  /** The complete NB2 prompt. Sent verbatim. */
  body:   string
  /** Negative constraints. Appended by the caller as a separate field, or
   *  concatenated — see buildEffectPrompt below. null where none was written. */
  avoid:  string | null
}

export const EFFECT_BODIES: Record<string, EffectBody> = {

  // ── EARTH & ORE ─────────────────────────────────────────────────

  ebony: {
    id:    'ebony',
    body:  `The subject is carved from a single slab of ebony — dense black heartwood, polished to a deep lustre where the figure is cut, with fine grain running through it. Along one shoulder and down one side the slab keeps its natural live edge: rough pale bark and raw sapwood, unhewn, exactly as the tree grew. The transition is abrupt, a chisel line between polished black and raw edge. The figure and the live edge are one continuous piece of timber — not a carving standing on a separate log, block or plinth. The face and figure are carved smooth and clean; the grain runs in its own natural pattern across broad planes and does not follow the face's own lines. Hair keeps its real length and silhouette, carved in flowing ebony with deep separations catching light. The garment carries through in the same wood. No skin, no real hair. Frame from mid-chest to the top of the head. Face should occupy 30% of the image. Idealized and beautiful. Photographic — a real object photographed in real light, not an illustration. Background: a woodworker's shop at dusk — a bench, hand planes, curls of shaving, warm low light, heavily out of focus. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid a finished bust set on top of a log or stump base. Avoid a uniform polished block with no raw edge. Avoid brown or grey wood — the heartwood is deep black. Avoid grain crossing the eyes, nose or mouth.`,
  },
  // ebony: supersedes old ebony body
  // ebony: Live-edge rewrite. Closes §9 item 6.

  iron: {
    id:    'iron',
    body:  `hand-forged iron sculpture in deep charcoal-black metal with a soft gunmetal sheen — visible hammer-work texture across every surface, burnished highlights on raised features (brow, cheekbones, nose bridge, hair ridges), and darker oxide patina settling into recesses and undercuts. No orange rust anywhere; the palette is charcoal, graphite, and warm gunmetal only. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // iron: Pre-07-03 engine body CONFIRMED GOOD 08-01. Stale-engine list is now EMPTY.

  petrified_wood: {
    id:    'petrified_wood',
    body:  `The subject is carved from a section of petrified wood — ancient timber turned to stone, its growth rings replaced by banded agate and jasper. Deep amber, oxblood, umber and cream run in tight concentric bands through the mass, glassy and hard-polished, with occasional pockets of raw crystal where a void filled. The bands run in their own pattern across broad smooth planes and never follow the face's own lines or features.
The carving holds this person exactly: the same face shape, the same nose, mouth and jaw, the same set of the eyes. Hair keeps its real texture, length and shape — short and tightly coiled stays short and tightly coiled — carved in the same stone. The garment carries through in petrified wood. Likeness is critical and comes before the material.
Frame from mid-chest to the top of the head. Face should occupy 30% of the image. Photographic and highly idealized — a real polished stone object in real light, beautifully made, the finest piece of its kind. Background: desert badlands at low sun, banded rock and scattered fossil logs, long shadows, heavily out of focus.
Preserve natural facial character, asymmetry, lines and scars. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid changing the hair — no lengthening, straightening or restyling. Avoid narrowing or refining the face. Avoid ordinary wood grain or brown timber; this is mineral, glassy and banded. Avoid banding crossing the eyes, nose or mouth. Avoid a rough unhewn edge. Avoid real skin or hair.`,
  },
  // petrified_wood: Fills alabaster's slot. Closes §9 item 5. The negative-example hair clause is what held the likeness.

  stone: {
    id:    'stone',
    body:  `make the subject into a realistic carved Taj Mahal quartzite sculpture — warm ivory-to-honey stone with soft translucent depth and fine gold-brown veining. Roughly a sixth of the piece is still raw quarry stone — irregular grey mottled rock with a fractured, unhewn face — running along the bottom edge and up the right side to about halfway, so the carved figure reads as emerging from the block it was cut from. The transition is abrupt, a chisel line between finished and raw. Nothing stands behind the figure — no slab, wall or backing panel; the sculpture is free-standing against the background. Subtle subsurface scattering: light diffuses just beneath the polished surface, warming the thinnest sections softly. The scattering stays pale and stone-toned — never orange, never a bright glow, and the ears do not light up. Hard directional key light from the upper left with deep shadow across the right half of the face and strong falloff. Professional magazine-cover photography. No letters, no plaque. The face is carved in the cleanest part of the matrix — smooth, evenly toned, no veining crossing the eyes, nose or mouth. Concentrate veining in the garment and shoulders. The entire sculpture is quartzite — no other materials, no real skin, hair or nails. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Background: a conservatory at dusk — cast-iron ribs, rain on glass, cool green light, heavily out of focus. The sculpture stands on a cast-iron plant stand. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // stone: supersedes 07-29 ref version. Label is Quartzite; engine id is `stone`.
  // stone: key renamed 08-02 — was `quartzite`, which meant hasBody('stone') returned false.


  // ── LIGHT & GLASS ───────────────────────────────────────────────

  cast_glass: {
    id:    'cast_glass',
    body:  `The subject is cast in solid kiln-formed glass, thick and heavy, with the softly frosted matte surface of a mould, subtle bevelled edges and faint trapped bubbles. A single cool color throughout, pale sea green or smoke grey. The face is glass all the way through, its forms gracefully simplified into an exceptionally beautiful sculptural interpretation of this person's own face. Preserve what makes the face distinctive rather than making it conventionally perfect.
Hair is cast in the same glass, preserving its real silhouette as a flowing sculptural mass. The garment carries through in cast glass. Closed mouth, expression carried in the eyes. Likeness is critical.
Place the figure naturally beside a beautiful waterfall, surrounded by wet stone, mist and soft vegetation. Cool daylight and reflected water play across the frosted glass, creating restrained caustics and beautiful sculptural shadows. Photographic, atmospheric and highly idealized, a real glass figure existing naturally in the landscape.
Frame from mid-chest to the top of the head. Preserve natural facial character, asymmetry, lines and scars. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // cast_glass: Closes §9 item 8 (cast_glass IN). SSS removed deliberately — it read as flesh. Closed mouth is required: carved teeth in translucent material read as a skull.

  ice: {
    id:    'ice',
    body:  `Transform the entire clothed figure into a softly sculpted form of dense snow and translucent ice, with milky crystalline depth, compacted snowy surfaces, soft frost and occasional clearer icy edges. Increase opacity and softness so the facial structure is beautifully defined rather than glass-like; preserve the subject's likeness precisely with no visible skin. Frame from the top of the head to the chest. Set against an icy cliff with hanging icicles, deep blue glacial shadows and a snow-covered edge catching warm sunlight; golden light falls across one side of the sculpture while cold blue-white light shapes the other, creating a dramatic warm/cool contrast. The subject's own garment carries through in the same material. Keep a clear catchlight in the eyes. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // ice: supersedes 07-29 authored version


  // ── PRINT & PATTERN ─────────────────────────────────────────────

  art_deco: {
    id:    'art_deco',
    body:  `Redraw the subject as a 1920s Art Deco poster panel — flat graphic illustration with strong bilateral symmetry, crisp geometry and hard-edged colour. The face is simplified into clean planes with a single sharp shadow edge; the hair becomes a bold sculptural shape in flat black or gold. Stepped chevron and sunburst motifs radiate behind the head; fluted vertical lines frame the panel. A luxe restrained palette — black, cream, deep jade and gold leaf, with chrome accents tracing the key lines. Elegant, confident, machine-age. Likeness is critical — the face stays clearly this person. Frame from mid-chest to the top of the head. No lettering or text. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid photographic rendering, organic curves, three-dimensional shading, a relief or sculpture, or garish colour.`,
  },
  // art_deco: NEW to Portraits. Ported from Houses curiosities.

  art_nouveau: {
    id:    'art_nouveau',
    body:  `Redraw the subject as an Art Nouveau poster in the manner of Mucha — flat decorative illustration, not a photograph and not a sculpture. Confident dark outlines of even weight describe the face, hair and garment. Colour sits in flat muted fields — sage, dusty rose, ochre, cream — with almost no shading; only the faintest modelling on the face. The hair becomes long sweeping decorative curves, stylised into ornament while keeping its real length and direction. Behind the head, a large circular halo motif filled with stylised flowers and whiplash vine linework. A decorative border frames the panel. Elegant, graphic, ornamental. Likeness is critical — the face stays clearly this person. No lettering or text anywhere. Dont create hair that doesnt exist No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid photographic rendering, three-dimensional shading or realistic light. Avoid a sculpture — this is a flat drawn panel. Avoid lettering, type or signage. Avoid losing the likeness to generic Art Nouveau features.`,
  },
  // art_nouveau: Rich's addition 'Dont create hair that doesnt exist' is the fix — the halo motif was inviting invented hair.

  cubism: {
    id:    'cubism',
    body:  `Redraw the subject as an analytical cubist portrait — the head and shoulders fractured into faceted planes showing the face from several viewpoints at once, profile and full-face folded into one shifting surface. Every feature still appears somewhere: both eyes, the nose, the mouth, the jawline, the hair — recombined across the planes rather than erased. Confident charcoal edges outline each facet. A restrained Braque palette of warm ochre, muted grey-green, umber and soft tan, light and shadow shifting independently across the planes. Likeness survives in the features and their character, not in a single viewpoint. Frame from mid-chest to the top of the head. No lettering. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid dropping any feature, a single photorealistic viewpoint, garish colour, or smooth untextured surfaces.`,
  },
  // cubism: NEW to Portraits. Ported from Houses curiosities.

  daguerreotype: {
    id:    'daguerreotype',
    body:  `Render the subject as an 1840s daguerreotype on a polished silvered copper plate — delicate silvery monochrome, ghostly and precise, tones shifting toward negative where the mirror surface catches light. Fine sharpness across the face, faint tarnish bloom creeping in from the edges, a hairline scratch or two in the silver. Period dress: a dark coat and high collar, or a dark bodice with a lace collar. Behind the sitter, a painted studio backdrop of the era — a soft-focus classical column, a swagged drape, a distant painted landscape, all pale and slightly out of register. Still, formal, unsmiling — the long exposure holds them. The plate fills the frame with only a narrow brass mat at its edge. Likeness is critical. Frame the sitter from the waist to the top of the head. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid modern colour, clean digital sharpness without the silver's tonal shift, a flat paper print, a smile, or a thick decorative case.`,
  },
  // daguerreotype: NEW to Portraits. Ported from Houses curiosities. Case still appears despite the avoid; locked as shot.

  pencil_sketch: {
    id:    'pencil_sketch',
    body:  `A solid sculpted bust of the subject carved entirely from graphite — soft pencil-lead grey with a burnished sheen, the surface worked in visible pencil strokes that wrap the form: crosshatching in the recesses, broad shading across the planes, edges softly smudged. Eyes and lips are graphite. Hair keeps its real length and silhouette in long directional strokes. No skin, no real hair. The garment carries through in the same material. Frame from mid-chest to the top of the head. A real object standing in real light, casting its own shadow. Set in a beautiful old-world artist's atelier — dark timber, plaster walls, antique easels, stacked canvases and old studies pinned around the room, a huge ribbed skylight above flooding it with soft daylight. Monochrome throughout. Likeness is critical. Keep permanent structure: lines, scars and the natural asymmetry of the face. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid a drawing on paper, an easel-mounted picture or any flat image. Avoid a duplicated face. Avoid colour.`,
  },
  // pencil_sketch: REWRITTEN 08-03 by Rich. Solid graphite bust, no paper.
  // Supersedes the 08-02 emerging-from-the-page body, which produced a
  // duplicated face and a reaching arm. Plates reshot 08-03.
  // The atelier below is the house studio for the whole Artists Gallery silo.

  ukiyo_e: {
    id:    'ukiyo_e',
    body:  `Redraw the subject as a Japanese ukiyo-e woodblock print on warm washi paper — flat unmodulated colour fields, confident dark key-block outlines, the faint woodgrain of the block pressed into the ink. Build the print from many separate blocks: fine carved line describes the folds and pattern of the garment, the individual strands at the hairline, the shape of the ear, the crease of the eyelid. The hair reads as flat black shape with carved highlight lines following its real fall, keeping its length and silhouette. The garment carries a printed textile pattern — small repeating motif in a second colour, seams and folds drawn in line. A restrained palette of soft indigo, ochre, rose and cream paper showing through, with visible registration where colours meet. Behind, a graded bokashi sky, a stylised cloud band, a blossoming branch reaching in from one edge, distant hills in flat blue. A small red seal at a corner. Likeness is critical — the face stays clearly this person. Frame from mid-chest to the top of the head. No lettering or text. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid photographic rendering, gradients within colour areas, Western shading, or a sculpture. This is a flat printed sheet.`,
  },
  // ukiyo_e: NEW to Portraits. Ported from lib/v1/houses/houses-curiosities.ts.


  // ── THE ARTISTS GALLERY ─────────────────────────────────────────

  impressionist: {
    id:    'impressionist',
    body:  `Rebuild the subject as a bust sculpted entirely out of thick oil paint — a three-dimensional object, not a painting. Every surface is impasto with real mass: face, hair, neck, shoulders, garment. Broad slabs and ridges of colour laid on with a knife, each stroke standing proud with a hard lifted edge and casting its own small shadow. The hair is the boldest passage, long ropes and sweeps of paint holding the real hairstyle's length and direction. Colours natural to this person's complexion and clothing, pushed and broken — the shadows carried in violet and green rather than grey. Paint runs down over the shoulders and pools on the round base the bust stands on. Likeness is critical; the person reads clearly despite the crudeness of the marks. Frame from mid-chest to the top of the head. The bust stands on a round base. Set in a beautiful old-world artist's atelier, cluttered and eclectic, with dark aged timber, plaster walls, antique easels, stacked canvases, portfolios, drawing tools and old studies casually pinned around the room. Above is a huge ribbed industrial skylight of aged iron and glass, flooding the studio with dramatic soft daylight and long directional shadows. Atmospheric, romantic, slightly dusty, collected over generations rather than designed. Shallow depth of field. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid a flat painting or anything on canvas — this is a solid object standing in a room. Avoid smooth or photo-realistic skin. Avoid thin, blended or evenly applied paint. Avoid grey or black shadows.`,
  },
  // impressionist: paint SCULPTURE — a bust built from impasto, standing in a studio.
  // Not a canvas. oil_impasto is the flat painting; these two must not converge.

  folded_book: {
    id:    'folded_book',
    body:  `Transform the entire figure — face included — into a fine-art sculpture assembled from folded and layered book pages, Every surface is paper: the face, hair, neck, shoulders, chest, garment, and arms are all built from curled paper ribbons, folded pages, and layered printed sheets. The paper layers across the face follow the person's real facial structure — overlapping pages shape the planes of the forehead, brow, nose, cheeks, and lips so the likeness stays clearly recognizable, while the surface reads unmistakably as layered paper rather than skin. Hair is formed from paper ribbons that follow the source subject's actual hairstyle exactly — same length, direction, volume, and character; the paper interprets the real hair and never invents wild curls, paper spirals, or fantasy hair shapes. Broad sweeping ribbons define the major forms; individual printed pages stay visible throughout. Elegant paper architecture. No letters legible, no plaque. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Background: an old library reading room — shelves and low lamps, heavily out of focus. The sculpture rests on a wooden lectern. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid a photo-realistic or smooth lifelike face — the face is built from layered paper like the rest of the figure, not left as skin. Avoid carved relief, engraved surfaces, stacked page-edge carving, paper-cut or woodcut techniques, and topographic page slicing. Avoid chaotic paper strips that destroy the likeness, and avoid generic wild paper curls or spirals replacing the real hairstyle.`,
  },
  // folded_book: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  bronze: {
    id:    'bronze',
    body:  `make the subject into a realistic patinated bronze sculpture — classic warm bronze with deep verdigris settling into the recesses and bright polish on the raised features: brow, cheekbones, nose bridge and jaw. Face, hair and garment all rendered in the same patinated bronze, dignified and tasteful, never costume-like. Hard directional key light from the upper left with deep shadow across the right and strong falloff. Professional magazine-cover photography. No letters, no plaque. The entire sculpture is bronze — no other materials, no real skin, hair or nails. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Background: a civic plaza at dusk, warm low light, heavily out of focus. The sculpture stands on a weathered granite pedestal. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // bronze: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  charcoal_chalk: {
    id:    'charcoal_chalk',
    body:  `Transform the entire figure into a fine-art sculpture constructed from compressed charcoal, broken charcoal sticks, charcoal dust, and white Conté chalk. The complete sculpture—including head, hair, shoulders, chest, garment fabric, and arms—is physically built from charcoal materials with sculptural mass; the sculpture is not drawn. Material density must extend through sweater, shoulders, arms, and base fragments — equal carving complexity across every part of the figure. All planes—face, hair, shoulders, clothing folds, chest, and arms—are carved from dense charcoal masses with visible chisel marks, fractured edges, and layered charcoal fragments. White Conté chalk forms raised highlights and structural details across the entire figure, creating dimensional contrast against deep black charcoal surfaces. Floating charcoal dust, chalk powder, and broken fragments drift in the surrounding air as if the sculpture is still emerging from the material. Hair forms from sweeping charcoal ribbons, fractured charcoal splines, and layered charcoal shards. Avoid drawn charcoal portraits, 2D charcoal renderings, smooth surfaces, blended shading, or paper-as-substrate aesthetics. The charcoal must carry true sculptural depth and physical mass everywhere on the figure. Avoid losing the likeness in the fracturing — the person stays clearly recognizable. Sculpture on a base in a beautiful old-world artist's atelier, cluttered and eclectic, with dark aged timber, plaster walls, antique easels, stacked canvases, portfolios, drawing tools and old studies casually pinned around the room. Above is a huge ribbed industrial skylight of aged iron and glass, flooding the studio with dramatic soft daylight and long directional shadows. Atmospheric, romantic, slightly dusty, collected over generations rather than designed. Shallow depth of field. Large charcoal and chalk drawings in progress pinned to the walls and leaning on easels, drawing boards, sticks of charcoal and Conté in trays, fixative bottles, smudged rags. Strong depth of field heavily blurring the background. Museum gallery lighting reveals the texture of compressed charcoal, chalk buildup, carved surfaces, and airborne particles. Fine-art contemporary sculpture. Dramatic craftsmanship. Highly dimensional, tactile, expressive. Facing the camera directly, warm natural smile, eyes to the viewer. Camera at eye level. Tight close crop — the head and shoulders fill the frame, face occupying at least 40% of the image. Shallow depth of field. No plaque. No legible text on the surrounding works. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // charcoal_chalk: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  chocolate: {
    id:    'chocolate',
    body:  `convert the subject into a rich chocolate sculpture. smooth brown milk chocolate with highly detailed features. do not crop subject. head and shoulders should be visible. Background should be a chocolate shop (blurred). no visible letters. satin sheen on entire sculpture Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // chocolate: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  coral: {
    id:    'coral',
    body:  `Transform the figure into a living coral reef formation — branching staghorn, brain coral, fan coral and encrusting growth building the head, shoulders and chest in warm coral pinks, ochres and cream. The face is clearly defined and unmistakably this person, formed entirely from coral growth, never from skin. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // coral: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  driftwood_resin: {
    id:    'driftwood_resin',
    body:  `Transform the entire figure into a contemporary sculpture combining weathered driftwood and glossy colored epoxy resin — the live-edge resin-river aesthetic. The driftwood preserves the form and the likeness: the face and the structural planes of the head, shoulders, and major contours are carved from pale, silvery, weathered driftwood with visible grain, knots, cracks, and organic live edges, keeping the subject clearly recognizable. Flowing rivers and pools of translucent colored epoxy resin run through and between the wood — deep teal, ocean blue, amber, or emerald — filling the live-edge gaps, the cracks, and the negative spaces, catching and refracting light. The resin is where the color and translucency live; the wood is where the likeness lives. The whole piece is finished in a high-gloss polish so the resin reads as liquid-clear and the wood as satin-smooth. No human skin anywhere — the face, neck, forehead, ears and every visible surface are weathered driftwood, not skin. The wood grain, cracks and live edges continue across the entire face. This is the most common failure. Avoid an all-wood sculpture with no resin, or an all-resin sculpture with no wood — both materials must be present and distinct. Avoid a matte or unfinished surface; the glossy high-polish finish is required. Avoid resin that looks opaque or painted — it must read as translucent, light-catching epoxy. Avoid driftwood so abstract the face stops being recognizable; the wood carries the likeness. Sculpture on a base in a coastal woodworker's studio — a wide window onto grey sea and sky, live-edge slabs leaning against the walls, clamps and resin buckets, sawdust light. Strong depth of field heavily blurring the background. Contemporary gallery presentation. High-gloss finish catching the light. Translucent resin rivers. Weathered live-edge driftwood. Museum-quality craftsmanship. Highly tactile and dimensional. Fine-art mixed-media sculpture. Facing the camera directly, warm natural smile, eyes to the viewer. Camera at eye level. Head, shoulders and upper chest fill the frame with a little breathing room, face roughly 30% of the image. No plaque. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // driftwood_resin: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  fire_face: {
    id:    'fire_face',
    body:  `Sculpt the figure from living fire and ember — the body made of flame, glowing coals and rising sparks that coalesce into the shape of a person. Denser and brighter where the fire gathers into the head and shoulders, thinning into sparks and smoke at the edges. The face is clearly defined and unmistakably this person, formed from flame, never from skin. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // fire_face: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  jade: {
    id:    'jade',
    body:  `make the subject into a realistic carved jade statue, dramatic lighting, sub-surface scattering, highly polished. professional grade photography for a magazine cover. No letters, no plaque. The background should be a japanese temple in a cherry blossom park at night (slightly blurred). The eyes are carved jade like the rest of the piece, holding the subject's own eye shape and gaze — never photoreal, amber, or glass eyes. Light transmits through the thinnest sections; the light originates outside the piece and the jade transmits it, never emits. Do not over illuminate facial features internally. Polished but not glassy — a soft waxy lustre. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // jade: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  lichen_granite: {
    id:    'lichen_granite',
    body:  `The subject is carved directly from a massive ancient granite monolith rising from the forest floor, preserving the subject's likeness while remaining unmistakably part of the original boulder. The stone surface is weathered by centuries of moss, colorful lichens, delicate ferns, creeping vines, and tiny woodland plants that naturally reclaim cracks and ledges, while the subject's existing hair becomes moss, roots, and woodland growth that preserve its original silhouette. Warm shafts of sunlight filter through towering trees, illuminating damp stone and drifting forest particles. Preserve existing clothing naturally carved into the stone, no human skin. Existing clothing remains, carved from the same weathered granite and integrated seamlessly into the monolith. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // lichen_granite: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  mercury: {
    id:    'mercury',
    body:  `Render the subject in liquid mercury caught in dynamic transformation — a mirror-perfect chrome figure in the act of dissolving and re-forming. the clothed figure is hyper-reflective polished liquid metal, but alive with motion: ribbons and sheets of mercury peel and fling outward, droplets break away and hang suspended in the air, and parts of the form stretch into liquid tendrils mid-splash, like the surface of mercury disturbed and frozen at its most dramatic instant. Strong directional gallery light rakes across the chrome so reflections and droplets blaze. Surreal, kinetic, and impossibly fluid — a body in liquid-metal flux, not a static statue. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Never reshape, enlarge eyes, correct asymmetry or de-age. Background: a dark room scattered with coloured lights, heavily out of focus. The piece stands on a brushed steel base. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid a still, solid, symmetric chrome figure — the drama is in the motion, the breaking droplets, and the peeling ribbons of metal. Avoid reflections so chaotic the face is lost; the likeness reads clearly in the mirrored surface. Avoid any non-silver color. Avoid photorealistic skin on the face; it is liquid chrome like the rest.`,
  },
  // mercury: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  neon: {
    id:    'neon',
    body:  `highly detailed neon tube sculpture. fully 3d in all three directions. implied volume. use negative space. use monochromate blues with variations on value. mounted in a small shops storefront window at night, rain on the glass, the shop dark behind. wires and electrical lines visible. at least 100 tubes Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // neon: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  petal_sculpture: {
    id:    'petal_sculpture',
    body:  `The subject is sculpted entirely from thousands of densely layered flower petals, creating a seamless floral sculpture with no visible skin. The likeness emerges through flowing planes of overlapping petals rather than individual flowers, while only occasional blossoms appear to reveal the material. Rich gradients of crimson, scarlet, coral, tangerine, peach, magenta, fuchsia, violet, lavender, and deep burgundy flow naturally across the sculpture like a living oil painting. Hair transforms into sweeping masses of layered petals that preserve the original hairstyle, blending seamlessly into the figure. Dramatic spring sunlight with warm rim light. Avoid bouquets, floral crowns, flower garlands, makeup effects, visible skin, individual flowers covering the face, decorative arrangements, or flowers attached to a person. The petals themselves are the sculptural material. The sculpture stands on a polished dark wood plinth, blurred green foliage behind, warm sunlight from the left. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // petal_sculpture: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  plushy: {
    id:    'plushy',
    body:  `Transform the entire figure into a soft stuffed plush toy — highly detailed. very visible stitching. slightly over stuffed feeling. Very soft. the whole scene is plush and cozy. the entire scene evokes loved, comfy. Likeness is critical. no letters Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Background: a bed with pillows and other stuffed animals, soft daylight, heavily out of focus. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // plushy: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  polished_gold: {
    id:    'polished_gold',
    body:  `Transform the entire figure into a contemporary polished gold sculpture — mirror-bright warm gold with a high specular finish, the surface smooth and flowing with no visible tool marks. Forms are simplified and stylised: broad clean planes across the cheeks, brow and collarbone, features refined rather than literal, hair rendered as a single sweeping sculptural mass of thick ribbon-like locks with deep carved separations catching bright highlights. The subject rests their chin on one hand, elbow drawn in and the forearm rising to meet the jaw — a thoughtful, settled pose. The hand and fingers are fully resolved in gold, long and simplified, with clean separations. A generous figure — head, full shoulders, the whole chest and upper torso — substantial and grounded. No human skin anywhere — the face and hand are polished gold like the rest. Avoid a matte, patinated or antiqued finish. Avoid heavy realistic detail — pores and fine wrinkles are simplified into clean sculptural planes. Avoid malformed or fused fingers. Avoid greenish or reddish gold — warm yellow gold throughout. Background is a gilder's workshop — books of gold leaf on the bench, agate burnishers and squirrel-hair tips laid out, a half-gilded frame propped against the wall, warm low light. Heavily blurred. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // polished_gold: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  reclaimed_bronze: {
    id:    'reclaimed_bronze',
    body:  `Transform the figure into a weathered bronze statue long reclaimed by nature. The metal is deep verdigris — green-blue patina over warm bronze — and across it grows a living layer of soft moss, pale lichen, and a few small ferns sprouting from crevices at the shoulders and base. Some bronze still gleams where rain has worn it smooth; elsewhere nature has taken hold. A romantic image of time passing and beauty in gentle decay. Do not remove clothes or adjust gender. Background: an overgrown formal garden — a hedge gone wild, a stone balustrade, ivy across old brick. green filtered daylight, deep shade, heavily out of focus. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // reclaimed_bronze: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  renaissance: {
    id:    'renaissance',
    body:  `make the subject a realistic photo of a Renaissance nobleman. warm earth palette of umber, ochre, deep red and black. slashed velvet doublet with full soft sleeves, a fine linen shirt at the collar, a single gold chain. no ruff. man facing front, three-quarter turn of the shoulders. zoom in for torso and headshot. face should be 20% of image. calm, settled expression. do not modify ethnicity. Background: a painter's loggia — stone arches opening onto a Tuscan hillside, cypresses, warm late afternoon light, slightly out of focus. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // renaissance: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  sandstone: {
    id:    'sandstone',
    body:  `The subject is sculpted from ancient wind-carved sandstone — flowing strata, natural erosion, weathered edges, and mineral banding that define the face and body while preserving the likeness. The subject's own clothing carries through, carved from the same banded stone. Fine desert sand drifts from the form as low evening light grazes the surface. The original hairstyle becomes weathered sandstone layers. No human skin, eyes, or hair. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // sandstone: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  sea_glass: {
    id:    'sea_glass',
    body:  `The subject is sculpted from a single continuous form of weathered translucent beach glass, with flowing strands of individually worn sea glass preserving the original hairstyle. Frosted seafoam, aqua, emerald, turquoise and cobalt glass glow with brilliant internal caustics and refracted sunlight, while tiny amber fragments appear only as subtle accents. Ocean foam, spray and flowing water wrap naturally around the sculpture as it emerges from the surf. Dramatic backlighting through sea spray. Turn clothing into sea glass and very translucent. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Bright catchlight in both eyes. Never reshape, enlarge eyes, correct asymmetry or de-age. Background: a rocky shoreline in low sun, surf breaking behind, heavily out of focus. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `No skin, ceramic, mosaic or tiled appearance.`,
  },
  // sea_glass: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  sheet_music: {
    id:    'sheet_music',
    body:  `Transform the entire figure into a museum-quality sculpture constructed from sheet music, musical notation, manuscript pages, and flowing musical scores. The complete sculpture—including head, hair, shoulders, chest, garment fabric, and arms—emerges from thousands of folded, curled, layered, and suspended pages. No conventional human surfaces remain anywhere on the form. Musical staffs sweep across the face, neck, shoulders, chest, garment, and arms like topographic contours. Notes, rests, clefs, and dynamic markings become structural elements that define the nose, lips, cheeks, hair, collar, shoulder line, and arm contours. Hair is formed from cascading ribbons of sheet music twisting through space like melodies frozen in motion. Portions of the sculpture appear to unravel into floating pages and drifting notes, creating a sense of music escaping the form. No human skin anywhere — the face, neck, forehead and ears are all built from layered notation pages, not skin. The staffs and notation continue across the entire face. This is the most common failure. Avoid flat printed surfaces, 2D sheet music collage, or pages without dimensional architecture. Avoid losing the likeness — the notation follows the person's true facial structure so they remain clearly recognizable. Sculpture on a base on the stage of an empty symphony hall — music stands and chairs in rows behind, a cello and timpani left where the players finished, tiered seating receding into the dark, one warm working light overhead. Heavily out of focus.  No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // sheet_music: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  stained_glass: {
    id:    'stained_glass',
    body:  `Transform the entire bust into a luminous stained-glass sculpture ΓÇö a dimensional portrait assembled from leaded cathedral glass. The complete form (head, hair, shoulders, chest, garment, and arms) is built from individual cut-glass cells in rich jewel tones ΓÇö sapphire, ruby, amber, emerald, cobalt, and gold ΓÇö each piece separated by dark leading (came lines) that trace the contours of the face, hair, and garment like a master glazier's drawing. The glass is genuinely translucent: light passes through from behind and within, so the piece glows from the inside rather than reading as a flat colored surface. Deeper, more saturated glass sits in the shadows; paler, brighter glass catches the backlight at the high points. The leading defines the structure and the likeness; the glowing glass carries the color and life. For couples or two subjects, render them as two figures in adjacent leaded panels. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid a flat opaque mosaic, painted-on color, or a 2D stained-glass window with no dimensional form. Avoid glass without visible leading/came lines between the cells. Avoid a uniformly lit surface with no backlit glow ΓÇö the inner luminosity and the dark leading are both required. Avoid muddy or desaturated glass; the cathedral-glass jewel tones must read as vivid and lit.`,
  },
  // stained_glass: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  tidewood: {
    id:    'tidewood',
    body:  `The subject is sculpted from weathered driftwood shaped by decades of wind, waves, and saltwater, with deeply textured grain flowing naturally through the face and body while preserving the subject's likeness. Brilliant translucent blue-green resin fills natural cracks and knots, glowing from within with ocean caustics, tiny trapped bubbles, and refracted light. preserve the original hairstyle as flowing driftwood and resin, no human skin. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Background: a timber boathouse deck, grey sea light, heavily out of focus. The sculpture rests on a raw driftwood block. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // tidewood: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  watercolour: {
    id:    'watercolour',
    body:  `Rebuild the subject as a three-dimensional bust painted in watercolour — a solid object with real volume, not a picture on paper. The whole form is soft transparent washes: the face, hair, shoulders and garment modelled in light and shade, with hard edges where a wash dried against itself and the white of the surface left bare at the brightest points. The paint is still wet. Colour runs down the shoulders and the front of the garment in fine coloured rivulets and drips, gathering in bright pools of red, ochre and violet on the round white board the bust stands on. Colours natural to this person's complexion and clothing, transparent and luminous, granulating in the low spots. Likeness is critical. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. Keep permanent structure: lines, scars and the natural asymmetry of the face. Never reshape, enlarge eyes, correct asymmetry or de-age. Set in a beautiful old-world artist's atelier, cluttered and eclectic, with dark aged timber, plaster walls, antique easels, stacked canvases, portfolios, drawing tools and old studies casually pinned around the room. Above is a huge ribbed industrial skylight of aged iron and glass, flooding the studio with dramatic soft daylight and long directional shadows. Atmospheric, romantic, slightly dusty, collected over generations rather than designed. Shallow depth of field. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid a flat painting or anything on paper — this is a solid object standing on a board. Avoid opaque or body colour. Avoid a photographic face. Avoid a bright white modern gallery; the room is an old cluttered atelier.`,
  },
  // watercolour: a SCULPTURE with wet washes running off it onto a board. NOT a flat
  // painting on paper — that was the failure case. Atelier, not a white studio.

  wild_west: {
    id:    'wild_west',
    body:  `make the subject a realistic photo of a frontier man of the American West, 1880s. muted palette of dust, tobacco brown, faded indigo and oxblood — low in contrast, no clean whites, everything worn and sun-faded. a wool waistcoat over a collarless shirt, a knotted neckerchief, a broad felt hat creased and stained with wear. man facing front, three-quarter turn of the shoulders. framed from mid-chest to the top of the hat. face should be 20% of image. do not crop the hat. calm, settled expression, weathered skin. do not modify ethnicity. likeness is important. Background: a saloon back room — plank walls, a stove, bottles on a shelf, one dirty window off to the left. deep shadow, warm dim light falling off fast. heavily out of focus, only shapes and glow readable. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // wild_west: restored VERBATIM from the CENG batch files 08-02. Do not rewrite from plates.

  linocut: {
    id:    'linocut',
    body:  `Redraw the subject as a hand-cut linocut print — bold black ink on cream paper, the image built entirely from carved marks. Broad cleared areas of pure white, dense black masses, and the form described by parallel gouge strokes that swell and taper. Visible slips of the blade and small imperfect edges where the lino chipped. The hair is a solid black shape cut with a few sweeping white gouges. One second colour, a flat overprinted ochre or red, slightly out of register. Likeness is critical. Frame from mid-chest to the top of the head. No lettering. The print lies on a bench, its edges curling. Set in a beautiful old-world artist's atelier, cluttered and eclectic, with dark aged timber, plaster walls, antique easels, stacked canvases, portfolios, drawing tools and old studies casually pinned around the room. Above is a huge ribbed industrial skylight of aged iron and glass, flooding the studio with dramatic soft daylight and long directional shadows. Atmospheric, romantic, slightly dusty, collected over generations rather than designed. Shallow depth of field. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid grey tones or shading — the image is black, white and one flat colour. Avoid photographic rendering. Avoid a sculpture.`,
  },
  // linocut: NEW.

  oil_impasto: {
    id:    'oil_impasto',
    body:  `Repaint the subject in thick oil applied entirely with a palette knife on canvas — broad flat slabs of colour laid edge to edge, each stroke a single confident pass with a hard ridge where the knife lifted. No blending anywhere, no brushwork. The face is built from maybe forty knife strokes, the planes reading through colour temperature rather than line, and the likeness carried by where the warm and cool slabs meet. A rich restrained palette — the subject's own colours pushed, umber and ochre against slate and near-black. The garment in wider, looser slabs, and the background in the broadest of all, blocked in around the head. Likeness is critical; the person reads clearly at a distance. Frame from mid-chest to the top of the head. A flat canvas standing on a wooden easel, raking light across the surface so the paint's thickness casts its own small shadows. Set in a beautiful old-world artist's atelier, cluttered and eclectic, with dark aged timber, plaster walls, antique easels, stacked canvases, portfolios, drawing tools and old studies casually pinned around the room. Above is a huge ribbed industrial skylight of aged iron and glass, flooding the studio with dramatic soft daylight and long directional shadows. Atmospheric, romantic, slightly dusty, collected over generations rather than designed. Shallow depth of field. Preserve natural facial character, asymmetry and expression. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid a three-dimensional sculpture or a bust — this is flat paint on a canvas. Avoid brushwork or blended gradients. Avoid a smooth photographic face. Avoid broken dabs and short strokes; every mark is a wide knife slab.`,
  },
  // oil_impasto: FLAT canvas on an easel in the house atelier. Knife slabs only —
  // kept deliberately distinct from impressionist, which is the paint sculpture.


  // ── MADE BY HAND ────────────────────────────────────────────────

  balloon_face: {
    id:    'balloon_face',
    body:  `Transform the subject into a sculpture built from inflated balloons — glossy latex in twisted and pressed segments, the face, hair and garment all formed from balloon shapes tied and bunched into the person's own structure. Taut curved surfaces with bright specular highlights, the pinch and knot visible where segments meet, faint seams running the length of each balloon. Warm coral, rose, cream and gold. The face is balloon throughout — no skin, no real hair. Likeness is critical; the features read clearly through the rounded forms. Frame from mid-chest to the top of the head. Face should occupy 30% of the image. Idealized and beautiful. Photographic — a real object photographed in real light, not an illustration. Background: a bright party hall, streamers and lights out of focus behind. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid a face painted onto a balloon. Avoid real skin or hair. Avoid a balloon animal or novelty shape. Avoid losing the likeness to rounded generic features.`,
  },
  // balloon_face: First captured body. Refs existed, prompt never did.

  beaded: {
    id:    'beaded',
    body:  `highly detailed sphere basic sculpture of the subject in the photo.  Subject should be framed chest to head. face should occupy 30% of image. the sculpture is fully 3d and made from beads and orbs of different sizes that are lighting with an internal falloff. The color of the spheres, orbs and beads are monochromatic greens with variations in value to create interest. Leave some negative space to show volume. likeness is important. . the sculpture ends at the chest with shoulders and garment resolved in beads. Background is an Indian dye market — deep jade and sage  and verdant pigment heaped in open sacks and brass bowls, stained cloth hanging above, warm low light from a doorway. Heavily blurred. No real skin, hair. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Keep the eyes human
Place the sculpture on a turned warm walnut indian style pedastal that is smooth polished No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // beaded: supersedes 07-30 red free-floating version, and the green free-floating version locked earlier the same day

  origami: {
    id:    'origami',
    body:  `The subject is folded from paper — a single continuous sheet worked into the whole figure, every plane a crisp fold with a visible crease line, the paper's own grain and slight thickness reading at each edge. The face is built from a few confident planes: the brow, the bridge of the nose, the cheeks, the jaw, each a flat facet meeting at a sharp crease. Warm cream and soft indigo paper. Hair keeps its real shape and volume, folded in tighter pleats. The garment folds through in the same paper. Likeness is critical — the person reads clearly through the faceting. Frame from mid-chest to the top of the head. Face should occupy 30% of the image. Photographic and highly idealized — a real folded object in real light. Background: a bare table under one soft lamp, deep shadow, heavily out of focus. Preserve natural facial character and asymmetry. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid curved or moulded surfaces — every form is a flat fold. Avoid a paper crane or novelty shape. Avoid torn or crumpled paper. Avoid real skin or hair.`,
  },
  // origami: NEW.

  porcelain: {
    id:    'porcelain',
    body:  `The subject is modelled in glazed porcelain — fine white clay, hand-thrown and kiln-fired, with a soft glassy glaze pooling in the hollows and thinning to near-white on the raised planes. Hand-painted cobalt blue decoration runs across the garment and shoulders in small repeating floral motifs, the brushwork slightly uneven as a real hand leaves it. Fine crazing across the glaze, a chip at one edge, the unglazed foot showing raw biscuit. The face is porcelain throughout, glaze catching a single soft highlight on the cheek and brow. Hair keeps its real texture, length and shape, modelled in the same clay. Likeness is critical and comes before the material. Frame from mid-chest to the top of the head. Face should occupy 30% of the image. Photographic and highly idealized — a real fired object in real light, beautifully made. Background: a potter's shelf, other pieces out of focus behind, north light. Preserve natural facial character, asymmetry, lines and scars. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid changing the hair. Avoid a plastic or resin look — this is fired clay under glaze. Avoid decoration crossing the face. Avoid real skin or hair.`,
  },
  // porcelain: NEW. Named imperfections (chip, crazing, uneven brushwork) are what sell it as fired rather than rendered.

  quilted: {
    id:    'quilted',
    body:  `The subject is sewn from quilted fabric — panels of patterned cotton pieced together and stitched, with visible seams, running stitch lines and the soft puff of batting between the layers. The face is quilted cloth throughout: pieced panels shaped to the brow, cheeks and jaw, the stitching following the planes rather than the features. Eyes and mouth are embroidered in thread. Hair is cut and layered fabric in the real style and length. A folk palette of faded indigo, madder red, ochre and cream, prints small and repeating, the cloth softly worn. The garment carries through in pieced quilt. Likeness is critical. Frame from mid-chest to the top of the head. Face should occupy 30% of the image. Idealized and beautiful. Photographic — a real object photographed in real light, not an illustration. Background: a quilter's room — a frame, folded bolts, a window with soft daylight, heavily out of focus. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid real skin or hair. Avoid a flat printed quilt or wall hanging — this is dimensional and sewn. Avoid a rag doll or novelty toy. Avoid stitching that traces the wrinkles of the face.`,
  },
  // quilted: Closes §9 item 8 (quilted IN). A later variant with thread hair + button eyes shot well and is worth exploring, not locked.


  // ── FANTASY & FUTURE ────────────────────────────────────────────

  clockwork: {
    id:    'clockwork',
    body:  `The subject is built as a clockwork automaton — brass and steel plate over a visible movement, tiny gears, jewelled bearings and coiled springs turning in the openings at the temple, throat and shoulder. The face is shaped brass, its panels following this person's own brow, cheekbones and jaw, joints hairline-fine where the plates meet. Eyes stay human in size and spacing. Hair keeps its real style and length in fine drawn brass wire. The garment rebuilt in engraved plate. Warm brass, blued steel, a little verdigris in the seams. Likeness is critical. Frame from mid-chest to the top of the head. Face should occupy 30% of the image. Photographic and highly idealized — a real made object in real light, the finest piece of its kind. Background: a watchmaker's bench, loupes and movements out of focus, warm low light. Preserve natural facial character, asymmetry, lines and scars. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid a mask laid over a face. Avoid lens eyes or exaggerated robot features. Avoid changing the hair. Avoid real skin.`,
  },
  // clockwork: NEW.

  dragon_skin: {
    id:    'dragon_skin',
    body:  `Transform the subject into a dragon-human hybrid — the entire head and figure surfaced in fine iridescent dragon scale, deep emerald and oil-slick violet shifting through bronze and gold. The face is scale all the way through, including the mouth — scaled lips, no human teeth or gums. Larger armored scale across the shoulders and chest, finer across the face. Hair keeps its real length and silhouette, rendered as scaled tendrils. A full dragon's body grows from the back — spined neck, ridged spine, a serpentine body curving down and away. Horns rise from the crown. Rebuild the garment in overlapping scale plate. Remove glasses and worn accessories. The face is turned to the camera and lit, clearly this person. Powerful, mythic, jewel-like. Photographic. Frame from mid-chest to the top of the head. Face should occupy 30% of the image. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Background: a rock ledge at dusk, a cliff falling into haze behind, cold light from the left and warm firelight from the right, heavily out of focus. Maintain expression of the subject. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid human lips, teeth or hair. Avoid glasses and worn accessories. Avoid the source fabric showing through the scale. Avoid an illustrated look.`,
  },
  // dragon_skin: supersedes 07-30 version
  // dragon_skin: §1.3 garment tail line deliberately REMOVED — it was preserving the source shirt.

  forest_guardian: {
    id:    'forest_guardian',
    body:  `The subject has become an ancient forest guardian, the entire head and figure carved from a single piece of deeply weathered oak heartwood — bark and grain are the substance, not a surface laid over skin. The whole face is wood: brow, cheeks, nose, lips and eyelids all carved, with no patch, seam or window of real skin anywhere. The hair becomes living roots, vines, moss and trailing ivy, keeping its original length, silhouette and movement. Tiny mushrooms, lichen and fresh growth emerge from the wood. The grain and fissures run in their own natural pattern across broad smooth planes — they do not follow or deepen the face's own lines and folds. Keep the grain coarser on hair, garment and edges; the central face stays finer. Frame from mid-chest to the top of the head. Face should occupy 30% of the image. Warm shafts of sunlight through the forest canopy. Flattering soft key light, shadow separating jaw from neck. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Background: deep forest, warm shafts of light through the canopy, heavily out of focus. The form rises from a mossy fallen trunk. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // forest_guardian: supersedes 07-30 cut version
  // forest_guardian: id still unresolved — took moss_stone's slot. OPEN.

  magic_energy: {
    id:    'magic_energy',
    body:  `Sculpt the figure from pure glowing magical energy — swirling luminous energy, flowing ribbons of light, drifting embers, and crackling arcs of colour — violet, gold, cyan, and rose — that coalesce into the shape of a person. Denser and brighter where the energy gathers into the head, shoulders, and chest; thinning into wisps, sparks, and floating motes at the edges. The face is clearly defined and unmistakably this person, formed from light and energy, never from skin. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. fully 2d idealized illustration.
deep purple gradient background with wam light falling off to dark. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // magic_energy: supersedes pre-07-03 engine text
  // magic_energy: Family moved particulate -> flat_2d illustration. Typo 'wam' left as locked.

  retro_robot: {
    id:    'retro_robot',
    body:  `Transform the subject into a charming atomic-age tin robot, unmistakably the same person. Preserve the exact silhouette, shape and proportions of the subject's face, and preserve the natural size, spacing and placement of their features. Construct that familiar face from a few simple, smoothly pressed pieces of enamelled sheet metal, rather than reproducing human skin or substituting mechanical facial features.
Eyes remain the subject's normal size and shape, set naturally into the metal face. The mouth is a simple articulated metal mouth that preserves the subject's expression. No camera lenses, mechanical teeth, grille nose or exaggerated robot features. Dont change expression.
Zoom out to frame from chest to top of head. face should be 25% of the image
Hair is overlapping pressed-metal strips about the width and thickness of gum wrappers, following the subject's real hairstyle, length and volume. Cream, red and chrome sheet metal, rivets, seams, gauges and antenna complete the robot.
The feeling is charming vintage tin toy brought to life, not cyborg, android or humanoid machinery. Retro-futurist 1950s city softly out of focus. No text or signage. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // retro_robot: supersedes 07-29 authored version
  // retro_robot: The gum-wrapper hair spec is the key finding of the session — a named craft object beats any describing clause.

  starfield: {
    id:    'starfield',
    body:  `The subject is formed from deep space — the body a volume of dark nebula gas, dust lanes and scattered stars that coalesce into the shape of a person. Denser and brighter through the head and shoulders, thinning to loose star fields at the edges. Cool indigo, teal and violet with a few warm gold stars threaded through. The face is clearly defined and unmistakably this person, formed from cloud and light, never from skin. Fully 2d idealized illustration. Frame from mid-chest to the top of the head. Deep black background falling off from the figure's own glow. Keep permanent structure: lines, scars and the natural asymmetry of the face. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid a solid body with stars painted on top. Avoid photographic rendering. Avoid real skin.`,
  },
  // starfield: NEW. Replaces the failed `cosmic`.


  // ── THE LIVING WORLD ────────────────────────────────────────────

  crystallized: {
    id:    'crystallized',
    body:  `The subject has crystallized out of solution — the whole figure grown as a single mineral formation, blue-green copper sulfate and alum crystals packed dense and interlocking, the entire mass crystal all the way through with no skin beneath. Sharp faceted blocks build the broad planes of the brow, cheek and jaw; finer needle growth crowds the hollows and the edges. The eyes are smooth polished crystal — clean rounded facets, calm and legible, holding a single bright specular point each. No needles, spines or fine growth anywhere near the eyes, and no lashes, whites or wet surface. Deep vitriol blue shading to pale aqua and clear, each facet catching a hard specular point. Hair keeps its real length and silhouette, grown as long bladed crystal. The garment carries through in the same growth. Likeness is critical and comes before the material. Frame from mid-chest to the top of the head. Face should occupy 30% of the image. Photographic and highly idealized — a real specimen in real light, strange and beautiful. Background: a laboratory bench in low light, beakers and glassware out of focus, one hard light source. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid needle or spiked crystal around the eyes. Avoid real eyes, lashes or eye whites. Avoid crystals growing on a real person — the figure is crystal throughout. Avoid changing the hair. Avoid real skin or hair. Avoid a warm palette.`,
  },
  // crystallized: NEW. Replaces the rejected `salt_crystal`.

  sand_form: {
    id:    'sand_form',
    body:  `The subject is formed entirely from desert sand — a face and figure held for a moment in drifting dune, the whole mass loose grain all the way through with no skin, teeth or real hair anywhere. The lips, eyes and mouth are sand like everything else. The windward side is sharp and fully resolved; on the leeward side the wind has scooped a shallow cavity out of the cheek and temple, the edge crumbling and streaming off into the air in fine ribbons, the shoulder dissolving into the dune it rises from. Warm ochre, bone and pale gold, the low sun raking across and throwing the ripple texture into relief. The face is clearly this person while it lasts — brow, cheek and jaw carved by wind rather than hand. Hair keeps its real length and silhouette, streaming back as blown sand. Likeness is critical. Frame from mid-chest to the top of the head. Face should occupy 30% of the image. Photographic and highly idealized — beautiful, quiet, already going. Background: windblown dunes at low sun, a sky bleached pale, heavily out of focus. Preserve natural facial character, asymmetry, lines and scars. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid sand dusted over a real person. Avoid real skin, lips, teeth, eyes or hair. Avoid a solid sandstone carving — this is loose grain, mid-collapse. Avoid a symmetrical or fully intact face.`,
  },
  // sand_form: NEW. Distinct from `sandstone`, which is carved and permanent.


  // ── ANOTHER AGE ─────────────────────────────────────────────────

  deco_twenties: {
    id:    'deco_twenties',
    body:  `make the subject a realistic photo of a man at a party in 1926. black dinner jacket with satin lapels, white wing-collar shirt, black bow tie, a white silk pocket square. hair slicked flat and pomaded with a hard side part, clean shaven. man facing front, three-quarter turn of the shoulders. framed from mid-chest to the top of the head. face should be 20% of image. calm, settled expression, faint smile. do not modify ethnicity. likeness is essential. Background: a hotel ballroom — mirrored panels, gold sunburst motifs, low warm lamps, cigarette haze. deep shadow, hard glamour lighting falling off fast. heavily out of focus, only shapes and glow readable. No other people in frame. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },

  deco_twenties_woman: {
    id:    'deco_twenties_woman',
    body:  `make the subject a realistic photo of a woman at a party in 1926. a beaded drop-waist evening dress with a low scooped neck, long ropes of pearls, a beaded headband low across the brow, drop earrings. hair in a short marcel wave close to the head. woman facing front, three-quarter turn of the shoulders. framed from mid-chest to the top of the head. face should be 20% of image. calm, settled expression, faint smile. do not modify ethnicity. likeness is essential. Background: a hotel ballroom — mirrored panels, gold sunburst motifs, low warm lamps, cigarette haze. deep shadow, hard glamour lighting falling off fast. heavily out of focus, only shapes and glow readable. No other people in frame. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // deco_twenties_woman: 07-30 body CONFIRMED as-is 08-01.

  elizabethan: {
    id:    'elizabethan',
    body:  `Transform the subject into a sumptuous Elizabethan court portrait, preserving his facial likeness and ethnicity. Dress him as an aristocratic gentleman of the Elizabethan court in rich velvet, silk and brocade, with an elaborate lace ruff and period jewelry.
Head turned 30 degress left. eyes look to the side
Noble, composed presence. Sumptuous, deeply romantic and highly idealized, with luminous warm skin, rich jewel tones, glowing highlights and deep velvety shadows. An opulent Elizabethan interior dissolves behind him into warm candlelight and soft darkness. Like a magnificent Elizabethan portrait brought vividly to life. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // elizabethan: Painted register, deliberately unlike the woman. Shortest costume body in the catalog. Closes a §8 gap.

  elizabethan_woman: {
    id:    'elizabethan_woman',
    body:  `Transform the subject into a lavish Elizabethan court portrait, preserving her facial likeness precisely. Dress her in an extravagant deep sapphire velvet court gown with elaborate antique-gold embroidery, pearl-strung bodice, cream lace cuffs and a magnificent sculptural lace ruff. Crown the silhouette with an ornate pearl-and-gold jewelled headdress, feathers and richly dressed period hair.
Pose her in graceful three-quarter view, chin slightly raised, with the serene, self-possessed expression of a royal court portrait. Looking to the side. Deep saturated sapphire, peacock blue, crimson accents, luminous pearl, ivory and antique gold dominate the image.
Romantic painterly photography with luminous skin, rich directional candlelight, glowing golden highlights, deep velvety shadows and jewel-like color. An opulent Elizabethan great hall dissolves behind her into dark tapestries, carved wood, distant candlelight and warm amber bokeh. make the skin slightly pale
Zoom to frame subject from chest to top of head.
Make the portrait sumptuous, theatrical and highly idealized, like an Elizabethan royal panel portrait brought vividly to life. Subtle aged photographic finish with softened blacks, warm highlights and gentle painterly grain while retaining saturated color and exquisite detail.
Frame generously from the upper torso through the entire headdress, with the full ruff and headdress visible. Preserve the subject's face, age, ethnicity, proportions and natural asymmetry.
age the photo with filters so it feels more like a painterly photo and older No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // elizabethan_woman: First captured body for this id. Closes a §8 gap.

  persian_court: {
    id:    'persian_court',
    body:  `make the subject a realistic photo of a Persian nobleman of the Safavid court. deep rich palette of crimson, gold and umber — muted and low in contrast, no clean whites, aged and softened. a wound silk turban, a brocade robe over a fine linen shirt, layered strands of pearl at the neck. man facing front, three-quarter turn of the shoulders. framed from mid-chest to the top of the turban. face should be 20% of image. do not crop the turban. calm, settled expression. do not modify ethnicity. Background: a palace interior — carved stucco, a faded hanging, an oil lamp, deep shadow, warm dim lamplight falling off fast. heavily out of focus, only shapes and glow readable. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // persian_court: 07-30 body CONFIRMED as-is 08-01. A matched rewrite was authored and REJECTED — do not resurrect.

  persian_court_woman: {
    id:    'persian_court_woman',
    body:  `Transform the subject into a sumptuous romantic photograph of a Persian noblewoman of the Safavid court, preserving her facial likeness and ethnicity. Dress her in rich crimson and gold brocade, layered pearls, delicate gold jewelry, and a fine silk veil flowing from a small jeweled cap, with her hair falling loosely beneath it.
make the subject a Persian noblewoman of the Safavid court, photographed by available lamplight — real skin texture, shallow depth of field, the falloff of a single flame.
Graceful three-quarter pose, serene expression. Luminous warm skin, soft romantic light, glowing highlights and deep velvety shadows. An opulent Safavid palace interior dissolves behind her into warm lamplight and golden bokeh. Rich crimson, antique gold and warm umber, softly aged and painterly. Luxurious, romantic and highly idealized, like a historic Persian oil portrait brought vividly to life. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // persian_court_woman: supersedes 07-30 version

  renaissance_woman: {
    id:    'renaissance_woman',
    body:  `make the subject a realistic photo of a Renaissance noblewoman. warm earth palette of umber, ochre, deep red and black. velvet gown with a squared low neckline over a fine linen chemise, full sleeves tied at the shoulder with the chemise puffing through the lacing, hair parted at the centre and dressed with a fine pearl net, a single gold chain. no ruff. woman facing front, three-quarter turn of the shoulders. zoom in for torso and headshot. face should be 20% of image. calm, settled expression. do not modify ethnicity. Background: a Renaissance interior — a plastered wall in warm ochre, a carved walnut chest, a heavy tapestry with faded figures, a leaded window off to the left throwing one shaft of light. deep shadow, warm dim air, slightly out of focus. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // renaissance_woman: logged 08-02 from Rich. §1.3 tail expanded inline per bodies-are-whole.

  samurai: {
    id:    'samurai',
    body:  `Professional cinematic portrait of a male samurai in authentic Edo-period armor, layered red lacquered lamellar plates and thick silk lacing, with the convincing weight, wear and imperfection of real historical armor. Hair naturally arranged beneath the helmet.
use foreshortening and strong dynamic lighting. age the photo with filters. reduce saturation on skin tones.
Strong late-afternoon sunlight sweeps across him from the side, sculpting the face and armor with luminous highlights and deep expressive shadows.
Photographic realism with the richness and visual poetry of a great painted portrait — atmospheric, tactile and subtly painterly without becoming an illustration. Rich restrained color, beautiful falloff, shallow depth of field, softly impressionistic Japanese setting. Idealized and striking while remaining completely believable as a photograph. Preserve facial likeness and permanent features. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // samurai: FIRST captured body for this id. Closes the last §8 no-prompt gap. Red/blue pair split is now deliberate; §9 item 11 CLOSED.

  samurai_woman: {
    id:    'samurai_woman',
    body:  `Professional cinematic portrait of a female samurai in authentic Edo-period blue lacquered armor, layered lamellar plates and thick silk lacing, with the convincing weight, wear and imperfection of real historical armor. Hair tied beneath the helmet with a few loose strands escaping.
use foreshortening and strong dynamic lighting. age the photo with filters
Strong late-afternoon sunlight sweeps across her from the side, sculpting the face and armor with luminous highlights and deep expressive shadows.
Photographic realism with the richness and visual poetry of a great painted portrait — atmospheric, tactile and subtly painterly without becoming an illustration. Rich restrained color, beautiful falloff, shallow depth of field, softly impressionistic background. Idealized and striking while remaining completely believable as a photograph. Preserve facial likeness and permanent features. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // samurai_woman: supersedes 07-30 documentary version, and an intermediate 08-01 spear version

  victorian: {
    id:    'victorian',
    body:  `Transform the subject into a lavish Victorian aristocratic portrait, preserving his facial likeness precisely. Dress him in a dramatic deep teal velvet frock coat, richly patterned jewel-toned silk waistcoat, cream silk cravat with an ornate turquoise and gold pin, gold watch chain, and an elegant tall silk top hat. Subtle gold embroidery and luxurious period detailing.
Pose him in graceful three-quarter profile, chin slightly raised, gazing serenely into the distance. Deep saturated teal, peacock blue, burgundy, turquoise and antique gold dominate the portrait. Romantic painterly photography with luminous warm skin, rich directional light, glowing gold highlights, deep velvety shadows and jewel-like color. An opulent Victorian interior dissolves behind him into dark teal, warm amber and golden bokeh.
Make the portrait sumptuous, theatrical and slightly idealized, like a richly painted Victorian society portrait brought to life. Give the image a subtle aged photographic finish with softened blacks, warm highlights and gentle painterly grain, while retaining saturated color and luminous detail.
Preserve the subject's face, age, proportions and natural asymmetry. Refine temporary skin imperfections without changing his identity. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // victorian: supersedes 07-30 parlour version

  victorian_woman: {
    id:    'victorian_woman',
    body:  `Transform the subject into a sumptuous Victorian aristocratic portrait, preserving her facial likeness precisely. Dress her in an extravagant jewel-toned silk gown with elaborate gold embroidery, cream lace, turquoise gemstones and an ornate wide-brimmed hat overflowing with flowers, lace and sweeping feathers. Hair elegantly pinned with soft curls framing the face.
Pose her in graceful three-quarter profile, chin slightly raised, looking serenely into the distance with a soft, composed expression. Rich teal, turquoise, ivory and antique gold throughout. Romantic painterly photography with luminous warm skin, soft directional window light, glowing highlights, deep velvety shadows and shallow depth of field. An opulent Victorian interior dissolves softly behind her into jewel-toned color and golden bokeh. Luxurious, romantic and idealized, like a Victorian oil portrait brought vividly to life.
use a color palette and filter to age the photograph slightly so it doesnt feel brand new
Preserve the subject's face, age, proportions and natural asymmetry. Refine temporary skin imperfections without changing her identity. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // victorian_woman: supersedes 07-30 authored parlour version

  wild_west_woman: {
    id:    'wild_west_woman',
    body:  `make the subject a realistic photo of a frontier woman of the American West, 1880s. muted palette of dust, tobacco brown, faded indigo and oxblood — low in contrast, no clean whites, everything worn and sun-faded. a high-collared calico bodice buttoned to the throat, a small cameo at the collar, a wool shawl over the shoulders. hair pinned up but loosening, strands falling around the face. woman facing front, three-quarter turn of the shoulders. framed from mid-chest to the top of the head. face should be 20% of image. calm, settled expression, weathered skin. do not modify ethnicity. Likeness is essential. Background: a saloon back room — plank walls, a stove, bottles on a shelf, one dirty window off to the left. deep shadow, warm dim light falling off fast. heavily out of focus, only shapes and glow readable. Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: null,
  },
  // wild_west_woman: logged 08-02 from Rich. §1.3 tail expanded inline per bodies-are-whole.

}

// ── ACCESSORS ────────────────────────────────────────────────────────────────

export function hasBody(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(EFFECT_BODIES, id)
}

export function getBody(id: string): EffectBody {
  const b = EFFECT_BODIES[id]
  if (!b) throw new Error(`No prompt body for effect id: ${id}`)
  return b
}

export function listBodyIds(): string[] {
  return Object.keys(EFFECT_BODIES)
}

/** The only prompt builder Portraits needs. Body verbatim, avoid appended on
 *  its own line if present. No blocks, no universal stack, no interpolation. */
export function buildEffectPrompt(id: string): string {
  const b = getBody(id)
  return b.avoid ? `${b.body}\n\n${b.avoid}` : b.body
}
