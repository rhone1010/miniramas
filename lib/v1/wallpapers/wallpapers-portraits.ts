// lib/v1/wallpapers/wallpapers-portraits.ts
//
// PORTRAITS SILO — 14 wallpaper effects, 9:16, download only.
//
// Rich's selection, 2026-08-10. Fourteen tiles, three rows of five with an
// upsell card in the fifteenth slot. More can be toggled in from the
// Portraits catalog; these are the ones he wants first.
//
// ── WHERE THIS TEXT CAME FROM ──────────────────────────────────────────
//
// Every body is Rich's approved Portraits text, lifted verbatim from
// lib/v1/portraits/portraits-bodies.ts with ONE mechanical change: the bust
// framing sentence removed. Nothing else was rewritten — not a clause, not
// a typo, not a run-on.
//
// The exception is `neon`, which Rich rewrote and locked against a live
// render on 2026-08-10 and is carried verbatim as he wrote it.
//
// ── WHY THE FRAMING SENTENCE HAD TO GO ─────────────────────────────────
//
// The Portraits bodies say things like "Framed from mid-chest to the top of
// the head" — correct for a print, wrong for a phone, and directly
// contradicted by WALLPAPER_COMPOSITION, which puts the subject low with
// clean air on top.
//
// Two framing instructions in one prompt is the failure this repo has
// already paid for: goofy's "soft wraparound illumination" cancelled
// stained_glass's "internally lit with nice falloffs" and the render
// collapsed to 2D. There must only be one.
//
// ── WHAT THE NEON TEST PROVED ──────────────────────────────────────────
//
// WALLPAPER_COMPOSITION works — the subject landed low, the top third came
// back clean, nothing cropped. Two further findings from that shoot, worth
// carrying to the other thirteen but NOT applied without Rich's word:
//
//   THIGHS TO HEAD reads better on a phone than either a bust or a full
//   standing figure. A bust leaves the lower half empty; a full figure
//   makes the face too small to recognise.
//
//   DIM ACCENT WORK in the top third beats empty space. Rich's neon body
//   runs thinner accent tubes up and around the top third, dimmed, so the
//   clock stays legible but the space is not dead.
//
// ── OPEN ───────────────────────────────────────────────────────────────
//
// NB2 renders the clock and date ITSELF, and gets the date wrong — the
// first neon test came back "Trnday, Nep 26". Harmless in a test, not
// shippable. WALLPAPER_COMPOSITION names a clock and date, which is
// probably what invites it. Needs a no-text clause or a rewording that
// describes the empty space without naming what goes there.

import type { WallpaperEffect } from './wallpapers-shared'

export const PORTRAITS_WALLPAPERS: Record<string, WallpaperEffect> = {

  stained_glass: {
    id:    'stained_glass',
    label: 'Stained Glass',
    silo:  'portraits',
    body: `make the subject a fully 3d stained glass sculpture. Tiffany meets Bronze Sculpture. Internally lit with nice falloffs for character. likeness is important. No human skin, hair, nails or teeth. rortate the statue 10 degrees left. the background is a beautiful tiffany lamp style shop.`,
    avoid: `Avoid a flat opaque mosaic, painted-on color, or a 2D stained-glass window with no dimensional form. Avoid glass without visible leading/came lines between the cells. Avoid a uniformly lit surface with no backlit glow — the inner luminosity and the dark leading are both required. Avoid muddy or desaturated glass; the cathedral-glass jewel tones must read as vivid and lit.`,
  },

  petal_sculpture: {
    id:    'petal_sculpture',
    label: 'Petal Sculpture',
    silo:  'portraits',
    body: `The subject is sculpted entirely from thousands of densely layered flower petals, creating a seamless floral sculpture with no visible skin. The likeness emerges through flowing planes of overlapping petals rather than individual flowers, while only occasional blossoms appear to reveal the material. Rich gradients of crimson, scarlet, coral, tangerine, peach, magenta, fuchsia, violet, lavender, and deep burgundy flow naturally across the sculpture like a living oil painting. Hair transforms into sweeping masses of layered petals that preserve the original hairstyle, blending seamlessly into the figure. Dramatic spring sunlight with warm rim light. Avoid bouquets, floral crowns, flower garlands, makeup effects, visible skin, individual flowers covering the face, decorative arrangements, or flowers attached to a person. The petals themselves are the sculptural material. The sculpture stands on a polished dark wood plinth, blurred green foliage behind, warm sunlight from the left. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
  },

  tidewood: {
    id:    'tidewood',
    label: 'Tidewood',
    silo:  'portraits',
    body: `The subject is sculpted from weathered driftwood shaped by decades of wind, waves, and saltwater, with deeply textured grain flowing naturally through the face and body while preserving the subject's likeness. Brilliant translucent blue-green resin fills natural cracks and knots, glowing from within with ocean caustics, tiny trapped bubbles, and refracted light. preserve the original hairstyle as flowing driftwood and resin, no human skin. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Background: a timber boathouse deck, grey sea light, heavily out of focus. The sculpture rests on a raw driftwood block. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
  },

  retro_robot: {
    id:    'retro_robot',
    label: 'Atomic Age Robot',
    silo:  'portraits',
    body: `Transform the subject into a charming atomic-age tin robot, unmistakably the same person. Preserve the exact silhouette, shape and proportions of the subject's face, and preserve the natural size, spacing and placement of their features. Construct that familiar face from a few simple, smoothly pressed pieces of enamelled sheet metal, rather than reproducing human skin or substituting mechanical facial features.
Eyes remain the subject's normal size and shape, set naturally into the metal face. The mouth is a simple articulated metal mouth that preserves the subject's expression. No camera lenses, mechanical teeth, grille nose or exaggerated robot features. Dont change expression.
 face should be 25% of the image
Hair is overlapping pressed-metal strips about the width and thickness of gum wrappers, following the subject's real hairstyle, length and volume. Cream, red and chrome sheet metal, rivets, seams, gauges and antenna complete the robot.
The feeling is charming vintage tin toy brought to life, not cyborg, android or humanoid machinery. Retro-futurist 1950s city softly out of focus. No text or signage. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
  },

  clockwork: {
    id:    'clockwork',
    label: 'Clockwork',
    silo:  'portraits',
    body: `The subject is built as a clockwork automaton — brass and steel plate over a visible movement, tiny gears, jewelled bearings and coiled springs turning in the openings at the temple, throat and shoulder. The face is shaped brass, its panels following this person's own brow, cheekbones and jaw, joints hairline-fine where the plates meet. Eyes stay human in size and spacing. The garment rebuilt in engraved plate. Warm brass, blued steel, a little verdigris in the seams. Likeness is critical. Photographic and highly idealized — a real made object in real light, the finest piece of its kind. Background: a watchmaker's bench, loupes and movements out of focus, warm low light. Preserve natural facial character, asymmetry, lines and scars. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar. 
No human skin or hair. Make hair, beards, mustaches flat plates with deep grooves to match the existing hairs style and texture as close as possible.
Place the subject inside an intimate old Swiss watchmaker's workshop, warm, cluttered and handcrafted, with the charm of Geppetto's shop. Behind him, tall divided-light wood windows look out onto a narrow old-European district of crooked stone buildings, weathered plaster facades, shop signs and a cobbled pedestrian lane receding into the distance. Shelves and workbenches filled with watchmaker's tools, tiny drawers, brass instruments and half-finished clocks create layers of depth. Warm amber workshop light inside contrasts with soft cool daylight from the street, atmospheric and cinematic.`,
  },

  balloon_face: {
    id:    'balloon_face',
    label: 'Balloon',
    silo:  'portraits',
    body: `Transform the subject into a sculpture built from inflated balloons — glossy latex in twisted and pressed segments, the face, hair and garment all formed from balloon shapes tied and bunched into the person's own structure. Taut curved surfaces with bright specular highlights, the pinch and knot visible where segments meet, faint seams running the length of each balloon. The colors Use a restrained, sophisticated near-monochromatic palette of smoked amethyst, deep aubergine, dusty plum, muted mauve and blackberry, with subtle tonal variations between individual balloons. Keep the face in warm muted blush and taupe balloon tones. Avoid primary colors, rainbow colors and children's-party colors. The overall color treatment should feel luxurious, editorial and distinctly adult.. The face is balloon throughout — no skin, no real hair. Likeness is critical; the features read clearly through the rounded forms. Idealized and beautiful. Photographic — a real object photographed in real light, not an illustration. Background: a bright party hall, streamers and lights out of focus behind. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar. 
The background is an adult style party in a club.`,
    avoid: `Avoid a face painted onto a balloon. Avoid real skin or hair. Avoid a balloon animal or novelty shape. Avoid losing the likeness to rounded generic features.`,
  },

  victorian: {
    id:    'victorian',
    label: 'Victorian Portrait',
    silo:  'portraits',
    // GENDERED: portraits-bodies.ts ships a separate _woman body for
    // this effect. A wallpaper has one subject, so it resolves the same
    // way Portraits does — but the _woman body is NOT in this file yet.
    body: `Transform the subject into a lavish Victorian aristocratic portrait, preserving his facial likeness precisely. Dress him in a dramatic deep teal velvet frock coat, richly patterned jewel-toned silk waistcoat, cream silk cravat with an ornate turquoise and gold pin, gold watch chain, and an elegant tall silk top hat. Subtle gold embroidery and luxurious period detailing.
Pose him in graceful three-quarter profile, chin slightly raised, gazing serenely into the distance. Deep saturated teal, peacock blue, burgundy, turquoise and antique gold dominate the portrait. Romantic painterly photography with luminous warm skin, rich directional light, glowing gold highlights, deep velvety shadows and jewel-like color. An opulent Victorian interior dissolves behind him into dark teal, warm amber and golden bokeh.
Make the portrait sumptuous, theatrical and slightly idealized, like a richly painted Victorian society portrait brought to life. Give the image a subtle aged photographic finish with softened blacks, warm highlights and gentle painterly grain, while retaining saturated color and luminous detail.
Preserve the subject's face, age, proportions and natural asymmetry. Refine temporary skin imperfections without changing his identity. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
  },

  renaissance: {
    id:    'renaissance',
    label: 'Renaissance Portrait',
    silo:  'portraits',
    // GENDERED: portraits-bodies.ts ships a separate _woman body for
    // this effect. A wallpaper has one subject, so it resolves the same
    // way Portraits does — but the _woman body is NOT in this file yet.
    body: `make the subject a realistic photo of a Renaissance nobleman. warm earth palette of umber, ochre, deep red and black. slashed velvet doublet with full soft sleeves, a fine linen shirt at the collar, a single gold chain. no ruff. man facing front, three-quarter turn of the shoulders. zoom in for torso and headshot. face should be 20% of image. calm, settled expression. do not modify ethnicity. Background: a painter's loggia — stone arches opening onto a Tuscan hillside, cypresses, warm late afternoon light, slightly out of focus. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.
desturate skin colors 15% and add a filter to age the image slightly`,
  },

  plushy: {
    id:    'plushy',
    label: 'Plushy',
    silo:  'portraits',
    body: `Transform the entire subject into an adorable, soft, slightly overstuffed handmade plush toy, preserving strong facial likeness while gently idealizing the subject’s attractiveness and warmth. Give the face a sweet, lovable expression, softly flattering proportions and a subtle friendly smile without becoming cartoonish. Very soft fabric, visible hand stitching, gently uneven seams and cuddly compression. Clothing carries through entirely in soft knitted and stuffed materials.
 Nestle and gently squish them into a cozy pile of well-loved teddy bears, stuffed animals and pillows, with plush toys affectionately pressing against their shoulders and entering the edges of frame.
Set the scene on a rumpled bed at night with a warm bedside lamp and generous soft fill. Golden light keeps the face bright and flattering, with creamy bedding, soft open shadows and rich tactile detail. Lovable, cuddly, safe and deeply comforting, like a treasured childhood plush tucked into bed with all its friends.
No letters or held objects.`,
  },

  impressionist: {
    id:    'impressionist',
    label: 'Impressionist',
    silo:  'portraits',
    body: `Rebuild the subject as a bust sculpted entirely out of thick oil paint — a three-dimensional object, not a painting. Every surface is impasto with real mass: face, hair, neck, shoulders, garment. Broad slabs and ridges of colour laid on with a knife, each stroke standing proud with a hard lifted edge and casting its own small shadow. The hair is the boldest passage, long ropes and sweeps of paint holding the real hairstyle's length and direction. Colours natural to this person's complexion and clothing, pushed and broken — the shadows carried in violet and green rather than grey. Paint runs down over the shoulders and pools on the round base the bust stands on. Likeness is critical; the person reads clearly despite the crudeness of the marks. The bust stands on a round base. Set in a beautiful old-world artist's atelier, cluttered and eclectic, with dark aged timber, plaster walls, antique easels, stacked canvases, portfolios, drawing tools and old studies casually pinned around the room. Above is a huge ribbed industrial skylight of aged iron and glass, flooding the studio with dramatic soft daylight and long directional shadows. Atmospheric, romantic, slightly dusty, collected over generations rather than designed. Shallow depth of field. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid a flat painting or anything on canvas — this is a solid object standing in a room. Avoid smooth or photo-realistic skin. Avoid thin, blended or evenly applied paint. Avoid grey or black shadows.`,
  },

  pencil_sketch: {
    id:    'pencil_sketch',
    label: 'Pencil Sketch',
    silo:  'portraits',
    body: `A solid sculpted bust of the subject carved entirely from graphite — soft pencil-lead grey with a burnished sheen, the surface worked in visible pencil strokes that wrap the form: crosshatching in the recesses, broad shading across the planes, edges softly smudged. Eyes and lips are graphite. Hair keeps its real length and silhouette in long directional strokes. No skin, no real hair. The garment carries through in the same material. A real object standing in real light, casting its own shadow. Set in a beautiful old-world artist's atelier — dark timber, plaster walls, antique easels, stacked canvases and old studies pinned around the room, a huge ribbed skylight above flooding it with soft daylight. Monochrome throughout. Likeness is critical. Keep permanent structure: lines, scars and the natural asymmetry of the face. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid a drawing on paper, an easel-mounted picture or any flat image. Avoid a duplicated face. Avoid colour.`,
  },

  charcoal_chalk: {
    id:    'charcoal_chalk',
    label: 'Charcoal & Chalk',
    silo:  'portraits',
    body: `Transform the entire figure into a fine-art sculpture constructed from compressed charcoal, broken charcoal sticks, charcoal dust, and white Conté chalk. The complete sculpture—including head, hair, shoulders, chest, garment fabric, and arms—is physically built from charcoal materials with sculptural mass; the sculpture is not drawn. Material density must extend through sweater, shoulders, arms, and base fragments — equal carving complexity across every part of the figure. All planes—face, hair, shoulders, clothing folds, chest, and arms—are carved from dense charcoal masses with visible chisel marks, fractured edges, and layered charcoal fragments. White Conté chalk forms raised highlights and structural details across the entire figure, creating dimensional contrast against deep black charcoal surfaces. Floating charcoal dust, chalk powder, and broken fragments drift in the surrounding air as if the sculpture is still emerging from the material. Hair forms from sweeping charcoal ribbons, fractured charcoal splines, and layered charcoal shards. Avoid drawn charcoal portraits, 2D charcoal renderings, smooth surfaces, blended shading, or paper-as-substrate aesthetics. The charcoal must carry true sculptural depth and physical mass everywhere on the figure. Avoid losing the likeness in the fracturing — the person stays clearly recognizable. Sculpture on a base in a beautiful old-world artist's atelier, cluttered and eclectic, with dark aged timber, plaster walls, antique easels, stacked canvases, portfolios, drawing tools and old studies casually pinned around the room. Above is a huge ribbed industrial skylight of aged iron and glass, flooding the studio with dramatic soft daylight and long directional shadows. Atmospheric, romantic, slightly dusty, collected over generations rather than designed. Shallow depth of field. Large charcoal and chalk drawings in progress pinned to the walls and leaning on easels, drawing boards, sticks of charcoal and Conté in trays, fixative bottles, smudged rags. Strong depth of field heavily blurring the background. Museum gallery lighting reveals the texture of compressed charcoal, chalk buildup, carved surfaces, and airborne particles. Fine-art contemporary sculpture. Dramatic craftsmanship. Highly dimensional, tactile, expressive. Facing the camera directly, warm natural smile, eyes to the viewer. Camera at eye level. Shallow depth of field. No plaque. No legible text on the surrounding works. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
  },

  neon: {
    id:    'neon',
    label: 'Neon Drawing',
    silo:  'portraits',
    // Rich's text, locked 2026-08-10 against a live render. Verbatim.
    body: `highly detailed neon tube sculpture from thighs to head. fully 3d in all three directions. implied volume. use negative space. use monochromate blues with variations on value. mounted in a small shops storefront window at night, rain on the glass, the shop dark behind. wires and electrical lines visible. at least 100 tubes. The whole  figure is drawn in tube — head, torso, arms, hands, legs — the garment carried through in the same material. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Worn jewellery is fine: necklaces, earrings, piercings.
add many accent tubes that are thinner as creative art deco designs that are in complimentary but dimmer colors to fill the image`,
  },

  bronze: {
    id:    'bronze',
    label: 'Bronze',
    silo:  'portraits',
    body: `make the subject into a realistic patinated bronze sculpture — classic warm bronze with deep verdigris settling into the recesses and bright polish on the raised features: brow, cheekbones, nose bridge and jaw. Face, hair and garment all rendered in the same patinated bronze, dignified and tasteful, never costume-like. Hard directional key light from the upper left with deep shadow across the right and strong falloff. Professional magazine-cover photography. No letters, no plaque. The entire sculpture is bronze — no other materials, no real skin, hair or nails. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Background: a civic plaza at dusk, warm low light, heavily out of focus. The sculpture stands on a weathered granite pedestal. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
  },
}

export const PORTRAITS_WALLPAPER_IDS = Object.keys(PORTRAITS_WALLPAPERS)
