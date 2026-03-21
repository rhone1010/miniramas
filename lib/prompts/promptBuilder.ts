// lib/prompts/promptBuilder.ts — HONESCALE v4.1
// Adds: base theme system, expression lock as top-tier rule,
// frame fit guarantee, base physicality enforcement

import { MiniramaConfig, BaseTheme } from './validateConfig'

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface PlaqueConfig {
  mode: 'user' | 'ai'
  tone?: 'appropriate' | 'funny' | 'witty' | 'sarcastic'
  text?: string
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ')
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERCEPTION BLOCKS
// ═══════════════════════════════════════════════════════════════════════════════

function getStyleLockBlock(): string {
  return `
STYLE LOCK (MANDATORY):
- Entire scene must be a physical 3D miniature
- Display base fully visible — no cropping, no touching frame edge on any side
- Camera 30-45 degrees above, looking down — never eye-level
- Entire miniature in sharp focus — every detail crisp
- Background blur ONLY behind the base — never on the miniature
- No tilt-shift blur, no flat backdrops, no 2D scenery, no sky cards
- All elements grounded and physically connected to the base
- No warped anatomy, no distorted faces, no stretched architecture
- No snowglobe shape, no spherical distortion
`
}

function getMiniaturePerceptionLock(): string {
  return `
MINIATURE PERCEPTION LOCK (CRITICAL):
The viewer must perceive: "This is a real handcrafted miniature sitting on a table."
NOT a life-size scene. NOT a digital render. NOT a zoomed-out real-world photo.

CAMERA: 30-45 degrees above, looking down — never eye-level

SCALE CUES (ALL MANDATORY):
- Visible base thickness and routed edge profile
- Fine surface textures at close range: wood grain, flocking, resin, painted detail
- Realistic contact shadow where base meets table surface
- Background softness = macro lens falloff only, not cinematic blur

If the scene reads as life-size → it is incorrect
`
}

function getCameraScaleBlock(angle: number): string {
  return `
CAMERA & SCALE PERCEPTION:
Macro product photography of a small physical collectible on a tabletop.
- Camera angle: ${angle} degrees above, angled downward
- Mimic macro lens: slight perspective compression, natural depth falloff
- Do NOT simulate full-scale or wide-angle photography
- Object must read as small and tangible

FOCUS ENFORCEMENT (STRICT):
- Entire miniature in complete sharp focus — every surface, every edge
- No blur on any part of the miniature for any reason
- No tilt-shift effect allowed
- Background blur begins ONLY beyond the base edge

PHYSICAL CONTACT RULE:
- Base sits naturally on visible wooden tabletop
- Clear soft contact shadow under base — grounded, not floating
- Table surface texture visible and believable (wood grain preferred)
`
}

// ─── FRAME FIT GUARANTEE ──────────────────────────────────────────────────────
// Fix 3: Explicit permission to shrink subject / pull camera back

function getFrameFitBlock(marginPct: number): string {
  return `
FRAME FIT GUARANTEE (STRICT — NON-NEGOTIABLE):
The entire display base MUST be fully visible within the frame.
- No part of the base may touch or cross the image edge
- Maintain at least ${marginPct}% visible margin on ALL sides including bottom

TO ACHIEVE THIS (USE THESE IN ORDER):
1. Move camera further back to include full base
2. Reduce subject scale if needed
3. Increase field of view slightly if needed

Cropping the base = incorrect result. Shrinking the subject is preferred over cropping.
`
}

function getFailureConditions(): string {
  return `
FAILURE CONDITIONS (OUTPUT IS INCORRECT IF ANY OCCUR):
IDENTITY: Face symmetrized · Expression generic/softened · Cheeks inflated · Jaw shape changed · Skin tone shifted · Eyes >18%
BASE: Missing walnut plinth · Missing brass band · Missing brass plaque · Wrong ground texture · Room interior on base · Base cropped at any edge
PERCEPTION: Scene reads life-size · Camera eye-level · Any miniature blur · Base floating
`
}

// ═══════════════════════════════════════════════════════════════════════════════
// BASE SYSTEM — THEMED
// ═══════════════════════════════════════════════════════════════════════════════

function resolveGroundMaterial(groundSurface: string): string {
  if (!groundSurface) return 'textured surface matching the source image ground material'
  const s = groundSurface.toLowerCase()
  if (s.includes('carpet')) return 'textured fabric miniature surface matching the carpet color and pattern from source'
  if (s.includes('grass')) return 'fine static grass or green terrain flocking matching source'
  if (s.includes('dirt') || s.includes('soil') || s.includes('mud')) return 'granular brown terrain texture matching source ground'
  if (s.includes('hardwood') || s.includes('wood floor')) return 'smooth painted miniature hardwood floor in matching color and grain'
  if (s.includes('tile')) return 'scaled tile pattern matching source tile color and layout'
  if (s.includes('sand')) return 'fine terrain sand texture matching source'
  if (s.includes('concrete') || s.includes('pavement') || s.includes('asphalt')) return 'smooth grey miniature concrete surface matching source'
  if (s.includes('stone') || s.includes('cobble')) return 'miniature stone or cobblestone texture matching source'
  if (s.includes('snow')) return 'fine white powdered terrain matching source snow surface'
  if (s.includes('water') || s.includes('beach')) return 'sculpted miniature resin water or wet sand edge matching source'
  return `textured surface faithfully replicating: ${groundSurface}`
}

function getBaseThemeInstructions(theme: BaseTheme, groundSurface: string): string {
  const ground = resolveGroundMaterial(groundSurface)

  switch (theme) {
    case 'match_environment':
      return `
BASE SURFACE (MATCH ENVIRONMENT):
Replicate the source floor exactly: ${ground}
- Increase texture clarity and edge polish — make it feel curated, not accidental
- No added objects or props
- Clean, faithful, premium version of the original floor
`
    case 'enhanced_environment':
      return `
BASE SURFACE (ENHANCED ENVIRONMENT):
Start with source floor: ${ground}
- Increase texture clarity and edge crispness
- Add subtle raised texture variation and clean edge transitions
- May include 1-2 contextually appropriate small objects placed intentionally at base edge
- Objects must feel like they belong — not random decoration
`
    case 'play_scene':
      return `
BASE SURFACE (PLAY SCENE — STORYTELLING):
Start with source floor: ${ground}
- Add a small number of contextually appropriate props arranged with intention
  (e.g. toy truck, ball, book — whatever fits the subject's context from source image)
- Props must tell a story about the subject — not clutter the scene
- Maximum 2-3 props, all miniature scale, all purposefully positioned
- This base must feel like a curated memory snapshot, not a generic display
`
    case 'memory_scene':
      return `
BASE SURFACE (MEMORY SCENE):
Start with source floor: ${ground}
- Slightly staged and curated — cleaner than reality, warmer than minimal
- May include subtle contextual detail (e.g. soft rug edge, a single meaningful object)
- Composition must feel like a preserved moment — thoughtful, not cluttered
`
    case 'minimal_premium':
      return `
BASE SURFACE (MINIMAL PREMIUM):
Simple, clean floor surface: ${ground}
- No additional objects or props
- Maximum texture clarity and edge polish
- Let the plaque and figurine carry all attention
- Premium, gallery-quality restraint
`
    default:
      return `BASE SURFACE: ${ground} — clean, polished, curated.`
  }
}

function getBaseBlock(
  groundSurface: string,
  plaque?: PlaqueConfig,
  baseTheme: BaseTheme = 'match_environment'
): string {
  const plaqueText = plaque?.mode === 'user' && plaque.text
    ? plaque.text
    : `Generate ${plaque?.tone || 'appropriate'} text appropriate to the scene`
  const themeInstructions = getBaseThemeInstructions(baseTheme, groundSurface)

  return `
DISPLAY BASE (NON-NEGOTIABLE — MISSING BASE = FAILURE):

BASE PHYSICALITY (CRITICAL):
- Thick, substantial circular display plinth — minimum 3/4 inch visual thickness
- Must feel weighty and premium — not a thin platform
- Material: polished dark walnut wood, high-gloss lacquer
- Edge: routed profile (rounded or beveled) — visible from camera angle
- Add subtle highlight along edge to emphasize form and thickness
- Thin brass accent band around the outer perimeter, flush and clean

BRASS PLAQUE (MANDATORY — missing = failure):
- Brushed brass engraved plate centered on front face of base
- Text clean, centered, legible: ${plaqueText}
- Feels like a premium collectible label, not decorative fluff

${themeInstructions}

FORBIDDEN ON BASE:
- Room interiors (no walls, furniture, ceiling)
- Generic or invented textures that don't match source
- Thin, flat, or weightless appearance
- Any part of base cropped by image edge
`
}

// ═══════════════════════════════════════════════════════════════════════════════
// IDENTITY BLOCKS — PEOPLE
// ═══════════════════════════════════════════════════════════════════════════════

function getSkinIdentityBlock(): string {
  return `
SKIN TONE & SURFACE (IDENTITY-CRITICAL):
- Match skin tone exactly — do NOT shift lighter or darker
- Preserve undertones (warm/cool/neutral) exactly
- Preserve natural variation: freckles, redness, marks, dirt — do NOT remove
- Glossy resin finish OVER correct skin tone — skin retains correct color beneath
`
}

function getFaceVolumeBlock(): string {
  return `
FACE VOLUME CONTROL (ANTI-BALLOON):
- Do NOT increase cheek volume or inflate mid-face
- Preserve natural bone structure and angularity exactly
- Cheekbone width, jaw length, face height: all unchanged from source
- Stylization NEVER reshapes geometry — structure always wins
`
}

function getEyeControlBlock(): string {
  return `
EYE CONTROL (STYLIZED BUT CONTROLLED):
- Enlarge 10-18% max for collectible appeal — preserve original eye SHAPE
- No circularization, no anime enlargement, no button eyes
- Preserve eyelid structure, fold, thickness, and spacing exactly
- Forbidden: >18% enlargement · eye shape change · eyelid loss
`
}

function getImperfectionBlock(): string {
  return `
HUMAN IMPERFECTION PRESERVATION (LIKENESS UNLOCK):
- Preserve natural asymmetry — do NOT symmetrize the face
- Do NOT average or perfect the face
- Maintain natural irregularities: smile shape, eye alignment, cheek structure, jaw contour
- Must feel like a SPECIFIC real person — not an idealized version
- If face looks cleaner or more symmetrical than source → it is WRONG
`
}

// Fix 2: Expression is now a TOP-TIER standalone block, not buried in identity
function getExpressionLockBlock(): string {
  return `
EXPRESSION PRESERVATION (TOP-TIER — HIGH PRIORITY):

The subject's exact emotional expression MUST be preserved from the source image.
This is separate from identity — expression is not "pleasant" by default, it is THIS person at THIS moment.

- Match the exact smile shape including any asymmetry
- Preserve subtle smirk, hesitation, playfulness, shyness, confidence — whatever is present
- Maintain eye expression: confidence, curiosity, mischief, joy — match exactly
- Preserve cheek tension and mouth curvature precisely

FORBIDDEN:
- Replacing expression with a generic pleasant smile
- Neutralizing or softening emotional intensity
- Over-smoothing any expressive features
- Averaging expression toward "nice looking"

The goal is not "a nice expression"
The goal is "this exact moment captured in the original photo"

If expression is more generic than source → it is incorrect
`
}

function getExpressionIntensityBlock(): string {
  return `
EXPRESSION INTENSITY LOCK:
- Capture exact emotional intensity — not a softened version
- Preserve: cheek lift height, eye squint degree, mouth tension/corner pull/asymmetry, brow tension
- Do NOT replace with generic smile. Do NOT soften or neutralize.
- More generic than source → incorrect
`
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBJECT BLOCKS
// ═══════════════════════════════════════════════════════════════════════════════

function getPeopleBlock(): string {
  return `
SUBJECT TRANSFORMATION (PEOPLE):
Convert people into collectible miniature figurines preserving exact facial identity, proportions, and expression.
NO stylization in facial geometry, proportions, or expression.
MATERIAL: Satin-to-semi-gloss resin. Skin tone must match source exactly. No flat matte, no plastic toy appearance.
IDENTITY: Preserve exact features, proportions, expression, hair, clothing colors exactly.
`
}

function getArchitectureBlock(): string {
  return `
SUBJECT TRANSFORMATION (ARCHITECTURE):
Photorealistic handcrafted scale model collectible.
FIDELITY: Retain exact roof shape, windows, porch, siding, trim — do NOT add or change anything structural.
LANDSCAPING: Rich grass, garden beds, miniature trees, stone pathway — premium collectible quality.
FORBIDDEN: warping · cartoonization · flat backdrops · grey palette · sparse base
`
}

function getLandscapeBlock(): string {
  return `
SUBJECT TRANSFORMATION (LANDSCAPE):
Physically constructed round miniature diorama.
CONVERSION: Water→resin · Sand→terrain · Vegetation→model foliage · Sky→neutral background
SOURCE FIDELITY: Only elements visible in source. No invented terrain.
CONSTRAINTS: Nothing outside the round base. Neutral minimal sky.
`
}

function getSportsBlock(): string {
  return `
SUBJECT TRANSFORMATION (SPORTS):
Preserve exact facial structure and asymmetry. No chibi, cartoon, or toy proportions.
MATERIAL: Highly detailed hand-painted matte-to-satin resin. Match source skin tone exactly.
SCENE: Live sports event — stadium seating, crowd depth, subjects physically embedded.
BRANDING: Team color palettes only. No direct logos.
`
}

function getActivityBlock(): string {
  return `
SUBJECT TRANSFORMATION (ACTIVITY/EVENT):
Convert people into collectible figurines preserving identity, structure, expression, and pose relationships.
ENVIRONMENT: Reconstruct compelling contextually appropriate setting. Must be physically buildable as miniature.
MATERIAL: All elements fully 3D miniature objects. No flat backgrounds or photographic textures.
`
}

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

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIRONMENT BLOCK
// ═══════════════════════════════════════════════════════════════════════════════

function getEnvironmentBlock(config: MiniramaConfig, imageDescription: string): string {
  const angle = config.composition.camera_angle || 35
  const material = humanize(config.style.material_style || 'painted_resin')
  const lighting = humanize(config.style.lighting_style || 'warm_studio')
  const background = humanize(config.style.background_style || 'blurred_home')
  const detail = humanize(config.detail.level || 'high')

  return `
MATERIALS: ${material} — realistic physical surface qualities, premium collectible craftsmanship.

${getCameraScaleBlock(angle)}

LIGHTING: ${lighting} — coherent shadow logic, soft highlights, realistic reflections.
Highlights: roof/top surfaces, windows, glossy surfaces, foreground elements.
BACKGROUND: ${background} — softly blurred medium bokeh. Warm interior: side table, soft furnishings, neutral walls.
DETAIL: ${detail} — physically believable miniature scale. Photorealistic premium collectible product photography.

SCENE TO TRANSFORM:
${imageDescription}
`
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY BLOCKS
// ═══════════════════════════════════════════════════════════════════════════════

function buildTuningBlock(promptTuning: Record<string, boolean | number> = {}): string {
  const lines: string[] = []
  if (promptTuning.identity_weight) lines.push('Preserve exact facial identity and recognizable likeness with very high priority.')
  if (promptTuning.reduce_stylization) lines.push('Avoid cartoon exaggeration, face reshaping, or toy-like simplification that breaks identity.')
  if (promptTuning.force_full_base_in_frame || promptTuning.emphasize_full_base_visibility) lines.push('The full display base must be completely visible in frame with clear breathing room around it.')
  if (promptTuning.force_dimensionality) lines.push('All environmental elements must be fully three-dimensional miniature objects.')
  if (promptTuning.no_flat_backdrops) lines.push('Do not use flat background cards, flat printed scenery, or 2D sky plates.')
  if (promptTuning.force_ground_contact) lines.push('All subjects must be physically grounded and connected to the terrain or display structure.')
  if (promptTuning.reinforce_miniature_scale) lines.push('Maintain consistent miniature scale relationships across figures, terrain, structures, and props.')
  if (promptTuning.reinforce_single_light_logic) lines.push('Use one coherent lighting direction with physically consistent shadowing and highlights.')
  if (promptTuning.enhance_material_realism) lines.push('Materials must read as premium physical miniature materials: painted resin, polished wood, water resin, flocking, stone, foliage.')
  if (promptTuning.reinforce_original_composition) lines.push('Maintain the original subject grouping, framing logic, and pose relationship from the input image.')
  return lines.length ? `\nOPTIMIZER CORRECTIONS:\n- ${lines.join('\n- ')}` : ''
}

function buildPreConstraintBlock(): string {
  return `
PRE-GENERATION CONSTRAINTS (APPLY BEFORE ANY STYLIZATION):
- Do not alter facial proportions in any way
- Do not add aging through lighting, texture, or shadow
- Do not compress, widen, or narrow the face
- Do not symmetrize the face — preserve natural asymmetry
- Do not exaggerate eyes beyond 18%
- Expression must match source exactly — preserve intensity, asymmetry, and emotional specificity
- Do NOT increase cheek volume or inflate the mid-face
- Skin tone must match source exactly — no lightening, darkening, or homogenizing
These constraints apply before any artistic or stylistic interpretation.
`
}

function buildIdentityInjection(features: Record<string, any>): string {
  if (!features?.face_shape) return ''
  return `
IDENTITY PROFILE (MANDATORY — DO NOT ALTER):
Age: ${features.age_range} | Face: ${features.face_shape} | Jaw: ${features.jaw_profile}
Eyes: ${features.eye_shape}, ${features.eye_size_ratio}, ${features.eye_spacing} spacing
Nose: ${features.nose_shape} | Mouth: ${features.mouth_shape} | Ears: ${features.ear_size}
Hair: ${features.hair_color}, ${features.hair_style} | Skin: ${features.skin_tone}
Distinct: ${features.distinct_features?.join(', ') || 'none'} | Expression: ${features.expression}
Clothing: ${features.clothing?.join(', ')} | Pose: ${features.pose} | Ground: ${features.ground_surface}
These features MUST be preserved exactly in the output.
`
}

function getMasterRule(): string {
  return `
MASTER RULE:
This is a stylized collectible of a REAL person (or real place/scene).
Identity must be immediately recognizable. Stylization enhances — it NEVER alters structure.
A parent must recognize their child instantly.
`
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export function buildFinalPrompt(
  config: MiniramaConfig,
  imageDescription: string,
  mode?: 'sports' | 'activity' | 'keychain',
  identityFeatures?: Record<string, any>,
  plaque?: PlaqueConfig
): string {
  const groundSurface = identityFeatures?.ground_surface || ''
  const baseTheme = config.style?.base_theme || 'match_environment'
  const marginPct = Math.round((config.composition?.margin_ratio || 0.18) * 100)
  const isPeopleSubject = ['single_person', 'couple', 'family'].includes(config.subject.type)

  if (mode === 'keychain') {
    return [
      getStyleLockBlock(),
      getMiniaturePerceptionLock(),
      getFrameFitBlock(marginPct),
      buildPreConstraintBlock(),
      identityFeatures ? buildIdentityInjection(identityFeatures) : '',
      honePeople(imageDescription, groundSurface, plaque, baseTheme),
      getMasterRule(),
      getFailureConditions(),
    ].filter(Boolean).join('\n').trim()
  }

  const subjectBlock = mode === 'sports' ? getSportsBlock()
    : mode === 'activity' ? getActivityBlock()
    : getSubjectBlock(config.subject.type)

  return [
    getStyleLockBlock(),
    getMiniaturePerceptionLock(),
    getFrameFitBlock(marginPct),
    subjectBlock,
    isPeopleSubject ? getExpressionLockBlock() : '',
    isPeopleSubject ? getSkinIdentityBlock() : '',
    isPeopleSubject ? getFaceVolumeBlock() : '',
    isPeopleSubject ? getEyeControlBlock() : '',
    isPeopleSubject ? getImperfectionBlock() : '',
    getBaseBlock(groundSurface, plaque, baseTheme),
    getEnvironmentBlock(config, imageDescription),
    buildTuningBlock(config.prompt_tuning),
    getFailureConditions(),
  ].filter(Boolean).join('\n').trim()
}

// ═══════════════════════════════════════════════════════════════════════════════
// HONE PEOPLE v4.1
// ═══════════════════════════════════════════════════════════════════════════════

function honePeople(
  imageDescription: string,
  groundSurface: string = '',
  plaque?: PlaqueConfig,
  baseTheme: BaseTheme = 'match_environment'
): string {
  return `
IDENTITY-PRESERVED STYLIZED MINIATURE — HONESCALE PEOPLE ENGINE v4.1
Identity always overrides stylization. Target: Pixar-adjacent realism. Not chibi. Not Funko Pop. Not anime.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. FACE GEOMETRY LOCK (HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Preserve: face height, jaw shape/taper, cheekbone position, temple width — all exactly.
Do not round, compress, widen, or narrow the face. Geometry overrides all stylization.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. FACIAL WIDTH LOCK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
No cheek compression, inward tapering, or V-shape narrowing.
Maintain eye-to-cheek distance and mid-face width exactly. Natural oval — not pinched.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. AGE LOCK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Preserve apparent age exactly. No wrinkles, sagging, under-eye shadows added.
No aging through texture or lighting. No de-aging. Exact age only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. EXPRESSION PRESERVATION (TOP-TIER — HIGH PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Preserve the subject's exact emotional expression from source — this is not "a nice expression".
This is THIS person at THIS exact moment.
- Match exact smile shape including asymmetry
- Preserve subtle smirk, hesitation, playfulness, shyness — whatever is present
- Maintain eye expression exactly: confidence, curiosity, mischief, joy
- Preserve cheek tension and mouth curvature precisely

FORBIDDEN: generic smile · neutralized expression · smoothed emotional features · averaged expression
If expression is more generic than source → incorrect

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. EXPRESSION INTENSITY LOCK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Exact emotional intensity — not softened. Preserve: cheek lift, eye squint, mouth corner pull/asymmetry, brow tension.
More generic than source → incorrect.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. HUMAN IMPERFECTION PRESERVATION (LIKENESS UNLOCK)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Do NOT symmetrize. Do NOT average or perfect the face.
Maintain: smile shape asymmetry, eye alignment variation, cheek structure, jaw contour.
Must feel like a SPECIFIC real person. Cleaner/more symmetrical than source → WRONG.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. EYE CONTROL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Enlarge 10-18% max. Preserve original shape — no circularization.
Preserve eyelid structure, fold, thickness, spacing. Forbidden: anime eyes · button eyes · >18%.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. MOUTH DETAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Exact mouth width, tooth visibility, lip curvature, natural asymmetry. No simplification or symmetrizing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. SKULL SCALING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scale skull volume uniformly. Do NOT alter internal facial proportions.
Head-to-body ratio: 1:2.6 to 1:2.8 (never exceed 1:2.5).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. FACE VOLUME CONTROL (ANTI-BALLOON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
No cheek volume increase. No mid-face inflation. Preserve bone structure and angularity.
Cheekbone width, jaw length, face height: all unchanged. Structure always wins.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. SKIN TONE & SURFACE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Match skin tone exactly. Preserve undertones and natural variation (freckles, marks, redness).
Glossy resin OVER correct skin tone. Not plastic, not flat, not generic.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. MATERIAL STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Full glossy resin: skin, hair, clothing, props. Clean rounded edges. Subtle specular highlights.
Eyes: deep glassy reflections. Premium collectible quality throughout.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
13. LIGHTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Soft, frontal, warm studio. Even facial illumination. No harsh contrast.
Minimize under-eye shadow. Subject looks alive and present — not tired or flat.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
14. MINIATURE PERCEPTION & COMPOSITION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Camera 35 degrees above, angled down — never eye-level.
Full figure head to toe. Full base visible with 18% margins all sides including bottom.
Entire figurine in sharp focus — no blur on miniature or base.
Background blur begins ONLY beyond base edge.
Macro product photography of a real physical collectible on a wooden surface.
Clear contact shadow under base — grounded, not floating.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15. FRAME FIT (NON-NEGOTIABLE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Entire base must be fully visible — no edge touching or crossing frame on any side.
If needed: pull camera back · reduce subject scale · increase field of view.
Cropping the base = incorrect. Shrinking the subject is preferred.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
16. BASE (NON-NEGOTIABLE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${getBaseBlock(groundSurface, plaque, baseTheme)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
17. STRICT CONSTRAINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
No keyring, chain, or attachment hardware. No scenery beyond base floor texture.
Clothing, accessories, props reproduced exactly as in source. Glossy finish mandatory.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MASTER RULE: Identity immediately recognizable. Stylization enhances — NEVER alters structure.
A parent must recognize their child instantly.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FAILURE CONDITIONS: Face symmetrized · Expression generic · Cheeks inflated · Base/plaque missing · Base cropped · Scene life-size · Any miniature blur
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCENE TO TRANSFORM:
${imageDescription}
`
}