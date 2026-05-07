// lib/v1/landscapes/landscapes-effects.ts
//
// All parameterized copy for the Pass 1 prompt builder.
// Indexed by schema ID, consumed by landscapes-prompt.ts.
//
// Compressed per LITENCO Production Prompt v2 + decisions locked in
// successive engine passes. Recent semantic-density rev:
//   • PLINTH consolidated to a single dedicated block — shape, profile,
//     material, finish, no-extension rules all in one place. Was
//     previously split across OBJECT_REALISM (profile/material) and
//     SPATIAL_RULES PLINTH GEOMETRY LOCK (shape rules). The split was
//     letting the model partially comply with each facet while losing
//     the gestalt — saddle/banked/stacked-pedestal failures.
//   • OBJECT_REALISM stripped of PLINTH subsection.
//   • SPATIAL_RULES PLINTH GEOMETRY LOCK removed (now in PLINTH).
//     Atmospheric containment language absorbed into SPATIAL_RULES from
//     LOW_VERTICAL where it was duplicated.
//   • LOW_VERTICAL trimmed to its unique role — conditional camera/scale
//     override for low-vertical sources. Atmospheric content rule
//     consolidated upstream in SPATIAL_RULES.
//   • SCALE_EFFECTS internal repetition fixed (was emitting "base fully
//     visible" + "plinth remains visible" back-to-back).
//   • CAMERA_EFFECTS.elevated stripped of forced-perspective recipe —
//     recipe now lives only in SPATIAL_RULES FORCED PERSPECTIVE.
//   • ATMOSPHERE_EFFECTS expanded per atmosphere with positioned,
//     substantial, physical, interactive volumetric language. The bare
//     palette-only lines (golden was 9 words) are what was producing
//     muted/missing beams in current renders. The win-state had this
//     density; v5 collapse stripped it; this restores it.
//   • buildLightingBlock focal paragraph — restored quantitative anchor
//     ("the brightest points in the frame, surroundings deliberately
//     underexposed") that v5 collapse turned into "strong"/"dramatically
//     brighter". Adds localized luminance shaping vocabulary (exposure
//     lifts, atmospheric bounce, selective contrast). Anti-flatness
//     directive tightened — three phrasings of the same idea collapsed
//     into one weighted sentence.
//
// Earlier locked decisions still in force:
//   • Lighting subsystem collapsed from 4 blocks → 1 (now parameterized)
//   • Scene Feel axis REMOVED — quality always equivalent to "dramatic";
//     baked into LIGHTING block as always-on
//   • Focal Lighting dial REMOVED — emphasis baked into LIGHTING
//   • Atmosphere ID 'none' → 'natural' (label "As Is")
//   • Scale 'zoom_out' (60%) REMOVED — two options now: close_up, fill
//   • CameraAngle 'low' (Ground) REMOVED — two options now: hero, elevated
//   • CONTROLLED ENVIRONMENT split out as its own block
//   • VEGETATION re-added
//   • IN-SITU prompt block kept (model-facing); UI label is "In Environment"

import type {
  AtmosphereID, ResolvedEnvironment, ScaleID, CameraAngleID,
} from './landscapes-shared'

// ── ATMOSPHERE ────────────────────────────────────────────────
// Each atmosphere now carries the visible volumetric phenomena that
// atmosphere produces — positioned (where the beam is), substantial
// (dominant feature of the shot), physical (visible in the air), and
// interactive (where it meets surfaces, those surfaces respond).
// This is where beam lighting lives in the prompt; LIGHTING handles
// the rig and focal emphasis.
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
// material, finish, no-extension rules, and source-arch handling.
// Was previously split across OBJECT_REALISM (profile/material) and
// SPATIAL_RULES PLINTH GEOMETRY LOCK (shape + extension rules).
//
// Closes the canopy-as-dome / wooden-arch loophole that stacked-pedestal
// and saddle/banked plinth failures kept hitting — keeps the explicit
// "even when the upward extension would be wood matching the plinth
// itself" carve-out intact.
export const PLINTH_BLOCK = `PLINTH:
The plinth is a single low turned-wood disc — flat top face, flat bottom face, a single soft curved side wall. Profile is restrained: presence and weight without becoming chunky, slab-like, tiered, or stacked. Material is richly figured walnut or mahogany; visual interest comes from grain and chatoyance, not profile detail. Finished to a deep polished sheen. The front rim stays clean — no fallen branches, twigs, or storm debris piled at the front edge.

The plinth NEVER extends upward into a wall, arch, half-dome, canopy, or enclosure of any kind. This applies even when the upward extension would be wood matching the plinth itself — a wooden arch growing from the plinth is forbidden. No glass domes, bell jars, cloches, display cases, transparent covers, background plates, printed scenery, sky panels, artificial arches, or rings frame the diorama. The plinth is the only frame, and the plinth is a flat disc.

If the source's composition forms an arch or converging shape (a road framed by tree canopies, a tunnel of branches, a corridor of rocks), the plinth still remains flat. The arch is reproduced as scene content — typically as tall miniature trees or rocks standing as objects on the flat plinth surface — never as the diorama's enclosure.`

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
//   • Localized luminance shaping — features are the brightest points
//     in the frame, surroundings deliberately underexposed. This is the
//     restored Focal Lighting +30 quantitative anchor. v5 collapse had
//     turned it into "strong"/"dramatically brighter" without an
//     intensity reference; current renders show the loss.
//   • Radiant cinematic quality with strong luminous separation
//     (was "Scene Feel: dramatic")
//   • Anti-flatness directive — three phrasings of "no globally even
//     exposure" collapsed into one weighted sentence. Same emphasis.
export function buildLightingBlock(input: { addBeam: boolean }): string {
  const modeText = input.addBeam
    ? `Use gallery three-point lighting (key from upper front-left, fill from front-right, rim from behind for separation) combined with an accent volumetric beam from above to highlight the hero. Maintain visible beam falloff and atmospheric contrast.`
    : `Use gallery three-point lighting: a primary key light from upper front-left, a softer fill from front-right, and a rim light from behind for separation. Light wraps the subject without flattening it.`

  return `LIGHTING:
${modeText}

Apply localized luminance shaping: the hero subject, the plaque on the front rim of the plinth (when present), and standout compositional features (docks, walkways, foreground structures, water reflections) are the brightest points in the frame, with surroundings deliberately underexposed by comparison. Light accumulates around these areas of narrative importance — exposure lifts on the features themselves, atmospheric bounce illuminating them from within the scene, selective contrast separating them from the environment. Crisp highlights, clear luminance hierarchy, deep shadow retention elsewhere.

Lighting reads as radiant cinematic — elevated atmospheric glow, strong luminous separation between subject and environment, sharper form definition. Lighting must never be evenly distributed, flatly ambient, or globally normalized — those are failure modes. Darkness is intentional composition.`
}

// C) Vegetation — Pass 1 reinforcement against symmetrical/decorative
// foliage patterns.
export const VEGETATION_BLOCK = `VEGETATION:
Vegetation must feel organic and naturally distributed. Avoid symmetry, decorative arrangements, repeated branching, or synthetic foliage patterns.`

// D) Spatial Rules — physical-vs-atmospheric containment, offscreen
// handling, and forced perspective.
//
// Plinth shape rules are NOT here — they live in PLINTH_BLOCK to
// consolidate plinth-truth into one place.
//
// Atmospheric containment language was previously split between this
// block and LOW_VERTICAL paragraph 2 (the "no floating clouds, sun
// discs, halos, fog masses" failure-mode list). Consolidated here so
// the rule has one home.
//
// Closes failure modes:
//   1. Physical scene extending past plinth edge into a forced-
//      perspective horizon (treating the wooden disc as a decorative
//      ring on a real landscape).
//   2. Atmospheric content becoming tangible scenic objects above the
//      diorama — floating clouds, sun discs, halos, fog masses.
//   3. Tall vertical elements being rendered as enclosures rather than
//      as objects (forced perspective inside, not outside, the plinth).
export const SPATIAL_RULES_BLOCK = `SPATIAL RULES — PHYSICAL VS ATMOSPHERIC:
Every PHYSICAL element of the scene — terrain, water, vegetation, structures, paths, rocks, benches, props, figures — sits ON OR INSIDE the wooden plinth. The plinth's edge is the absolute boundary of the physical world. Nothing physical extends past the wooden disc. The plinth is not a decorative inset on a larger real landscape; it is the entire stage.

Atmospheric phenomena — fog, mist, low cloud, light shafts, golden haze, weather, distant blur — may extend past the plinth as background ambience, but never as solid floating objects. Do not reproduce sky as floating clouds, sun discs, halos, fog masses, or any object hovering above the scene as filler. The space above the diorama is filled by the room background (desk) or natural environment blur (in-environment) — never by invented physical phenomena.

OFFSCREEN HANDLING:
Tall source elements (trees, mountains, structures, branches) stand AS OBJECTS on the flat plinth top. They are handled in one of two ways:
  (A) Stand at full plausible miniature height and be CROPPED BY THE IMAGE FRAME at the top — like a scale model photographed too close, the photograph's edge cuts the canopy naturally. This is the preferred handling for visually tall subjects.
  (B) Be reduced to compact miniature scale that fits complete within the image frame.
Either is acceptable. What is forbidden: the plinth itself extending upward to contain or frame the tall element. Cropping is done by the camera, never by the plinth.

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
// content. Atmospheric containment rules (no floating clouds/sun-discs/
// halos) consolidated upstream into SPATIAL_RULES_BLOCK; this block
// now carries only its unique role.
export const LOW_VERTICAL_BLOCK = `LOW-VERTICAL SOURCE COMPOSITION:
If the source primarily depicts horizontal or ground-level content (paths, roads, plains, flat terrain, calm water surfaces) with little vertical structure, the camera angle elevates to approximately 55-65 degrees downward and the diorama (plinth + scene) fills 60-70 percent of the frame, regardless of camera or scale settings.`
