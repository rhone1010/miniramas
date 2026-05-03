// lib/v1/landscapes-curator.ts
// Editorial recommender. Picks primary + alternative recommendations across
// both paths (surface and material), recommends scale/environment/atmosphere,
// and surfaces editorial guidance the UI uses to grey out tiles.

import OpenAI from 'openai'
import {
  AnalyzerResult, CuratorResult,
  SurfaceID, MaterialID, MainKind, EnvironmentID, AtmosphereID, ScaleID,
  MATERIAL_COMPATIBILITY, MATERIAL_LABELS, SURFACE_LABELS,
  STATIC_EDITORIAL_GUIDANCE,
} from './landscapes-shared'

// Tiers for picking premium recommendations when multiple options qualify
import { MATERIAL_TIER } from './landscapes-shared'

const CURATOR_PROMPT = `
You are C., the editorial curator at Liten & Co's miniature-diorama studio.
You're recommending which renderings to make of a place a customer loves.

Two paths exist:
- SURFACE renders the place faithfully, in its real materials and colors.
- MATERIAL renders the place as a single-material sculptural object (bronze, alabaster, glass, carved stone, carved wood, watercolor wood, museum quality).

Your job is to:
1. Pick a PRIMARY recommendation — the single rendering you'd make if the customer let you choose one.
2. Pick an ALTERNATIVE — a meaningfully different second option that pairs well with the primary.
3. Recommend a scale (composed / generous / edge_to_edge), an environment (in_situ / desk / gallery), and an atmosphere.
4. Write 2-3 sentences of editorial prose explaining your choice. Voice: confident, warm, lightly poetic, never marketing-y. Speak as someone who cares about this place.

Editorial principles you follow:
- Dramatic places (stormy cliffs, dense canopy, deep grottos) often suit a SIGNATURE MATERIAL primary (bronze, museum quality, alabaster, glass) with a SURFACE alternative.
- Subtle places (meadows, soft mornings, quiet bridges) often suit a SURFACE primary with a complementary material alternative.
- Material renders look better in Gallery or Desk environments — never recommend material + in_situ.
- Edge-to-edge scale suits places with a clear focal subject; composed suits intimate scenes; generous is a balanced default.

You will receive a structured analysis of the place. Respond ONLY with valid JSON in this shape:

{
  "primary_recommendation":   { "kind": "material" | "surface", "id": "<id>" },
  "alternative":              { "kind": "material" | "surface", "id": "<id>" },
  "recommended_scale":        "composed" | "generous" | "edge_to_edge",
  "recommended_environment":  "in_situ" | "desk" | "gallery",
  "recommended_atmosphere":   "<atmosphere id>",
  "prose":                    "<2-3 sentences>"
}

Valid surface ids: wet_luminous, soft_diffused, hard_raking, layered_atmospheric, lush_saturated
Valid material ids: bronze, museum_quality, alabaster, glass, carved_stone, carved_wood, watercolor_wood
Valid atmosphere ids: golden, peaceful_dawn, vivid_midday, dusk_blue_hour, dramatic_storm, deep_night, fog_rolled_in, after_rain, snow_falling, aurora_surreal

No markdown, no preamble, no explanation outside the prose field.
`.trim()

export async function curateLandscape(input: {
  analyzer:     AnalyzerResult
  openaiApiKey: string
}): Promise<CuratorResult> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const placeBrief = JSON.stringify({
    display_name:     input.analyzer.display_name,
    primary_surface:  input.analyzer.primary_surface,
    dominant_subject: input.analyzer.dominant_subject,
    has_water:        input.analyzer.has_water,
  })

  const response = await openai.chat.completions.create({
    model:      'gpt-4o',
    max_tokens: 400,
    messages: [
      { role: 'system', content: CURATOR_PROMPT },
      { role: 'user',   content: `PLACE ANALYSIS:\n${placeBrief}\n\nRespond now.` },
    ],
  })

  const raw = response.choices[0]?.message?.content?.trim() || '{}'
  const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

  let parsed: any = {}
  try { parsed = JSON.parse(clean) } catch { parsed = {} }

  // Sanitize + fall back to a sensible default if model returns garbage.
  const result: CuratorResult = {
    primary_recommendation: validateRec(parsed.primary_recommendation, input.analyzer)
                              || defaultPrimary(input.analyzer),
    alternative:            validateRec(parsed.alternative, input.analyzer)
                              || defaultAlternative(input.analyzer),
    recommended_scale:      validScale(parsed.recommended_scale)            || 'generous',
    recommended_environment: validEnv(parsed.recommended_environment)       || 'desk',
    recommended_atmosphere:  validAtmosphere(parsed.recommended_atmosphere) || 'golden',
    not_recommended:        buildNotRecommended(input.analyzer),
    prose:                  typeof parsed.prose === 'string' && parsed.prose.trim()
                              ? parsed.prose.trim()
                              : `${input.analyzer.display_name} carries its own quiet authority — render it true to itself first, then let one material costume reveal a different facet.`,
  }

  console.log(
    `[landscapes-curator] primary=${result.primary_recommendation.kind}:${result.primary_recommendation.id} / ` +
    `alt=${result.alternative.kind}:${result.alternative.id} / ` +
    `scale=${result.recommended_scale} / env=${result.recommended_environment} / ` +
    `not_rec=${result.not_recommended.length}`
  )

  return result
}

// ── HELPERS ───────────────────────────────────────────────────

function validateRec(
  rec: any,
  analyzer: AnalyzerResult,
): { kind: MainKind; id: SurfaceID | MaterialID } | null {
  if (!rec || typeof rec !== 'object') return null
  if (rec.kind !== 'surface' && rec.kind !== 'material') return null
  if (typeof rec.id !== 'string') return null

  if (rec.kind === 'surface' && rec.id in SURFACE_LABELS) {
    return { kind: 'surface', id: rec.id as SurfaceID }
  }
  if (rec.kind === 'material' && rec.id in MATERIAL_LABELS) {
    return { kind: 'material', id: rec.id as MaterialID }
  }
  return null
}

function defaultPrimary(analyzer: AnalyzerResult): { kind: MainKind; id: SurfaceID | MaterialID } {
  // For dramatic surfaces, default to a signature material.
  // For subtle surfaces, default to surface path.
  if (analyzer.primary_surface === 'hard_raking' || analyzer.primary_surface === 'wet_luminous') {
    const compatible = MATERIAL_COMPATIBILITY[analyzer.primary_surface] || []
    const signature  = compatible.find(m => MATERIAL_TIER[m] === 'signature')
    if (signature) return { kind: 'material', id: signature }
  }
  return { kind: 'surface', id: analyzer.primary_surface }
}

function defaultAlternative(analyzer: AnalyzerResult): { kind: MainKind; id: SurfaceID | MaterialID } {
  // If primary is material, alt is surface — and vice versa.
  const primary = defaultPrimary(analyzer)
  if (primary.kind === 'material') {
    return { kind: 'surface', id: analyzer.primary_surface }
  }
  // Primary is surface — pick a compatible material as alt
  const compatible = MATERIAL_COMPATIBILITY[analyzer.primary_surface] || []
  const altMat = compatible.find(m => MATERIAL_TIER[m] === 'premium')
                || compatible[0]
                || 'museum_quality'
  return { kind: 'material', id: altMat }
}

function validScale(s: any): ScaleID | null {
  return (s === 'composed' || s === 'generous' || s === 'edge_to_edge') ? s : null
}
function validEnv(e: any): EnvironmentID | null {
  return (e === 'in_situ' || e === 'desk' || e === 'gallery') ? e : null
}
function validAtmosphere(a: any): AtmosphereID | null {
  const valid = [
    'golden', 'peaceful_dawn', 'vivid_midday', 'dusk_blue_hour',
    'dramatic_storm', 'deep_night', 'fog_rolled_in',
    'after_rain', 'snow_falling', 'aurora_surreal',
  ]
  return valid.includes(a) ? a : null
}

// Build the not_recommended list from static rules + image-specific
// surface→material incompatibilities. UI uses this to grey out tiles.
function buildNotRecommended(analyzer: AnalyzerResult): CuratorResult['not_recommended'] {
  const list: CuratorResult['not_recommended'] = []

  // Static rules (e.g. material + in_situ)
  for (const rule of STATIC_EDITORIAL_GUIDANCE.not_recommended) {
    list.push({ when: { ...rule.when }, reason: rule.reason })
  }

  // Image-specific: materials that don't suit this place's primary surface.
  // For every material NOT in the compatibility list for this surface,
  // mark it as not recommended.
  const compatible = new Set(MATERIAL_COMPATIBILITY[analyzer.primary_surface] || [])
  const allMaterials = Object.keys(MATERIAL_LABELS) as MaterialID[]
  for (const mat of allMaterials) {
    if (compatible.has(mat)) continue
    list.push({
      when:   { mainKind: 'material', material: mat },
      reason: `${MATERIAL_LABELS[mat]} doesn't typically suit ${SURFACE_LABELS[analyzer.primary_surface].toLowerCase()} places.`,
    })
  }

  return list
}
