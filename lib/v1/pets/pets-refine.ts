// lib/v1/pets/pets-refine.ts
//
// Detection, scoring, and source analysis for the Pets silo. Mirrors
// portraits-refine.ts with the human-face vocabulary replaced by the
// Pets identity system (Rich's 2026-06-05 spec).
//
// Exports:
//   • detectPetVisibility  — pre-flight gate on the source photo.
//   • scorePetFidelity     — single-animal identity scoring. Returns one
//                            PerFigureScore for the hero pet.
//   • analyzePetSourceSet  — multi-photo analyzer used by /analyze route.
//                            Returns subject_count_estimate, quality
//                            verdict, recommendation, pet_coverage.
//
// Field-name discipline: the route consumes exactly what this module
// returns (the Groups route/engine mismatch bug must not recur here).

import OpenAI from 'openai'
import sharp from 'sharp'
import type { PerFigureScore } from './pets-shared'

// ─── TWEAK SANITIZER ────────────────────────────────────────────
export function sanitizeTweak(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  let s = raw.trim()
  if (!s) return undefined
  s = s.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ')
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x1F\x7F]/g, '')
  if (s.length > 200) s = s.slice(0, 200)
  return s || undefined
}

// ═══════════════════════════════════════════════════════════════
// PRE-FLIGHT PET VISIBILITY DETECTION
// ═══════════════════════════════════════════════════════════════
// Asks for an animal count so the silo can warn the user when the
// source has multiple animals but they've asked for a single-subject
// piece. The hero pick is left to NB2 (it reliably picks the photo's
// compositional subject given a single-subject prompt).

const PET_VISIBILITY_PROMPT = `You are looking at a source photograph that will be used to generate a miniature pet sculpture.

Your job is to:
1. Determine whether at least one HERO ANIMAL is clearly visible.
2. Count the HERO ANIMALS in the photograph — pets clearly intended as the focal subject(s), not background animals.
3. Profile each hero animal's COAT, exactly as visible in this photograph (not breed-typical) — sculptors need the true fur length and volume.
4. Report each hero animal's DISTINCTIVE PHYSICAL FEATURES — permanent, clearly visible traits that make this individual recognizable: a clouded, milky, squinted-shut, or missing eye, mismatched eye colors, a torn or notched ear, a missing or shortened limb, a kinked or docked tail, a visible scar, a snaggletooth or protruding tongue, unusual asymmetry. STRICT RULES: report ONLY what is clearly visible in this photograph — never infer, never guess, never report breed-normal traits. Describe locations as seen in the photograph (e.g. "the eye on the left side of the photo"). If an animal has no clearly visible distinctive features, return an empty list for it. Maximum 3 features per animal, each described in 12 words or fewer.

A HERO ANIMAL is one that:
- Is prominently positioned (foreground or compositionally central)
- Is in focus or near-focus
- Occupies enough of the frame that an artist could sculpt a recognizable likeness of this specific animal
- Appears intentional to the photo

EXCLUDE distant animals, animals walking through the background, or animals too small or blurry to identify individually. Humans in the photo are not counted — only the animal subjects.

For Pets, the silo will render the most prominent hero animal if multiple are present — so reporting more than one is fine.

For each hero animal's coat, choose from these EXACT vocabularies, judging from what the photo shows (when in doubt between two lengths, choose the SHORTER — over-estimating fur length is the common error):
- coat_length: "short" | "medium" | "long"
- coat_texture: "sleek" | "dense" | "plush" | "wiry" | "curly" | "fluffy"
- tail: "slim" | "brush" | "plumed" | "bobbed" | "curled" | "not_visible"

Respond with ONLY a JSON object:
{
  "pet_visible": <boolean — at least one usable hero animal is visible>,
  "subject_count_estimate": <int 1-20 — number of hero animals>,
  "coats": [
    { "animal_index": 0, "coat_length": "short", "coat_texture": "dense", "tail": "slim" }
  ],
  "features": [
    { "animal_index": 0, "traits": ["the eye on the left side of the photo is clouded and pale"] }
  ],
  "reason": "<short, one sentence>"
}

List coats in order of prominence (most prominent animal first). No preamble, no markdown.`

export interface PetCoatProfile {
  animal_index: number
  coat_length:  'short' | 'medium' | 'long'
  coat_texture: 'sleek' | 'dense' | 'plush' | 'wiry' | 'curly' | 'fluffy'
  tail:         'slim' | 'brush' | 'plumed' | 'bobbed' | 'curled' | 'not_visible'
}

export interface PetFeatureProfile {
  animal_index: number
  traits:       string[]   // ≤3, each ≤12 words, viewer-frame locations
}

export async function detectPetVisibility(input: {
  sourceImageB64: string
  openaiApiKey:   string
}): Promise<{ pet_visible: boolean; subject_count_estimate: number; coats: PetCoatProfile[]; features: PetFeatureProfile[]; reason: string }> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const response = await openai.chat.completions.create({
    model:           'gpt-4o',
    max_tokens:      400,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.sourceImageB64}`, detail: 'high' } },
        { type: 'text', text: PET_VISIBILITY_PROMPT },
      ],
    }],
  })

  const content = (response.choices[0]?.message?.content || '{}').trim()
  try {
    const parsed = JSON.parse(content)
    const LENGTHS  = ['short', 'medium', 'long']
    const TEXTURES = ['sleek', 'dense', 'plush', 'wiry', 'curly', 'fluffy']
    const TAILS    = ['slim', 'brush', 'plumed', 'bobbed', 'curled', 'not_visible']
    const coats: PetCoatProfile[] = (Array.isArray(parsed.coats) ? parsed.coats : [])
      .slice(0, 20)
      .map((c: any, i: number) => ({
        animal_index: Number.isFinite(Number(c.animal_index)) ? Number(c.animal_index) : i,
        coat_length:  LENGTHS.includes(c.coat_length)   ? c.coat_length  : 'short',
        coat_texture: TEXTURES.includes(c.coat_texture) ? c.coat_texture : 'dense',
        tail:         TAILS.includes(c.tail)            ? c.tail         : 'not_visible',
      }))
    const features: PetFeatureProfile[] = (Array.isArray(parsed.features) ? parsed.features : [])
      .slice(0, 20)
      .map((f: any, i: number) => ({
        animal_index: Number.isFinite(Number(f.animal_index)) ? Number(f.animal_index) : i,
        traits: (Array.isArray(f.traits) ? f.traits : [])
          .slice(0, 3)
          .map((t: any) => String(t).slice(0, 90))
          .filter((t: string) => t.trim().length > 0),
      }))
      .filter((f: PetFeatureProfile) => f.traits.length > 0)
    return {
      pet_visible:            Boolean(parsed.pet_visible),
      subject_count_estimate: Math.max(1, Math.min(20, Number(parsed.subject_count_estimate) || 1)),
      coats,
      features,
      reason:                 String(parsed.reason || 'no reason given').slice(0, 200),
    }
  } catch {
    return { pet_visible: true, subject_count_estimate: 1, coats: [], features: [], reason: 'detection parse failed' }
  }
}

// ═══════════════════════════════════════════════════════════════
// PET IDENTITY FIDELITY SCORING
// ═══════════════════════════════════════════════════════════════
// One animal in, one PerFigureScore out. Pass threshold ≥8/10 by
// default (see PET_LIKENESS_THRESHOLD in pets-shared.ts). The scoring
// checklist mirrors the PET IDENTITY spec — the scorer checks for the
// same things the prompt demands.

const PET_SCORE_PROMPT = `You are scoring a single-subject pet sculpture render against the source photograph.

The render has been intentionally stylized as a sculpted figure (bronze, stone, wood, ceramic, plush, etc.) — the material register is correct and should NOT factor into your score. Score ONLY identity preservation of the specific animal.

Compare the rendered animal to the hero pet in the source:
- Is the rendered animal recognizable as the same INDIVIDUAL animal — not merely the same breed or species?
- Are head shape and skull proportions, muzzle length and profile, nose shape, eye shape/size/spacing, and ear shape/size/placement/posture preserved?
- Is the marking PATTERN preserved — facial markings, blaze patterns, spots, patches, socks, chest markings, color transitions? In single-material sculptures (bronze, stone, wood, alabaster), markings should read as tonal/patina/grain variation following the source pattern; absence of the pattern is drift.
- Is the COAT faithful — the same fur length, volume, and texture as the source? Fur length/volume drift is a MAJOR error: if the source animal has a short or medium coat and the render shows long, flowing, luxuriant fur (or the reverse), score no higher than 6 even when the markings are correct. A plumed flowing tail on a slim-tailed animal is the same error.
- Are apparent age cues (grey muzzle, juvenile or senior characteristics), body proportions, posture, tail carriage, and paw placement preserved?
- Are DISTINCTIVE PHYSICAL FEATURES preserved — a clouded or missing eye, a notched ear, a missing limb, a kinked tail, a scar, mismatched eyes? These traits ARE the animal's identity. If the source shows such a feature and the render has corrected, healed, opened, brightened, or otherwise normalized it, score no higher than 5 regardless of everything else.
- Is the EXPRESSION preserved — the same alertness, head angle, ear posture, and mouth position as the source, not a generic "happy pet" expression?
- Would the pet's owner recognize their specific animal in this render?

Score scale:
- 9-10: Excellent likeness, the specific animal is fully recognizable, commercial-grade
- 7-8:  Good likeness, recognizable as this animal, minor drift in markings or proportions
- 5-6:  Close but noticeably off — pattern simplified or proportions drifting toward breed-average
- 3-4:  Significant drift, identity compromised — reads as the breed, not the individual
- 1-2:  Generic breed-average animal, no meaningful preservation of this specific pet's identity

If the source has multiple animals, score the rendered animal against whichever source animal the render most clearly depicts (the most prominent or central source animal).

Respond with ONLY a JSON object:
{
  "score":  <int 1-10>,
  "reason": "<short, one sentence — name the strongest evidence and any drift>"
}

No preamble, no markdown.`

// When the render deliberately re-stages the pose (Actions feature),
// the scorer must not penalize pose/expression differences — only
// structural identity. This context paragraph is prepended for any
// action other than 'as_photographed'.
function actionScoringContext(actionLabel?: string): string {
  if (!actionLabel) return ''
  return `IMPORTANT CONTEXT: The render intentionally RE-STAGES the animal in a "${actionLabel}" pose — the pose was deliberately changed from the source. Do NOT penalize differences in posture, pose, stance, tail position, paw placement, eye openness, or expression versus the source; these are intentional. EXCEPTION: permanent physical conditions are NOT pose — a clouded, milky, damaged, or missing eye, a notched ear, a missing limb, or a scar in the source must still appear in the render; "eye openness" never excuses a healed or normalized eye. Score ONLY structural identity: head shape, muzzle, nose, ears, marking pattern, distinctive physical features, coat (fur length, volume, and texture must still match the source exactly — the action changes the pose, never the coat), apparent age, and body proportions/build.\n\n`
}

export async function scorePetFidelity(input: {
  sourceImageB64:   string
  renderedImageB64: string
  openaiApiKey:     string
  // Label of the active re-staging action (e.g. 'Sleeping'); omit for
  // as-photographed renders.
  actionLabel?:     string
}): Promise<PerFigureScore> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const response = await openai.chat.completions.create({
    model:           'gpt-4o-mini',
    max_tokens:      400,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.sourceImageB64}`,   detail: 'high' } },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.renderedImageB64}`, detail: 'high' } },
        { type: 'text', text: actionScoringContext(input.actionLabel) + PET_SCORE_PROMPT },
      ],
    }],
  })

  const content = (response.choices[0]?.message?.content || '{}').trim()
  try {
    const parsed = JSON.parse(content)
    const score = Math.max(1, Math.min(10, Number(parsed.score) || 1))
    return {
      figure_index: 0,
      score,
      reason:       String(parsed.reason || 'no reason given').slice(0, 200),
    }
  } catch {
    return { figure_index: 0, score: 1, reason: 'score parse failed' }
  }
}

// ═══════════════════════════════════════════════════════════════
// MULTI-PET IDENTITY SCORING (2–5 animals)
// ═══════════════════════════════════════════════════════════════
// Group renders score each animal separately. Same checklist as the
// single scorer, applied per animal, plus an arrangement check folded
// into each reason. Evaluation (every animal ≥ threshold) lives in
// pets-shared.ts evaluateMultiPetScores.

const MULTI_PET_SCORE_PROMPT_TEMPLATE = (count: number) => `You are scoring a multi-pet sculpture render against the source photograph. The source shows ${count} hero animals rendered together as one sculpted group piece.

The render has been intentionally stylized as a sculpted group (bronze, stone, wood, ceramic, plush, etc.) — the material register is correct and should NOT factor into your scores. Score ONLY identity preservation, one score PER ANIMAL.

Match each rendered animal to its source animal by position and size, then for EACH animal assess:
- Is it recognizable as the same INDIVIDUAL animal — not merely the same breed or species?
- Head shape, muzzle length and profile, nose, eye shape/spacing, ear shape/placement/posture preserved?
- Marking PATTERN preserved — facial markings, blazes, spots, patches, socks, color transitions? In single-material sculptures, markings should read as tonal/patina/grain variation following the source pattern; absence of the pattern is drift.
- COAT faithful — same fur length, volume, and texture as the source? Short/medium coats rendered as long flowing fur (or the reverse) cap that animal's score at 6, even with correct markings.
- DISTINCTIVE FEATURES preserved — clouded/missing eyes, notched ears, missing limbs, kinked tails, scars? Normalizing such a feature caps that animal's score at 5.
- Apparent age cues, body proportions relative to the other animals, posture, tail carriage, and expression preserved?
- Would this animal's owner recognize their specific pet?

Also penalize, in the relevant animal's score: missing animals, merged animals, invented extra animals, or swapped positions/sizes between animals.

Score scale per animal:
- 9-10: Excellent likeness, fully recognizable, commercial-grade
- 7-8:  Good likeness, recognizable, minor drift
- 5-6:  Close but noticeably off — pattern simplified or drifting toward breed-average
- 3-4:  Significant drift — reads as the breed, not the individual
- 1-2:  Generic animal, missing, or merged with another animal

Index animals left-to-right as they appear in the SOURCE photograph, starting at 0. Return exactly ${count} entries.

Respond with ONLY a JSON object:
{
  "scores": [
    { "animal_index": 0, "score": <int 1-10>, "reason": "<short, one sentence>" }
  ]
}

No preamble, no markdown.`

export async function scoreMultiPetFidelity(input: {
  sourceImageB64:   string
  renderedImageB64: string
  subjectCount:     number
  openaiApiKey:     string
  actionLabel?:     string
}): Promise<PerFigureScore[]> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const response = await openai.chat.completions.create({
    model:           'gpt-4o-mini',
    max_tokens:      700,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.sourceImageB64}`,   detail: 'high' } },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.renderedImageB64}`, detail: 'high' } },
        { type: 'text', text: actionScoringContext(input.actionLabel) + MULTI_PET_SCORE_PROMPT_TEMPLATE(input.subjectCount) },
      ],
    }],
  })

  const content = (response.choices[0]?.message?.content || '{}').trim()
  try {
    const parsed = JSON.parse(content)
    const raw: any[] = Array.isArray(parsed.scores) ? parsed.scores : []
    if (raw.length === 0) {
      return [{ figure_index: 0, score: 1, reason: 'no scores returned' }]
    }
    return raw.slice(0, input.subjectCount).map((s: any, i: number) => ({
      figure_index: Number.isFinite(Number(s.animal_index)) ? Number(s.animal_index) : i,
      score:        Math.max(1, Math.min(10, Number(s.score) || 1)),
      reason:       String(s.reason || 'no reason given').slice(0, 200),
    }))
  } catch {
    return [{ figure_index: 0, score: 1, reason: 'multi-pet score parse failed' }]
  }
}

// ═══════════════════════════════════════════════════════════════
// SOURCE SET ANALYZER — multi-photo, drives the /analyze route
// ═══════════════════════════════════════════════════════════════
// Pets equivalent of analyzeSourceSet. body_coverage becomes
// pet_coverage: how much of the animal beyond the head is knowable.
// When 'head_only', the frontend shows a photo advisory (non-blocking,
// same Curator rule as Portraits: guide, not restrict) — body
// proportions, tail carriage, and body markings can't be known from a
// head-only shot, so NB2 would be inventing them.

const PET_SOURCE_SET_PROMPT = `You are analyzing source photographs of a pet that will be used to generate a single-subject miniature pet sculpture. There may be 1 to 4 photos — they are intended to show the same animal.

For EACH photo (in the order provided), assess:
- "sharpness": "good" | "fair" | "poor" — is the animal in focus?
- "lighting": "good" | "fair" | "poor" — is the animal well lit (not silhouetted, not blown out)?
- "heads": for each clearly visible hero animal head, estimate its size as a percentage of the photo's SHORTER side (e.g. a head spanning about a third of the shorter side = 33). Report as { "head_index": <int>, "size_pct": <int 1-100> }.
- "concerns": short strings for anything that would hurt a sculpted likeness (motion blur, eyes closed, heavy shadow across the face, animal partially out of frame, obstructed by hands or toys, extreme angle).

Then assess the SET as a whole:
- "subject_count_estimate": how many distinct hero animals appear across the set (usually 1).
- "quality_verdict": "green" if every photo is good, "yellow" if some concerns, "red" if any photo has significant quality issues that would compromise likeness.
- "recommendation": Either null when the set is great as-is, OR a single-sentence suggestion to the user (e.g. "A photo showing your pet's full body would help capture their proportions and tail.", "One photo is fairly blurry — a sharper shot would improve the result.").
- "pet_coverage": classification of how much of the animal beyond the head is visible across the BEST available photo in the set. One of:
    - "head_only"             — the head dominates; little or no body visible. Close-cropped head shots.
    - "head_and_body_partial" — head plus part of the body (chest, shoulders, front legs) is visible, but the full silhouette, hindquarters, or tail are not.
    - "full_body"             — the complete animal is visible: body silhouette, legs, paws, and tail are all in frame.
  When the animal's body proportions, markings, and tail are not knowable from the photos, return "head_only". When partially knowable, "head_and_body_partial". When clearly knowable, "full_body".

Respond with ONLY valid JSON (no markdown, no preamble):
{
  "per_photo": [
    {
      "photo_index": 0,
      "sharpness":   "good",
      "lighting":    "good",
      "heads":       [{ "head_index": 0, "size_pct": 32 }],
      "concerns":    []
    }
  ],
  "subject_count_estimate": 1,
  "quality_verdict":        "green",
  "recommendation":         null,
  "pet_coverage":           "full_body"
}`

export interface SourceHeadSize {
  head_index: number
  size_pct:   number
  size_px:    number
}

export interface PetPhotoAnalysis {
  photo_index: number
  width:       number
  height:      number
  sharpness:   'good' | 'fair' | 'poor'
  lighting:    'good' | 'fair' | 'poor'
  heads:       SourceHeadSize[]
  concerns:    string[]
}

export type PetCoverage = 'head_only' | 'head_and_body_partial' | 'full_body'

export interface PetSourceSetAnalysisResult {
  per_photo:                PetPhotoAnalysis[]
  subject_count_estimate:   number
  quality_verdict:          'green' | 'yellow' | 'red'
  recommendation:           string | null
  smallest_head_min_dim_px: number | null   // null if no heads detected
  photo_count:              number
  // Drives the photo advisory. When 'head_only', the frontend shows a
  // non-blocking advisory recommending a full-body photo — otherwise
  // NB2 invents body proportions, tail carriage, and body markings.
  pet_coverage:             PetCoverage
}

export async function analyzePetSourceSet(input: {
  sourceImageB64:       string
  additionalImagesB64?: string[]
  openaiApiKey:         string
}): Promise<PetSourceSetAnalysisResult> {

  const allB64s = [input.sourceImageB64, ...(input.additionalImagesB64 || [])].filter(Boolean)
  if (allB64s.length === 0) {
    return {
      per_photo:                [],
      subject_count_estimate:   0,
      quality_verdict:          'red',
      recommendation:           'No photo provided.',
      smallest_head_min_dim_px: null,
      photo_count:              0,
      pet_coverage:             'head_only',
    }
  }

  // Read each photo's true pixel dimensions. gpt-4o hallucinates
  // absolute pixel coordinates, so we never ask it for those.
  const dims = await Promise.all(
    allB64s.map(async (b64) => {
      try {
        const meta = await sharp(Buffer.from(b64, 'base64')).metadata()
        return { width: meta.width || 0, height: meta.height || 0 }
      } catch {
        return { width: 0, height: 0 }
      }
    }),
  )

  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const content: any[] = []
  for (const b64 of allB64s) {
    content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64}`, detail: 'high' } })
  }
  content.push({ type: 'text', text: PET_SOURCE_SET_PROMPT })

  const response = await openai.chat.completions.create({
    model:           'gpt-4o',
    max_tokens:      900,
    response_format: { type: 'json_object' },
    messages:        [{ role: 'user', content }],
  })

  const raw = (response.choices[0]?.message?.content || '{}').trim()
  let parsed: any = {}
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {
      per_photo: dims.map((d, i) => ({
        photo_index: i, width: d.width, height: d.height,
        sharpness: 'fair', lighting: 'fair', heads: [], concerns: ['analyze parse failed'],
      })),
      subject_count_estimate:   1,
      quality_verdict:          'yellow',
      recommendation:           "Couldn't fully analyze the photo — render may still work but quality is unverified.",
      smallest_head_min_dim_px: null,
      photo_count:              allB64s.length,
      // Conservative default — assume head_only when we can't tell.
      // Routes through the advisory; safer than skipping it for a
      // source we couldn't read.
      pet_coverage:             'head_only',
    }
  }

  // Compute absolute pixel sizes per detected head using the known
  // dimensions of each photo. Track the smallest head across the set.
  let smallestPx: number | null = null
  const perPhoto: PetPhotoAnalysis[] = (parsed.per_photo || []).map((p: any, i: number) => {
    const d = dims[i] || { width: 0, height: 0 }
    const photoShortSide = Math.min(d.width || 0, d.height || 0)
    const heads: SourceHeadSize[] = (p.heads || []).map((h: any) => {
      const pct = Math.max(0, Math.min(100, Number(h.size_pct) || 0))
      const px  = Math.round((pct / 100) * photoShortSide)
      if (px > 0 && (smallestPx === null || px < smallestPx)) smallestPx = px
      return { head_index: Number(h.head_index) || 0, size_pct: pct, size_px: px }
    })
    return {
      photo_index: i,
      width:       d.width,
      height:      d.height,
      sharpness:   p.sharpness === 'good' || p.sharpness === 'poor' ? p.sharpness : 'fair',
      lighting:    p.lighting  === 'good' || p.lighting  === 'poor' ? p.lighting  : 'fair',
      heads,
      concerns:    Array.isArray(p.concerns) ? p.concerns.slice(0, 5).map(String) : [],
    }
  })

  const subjectCountEstimate = Math.max(1, Math.min(20, Number(parsed.subject_count_estimate) || 1))
  const verdict: 'green' | 'yellow' | 'red' =
    parsed.quality_verdict === 'green' || parsed.quality_verdict === 'red'
      ? parsed.quality_verdict
      : 'yellow'

  let recommendation: string | null = null
  if (parsed.recommendation && typeof parsed.recommendation === 'string') {
    const cleaned = parsed.recommendation.trim()
    if (cleaned && cleaned.toLowerCase() !== 'null') {
      recommendation = cleaned.length > 200 ? cleaned.slice(0, 197) + '...' : cleaned
    }
  }

  const petCoverage: PetCoverage =
    parsed.pet_coverage === 'head_and_body_partial' || parsed.pet_coverage === 'full_body'
      ? parsed.pet_coverage
      : 'head_only'

  return {
    per_photo:                perPhoto,
    subject_count_estimate:   subjectCountEstimate,
    quality_verdict:          verdict,
    recommendation,
    smallest_head_min_dim_px: smallestPx,
    photo_count:              allB64s.length,
    pet_coverage:             petCoverage,
  }
}
