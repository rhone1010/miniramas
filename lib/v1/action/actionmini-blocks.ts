// lib/v1/action/actionmini-blocks.ts
// Prompt blocks for Action Minis.
//
// V7 rewrite (single-material hero):
//   • LOCATION and SCALE systems deleted entirely — one hero look, a
//     material-matched backdrop, no scene reconstruction. That removed
//     LocationId, Scale, ActionMiniRefinements, getRefinementBlocks,
//     LOCATION_LABELS, SCALE_LABELS, resolveLocationId,
//     MATERIAL_COLOR_RULE_BY_PRESET, and every LOCATION / ENVIRONMENT /
//     LIGHTING recipe block.
//   • Per-preset material color now lives on the preset def itself
//     (ActionMiniPresetDef.materialColorRule in actionmini-presets.ts),
//     not in a lookup here. This also breaks the old circular import.
//   • CAMERA_BLOCK replaced (close/low 28-32mm, was 45° from above).
//   • COLLECTIBLE_ANCHOR_BLOCK material examples updated (wax/ceramic out).
//   • PRESENTATION_BLOCK, ACTION_DYNAMICS_BLOCK, CRAFTSMANSHIP_BLOCK added.
//   • FIGURE_FIDELITY_BLOCK unchanged — kept verbatim.
//
// Block order in the final prompt (assembled in actionmini-presets.ts):
//   1. preset.presetLine          (per-preset)
//   2. FIGURE_FIDELITY            always
//   3. preset.materialColorRule   (per-preset)
//   4. ACTION_DYNAMICS            always (source-aware)
//   5. CAMERA                     always
//   6. PRESENTATION               always
//   7. COLLECTIBLE_ANCHOR         always
//   8. CRAFTSMANSHIP              always
//   9. REFINEMENT_GUARD + tweak   only if refinementTweak present

// ── ALWAYS-ON BLOCKS ─────────────────────────────────────────

export const COLLECTIBLE_ANCHOR_BLOCK = `
QUALITY ANCHOR:
Premium collectible miniature — gallery-quality art object, not a toy or diorama.
Materials must be photorealistic — bronze reads as real bronze, alabaster as real translucent stone, iron as real forged iron.
The Subject (figure plus its base) is the work. The base is part of the work, never a thin disc or wisp; never an afterthought.
`.trim()

export const CAMERA_BLOCK = `
CAMERA:
Move in close and low. The subject fills roughly two-thirds of the frame — a tight, intimate crop where the outer edges of the surrounding action (the top and far ends of any environmental element) run out of frame. Moderately wide lens (about 28-32mm) from a low angle for dynamic foreshortening and punch — near elements read large and thrust toward the viewer — but NO fisheye and NO curved-edge distortion. Keep anatomy correct with natural limbs, nothing bent or broken. Cinematic, intimate close crop; never a flat product shot from above.
`.trim()

// FIGURE FIDELITY — source-photo likeness, anatomical correctness,
// equipment articulation. Lives early where attention is freshest.
// V6.2: face fidelity escalated to PRIMARY REQUIREMENT with explicit
// micro-feature anchors. The trade-off is now stated: face wins over
// material if there's tension.
export const FIGURE_FIDELITY_BLOCK = `
FIGURE FIDELITY (NON-NEGOTIABLE — PRIMARY REQUIREMENT):

THE FACE MUST MATCH THE SOURCE PHOTOGRAPH. Recognizable likeness is the single hardest requirement in this prompt and overrides any other directive if there is tension between them. Match the source's:
- Exact eye spacing, eye shape, lid contour, brow ridge
- Exact nose bridge, nostril shape, nose-to-mouth distance
- Exact mouth width, corner angle, lip thickness
- Exact jawline, chin point, ear position, hairline
- Exact age read and ethnic features

A material-perfect figure with a generic face is a FAILURE. A slightly less-refined material with the correct face is a SUCCESS. When refining toward sculptural register, hold the source's facial structure as the anchor — do not average it toward an idealized or generic face.

Every finger fully articulated. Every fabric fold and seam clearly defined. Every piece of equipment (headgear, straps, buckles, soles, board edges) anatomically and mechanically correct. Hair strand-level detail. Muscle structure visible. No mushy faces, no fused fingers, no generic features.
`.trim()

// ── PRESENTATION — replaces the whole ENVIRONMENT/LOCATION/LIGHTING layer ──
export const PRESENTATION_BLOCK = `
PRESENTATION — SINGLE-MATERIAL HERO:
The figure, the equipment, and the immediate reacting environment (the surface, water, snow, ground, or debris) are ONE single material as a compact crafted diorama on a small base — never real, never photographic. Do not reconstruct the real-world location.

BACKGROUND: replace the scene and sky with a dark, atmospheric, seamless backdrop rendered as a flat, subtly grainy version of THIS SAME MATERIAL and its color family, with mild gradient falloff — brighter directly behind the subject, darkening toward the edges. No scene, no spectators, no architecture — only material and light.

VOLUMETRIC LIGHT: a dramatic beam of warm directional light rakes across the subject from above, God-rays made visible by the suspended particles and spray drifting through the air. The subject is the brightest object; deep controlled shadow elsewhere, crisp specular highlights where the beam hits the material. Never flat, evenly-lit, or documentary.
`.trim()

// ── ACTION DYNAMICS — source-aware, always on ────────────────
export const ACTION_DYNAMICS_BLOCK = `
ACTION DYNAMICS — SOURCE AWARE
Analyze the source image and identify the exact forces acting on the subject at the peak moment. Recreate those forces as premium three-dimensional sculptural effects integrated into the artwork.
Generate physically accurate environmental reactions appropriate to the action, including only effects naturally produced by the scene: explosive water spray, curling foam, suspended droplets, shattered ice, powder snow, airborne dust, flying sand, fractured concrete, stone chips, mud spray, sparks, smoke, vegetation displacement, compressed surfaces, fabric tension, hair movement, equipment flex, and displaced debris.
Effects must originate from actual points of impact, pressure, acceleration, friction, compression, or directional movement. Debris should radiate naturally along believable trajectories with varied particle sizes and densities. Large fragments remain close to the source while fine particles disperse outward in layered volumetric clouds.
Freeze the instant of maximum energy. Every fragment, droplet, particle, and shard is razor sharp, fully three-dimensional, suspended naturally in space with realistic gravity, momentum, airflow, and fluid dynamics. Never use motion blur, speed lines, glowing streaks, magical energy, or abstract visual effects.
Treat the environment as part of the sculpture. Water curls around the subject. Concrete fractures beneath contact points. Snow explodes into crystalline powder. Dust rolls through the air. Materials deform, compress, fracture, and react naturally to the forces being applied.
The resulting sculpture should preserve not only the pose, but the invisible physical energy of the moment through believable environmental interaction and premium museum-quality craftsmanship.
`.trim()

// ── CRAFTSMANSHIP ────────────────────────────────────────────
export const CRAFTSMANSHIP_BLOCK = `
CRAFTSMANSHIP:
Maximum collectible-quality execution. Crisp edges, readable fabric weave, visible stitching, clear material transitions, realistic textile behavior, exceptional sculptural fidelity. Premium limited-edition gallery collectible.
`.trim()
