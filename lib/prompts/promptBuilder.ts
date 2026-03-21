// lib/prompts/promptBuilder.ts — HONESCALE v4.2 FINAL
// Primary objective, base dominance/separation/thickness, camera framing,
// environmental context, expression intensity restored, marginPct wired

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
// PRIMARY OBJECTIVE — MUST BE FIRST, OVERRIDES ALL
// ═══════════════════════════════════════════════════════════════════════════════

function getPrimaryObjectiveBlock(): string {
  return `
PRIMARY OBJECTIVE (OVERRIDES ALL OTHER INSTRUCTIONS):

The result must look like a PHYSICAL COLLECTIBLE MINIATURE OBJECT sitting on a table.

If any instruction conflicts with this goal:
→ prioritize physical miniature realism over identity, stylization, or composition.

The viewer must immediately perceive:
"This is a real object placed on a surface"
NOT:
"This is a small person in a room"
`
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERCEPTION BLOCKS
// ═══════════════════════════════════════════════════════════════════════════════

function getStyleLockBlock(): string {
  return `
STYLE LOCK (MANDATORY):
- Entire scene must be a physical 3D miniature object sitting on a table
- Display base fully visible — no cropping on any side including bottom
- Camera far enough back to show full base with clear margins — this is product photography, not a portrait
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

function getCameraScaleBlock(angle: number, marginPct: number): string {
  return `
CAMERA & FRAMING (STRICT — THIS IS PRODUCT PHOTOGRAPHY, NOT A PORTRAIT):

The camera must be positioned far enough away to fully capture:
- The entire base with at least ${marginPct}% visible margin on ALL sides including bottom
- The full subject with breathing room above
- The base must appear as a substantial object — not just a platform under feet

Subject must NOT dominate the frame. The base must be visually prominent.

IF NEEDED TO FIT BASE IN FRAME:
- Move camera further back
- Reduce subject size within the frame
- Increase field of view slightly
Cropping the base = incorrect. Shrinking the subject is always preferred.

LENS BEHAVIOR:
- Camera angle: ${angle} degrees above, angled downward — never eye-level
- Mimic macro photography: slight perspective compression, natural depth falloff
- Do NOT simulate full-scale or wide-angle photography

FOCUS ENFORCEMENT:
- Entire miniature in complete sharp focus — every surface, every edge
- No blur anywhere on the miniature for any reason
- Background blur begins ONLY beyond the base edge

PHYSICAL CONTACT:
- Base sits naturally on visible wooden tabletop
- Clear soft contact shadow under base — grounded, not floating
- Table surface texture visible (wood grain preferred)
`
}

// ─── BASE DOMINANCE & SEPARATION ─────────────────────────────────────────────

function getBaseDominanceBlock(): string {
  return `
BASE DOMINANCE (CRITICAL):
The base must be visually prominent and clearly larger than the subject's footprint.
- Base must extend beyond the subject on all sides
- Subject must not fill or dominate the base — the subject sits ON it
- The base must feel like the PRIMARY OBJECT — not a platform that blends away

BASE SEPARATION (CRITICAL):
The base must be visually distinct from the table surface it rests on.
- Add a visible edge highlight or shadow line separating base from table
- Base must appear as a separate object placed on the table
- Do NOT allow base surface to visually merge with table surface material
- The walnut wood rim must read as a distinct defined edge

BASE THICKNESS ENFORCEMENT:
The base must clearly show visible vertical thickness from camera angle.
- Minimum 3/4 inch perceived visual thickness
- Routed or beveled edge profile clearly visible
- Specular highlight along edge to emphasize depth and form
- Thin or flat bases are NOT acceptable — must feel weighty and substantial
`
}

function getFailureConditions(): string {
  return `
FAILURE CONDITIONS (OUTPUT IS INCORRECT IF ANY OCCUR):
PRODUCT: Scene reads as life-size · Base cropped at any edge · Base blends into table · Base appears thin or flat · Subject dominates frame · Camera eye-level
IDENTITY: Face symmetrized · Expression generic · Cheeks inflated · Jaw shape changed · Skin tone shifted · Eyes >18%
BASE: Missing walnut plinth · Missing brass band · Missing brass plaque · Wrong ground texture · Room interior on base
PERCEPTION: Any miniature blur · Base floating · No contact shadow
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
ENVIRONMENTAL CONTEXT (SOURCE-LOCKED):
Base surface replicates source floor: ${ground}
- Enhance for presentation: cleaner, more intentional, slightly stylized — not generic flat wood
- Increase texture clarity and edge crispness
- Must feel curated, not accidental
- Do NOT replace with generic surface unless no source context exists
`
    case 'enhanced_environment':
      return `
ENVIRONMENTAL CONTEXT (ENHANCED):
Base surface: ${ground}
- Increase texture clarity and add subtle raised variation
- Add 1-2 contextually appropriate small objects placed intentionally at base edge
- Objects must feel like they belong — not random decoration
- Slightly more polished than real — premium miniature quality
`
    case 'play_scene':
      return `
ENVIRONMENTAL CONTEXT (PLAY SCENE — STORYTELLING):
Base surface: ${ground}
- Add small contextually appropriate props arranged with intention
  (e.g. toy truck, ball — matching subject's context from source image)
- Maximum 2-3 props, all miniature scale, purposefully positioned
- Must feel like a curated memory snapshot — not clutter
`
    case 'memory_scene':
      return `
ENVIRONMENTAL CONTEXT (MEMORY SCENE):
Base surface: ${ground}
- Slightly staged and curated — cleaner than reality, warmer than minimal
- May include subtle contextual detail (soft rug edge, single meaningful object)
- Feels like a preserved moment — thoughtful, not cluttered
`
    case 'minimal_premium':
      return `
ENVIRONMENTAL CONTEXT (MINIMAL PREMIUM):
Base surface: ${ground} — clean and polished
- No additional objects or props
- Maximum texture clarity
- Let the plaque and figurine carry all attention
- Gallery-quality restraint
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

  return `
DISPLAY BASE (NON-NEGOTIABLE — MISSING OR CROPPED BASE = FAILURE):

BASE PHYSICALITY (CRITICAL):
- Thick circular walnut wood plinth — minimum 3/4 inch visual thickness, must feel weighty
- High-gloss lacquer finish
- Routed edge profile clearly visible from camera angle
- Specular highlight along edge emphasizes depth — base must feel like a premium object
- Thin brass accent band around outer perimeter, flush and clean

BRASS PLAQUE (MANDATORY — missing = failure):
- Brushed brass engraved plate centered on front face of base
- Text clean, centered, legible: ${plaqueText}

${getBaseThemeInstructions(baseTheme, groundSurface)}

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
- Preserve natural variation: freckles, redness, birthmarks, dirt, marks — do NOT remove
- Do NOT homogenize or "perfect" the skin
- Glossy resin finish applied OVER correct skin tone — skin retains correct color beneath finish
- Not plastic, not flat — recognizably this person's skin
`
}

function getFaceVolumeBlock(): string {
  return `
FACE VOLUME CONTROL (ANTI-BALLOON — MANDATORY):
- Do NOT increase cheek volume or inflate the mid-face
- Preserve natural bone structure and subtle angularity exactly
- Cheekbone width: unchanged · Jaw length: unchanged · Face height: unchanged
- Mid-face volume: unchanged — no inflation allowed
- If ANY stylization conflicts with facial structure → structure wins, always
`
}

function getEyeControlBlock(): string {
  return `
EYE CONTROL (STYLIZED BUT CONTROLLED):
- Eyes may be slightly enlarged for collectible appeal — 10–18% maximum only
- Enlargement must preserve original eye SHAPE exactly — no circularization
- Preserve eyelid structure, fold, and thickness exactly
- Maintain original eye spacing — do not widen or narrow
- Iris clarity may be enhanced, iris size must remain proportional

FORBIDDEN: anime enlargement · round button eyes · eyelid loss · spacing changes · >18% enlargement
`
}

function getImperfectionBlock(): string {
  return `
HUMAN IMPERFECTION PRESERVATION (LIKENESS UNLOCK — CRITICAL):
- Preserve natural asymmetry in the face — do NOT symmetrize
- Do NOT average or "perfect" the face in any way
- Maintain subtle irregularities in:
  - smile shape (one side may pull higher — preserve it)
  - eye alignment (slight height difference — preserve it)
  - cheek structure (natural side-to-side variation — preserve it)
  - jaw contour (natural taper or asymmetry — preserve it)
- The subject must feel like a SPECIFIC real person, not an idealized version
- If the face looks cleaner or more symmetrical than the source → it is WRONG
`
}

function getExpressionLockBlock(): string {
  return `
EXPRESSION PRESERVATION (HIGH PRIORITY — TOP-TIER RULE):
The subject's exact emotional expression MUST be preserved from the source image.
This is not "a nice expression" — this is THIS person at THIS exact moment.

- Match exact smile shape including any asymmetry
- Preserve subtle smirk, hesitation, playfulness, shyness, confidence — whatever is present
- Maintain eye expression exactly: confidence, curiosity, mischief, joy
- Preserve cheek tension and mouth curvature precisely

FORBIDDEN: generic pleasant smile · neutralized expression · smoothed emotional features · averaged expression
If expression is more generic than source → it is incorrect
`
}

function getExpressionIntensityBlock(): string {
  return `
EXPRESSION INTENSITY LOCK:
- Capture the exact emotional intensity of the original expression — not a softened version
- Preserve micro-expression details:
  - cheek lift height and asymmetry
  - degree of eye squint or openness
  - mouth tension, corner pull, and asymmetry
  - brow position and tension
- Do NOT replace with a generic smile
- Do NOT soften, neutralize, or average the expression
- Do NOT smooth away the energy of the face
- If expression becomes more generic than source → it is incorrect
`
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBJECT BLOCKS
// ═══════════════════════════════════════════════════════════════════════════════

function getPeopleBlock(): string {
  return `
SUBJECT TRANSFORMATION (PEOPLE):
Convert person into a collectible miniature figurine.
Preserve exact facial identity, proportions, and expression.
NO stylization in facial geometry, proportions, or expression.
MATERIAL: Satin-to-semi-gloss resin. Skin tone matches source exactly. No flat matte, no plastic toy appearance.
IDENTITY: Exact features, proportions, expression, hair color, clothing reproduced exactly.
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
  const marginPct = Math.round((config.composition?.margin_ratio || 0.18) * 100)
  const material = humanize(config.style.material_style || 'painted_resin')
  const lighting = humanize(config.style.lighting_style || 'warm_studio')
  const background = humanize(config.style.background_style || 'blurred_home')
  const detail = humanize(config.detail.level || 'high')

  return `
MATERIALS: ${material} — realistic physical surface qualities, premium collectible craftsmanship.

${getCameraScaleBlock(angle, marginPct)}

LIGHTING: ${lighting} — coherent shadow logic, soft highlights, realistic reflections.
Highlight targets: roof/top surfaces, windows, glossy surfaces, foreground elements.
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
      getPrimaryObjectiveBlock(),
      getStyleLockBlock(),
      getMiniaturePerceptionLock(),
      getBaseDominanceBlock(),
      buildPreConstraintBlock(),
      identityFeatures ? buildIdentityInjection(identityFeatures) : '',
      honePeople(imageDescription, groundSurface, plaque, baseTheme, marginPct),
      getMasterRule(),
      getFailureConditions(),
    ].filter(Boolean).join('\n').trim()
  }

  const subjectBlock = mode === 'sports' ? getSportsBlock()
    : mode === 'activity' ? getActivityBlock()
    : getSubjectBlock(config.subject.type)

  return [
    getPrimaryObjectiveBlock(),
    getStyleLockBlock(),
    getMiniaturePerceptionLock(),
    getBaseDominanceBlock(),
    subjectBlock,
    isPeopleSubject ? getExpressionLockBlock() : '',
    isPeopleSubject ? getExpressionIntensityBlock() : '',
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
// HONE PEOPLE v4.2 FINAL
// ═══════════════════════════════════════════════════════════════════════════════

function honePeople(
  imageDescription: string,
  groundSurface: string = '',
  plaque?: PlaqueConfig,
  baseTheme: BaseTheme = 'match_environment',
  marginPct: number = 18
): string {
  return `
PHYSICAL COLLECTIBLE MINIATURE — HONESCALE PEOPLE ENGINE v4.2
The result must read as a REAL PHYSICAL OBJECT on a table — not a person in a room.
Identity always overrides stylization. Target: Pixar-adjacent realism. Not chibi. Not Funko Pop. Not anime.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
0. PRIMARY OBJECTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is a PHYSICAL COLLECTIBLE MINIATURE OBJECT sitting on a table.
The base is the primary object. The figurine sits on it.
Camera must be far enough back to show the full base with ${marginPct}% clear margins on all sides.
Subject must NOT dominate the frame.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. FACE GEOMETRY LOCK (HIGHEST PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Preserve: face height, jaw shape/taper, cheekbone position, temple width — all exactly.
Do not round, compress, widen, or narrow the face. Geometry overrides all stylization.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. FACIAL WIDTH LOCK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
No cheek compression, inward tapering, or V-shape narrowing.
Maintain eye-to-cheek distance and mid-face width exactly. Natural oval — not pinched, not rounded.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. AGE LOCK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Preserve apparent age exactly. No wrinkles, sagging, under-eye shadows added.
No aging through texture or lighting. No de-aging. Exact age only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. EXPRESSION PRESERVATION (HIGH PRIORITY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This is not "a nice expression" — this is THIS person at THIS exact moment.
- Match exact smile shape including any asymmetry
- Preserve subtle smirk, hesitation, playfulness, shyness, confidence — whatever is present
- Maintain eye expression: squint level, openness, emotional tone
- Preserve cheek tension and mouth curvature precisely

EXPRESSION INTENSITY:
- Capture exact emotional intensity — not a softened version
- Preserve micro-details: cheek lift height, eye squint degree, mouth corner pull and asymmetry, brow tension
- Do NOT soften, neutralize, or average the expression
- Do NOT smooth away the energy of the face

FORBIDDEN: generic smile · neutralized expression · smoothed features · averaged expression
More generic than source → incorrect

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. HUMAN IMPERFECTION PRESERVATION (LIKENESS UNLOCK)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Do NOT symmetrize. Do NOT average or perfect the face.
Maintain natural irregularities: smile shape, eye alignment, cheek structure, jaw contour.
Must feel like a SPECIFIC real person. Cleaner/more symmetrical than source → WRONG.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. EYE CONTROL (CONTROLLED STYLIZATION)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Enlarge 10-18% max for collectible appeal. Preserve original eye SHAPE — no circularization.
Preserve eyelid structure, fold, thickness, and spacing exactly.
Iris clarity may be enhanced — size must remain proportional.
FORBIDDEN: anime enlargement · round button eyes · eyelid loss · spacing changes · >18%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. MOUTH DETAIL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Maintain exact mouth width, tooth visibility, lip curvature, and natural asymmetry.
Do not simplify or symmetrize. Smile must match source precisely.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. SKULL SCALING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scale skull volume uniformly — do NOT alter internal facial proportions.
Head-to-body ratio: 1:2.6 to 1:2.8 (never exceed 1:2.5).
More skull area = more canvas for facial detail — use it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
9. FACE VOLUME CONTROL (ANTI-BALLOON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
No cheek volume increase. No mid-face inflation. Preserve bone structure and angularity.
Cheekbone width, jaw length, face height: all unchanged from source. Structure always wins.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
10. SKIN TONE & SURFACE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Match skin tone exactly from source. Preserve undertones (warm/cool/neutral).
Preserve natural variation: freckles, redness, marks, dirt — do NOT remove or homogenize.
Glossy resin finish OVER correct skin tone — skin retains correct color beneath.
Not plastic, not flat, not generic — recognizably this person's skin.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
11. MATERIAL STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Full glossy resin: skin, hair, clothing, props. Clean slightly rounded edges.
Subtle specular highlights — strong but not plastic-looking.
Eyes: deep glassy reflections. Premium collectible quality throughout.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
12. LIGHTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Soft, frontal, warm studio lighting. Even facial illumination — no harsh directional contrast.
Minimize under-eye shadow — do NOT create tired or sunken eyes.
Lighting makes the subject look alive and present, not tired or flat.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
13. BASE (NON-NEGOTIABLE — PRIMARY OBJECT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${getBaseBlock(groundSurface, plaque, baseTheme)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
14. BASE DOMINANCE & SEPARATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${getBaseDominanceBlock()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15. CAMERA & FRAMING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${getCameraScaleBlock(35, marginPct)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
16. STRICT CONSTRAINTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
No keyring, chain, or attachment hardware. No scenery beyond base floor.
Clothing, accessories, props reproduced exactly as in source. Glossy finish mandatory.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MASTER RULE: Identity immediately recognizable. Stylization enhances — NEVER alters structure.
A parent must recognize their child instantly.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FAILURE CONDITIONS: Face symmetrized · Expression generic · Cheeks inflated · Base cropped · Base blends into table · Base thin/flat · Subject dominates frame · Scene reads life-size · Any miniature blur
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCENE TO TRANSFORM:
${imageDescription}
`
}