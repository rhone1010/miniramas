// lib/v1/landscapes/landscapes-effects.ts
//
// All parameterized copy for the Pass 1 prompt builder.
// Indexed by schema ID, consumed by landscapes-prompt.ts.
//
// Recent semantic-density rev (this pass) — boundary handling
// consolidation + 3D-physical positive directive + plaque sizing:
//
//   • POSITIVE 3D-PHYSICAL DIRECTIVE added to PLINTH_BLOCK opening.
//     The list of forbidden enclosures (glass dome, bell jar, cloche,
//     etc.) wasn't preventing all failures — most recently a "curved
//     display panel with the scene printed on it" snuck through
//     because it wasn't on the explicit forbidden list. Negative
//     directives anchor what's forbidden but don't assert what the
//     scene IS. The new opening line tells NB2 the scene is real 3D
//     physical objects (bark, leaves, dirt, water) standing on the
//     plinth top — never a 2D image, billboard, or display screen.
//
//   • BOUNDARY HANDLING CONSOLIDATED into SPATIAL_RULES_BLOCK.
//     Previous arrangement spread organic-overgrowth rules,
//     no-enclosure rules, source-arch handling, offscreen handling,
//     and forced perspective across two blocks (SPATIAL_RULES +
//     PLINTH_BLOCK). New arrangement: SPATIAL_RULES owns ALL
//     boundary behavior. PLINTH_BLOCK is plinth-only (shape, profile,
//     material, plaque, "plinth never extends upward"). Rules that
//     were duplicated removed.
//
//   • ORGANIC BOUNDARY HANDLING refined per user spec:
//       - Ground-level organics (grass, moss, vines, ferns):
//         overhang past front/lateral rim ENCOURAGED, not just
//         allowed. Rear rim still contains.
//       - Vertical organics (trees): terminate naturally at top as
//         canopy or randomized organic growth. Canopy may extend
//         laterally up to ~5% of image width past edge. Trees that
//         exceed image frame are CROPPED BY THE IMAGE FRAME, never
//         by an enclosure.
//       - "No vertical or round cropping lines anywhere above the
//         plinth base" — the explicit anti-rule that catches the
//         arched-display-panel failure mode.
//
//   • PLAQUE PROPORTION switched from "≤ 3/4 plinth height" to
//     "≤ 3% of image height". Frame-relative anchor matching the
//     plinth's frame-relative ceiling (5%). With plinth at 5% and
//     plaque at 3%, plaque reads as visually subordinate (60% of
//     plinth height) without depending on the model computing a
//     ratio of one variable thing to another.
//
// Earlier locked decisions still in force:
//   • TIERED LIGHTING — subject 1.45×, foreground 1.2×, baseline.
//     Subject tier user-validated as "perfect, keep at all costs";
//     foreground tier added for near-to-far depth separation.
//   • PLINTH consolidated to dedicated block (was split across
//     OBJECT_REALISM and SPATIAL_RULES PLINTH GEOMETRY)
//   • Plaque proportion: ≤ 3/4 plinth height, never the visual hero
//   • SPATIAL_RULES with organic-overgrowth exception (grass/vines/
//     limbs/canopy may sparingly extend ~5% past plinth edge);
//     constructed elements stay strictly contained
//   • ATMOSPHERE_EFFECTS at action-minis directive density per
//     atmosphere (positioned/substantial/physical/interactive)
//   • Lighting subsystem collapsed to one parameterized function;
//     atmosphere-specific volumetric phenomena live in
//     ATMOSPHERE_EFFECTS not LIGHTING
//   • CAMERA_EFFECTS.elevated stripped of forced-perspective recipe
//     (lives only in SPATIAL_RULES)
//   • SCALE_EFFECTS internal repetition fixed
//   • OBJECT_REALISM stripped of PLINTH subsection

import type {
  AtmosphereID, ResolvedEnvironment, ScaleID, CameraAngleID,
} from './landscapes-shared'

// ── ATMOSPHERE ────────────────────────────────────────────────
// Each atmosphere carries the visible volumetric phenomena that
// atmosphere produces — positioned, substantial, physical, interactive.
// This is where beam lighting lives in the prompt.
//
// Lines do not end with a period — atmosphereBlock() in prompt.ts
// adds the period after wrapping with the "primary lighting driver"
// framing.
export const ATMOSPHERE_EFFECTS: Record<AtmosphereID, string> = {
  natural: 'natural daylight ambient — scene conditions drive the light. Where the source supports it, soft sunbreaks penetrate cloud cover and tree-filtered shafts angle into the diorama, physically visible in the air. Atmospheric depth, not flat exposure',
  golden:  'warm golden-hour sunlight, directional from upper frame. A substantial visible sun-shaft / god-ray cuts down through canopy and cloud break — a dominant beam physically visible in the air, one of the dominant compositional features of the shot. Where the beam meets surfaces they light up: backlit foliage glowing, water sparkling, edges rim-fired with warm light. Atmospheric haze drifts in the beam',
  dusk:    'cool twilight ambient with warm focal highlights. The last of the sun cuts across the scene in low raking horizontal beams, picking out tops of structures and lighting tree silhouettes from behind. Warm focal pools where the raking light catches; blue shadow pools elsewhere. Atmospheric haze visible in the beam path',
  storm:   'high-contrast storm lighting — dark turbulent skies, lightning, dense weather. A dramatic shaft of light breaks through heavy cloud and lands on the diorama, a theatrical god-ray cutting through expansive rain-mist and atmospheric haze. Beam physically visible over substantial frame area, illuminating mist where it cuts through. Sky drives the lighting; the diorama is the lit subject',
  night:   'low-key nocturnal lighting. A moonbeam / shaft of moonlight streams down from upper portion of frame through atmospheric particulate or low mist — physically visible in the air, a dominant compositional element. Where it catches surfaces, they glow silver-cool. Selective practical illumination from cottage windows and lanterns adds warm focal pools in deep shadow. Sky drives the lighting',
}

// ── ENVIRONMENT (resolved) ────────────────────────────────────
// Kept as a constant for any external consumer, but no longer included
// in prompt assembly — the conditional CONTROLLED_ENVIRONMENT_BLOCK or
// IN_SITU_BLOCK below carries the full environment direction.
export const ENVIRONMENT_EFFECTS: Record<ResolvedEnvironment, string> = {
  controlled: 'upscale study or gallery environment with rich wood, bookshelves, subtle decor, soft depth-of-field, and window light matching the scene atmosphere',
  in_situ:    'diorama placed directly within the source environment on matching natural terrain',
}

// ── SCALE ─────────────────────────────────────────────────────
// "The full plinth remains visible" appended by scaleBlock() in prompt.ts;
// these strings no longer carry that phrase to avoid back-to-back repetition.
export const SCALE_EFFECTS: Record<ScaleID, string> = {
  close_up: 'diorama occupies approximately 65–80% of the frame, tighter composition',
  fill:     'diorama occupies approximately 85–95% of the frame, hero emphasis with minimal margin',
}

export const SCALE_PERCENT: Record<ScaleID, number> = {
  close_up: 75,
  fill:     90,
}

export const SCALE_PAD_RATIO: Record<ScaleID, number> = {
  close_up: 0.167,
  fill:     0.056,
}

// ── CAMERA ────────────────────────────────────────────────────
// Forced-perspective recipe lives only in SPATIAL_RULES_BLOCK
// FORCED PERSPECTIVE INSIDE THE PLINTH. Previously duplicated here.
export const CAMERA_EFFECTS: Record<CameraAngleID, string> = {
  hero:     'approximately 40–50 degrees downward — natural product photograph angle',
  elevated: 'approximately 55–65 degrees downward — improves clarity of flat or receding scenes',
}

// ──────────────────────────────────────────────────────────────
// ALWAYS-ON CRAFT BLOCKS
// ──────────────────────────────────────────────────────────────

// A) Object Realism — preserves source structure + tactile material language.
// PLINTH treatment lives in its own dedicated block (PLINTH_BLOCK below).
export const OBJECT_REALISM_BLOCK = `OBJECT REALISM:
Preserve structure, scale relationships, and material richness from the source. Use carved terrain, varied foliage, resin-like water, worn wood, rough stone, uneven vegetation, and natural imperfections. Avoid smoothing, beautification, tonal flattening, or repeated texture patterns. Preserve micro-contrast and tactile detail throughout the scene.`

// A2) Plinth — single source of truth for plinth shape, profile,
// material, finish, plaque proportion, no-extension rules, and
// source-arch handling.
//
// 2-element trim (simplified from earlier 3-element):
//   • TOP: subtle chamfer / small bullnose at upper edge — barely a
//          feature, just edge softening
//   • BOTTOM: slightly more prominent rolled base molding curving
//             outward, the dominant trim feature
//   • The cylindrical body between them has NO minimum vertical
//     extent — it can be as short as needed.
//
// Height: single frame-relative ceiling (≤ 5% of image height).
// Earlier passes used 1/10-of-diameter + 4:1 scene-to-plinth ratio;
// having three competing height anchors was diluting the directive.
// 5% of image height is directly verifiable.
export const PLINTH_BLOCK = `PLINTH:
The diorama is real 3D physical content — actual miniature trees with bark and leaves, actual dirt and stone, actual water with depth and reflection — standing as solid objects ON the plinth's flat top surface. Never a printed image, painted scene, photograph, billboard, curved display panel, framed picture, or screen. The scene rises from the plinth as 3D objects, never wrapped onto a 2D backing.

The plinth itself is a thin turned-wood disc with two restrained trim elements: a subtle chamfer or small bullnose at the upper edge (barely a feature, just edge softening), and a slightly more prominent rolled base molding at the bottom that curves outward, making the base marginally broader than the body. The cylindrical body between these two trims has no minimum vertical extent — it can be as short as needed.

The plinth's total vertical thickness occupies no more than 5% of the total image height. Read it as a serving tray rim or a watch case bottom — never a pedestal, never a drum, never a tier. Err thinner, never thicker.

Material is richly figured walnut or mahogany; visual interest comes from grain, chatoyance, and the restrained trim profile. Finished to a deep polished sheen.

When a plaque is present it sits centered on the front face — at most 3% of the total image height, never the visual hero of the image. The front rim stays clean — no fallen branches, twigs, or storm debris piled at the front edge.

The plinth is a flat horizontal disc and never extends upward into a wall, arch, half-dome, canopy, or enclosure of any kind — even a wooden arch matching the plinth's wood is forbidden.`

// B) Lighting — single function. Two modes from one boolean:
//   addBeam=false → 3-Point gallery lighting only (default for all renders)
//   addBeam=true  → 3-Point gallery lighting + accent volumetric beam
//
// 3-Point is the consistent base lighting model for both Desk AND
// In-Environment renders. addBeam is the optional dramatic accent.
// Atmosphere-specific volumetric phenomena (god-rays, sun shafts,
// moonbeams, raking beams) live in ATMOSPHERE_EFFECTS, not here.
//
// Always-on baked-in qualities:
//   • TIERED LOCALIZED LUMINANCE SHAPING:
//       - Subject tier ~1.45× exposure (hero, plaque, standout
//         compositional features). User-validated as "perfect" —
//         do not change this directive.
//       - Foreground tier ~1.2× exposure (front quarter of the scene
//         — near-rim ground content, foreground grass, props nearest
//         viewer). Softer lift establishing near-to-far depth
//         separation.
//       - Background / surroundings at baseline — deliberately
//         underexposed by comparison.
//   • Local variance directive — within lifted tiers, lighting varies
//     spatially (facets, edges, surfaces catch light at different
//     intensities). Stops gpt-image-1 from rendering subject features
//     as a uniform bright wash.
//   • Radiant cinematic quality with strong luminous separation
//     (was "Scene Feel: dramatic")
//   • Anti-flatness directive — three phrasings of "no globally even
//     exposure" collapsed into one weighted sentence.
export function buildLightingBlock(input: { addBeam: boolean }): string {
  const modeText = input.addBeam
    ? `Use gallery three-point lighting (key from upper front-left, fill from front-right, rim from behind for separation) combined with an accent volumetric beam from above to highlight the hero. Maintain visible beam falloff and atmospheric contrast.`
    : `Use gallery three-point lighting: a primary key light from upper front-left, a softer fill from front-right, and a rim light from behind for separation. Light wraps the subject without flattening it.`

  return `LIGHTING:
${modeText}

Apply tiered localized luminance shaping for depth:

Subject tier (~1.45× exposure): the hero subject, the plaque on the front rim of the plinth (when present), and standout compositional features (docks, walkways, structures, water reflections). These are the brightest points in the frame.

Foreground tier (~1.2× exposure): elements in the front quarter of the diorama scene (near-rim ground content, foreground grass, props closest to the viewer) that aren't already in the subject tier — a softer lift establishing near-to-far depth separation.

Background and surroundings remain at baseline, deliberately underexposed by comparison.

Within the lifted tiers, lighting varies locally — facets, edges, and surfaces catch light at different intensities, never a uniform wash. Light accumulates around areas of narrative importance — exposure lifts on the features themselves, atmospheric bounce illuminating them from within the scene, selective contrast separating them from the environment. Crisp highlights, clear luminance hierarchy, deep shadow retention elsewhere.

Lighting reads as radiant cinematic — elevated atmospheric glow, strong luminous separation between subject and environment, sharper form definition. Lighting must never be evenly distributed, flatly ambient, or globally normalized — those are failure modes. Darkness is intentional composition.`
}

// C) Vegetation — Pass 1 reinforcement against symmetrical/decorative
// foliage patterns.
export const VEGETATION_BLOCK = `VEGETATION:
Vegetation must feel organic and naturally distributed. Avoid symmetry, decorative arrangements, repeated branching, or synthetic foliage patterns.`

// D) Spatial Rules — physical-vs-atmospheric containment with organic-
// overgrowth exception, offscreen handling, and forced perspective.
//
// Plinth shape rules are NOT here — they live in PLINTH_BLOCK to
// consolidate plinth-truth into one place.
//
// Organic-overgrowth exception: grass, vines, tree limbs, and canopy
// may sparingly extend slightly past the plinth edge for visual
// interest. Constructed elements (houses, walls, paths, docks,
// terrain) stay strictly contained — they are the failure mode this
// rule defends against.
//
// Atmospheric containment: atmospheric phenomena may extend past the
// plinth as ambience but never as solid objects. No floating clouds /
// sun discs / halos / fog masses as filler.
export const SPATIAL_RULES_BLOCK = `SPATIAL RULES — PHYSICAL VS ATMOSPHERIC:

Every PHYSICAL element of the scene — terrain, water, structures, paths, rocks, benches, props, figures — sits ON OR INSIDE the wooden plinth. Constructed elements (houses, walls, bridges, docks, fences, paths, terrain features) never overhang or extend past the plinth edge. The plinth is not a decorative inset on a larger landscape; it is the entire stage.

ORGANIC BOUNDARY HANDLING (where vegetation transits the plinth edge):
Ground-level organics (grass, moss, vines, ferns, low brush, fallen leaves) — overhanging the camera-facing front and lateral rim is encouraged. These elements draping naturally over the edge looks intentional. The rear rim (away from camera) keeps everything contained.
Vertical organics (trees, tall plants) standing on the plinth — terminate naturally at the top as canopy or randomized organic growth (irregular branch ends, tapering foliage, scattered leaves). Their canopy may extend laterally up to ~5% of image width past the plinth edge for visual interest. Trees that exceed the image frame are CROPPED BY THE IMAGE FRAME — like a scale model photographed too close — never by an enclosure.

CRITICAL — NO ENCLOSURE ABOVE THE PLINTH:
The space above the plinth's top surface is OPEN AIR. No vertical, curved, or round cropping line frames or terminates the scene anywhere above the base. No glass dome, bell jar, cloche, display case, transparent cover, curved panel, flat panel, half-dome, arch, ring, canopy structure, or boundary line of any kind. No background plates, printed scenery, or sky panels. Trees rise from the plinth as 3D physical objects and either crop at the image frame or terminate as natural canopy — never inside an enclosure.

If the source's composition forms an arch or converging shape (a road framed by tree canopies, a tunnel of branches, a corridor of rocks), reproduce that shape as TALL MINIATURE TREES or ROCKS standing as 3D objects on the flat plinth top — never as the diorama's enclosure. The plinth stays flat.

ATMOSPHERIC CONTAINMENT:
Atmospheric phenomena — fog, mist, low cloud, light shafts, golden haze, weather, distant blur — may extend past the plinth as background ambience, but never as solid floating objects. Do not reproduce sky as floating clouds, sun discs, halos, fog masses, or any object hovering above the scene as filler. The space above the diorama is filled by the room background (desk) or natural environment blur (in-environment) — never by invented physical phenomena.

FORCED PERSPECTIVE INSIDE THE PLINTH:
For tilted or elevated camera angles, use forced perspective WITHIN the plinth to create depth. A dramatically large foreground anchor (a bench, a rock, a tree branch, tall grass, the front edge of a path) sits at the near rim of the plinth, and the rest of the scene compresses backward, scale falling off toward the rear rim. The illusion is a vast landscape; the reality is a small wooden disc with everything on it. Foreshortening serves containment — it does not break it.`

// ──────────────────────────────────────────────────────────────
// CONDITIONAL ENVIRONMENT BLOCKS
// ──────────────────────────────────────────────────────────────

// E) Desk Environment — emits when resolvedEnv = 'controlled'.
// Internal symbol stays CONTROLLED_ENVIRONMENT_BLOCK (no migration cost),
// but the model-facing block header reads "DESK" to match the
// user-facing "Desk" label.
export const CONTROLLED_ENVIRONMENT_BLOCK = `DESK:
Environment should feel expensive, warm, and intentionally designed. Use upscale studies, galleries, libraries, or collector spaces with rich wood, bookshelves, subtle decor, and atmospheric depth. Window lighting and room mood should match the diorama atmosphere and time-of-day.`

// F) In-Environment — emits when resolvedEnv = 'in_situ' (whether
// user-picked or storm/night-forced). Internal symbol stays IN_SITU_BLOCK
// for code stability; model-facing block header reads "IN-ENVIRONMENT"
// matching the UI label "In Environment".
export const IN_SITU_BLOCK = `IN-ENVIRONMENT:
The plinth rests directly on terrain matching the source environment: grass, dirt, sand, rock, moss, leaf litter, snow, etc. Surrounding ground is a softly blurred continuation of the same environment with matching season, weather, and light direction. Add realistic contact shadow and slight grounding indentation so the base feels physically placed. No constructed surfaces, tables, floors, walls, ceilings, lamps, shelves, or room objects may appear.`

// G) Low-Vertical Source Composition — conditional camera/scale
// override for sources that primarily depict horizontal/ground-level
// content. Atmospheric containment rules consolidated upstream into
// SPATIAL_RULES_BLOCK; this block now carries only its unique role.
export const LOW_VERTICAL_BLOCK = `LOW-VERTICAL SOURCE COMPOSITION:
If the source primarily depicts horizontal or ground-level content (paths, roads, plains, flat terrain, calm water surfaces) with little vertical structure, the camera angle elevates to approximately 55-65 degrees downward and the diorama (plinth + scene) fills 60-70 percent of the frame, regardless of camera or scale settings.`
