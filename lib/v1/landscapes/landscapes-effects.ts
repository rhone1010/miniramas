// lib/v1/landscapes/landscapes-effects.ts
//
// All parameterized copy for the Pass 1 prompt builder.
// Indexed by schema ID, consumed by landscapes-prompt.ts.
//
// Compressed per LITENCO Production Prompt v2 + decisions locked in
// successive engine passes:
//   • Lighting subsystem collapsed from 4 blocks → 1 (now parameterized)
//   • Scene Feel axis REMOVED — quality always equivalent to "dramatic";
//     baked into LIGHTING block as always-on
//   • Focal Lighting dial REMOVED — strong feature emphasis baked into
//     LIGHTING block as always-on
//   • Atmosphere ID 'none' → 'natural' (label "As Is")
//   • Scale 'zoom_out' (60%) REMOVED — two options now: close_up, fill
//   • CameraAngle 'low' (Ground) REMOVED — two options now: hero, elevated
//   • CONTROLLED ENVIRONMENT split out as its own block
//   • VEGETATION re-added
//   • SPATIAL RULES tightened — canopy-as-dome loophole closed
//   • LOW_VERTICAL_BLOCK added — handles flat sources without inventing sky
//   • IN-SITU prompt block kept (model-facing); UI label is "In Environment"

import type {
  AtmosphereID, ResolvedEnvironment, ScaleID, CameraAngleID,
} from './landscapes-shared'

// ── ATMOSPHERE ────────────────────────────────────────────────
export const ATMOSPHERE_EFFECTS: Record<AtmosphereID, string> = {
  natural: 'natural ambient light appropriate to the scene, no driven mood, balanced exposure',
  golden:  'warm directional sunlight, volumetric warmth, long shadow falloff',
  dusk:    'cool ambient atmosphere with warm focal highlights, twilight mood',
  storm:   'high-contrast storm lighting, lightning, dark skies, charged atmosphere — sky drives lighting',
  night:   'low-key nocturnal lighting with selective practical illumination — sky drives lighting',
}

// ── ENVIRONMENT (resolved) ────────────────────────────────────
export const ENVIRONMENT_EFFECTS: Record<ResolvedEnvironment, string> = {
  controlled: 'upscale study or gallery environment with rich wood, bookshelves, subtle decor, soft depth-of-field, and window light matching the scene atmosphere',
  in_situ:    'diorama placed directly within the source environment on matching natural terrain',
}

// ── SCALE ─────────────────────────────────────────────────────
export const SCALE_EFFECTS: Record<ScaleID, string> = {
  close_up: 'diorama occupies approximately 65–80% of the frame, tighter composition with the base fully visible',
  fill:     'diorama occupies approximately 85–95% of the frame, hero emphasis — the plinth remains fully visible with minimal margin',
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
export const CAMERA_EFFECTS: Record<CameraAngleID, string> = {
  hero:     'approximately 40–50 degrees downward — natural product photograph angle',
  elevated: 'approximately 55–65 degrees downward — improves clarity of flat or receding scenes. Use forced perspective WITHIN the plinth: a dramatically large foreground anchor (a bench, a rock, a tree branch, a stand of tall grass, the front edge of a path) at the near rim of the plinth, with the rest of the scene compressing dramatically backward toward the rear rim. Foreshortening creates the feeling of a vast landscape — but every physical element remains on the wooden disc.',
}

// ──────────────────────────────────────────────────────────────
// ALWAYS-ON CRAFT BLOCKS
// ──────────────────────────────────────────────────────────────

// A) Object Realism — preserves source structure + tactile material language.
export const OBJECT_REALISM_BLOCK = `OBJECT REALISM:
Preserve structure, scale relationships, and material richness from the source. Use carved terrain, varied foliage, resin-like water, worn wood, rough stone, uneven vegetation, and natural imperfections. Avoid smoothing, beautification, tonal flattening, or repeated texture patterns. Preserve micro-contrast and tactile detail throughout the scene.

PLINTH: low-profile turned-wood disc, thin in proportion, with a single soft curved edge — never tiered moldings, never a stacked pedestal, never rectangular. Richly figured walnut or mahogany; visual interest comes from the wood's grain and chatoyance, not from profile complexity. The front rim stays clean — no fallen branches, twigs, or storm debris piled at the front edge.`

// B) Lighting — single function. Two modes from one boolean:
//   addBeam=false → 3-Point gallery lighting only (default for all renders)
//   addBeam=true  → 3-Point gallery lighting + accent volumetric beam
//
// 3-Point is the consistent base lighting model for both Desk AND
// In-Environment renders. Beam is the optional dramatic accent.
//
// Always-on baked-in qualities:
//   • Strong feature emphasis on hero subject, plaque, docks, walkways,
//     foreground structures, water reflections (was "Focal Lighting +30")
//   • Radiant cinematic quality with strong luminous separation
//     (was "Scene Feel: dramatic")
export function buildLightingBlock(input: { addBeam: boolean }): string {
  const modeText = input.addBeam
    ? `Use gallery three-point lighting (key from upper front-left, fill from front-right, rim from behind for separation) combined with an accent volumetric beam from above to highlight the hero. Maintain visible beam falloff and atmospheric contrast.`
    : `Use gallery three-point lighting: a primary key light from upper front-left, a softer fill from front-right, and a rim light from behind for separation. Light wraps the subject without flattening it.`

  return `LIGHTING:
${modeText}

Apply strong focal light to the hero subject, the plaque on the front rim of the plinth (when present), and standout compositional features such as docks, walkways, foreground structures, and water reflections. These features render dramatically brighter than the surrounding environment with clear luminance hierarchy and crisp highlights.

Atmospheric depth is rendered visible, not implied. When the atmosphere is golden, dusk, storm, or night, render visible VOLUMETRIC ATMOSPHERIC LIGHT — sun shafts breaking through cloud cover or tree canopy, moonbeams cutting fog or mist, god-rays through trees, defined columns of light passing through air. The mood comes from light cutting through air, not from a soft global wash.

Lighting reads as radiant cinematic — elevated atmospheric glow, strong luminous separation between subject and environment, sharper form definition. Avoid evenly-lit scenes, flat ambient exposure, or globally balanced lighting. Darkness is intentional composition.`
}

// C) Vegetation — Pass 1 reinforcement against symmetrical/decorative
// foliage patterns.
export const VEGETATION_BLOCK = `VEGETATION:
Vegetation must feel organic and naturally distributed. Avoid symmetry, decorative arrangements, repeated branching, or synthetic foliage patterns.`

// D) Spatial Rules — physical vs atmospheric containment + plinth
// geometry lock + offscreen handling + forced perspective inside the
// plinth.
//
// Closes three failure modes:
//   1. Canopy-as-dome — source's arch composition (road framed by
//      trees, tunnel of branches) reproduced as the diorama's
//      enclosure rather than as scene content.
//   2. Wooden-arch loophole — source arch becomes a wooden half-dome
//      "continuous with the plinth" (technically not a glass dome, so
//      it evaded the previous ban).
//   3. Plinth-as-decorative-ring — wooden disc shown but the scene
//      extends past it into a real-landscape horizon.
export const SPATIAL_RULES_BLOCK = `SPATIAL RULES — PHYSICAL VS ATMOSPHERIC:
Every PHYSICAL element of the scene — terrain, water, vegetation, structures, paths, rocks, benches, props, figures — sits ON OR INSIDE the wooden plinth. The plinth's edge is the absolute boundary of the physical world. Nothing physical extends past the wooden disc. The plinth is not a decorative inset on a larger real landscape; it is the entire stage.

Atmospheric phenomena — fog, mist, low cloud, light shafts, golden haze, weather, distant blur — may extend past the plinth as background ambience. They are never solid floating objects.

PLINTH GEOMETRY LOCK:
The plinth is always a flat cylindrical disc — top face, bottom face, curved side wall. It NEVER extends upward into a wall, arch, half-dome, canopy, or enclosure of any kind. This applies even when the upward extension would be wood matching the plinth itself — a wooden arch growing from the plinth is forbidden. No glass domes, bell jars, cloches, display cases, transparent covers, background plates, printed scenery, sky panels, artificial arches, or rings frame the diorama. The plinth is the only frame, and the plinth is a flat disc.

If the source's composition forms an arch or converging shape at the top of the frame (a road framed by tree canopies, a tunnel of branches, a corridor of rocks), the plinth still remains flat. The arch is reproduced as scene content — typically as tall miniature trees or rocks standing as objects on the flat plinth surface — never as the diorama's enclosure.

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

// G) Low-Vertical Source Composition — handles sources that primarily
// depict horizontal/ground-level content (paths, roads, plains, calm
// waters, flat terrain). Without this rule, the model reproduces the
// source's empty upper region (sky) as tangible scenic elements:
// floating clouds above the path, sun discs behind flamingos, halos.
export const LOW_VERTICAL_BLOCK = `LOW-VERTICAL SOURCE COMPOSITION:
If the source primarily depicts horizontal or ground-level content (paths, roads, plains, flat terrain, calm water surfaces) with little vertical structure, the camera angle elevates to approximately 55-65 degrees downward and the diorama (plinth + scene) fills 60-70 percent of the frame, regardless of camera or scale settings.

The source's sky, upper atmosphere, or empty vertical space MUST NOT become a tangible scenic element above the diorama. Do not reproduce sky as floating clouds, sun discs, halos, fog masses, or any object hovering above the scene. The space above the diorama is filled by the room background (desk) or natural environment blur (in-environment) — never by invented physical phenomena.

The diorama is the subject. It is not a stage for sky or atmospheric content. Atmospheric mood comes through lighting direction and color, not through floating objects.`
