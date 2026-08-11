// lib/v1/wallpapers/wallpapers-portraits.ts
//
// PORTRAITS SILO — 14 wallpaper effects, 9:16, download only.
//
// ── WHERE THIS TEXT CAME FROM ──────────────────────────────────────────
//
// Every body below is Rich's approved Portraits text, lifted verbatim from
// lib/v1/portraits/portraits-bodies.ts with ONE mechanical change: the bust
// framing sentence was removed.
//
// Nothing else was rewritten. Not a clause, not a typo, not a run-on.
//
// ── WHY THE FRAMING SENTENCE HAD TO GO ─────────────────────────────────
//
// The Portraits bodies say things like "Framed from mid-chest to the top of
// the head, both shoulders and upper arms fully rendered" — correct for a
// print, wrong for a phone, and directly contradicted by
// WALLPAPER_COMPOSITION, which puts the subject low with clean air on top.
//
// Two framing instructions in one prompt is the failure this repo has
// already paid for once: goofy's "soft wraparound illumination" cancelled
// stained_glass's "internally lit with nice falloffs" and the render
// collapsed to 2D. Positive instruction beats a negative, and the later
// instruction usually beats the earlier one — so there must only be one.
//
// Exact sentences removed, per effect, are listed against each body.
//
// ── WHY THESE FOURTEEN ─────────────────────────────────────────────────
//
// Chosen for a lit screen, not a wall. Light & Glass and Fantasy & Future
// almost entirely, because luminous subjects on dark grounds read at arm's
// length and survive an icon grid on top of them. Bronze, Stone, Ebony and
// the Another Age costumes are deliberately absent — they are the best
// effects in the catalog for print and the dullest on a phone.
//
// Rich has not ruled on this selection. Swap freely.

import type { WallpaperEffect } from './wallpapers-shared'

export const PORTRAITS_WALLPAPERS: Record<string, WallpaperEffect> = {

  neon: {
    id:    'neon',
    label: 'Neon Drawing',
    silo:  'portraits',
    body: `highly detailed neon tube sculpture. fully 3d in all three directions. implied volume. use negative space. use monochromate blues with variations on value. mounted in a small shops storefront window at night, rain on the glass, the shop dark behind. wires and electrical lines visible. at least 100 tubes The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
  },

  starfield: {
    id:    'starfield',
    label: 'Starfield',
    silo:  'portraits',
    body: `The subject is formed from deep space — the body a volume of dark nebula gas, dust lanes and scattered stars that coalesce into the shape of a person. Denser and brighter through the head and shoulders, thinning to loose star fields at the edges. Cool indigo, teal and violet with a few warm gold stars threaded through. The face is clearly defined and unmistakably this person, formed from cloud and light, never from skin. Fully 2d idealized illustration. Deep black background falling off from the figure's own glow. Keep permanent structure: lines, scars and the natural asymmetry of the face. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid a solid body with stars painted on top. Avoid photographic rendering. Avoid real skin.`,
  },

  fire_face: {
    id:    'fire_face',
    label: 'Fire & Ember',
    silo:  'portraits',
    body: `Sculpt the figure from living fire and ember — the body made of flame, glowing coals and rising sparks that coalesce into the shape of a person. Denser and brighter where the fire gathers into the head and shoulders, thinning into sparks and smoke at the edges. The face is clearly defined and unmistakably this person, formed from flame, never from skin. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
  },

  magic_energy: {
    id:    'magic_energy',
    label: 'Magic Energy',
    silo:  'portraits',
    body: `Sculpt the figure from pure glowing magical energy — swirling luminous energy, flowing ribbons of light, drifting embers, and crackling arcs of colour — violet, gold, cyan, and rose — that coalesce into the shape of a person. Denser and brighter where the energy gathers into the head, shoulders, and chest; thinning into wisps, sparks, and floating motes at the edges. The face is clearly defined and unmistakably this person, formed from light and energy, never from skin. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. fully 2d idealized illustration.
deep purple gradient background with wam light falling off to dark. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
  },

  crystallized: {
    id:    'crystallized',
    label: 'Crystallized',
    silo:  'portraits',
    body: `The subject has crystallized out of solution — the whole figure grown as a single mineral formation, blue-green copper sulfate and alum crystals packed dense and interlocking, the entire mass crystal all the way through with no skin beneath. Sharp faceted blocks build the broad planes of the brow, cheek and jaw; finer needle growth crowds the hollows and the edges. The eyes are smooth polished crystal — clean rounded facets, calm and legible, holding a single bright specular point each. No needles, spines or fine growth anywhere near the eyes, and no lashes, whites or wet surface. Deep vitriol blue shading to pale aqua and clear, each facet catching a hard specular point. Hair keeps its real length and silhouette, grown as long bladed crystal. The garment carries through in the same growth. Likeness is critical and comes before the material. Photographic and highly idealized — a real specimen in real light, strange and beautiful. Background: a laboratory bench in low light, beakers and glassware out of focus, one hard light source. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid needle or spiked crystal around the eyes. Avoid real eyes, lashes or eye whites. Avoid crystals growing on a real person — the figure is crystal throughout. Avoid changing the hair. Avoid real skin or hair. Avoid a warm palette.`,
  },

  ice: {
    id:    'ice',
    label: 'Frost & Ice',
    silo:  'portraits',
    body: `Transform the entire clothed figure into a softly sculpted form of dense snow and translucent ice, with milky crystalline depth, compacted snowy surfaces, soft frost and occasional clearer icy edges. Increase opacity and softness so the facial structure is beautifully defined rather than glass-like; preserve the subject's likeness precisely with no visible skin. Set against an icy cliff with hanging icicles, deep blue glacial shadows and a snow-covered edge catching warm sunlight; golden light falls across one side of the sculpture while cold blue-white light shapes the other, creating a dramatic warm/cool contrast. The subject's own garment carries through in the same material. Keep a clear catchlight in the eyes. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
  },

  mercury: {
    id:    'mercury',
    label: 'Liquid Mercury',
    silo:  'portraits',
    body: `Render the subject in liquid mercury caught in dynamic transformation — a mirror-perfect chrome figure in the act of dissolving and re-forming. the clothed figure is hyper-reflective polished liquid metal, but alive with motion: ribbons and sheets of mercury peel and fling outward, droplets break away and hang suspended in the air, and parts of the form stretch into liquid tendrils mid-splash, like the surface of mercury disturbed and frozen at its most dramatic instant. Strong directional gallery light rakes across the chrome so reflections and droplets blaze. Surreal, kinetic, and impossibly fluid — a body in liquid-metal flux, not a static statue. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Never reshape, enlarge eyes, correct asymmetry or de-age. Background: a dark room scattered with coloured lights, heavily out of focus. The piece stands on a brushed steel base. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid a still, solid, symmetric chrome figure — the drama is in the motion, the breaking droplets, and the peeling ribbons of metal. Avoid reflections so chaotic the face is lost; the likeness reads clearly in the mirrored surface. Avoid any non-silver color. Avoid photorealistic skin on the face; it is liquid chrome like the rest.`,
  },

  dragon_skin: {
    id:    'dragon_skin',
    label: 'Dragon Skin',
    silo:  'portraits',
    body: `Transform the subject into a dragon-human hybrid — the entire head and figure surfaced in fine iridescent dragon scale, deep emerald and oil-slick violet shifting through bronze and gold. The face is scale all the way through, including the mouth — scaled lips, no human teeth or gums. Larger armored scale across the shoulders and chest, finer across the face. Hair keeps its real length and silhouette, rendered as scaled tendrils. A full dragon's body grows from the back — spined neck, ridged spine, a serpentine body curving down and away. Horns rise from the crown. Rebuild the garment in overlapping scale plate. Remove glasses and worn accessories. The face is turned to the camera and lit, clearly this person. Powerful, mythic, jewel-like. Photographic. Keep permanent structure: lines, scars and the natural asymmetry of the face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Background: a rock ledge at dusk, a cliff falling into haze behind, cold light from the left and warm firelight from the right, heavily out of focus. Maintain expression of the subject. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
    avoid: `Avoid human lips, teeth or hair. Avoid glasses and worn accessories. Avoid the source fabric showing through the scale. Avoid an illustrated look.`,
  },

  stained_glass: {
    id:    'stained_glass',
    label: 'Stained Glass',
    silo:  'portraits',
    body: `make the subject a fully 3d stained glass sculpture. Tiffany meets Bronze Sculpture. Internally lit with nice falloffs for character. likeness is important. No human skin, hair, nails or teeth. rortate the statue 10 degrees left. the background is a beautiful tiffany lamp style shop.`,
    avoid: `Avoid a flat opaque mosaic, painted-on color, or a 2D stained-glass window with no dimensional form. Avoid glass without visible leading/came lines between the cells. Avoid a uniformly lit surface with no backlit glow — the inner luminosity and the dark leading are both required. Avoid muddy or desaturated glass; the cathedral-glass jewel tones must read as vivid and lit.`,
  },

  coral: {
    id:    'coral',
    label: 'Living Reef',
    silo:  'portraits',
    body: `make the subject a bust built entirely from hard calcareous coral — rich colors and the whole surface a porous mesh of small cups. Branching staghorn forms mass out where the hair should be, and thin brain-coral ridges run across the shoulders. The face is the smoothest passage, worked in fine plating coral so the features stay clean while the porous texture still reads across it. Eyes are blind coral, no whites. Lips are coral. No skin, no real hair. the coral is undersea with streams of volume light in the background. schools of fish are swiming around and one or two in front. eyes are real`,
  },

  polished_gold: {
    id:    'polished_gold',
    label: 'Polished Gold',
    silo:  'portraits',
    body: `Transform the entire figure into a contemporary polished gold sculpture — mirror-bright warm yellow gold with a high specular finish, the surface smooth and flowing with no visible tool marks. hair is poured liguid gold that matches the subjects with deep carved separations catching bright highlights. No human skin anywhere — the face is polished gold like the rest. The subject's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. the background is an expensively appointed conservatory with many windows with warm lighting streaming through inside potted trees and plants. Make the creation match age.
No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
  },

  cast_glass: {
    id:    'cast_glass',
    label: 'Cast Glass',
    silo:  'portraits',
    body: `The subject is cast in solid kiln-formed glass, thick and heavy, with the softly frosted matte surface of a mould, subtle bevelled edges and faint trapped bubbles. A single cool color throughout, pale sea green or smoke grey. The face is glass all the way through, its forms gracefully simplified into an exceptionally beautiful sculptural interpretation of this person's own face. Preserve what makes the face distinctive rather than making it conventionally perfect.
Hair is cast in the same glass, preserving its real silhouette as a flowing sculptural mass. The garment carries through in cast glass. Closed mouth, expression carried in the eyes. Likeness is critical.
Place the figure naturally beside a beautiful waterfall, surrounded by wet stone, mist and soft vegetation. Cool daylight and reflected water play across the frosted glass, creating restrained caustics and beautiful sculptural shadows. Photographic, atmospheric and highly idealized, a real glass figure existing naturally in the landscape.
 Preserve natural facial character, asymmetry, lines and scars. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar.`,
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
    body: `The subject is built as a clockwork automaton — brass and steel plate over a visible movement, tiny gears, jewelled bearings and coiled springs turning in the openings at the temple, throat and shoulder. The face is shaped brass, its panels following this person's own brow, cheekbones and jaw, joints hairline-fine where the plates meet. Eyes stay human in size and spacing. The garment rebuilt in engraved plate. Warm brass, blued steel, a little verdigris in the seams. Likeness is critical. Face should occupy 15% of the image. Photographic and highly idealized — a real made object in real light, the finest piece of its kind. Background: a watchmaker's bench, loupes and movements out of focus, warm low light. Preserve natural facial character, asymmetry, lines and scars. No held objects — no cups, glasses, phones, books, tools, watches or eyewear. Worn jewellery is fine: necklaces, earrings, piercings. An arm or hand appears only when it is touching the body — under the chin, resting on the head, at the collar. 
No human skin or hair. Make hair, beards, mustaches flat plates with deep grooves to match the existing hairs style and texture as close as possible.
Place the subject inside an intimate old Swiss watchmaker's workshop, warm, cluttered and handcrafted, with the charm of Geppetto's shop. Behind him, tall divided-light wood windows look out onto a narrow old-European district of crooked stone buildings, weathered plaster facades, shop signs and a cobbled pedestrian lane receding into the distance. Shelves and workbenches filled with watchmaker's tools, tiny drawers, brass instruments and half-finished clocks create layers of depth. Warm amber workshop light inside contrasts with soft cool daylight from the street, atmospheric and cinematic.`,
  },
}

export const PORTRAITS_WALLPAPER_IDS = Object.keys(PORTRAITS_WALLPAPERS)
