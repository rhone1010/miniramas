// lib/v1/actionmini-blocks.ts
// Refinement blocks for Action Minis. Tightened pass — same intent, fewer
// words. Added FIGURE_FIDELITY as always-on after losing figure-quality
// fidelity to prompt-length noise in the long version.
//
// Block order in final prompt:
//   1. COLLECTIBLE_ANCHOR        always — gallery vs toy framing
//   2. CAMERA                    always — 45° downward
//   3. FIGURE_FIDELITY            always — face/hands/equipment must hold
//   4. MATERIAL_COLOR             always — bronze stays bronze, etc.
//   5. SCENE_COMPLEMENT           toggle
//   6. DRAMATIC_LIGHTING          toggle
//   7. KINETIC_EFFECTS            toggle
//   8. SCENE_DETAIL               toggle
//   9. CRAFT_DETAIL               toggle
//   10. MARGINS                   toggle

import type { ActionMiniPresetId } from './actionmini-presets'
import type { KineticMedium } from './actionmini-shared'

// ── ALWAYS-ON BLOCKS ─────────────────────────────────────────

export const COLLECTIBLE_ANCHOR_BLOCK = `
QUALITY ANCHOR:
Premium collectible miniature — gallery-quality art object, not a toy or diorama.
Photographed where a serious collector would display it, not in the action's natural environment.
Materials must be photorealistic — bronze reads as real bronze, wax as real wax.
`.trim()

export const CAMERA_BLOCK = `
CAMERA:
45 degrees above subject, angled down. Top of base visible, front of figure visible.
Product photography of a collectible — never flat eye-level.
`.trim()

// FIGURE FIDELITY — the missing emphasis. Source-photo likeness, anatomical
// correctness, equipment articulation. Lives early in the prompt where
// attention is freshest, before any optional blocks pile in.
export const FIGURE_FIDELITY_BLOCK = `
FIGURE FIDELITY (NON-NEGOTIABLE):
The figure's face must match the source photograph closely — recognizable likeness, exact expression.
Every finger fully articulated. Every fabric fold and seam clearly defined.
Every piece of equipment (headgear, straps, buckles, soles, board edges) anatomically and mechanically correct.
Hair strand-level detail. Muscle structure visible. No mushy faces, no fused fingers, no generic features.
This is the hardest requirement in the prompt — it overrides any softening from other blocks.
`.trim()

// ── MATERIAL COLOR — per-preset, always on ──────────────────
// Tightened: same rule per preset, fewer words. The negative-instruction
// pattern ("no painted teal jacket") is what holds bronze monochrome, so
// kept that even where it adds length.
const MATERIAL_COLOR_RULE_BY_PRESET: Record<ActionMiniPresetId, string> = {
  resin: `
MATERIAL COLOR — HAND-PAINTED MINIATURE:
Hand-painted resin scale model with visible brushwork. Source colors carry through as paint on resin.
Slight artistic stylization expected — NOT photographic. Painted figurine quality, hobby-collectible feel.
The painted finish should read as a craftsman's brushwork, not a perfect machined replica.
`.trim(),

  plushy: `
MATERIAL COLOR:
Sewn fabric plush. Source colors expressed through fabric and yarn choices.
`.trim(),

  painted_ceramic_cracked: `
MATERIAL COLOR — HAND-PAINTED CERAMIC MINIATURE:
Hand-painted glazed ceramic miniature with visible brushwork. Source colors carry through as glaze.
Crack lines visible across the painted surface. Slight artistic stylization expected — NOT photographic.
Painted ceramic figurine quality, hobby-collectible feel.
`.trim(),

  carved_wood: `
MATERIAL COLOR — RAW WOOD ONLY:
Entire figure is RAW NATURAL WOOD — same wood as the log base. NO paint, NO source-photo colors carried over.
The figure is monochrome wood. Color variation comes only from grain and lighting.
`.trim(),

  wax_bronze: `
MATERIAL COLOR — WAX FIGURE, BRONZE BASE:
FIGURE: solid translucent wax, pale-amber throughout. NO painted jacket, NO skin tones, NO source colors.
BASE: solid bronze with verdigris. The piece is monochrome wax-on-bronze.
`.trim(),

  bronze_bronze: `
MATERIAL COLOR — ALL BRONZE:
Entire sculpture is solid cast bronze with verdigris in recesses, polish on high points.
NO painted colors. NO source-photo colors. Fully monochrome bronze.
`.trim(),

  terracotta_cracked: `
MATERIAL COLOR — ALL TERRACOTTA:
Entire sculpture is solid weathered terracotta — warm earth-orange-brown throughout.
NO painted colors. NO source-photo colors. Fully monochrome terracotta. Cracks reveal lighter inner clay.
`.trim(),

  mixed_metals: `
MATERIAL COLOR — METALS ONLY (no paint):
Source colors translated to metal choices: red→copper, yellow→brass, brown→bronze, grey→pewter, blue→titanium, white→steel.
Each metal's natural surface IS the color. No paint, no dyes anywhere.
`.trim(),

  alabaster: `
MATERIAL COLOR — ALL ALABASTER:
Entire sculpture is solid translucent alabaster, off-white to warm-cream throughout.
NO painted colors. NO source-photo colors. Internal glow varies with thickness.
`.trim(),

  window_sill: `
MATERIAL COLOR — ALL ALABASTER:
Entire sculpture is solid translucent alabaster. NO painted colors, NO source-photo colors.
Sunlight reveals the stone's translucent depth.
`.trim(),

  trophy_shelf: `
MATERIAL COLOR — HAND-PAINTED MINIATURE:
Hand-painted resin trophy-style sculpture with visible brushwork. Source colors carry through as paint.
Slight artistic stylization expected — painted miniature quality, NOT photographic.
`.trim(),
}

export function getMaterialColorBlock(presetId: ActionMiniPresetId): string {
  return MATERIAL_COLOR_RULE_BY_PRESET[presetId] || MATERIAL_COLOR_RULE_BY_PRESET.resin
}

// ── TOGGLE BLOCKS ────────────────────────────────────────────

// Tightened — direction stays, padding gone.
export const CRAFT_DETAIL_BLOCK = `
CRAFT DETAIL:
Maximum sculpting craftsmanship — surface texture readable, edges crisp, fabric weave and hair strands visible.
Gallery-grade work that rewards close inspection.
`.trim()

export const SCENE_DETAIL_BLOCK = `
SCENE DETAIL:
Display environment richly detailed — supporting props (reference books, sculpting tools, certificates, related collectibles)
visible but secondary. The space feels lived-in by a serious collector.
`.trim()

// ── KINETIC EFFECTS — medium-specific ────────────────────────
const KINETIC_EFFECTS_BY_MEDIUM: Record<KineticMedium, string> = {
  whitewater: `
KINETIC EFFECTS — WHITEWATER:
Translucent water spray and foam frozen mid-arc. Sculpted as integrated artwork in the figure's material. NO mud, NO dust.
`.trim(),
  surf: `
KINETIC EFFECTS — SURF:
Sea spray and foam frozen mid-arc, integrated in the figure's material. NO dust, NO dirt.
`.trim(),
  snow: `
KINETIC EFFECTS — SNOW:
Snow powder bursts around the figure — sculpted in the SAME MATERIAL as the figure (bronze figure → bronze spray, alabaster → alabaster spray). NEVER white snow on a bronze figure. NO water, NO dirt.
`.trim(),
  skate: `
KINETIC EFFECTS — SKATE:
Fine concrete dust at the trucks — low haze, sculpted in figure's material. NO water, NO mud.
`.trim(),
  bike: `
KINETIC EFFECTS — DIRT TRACK:
Dramatic roost of dry dirt and small stones from the rear tire — angular, granular, sculpted in figure's material. NO mud, NO water, NO smoke.
`.trim(),
  climb: `
KINETIC EFFECTS — CLIMB:
Small puff of chalk dust at contact points, sculpted in figure's material. NO water, NO debris.
`.trim(),
  run: `
KINETIC EFFECTS — RUN:
Dust at foot strike, low haze, sculpted in figure's material. NO water.
`.trim(),
  dance: `
KINETIC EFFECTS — DANCE:
Fabric and hair mid-flight in arcs, sculpted in figure's material. Optional fine stage dust. NO water.
`.trim(),
  combat: `
KINETIC EFFECTS — MAT/COMBAT:
Burst of mat dust or chalk around impact point, sculpted in figure's material. NO water, NO mud.
`.trim(),
  other: `
KINETIC EFFECTS:
Motion evidence around the figure, sculpted in the figure's own material. ONE medium only — never mix dust and water.
`.trim(),
}

export function getKineticEffectsBlock(kineticMedium: KineticMedium): string {
  return KINETIC_EFFECTS_BY_MEDIUM[kineticMedium] || KINETIC_EFFECTS_BY_MEDIUM.other
}

// ── LOCATION — global staging, user picks one of three ──────
// Replaces the old per-preset SCENE_COMPLEMENT_BY_PRESET. The user picks
// where to stage the sculpture as a global control; same location applies
// to every material in the batch.
//
// Three locations:
//   - in_context: the natural environment of the action (forest trail for a
//     dirt-bike, snow slope for a snowboarder, wrestling mat for wrestlers).
//     This is what the old "in situ" meant. Renamed for clarity.
//   - on_a_desk: a serious collector's wood desk with a few thoughtful props
//     (reference book, sculpting tool, certificate). Material-agnostic.
//   - on_a_shelf: a child's trophy shelf with ribbons, framed team photo, a
//     worn ball. Reads as a proud personal display.
//
// Plushy is the one preset where a kid's-bedroom-shelf staging is intrinsic
// to its identity. We don't override that — plushy keeps its bedroom-shelf
// staging regardless of location selection. The location selector is a
// suggestion that the prompt builder honors when the preset doesn't have a
// stronger built-in staging. (See LOCATION_OVERRIDES_PRESETS below.)

export type LocationId = 'in_context' | 'on_a_desk' | 'on_a_shelf'

export const LOCATION_LABELS: Record<LocationId, string> = {
  in_context:   'In context',
  on_a_desk:    'On a desk',
  on_a_shelf:   'On a shelf',
}

const LOCATION_BLOCKS: Record<LocationId, string> = {
  in_context: `
LOCATION — IN CONTEXT (natural environment of the action):
The sculpture is staged in the natural environment of the action it depicts. A dirt-bike scene sits on a forest trail. A snowboarding scene sits on a mountain slope. A wrestling scene sits on a packed-earth mat surface. A surfing scene sits in shallow shore water. The environment is photographed at miniature scale around the sculpture — soft-focus terrain, atmospheric depth. The sculpture is the subject, the environment is the implied world.
`.trim(),

  on_a_desk: `
LOCATION — ON A DESK (serious collector's desk):
The sculpture sits on a warm wood desk in a serious collector's space. A reference book lies open or stacked nearby, a sculpting tool or fine pen rests beside it, a certificate of authenticity may be partially visible. Walls and bookshelves recede into soft focus behind the desk. Warm interior lighting. The sculpture is the subject, the desk and props are the implied world of someone who collects this kind of work.
`.trim(),

  on_a_shelf: `
LOCATION — ON A SHELF (proud personal display):
The sculpture sits on a wooden shelf in a personal space — a kid's bedroom or a fan's den. Around it: ribbons, a framed team photo, a worn ball, medals on satin straps, a memorabilia book. Soft warm room lighting. The shelf surface and surrounding items are visible but secondary. The sculpture is displayed proudly among related personal objects.
`.trim(),
}

// Some presets have intrinsic staging that should override the global
// location pick. Plushy IS a kid's-bedroom-shelf object by design — picking
// "in context" for plushy doesn't make sense (a plush doesn't go in a forest).
// Map flagged presets to the location they ALWAYS use regardless of user pick.
const LOCATION_OVERRIDES_PRESETS: Partial<Record<ActionMiniPresetId, LocationId>> = {
  plushy:        'on_a_shelf',
  trophy_shelf:  'on_a_shelf',
  window_sill:   'in_context',  // window_sill IS its location — sunlit sill always
}

export function getLocationBlock(locationId: LocationId, presetId: ActionMiniPresetId): string {
  // Honor preset overrides — plushy stays on a shelf regardless of user pick
  const effective = LOCATION_OVERRIDES_PRESETS[presetId] || locationId
  return LOCATION_BLOCKS[effective] || LOCATION_BLOCKS.on_a_desk
}

// ── DRAMATIC LIGHTING ────────────────────────────────────────
// ATMOSPHERIC LIGHTING (revised approach) — soft diffused glow, not god-light:
//   - The lighting environment is filled with soft warm/cool atmospheric haze
//     that GENTLY brightens toward the back-upper area of the frame
//   - There is NO visible beam, NO light shaft, NO directional cone of light
//   - The bright area is just an area of brighter ambient — not a cone of light
//     punching through the scene
//   - Particles glow because they're suspended in luminous haze, not because
//     a beam is passing through them
//   - The subject is lit ambiently from the brighter background area + soft
//     reflected fill from the front so face/front stays readable
//   - Result: cinematic atmospheric quality (think golden-hour forest haze,
//     soft museum-case glow, hazy gallery atmosphere) — NOT stage spotlight
//
// CRITICAL — prior versions used "shaft", "beam", "streams down", "HEAVILY
// VOLUMETRIC" which produced literal god-light beams cutting through scenes.
// This version explicitly forbids that vocabulary. The new language is
// "atmospheric haze", "soft diffused brightness", "gentle bloom", "ambient
// luminous quality."
//
// ALABASTER + TERRACOTTA keep working single-source recipes.
// "Lamp" / "fixture" / "pendant" / "shaft" / "beam" all banned everywhere.
const DRAMATIC_LIGHTING_RECIPES: Record<ActionMiniPresetId, string> = {
  resin: `
LIGHTING — ATMOSPHERIC HAZE:
The scene is filled with soft warm atmospheric haze — a gentle luminous quality in the air, slightly brighter toward the back-upper area of the frame, fading softly into the surroundings. NO visible shaft, NO beam, NO defined cone of light — just diffused ambient glow that fills the space.
Particles in the air (dust, spray) glow softly because they're suspended in this luminous haze, NOT because a beam is passing through them.
The subject is lit ambiently from the brighter background, with soft reflected fill from the camera side keeping face and front clearly readable.
Cinematic golden-hour atmospheric quality — think soft hazy forest air at sunset, NOT stadium spotlight.
FORBIDDEN: visible light shaft, visible beam, cone of light, god-rays, light source positioned in the particles, light from below.
`.trim(),
  plushy: `
LIGHTING — SOFT ATMOSPHERIC ROOM HAZE:
Soft warm room atmosphere with a gentle luminous quality, slightly brighter toward the back-upper area like late-afternoon light filling a bedroom. NO visible beam or shaft — just diffused ambient warmth.
Soft reflected fill from the camera side keeps the plush figure's face and front clearly readable. Cozy, not harsh.
FORBIDDEN: visible light shaft or beam, god-rays, hard directional light.
`.trim(),
  carved_wood: `
LIGHTING — WORKSHOP ATMOSPHERIC HAZE:
The workshop is filled with soft cool-warm daylight haze — a luminous diffused quality in the air, slightly brighter toward the back-upper area where light enters from windows. NO visible beam or shaft, just a hazy bright atmosphere.
Sawdust and wood-dust particles glow softly because they're suspended in this luminous workshop haze, NOT because a beam is passing through them.
Soft reflected fill from the camera side keeps cut-wood surfaces and carving detail clearly readable.
Cinematic atmospheric quality — think dust-filled workshop air on a sunny afternoon.
FORBIDDEN: visible light shaft, defined beam, god-rays, light source positioned in the dust cloud.
`.trim(),
  wax_bronze: `
LIGHTING — WARM ATMOSPHERIC GALLERY HAZE:
Soft warm atmospheric haze fills the scene — a luminous diffused quality in the air, slightly brighter toward the back-upper area, fading softly through the room. NO visible shaft or beam.
The wax catches subsurface translucent glow where the ambient brightness grazes thin edges (fingertips, fabric, spray). Particles glow softly within the luminous atmosphere.
Soft reflected fill from the camera side reveals form and surface detail without hard shadows.
Cinematic warm-room atmospheric quality — think hazy sunlit study.
FORBIDDEN: visible beam or shaft, god-rays, hard directional light, light source in the particles.
`.trim(),
  painted_ceramic_cracked: `
LIGHTING — MUSEUM-CASE ATMOSPHERIC HAZE:
The display case interior is filled with soft controlled atmospheric haze — a luminous quality in the air, slightly brighter toward the back-upper area as if light filters in from above without a visible source. NO beam, NO shaft.
Particles glow softly within the luminous atmosphere. Crack lines on the painted ceramic pick up subtle highlights from the ambient brightness.
Soft reflected fill from the camera side keeps the front readable.
Cinematic museum-case atmospheric quality.
FORBIDDEN: visible beam or shaft, god-rays, hard directional light.
`.trim(),
  terracotta_cracked: `
LIGHTING — VOLUMETRIC ARCHAEOLOGICAL SUNBEAM:
Warm late-afternoon sun angles down from a high window or skylight, raking the piece at low angle — HEAVILY VOLUMETRIC, visible thick golden shaft cutting through fine dust hanging dense in the air. Long shadows accentuate cracks. NO desk lamps in frame.
`.trim(),
  bronze_bronze: `
LIGHTING — GALLERY ATMOSPHERIC HAZE:
The gallery is filled with soft warm atmospheric haze — a luminous diffused quality in the air, slightly brighter toward the back-upper area as if from a high gallery ambient source, fading into deep gallery shadow elsewhere. NO visible beam or shaft.
The bronze catches contour highlights from the ambient brightness — verdigris reads cool against warm bronze. Particles glow softly within the luminous atmosphere.
Soft reflected fill from the camera side keeps the figure's front readable, not silhouetted against the brighter back.
Cinematic gallery atmospheric quality — hazy, prestigious, museum-grade.
FORBIDDEN: visible beam or shaft, god-rays, hard directional cone of light, light source positioned in the particles.
`.trim(),
  mixed_metals: `
LIGHTING — STUDIO ATMOSPHERIC HAZE:
Soft studio atmospheric haze fills the scene — a luminous quality in the air, slightly brighter toward the back-upper area, registering each metal distinctly as the ambient brightness grazes their surfaces. NO visible beam.
Each metal catches its character from the ambient — copper warm, brass golden, bronze warm, pewter cool, titanium cool-blue. Particles glow softly within the luminous atmosphere.
Soft reflected fill from the camera side keeps the figure's front readable.
Cinematic studio atmospheric quality — clean, hazy, premium.
FORBIDDEN: visible beam or shaft, god-rays, hard directional light.
`.trim(),
  alabaster: `
LIGHTING — BACKLIT TRANSLUCENT WITH GOD-RAY:
Strong directional light from BEHIND passes through the alabaster, making thin edges (fingertips, fabric, spray) glow translucent with internal warmth. Backlight produces a HEAVILY VOLUMETRIC god-ray spreading outward — powerful visible shaft through dense haze with abundant particles. Front face in soft reflected fill. NO visible fixtures.
`.trim(),
  window_sill: `
LIGHTING — SUNLIT WINDOW ATMOSPHERIC HAZE:
Warm sunlight streams in from a window, filling the room with hazy luminous atmosphere — a diffused warm glow that's brightest near the window and softens through the rest of the room. The window itself can be visible in frame, but the LIGHT is atmospheric haze, NOT a defined beam.
The piece on the sill catches the warm ambient brightness. Soft reflected fill from the room interior keeps the figure readable, not silhouetted.
Cinematic afternoon-window atmospheric quality.
FORBIDDEN: visible god-ray, defined light shaft, beam cutting through the room.
`.trim(),
  trophy_shelf: `
LIGHTING — BEDROOM ATMOSPHERIC HAZE:
Soft warm bedroom atmosphere with a gentle luminous quality — slightly brighter toward the back-upper area like soft late-afternoon light filling the room. NO visible beam.
Particles glow softly within the luminous atmosphere.
Soft reflected fill from the camera side keeps the figure's front readable.
Slightly nostalgic, slightly proud atmospheric quality.
FORBIDDEN: visible beam, god-rays, hard directional light.
`.trim(),
}

export function getDramaticLightingBlock(presetId: ActionMiniPresetId): string {
  return DRAMATIC_LIGHTING_RECIPES[presetId] || DRAMATIC_LIGHTING_RECIPES.resin
}

// ── COMPOSITION — 20% margins ────────────────────────────────
export const MARGINS_BLOCK = `
COMPOSITION — BREATHING ROOM:
Subject occupies ~60% of image width, centered, with ~20% empty space left and right. Subject does NOT touch left/right edges. Pull camera back if needed.
`.trim()

// ── REFINEMENTS TYPE ─────────────────────────────────────────
// Note: sceneComplement was the old per-preset display-context toggle.
// Replaced by the LOCATION system. The new sceneEnvironment toggle controls
// whether the LOCATION block is included. Defaults to true.
export interface ActionMiniRefinements {
  craftDetail?:       boolean
  sceneDetail?:       boolean
  kineticEffects?:    boolean
  sceneEnvironment?:  boolean
  dramaticLighting?:  boolean
  margins?:           boolean
}

export const DEFAULT_REFINEMENTS: Required<ActionMiniRefinements> = {
  craftDetail:       true,
  sceneDetail:       true,
  kineticEffects:    true,
  sceneEnvironment:  true,
  dramaticLighting:  true,
  margins:           true,
}

// ── BLOCK ASSEMBLER ──────────────────────────────────────────
// Always-on stack first (anchor → camera → figure fidelity → material color)
// then toggleable refinements. Figure fidelity and material color go BEFORE
// optional blocks so they hit nano banana with fresh attention.
//
// LOCATION is a required global setting — user picks one of three. The
// location block replaces the old per-preset SCENE_COMPLEMENT system.
export function getRefinementBlocks(
  presetId:    ActionMiniPresetId,
  kineticMedium: KineticMedium,
  locationId:  LocationId,
  refinements: ActionMiniRefinements = {},
): string[] {
  const r = { ...DEFAULT_REFINEMENTS, ...refinements }
  const blocks: string[] = []
  // Always-on (4 blocks)
  blocks.push(COLLECTIBLE_ANCHOR_BLOCK)
  blocks.push(CAMERA_BLOCK)
  blocks.push(FIGURE_FIDELITY_BLOCK)
  blocks.push(getMaterialColorBlock(presetId))
  // Toggleable (6 blocks max)
  if (r.sceneEnvironment) blocks.push(getLocationBlock(locationId, presetId))
  if (r.dramaticLighting) blocks.push(getDramaticLightingBlock(presetId))
  if (r.kineticEffects)   blocks.push(getKineticEffectsBlock(kineticMedium))
  if (r.sceneDetail)      blocks.push(SCENE_DETAIL_BLOCK)
  if (r.craftDetail)      blocks.push(CRAFT_DETAIL_BLOCK)
  if (r.margins)          blocks.push(MARGINS_BLOCK)
  return blocks
}
