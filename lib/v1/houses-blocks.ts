// houses-blocks.ts
// lib/v1/houses-blocks.ts
//
// All prompt blocks for the Houses silo. Three categories:
//   1. Always-on stack (4 blocks, every render)
//   2. Environment blocks (3 — selected per render, mode-conditional)
//   3. Per-preset material rules + lighting recipes + optional layers
//
// VOCABULARY DISCIPLINE — locked from action-minis-locked.md:
//   BANNED:   spotlight, lamp, fixture, pendant, shaft, beam, streams down,
//             HEAVILY VOLUMETRIC, "light source inside particles", "light from below"
//   REQUIRED: atmospheric haze, luminous quality, diffused,
//             "slightly brighter toward the back-upper area"
//
// Block lengths sized so a fully-assembled prompt sits at 2,800–3,300 chars,
// the action-minis-tested figure-quality safe zone (max ~3,500 before drift).

import type { EnvironmentId } from './houses-shared'

// ═══════════════════════════════════════════════════════════════
// 1. ALWAYS-ON STACK — order matters, earlier blocks get more attention
// ═══════════════════════════════════════════════════════════════

export const COLLECTIBLE_ANCHOR_BLOCK = `
This is a premium collectible architectural scale model — a sculpted miniature displayed as a precious art object. Bias toward "museum-quality replica" and "serious collector's piece," not "toy" or "kit-bash" or "hobby diorama." Hand-crafted feel, weighty presence, refined finish throughout.
`.trim()

export const CAMERA_BLOCK = `
Camera mounted high, aimed down at approximately 45 degrees below horizontal. The roof tops are visible; the front facade is angled, never flat-on. The circular plinth top reads as an oval. Product photography framing.
`.trim()

// Composition enforcement. Borrows directly from the proven old base.ts
// language ("non-negotiable" header + walkway anchor) which NB2 responds
// to better than abstract percentage rules. External (frame) margin is
// handled by the post-NB2 outpaint stage in houses-expand.ts; this block
// owns only the internal (plinth) margin.
export const COMPOSITION_BLOCK = `
PLINTH SCALE — NON-NEGOTIABLE:
The house occupies 55-65% of the plinth diameter. The remaining 35-45% is fully visible landscaped yard surrounding the house on all sides.
No wall, porch, bay, or extension reaches the plinth edge — clear yard is visible between the house foundation and the plinth perimeter on every side.
A walkway or path runs from the entrance toward the plinth edge but ends in lawn before reaching it.
The yard is populated with appropriate landscape elements at scale — these elements ARE the scene, not afterthoughts.

The house and the property together are the subject. Not the house alone.
`.trim()

// Houses analog of FIGURE_FIDELITY_BLOCK in action-minis. Backstops the
// pixel inheritance that nano-banana-2 image-to-image already provides.
// The element enumeration is load-bearing — without it, NB2 drifts toward
// the source's generic style typology and drops distinctive features
// (bay projections, wraparound porches, octagonal corners, etc).
export const STRUCTURE_FIDELITY_BLOCK = `
The source image is the absolute ground truth for architectural form. Replicate this exact building — same mass, footprint, roofline, facade layout, materials, every detail.

EVERY DISTINCTIVE FEATURE PRESERVED, NOT JUST THE GENERAL STYLE:
- Bay window projections (octagonal, polygonal, or rectangular bays must project outward as 3D forms, never flatten to plain wall)
- Porch shape and extent (full wraparound, partial wraparound, front-only, corner projection — match exactly)
- Tower or turret presence and shape
- Roof type, slope angles, and any complex roof geometry (mansard slope angle, gambrel breaks, hip-and-gable mixes)
- Window count, placement, shape, and grouping
- Dormer count, style, and placement
- Door position and design
- Trim profiles, brackets, decorative elements
- Chimney count and position
- Foundation material

If the source has an octagonal bay, render an octagonal bay. If it has a wraparound porch, render the wraparound. If it has a second-story projection, render the projection. Do NOT substitute a generic example of the source's overall style. Proportions exact. The hardest requirement; overrides any softening from other blocks.
`.trim()

// ═══════════════════════════════════════════════════════════════
// 2. ENVIRONMENT BLOCKS — user-selected staging
// ═══════════════════════════════════════════════════════════════

const IN_SITU_BLOCK = `
ENVIRONMENT — IN SITU ON THE LAWN:
The plinth sits directly on real grass — the front lawn of the actual full-size house it depicts. Visible grass at the plinth base, soft natural shadow where it meets the lawn. Outdoor garden setting, never a desk or tabletop.

In the background, set back ten to fifteen meters, the actual full-size house — the SAME building as the model, rendered in its true real-world materials and actual colors (never the model's material). Mature trees and foundation plantings around it, lived-in feel, not a real-estate-catalog.

Depth of field is strong: plinth and model razor sharp; everything beyond melts into heavy painterly blur, the background house and garden deeply out of focus, recognizable only as forms and color masses. Wide-aperture feel.
`.trim()

const DESK_BLOCK = `
ENVIRONMENT — DESK:
The scale model on its circular wooden plinth sits on a large dark walnut desk — book-matched grain, deep satin finish, the desk surface extending well beyond the plinth in every direction.
A hardcover book lies open to the left. Reading glasses rest folded to the right. A small ceramic mug sits nearby. The desk surface holds a soft reflection of the plinth and the lower part of the model.
The room beyond is a warm study softly out of focus — bookshelves, framed paintings, the edge of a chair visible. Everything behind the desk is in soft warm bokeh — a real room subordinate to the artifact.
Warm directional daylight wraps the model from one side. No visible light fixtures in frame.
The diorama is a small precious object on a large desk — the camera pulls back to show the whole scene.
`.trim()

const ROOM_IN_HOUSE_BLOCK = `
ENVIRONMENT — ROOM IN THIS HOUSE:
The plinth sits on a side table or pedestal inside an interior room of this very house — the room's character matches the building's architectural style and the mood of the preset (period parlor, vintage study, restored hall).
The room is in soft focus around the plinth — period furniture, wallpaper or paneling, framed art, an architectural detail glimpsed beyond. The plinth and the model on it are razor sharp; the room recedes into atmospheric blur.
The artifact is displayed inside the very space it depicts — a model of the house, sitting in the house.
Soft directional natural light appropriate to the room's mood. No visible light fixtures in frame.
The diorama is a small precious object inside a large room — the camera pulls back to show the whole scene.
`.trim()

export const ENVIRONMENT_BLOCKS: Record<EnvironmentId, string> = {
  in_situ:       IN_SITU_BLOCK,
  desk:          DESK_BLOCK,
  room_in_house: ROOM_IN_HOUSE_BLOCK,
}

// ═══════════════════════════════════════════════════════════════
// 3. PER-PRESET RECIPES — material / lighting / optional layer
// ═══════════════════════════════════════════════════════════════

// ── BRONZE (material) ─────────────────────────────────────────
export const MATERIAL_BRONZE = `
MATERIAL: A SOLID CAST BRONZE SCULPTURE of the building — every surface is bronze metal. The entire structure has been recast as a single monolithic piece of cast bronze: siding, shingles, trim profiles, porch, columns, balustrades, foundation, doors, even window frames. There is NO paint, NO color, NO finish other than bronze metal anywhere on the structure.

THE BRONZE BODY:
- Walls, roof, every architectural plane: warm metallic bronze tone — rich brown-gold, with the slight reddish hue of cast bronze. The metal catches light along its lit faces with characteristic specular bronze highlights and falls into deeper bronze shadow on the away side.
- The bronze surface has subtle micro-texture from the casting process — extremely faint patina-streaks, faint tonal variation between areas, but ALL within the bronze tonal range.
- Glass windows are the ONE exception: the window panes themselves can read as dark transparent glass behind bronze frames. The frames are bronze; the panes are glass.

VERDIGRIS PATINA (RECESSES ONLY):
Verdigris green-blue patina appears EXCLUSIVELY in deep recesses and undercuts where moisture would naturally collect on aged bronze: under cornices, in the back corners of porch beams, behind shutters, where columns meet capitals, in deeply shaded crevices of decorative trim. Patina is a thin pooled accent in dark recesses, never a wall color, never a roof color, never on flat surfaces. The patina is a small percentage of the visible surface; the dominant reading is "bronze body with verdigris accents."

CRITICAL — SOURCE COLORS DO NOT CARRY THROUGH:
The building's original paint colors are completely irrelevant to the bronze rendering. If the source house has blue walls, the bronze house has bronze walls — not blue, not blue-tinted, not blue-grey. If the source house has a red roof, the bronze house has a bronze roof — not red, not painted. If the source house has green trim, the bronze trim is bronze — not green. The source colors guide ARCHITECTURAL FIDELITY (where windows are, where trim is, what shape the roof is) — they have ZERO influence on the surface treatment.

The reference is a museum-quality cast bronze sculpture: think action figure bronze — entirely bronze body with verdigris accents in the recesses. No part of the building reads as painted or colored. This is metal, not painted material.
`.trim()

export const LIGHTING_BRONZE = `
LIGHTING: Warm gallery atmospheric haze — diffused luminous quality in the air around the model, slightly brighter toward the back-upper area. Soft directional warmth wraps the bronze surfaces, picking up contour highlights along edges and silhouettes. Recessed details register in deeper warm shadow. The atmosphere has a soft photographic quality, the air itself faintly glowing.
`.trim()

// Outdoor variants — selected when environment === 'in_situ'.
// Two options for testing which lighting recipe lands the In-Situ feel best.
// Both reach for the Forest-Bridge / Machu-Picchu register: directional
// natural sunlight + atmospheric haze + readable depth layers.

// VARIANT A — Flare-no-orb. Sun is BEHIND a tree, breaking through as a
// brilliant flare with lens artifacts. The Machu-Picchu move. Felt direction
// without the orb in frame. Most "natural photograph" reading.
export const LIGHTING_BRONZE_OUTDOOR_FLARE = `
LIGHTING — SUN FLARE THROUGH THE TREES (NO VISIBLE ORB):

The sun is behind a mature tree in the upper-back of the frame — its disc is NOT visible. Its presence shows as a brilliant flare bursting between the tree's leaves: a bright hot spot of warm white-gold light with lens-flare artifacts (chromatic blooms, soft starburst, faint hexagonal flare ghosts). The viewer reads "the sun is right there, behind that tree" without seeing the sun itself.

Strong warm directional light from the flare's position rakes across the bronze at roughly 35-45 degrees above horizontal. Warm golden light along the top-facing and source-facing planes — roof edges, dormer crests, porch overhangs. Clean warm rim along the silhouette on the source side; verdigris recesses on the away side in cool shadow. A long soft shadow from the plinth stretches across the lawn away from the flare.

Warm afternoon air with luminous diffused haze, brighter toward the back-upper area. Fine garden particulate catches the warmth and glows softly throughout — particles glow because they are suspended in warm haze, not because any visible cone passes through them. Real photograph caught in the moment, never staged.
`.trim()

// VARIANT B — Visible warm rays. Sun is partially visible (small source)
// up-and-behind the model; warm rays cross the air from source toward
// foreground because atmospheric particulate scatters the light along
// its path. The Forest-Bridge move. Note: deliberately uses "rays" not
// "beam" — banned action-minis vocabulary (cones) — but the spirit
// matches Rich's "visible beams on subject or edges" ask.
export const LIGHTING_BRONZE_OUTDOOR_RAYS = `
LIGHTING — VISIBLE WARM RAYS IN HAZY AFTERNOON AIR:

A small bright sun source is partially visible in the upper-back of the frame, appearing as a warm white-gold burst peeking through the foliage of the trees behind the model — small in the frame, clearly readable as the sun.

The afternoon air carries enough atmospheric haze (pollen, dust, fine garden particulate) to make the sun's path visible as warm golden rays crossing the scene from the source toward the foreground — several rays, subtle and naturalistic, angling down through the canopy. The rays terminate in warm pools where they touch the lawn, the plinth, and the bronze surfaces. They are visible because the medium scatters the light along its path — real atmospheric scattering, not graphic overlay.

Where the rays land on the bronze, bright warm hits along the top-facing rooflines, dormer crests, and porch edges. Clean warm rim along the silhouette on the source side; verdigris recesses on the away side in cool shadow. A long soft shadow from the plinth stretches across the lawn away from the source.
`.trim()

// ── SUMMER (season) ───────────────────────────────────────────
export const MATERIAL_SUMMER_RESIN = `
MATERIAL: Hand-crafted scale model in realistic miniature materials — painted wood siding, miniature shingles, miniature glass windows, painted trim, scale brick or stone foundation. Source materials and colors carry through faithfully — brick stays brick, wood siding stays wood siding, paint colors match the source. Slight satin sheen, never matte, never plastic, never glossy lacquer. Hand-crafted hobby-shop collectible feel.
`.trim()

export const LIGHTING_SUMMER = `
LIGHTING: Warm cinematic haze, slightly brighter toward the back-upper area — late afternoon sun diffused through atmospheric air. Soft directional warmth on the model's primary face, gentle falloff around the curved plinth, every surface texture readable. The atmosphere itself has a luminous quality — air softly glowing.
`.trim()

export const LAYER_SUMMER = `
SEASON LAYER — FULL SUMMER:
Trees in deep rich green at peak canopy. Lawns lush and thick. Dense layered foundation plantings — cottage-style perennials in tidy drifts, clipped shrubs, neat front walk to the porch steps. The landscape at its most abundant — full canopy, vivid color throughout, freshly maintained.
`.trim()

// ── HAUNTED (event) ───────────────────────────────────────────
export const MATERIAL_HAUNTED = `
MATERIAL: Source materials corrupted by years of supernatural neglect — paint peeling and faded, siding warped, shingles missing in patches, trim cracked, porch sagging at the corners. The original colors still readable beneath the decay but muted, weathered, drained. Dead vines climb the walls. Cobwebs in the eaves. The structure wears its history.
`.trim()

export const LIGHTING_HAUNTED = `
LIGHTING — MULTI-SOURCE DUAL-TONE:

Cold silver-blue moonlight from one upper-side, steep angle, broken into bright pools and shadow gaps as if filtered through clouds. Bright on the rooflines and yard patches; deep cool shadow elsewhere. High contrast.

A wrought-iron Victorian streetlamp stands prominently in the yard. Its globe is BRIGHT — a strong warm amber source, glowing intensely enough to act as a secondary key light on the house. Warm amber light pours across the entire facing side: porch and ground floor in deep warm amber; second-story windows, dormers, upper trim catch significant warm spill from below; even the lower roofline picks up subtle amber warmth. The lamp's reach extends visibly up through TWO full stories. Long creepy shadows climb the walls behind every architectural element the lamp passes (porch posts, window frames, vines) — the inverse of natural daylight.

The lamp is not an accent. It is a strong directional warm key — the model is BRIGHTER on the lamp side than the moon side. Streetlamp is REQUIRED.

Three or four windows on the model glow deeper amber-orange. Torn curtains create shifting shadow patterns; some flicker as if from candle.

Atmospheric haze around the model — particles glow because suspended in luminous haze, never because a visible cone passes through them.

OVERALL: dual-tone palette — warm amber from the lamp meeting cold silver-blue from the moon. Every architectural detail readable in bright pools, falling to cool shadow elsewhere.
`.trim()

export const LAYER_HAUNTED = `
EVENT LAYER — HAUNTING:
Years of supernatural neglect on the structure. Room around the plinth carries the same haunting — dark Victorian parlor, heavy paneling, leather-bound books in shadow, peeling wallpaper, cobwebs in corners.

REQUIRED YARD POPULATION (must appear):
- A wrought-iron Victorian streetlamp prominent in the yard, glowing warm amber.
- 3-5 detailed miniature zombies or ghouls at scale — painted-resin horror minis, never cartoony, never gory.
- 2-4 tilted gravestones across the yard.
- Dead leafless trees framing the plinth.
- Low ground fog wisping across the yard, drifting layers.

REQUIRED MODEL DETAILS (must appear on structure):
- Cobwebs in eaves and porch corners.
- Dead vines climbing the walls.
- 2-4 small bats mid-flight near the roofline.
- Three or four windows with warm amber interior glow, torn curtain shadows.

Atmosphere is delightfully eerie — premium horror collectible.
`.trim()

// ═══════════════════════════════════════════════════════════════
// 4. REFINEMENT GUARD — used when refinement_tweak is present
// ═══════════════════════════════════════════════════════════════
// (Refine flow + analyze-render endpoint come in pass 2. Block defined
// here so the prompt builder can append it cleanly when wired up.)
export const REFINEMENT_GUARD_BLOCK = `
REFINEMENT GUARD: Material, staging, lighting, scene composition, and overall atmosphere are all preserved from the previous render. Architectural identity stays the same. Do not add or remove elements. The adjustment below applies only to the specific aspect named.
`.trim()

// ═══════════════════════════════════════════════════════════════
// 5. NIGHT-OVERRIDE BLOCK — composed in when time_of_day resolves to night
// ═══════════════════════════════════════════════════════════════
// Shared night atmosphere for every preset that supports day/night and
// has resolved to night. Provides the lampost + interior glow + nearby
// lamp + moonlight kit we proved on Haunted, generalized.
//
// Preset-specific night moods (haunted dread, alien glow, abandoned
// melancholy) keep their OWN lighting blocks too — this is added on top.

export const NIGHT_OVERRIDE_BLOCK = `
TIME OF DAY — NIGHT:
The scene is at night. Three additional light sources frame the model:
- A wrought-iron streetlamp stands prominently in the model's yard, glowing warm amber, casting upward light onto the lower siding and porch — strong enough to act as a secondary key on the lower stories.
- Faint warm interior lights are visible inside the model — partially obscured by curtains and furniture in soft silhouette, several windows showing a lived-in glow rather than blank dark panes.
- In the room beyond the plinth, a warm desk lamp sits nearby, casting soft amber ambient light onto the model from one side.
- Cool moonlight enters through a window in the room background, supplying a cold silver-blue rim along the away side of the model.

The dual-tone palette reads clearly: warm amber from the lamp and interior glow + cool silver-blue from the moonlight. Every architectural detail readable in the warm pools, falling to cool shadow on the moon side. Deep night atmosphere everywhere outside the lit pools.
`.trim()

// ═══════════════════════════════════════════════════════════════
// 6. MATERIAL PRESETS — additional 8 (bronze + summer + haunted already above)
// ═══════════════════════════════════════════════════════════════

// ── WAX ───────────────────────────────────────────────────────
export const MATERIAL_WAX = `
MATERIAL: The entire structure is sculpted from a single block of warm honey-cream wax — siding, shingles, trim, porch, foundation, all wax. Subtle subsurface scattering: light enters the surface and scatters faintly, giving the wax an inner luminous glow especially along thin edges and translucent details. Soft satin sheen, slightly tacky-looking, never glossy lacquer. No painted color, no varnish — wax tone throughout. Source colors do NOT carry through.
`.trim()

export const LIGHTING_WAX = `
LIGHTING: Warm gallery atmospheric haze — diffused luminous quality in the air around the model, slightly brighter toward the back-upper area. Soft directional warmth wraps the wax surfaces; the wax catches light along edges and lit faces with characteristic subsurface translucency, glowing slightly from within where light enters thin sections. Recessed details fall into deeper warm shadow.
`.trim()

// ── ALABASTER ────────────────────────────────────────────────
export const MATERIAL_ALABASTER = `
MATERIAL: The whole structure is carved from a single block of veined white alabaster — siding, shingles, trim, porch, all alabaster. Subtle natural veining (faint grey, faint cream) flows through the stone, irregular and organic. Strong subsurface scattering: thin sections (window mullions, porch trim, decorative details) glow faintly translucent where light passes through. Polished satin finish. Source colors do NOT carry through.
`.trim()

export const LIGHTING_ALABASTER = `
LIGHTING: Cool gallery atmospheric haze — diffused silver-cool luminous quality in the air around the model, slightly brighter toward the back-upper area. The alabaster catches light cleanly along its lit faces, glowing softly from within where light enters thin trim and details. Cool shadow on the away side picks up the natural veining of the stone.
`.trim()

// ── GLASS ────────────────────────────────────────────────────
export const MATERIAL_GLASS = `
MATERIAL: The entire structure is solid translucent glass — every wall, every shingle, every detail rendered in a single material with the optical character of art glass. Faintly tinted (pale ice-blue or pale honey, choose one consistent throughout). Internal volumes catch light and refract it; thin edges crisp and bright; thick sections deep with internal glow. Source colors do NOT carry through. The glass is uniform — no painted accents, no opaque areas.
`.trim()

export const LIGHTING_GLASS = `
LIGHTING: Cool gallery atmospheric haze with bright back-lighting that ignites the glass from behind — the model glows from within, edges crisp with caustic highlights, internal volumes carrying soft refracted color. The plinth catches refracted light from the glass above. Soft shadow on the away side.
`.trim()

// ── GINGERBREAD ──────────────────────────────────────────────
// IMPORTANT: gingerbread tends to rewrite architecture — the material wants
// to grow extra dormers, candy fences, candy trees, and decorative
// extensions. The architecture is the product (people's actual homes).
// Material is the costume. Structure-first discipline is mandatory.
export const MATERIAL_GINGERBREAD = `
MATERIAL: The exact source building, reconstructed from baked gingerbread — every wall, every plane, every architectural element rendered in gingerbread. The architecture is unchanged: same mass, same footprint, same number of dormers, same porch shape and extent, same window count and placement, same trim profiles. Decorative candy elements are applied AS A FINISH on top of the existing architecture, never as new architectural features.

GINGERBREAD CONSTRUCTION:
- Walls: warm caramel-brown gingerbread with visible bake texture and slightly uneven surface, in the architectural shape of the source building's siding/cladding.
- Trim: royal icing piped along trim profiles that already exist on the source — door surrounds, window frames, eave brackets, porch balusters. Icing FOLLOWS the source trim, never invents new trim.
- Roof: gingerbread shingles with white royal-icing piping along ridges and eaves. Snow-like powdered-sugar dusting on top.
- Source colors guide which architectural elements receive accent candy detailing — for example a red door becomes a peppermint-detailed door — but the candy goes WHERE color is, not as additional decoration.

CANDY DECORATION RULES (read carefully):
- Candy details (gumdrops, peppermints, small candies) decorate trim and accent points that ALREADY EXIST in the source. They never add new bays, dormers, or architectural masses.
- The garden may include modest candy details (a few candy bushes, a small candy-cane on the walkway) — but the yard remains primarily the same scale and density as the source. NO candy-cane fence wrapping the plinth. NO oversized candy trees. NO transforming the lawn into a candy yard.
- The plinth-internal margin is preserved — house and decorative candy elements together still occupy 55-65% of the plinth, leaving the same breathing room around the architecture as bronze or any other material.

These are people's actual homes rendered as gingerbread. Architecture is the unmovable foundation; gingerbread is the costume that fits it. Do NOT add architectural mass under guise of decoration. Do NOT let candy-pull rewrite the building.
`.trim()

export const LIGHTING_GINGERBREAD = `
LIGHTING: Warm bakery atmospheric haze — diffused honey-amber luminous quality in the air around the model, slightly brighter toward the back-upper area. The gingerbread catches light with rich warm brown surface, the icing reads bright white in lit areas and soft shadow elsewhere. Candy details catch tiny specular highlights. Cosy and edible.
`.trim()

// ── WATERCOLOR WOOD ──────────────────────────────────────────
export const MATERIAL_WATERCOLOR_WOOD = `
MATERIAL: The structure is a hand-painted wooden scale model — visible wood grain shows through everywhere, with watercolor washes applied loosely over the bare wood. Source colors DO carry through but as soft washed pigment rather than opaque paint, with visible brush strokes and pooling at corners. The grain of the wood remains the dominant texture; the paint is a translucent layer over it. Hand-crafted artisan feel, never industrially perfect.
`.trim()

export const LIGHTING_WATERCOLOR_WOOD = `
LIGHTING: Warm gallery atmospheric haze — diffused luminous quality in the air around the model, slightly brighter toward the back-upper area. Soft directional warmth catches the watercolor washes and the wood grain showing through. Recessed details register with rich tonal variation between painted and unpainted wood.
`.trim()

// ── CARVED WOOD ──────────────────────────────────────────────
export const MATERIAL_CARVED_WOOD = `
MATERIAL: The whole structure is a single block of richly figured hardwood (walnut or cherry) carved into the form of the building — every wall, every shingle, every detail a hand-carved facet of one continuous piece of wood. Visible chisel and gouge marks remain in places, the grain flowing through the entire mass. No paint, no stain — natural wood color throughout. Polished satin oil finish. Source colors do NOT carry through.
`.trim()

export const LIGHTING_CARVED_WOOD = `
LIGHTING: Warm gallery atmospheric haze — diffused luminous quality in the air around the model, slightly brighter toward the back-upper area. Light catches the wood grain along the lit faces — the figure of the wood reveals itself dramatically with directional light. Recessed details fall into deeper warm shadow.
`.trim()

// ── CARVED STONE (LIMESTONE) ─────────────────────────────────
export const MATERIAL_CARVED_STONE = `
MATERIAL: The whole structure is a single block of warm cream-colored limestone carved into the form of the building — every wall, every shingle, every detail hand-carved from one continuous piece of stone. Visible chisel marks and tool history remain in places, slight tonal variation in the natural stone color across the form. No paint, no color, no finish — natural limestone tone throughout, ranging from warm cream to soft buff to occasional pale grey-cream variation in the matrix. Soft matte surface with the very slightly chalky character of weathered limestone, never polished marble shine. The stone is opaque and weighty — not translucent like alabaster. Source colors do NOT carry through. The reference is classical-monument limestone — courthouse, library, civic-architecture register.
`.trim()

export const LIGHTING_CARVED_STONE = `
LIGHTING: Warm gallery atmospheric haze — diffused luminous quality in the air around the model, slightly brighter toward the back-upper area. The limestone catches light cleanly along its lit faces with the soft-matte register of natural stone, falling into cool shadow on the away side. Recessed details register with strong tonal contrast as the pale stone reads bright in the highlights and surprisingly deep in the shadows. The lighting flatters the slight chisel texture and tonal variation of the stone.
`.trim()

// ── DOLLHOUSE ────────────────────────────────────────────────
export const MATERIAL_DOLLHOUSE = `
MATERIAL: The structure is a hobby-shop dollhouse — painted resin and styrene plastic construction, source colors carried through but with the slightly plastic-y, slightly glossy register of mass-produced miniature toys. Decorative details are slightly oversimplified, slightly cartoonish; the proportions read as charming-toy rather than precision-replica. Painted finish has the cheerful flatness of brushed acrylic over plastic. Deliberately reads as toy rather than museum piece — but a beloved, well-made toy.
`.trim()

export const LIGHTING_DOLLHOUSE = `
LIGHTING: Cheerful warm atmospheric haze — bright diffused light around the model, slightly brighter toward the back-upper area. The plastic surfaces catch soft specular highlights along edges; painted details are bright and cheerful. Toy-shop window-display feel — clean, cheerful, never dramatic.
`.trim()

// ── MUSEUM-QUALITY (formerly scaled_architectural) ───────────
export const MATERIAL_MUSEUM_QUALITY = `
MATERIAL: This is the apex tier — every material element rendered at the highest possible craft quality. Hand-painted hardwood siding with a master's brushwork. Individually scribed shingles with subtle weathering variation. Real glass windows, micro-glazed and reflective. Trim profiles hand-carved from select hardwood. Foundation in tiny hand-laid scale stone or brick. Slight satin sheen of fine-art finish; every micro-detail crisp and convincing. Source colors carry through faithfully but rendered with painterly subtlety. The scale model a serious collector would pay thousands for.
`.trim()

export const LIGHTING_MUSEUM_QUALITY = `
LIGHTING: Warm museum-gallery atmospheric haze — diffused luminous quality in the air around the model, slightly brighter toward the back-upper area. Soft directional warmth wraps every surface, picking up the master-craft details — every shingle, every trim profile, every brushstroke registering distinctly. Deep tonal range from highlight to shadow. The lighting itself feels gallery-curated.
`.trim()

// ── SNOW GLOBE ───────────────────────────────────────────────
// Locked to night (forcedTimeOfDay). Self-contained recipe — does NOT
// receive the NIGHT_OVERRIDE_BLOCK because its night atmosphere is
// purpose-built and would conflict.
export const MATERIAL_SNOW_GLOBE = `
MATERIAL: A scale model home dusted thickly with snow. Snow piled on every roof plane, along every windowsill, drifted around the foundation and across the yard. Snow visible on the branches of any trees, on the porch railings, on the chimney top. Source materials and colors carry through faithfully beneath the snow layer — the home is recognizable, just deeply wintered. Soft satin sheen across both house and snow.

THE GLASS DOME — A SPHERE, NOT A BELL JAR:
The model and its plinth sit inside a transparent glass snow globe shaped as a TRUE SPHERE — round on all sides, narrowing meaningfully at BOTH top AND bottom. This is critical: it is a globe, not a bell jar, not a dome, not a cylinder with a domed cap.
- The glass curves inward at the top of the dome (narrowing toward an apex).
- The glass curves inward at the bottom too, narrowing to a distinct neck where the sphere meets the wooden plinth — a clear visible neck, like a snow globe sits on its base.
- The widest point of the sphere is at its middle, not at the bottom. The glass walls are NOT vertical or near-vertical anywhere.
- The model inside has clear breathing room on ALL sides — there is space between the building's roof and the inside top of the sphere, space between the building's walls and the inside sides of the sphere. The model never touches the glass, never pushes against the side walls, never crowds the dome.

THE GLASS — REAL OPTICAL MASS, NOT A TRANSPARENT OVERLAY:
The glass is substantial and weighty, with real optical thickness. The glass distorts what is seen through it. Where the model is viewed through the curved glass, the architecture refracts visibly: the building's edges bend slightly along the glass's curvature, light pools differently where the glass is thickest, the foreground edge of the dome causes a subtle horizontal smear of the model behind it. Specular highlights catch the curved outer surface where light strikes it — soft caustic blooms along the dome's top and far rim. The viewer reads a substantial piece of optical glass, never a thin transparent shell or a flat overlay.

FROST ON THE GLASS — ON THE INNER SURFACE, GROWING INWARD FROM THE RIM:
A dendritic ice frost pattern grows on the INNER surface of the glass sphere itself — feathered, fern-like, fractal ice crystals, the kind that forms on a frozen window pane. The frost is densest at the very rim of the sphere (around its outer profile and where it meets the plinth) and grows inward in branching feathered fingers, fading to clear glass over the central area of the sphere where the model inside is razor sharp.
Each frost crystal is delicate and hand-traced, with its own branching structure — feathered like a fern leaf, not a uniform haze, not a generic blur. Where the frost catches light, it refracts faint prismatic colors (subtle iridescence in pinks, blues, and golds along the crystal edges).
The frost is a PROPERTY OF THE GLASS SURFACE, not an effect in the surrounding scene. There are NO icy branches, NO frosted plants, NO ice patterns ANYWHERE outside the sphere — the frost lives only on the glass.

SNOW INSIDE THE SPHERE:
Snowflakes drift slowly through the air inside the sphere, suspended mid-fall. They are inside the glass, viewed through it — they too refract slightly through the curved surface.
`.trim()

export const LIGHTING_SNOW_GLOBE = `
LIGHTING: Cold winter night atmosphere with two warm sources lighting the model from outside the dome:
- A wrought-iron streetlamp stands in the room background visible through a window beyond the dome — its warm amber glow filters through the glass and catches the snow inside.
- A warm brass desk lamp on the side table near the dome casts strong directional warm light onto the model — the dome's outer glass catches a soft amber specular highlight on the lit side and warm caustic refraction along the curved surface.
Cool moonlight enters from a second window, providing cold silver-blue rim light on the away side of the dome.

Inside the model: faint warm interior lights glow through several windows, partially obscured by curtains — a lived-in feel with rooms in use. Through one window, the suggestion of a warm fireplace flicker, slightly orange and brighter than the others.

The light on the snow inside the dome makes it sparkle — tiny specular catches across the drifts. Where light passes through the dendritic frost on the inner glass, it refracts in faint prismatic colors along the crystal edges.
`.trim()

export const LAYER_SNOW_GLOBE = `
ROOM ATMOSPHERE — WINTERIZED NIGHT INTERIOR:
The room around the dome is a cosy winter interior at night. Through a large window in the background: a snowy night scene — falling snow, snow-covered street, the streetlamp visible glowing in the distance.
On the desk near the dome: the warm brass lamp glowing, perhaps a steaming mug, perhaps a folded blanket. Heavy drapes, deep wood paneling, leather chair half-glimpsed, books on a shelf. The room is dim and peaceful — the snow globe is the bright focal centerpiece.

NO ICE OR FROST IN THE ROOM:
There must be NO icy branches, frosted twigs, ice-covered plants, frost crystals, or wintery foliage decorations ANYWHERE in the room around the dome. No ice on the desk, no frosted branches flanking the dome, no frozen plants in vases, no icy decorative dressing of any kind. The room is a normal cosy interior. The only ice in the entire image is the dendritic frost on the inner surface of the dome's glass. The snow scene visible through the background window is fine — that is outside, where snow belongs.
`.trim()

// ═══════════════════════════════════════════════════════════════
// 7. SEASON PRESETS — additional 3 (summer already above)
// ═══════════════════════════════════════════════════════════════

// All seasons share MATERIAL_SUMMER_RESIN (already exported above) —
// realistic miniature scale-model materials with source colors carried.

// ── SPRING ───────────────────────────────────────────────────
export const LIGHTING_SPRING = `
LIGHTING: Soft fresh spring atmospheric haze — bright diffused luminous quality in the air around the model, slightly brighter toward the back-upper area. Cool morning warmth wraps the model from one side, every surface readable. Air feels fresh and luminous.
`.trim()

export const LAYER_SPRING = `
SEASON LAYER — SPRING:
Fresh young foliage — bright lime and yellow-green, trees not yet at full canopy. Flowering shrubs and blooming perennials: cherry blossom, tulips, daffodils in bloom. New grass vivid and fresh. Petals scattered on the pathway and garden beds. Hopeful, fresh, full of color.

Property layout: a mature shade tree to the right at scale, slightly larger flanking tree to the left. Naturalistic garden style — soft-edged beds, native perennials in layered drifts, stepping stones set into ground cover, a few small natural boulders. The lawn lush and green, edges soft but maintained. Walkway runs from the porch toward the plinth edge, ending in lawn before the rim.
`.trim()

// ── FALL ─────────────────────────────────────────────────────
export const LIGHTING_FALL = `
LIGHTING: Warm autumn atmospheric haze — golden-amber luminous quality in the air around the model, slightly brighter toward the back-upper area. Late afternoon warmth wraps the model with rich directional gold, every surface texture catching the warm light.
`.trim()

export const LAYER_FALL = `
SEASON LAYER — FALL:
Trees ablaze with amber, orange, and deep red foliage at peak color. Fallen leaves scattered naturally across the lawn, pathway, and base. Dried flower stalks, ornamental grasses, late-season mums in rust and gold. Peak autumn — rich, warm, deeply beautiful.

Property layout: a mature shade tree to the right at scale, slightly larger flanking tree to the left, both in peak color. Classic American neighborhood garden — symmetrical foundation plantings, clipped boxwood spheres, neat seasonal annuals lining the walk. Walkway runs from the porch toward the plinth edge, ending in lawn before the rim.
`.trim()

// ── WINTER ───────────────────────────────────────────────────
export const LIGHTING_WINTER = `
LIGHTING: Cool crisp winter atmospheric haze — pale silver-cool luminous quality in the air around the model, slightly brighter toward the back-upper area. Low directional winter sun rakes across the model with cool warmth, catching the snow and frost surfaces with subtle specular sparkle.
`.trim()

export const LAYER_WINTER = `
SEASON LAYER — WINTER:
Bare branched trees with stark elegant silhouettes. Light dusting of snow on the roof, base edge, and along the pathway. Frost on the ground, muted cool tones, minimal ground vegetation. Quiet, still, serene.

Property layout: a well-shaped ornamental tree to the right at scale, matching slightly larger tree to the left, both bare-branched. Formal symmetrical garden style — clipped evergreen hedges defining bed edges with clean geometric lines, matching topiaries flanking the front walk. The walk runs centered toward the plinth edge, ending in snow-dusted lawn before the rim.
`.trim()

// ═══════════════════════════════════════════════════════════════
// 8. EVENT PRESETS — additional 4 (haunted already above)
// ═══════════════════════════════════════════════════════════════

// ── FIRE ─────────────────────────────────────────────────────
// Locked to night via forcedTimeOfDay. Receives NIGHT_OVERRIDE? No —
// the fire IS the light source. NIGHT_OVERRIDE would conflict.
// Handle in the prompt builder: if preset.forcedTimeOfDay === 'night'
// AND preset has its own night-specific lighting, skip the override.
// (See houses-presets.ts for the gate.)

export const MATERIAL_FIRE = `
MATERIAL: The home consumed by fire — partial structural collapse, charred surfaces in deep brown, charcoal grey, and ash white (NOT flat black). Wood grain readable in the charred siding. Brick still showing coursework under soot. Shingle texture visible on collapsed roof sections. Source materials still readable beneath the damage. The model is detailed, every surface textured.

Damage: roof partially collapsed exposing charred timber beams, some walls burnt through entirely, soot streaks upward from every opening, paint blistered, windows blown out, frames warped. Small embers glowing in the debris. Landscaping scorched — ash-grey ground, charred stumps where trees stood.
`.trim()

export const LIGHTING_FIRE = `
LIGHTING: The fire IS the dominant light source — strong warm orange-red glow emanates from within the structure, pulsing through windows, doorways, and gaps in walls. Warm fire-glow illuminates every charred surface from within the model, ember-orange highlights raking outward across the wreckage. Atmospheric haze: smoke-tinted air around the model glowing warm and amber, slightly brighter toward the back where the largest fire mass burns. Every surface readable in firelight, every detail textured.

Secondary cool moonlight provides a faint silver-blue rim along the away side of the structure, contrast against the dominant warm glow.
`.trim()

export const LAYER_FIRE = `
EVENT LAYER — FIRE AFTERMATH:
The structure burns in real time — flames visible through window openings and roof breaches, smoke drifting upward into the night sky. The room around the plinth carries the scene: the room itself shows fire damage, one wall partially burnt through, charred ceiling beams above, a pool of firefighters' water on the desk reflecting the burning model. Embers and ash drift in the air.
`.trim()

// ── EXPLOSION ─────────────────────────────────────────────────
// Day/Night honored. Recipe assumes night by default for drama; day
// variant pulls toward the smoke-and-rubble register without firelight.

export const MATERIAL_EXPLOSION = `
MATERIAL: The home struck by a catastrophic explosion — partial structural collapse. One section of roof and wall blown outward; exposed interior framing visible. Debris scattered across the base: bricks, timber, shattered glass, broken furniture fragments. A crater visible near the structure — scorched earth, blackened ground. Remaining walls cracked and blackened, structurally compromised. Windows blown out entirely, doors hanging or missing. Frozen in the immediate aftermath — dramatic, violent. Source materials still readable beneath the damage.
`.trim()

export const LIGHTING_EXPLOSION = `
LIGHTING: Harsh dramatic atmospheric haze — dust-thick air around the model where the explosion's force still settles. Strong directional warmth from one upper-side raking across the model with hard shadows; the dust catches the directional light and glows faintly in the air. Embers and small fires within the wreckage cast secondary warm glow from inside the broken walls. Cool moonlight or sky-fill provides a silver-blue rim on the away side.
`.trim()

export const LAYER_EXPLOSION = `
EVENT LAYER — EXPLOSION AFTERMATH:
The blast radius extends across the plinth — debris (bricks, timber, shattered glass, broken furniture fragments) scattered widely around the structure. The room around the plinth carries the same destruction: a massive jagged hole through one wall and ceiling, the hole revealing dust-thick night sky beyond. Plaster dust still settling, overturned furniture in violent disarray, a swinging emergency bulb casting hard moving shadows.
`.trim()

// ── ALIEN ─────────────────────────────────────────────────────
// Locked to night via forcedTimeOfDay (alien moons + bioluminescence).
// Self-contained — does NOT receive NIGHT_OVERRIDE.

export const MATERIAL_ALIEN = `
MATERIAL: The structure reads as itself — same building, same source materials and colors — but transplanted onto an alien world. The materials carry their original colors but read slightly off under alien light, with subtle bioluminescent moss or vines clinging to the walls in faintly glowing patches.
`.trim()

export const LIGHTING_ALIEN = `
LIGHTING: An alien sun has set; the scene is lit primarily by two moons and bioluminescence. Cold violet-magenta moonlight enters from one upper-side, throwing crisp dramatic shadows across the model in low-angle deep shadow. The alien moonlight makes familiar materials look otherworldly — brick reads purple-tinted, white reads lavender, glass refracts with prismatic color.

Bioluminescent flora and fauna in the yard provide secondary cool teal-green glow from below and around the model, soft and pulsing. Two moons visible low on the horizon in the room background — one large and close, one small and distant. The sky is deep burnt orange fading to purple-black.
`.trim()

export const LAYER_ALIEN = `
EVENT LAYER — ALIEN PLANET:
The diorama base is alien terrain — bioluminescent ground cover in electric teal and acid green, crystalline formations jutting from the base in purple and blue, deep rust-red soil, pools of glowing cyan liquid. Strange alien plants replace normal vegetation: tall stalks with multiple glowing orbs instead of leaves, enormous mushroom-like organisms with bioluminescent undersides, tentacle-like vines with iridescent surfaces.

Alien creatures in the yard: 2-3 small insect-like creatures with translucent exoskeletons, a large long-necked creature peering over the roofline with curious enormous eyes, small frilled lizard-creatures clinging to walls, membrane-winged flyers circling above.

The room beyond is an alien research facility — curved organic walls of bone-ceramic material, holographic display screens floating in the air, crystalline scientific instruments on articulated arms taking readings. Cold blue-white clinical lighting with teal and violet accents. The model is being studied and catalogued.
`.trim()

// ── ABANDONED ─────────────────────────────────────────────────
// Day/Night honored. Day = melancholic overgrowth; night = adds
// streetlamp/moonlight via NIGHT_OVERRIDE_BLOCK.

export const MATERIAL_ABANDONED = `
MATERIAL: The home abandoned for 20-30 years; nature has taken over. Thick vines and ivy consume every wall surface, crawling through every gap. The roof partially collapsed in sections — holes exposing dark interior. Windows all broken — jagged glass fragments, dark empty frames choked with vines. Porch railings rotted and fallen, front steps broken, door hanging open or missing. Exterior paint entirely gone — bare weathered wood, stained and warped. Sections of siding fallen away exposing rotted sheathing. Source materials and colors faintly readable beneath the decay.
`.trim()

export const LIGHTING_ABANDONED = `
LIGHTING: Warm melancholic atmospheric haze — dim diffused gold-amber luminous quality in the air around the model, slightly brighter toward the back-upper area. Soft directional warmth catches the wreckage with strong tonal contrast: bright on the structure, deep cool shadow in the recesses where decay pools. Dust particles catch the warm light and drift visibly in the air.
`.trim()

export const LAYER_ABANDONED = `
EVENT LAYER — ABANDONED FOR DECADES:
The landscaping completely consumed by nature — wild growth, dead trees, chest-high weeds. The pathway buried under vegetation. The yard a wilderness, the house being swallowed by the earth. Around the plinth, the room is forgotten too — thick dust on every surface, cobwebs across corners, peeling wallpaper hanging in strips, floorboards warped and buckled, broken furniture tipped over. A mirror cracked and clouded with age. Time stopped here decades ago. Eerie, deeply melancholic, beautiful in decay.
`.trim()
