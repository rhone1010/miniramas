// lib/structure/scoreImage.ts
// Pass-scoped scoring with strict thresholds.
// Each pass scores ONLY what it is responsible for.
// Out-of-scope elements appearing early are penalised.
// Pass 1: structure only (geometry, roof, massing)
// Pass 2: composition only (base, framing, margins, camera)
// Pass 3: realism (materials, landscaping, lighting, finish)

import { AnchorBlueprint } from './extractBlueprint'

const SCORING_ENABLED = false

export type ScoringPass = 1 | 2 | 3

export interface AnchorScore {
  anchor_id:  string
  type:       'structure' | 'layout' | 'composition'
  identity:   boolean
  importance: number
  preserved:  boolean
  score:      number
  reason:     string
  evidence:   string
  notes?:     string
}

export interface StructuralValidation {
  main_mass_correct:            boolean
  porch_type_correct:           boolean | null
  porch_wrap_direction_correct: boolean | null
  side_extension_present:       boolean | null
  roof_orientation_correct:     boolean
  stairs_invented:              boolean
  hard_structural_failure:      boolean
}

export interface DimensionScores {
  // Pass 1
  geometry?:      number   // /40
  roof_fidelity?: number   // /35
  massing?:       number   // /25
  footprint?:     number   // /15 — landscape footprint established
  // Pass 2
  base_shape?:    number   // /35
  outer_margins?: number   // /30
  inner_margins?: number   // /20
  camera_angle?:  number   // /15
  // Pass 3
  materials?:     number   // /25
  landscaping?:   number   // /25
  lighting?:      number   // /25
  realism?:       number   // /25
}

export interface AnchorScorecard {
  pass:                   ScoringPass
  anchor_scores:          AnchorScore[]
  failed_anchors:         Array<{ id: string; importance: number; description: string; type: string; identity: boolean }>
  structural_validation:  StructuralValidation
  dimensions:             DimensionScores
  structure_score:        number
  layout_score:           number
  miniature_score:        number
  aesthetic_score:        number
  diorama_quality: {
    base: number; three_d: number; materials: number; landscaping: number
    subtotal: number; notes: string
  }
  composition: { camera_angle: number; framing: number; subtotal: number; notes: string }
  finish:      { quality: number; subtotal: number }
  raw_total:              number
  penalties:              Record<string, number>
  hard_cap_applied:       boolean
  hard_cap_reason:        string | null
  final_score:            number
  hard_structural_failure: boolean
  identity_pass:          boolean
  hard_failures:          string[]
  status:                 'complete' | 'needs_improvement'
  primary_failure:        string
  failure_summary:        string
}

// ── PASSTHROUGH ───────────────────────────────────────────────────────────────

function buildPassthrough(pass: ScoringPass): AnchorScorecard {
  return {
    pass,
    anchor_scores: [], failed_anchors: [],
    structural_validation: {
      main_mass_correct: true, porch_type_correct: null,
      porch_wrap_direction_correct: null, side_extension_present: null,
      roof_orientation_correct: true, stairs_invented: false, hard_structural_failure: false,
    },
    dimensions: {}, structure_score: 0, layout_score: 0, miniature_score: 0, aesthetic_score: 0,
    diorama_quality: { base:0, three_d:0, materials:0, landscaping:0, subtotal:0, notes:'passthrough' },
    composition: { camera_angle:0, framing:0, subtotal:0, notes:'passthrough' },
    finish: { quality:0, subtotal:0 },
    raw_total: 0, penalties: {}, hard_failures: [], hard_cap_applied: false, hard_cap_reason: null, final_score: 0,
    hard_structural_failure: false, identity_pass: false,
    status: 'needs_improvement', primary_failure: 'scoring_disabled', failure_summary: 'scoring disabled',
  }
}

// ── PASS 1 PROMPT — STRUCTURE ONLY ───────────────────────────────────────────

function buildPass1Prompt(blueprint: AnchorBlueprint): string {
  const geo        = blueprint.geometry
  const anchors    = blueprint.anchors.filter(a => a.type === 'structure')
  const projCount  = geo?.patterns?.projection_count || 0
  const planeCount = geo?.patterns?.facade_plane_count || 1
  const hasPorch   = anchors.some(a => a.description.toLowerCase().includes('porch'))
  const hasSideVol = anchors.some(a => a.description.toLowerCase().includes('extension'))
  const isMansard  = blueprint.semantic_notes?.some(n => n.toLowerCase().includes('mansard')) ||
    anchors.some(a => a.description.toLowerCase().includes('mansard'))

  const anchorList = anchors
    .sort((a,b) => b.importance - a.importance)
    .map(a => `{ "id": "${a.id}", "importance": ${a.importance}, "description": "${a.description}" }`)
    .join(',\n    ')

  return `You are scoring PASS 1 — STRUCTURE ONLY.

Score ONLY whether the building geometry is correct.
DO NOT score materials, landscaping, lighting, or base quality.
Ignore placeholder or unfinished appearance — that is expected at this stage.

${isMansard ? 'CRITICAL: MANSARD roof — steeply pitched lower slopes all sides, flatter upper deck. Wrong roof type = roof_fidelity 0-10 maximum.' : ''}

ANCHORS:
[ ${anchorList} ]

GEOMETRY:
- Forward projections: ${projCount}
- Facade planes: ${planeCount}
- Silhouette: ${geo?.patterns?.structural_silhouette || 'unknown'}
- Roof: ${geo?.roof?.primary_orientation || '?'} ridge · complexity: ${geo?.roof?.complexity || '?'} · higher: ${geo?.roof?.higher_side || '?'}

SCORING DIMENSIONS:

footprint (0-15): Landscape footprint established
  15 = ground plane extends naturally beyond building on all sides — feels like a property
  10 = some ground extension but uneven or too tight
  5  = building sits on minimal platform with no surrounding ground
  0  = no landscape footprint — building fills the base

geometry (0-40): Overall structural accuracy
  40 = masses correct, projections visible and forward, porch correct, windows correctly placed
  25 = mostly right, one significant element wrong
  10 = major structural errors
  0  = completely unrecognisable

roof_fidelity (0-35): Roof type, pitch, and complexity
  35 = correct roof TYPE and complexity, correct pitch, dormers if present
  20 = roughly right type, details or pitch wrong
  5  = wrong roof type entirely
  0  = no recognisable roof

massing (0-25): Proportions, height relationships, footprint
  25 = building proportions exactly match source — height, width, depth ratios correct
  15 = proportions roughly right, minor drift
  5  = significantly wrong proportions
  0  = unrecognisable massing

PENALTIES — apply these on top of dimension scores:
- Window proportion drift (windows too large/small/wrongly spaced): -5 from geometry
- Porch depth inaccuracy (porch too shallow/deep vs source): -5 from geometry
- Roof pitch deviation (pitch significantly steeper/shallower than source): -8 from roof_fidelity
- Architectural detail loss (major decorative elements missing): -5 from geometry
- Stairs invented (not in source): -10 from geometry

CALIBRATION:
100 = perfect structure, every element exactly right
85  = strong, one minor element slightly off
70  = recognisable, one significant element wrong
50  = major structural element wrong
30  = multiple major failures
0   = unrecognisable

DO NOT give 100 unless every element is provably correct.

Return ONLY this JSON:
{
  "anchor_scores": [
    { "anchor_id": "<id>", "type": "structure", "identity": true, "importance": 0, "preserved": true, "score": 0.0, "reason": "", "evidence": "", "notes": "" }
  ],
  "structural_validation": {
    "main_mass_correct": true,
    "porch_type_correct": ${hasPorch ? 'true' : 'null'},
    "porch_wrap_direction_correct": ${hasPorch ? 'true' : 'null'},
    "side_extension_present": ${hasSideVol ? 'true' : 'null'},
    "roof_orientation_correct": true,
    "stairs_invented": false
  },
  "dimensions": { "geometry": 0, "roof_fidelity": 0, "massing": 0, "footprint": 0 },
  "penalties": { "window_drift": 0, "porch_depth": 0, "roof_pitch": 0, "detail_loss": 0, "stairs": 0 },
  "failures": [
    { "type": "roof_type_failure|projection_integrity_failure|massing_failure|window_drift|porch_depth_failure", "severity": 0.0, "dimension": "geometry", "fix": "" }
  ],
  "primary_failure": "",
  "failure_summary": ""
}`
}


// ── PASS 2 PROMPT — COMPOSITION ─────────────────────────────────────────────

function buildPass2Prompt(): string {
  return `You are scoring PASS 2 — BASE QUALITY AND FOOTPRINT ONLY.

Score ONLY the diorama base and building footprint on the base.
DO NOT score outer margins, frame edges, or camera distance.
Margins and framing are handled by the compositor after generation — do not penalise them here.
DO NOT score materials, landscaping, structural accuracy, or lighting quality.

WHAT TO SCORE:
- Is the base circular and premium?
- Is the full base visible (not cropped by image edge)?
- Is the building occupying a reasonable portion of the base (not filling it entirely)?
- Is there visible ground between building walls and base edge?

STRICT DIMENSION SCORING:

base_shape (0-35):
  35 = clearly CIRCULAR dark walnut base, premium, full base visible including bottom edge
  20 = circular but partially cropped OR wrong shape
  5  = barely visible or undefined
  0  = no base or square/rectangular

inner_margins (0-35):
  35 = clear visible ground between building walls and base edge on all sides — building not flush with base
  20 = some ground visible but building close to base edge on one or more sides
  8  = building nearly fills base — very little ground visible
  0  = building fills base completely — no ground visible at base edge

camera_angle (0-30):
  30 = 30-45 degree overhead angle — clearly looking down at a miniature object
  20 = roughly right angle but slightly off
  10 = too frontal or too steep
  0  = flat-on or completely wrong

HARD FLOOR RULES:
  If base is square/rectangular: base_shape maximum 15
  If building fills base completely: inner_margins = 0, total capped at 50
  If camera is flat-on (0 degrees): camera_angle = 0

CALIBRATION:
  100 = circular base fully visible, clear ground around building, correct overhead angle
  85  = nearly right, one element slightly off
  70  = base good but building slightly close to edge
  50  = square base OR building fills base
  Note: Do NOT penalise tight outer frame margins — compositor handles those.

Return ONLY this JSON:
{
  "dimensions": { "base_shape": 0, "inner_margins": 0, "camera_angle": 0 },
  "failures": [
    { "type": "base_physicality_failure|inner_margin_failure|camera_failure", "severity": 0.0, "dimension": "base_shape", "fix": "" }
  ],
  "diorama_quality": { "base": 0, "three_d": 0, "materials": 0, "landscaping": 0, "subtotal": 0, "notes": "" },
  "composition_detail": { "camera_angle": 0, "framing": 0, "subtotal": 0, "notes": "" },
  "primary_failure": "",
  "failure_summary": ""
}`
}


// ── PASS 3 PROMPT — REALISM + PERCEPTUAL FIDELITY ───────────────────────────

function buildPass3Prompt(): string {
  return `You are scoring PASS 3 — REALISM, MATERIAL QUALITY, AND PERCEPTUAL FIDELITY.

DO NOT score structural accuracy or base/framing — those were passes 1 and 2.

This pass enforces identity-preserving transformation:
The output must feel like the SAME object as the source — not beautified or idealized.

─────────────────────────────────────────────────────────
HARD FAILURE CONDITIONS — if any of these are true, cap total at 45:
- Surface appears flat (no visible texture): FAIL — materials max 8
- No visible micro texture on any surface: FAIL — materials max 5
- Uniform color blocks (no tonal variation): FAIL — materials max 5
- Grass appears as flat green surface: FAIL — landscaping max 8
- Roof lacks individual shingle/tile variation: FAIL — materials -8 penalty
- Soft flat lighting (no key/fill separation): FAIL — lighting max 10
- No highlight contrast on raised surfaces: FAIL — lighting -5 penalty
- Shadow direction inconsistent: FAIL — lighting -5 penalty
─────────────────────────────────────────────────────────

DIMENSION SCORING:

materials (0-25): Physical material realism with micro-detail
  Score each check — deduct for each failure:
  ✓ Micro texture visible on surfaces (+5)
  ✓ Tonal variation present — no flat color planes (+5)
  ✓ Edge wear or imperfection visible on corners/trim (+5)
  ✓ Correct material reflectivity — satin paint, soft wood, sharp glass (+5)
  ✓ No plastic/uniform/toy-like finish (+5)
  If grass is flat uniform green: -5
  If roof has no shingle variation: -8
  25 = all checks pass
  0  = flat CGI surfaces throughout

landscaping (0-25): Property environment quality and coverage
  25 = full footprint covered — layered grass, varied shrubs, stone path, restrained
  18 = good coverage, mostly convincing
  10 = flat grass only OR footprint not fully covered
  5  = sparse decoration on minimal base
  0  = no landscaping or bare base
  NOTE: flat uniform grass = maximum 8

lighting (0-25): Lighting reveals surface detail
  Lighting must ACTIVELY REVEAL surface texture — not flatter it.
  ✓ Defined key + fill separation — not flat ambient (+7)
  ✓ Highlight contrast on raised surfaces: roof edges, trim, sills (+6)
  ✓ Shadow direction consistent throughout — single source logic (+6)
  ✓ Warm temperature appropriate for studio product shot (+6)
  If lighting is soft/flat and HIDES surface texture: lighting maximum 10
  25 = all checks pass, textures clearly revealed by light
  0  = flat, cold, or concealing lighting

realism (0-25): Photorealistic physical object + perceptual fidelity
  The output must match the source CHARACTER, not just its structure.
  25 = photorealistic AND matches source mood/color/material character
  18 = very convincing, minor departure from source character
  10 = looks generated, significant character drift
  0  = obvious CGI or completely wrong character

─────────────────────────────────────────────────────────
PERCEPTUAL FIDELITY PENALTIES (applied to realism score):

COLOR ACCURACY:
  - Over-warmed vs source (warmer than source): -5
  - Oversaturated vs source: -5
  - Hue drift from source palette: -3
  - Colors idealized/beautified beyond source: -5

MATERIAL AUTHENTICITY:
  - Uniform/clean when source shows age or wear: -5
  - Storybook or toy-like finish: -5
  - Generic surfaces ignoring source character: -5

STYLE:
  - Exaggerated contrast vs source: -3
  - Storybook aesthetic (too clean, too perfect): -5
  - Over-stylized beyond source mood: -5
─────────────────────────────────────────────────────────

TARGET: Premium museum gift shop miniature that LOOKS LIKE the specific source subject —
same colors, same material character, same mood. Not a generic pretty house.

CALIBRATION:
  100 = photorealistic, matches source character exactly, all textures revealed by lighting
  85  = very convincing, minor departure from source
  70  = good quality, some flat surfaces or character drift
  50  = mixed quality or significant departure
  0   = CGI render or wrong character

Return ONLY this JSON:
{
  "dimensions": { "materials": 0, "landscaping": 0, "lighting": 0, "realism": 0 },
  "hard_failures": [],
  "penalties": {
    "over_warmed": 0, "oversaturated": 0, "hue_drift": 0, "uniform_materials": 0,
    "storybook_look": 0, "flat_grass": 0, "no_shingle_variation": 0,
    "flat_lighting": 0, "no_highlight_contrast": 0, "shadow_inconsistency": 0,
    "no_micro_texture": 0, "no_tonal_variation": 0
  },
  "failures": [
    { "type": "material_flat_failure|landscaping_failure|lighting_concealing_failure|realism_failure|perceptual_fidelity_failure", "severity": 0.0, "dimension": "materials", "fix": "" }
  ],
  "finish": { "quality": 0, "subtotal": 0 },
  "primary_failure": "",
  "failure_summary": ""
}`
}


// ── CALL SCORER ───────────────────────────────────────────────────────────────

async function callScorer(imageBase64: string, prompt: string, openaiApiKey: string): Promise<any> {
  const controller = new AbortController()
  const timeout    = setTimeout(() => controller.abort(), 60000)  // 60s timeout for scoring

  let response: Response
  try {
    response = await fetch('https://api.openai.com/v1/chat/completions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiApiKey}` },
      signal:  controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o', max_tokens: 2000,  // reduced from 3000 to speed up response
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}`, detail: 'high' } },
          { type: 'text', text: prompt },
        ]}],
      }),
    })
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('[scoreImage] Scoring timed out after 60s')
    } else {
      console.error('[scoreImage] Fetch error:', err.message)
    }
    return null
  } finally {
    clearTimeout(timeout)
  }
  if (!response.ok) {
    console.error('[scoreImage] HTTP', response.status)
    return null
  }
  const data = await response.json()
  const raw  = data.choices?.[0]?.message?.content || ''
  if (raw.trim().startsWith("I'm sorry") || raw.trim().startsWith("I cannot")) return null
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  let json = cleaned
  if (!json.endsWith('}')) {
    const opens = (json.match(/[{[]/g) || []).length
    const closes = (json.match(/[}\]]/g) || []).length
    for (let i = 0; i < opens - closes; i++) json += '}'
  }
  try { return JSON.parse(json) } catch {
    console.error('[scoreImage] JSON parse failed, raw length:', raw.length)
    return null
  }
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export async function scoreImage(
  imageBase64:  string,
  blueprint:    AnchorBlueprint,
  openaiApiKey: string,
  pass:         ScoringPass = 1
): Promise<AnchorScorecard> {

  if (!SCORING_ENABLED) return buildPassthrough(pass)

  let prompt: string
  if (pass === 1)      prompt = buildPass1Prompt(blueprint)
  else if (pass === 2) prompt = buildPass2Prompt()
  else                 prompt = buildPass3Prompt()

  const result = await callScorer(imageBase64, prompt, openaiApiKey)
  if (!result) return buildPassthrough(pass)

  const dims: DimensionScores = result.dimensions || {}
  const failures = result.failures || []

  // Raw total — sum only the dimensions for this pass
  let rawTotal = 0
  Object.values(dims).forEach((v: any) => { if (typeof v === 'number') rawTotal += v })

  // Apply explicit penalties from scorer
  const penalties = result.penalties || {}
  let penaltyTotal = 0
  Object.values(penalties).forEach((v: any) => { if (typeof v === 'number') penaltyTotal += Math.abs(v) })
  if (penaltyTotal > 0) {
    console.log(`[scoreImage] Pass ${pass} — applying ${penaltyTotal}pts penalties:`, penalties)
    rawTotal = Math.max(0, rawTotal - penaltyTotal)
  }

  // Hard failure enforcement for pass 3
  const hardFailures: string[] = result.hard_failures || []
  if (pass === 3 && hardFailures.length > 0) {
    const hardCap = 45
    if (rawTotal > hardCap) {
      console.warn(`[scoreImage] Pass 3 hard failures detected: ${hardFailures.join(', ')} — capping at ${hardCap}`)
      rawTotal = Math.min(rawTotal, hardCap)
    }
  }

  rawTotal = Math.min(100, rawTotal)

  // Penalties and hard floor rules
  let capReason: string | null = null
  const sv = result.structural_validation || {}
  if (sv.stairs_invented) {
    rawTotal = Math.max(0, rawTotal - 10)
    capReason = 'Stairs invented (−10)'
  }

  // Pass 2 hard floors — base and inner margins only, outer margins owned by compositor
  if (pass === 2) {
    const innerMargins = dims.inner_margins ?? 0
    const baseShape    = dims.base_shape ?? 0

    // If base is completely absent: cap at 40
    if (baseShape === 0) {
      rawTotal = Math.min(rawTotal, 40)
      capReason = 'No circular base detected (capped at 40)'
      console.warn('[scoreImage] Pass 2: no base detected, capping at 40')
    }
    // If building fills base completely: cap at 50
    else if (innerMargins === 0) {
      rawTotal = Math.min(rawTotal, 50)
      capReason = 'Building fills base — no inner margin (capped at 50)'
      console.warn('[scoreImage] Pass 2 inner margin floor applied')
    }
  }

  // Pass 1 hard floor: if roof_fidelity is 0, total cannot exceed 55
  if (pass === 1 && (dims.roof_fidelity ?? 0) === 0) {
    rawTotal = Math.min(rawTotal, 55)
    capReason = 'Roof completely wrong — structure pass capped at 55'
  }

  const finalScore = Math.min(100, Math.max(0, Math.round(rawTotal)))
  const capApplied = capReason !== null

  // Anchor scores (pass 1 only)
  const anchorScores: AnchorScore[] = result.anchor_scores || []
  const validation: StructuralValidation = {
    main_mass_correct:            sv.main_mass_correct ?? true,
    porch_type_correct:           sv.porch_type_correct ?? null,
    porch_wrap_direction_correct: sv.porch_wrap_direction_correct ?? null,
    side_extension_present:       sv.side_extension_present ?? null,
    roof_orientation_correct:     sv.roof_orientation_correct ?? true,
    stairs_invented:              sv.stairs_invented ?? false,
    hard_structural_failure:      false,
  }

  const identityAnchors      = blueprint.anchors.filter(a => (a as any).identity === true && a.type === 'structure')
  const identityAnchorScores = anchorScores.filter(as => as.identity === true)
  const identityPass = identityAnchors.length === 0
    ? true
    : identityAnchorScores.length > 0 && identityAnchorScores.every(as => as.preserved)

  const failedAnchors = anchorScores.filter(as => !as.preserved).map(as => ({
    id: as.anchor_id, importance: as.importance,
    description: blueprint.anchors.find(a => a.id === as.anchor_id)?.description || '',
    type: as.type || 'structure', identity: as.identity || false,
  }))

  for (const f of failures) {
    if (!failedAnchors.find(fa => fa.id === f.type)) {
      failedAnchors.push({
        id: f.type, importance: Math.round((f.severity || 0.5) * 10),
        description: f.fix || '', type: 'structure', identity: false,
      })
    }
  }

  const dq   = result.diorama_quality   || { base:0, three_d:0, materials:0, landscaping:0, subtotal:0, notes:'' }
  const comp = result.composition_detail || result.composition || { camera_angle:0, framing:0, subtotal:0, notes:'' }
  const fin  = result.finish            || { quality:0, subtotal:0 }

  console.log(`[scoreImage] Pass ${pass}: ${finalScore}/100 — ${JSON.stringify(dims)}`)

  return {
    pass,
    anchor_scores:           anchorScores,
    failed_anchors:          failedAnchors,
    structural_validation:   validation,
    dimensions:              dims,
    structure_score:         (dims.geometry || 0) + (dims.roof_fidelity || 0),
    layout_score:            (dims.base_shape || 0) + (dims.outer_margins || 0),
    miniature_score:         dims.materials || 0,
    aesthetic_score:         (dims.lighting || 0) + (dims.realism || 0),
    diorama_quality:         dq,
    composition:             comp,
    finish:                  fin,
    raw_total:               rawTotal,
    penalties:               result.penalties || {},
    hard_failures:           hardFailures,
    hard_cap_applied:        capApplied,
    hard_cap_reason:         capReason,
    final_score:             finalScore,
    hard_structural_failure: false,
    identity_pass:           identityPass,
    status:                  finalScore >= 85 ? 'complete' : 'needs_improvement',
    primary_failure:         result.primary_failure || (failedAnchors[0]?.id ?? 'none'),
    failure_summary:         result.failure_summary || '',
  }
}
