// lib/prompts/promptBuilder.ts

import { MiniramaConfig } from './validateConfig'

function humanize(value: string): string {
  return value.replace(/_/g, ' ')
}

// ─── STYLE LOCK ───────────────────────────────────────────────────────────────
// Always appended. Non-negotiable rules that apply to every generation.

function getStyleLockBlock(): string {
  return `
STYLE LOCK (MANDATORY — APPLY TO ALL OUTPUTS):
- The entire scene must exist as a physical three-dimensional miniature
- The display base must be fully visible in frame with clean edges
- Maintain approximately 10–20% breathing room between base edge and image frame
- Camera must be positioned 25–45 degrees above the subject, looking down
- Depth of field must simulate real macro product photography
- No flat backgrounds, no 2D scenery, no sky cards, no printed backdrops
- All elements must be grounded and physically connected to the base
- Use only plausible physical miniature materials
- No warped anatomy, no distorted faces, no stretched architecture
- Preserve collectible premium display quality throughout
- No snowglobe shape, no spherical distortion
`
}

// ─── SUBJECT BLOCKS ───────────────────────────────────────────────────────────

function getPeopleBlock(): string {
  return `
SUBJECT TRANSFORMATION (PEOPLE):
Convert all people into collectible miniature figurines while preserving exact facial identity, proportions, and expression.
Faces must remain highly recognizable with accurate structure, asymmetry, and natural features.
Slight stylization allowed only in softening edges — avoid cartoon, chibi, or exaggerated proportions.

MATERIAL (FIGURES):
Render as high-quality molded collectible figures with satin-to-semi-gloss resin finish.
- Skin: soft satin with subtle highlights on cheeks, nose, forehead
- Eyes: crisp reflective highlights for lifelike presence
- Clothing: slightly higher sheen than skin
- Hard props: semi-gloss to glossy
Avoid flat matte and avoid plastic toy appearance.

IDENTITY RULES (STRICT):
- Preserve exact facial features, proportions, and expression from source image
- Match hair color, length, and style exactly
- Match clothing colors and style exactly
- No stylization, cartooning, or idealization of faces
`
}

function getArchitectureBlock(): string {
  return `
SUBJECT TRANSFORMATION (ARCHITECTURE):
Convert the building into a photorealistic handcrafted scale model.
This is a physical transformation of the original structure — NOT a reinterpretation.

ARCHITECTURAL FIDELITY (STRICT):
- Retain exact roof shape, pitch, and roofline from source image
- Retain window positions, sizes, and trim details exactly
- Retain porch structure, columns, railings exactly as photographed
- Retain siding color, trim color, and surface material language
- Retain bay windows, dormers, or any unique features present in source
- Do NOT add floors, windows, dormers, or features not in the original
- Do NOT upgrade, beautify, or idealize the building

LANDSCAPING (SOURCE-FAITHFUL):
- Only include landscaping elements visible in the source photograph
- Do NOT add gardens, pathways, fences, flower beds, or shrubs not present in source
- If yard is plain grass, keep it plain grass
- Trees: only include if visible in original, placed in same relative positions
- Tree height must remain below roofline
- All vegetation rendered as miniature model foliage, not photographic plants

FORBIDDEN:
- Warping, stretching, or proportional changes
- Cartoonization of any architectural element
- Invented elements not present in source photo
- Flat printed backgrounds or sky planes
`
}

function getLandscapeBlock(): string {
  return `
SUBJECT TRANSFORMATION (LANDSCAPE):
Convert the scene into a physically constructed round miniature diorama.
All elements of the original scene must be converted into three-dimensional miniature objects, terrain, or structures as if built for a handcrafted scale model.

ENVIRONMENT CONVERSION:
- Water → sculpted miniature resin water
- Sand → model terrain sand
- Wood structures → miniature wood scale models
- Vegetation → model foliage and terrain plants
- Sky elements → removed or converted to neutral background

SOURCE FIDELITY:
Only include elements visible in the source photograph.
Do not invent new terrain features, structures, or vegetation not present in original.

CONSTRAINTS:
- Nothing should exist outside the round diorama base
- The pier or any extending element must stop at the natural scene limits
- Neutral minimal sky, sunset colors visible only in water reflections if present
`
}

function getSportsBlock(): string {
  return `
SUBJECT TRANSFORMATION (SPORTS):
Preserve exact facial structure, proportions, and asymmetry from all subjects with high fidelity.
Do not stylize or exaggerate features. Avoid chibi, cartoon, or toy-like proportions.

MATERIAL (FIGURES):
Render as highly detailed hand-painted miniature figures using matte-to-satin resin.
- Apply subtle specular highlights only where natural (eyes, slight skin sheen)
- Maintain skin texture, fine details, and natural color variation
- Eyes must remain sharp and lifelike with small reflective highlights
- Avoid plastic or vinyl appearance
- Result should feel like premium handcrafted collectible, not mass-produced toy

SCENE:
Place subjects into a live sports event environment as if physically present at the game.
Include stadium seating, crowd depth, and layered audience elements with realistic scale.
Subjects must feel physically embedded in the scene, not composited.
Lighting, perspective, and depth of field must match the stadium environment.

BRANDING:
Use team color palettes and apparel styling to suggest team identity.
Avoid direct logos or trademarks unless explicitly for personal use.
`
}

function getActivityBlock(): string {
  return `
SUBJECT TRANSFORMATION (ACTIVITY/EVENT):
Convert all people into collectible miniature figurines preserving identity, facial structure, and expression.
Maintain recognizable likeness with accurate proportions and pose relationships between subjects.

ENVIRONMENT ENHANCEMENT:
If the original environment is weak or undefined, reconstruct a more compelling but contextually appropriate setting.
Enhancement must remain physically buildable as a miniature and must not overpower subjects.
Preserve interaction between subjects, spatial relationships, and emotional tone.

MATERIAL CONVERSION:
All environmental elements must be fully 3D miniature objects.
- Terrain → sculpted miniature ground
- Barriers/structures → molded or handcrafted components
- Lighting elements → integrated miniature light sources or glowing elements
- Vegetation → miniature scenic plants
No flat backgrounds or photographic textures allowed.

LIGHTING:
Studio-style with directional highlights.
Optional colored accent lighting where contextually appropriate (e.g., arena glow).
`
}

// ─── BASE ENVIRONMENT BLOCK ───────────────────────────────────────────────────

function getEnvironmentBlock(config: MiniramaConfig, imageDescription: string): string {
  const margin = Math.round((config.composition.margin_ratio || 0.15) * 100)
  const angle = config.composition.camera_angle || 35
  const dof = humanize(config.composition.depth_of_field || 'shallow')
  const base = humanize(config.style.base_style || 'circular_wood_plinth')
  const material = humanize(config.style.material_style || 'painted_resin')
  const lighting = humanize(config.style.lighting_style || 'warm_studio')
  const background = humanize(config.style.background_style || 'blurred_home')
  const detail = humanize(config.detail.level || 'high')

  return `
BASE:
Place the entire scene on a ${base} with clean rounded edges.
Maintain ${margin}% margin between the base edge and the image frame.
The full base must be completely visible — do not crop the base.

MATERIALS:
Use ${material} materials with realistic physical surface qualities and premium collectible craftsmanship.
All elements must share a consistent material language.

CAMERA:
Macro product photography of a real physical miniature.
Camera positioned approximately ${angle} degrees above, angled downward toward the scene.
${dof} depth of field. Keep primary subjects sharp and readable.
Slight tilt-shift effect to reinforce miniature scale.

LIGHTING:
${lighting} lighting with coherent shadow logic, soft highlights, and realistic reflections.
Lighting must reinforce the physicality and dimensionality of the miniature.
Highlight targets: roof/top surfaces, windows, glossy surfaces, foreground elements.

BACKGROUND:
${background} — softly blurred with medium bokeh.
Background must feel secondary and subordinate to the miniature.
Warm interior setting: side table surface, soft furnishings, neutral walls.

DETAIL:
${detail} detail level with physically believable miniature scale throughout.
Render as photorealistic premium collectible product photography.

SCENE TO TRANSFORM:
${imageDescription}
`
}

// ─── TUNING BLOCK ─────────────────────────────────────────────────────────────

function buildTuningBlock(promptTuning: Record<string, boolean | number> = {}): string {
  const lines: string[] = []

  if (promptTuning.identity_weight) {
    lines.push('Preserve exact facial identity and recognizable likeness with very high priority.')
  }
  if (promptTuning.reduce_stylization) {
    lines.push('Avoid cartoon exaggeration, face reshaping, or toy-like simplification that breaks identity.')
  }
  if (promptTuning.force_full_base_in_frame || promptTuning.emphasize_full_base_visibility) {
    lines.push('The full display base must be completely visible in frame with clear breathing room around it.')
  }
  if (promptTuning.force_dimensionality) {
    lines.push('All environmental elements must be fully three-dimensional miniature objects with physical thickness and volume.')
  }
  if (promptTuning.no_flat_backdrops) {
    lines.push('Do not use flat background cards, flat printed scenery, or 2D sky plates.')
  }
  if (promptTuning.force_ground_contact) {
    lines.push('All subjects and objects must be physically grounded and connected to the terrain or display structure.')
  }
  if (promptTuning.reinforce_miniature_scale) {
    lines.push('Maintain consistent miniature scale relationships across figures, terrain, structures, and props.')
  }
  if (promptTuning.reinforce_single_light_logic) {
    lines.push('Use one coherent lighting direction with physically consistent shadowing and highlights.')
  }
  if (promptTuning.enhance_material_realism) {
    lines.push('Materials must read as premium physical miniature materials: painted resin, polished wood, realistic water resin, flocking, stone, and foliage.')
  }
  if (promptTuning.reinforce_original_composition) {
    lines.push('Maintain the original subject grouping, framing logic, and pose relationship from the input image.')
  }

  return lines.length
    ? `\nOPTIMIZER CORRECTIONS:\n- ${lines.join('\n- ')}`
    : ''
}

// ─── SUBJECT BLOCK ROUTER ─────────────────────────────────────────────────────

function getSubjectBlock(subjectType: MiniramaConfig['subject']['type']): string {
  switch (subjectType) {
    case 'single_person':
    case 'couple':
    case 'family':
      return getPeopleBlock()
    case 'architecture':
      return getArchitectureBlock()
    case 'landscape':
      return getLandscapeBlock()
    case 'object':
      return getActivityBlock()
    default:
      return getLandscapeBlock()
  }
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────

export function buildFinalPrompt(
  config: MiniramaConfig,
  imageDescription: string,
  mode?: 'sports' | 'activity'
): string {
  // Route subject block — sports/activity override subject type routing
  const subjectBlock = mode === 'sports'
    ? getSportsBlock()
    : mode === 'activity'
    ? getActivityBlock()
    : getSubjectBlock(config.subject.type)

  const environmentBlock = getEnvironmentBlock(config, imageDescription)
  const styleLock = getStyleLockBlock()
  const tuningBlock = buildTuningBlock(config.prompt_tuning)

  return [
    subjectBlock,
    environmentBlock,
    styleLock,
    tuningBlock,
  ]
    .filter(Boolean)
    .join('\n')
    .trim()
}