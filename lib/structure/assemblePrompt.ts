// lib/structure/assemblePrompt.ts
// Destination: lib/structure/assemblePrompt.ts
//
// Assembles the final generation prompt.
// NO architectural descriptions in prompt text.
// Source image(s) ARE the structural reference — prompt controls style + constraints only.

import { AnchorBlueprint } from './extractBlueprint'

// ── VARIATION TYPES ───────────────────────────────────────────────────────────
// All user-facing variation controls live here.
// These are the ONLY things a user can change between variations.
// Structure, proportions, identity, and silhouette are never affected.

export type LandscapeStyle   = 'cottage' | 'manicured' | 'natural' | 'minimal'
export type LandscapeSeason  = 'spring' | 'summer' | 'fall' | 'winter'
export type LandscapeDensity = 'low' | 'medium' | 'lush'
export type LightingMood     = 'warm_studio' | 'golden_hour' | 'soft_daylight' | 'evening_cozy'
export type BaseStyle        = 'dark_walnut' | 'matte_black' | 'light_wood'
export type ContextSetting   = 'living_room' | 'studio_neutral' | 'library_desk' | 'soft_interior'

// LandscapeParams preserved for backwards compat — VariationParams is the canonical shape
export interface LandscapeParams {
  style?:   LandscapeStyle
  season?:  LandscapeSeason
  density?: LandscapeDensity
}

export interface VariationParams {
  // Landscaping
  landscape_style?:   LandscapeStyle    // cottage | manicured | natural | minimal
  season?:            LandscapeSeason   // spring | summer | fall | winter
  density?:           LandscapeDensity  // low | medium | lush (optional power-user param)
  // Lighting
  lighting?:          LightingMood      // warm_studio | golden_hour | soft_daylight | evening_cozy
  // Base
  base?:              BaseStyle         // dark_walnut | matte_black | light_wood
  // Environment
  context?:           ContextSetting    // living_room | studio_neutral | library_desk | soft_interior
}

export interface AssembleOptions {
  blueprint:       AnchorBlueprint
  patch?:          string
  styleReference?: string
  model:           'gpt-image-1' | 'dall-e-3'
  // Both accepted — variation supersedes landscape if both present
  variation?:      VariationParams
  landscape?:      LandscapeParams      // legacy, mapped internally to VariationParams
  // Prompt assembly mode — defaults to 'architecture' (strict)
  mode?:           'architecture' | 'architecture_interpretive' | 'architecture_scene'
}

// ── PRESET VARIATIONS ─────────────────────────────────────────────────────────
// Three ready-made presets for the "Generate 3 Variations" button.
// Each produces a visually distinct result from the same structure.

export const VARIATION_PRESETS: Record<string, VariationParams> = {
  spring_cottage: {
    landscape_style: 'cottage',
    season:          'spring',
    density:         'lush',
    lighting:        'warm_studio',
    base:            'dark_walnut',
    context:         'living_room',
  },
  fall_natural: {
    landscape_style: 'natural',
    season:          'fall',
    density:         'medium',
    lighting:        'golden_hour',
    base:            'dark_walnut',
    context:         'soft_interior',
  },
  minimal_studio: {
    landscape_style: 'minimal',
    season:          'summer',
    density:         'low',
    lighting:        'soft_daylight',
    base:            'matte_black',
    context:         'studio_neutral',
  },
}

// Helper: produce three AssembleOptions sets ready to pass to assemblePrompt()
export function buildVariationSet(
  base: Omit<AssembleOptions, 'variation'>
): AssembleOptions[] {
  return Object.values(VARIATION_PRESETS).map(preset => ({
    ...base,
    variation: preset,
  }))
}

// ── 0. MASTER INTENT ─────────────────────────────────────────────────────────
// Goal frame. Read first. Establishes what the output IS and what it is NOT.
// This overrides any default model behavior toward renders, toys, or stylized art.

function getMasterIntent(): string {
  return `Create a highly realistic handcrafted miniature diorama based on the provided image.

CORE GOAL:
A premium product-style photograph of a miniature with strong, directional lighting, high contrast, and clear physical presence.
The output must look like a real, professionally photographed miniature — not a render, not soft, not stylized.

LIGHTING IS THE PRIMARY DRIVER:
Single dominant key light from upper-left (10 o'clock position — upper-left, slightly more left than up).
This direction is ABSOLUTE — do NOT inherit the source photo's lighting. Build from scratch.
Strong and directional. High contrast. Reduced fill. Shadows visibly darker.

SURFACE BRIGHTNESS MAP — APPLY EXACTLY:
- LEFT exterior wall: BRIGHTEST wall surface — direct key light, warm highlights
- LEFT roof plane: BRIGHTEST surface in scene — near specular limit, high contrast
- LEFT chimney face: bright direct highlight
- FRONT wall: moderately lit — intermediate
- RIGHT exterior wall: IN SHADOW — clearly darker than left, texture still readable
- RIGHT roof plane: IN SHADOW — significantly darker than left roof
- Interior recesses (eaves, porch roof, window depths): deepest shadow areas
If any surface deviates from this map, the lighting is WRONG.

NO PINK CONTENT IN DIORAMA:
Hot pink (#FF69B4) exists ONLY as the flat background fill.
No pink, magenta, rose, or warm-red blob or patch may appear on any diorama surface.

FAIL CONDITIONS — generation is rejected if ANY of these are true:
- Flat, soft, or low-contrast lighting
- Evenly lit surfaces — no visible highlight-to-shadow separation
- Matte or dull material response with no specular highlights
- Weak or missing specular highlights on edges, trim, or base rim
- Warped, bent, or distorted geometry
- House fills base with little visible land
- Base cropped or not fully visible
- Object appears grounded to a table, desk, or any surface
- Any table, desk, floor, or ground plane visible
- Any cast shadow beyond the base footprint
- Any reflection below the base
- Any pink/magenta blob on diorama content`
}

// ── 0b. VARIATION LOCK ────────────────────────────────────────────────────────
// Only present when variation params are set.
// Placed immediately after master intent so the model understands
// the constraint boundary BEFORE reading any variation instruction.

function getVariationLock(v: VariationParams): string {
  const targets: string[] = []
  if (v.landscape_style) targets.push(`Landscaping style: ${v.landscape_style}`)
  if (v.season)          targets.push(`Season: ${v.season}`)
  if (v.density)         targets.push(`Planting density: ${v.density}`)
  if (v.base)            targets.push(`Base material: ${v.base.replace(/_/g, ' ')}`)
  if (v.context)         targets.push(`Environment context: ${v.context.replace(/_/g, ' ')}`)
  // NOTE: lighting is intentionally excluded — lighting direction is set by master prompt only
  return `VARIATION LAYER — CONTROLLED OUTPUT

Apply variation ONLY to the following elements:
${targets.map(t => `- ${t}`).join('\n')}

STRUCTURE LOCK — DO NOT CHANGE:
- Structure, layout, and architectural features remain exactly as in source
- Proportions and silhouette remain unchanged
- No architectural elements removed or simplified

IDENTITY LOCK (if people present):
- Facial features, age, and likeness remain accurate
- Only slight surface stylization appropriate for a collectible figure

CONSISTENCY RULE:
This variation must look like the same diorama photographed under different conditions.
NOT a different interpretation of the same subject.
If variation causes structural drift, reject and regenerate.`
}

// ── 1. CORE CONSTRAINTS ───────────────────────────────────────────────────────

function getCoreConstraints(): string {
  return `THE OUTPUT IS A SINGLE PHYSICAL OBJECT — a miniature diorama collectible.

This object has one identity, not three parts:
- It is a circular wooden display base
- covered in landscaped land with grass, paths, and garden plantings
- with a scale model of the source building sitting on that land

The source photo provides the building's identity. The base and landscaping are not optional additions — they are the same object. A diorama without its base and landscaping is not a diorama, it is a failed render.

USE THE SOURCE IMAGE FOR:
- Building geometry, proportions, roof shape, facade details
- Material colors and character
- Architectural identity

DO NOT USE THE SOURCE IMAGE FOR:
- The base — always circular, dark walnut, substantial
- The landscaping — always full, rich, extending to base edge
- The background — always solid hot pink #FF69B4, used for compositing`
}

// ── 2. SPATIAL PRESERVATION ───────────────────────────────────────────────────

function getSpatialPreservation(): string {
  return `STRUCTURAL IDENTITY PRESERVATION:

The building's geometry from the source must be preserved:
- Roof shape, pitch, and complexity
- Facade layout, window positions, asymmetry
- Projections, porches, extensions
- Material character and colors

The building sits ON the base — centered or slightly back, with land visible on all sides.
The building footprint is 50–65% of the base diameter — never more.
The remaining base surface is land, landscaping, and open ground.

This is the identity of the collectible object — the building is recognizable,
the land is generous, and the base is the foundation of the whole thing.`
}

// ── 3. NO INVENTION — ARCHITECTURE ONLY ──────────────────────────────────────
// Applies to structural/architectural elements only.
// Landscape design is handled separately and IS allowed to add compositional elements.

function getNoInvention(): string {
  return `NO ARCHITECTURAL INVENTION (HARD RULE):

Only reproduce architectural elements that are clearly visible in the source image.

Do NOT add:
- Extra windows, dormers, or rooflines not in source
- Porches, extensions, or structural features not present
- Decorative trim, ornaments, or façade details not visible
- Additional stories or massing changes

Landscape and ground cover elements (paths, planting, grass) are governed by the
LANDSCAPE DESIGN block — they follow a separate set of rules.

Architectural source fidelity is non-negotiable. The structure must match.`
}

// ── 4. MULTI-IMAGE CONTROL ────────────────────────────────────────────────────

function getMultiImageControl(blueprint: AnchorBlueprint): string {
  const viewCount = (blueprint as any).source_image_count || 1
  if (viewCount < 2) return ''
  return `MULTI-IMAGE INSTRUCTION:

You have been provided ${viewCount} source images of the same subject from different angles.

- Image 1 is the PRIMARY reference — use its composition and camera angle
- Images 2+ are SUPPLEMENTAL — use only to resolve structural ambiguity
- Do not blend camera angles
- Do not average appearances across images
- Composition must match Image 1 exactly`
}

// ── 5. DIORAMA STYLE ──────────────────────────────────────────────────────────

const BASE_STYLE_GUIDE: Record<BaseStyle, string> = {
  dark_walnut:  'dark walnut wood — rich grain, warm brown tones, premium gloss finish, classic collectible look',
  matte_black:  'matte black lacquer — clean and modern, no visible grain, architectural feel, slight sheen at rim',
  light_wood:   'light natural wood — pale ash or maple tone, fine grain visible, Scandinavian minimal character',
}

const CONTEXT_GUIDE: Record<ContextSetting, string> = {
  living_room:    'warm living room — softly blurred sofa and cushions in background, warm ambient light from room lighting',
  studio_neutral: 'clean neutral studio — seamless light grey background, even diffuse lighting, pure product photography setting',
  library_desk:   'library or study desk — blurred bookshelves and desk lamp in background, warm focused light',
  soft_interior:  'soft home interior — blurred warm walls and furnishings, diffused window light, inviting domestic setting',
}

const LIGHTING_GUIDE: Record<LightingMood, string> = {
  warm_studio:   'strong directional sunlight from upper-left, bright highlights on all top and left-facing surfaces, deep shadows on right side, high contrast, semi-gloss surfaces glistening',
  golden_hour:   'strong warm golden sunlight from upper-left at low angle, dramatic long shadows extending right, bright amber highlights on all top surfaces, vivid saturated colours',
  soft_daylight: 'strong overhead daylight slightly from left, clear highlight and shadow separation, bright even illumination, crisp surface detail',
  evening_cozy:  'strong warm directional interior light from upper-left, bright highlights on lit faces, deep warm shadows, glowing window light, high contrast',
}

function getDioramaStyle(v: VariationParams = {}): string {
  const base = v.base ?? 'dark_walnut'

  return `LIGHTING REQUIREMENTS:
- Light source is fixed at the 10 o'clock position — upper-left, slightly more left than up
- This is an ABSOLUTE direction — do NOT match or inherit the source photo's lighting
- Bright warm highlights on all surfaces facing 10 o'clock: upper-left walls, left roof planes, left chimney face
- Deep shadows on all surfaces facing away: right walls, right roof planes, lower-right base
- Strong contrast between lit and shadow faces — high separation, not gradient
- Surfaces look sun-drenched with warm golden light from that fixed direction
- Highlights bright enough to create visible sparkle on edges

SHADOW DEPTH — PRODUCT LIGHTING RULES:
Fill light is reduced significantly. Shadows must be clearly darker than lit surfaces.
- Do NOT flatten shadows with heavy ambient fill
- Do NOT add soft "natural room lighting" that equalises all faces
- Shadow faces should read at 25–45% of lit face brightness — visibly darker, not black
- Interior shadows (under eaves, porch roof, window recesses) must be clearly deeper than exterior walls
- Right wall and shadow faces retain readable material texture — but they ARE in shadow
- Black crush is the ONLY exception: avoid absolute black (0,0,0) — keep a hint of texture visible
FORBIDDEN: flat lighting · evenly lit surfaces · heavy ambient fill · washed-out contrast

SURFACE CONTRAST CHECK — USE SHADOW DIRECTION, NOT WALL BRIGHTNESS:
Wall brightness comparisons break for white or pale-sided houses where material color dominates.
Instead, verify lighting direction by shadow position:
- The chimney's shadow must fall to the RIGHT — if it falls left or directly down, lighting is wrong
- Eave shadows must fall to the RIGHT side of walls below them
- The left roof plane and left chimney face must be the brightest surfaces in the scene
- Any window trim on the LEFT side catches a bright highlight — RIGHT side trim is in shade
These checks hold regardless of siding color or material.

EDGE SPECULAR — RESIN FINISH (MANDATORY):
- Every structural edge catches a sharp highlight line — rooflines, window frames, door frames, wall corners, chimney edges, base rim
- These edge highlights must be bright white or near-white — clearly visible
- Surfaces between edges have a semi-gloss sheen that catches the sun
- The overall material feel is hand-painted lacquered resin — premium collectible
- Edges glisten and separate the form — like sunlight catching the rim of a painted ceramic

SPECULAR HIGHLIGHTS — REQUIRED:
- Allow highlights to approach brightness limits on lit edges — do not suppress specular response
- Roof ridges, trim, porch columns, and base rim must catch bright near-white highlights
- Visible specular response is a pass/fail condition — missing highlights = rejected output
- Depth of field: diorama entirely sharp and detailed, background softly blurred

INTERIOR LIGHTING (SUBTLE):
- Add a mild warm amber glow in a FEW windows only — not all windows
- Keep subtle and believable — a hint of warmth, not a lit-up toy store
- Porch interior and covered areas: dark, not glowing
- Windows on shadow side of house: no glow or very faint only
- Windows on lit side: one or two may show soft warm light behind glass

WINDOWS — MATERIAL:
- Window frames catch the 10 o'clock highlight on their left/upper edges
- Glass surface has subtle reflectivity — not fully transparent, not fully opaque

STRUCTURE:
- Preserve the architectural identity of the source image
- Straight vertical lines — absolutely no warping, bending, or lens distortion
- No wide-angle or macro distortion
- Clean, physically believable geometry

COMPOSITION:
- The building occupies only 55–65% of the base diameter
- The remaining area is visible yard and landscaping
- Clear open space around the structure — never crowded to edges
- The diorama must feel like a complete property, not just a house

LANDSCAPING:
- Fully designed and intentional — not random
- Grass, shrubs, and path clearly visible
- A defined path leads from the entrance to the base edge
- Layered depth: foreground low plants, midground lawn, background taller shrubs and trees
- The yard must feel livable, like a miniature world

BASE:
- ${BASE_STYLE_GUIDE[base]}
- Thick circular dark walnut display base, fully visible — never cropped
- Subtle gloss on wood catching light

STAGE 1 ISOLATION RULES — NON-NEGOTIABLE:
This image is Stage 1 of a pipeline. The SYSTEM adds shadows and reflections later.
The AI must NOT add them here — they will conflict with the system's compositing.
- NO shadow cast onto any surface beyond the base itself
- NO ground plane, table surface, desk, or floor
- NO reflection of the diorama in any surface
- NO environmental context (room, interior, outdoor scene)
- NO ambient occlusion shadow spreading outward from the base
The base sits in void. The only lighting is on the object itself.

CAMERA:
- 35° downward product photography angle
- Natural perspective — no distortion
- Entire diorama in sharp focus
- If the structure is complex, pull the camera back further rather than distorting geometry
- A smaller accurate model is always preferred over a larger warped one
- The complete base rim must be visible with breathing room on all sides

BACKGROUND — STAGE 1 COMPOSITING KEY:
- Background color must be EXACTLY #FF69B4 (hot pink) — solid, flat, no gradient, no variation
- This color is a compositing key — the system removes it in Stage 2
- Hot pink is BACKGROUND ONLY — no pink, magenta, or rose blobs may appear on any diorama surface
- No environment, no room, no table, no floor, no shadow on background
- Edges must be razor clean — no feathering, no glow, no semi-transparent fringe

FAIL CONDITIONS (generation is rejected if any of these are true):
- Any table, desk, floor, or ground plane is visible
- Any cast shadow appears beyond the base footprint
- Any reflection appears below the base
- The base is cropped or partially cut off
- The background is anything other than solid flat #FF69B4`
}

// ── 6. ANCHOR LOCK ────────────────────────────────────────────────────────────

function buildAnchorLock(blueprint: AnchorBlueprint): string {
  const structureAnchors = blueprint.anchors.filter(a => a.type === 'structure')
  if (structureAnchors.length === 0) return ''

  const lines = structureAnchors
    .sort((a, b) => b.importance - a.importance)
    .map(a => `- [importance: ${a.importance}] ${a.description}`)

  return `STRUCTURAL IDENTITY (preserve all of these features):

${lines.join('\n')}

FRAMING RULE:
If the structure is complex and all features cannot fit without distortion,
pull the camera back or reduce the scale of the building on the base.
Never warp or distort geometry to fit the frame.
A slightly smaller but accurate model is always better than a larger distorted one.
The entire diorama — base rim to rooftop — must be fully visible with breathing room.`
}

// ── 7. LANDSCAPE DESIGN ───────────────────────────────────────────────────────

function getLandscapeDesign(v: VariationParams = {}): string {
  const style   = v.landscape_style ?? 'manicured'
  const season  = v.season          ?? 'summer'
  const density = v.density         ?? 'medium'

  // ── Style vocabulary ──────────────────────────────────────────────────────
  const styleGuide: Record<LandscapeStyle, string> = {
    cottage:   'informal and romantic — mixed flower beds, climbing plants near the structure, irregular borders, soft edges, cottage garden planting with visible bloom color',
    manicured: 'clean and composed — trimmed hedges, defined bed edges, uniform lawn surface, symmetrical foundation planting, tidy stone or brick path',
    natural:   'relaxed and organic — native-style planting, irregular bed shapes, grasses mixed with shrubs, no rigid geometry, naturalistic rather than designed',
    minimal:   'restrained and architectural — very few plant species, generous negative space, low ground cover, precise placement, stone or gravel surfaces prominent',
  }

  // ── Season vocabulary ─────────────────────────────────────────────────────
  const seasonGuide: Record<LandscapeSeason, string> = {
    spring: 'fresh lime greens, early blooms in pink and white, light new foliage on trees, some bare branches still visible, soft morning light quality',
    summer: 'deep saturated greens, full canopy on all trees, dense ground cover, warm golden lighting, flowers at peak bloom',
    fall:   'amber and rust foliage on deciduous trees, some leaf drop on ground, muted greens on evergreens, warm raking light angle',
    winter: 'bare deciduous branches, evergreens as dominant green, frost or light snow texture optional on surfaces, cool neutral light',
  }

  // ── Density vocabulary ────────────────────────────────────────────────────
  const densityGuide: Record<LandscapeDensity, string> = {
    low:    'sparse and airy — significant negative space between plants, ground cover visible between specimens, open lawn areas dominant',
    medium: 'balanced — foundation planting fills structure perimeter, open lawn in mid-ground, trees as accents without crowding the structure',
    lush:   'full and abundant — dense layered planting, foundation shrubs spill slightly outward, trees frame the structure, minimal bare ground visible',
  }

  return `LANDSCAPE DESIGN (DESIGNED, NOT RANDOM):

Landscaping must read as intentionally designed — not scattered or generic.
Every plant placement must serve a compositional purpose.

STYLE: ${style}
${styleGuide[style]}

SEASON: ${season}
${seasonGuide[season]}

DENSITY: ${density}
${densityGuide[density]}

COMPOSITIONAL RULES (MANDATORY):

LAYERING — three distinct depth zones required:
- Foreground (base edge to 25% inward): low ground cover, small accent plants, path edge detail
- Midground (25–65% inward): primary lawn surface, foundation shrubs, bed groupings
- Background (65%+ inward, against structure): taller shrubs, small specimen trees, climbing elements if cottage style

ENTRY PATH:
- A defined path must lead from the front base edge toward the structure entrance
- Path material must match the architectural character: stone pavers for cottage/natural, brick for manicured, gravel for minimal
- Path must be legible — not obscured by planting on both sides

PLANT CLUSTERING:
- Plants must appear in intentional clusters of 3–5 specimens, not evenly spaced rows
- Mix at least two size classes within each cluster (taller specimen + lower groundcover)
- Vary species silhouette within clusters — round mounds next to upright forms
- Foundation planting hugs the building base — no bare soil visible at structure edges

WHAT TO AVOID:
- Evenly spaced individual shrubs along the foundation
- Flat unbroken lawn with no ground variation
- Random dot-pattern plant placement
- Identical plant clones repeated at regular intervals
- Empty corners of the base with no planting interest

All landscaping confined to the diorama base. No element extends beyond the base edge.`
}

// ── 8. ANTI-DRIFT ─────────────────────────────────────────────────────────────

function getAntiDrift(): string {
  return `DO NOT:
- Generate a generic or idealized version of this structure
- Substitute familiar architectural templates
- Simplify asymmetric elements for visual cleanliness
- Prioritize aesthetics over structural accuracy
- Ignore the orientation of elements visible in the source image
- Add or complete elements not clearly present in the source

The source image is ground truth. Match it exactly.`
}

// ── PATCH ENFORCEMENT ─────────────────────────────────────────────────────────

function wrapPatchWithEnforcement(patch: string): string {
  return `PATCH CORRECTIONS — APPLY EXACTLY AS SPECIFIED:

Each instruction below is a required geometric correction.
Do NOT partially apply any correction.
Do NOT approximate (e.g. "slightly wrap" is not acceptable if "fully wrap" is specified).
Do NOT skip any instruction.
Do NOT introduce new elements not present in the source image.
Each correction must be clearly visible in the output.

${patch}`
}

// ══════════════════════════════════════════════════════════════════════════════
// ARCHITECTURE INTERPRETIVE MODE
// ══════════════════════════════════════════════════════════════════════════════
//
// A parallel prompt assembly path. The original architecture blocks above are
// UNCHANGED. This mode uses entirely separate functions (suffix _i).
//
// Priority shift:
//   architecture          → strict replication, source is ground truth
//   architecture_interpretive → identity preserved, composition controlled,
//                               beauty required, details guided not locked
//
// Nothing below modifies pipeline, scoring, iteration, or API calls.
// It only changes what text is assembled into the generation prompt.

// ── I-0. MASTER INTENT (interpretive) ────────────────────────────────────────

function getMasterIntent_i(): string {
  return `MINIRAMA — INTERPRETIVE ARCHITECTURE MODE

GOAL:
Transform the source image into a premium handcrafted miniature model
photographed for display or sale.

This is NOT a strict miniature reconstruction.
This is a PRODUCT — a beautiful, physical, collectible object.

PRIORITY ORDER:
1. Identity — the building must be recognisable as the source
2. Composition — the diorama must feel balanced and intentional
3. Quality — every surface must feel handcrafted and premium
4. Beauty — the result must be desirable as a collectible object

THE SUBJECT:
The entire diorama — base + landscaping + structure — is the subject.
The building is one component of the composition, not the whole thing.

OUTPUT TARGET:
A premium handcrafted miniature model photographed for display or sale.
NOT a literal scaled-down reconstruction of a building.`
}

// ── I-1. IDENTITY GUIDANCE (interpretive) ────────────────────────────────────
// Replaces strict preservation with guided identity.

function getIdentityGuidance_i(): string {
  return `ARCHITECTURAL IDENTITY — PRESERVE AND GUIDE:

From the source image, extract and preserve:
- Overall silhouette and roofline character
- Major massing relationships (main block, wings, extensions)
- Porch or entry feature placement and approximate scale
- Facade rhythm — window spacing and repetition pattern
- Architectural style character (Victorian, cottage, craftsman, colonial, etc.)
- Material tone (painted wood, brick, aged, bright, weathered)
- Emotional feel (cozy, stately, worn, inviting, grand)

WHAT THIS MEANS IN PRACTICE:
- The building must be recognisable as the source structure
- Major forms (rooflines, massing, porch placement) must read correctly
- Fine details may be simplified for clarity at miniature scale
- Proportions may be refined slightly if it improves the composition
- Asymmetry is preserved where it defines the character of the building

CONTROLLED SIMPLIFICATION (allowed):
- Simplify fine surface details when they would read as noise at scale
- Consolidate minor window variations into a consistent rhythm
- Smooth minor irregularities that don't affect identity

NOT ALLOWED:
- Do not invent major structural elements not present in source
- Do not change the building type or style
- Do not remove defining features (porch, tower, bay window, etc.)
- Do not symmetrise an asymmetric building

Prioritise overall silhouette and architectural rhythm over exact replication of every element.`
}

// ── I-2. COMPOSITION CONTROL (interpretive) ──────────────────────────────────

function getCompositionControl_i(): string {
  return `COMPOSITION CONTROL (CRITICAL):

FOOTPRINT RULE:
The building must occupy ONLY 60–70% of the base diameter.
The remaining 30–40% of the base surface is landscaping and breathing room.
The building must NEVER fill the entire base.

BALANCE:
The composition must feel balanced and intentional — like a product designed for display.
If the building is asymmetric, use landscaping to visually balance the composition.
The diorama must feel complete and considered from every angle.

BREATHING ROOM:
There must be visible space between the building walls and the base edge on all sides.
No wall face should be flush with or close to the base perimeter.
Minimum visible ground between building and base edge: approximately 15–20% of base radius.

BASE:
- Circular or oval premium display base — dark walnut preferred
- Substantial thickness, clean rounded edge
- Full base visible in frame, never cropped
- Camera: 30–45 degrees above, angled downward`
}

// ── I-3. LANDSCAPING REQUIRED (interpretive) ─────────────────────────────────

function getLandscapingRequired_i(v: VariationParams = {}): string {
  const style   = v.landscape_style ?? 'manicured'
  const season  = v.season          ?? 'summer'
  const density = v.density         ?? 'medium'

  const styleGuide: Record<LandscapeStyle, string> = {
    cottage:   'informal and romantic — mixed flower beds, climbing plants near walls, irregular soft borders with visible bloom color',
    manicured: 'clean and composed — trimmed hedges, defined bed edges, uniform lawn, tidy brick or stone path to entrance',
    natural:   'relaxed and organic — native-style planting, irregular bed shapes, grasses mixed with shrubs, naturalistic feel',
    minimal:   'restrained and architectural — few species, generous negative space, low ground cover, gravel or stone surfaces prominent',
  }

  const seasonGuide: Record<LandscapeSeason, string> = {
    spring: 'fresh lime greens, early blooms in pink and white, light new foliage, soft morning light quality',
    summer: 'deep saturated greens, full canopy, dense ground cover, warm golden light, flowers at peak bloom',
    fall:   'amber and rust foliage, some leaf drop, muted evergreen greens, warm raking light',
    winter: 'bare deciduous branches, evergreens dominant, optional light frost on surfaces, cool neutral light',
  }

  const densityGuide: Record<LandscapeDensity, string> = {
    low:    'open and airy — generous negative space, visible ground between plants, uncluttered',
    medium: 'balanced — foundation planting fills building perimeter, open lawn in midground, trees as accents',
    lush:   'full and abundant — dense layered planting, shrubs frame the structure, minimal bare ground visible',
  }

  return `LANDSCAPING — REQUIRED, NOT OPTIONAL:

Landscaping is a primary compositional element, not decoration.
It must fill the space around the building intentionally and beautifully.

STYLE: ${style}
${styleGuide[style]}

SEASON: ${season}
${seasonGuide[season]}

DENSITY: ${density}
${densityGuide[density]}

REQUIRED ELEMENTS:
- Entry path from front base edge to building entrance (material matches architectural style)
- Foundation planting around building base — no bare soil visible at building walls
- Ground variation — no flat single-color grass surfaces
- At least one mid-height element (small shrub cluster or ornamental tree) to create depth

LAYERING (three zones):
- Foreground (base edge inward): low ground cover, path edging, small accent plants
- Midground: main lawn surface, foundation shrub groupings
- Against structure: taller foundation shrubs, small specimen plants

COMPOSITION ROLE:
Use landscaping to visually balance the building mass.
If the building sits left-of-centre, weight the landscaping right.
Corners of the base must not be empty.

All landscaping confined to the base — nothing extends beyond the base edge.`
}

// ── I-4. MATERIALS AND QUALITY (interpretive) ────────────────────────────────

function getMaterialsAndQuality_i(v: VariationParams = {}): string {
  const base = v.base ?? 'dark_walnut'

  return `MATERIALS — HANDCRAFTED AND PREMIUM:

All surfaces must feel physically real — handcrafted miniature quality, not CGI.
Render as premium product photography of a real collectible object.

ARCHITECTURAL SURFACES:
- Siding: painted wood finish, subtle horizontal grain, semi-gloss sheen, fine surface variation
- Trim: crisp contrast against siding, higher sheen, clean edge definition, bright edge highlights catching sunlight
- Roof: individual shingle or tile texture with micro-variation and crisp material transitions — no flat colour blocks
- Windows: warm amber interior glow visible through glass, slight reflectivity on frames
- Porch elements: painted railings and columns with clear material definition and edge highlights

MATERIAL CONTRAST (required):
- Trim clearly distinguishable from siding
- Roof clearly distinguishable from walls
- Structure clearly distinguishable from landscape

BASE: ${BASE_STYLE_GUIDE[base]}
Substantial thickness — must feel physical and weighted.

BACKGROUND:
- Background color must be EXACTLY #FF69B4 (hot pink) — solid, flat, no gradient
- No environment, no room, no table surface
- Clean edges — no haze, no glow, no halo

DEPTH OF FIELD:
- Entire diorama in sharp focus — every surface crisp
- No blur on any part of the miniature or base

LIGHTING:
Strong, direct sunlight from upper-left with bright highlights and deep shadows.
High contrast — no ambient softness.
Lighting must feel like direct sunlight striking a physical object on a table.
Shadows must be deep but not crushing — detail remains visible in shadow areas.
Highlights must be bright enough to create visible sparkle on edges.
Edge highlights must be sharp and clearly visible on roof ridges, window trim, railings, and base rim.`
}

// ── I-5. ANTI-DRIFT (interpretive) ───────────────────────────────────────────
// Looser than strict mode — allows interpretation, blocks invention.

function getAntiDrift_i(): string {
  return `INTERPRETIVE BOUNDARIES:

ALLOWED:
- Simplify fine details when they would not read clearly at miniature scale
- Refine proportions slightly for visual balance
- Enhance landscaping beyond what is literally visible in source

NOT ALLOWED:
- Invent major structural elements not present in source (new wings, towers, floors)
- Change the architectural style or building type
- Remove defining features that establish the building's identity
- Make a Victorian look like a ranch, or a cottage look like a mansion

The source image establishes identity. The output interprets it as a premium collectible.
Both must be unmistakably the same building.`
}

// ── I: MAIN ASSEMBLY (interpretive) ──────────────────────────────────────────

function assemblePromptInterpretive(options: AssembleOptions): string {
  const v = resolveVariation(options)
  const hasVariation = Object.keys(v).length > 0

  const blocks: string[] = [
    getMasterIntent_i(),
    hasVariation ? getVariationLock(v) : null,
    getIdentityGuidance_i(),
    getCompositionControl_i(),
    getMultiImageControl(options.blueprint),
    getMaterialsAndQuality_i(v),
    getLandscapingRequired_i(v),
    buildAnchorLock(options.blueprint),   // anchor lock still runs — anchors define identity
    getAntiDrift_i(),
  ].filter((b): b is string => Boolean(b))

  if (options.styleReference) {
    blocks.push(`STYLE GUIDANCE (feel and character, not structure):\n${options.styleReference}`)
  }

  if (options.patch) {
    blocks.push(wrapPatchWithEnforcement(options.patch))
  }

  return blocks.join('\n\n─────────────────────────────────────────\n\n')
}

// ══════════════════════════════════════════════════════════════════════════════
// END ARCHITECTURE INTERPRETIVE MODE
// ══════════════════════════════════════════════════════════════════════════════



function resolveVariation(options: AssembleOptions): VariationParams {
  if (options.variation) return options.variation
  if (options.landscape) {
    // Map legacy LandscapeParams → VariationParams
    return {
      landscape_style: options.landscape.style,
      season:          options.landscape.season,
      density:         options.landscape.density,
    }
  }
  return {}
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
// Single entry point. Routes to interpretive mode when mode === 'architecture_interpretive'.
// All other values (including undefined) use the original strict architecture path.

export function assemblePrompt(options: AssembleOptions): string {
  if (options.mode === 'architecture_interpretive') {
    return assemblePromptInterpretive(options)
  }

  if (options.mode === 'architecture_scene') {
    return assemblePromptScene(options)
  }

  // ── Original strict architecture path (unchanged) ─────────────────────────
  const v = resolveVariation(options)
  const hasVariation = Object.keys(v).length > 0

  const blocks: string[] = [
    getMasterIntent(),
    hasVariation ? getVariationLock(v) : null,
    getCoreConstraints(),
    getSpatialPreservation(),
    getNoInvention(),
    getMultiImageControl(options.blueprint),
    getDioramaStyle(v),
    getLandscapeDesign(v),
    buildAnchorLock(options.blueprint),
    getAntiDrift(),
  ].filter((b): b is string => Boolean(b))

  if (options.styleReference) {
    blocks.push(`ADDITIONAL STYLE GUIDANCE (affects presentation only, not structure):\n${options.styleReference}`)
  }

  if (options.patch) {
    blocks.push(wrapPatchWithEnforcement(options.patch))
  }

  return blocks.join('\n\n─────────────────────────────────────────\n\n')
}

// ══════════════════════════════════════════════════════════════════════════════
// ARCHITECTURE SCENE MODE  ('architecture_scene')
// ══════════════════════════════════════════════════════════════════════════════
//
// Generates the complete final image in one AI pass.
// The diorama is placed on a real wooden tabletop inside a warm interior scene.
// NO hot pink background. NO compositor. NO Stage 1 isolation.
// The AI owns the full output: environment + diorama + lighting + depth of field.
//
// Use this mode when you want a single-pass photographic result without the
// chroma-key → compositor pipeline. The run-pass route should return image_b64
// directly (no presentation_b64 compositing step needed).

function getMasterIntent_scene(): string {
  return `Transform the provided image into a highly detailed miniature architectural diorama.

CORE RULE:
Preserve the exact structure, proportions, and identity of the house.
Do not redesign, simplify, or alter any key structural element.

CORE GOAL:
A premium, realistic miniature that looks like a real photograph taken in a lived-in space.
The result must feel like a macro product photograph — physically present, materially convincing,
and naturally integrated into a real environment.`
}

function getSceneEnvironment(): string {
  return `SCENE ENVIRONMENT:
Place the miniature diorama on a wooden tabletop within a softly blurred warm interior.

ENVIRONMENT RULES:
- The scene should feel like a real photographed room — not a studio, not a composite
- Include natural background depth: soft furniture, plants, warm light sources, bookshelves
- Background elements must be softly blurred (shallow depth of field) — they support the subject
- The environment must NOT compete with or overpower the diorama
- Warm interior color temperature throughout (candlelight to afternoon window light range)
- Natural light from one direction — window light from upper-left preferred
- Subtle ambient bounce from the environment is allowed and encouraged

WHAT MUST BE VISIBLE:
- The full diorama on the tabletop — entire base clearly visible
- The tabletop surface immediately around the base (real wood grain, warm tone)
- Soft, blurred background suggesting a real interior space

WHAT MUST NOT HAPPEN:
- Background elements in sharp focus competing with the diorama
- Harsh studio lighting that kills the room atmosphere
- Flat or featureless background (must have some depth and suggestion of space)
- The room overwhelming the miniature as the main subject`
}

function getSceneLighting(): string {
  return `LIGHTING:
Strong natural directional light — sunlight through a window or a strong interior lamp from upper-left.
This is NOT flat studio lighting. It is photographic scene lighting with real directionality.

REQUIRED:
- Single dominant key light direction (upper-left)
- Clear highlight-to-shadow separation across the model
- Roof ridges, trim, porch columns, and base rim catch bright highlights
- Shadow faces are visibly darker but retain readable material texture
- Subtle warm ambient bounce from the interior environment
- Lighting feels photographic — like it was taken on location, not in a lightbox

INTERIOR WINDOW GLOW (subtle):
- A few windows may show a mild warm amber glow from inside
- Keep it subtle and believable — a hint, not a glowing toy
- Shadow-side windows get little or no glow

DEPTH OF FIELD:
- The diorama is entirely sharp and detailed — every surface in focus
- Background blurs naturally (shallow DOF, macro photography style)
- The tabletop immediately around the base is slightly soft — diorama is the sharp focal plane

FORBIDDEN:
- Flat, even lighting with no shadow direction
- Heavy ambient fill that removes all contrast
- Overexposed or washed-out highlights
- Studio-isolated look (no room, no atmosphere)`
}

function getSceneMaterialsAndCamera(): string {
  return `MATERIALS:
- Handcrafted miniature realism: painted wood, resin, foliage, stone, brick
- Surfaces have texture and visible detail — not smooth CGI
- Semi-gloss material response: edges catch light, trim and base rim have specular highlights
- Avoid fully matte or fully glossy surfaces — aim for premium collectible finish

CAMERA:
- Macro photography style — close, detailed, physically present
- Slightly elevated angle: 35–45° downward
- Entire base must be visible within the frame
- Standard lens perspective — no wide-angle or fisheye distortion
- Shallow depth of field: diorama sharp, background and table edges softly blurred

BASE AND COMPOSITION:
- Diorama sits on a thick circular dark walnut wooden base — full depth visible
- House occupies 55–65% of the base, surrounded by landscaping on all sides
- Landscaping: path from entrance to base edge, shrubs, flowers, ground cover
- Clear breathing room: base does not reach image edges
- Object occupies roughly 60–70% of frame width`
}

function assemblePromptScene(options: AssembleOptions): string {
  const blocks: string[] = [
    getMasterIntent_scene(),
    getSpatialPreservation(),       // structural fidelity — unchanged
    getNoInvention(),               // no invented elements — unchanged
    getMultiImageControl(options.blueprint),
    getSceneEnvironment(),
    getSceneLighting(),
    getSceneMaterialsAndCamera(),
    getLandscapeDesign(resolveVariation(options)),
    buildAnchorLock(options.blueprint),
    getAntiDrift(),
  ].filter((b): b is string => Boolean(b))

  if (options.styleReference) {
    blocks.push(`STYLE GUIDANCE (environment feel and character only — do not alter structure):\n${options.styleReference}`)
  }

  if (options.patch) {
    blocks.push(wrapPatchWithEnforcement(options.patch))
  }

  return blocks.join('\n\n─────────────────────────────────────────\n\n')
}
