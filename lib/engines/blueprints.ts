// lib/engines/blueprints.ts
// Extracts a structured scene blueprint from a source photo.
// Blueprint is locked for the entire session — never changes between passes.
// Only the patch block evolves.

import openai from '@/lib/openai'
// ── Blueprint schemas per scene type ─────────────────────────────────────────

const EXTRACTION_PROMPTS: Record<string, string> = {

  architecture: `Analyze this building photo and return ONLY a JSON blueprint. No other text.
{
  "scene_type": "architecture",
  "structure": {
    "floors": "exact description e.g. two floors with attic",
    "roof_type": "e.g. mansard / gable / hip / flat",
    "facade_symmetry": "symmetrical or asymmetrical",
    "primary_material": "e.g. wood clapboard siding / brick / stucco",
    "primary_color": "e.g. light blue with white trim"
  },
  "features": {
    "windows": "count and pattern e.g. two large windows per floor, symmetrical",
    "door": "position and type e.g. centered single wood door with sidelights",
    "porch": "none / small entry / full wraparound — describe columns and railings",
    "special": "bay windows, dormers, chimneys, turrets — list what is present"
  },
  "environment": {
    "ground_type": "grass / dirt / pavement / mixed",
    "key_elements": ["list visible elements e.g. trees, pathway, fence, garden beds"],
    "foreground": "what is immediately in front of building"
  },
  "anchors": [
    "list 4-6 features that MUST be preserved exactly"
  ]
}`,

  people: `Analyze this photo and return ONLY a JSON blueprint. No other text.
{
  "scene_type": "people",
  "subjects": [
    {
      "id": "person_1",
      "age_range": "e.g. 8-10 years",
      "gender": "male / female",
      "position": "left / center / right / foreground / background",
      "pose": "standing / sitting / action — describe briefly",
      "clothing": "colors and key items e.g. red jersey, blue jeans",
      "hair": "color and style",
      "face_notes": "any distinctive features to preserve"
    }
  ],
  "interaction": "how subjects relate e.g. standing together, one behind other",
  "environment": {
    "ground_type": "grass / floor / pavement / arena",
    "setting": "indoor / outdoor / arena / park",
    "background": "brief description"
  },
  "anchors": [
    "list key identity features that MUST be preserved"
  ]
}`,

  sports: `Analyze this photo and return ONLY a JSON blueprint. No other text.
{
  "scene_type": "sports",
  "subjects": [
    {
      "id": "person_1",
      "age_range": "estimate",
      "position": "left / center / right",
      "pose": "brief description",
      "apparel": "team colors, jersey style, any numbers visible",
      "face_notes": "distinctive features"
    }
  ],
  "interaction": "how subjects relate",
  "venue": {
    "sport": "football / basketball / baseball / hockey / soccer / other",
    "setting": "stadium / arena / field",
    "crowd": "visible / not visible"
  },
  "anchors": [
    "list key features that MUST be preserved"
  ]
}`,

  landscape: `Analyze this landscape photo and return ONLY a JSON blueprint. No other text.
{
  "scene_type": "landscape",
  "terrain": {
    "primary_type": "coastal / forest / mountain / wetland / urban / desert",
    "dominant_feature": "e.g. pier / river / cliffs / meadow",
    "ground_cover": "e.g. sand / grass / rock / water"
  },
  "key_elements": [
    "list major scene elements e.g. pier, boats, trees, rocks, water"
  ],
  "lighting": {
    "time_of_day": "sunrise / morning / midday / sunset / overcast",
    "quality": "warm / cool / dramatic / soft / misty"
  },
  "remove": [
    "elements to exclude e.g. sky, distant buildings, people"
  ],
  "anchors": [
    "list 4-6 terrain features that MUST be preserved"
  ]
}`,

  dollhouse: `Analyze this interior photo and return ONLY a JSON blueprint. No other text.
{
  "scene_type": "dollhouse",
  "room_type": "kitchen / living room / bedroom / bathroom / office",
  "layout": {
    "shape": "galley / L-shape / open / square",
    "key_surfaces": "e.g. center island, counter runs left and right, sink under window"
  },
  "must_keep": [
    "list elements that MUST be preserved e.g. cabinets, sink, window, backsplash, counters"
  ],
  "can_simplify": [
    "elements that can be reduced e.g. clutter, small appliances, decorations"
  ],
  "remove": [
    "elements to exclude e.g. ceiling, far walls, construction elements"
  ],
  "materials": {
    "cabinets": "color and style",
    "counters": "material and color",
    "flooring": "type and color"
  },
  "anchors": [
    "list 4-6 layout features that MUST be preserved"
  ]
}`,
}

// ── Extract blueprint from image URL ─────────────────────────────────────────

export async function extractBlueprint(
  imageUrl: string,
  engineId: string
): Promise<Record<string, any>> {
  const prompt = EXTRACTION_PROMPTS[engineId] || EXTRACTION_PROMPTS.architecture
  const res = await openai.chat.completions.create({
    model:           'gpt-4o',
    max_tokens:      600,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
        { type: 'text', text: prompt },
      ],
    }],
  })
  const parsed = JSON.parse(res.choices[0]?.message?.content || '{}')
  if (parsed.scene_type || parsed.anchors) return parsed
  return {}
}

// Use base64 directly — avoids issues with GPT-4o fetching Supabase URLs
export async function extractBlueprintFromBase64(
  base64: string,
  mediaType: string,
  engineId: string
): Promise<Record<string, any>> {
  const prompt = EXTRACTION_PROMPTS[engineId] || EXTRACTION_PROMPTS.architecture
  const res = await openai.chat.completions.create({
    model:           'gpt-4o',
    max_tokens:      600,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64}`, detail: 'high' } },
        { type: 'text', text: prompt },
      ],
    }],
  })
  const parsed = JSON.parse(res.choices[0]?.message?.content || '{}')
  if (parsed.scene_type || parsed.anchors) return parsed
  return {}
}

// ── Format blueprint anchors as prompt string ─────────────────────────────────

export function formatAnchors(blueprint: Record<string, any>): string {
  const anchors: string[] = blueprint.anchors || []
  if (anchors.length === 0) return ''
  return `ANCHORS — MUST PRESERVE:\n${anchors.map(a => `- ${a}`).join('\n')}`
}

// ── Format blueprint context as prompt string ─────────────────────────────────
// Injects scene-specific details into the prompt

export function formatBlueprintContext(blueprint: Record<string, any>, engineId: string): string {
  const lines: string[] = []

  if (engineId === 'architecture') {
    const s = blueprint.structure || {}
    const f = blueprint.features  || {}
    const e = blueprint.environment || {}
    if (s.floors)           lines.push(`Floors: ${s.floors}`)
    if (s.roof_type)        lines.push(`Roof: ${s.roof_type}`)
    if (s.primary_material) lines.push(`Material: ${s.primary_material}`)
    if (s.primary_color)    lines.push(`Color: ${s.primary_color}`)
    if (f.windows)          lines.push(`Windows: ${f.windows}`)
    if (f.door)             lines.push(`Door: ${f.door}`)
    if (f.porch)            lines.push(`Porch: ${f.porch}`)
    if (f.special)          lines.push(`Special features: ${f.special}`)
    if (e.ground_type)      lines.push(`Ground: ${e.ground_type}`)
    if (e.key_elements?.length) lines.push(`Site elements: ${e.key_elements.join(', ')}`)
  }

  if (engineId === 'people' || engineId === 'sports') {
    const subjects = blueprint.subjects || []
    subjects.forEach((s: any, i: number) => {
      lines.push(`Person ${i + 1}: ${s.age_range || ''} ${s.gender || ''}, ${s.pose || ''}, wearing ${s.clothing || s.apparel || ''}`)
      if (s.hair)       lines.push(`  Hair: ${s.hair}`)
      if (s.face_notes) lines.push(`  Face: ${s.face_notes}`)
    })
    if (blueprint.interaction) lines.push(`Interaction: ${blueprint.interaction}`)
  }

  if (engineId === 'landscape') {
    const t = blueprint.terrain || {}
    if (t.primary_type)      lines.push(`Terrain: ${t.primary_type}`)
    if (t.dominant_feature)  lines.push(`Key feature: ${t.dominant_feature}`)
    if (blueprint.key_elements?.length) lines.push(`Elements: ${blueprint.key_elements.join(', ')}`)
    if (blueprint.lighting?.time_of_day) lines.push(`Time of day: ${blueprint.lighting.time_of_day}`)
    if (blueprint.lighting?.quality)     lines.push(`Light quality: ${blueprint.lighting.quality}`)
    if (blueprint.remove?.length) lines.push(`Remove: ${blueprint.remove.join(', ')}`)
  }

  if (engineId === 'dollhouse') {
    const l = blueprint.layout || {}
    const m = blueprint.materials || {}
    if (blueprint.room_type) lines.push(`Room: ${blueprint.room_type}`)
    if (l.shape)             lines.push(`Layout: ${l.shape}`)
    if (l.key_surfaces)      lines.push(`Key surfaces: ${l.key_surfaces}`)
    if (blueprint.must_keep?.length)    lines.push(`Must keep: ${blueprint.must_keep.join(', ')}`)
    if (blueprint.can_simplify?.length) lines.push(`Can simplify: ${blueprint.can_simplify.join(', ')}`)
    if (blueprint.remove?.length)       lines.push(`Remove: ${blueprint.remove.join(', ')}`)
    if (m.cabinets)  lines.push(`Cabinets: ${m.cabinets}`)
    if (m.counters)  lines.push(`Counters: ${m.counters}`)
    if (m.flooring)  lines.push(`Flooring: ${m.flooring}`)
  }

  return lines.length > 0 ? `SCENE BLUEPRINT:\n${lines.join('\n')}` : ''
}
