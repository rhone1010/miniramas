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
- The entire miniature must be in sharp focus — every detail crisp and clear
- Background blur applies ONLY to the scene behind the base — never to the miniature itself
- No tilt-shift blur on the miniature — it must look like a real physical object
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
Convert the building into a photorealistic handcrafted scale model collectible.
This is a physical transformation — structurally faithful but presented as a premium display piece.

ARCHITECTURAL FIDELITY (STRICT — STRUCTURE ONLY):
- Retain exact roof shape, pitch, and roofline from source image
- Retain window positions, sizes, and trim details exactly
- Retain porch structure, columns, railings exactly as photographed
- Retain siding color, trim color, and surface material language
- Retain bay windows, dormers, or any unique features present in source
- Do NOT add floors, windows, dormers, or structural features not in the original
- Do NOT change the building's shape, massing, or proportions

LANDSCAPING (ENHANCED — THIS IS A COLLECTIBLE, NOT A SURVEY MODEL):
The landscaping should be beautiful, lush, and inviting — like a premium gift shop miniature.
- Add rich green grass, neatly trimmed, covering the base
- Add tasteful garden beds with small flowers and shrubs around the building foundation
- Add miniature model trees in contextually appropriate positions
- Add a stone or brick pathway from the porch steps to the base edge
- Keep all landscaping in miniature model scale — flocking, static grass, model foliage
- Tree height must remain below roofline
- Landscaping must feel designed and curated, not sparse or accidental

PRESENTATION QUALITY:
- The miniature must look like it belongs in a high-end gift shop or collectible store
- Rich, warm colors throughout — no grey or dull tones
- Every surface should have texture and life
- The base should feel full and complete, not empty

FORBIDDEN:
- Warping, stretching, or proportional changes to the building
- Cartoonization of any architectural element
- Flat printed backgrounds or sky planes
- Grey, dull, or lifeless color palette
- Sparse or empty base — the landscaping must be full and rich
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
Maintain ${margin}% margin between the base edge and the image frame on ALL sides including the bottom.
The full circular base including its bottom edge must be completely visible — do not crop the base at any edge.
Pull the camera back slightly if needed to ensure the entire base fits within the frame.

MATERIALS:
Use ${material} materials with realistic physical surface qualities and premium collectible craftsmanship.
All elements must share a consistent material language.

CAMERA:
Macro product photography of a real physical miniature sitting on a wooden surface.
Camera positioned approximately ${angle} degrees above, angled downward toward the scene.
CRITICAL — FOCUS: The entire diorama must be in sharp focus — every surface, detail, and texture on the miniature must be crisp and clear.
Depth of field applies ONLY to the background scene behind the base — everything beyond the base edge is softly blurred.
Do NOT apply tilt-shift blur. Do NOT selectively blur any part of the miniature itself.
The miniature must look like a real physical collectible object you could pick up — not a photograph with lens blur.

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
  mode?: 'sports' | 'activity' | 'keychain'
): string {
  // Keychain mode is self-contained — skip environment and style lock blocks
  if (mode === 'keychain') {
    return honePeople(imageDescription).trim()
  }

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

// ─── HONE PEOPLE — IDENTITY-PRESERVED MINIATURE (v2) ─────────────────────────

function honePeople(imageDescription: string): string {
  return `
IDENTITY-PRESERVED STYLIZED MINIATURE — HONESCALE PEOPLE ENGINE v2

This is a premium collectible figurine. Identity always overrides stylization.
Target aesthetic: Pixar-adjacent realism. Not chibi. Not Funko Pop. Not anime.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. FACE GEOMETRY LOCK (HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Preserve exact facial structure from source image.
- Maintain face height and vertical length exactly
- Maintain jaw shape and taper exactly
- Maintain cheekbone position exactly
- Maintain temple width exactly
- Do not round, compress, widen, or narrow the face
- Geometry overrides all stylization decisions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. FACIAL WIDTH LOCK (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Preserve facial width exactly.
- No cheek compression or inward tapering
- No V-shaped narrowing toward chin
- Maintain distance between eyes and outer cheeks exactly
- Maintain mid-face width (nose-to-cheek span) exactly
- Face must remain a natural oval — not pinched, not heart-shaped

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. AGE LOCK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Preserve apparent age exactly as in source photo.
- Do NOT add wrinkles, sagging, or under-eye shadows
- Do NOT increase perceived age through texture or lighting
- Do NOT make subject look younger — preserve exact age
- Detail must not age or de-age the subject in any direction

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. EXPRESSION LOCK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Preserve exact expression from source photo.
- Match smile shape and asymmetry precisely
- Maintain eye liveliness and eyelid tension
- Preserve cheek lift from smiling if present
- Do NOT replace expression with a generic or neutral face
- Do NOT create a tired, sad, or blank expression

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. EYE CONTROL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Eyes must remain proportional to face.
- Maximum scale increase: +10% — no more
- Preserve original eye shape — no rounding or circularizing
- Preserve eyelid thickness, fold structure, and spacing exactly
- Enhance iris clarity only — NOT overall eye size
- FORBIDDEN: anime enlargement, cartoon eye templates, circularization

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. MOUTH DETAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Preserve mouth exactly.
- Maintain exact mouth width
- Maintain tooth visibility if present in source
- Maintain lip curvature and natural asymmetry
- Do not simplify or symmetrize the mouth
- The smile must match the source expression precisely

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. SKULL SCALING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Slightly increase overall head size by scaling skull volume uniformly.
- Do NOT alter internal facial proportions when scaling
- Head-to-body ratio: 1:2.6 to 1:2.8 (never exceed 1:2.5)
- The face inside the skull remains geometrically unchanged
- More skull area = more canvas for facial detail — use it

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. MATERIAL STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Render as high-end collectible figurine.
- Full glossy resin finish across all surfaces — skin, hair, clothing, props
- Clean, slightly rounded edges throughout
- Subtle specular highlights — strong but not plastic-looking
- Smooth but detailed textures
- Eyes: deep glassy reflections
- Base rim: polished dark walnut wood finish
- Overall: premium collectible sold in a high-end toy or gift store

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. LIGHTING CONTROL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use soft, frontal, warm studio lighting.
- Even facial illumination — no harsh directional contrast
- Minimize under-eye shadow — do NOT create tired or sunken eyes
- Warm light temperature flatters all skin tones
- Lighting must make the subject look alive and present, not tired or flat

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. COMPOSITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Camera: 35 degrees above, angled downward — feels like a miniature, not a portrait
- Full figure visible head to toe
- Full base visible with clean edges
- Horizontal margins: 20% each side
- Vertical margins: 12% top and bottom
- The entire figurine must be in sharp focus — every surface and detail crisp and clear
- Background blur applies ONLY behind the base — nothing on the figurine or base is blurred
- Macro product photography of a real physical collectible object on a wooden surface

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. BASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Simple round display base, thick and substantial (~1cm perceived height)
- Outer rim: warm polished gloss dark walnut wood, clean rounded edge
- Base floor surface must match the ground visible in the source photo:
  - Carpet → textured fabric-like miniature surface in matching color
  - Grass → fine static grass or green flocking
  - Dirt/soil → textured brown terrain
  - Tile/hardwood → smooth painted miniature floor in matching color
  - Sand → fine terrain sand texture
- No surrounding scenery beyond base floor texture
- Figurine naturally anchored to the base floor

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. STRICT CONSTRAINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- No keyring, no chain, no attachment hardware
- No surrounding scenery or props beyond base floor texture
- Single figurine only — no other people or objects
- Clothing, accessories, and props reproduced exactly as in source
- Do not invent elements not present in source photo
- Glossy finish mandatory throughout

MASTER RULE: A parent must look at this figurine and immediately recognize their child.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCENE TO TRANSFORM:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${imageDescription}
`
}