// lib/structure/extractBlueprint.ts
// UPDATE: Geometry pattern system — projection count, facade planes,
// depth layers, window rhythm, roof complexity, structural silhouette.

export interface StructuralAnchor {
  id:           string
  type:         'structure' | 'layout' | 'composition'
  identity:     boolean
  description:  string
  importance:   number
  confidence:   number
  confirmed_by: string[]
}

export interface ProjectionObject {
  present:       boolean
  side:          'image-left' | 'image-right' | 'center' | 'none'
  protrusion:    'slight' | 'moderate' | 'strong'
  has_own_roof:  boolean
  entry_on_face: boolean
  confidence:    number
}

export interface GeometryPatterns {
  projection_count:      number
  facade_plane_count:    number
  depth_layers:          number
  window_rhythm:         'regular' | 'irregular' | 'none'
  roof_layer_count:      number
  structural_silhouette: 'simple' | 'complex' | 'highly_complex'
}

export interface GeometryObject {
  main_mass: {
    position:       'center' | 'left' | 'right'
    extends_toward: string[]
    depth:          'flat' | 'moderate' | 'deep'
    symmetry:       'symmetrical' | 'asymmetrical'
  }
  extensions: Array<{
    direction:      'image-left' | 'image-right'
    visible:        boolean
    relative_depth: 'shallow' | 'medium' | 'deep'
  }>
  projections:  ProjectionObject[]
  patterns:     GeometryPatterns
  porch: {
    present:          boolean
    front_span:       'none' | 'partial' | 'full'
    wrap_direction:   'none' | 'image-left' | 'image-right'
    side_run_visible: boolean
    footprint_type:   'none' | 'rectangular' | 'L_wrap'
    roofed:           boolean
    stairs_visible:   boolean
    confidence:       number
  }
  roof: {
    primary_orientation: 'horizontal' | 'vertical'
    complexity:          'simple' | 'multi_plane'
    asymmetry:           boolean
    higher_side:         'image-left' | 'image-right' | 'center' | 'unknown'
  }
  entry: {
    present:  boolean
    position: 'center' | 'image-left' | 'image-right' | 'unknown'
  }
  complexity_flags: string[]
}

export interface AnchorBlueprint {
  scene_type:         'architecture'
  source_image_id:    string
  source_image_count: number
  geometry:           GeometryObject
  anchors:            StructuralAnchor[]
  semantic_notes:     string[]
}

// ── GEOMETRY EXTRACTION PROMPT ────────────────────────────────────────────────

function buildGeometryPrompt(role: 'primary' | 'secondary' | 'tertiary'): string {
  const roleNote = role === 'primary'
    ? 'PRIMARY image — extract full geometry. This defines layout and composition.'
    : `${role.toUpperCase()} reference — focus on depth, side volumes, and elements not clear in primary.`

  return `You are a structural geometry extraction system for a miniature diorama engine.

${roleNote}

You are analyzing a SOURCE PHOTO to extract geometry for converting it into a MINIATURE DIORAMA COLLECTIBLE.
The output will be a complete physical object: circular wooden base + landscaped land + building/structure on top.
Extract geometry to faithfully recreate the BUILDING only — the base and landscaping are always added.

Extract EXPLICIT structural geometry. Do NOT describe style. Do NOT guess.
If ambiguous → mark it and set confidence low.

ORIENTATION (CRITICAL):
- "image-left" = left side as seen by viewer looking at screen
- "image-right" = right side as seen by viewer looking at screen
- Always viewer perspective — never building perspective

Return ONLY this JSON. No prose, no markdown.

{
  "geometry": {
    "main_mass": {
      "position": "<center|left|right>",
      "extends_toward": ["<image-left|image-right>"],
      "depth": "<flat|moderate|deep>",
      "symmetry": "<symmetrical|asymmetrical>"
    },
    "extensions": [
      {
        "direction": "<image-left|image-right>",
        "visible": <true|false>,
        "relative_depth": "<shallow|medium|deep>"
      }
    ],
    "projections": [
      {
        "present": <true|false>,
        "side": "<image-left|image-right|center|none>",
        "protrusion": "<slight|moderate|strong>",
        "has_own_roof": <true|false>,
        "entry_on_face": <true|false>,
        "confidence": <0.0-1.0>
      }
    ],
    "patterns": {
      "projection_count": <integer>,
      "facade_plane_count": <integer>,
      "depth_layers": <integer>,
      "window_rhythm": "<regular|irregular|none>",
      "roof_layer_count": <integer>,
      "structural_silhouette": "<simple|complex|highly_complex>"
    },
    "porch": {
      "present": <true|false>,
      "front_span": "<none|partial|full>",
      "wrap_direction": "<none|image-left|image-right>",
      "side_run_visible": <true|false>,
      "footprint_type": "<none|rectangular|L_wrap>",
      "roofed": <true|false>,
      "stairs_visible": <true|false>,
      "confidence": <0.0-1.0>
    },
    "roof": {
      "primary_orientation": "<horizontal|vertical>",
      "complexity": "<simple|multi_plane>",
      "asymmetry": <true|false>,
      "higher_side": "<image-left|image-right|center|unknown>"
    },
    "entry": {
      "present": <true|false>,
      "position": "<center|image-left|image-right|unknown>"
    },
    "complexity_flags": ["<flag>"]
  },
  "semantic_notes": ["<style labels only — never used for generation>"]
}

PROJECTION DETECTION RULES (CRITICAL):
A projection is a volume that protrudes FORWARD of the main facade plane — toward the camera.
- Bay windows, towers, pavilion volumes that step forward = projections
- A flat wall section is NOT a projection
- entry_on_face = true ONLY if the entry door sits on the projecting face
- List all projections even at low confidence
- Do NOT confuse side extensions (left/right) with projections (forward)
- protrusion: slight = <10% facade width, moderate = 10-25%, strong = >25%

PATTERN EXTRACTION RULES:
- projection_count: total distinct forward projections
- facade_plane_count: number of distinct vertical wall planes at different depths
- depth_layers: 1=flat, 2=front+back, 3+=complex layering
- window_rhythm: regular=consistent spacing/sizing, irregular=varied
- roof_layer_count: distinct roof levels or planes
- structural_silhouette: simple=box, complex=L/T shape, highly_complex=multiple projections+layers

PORCH DETECTION RULES:
- If wrap_direction is set → footprint_type MUST be L_wrap
- stairs_visible = false unless CLEARLY visible
- If porch wrap uncertain → confidence < 0.6, add "porch_wrap_ambiguous" to flags

COMPLEXITY FLAGS:
- "porch_wrap_ambiguous"
- "depth_uncertain"
- "stairs_uncertain"
- "multi_plane_roof"
- "side_extension_present"
- "asymmetrical_mass"
- "occluded_entry"
- "projecting_bay_present"

AMBIGUITY RULE:
If not confident → flag it and set lower confidence. Do NOT fill values you cannot see.`
}

// ── ANCHOR DERIVATION ─────────────────────────────────────────────────────────

function deriveAnchorsFromGeometry(geo: GeometryObject, imageId: string): StructuralAnchor[] {
  const anchors: StructuralAnchor[] = []
  const add = (
    id: string, type: StructuralAnchor['type'], identity: boolean,
    description: string, importance: number, confidence: number
  ) => anchors.push({ id, type, identity, description, importance, confidence, confirmed_by: [imageId] })

  // Main mass
  const massDir = geo.main_mass.extends_toward?.join(' and ') || geo.main_mass.position
  add('main_mass_distribution', 'structure', true,
    `primary building mass ${geo.main_mass.symmetry === 'asymmetrical' ? 'asymmetrically' : ''} positioned, extending toward ${massDir}`,
    10, 0.9)

  // Side extensions
  for (const ext of (geo.extensions || [])) {
    if (ext.visible) {
      add(`extension_${ext.direction.replace('-', '_')}`, 'structure', true,
        `secondary building volume on ${ext.direction} side with ${ext.relative_depth} depth`,
        8.5, 0.85)
    }
  }

  // Projections
  for (const proj of (geo.projections || [])) {
    if (proj.present && proj.side !== 'none') {
      const entryNote = proj.entry_on_face ? ' — entry door is on this projection face' : ''
      const roofNote  = proj.has_own_roof  ? ', with its own roof stepping forward' : ''
      add(`projection_${proj.side.replace('-', '_')}`, 'structure', true,
        `forward-projecting volume on ${proj.side} — protrudes ${proj.protrusion}ly in front of main facade plane` + roofNote + entryNote,
        9.5, proj.confidence)
    }
  }

  // Geometry patterns
  if (geo.patterns) {
    const p = geo.patterns
    if (p.projection_count > 0) {
      add('projection_integrity', 'structure', true,
        `${p.projection_count} forward projection(s) must remain distinct from main facade — depth separation must be visible`,
        9.0, 0.9)
    }
    if (p.facade_plane_count > 1) {
      add('facade_depth_layers', 'structure', true,
        `${p.facade_plane_count} distinct facade planes must remain at different depths — do not flatten into single plane`,
        8.5, 0.85)
    }
    if (p.window_rhythm !== 'none') {
      add('window_rhythm', 'layout', false,
        `window rhythm is ${p.window_rhythm} — preserve exact spacing and alignment across floors`,
        6.0, 0.8)
    }
    if (p.roof_layer_count > 1) {
      add('roof_layers', 'structure', false,
        `${p.roof_layer_count} distinct roof layers must remain visible and separately defined`,
        7.0, 0.8)
    }
  }

  // Porch
  if (geo.porch.present) {
    const porchConf = geo.porch.confidence || 0.7
    if (geo.porch.footprint_type === 'L_wrap' && geo.porch.wrap_direction !== 'none') {
      add('porch_wrap_direction', 'structure', true,
        `porch extends across front and wraps toward ${geo.porch.wrap_direction} along side facade`,
        10, porchConf)
      if (geo.porch.side_run_visible) {
        add('porch_side_run', 'structure', true,
          `porch side run clearly visible along ${geo.porch.wrap_direction} wall`,
          9.0, porchConf)
      }
    } else if (geo.porch.front_span !== 'none') {
      add('porch_front', 'structure', true,
        `porch spans ${geo.porch.front_span} front face — rectangular footprint`,
        8.0, porchConf)
    }
    if (geo.porch.roofed) {
      add('porch_roofed', 'structure', false, `porch has roofed structure`, 6.5, porchConf)
    }
    if (geo.porch.stairs_visible) {
      add('porch_stairs', 'layout', false, `stairs visible at porch entry`, 4.0, 0.7)
    }
  }

  // Roof
  add('roof_orientation', 'structure', true,
    `main roof ridge runs ${geo.roof.primary_orientation}, higher on ${geo.roof.higher_side}`,
    9.0, 0.85)
  if (geo.roof.complexity === 'multi_plane') {
    add('roof_complexity', 'structure', false, `roof has multiple planes visible`, 6.0, 0.75)
  }

  // Entry
  if (geo.entry.present && geo.entry.position !== 'unknown') {
    add('entry_position', 'layout', false,
      `main entry at ${geo.entry.position} of front facade`, 5.0, 0.7)
  }

  // ── DIORAMA OBJECT ANCHORS ────────────────────────────────────────────────
  // These define the complete diorama as a physical object — not just the building.
  // Always added regardless of source image content.

  // The base
  add('display_base', 'structure', true,
    `circular wooden display base fully visible — complete bottom rim, substantial thickness, no cropping at any edge`,
    9.0, 1.0)

  // The property — structure-to-land ratio
  add('property_land_ratio', 'composition', true,
    `structure occupies 50–65% of base diameter — at least 35% of base surface is open land, paths, and landscaping`,
    9.0, 1.0)

  // Landscaping as identity
  add('landscaping_coverage', 'structure', true,
    `landscaping covers full base perimeter — grass, paths, garden beds extend well beyond building foundation on all sides`,
    8.5, 1.0)

  // Complete object — nothing floating
  add('diorama_complete_object', 'structure', true,
    `the diorama is a complete physical collectible — base, land, landscaping, and structure are all one unified object, nothing is cropped or separated`,
    9.0, 1.0)

  // Three-dimensionality
  add('three_d_elements', 'structure', false,
    `all scene elements fully three-dimensional — no flat planes, no printed textures`,
    7.0, 0.9)

  return anchors
}

// ── SINGLE IMAGE EXTRACTION ───────────────────────────────────────────────────

async function extractFromImage(
  imageBase64:  string,
  imageId:      string,
  role:         'primary' | 'secondary' | 'tertiary',
  openaiApiKey: string
): Promise<{ geometry: GeometryObject; semanticNotes: string[] }> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiApiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o', max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' } },
          { type: 'text', text: buildGeometryPrompt(role) },
        ],
      }],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Geometry extraction failed for ${imageId}: ${response.status} ${err}`)
  }

  const data    = await response.json()
  const raw     = data.choices?.[0]?.message?.content || ''
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  let result: any
  try { result = JSON.parse(cleaned) }
  catch { throw new Error(`Geometry JSON parse failed for ${imageId}. Raw: ${raw.slice(0, 300)}`) }

  if (!result.geometry.projections) result.geometry.projections = []
  if (!result.geometry.patterns) {
    result.geometry.patterns = {
      projection_count: 0, facade_plane_count: 1, depth_layers: 1,
      window_rhythm: 'none', roof_layer_count: 1, structural_silhouette: 'simple',
    }
  }

  return {
    geometry:      result.geometry as GeometryObject,
    semanticNotes: result.semantic_notes || [],
  }
}

// ── GEOMETRY MERGE ────────────────────────────────────────────────────────────

function mergeGeometry(primary: GeometryObject, secondaries: GeometryObject[]): GeometryObject {
  const merged = { ...primary }
  if (!merged.projections) merged.projections = []

  for (const sec of secondaries) {
    if (merged.porch.present && sec.porch.present) {
      if (merged.porch.wrap_direction === sec.porch.wrap_direction) {
        merged.porch.confidence = Math.min(1.0, (merged.porch.confidence || 0.7) + 0.15)
      }
    }
    for (const ext of (sec.extensions || [])) {
      const existing = merged.extensions.find(e => e.direction === ext.direction)
      if (!existing && ext.visible) merged.extensions.push(ext)
      else if (existing && ext.visible) existing.visible = true
    }
    for (const proj of (sec.projections || [])) {
      if (!proj.present) continue
      const existing = merged.projections.find(p => p.side === proj.side)
      if (!existing) merged.projections.push(proj)
      else existing.confidence = Math.min(1.0, existing.confidence + 0.15)
    }
    if (sec.patterns && merged.patterns) {
      merged.patterns.projection_count   = Math.max(merged.patterns.projection_count,   sec.patterns.projection_count)
      merged.patterns.facade_plane_count = Math.max(merged.patterns.facade_plane_count, sec.patterns.facade_plane_count)
      merged.patterns.depth_layers       = Math.max(merged.patterns.depth_layers,       sec.patterns.depth_layers)
      merged.patterns.roof_layer_count   = Math.max(merged.patterns.roof_layer_count,   sec.patterns.roof_layer_count)
    }
    if (!sec.complexity_flags.includes('depth_uncertain')) {
      merged.complexity_flags = merged.complexity_flags.filter(f => f !== 'depth_uncertain')
    }
  }

  return merged
}

// ── MAIN EXPORTS ──────────────────────────────────────────────────────────────

export async function extractBlueprint(
  imageBase64:  string,
  imageId:      string,
  openaiApiKey: string
): Promise<AnchorBlueprint> {
  return extractBlueprintMulti([imageBase64], imageId, openaiApiKey)
}

export async function extractBlueprintMulti(
  images:       string[],
  primaryId:    string,
  openaiApiKey: string
): Promise<AnchorBlueprint> {
  const capped = images.slice(0, 3)
  const roles: Array<'primary' | 'secondary' | 'tertiary'> = ['primary', 'secondary', 'tertiary']

  console.log(`[extractBlueprint] Processing ${capped.length} image(s)...`)

  const results = await Promise.all(
    capped.map((img, i) => extractFromImage(img, `img_${i}`, roles[i], openaiApiKey))
  )

  const primaryGeo    = results[0].geometry
  const secondaryGeos = results.slice(1).map(r => r.geometry)
  const mergedGeo     = secondaryGeos.length > 0
    ? mergeGeometry(primaryGeo, secondaryGeos)
    : primaryGeo

  const anchors     = deriveAnchorsFromGeometry(mergedGeo, primaryId)
  const allSemantic = results.flatMap(r => r.semanticNotes)

  const projCount = mergedGeo.projections?.filter(p => p.present).length || 0
  console.log(
    `[extractBlueprint] ${anchors.length} anchors. ` +
    `Porch: ${mergedGeo.porch.present ? mergedGeo.porch.footprint_type + ' → ' + mergedGeo.porch.wrap_direction : 'none'}. ` +
    `Projections: ${projCount}. ` +
    `Planes: ${mergedGeo.patterns?.facade_plane_count || 1}. ` +
    `Silhouette: ${mergedGeo.patterns?.structural_silhouette || 'unknown'}. ` +
    `Flags: ${mergedGeo.complexity_flags.join(', ') || 'none'}`
  )

  return {
    scene_type:         'architecture',
    source_image_id:    primaryId,
    source_image_count: capped.length,
    geometry:           mergedGeo,
    anchors,
    semantic_notes:     allSemantic,
  }
}
