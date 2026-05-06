// lib/v1/landscapes/landscapes-effects.ts
//
// All parameterized copy for the Pass 1 prompt builder.
// Indexed by schema ID, consumed by landscapes-prompt.ts.
//
// Spec source: LITENCO Production Prompt v1 (May 2026)
//   + In-Situ ground integration v2 ("OUTDOORS — full stop")
//   + Subject lighting style v1 (3-style auto-select)
//   + Subject priority light v1 (mandatory 1.3–1.6× brightness)
//   + Micro-contrast preservation v1
//
// Tone: prescriptive on craft non-negotiables (lighting, ground, materials),
// guidance on the rest. Trimmed: PHILOSOPHY/PERSPECTIVE/VEGETATION blocks
// removed — their work is now subsumed by the more specific environment
// content and Pass 2's natural-variation addon.

import type {
  AtmosphereID, ResolvedEnvironment, ScaleID, CameraAngleID, SceneFeelID,
} from './landscapes-shared'

// ── ATMOSPHERE ────────────────────────────────────────────────
// Single line each. Drives lighting type, color, contrast, mood.
// 'none' is natural ambient with no driven mood — the prompt builder
// suppresses the atmosphere block in that case.
export const ATMOSPHERE_EFFECTS: Record<AtmosphereID, string> = {
  none:   'natural ambient light appropriate to the scene, no driven mood, balanced exposure',
  golden: 'warm low-angle light, long soft shadows, gentle glow with restrained volumetric rays',
  dusk:   'cool ambient with warm highlights, soft shadowing, twilight atmosphere',
  storm:  'high contrast directional light through turbulent atmosphere, charged sky, sky drives lighting',
  night:  'low-key lighting with strong contrast, selective practical highlights, nocturnal palette, sky drives lighting',
}

// ── SCENE FEEL ────────────────────────────────────────────────
// Render richness — object quality, NOT weather mood.
// Default: dramatic. Cinematic kept as the safe/flat option.
export const SCENE_FEEL_EFFECTS: Record<SceneFeelID, string> = {
  as_is:     'natural and restrained — materials and lighting read true and unforced',
  cinematic: 'shaped light and filmic contrast — controlled mood, the scene reads like a still from a quiet film',
  dramatic:  'richer materials, stronger micro-contrast, sharper form definition, more dimensional lighting — the scene reads with weight and craft',
}

// ── ENVIRONMENT (resolved) ────────────────────────────────────
// Two settings — controlled (richly-appointed study/gallery, can shift
// contextually to match the source world) and in_situ (the diorama
// outdoors, base on natural terrain matching the scene).
export const ENVIRONMENT_EFFECTS: Record<ResolvedEnvironment, string> = {
  controlled:
    'a richly-appointed setting, defaulting to an upscale private study — built-in bookshelves with leather-bound volumes, a brass orrery or astrolabe on a side table, framed botanical prints or maps on the walls, a Persian rug, a writing desk with personal objects, a window with appropriate atmospheric light. ' +
    'Any visible light fixtures (lamps, sconces) are positioned out of frame so their light reaches the scene but the source is not directly visible. ' +
    'The room reads as lived-in, layered, and curated — never sparse or staged. ' +
    'If the source model strongly suggests a different world (a fantasy scene, a coastal interior, a Tokyo apartment, an industrial loft, etc.), the room may shift to a richly-detailed version of that world — but the default is always the upscale study. ' +
    'The setting is intentional and remains soft and secondary so the diorama stays the primary subject.',
  in_situ:
    'the diorama on its plinth placed directly on the ground inside the source environment — the base rests on real natural terrain (grass, dirt, sand, rock, moss, leaf litter), not on any constructed surface.',
}

// ── SCALE ─────────────────────────────────────────────────────
export const SCALE_EFFECTS: Record<ScaleID, string> = {
  zoom_out: 'diorama occupies approximately 50–65% of the frame, generous margins around the plinth — object-forward composition with breathing room',
  close_up: 'diorama occupies approximately 65–80% of the frame, tighter composition with the base fully visible — stronger presence',
  up_close: 'diorama occupies approximately 85–95% of the frame, hero emphasis — the plinth remains fully visible but with minimal margin around it, the subject dominates the frame',
}

export const SCALE_PERCENT: Record<ScaleID, number> = {
  zoom_out: 60,
  close_up: 75,
  up_close: 90,
}

export const SCALE_PAD_RATIO: Record<ScaleID, number> = {
  zoom_out: 0.333,
  close_up: 0.167,
  up_close: 0.056,
}

// ── CAMERA ────────────────────────────────────────────────────
export const CAMERA_EFFECTS: Record<CameraAngleID, string> = {
  low:      'near plinth level with slight upward perspective — emphasizes structure, height, and presence',
  hero:     'approximately 40–50 degrees downward — natural product angle, the default product photograph view',
  elevated: 'approximately 55–65 degrees downward — improves clarity of flat or receding scenes (roads, rivers, beaches, fields)',
}

// ──────────────────────────────────────────────────────────────
// ALWAYS-ON CRAFT BLOCKS
// ──────────────────────────────────────────────────────────────

// A) Object Realism — anti-smoothing language is explicit because Pass 2
// has shown a strong bias toward beautifying materials into uniform texture.
export const OBJECT_REALISM_BLOCK = `OBJECT REALISM (PRIMARY):
Preserve layout and proportions from the source (dock, water, terrain, structures).
Materials must feel handcrafted: carved terrain, varied foliage, resin water with flow variation, wood grain with wear.
No smoothing or beautification — keep irregular edges, uneven grass, broken textures, micro-variation.
High local contrast; crisp form separation; visible miniature craftsmanship throughout.`

// B) Lighting — display-grade three-light setup. Foundation for the
// SUBJECT_LIGHTING_STYLE and SUBJECT_PRIORITY_LIGHT blocks that follow.
export const LIGHTING_BLOCK = `LIGHTING (DISPLAY-QUALITY):
Use a display-grade three-light setup adapted to the scene:
  • Primary (sun or volumetric): a directional beam into the subject that defines highlights and depth.
  • Ambient fill: soft, low-intensity, retains shadow detail.
  • Optional key or rim: subtle edge separation where it helps readability.
Light remains consistent with the chosen atmosphere. Avoid flat or underlit results.
Shadows describe form rather than washing the scene in generic studio light.`

// C) Subject Lighting Style — three-style auto-select by scene_feel.
// The override at the end ensures scenes with explicit natural light
// (sun visible, window beams in source) get god rays regardless of feel.
export const SUBJECT_LIGHTING_STYLE_BLOCK = `SUBJECT LIGHTING STYLE (auto-select):
The lighting style is chosen automatically based on scene_feel and source content.

If scene_feel = dramatic, OR the scene is high-contrast / storm:
  TIGHT BEAM — focused directional spotlight, 25–45° cone, strong center intensity with quick falloff. Subtle rim light for edge separation. Optional light rays where particles or fog exist.

If scene_feel = as_is, OR natural / documentary feel takes priority:
  SOFT MUSEUM — diffused key light, large soft source, even spread. Gentle shadowing, minimal contrast boost. No visible beams.

If scene_feel = cinematic, OR the scene is forest / window / sunrise / sunset:
  VOLUMETRIC GOD RAYS — a defined directional source (not ambient glow). Visible beam shafts with a density gradient — strong core, soft outer scatter. Beam aimed at subject center mass; light intensity peaks at the contact point on the model. Avoid evenly-spread haze, background-only illumination, or diffuse glow with no direction.

OVERRIDE: If the source contains strong natural light (sun visible, window beams, visible sun rays), use VOLUMETRIC GOD RAYS regardless of scene_feel.`

// D) Subject Priority Light — mandatory across all styles. Specifies the
// quantitative result the lighting must produce (subject brightest, falloff,
// 1.3–1.6× brightness ratio, anchoring shadow, hidden source).
export const SUBJECT_PRIORITY_LIGHT_BLOCK = `SUBJECT PRIORITY LIGHT (mandatory):
Establish a primary light hit on the diorama itself, not on the surrounding environment.
The center of the model receives the highest luminance in the frame.
Light falloff is visibly noticeable from the model's center toward the edges of the base.
The diorama renders 1.3–1.6× brighter than the surrounding environment.
Shadows under the base deepen to anchor the object — no floating or weightless feel.
The light source itself is never visible in frame — no lamps, bulbs, or fixtures pointing at the subject.

If volumetric rays are present, they terminate ON the model. The beam origin can be off-frame, but the impact point on the diorama must be clearly visible.`

// E) Micro-Contrast Preservation — stops Pass 2 from compressing tonal
// range across natural surfaces. Different from "subject-only contrast
// enhancement" — this is preservation, not boosting.
export const MICRO_CONTRAST_PRESERVATION_BLOCK = `MICRO-CONTRAST PRESERVATION:
Preserve fine surface contrast in moss, rock, bark, water, and vegetation.
Avoid global smoothing or tonal compression that flattens natural texture.
Maintain shadow detail without lifting blacks.`

// F) In-Situ Ground Integration — conditional. Emits only when resolved
// environment is in_situ (whether user-picked or storm/night-forced).
// Strengthened from v1: explicit "OUTDOORS — full stop" + exhaustive list
// of forbidden indoor surfaces, because Pass 2's product-photography prior
// keeps reintroducing wood tables under the plinth.
export const IN_SITU_GROUND_INTEGRATION_BLOCK = `IN-SITU GROUND INTEGRATION:
The diorama is photographed OUTDOORS, sitting directly on natural terrain that matches the source scene.
The base rests on grass, dirt, sand, rock, moss, or leaf litter — whatever the source shows. Match the source on three axes:
  • ground color
  • texture type
  • elevation feel (flat versus uneven)
The ground around and beneath the base is a blurred continuation of the source environment — same season, same weather, same light direction.
Add a natural contact shadow and a slight grounding indentation so the base feels physically placed, not hovering.

ABSOLUTELY NO indoor or constructed surfaces anywhere in frame:
  • No wood tables, desks, shelves, mantles, or counters — even partially visible
  • No tile, polished stone, painted wood, or neutral floors
  • No room walls, ceilings, windows, doors, or any furniture
  • No interior lighting fixtures, hanging bulbs, or visible lamps
The diorama is OUTDOORS — full stop. Any surface beneath or behind the base is the same natural terrain the source scene contains.`
