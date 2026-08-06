// lib/v1/portraits/portraits-refine.ts
//
// Render-refinement and quality-gate support for Portraits. Mirrors
// groups-refine.ts but scoped to single-subject scoring.
//
// Exports:
//   • detectFaceVisibility   — pre-flight gate on the source photo.
//   • scoreSingleFaceFidelity — Realistic + Resolving styles. Returns one
//                                PerFigureScore for the hero subject.
//   • scoreHolisticCaricature — Tribal styles. Same shape as Groups.
//   • analyzeSourceSet       — multi-photo analyzer used by /analyze route.
//                                Returns subject_count_estimate, hero face
//                                info, quality_verdict, recommendation.
//
// IMPORTANT — bug-fix relative to Groups:
//   The Groups analyze endpoint shipped with mismatched field names between
//   the route and analyzeSourceSet (route expected subject_count_estimate /
//   quality_verdict / recommendation; function returned total_subjects /
//   verdict / nothing), causing the endpoint to silently log "undefined".
//   Portraits aligns the function's return shape with what the route
//   consumes, with the route accepting sourceImageB64 / additionalImagesB64
//   as input parameter names (matching the request body).

import OpenAI from 'openai'
import sharp from 'sharp'
import type {
  PerFigureScore,
  HolisticCaricatureScore,
} from './portraits-shared'

// ─── REFINEMENT GUARD BLOCK ─────────────────────────────────────
// Used by Pass 2 when it's re-enabled. For now Pass 2 is off per pipeline
// config; this is kept for symmetry with Groups.
export const REFINEMENT_GUARD_BLOCK = `
USER REFINEMENT (HIGHEST PRIORITY ADJUSTMENT):
The previous render of this prompt produced a result that needed correction. The line below describes the specific adjustment to make on this re-render. Honor the adjustment exactly while keeping every other rule from the prompt above intact:
- Same material, same staging, same lighting, same scene, same composition.
- The subject's identity (face, body, age, ethnicity) stays exactly as before — only the requested adjustment changes.
- Do NOT add anything not present in the source photograph(s).
- Do NOT remove anything that should be present per the prompt above.
- The adjustment is for posture, expression, eye-line, or visible equipment only.
`.trim()

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
// PRE-FLIGHT FACE VISIBILITY DETECTION
// ═══════════════════════════════════════════════════════════════
// Portraits' version. We still ask for a subject count so the silo can
// warn the user when the source has many faces but they've asked for a
// single-subject portrait. The hero subject pick is left to NB2 (it
// reliably picks the photo's compositional subject given a single-subject
// minimal prompt).

const AGE_GROUPS: string[] = ['child', 'teen', 'young', 'adult', 'mature', 'senior']

const FACE_VISIBILITY_PROMPT = `You are looking at a source photograph that will be used to craft a single-subject portrait piece.

Your job is to:
1. Determine whether at least one HERO SUBJECT face is clearly visible.
2. Count the HERO SUBJECTS in the photograph — the people who are clearly intended as the focal subject(s), not background bystanders or crowds.
3. Report the hero subject's apparent GENDER PRESENTATION and AGE BRACKET. Use your best visual estimate; do not return null for gender.

A HERO SUBJECT is someone who:
- Is prominently positioned (foreground or compositionally central)
- Is in focus or near-focus
- Occupies enough of the frame that an artist could carve a recognizable likeness
- Appears intentional to the photo

EXCLUDE crowd members, distant tourists, walk-by figures, photobombers.

For Portraits, the silo will pick the most prominent hero subject if multiple are present — so reporting more than one is fine.

Respond with ONLY a JSON object:
{
  "face_visible": <boolean — at least one usable hero face is visible>,
  "subject_count_estimate": <int 1-20 — number of hero subjects>,
  "gender": "<'f' for female or 'm' for male — the hero subject>",
  "age_group": "<one of: child (0-11), teen (12-17), young (18-29), adult (30-49), mature (50-64), senior (65+)>",
  "reason": "<short, one sentence>"
}

No preamble, no markdown.`

export async function detectFaceVisibility(input: {
  sourceImageB64: string
  openaiApiKey:   string
}): Promise<{
  face_visible:           boolean
  subject_count_estimate: number
  gender:                 DetectedGender | null
  age_group:              DetectedAgeGroup | null
  reason:                 string
}> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const response = await openai.chat.completions.create({
    model:           'gpt-4o',
    max_tokens:      400,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.sourceImageB64}`, detail: 'high' } },
        { type: 'text', text: FACE_VISIBILITY_PROMPT },
      ],
    }],
  })

  const content = (response.choices[0]?.message?.content || '{}').trim()
  try {
    const parsed = JSON.parse(content)
    return {
      face_visible:           Boolean(parsed.face_visible),
      subject_count_estimate: Math.max(1, Math.min(20, Number(parsed.subject_count_estimate) || 1)),
      gender:    parsed.gender === 'f' || parsed.gender === 'm' ? parsed.gender : null,
      age_group: AGE_GROUPS.includes(parsed.age_group) ? parsed.age_group : null,
      reason:                 String(parsed.reason || 'no reason given').slice(0, 200),
    }
  } catch {
    return {
      face_visible: true, subject_count_estimate: 1,
      gender: null, age_group: null, reason: 'detection parse failed',
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SINGLE-FACE FIDELITY SCORING (Realistic + Resolving)
// ═══════════════════════════════════════════════════════════════
// One subject in, one PerFigureScore out. Pass threshold ≥8/10 by default
// (see SINGLE_FACE_THRESHOLD in portraits-shared.ts).

const SINGLE_FACE_SCORE_PROMPT = `You are scoring a single-subject crafted portrait against the source photograph.

The piece has been intentionally transformed — into a material, a costume of another era, or an artistic medium. That transformation is correct and should NOT factor into your score. Period dress, an unfamiliar setting and a changed medium are all expected. Score ONLY facial likeness preservation.

Compare the rendered face to the hero subject in the source:
- Is the rendered figure recognizable as the same person?
- Are eye spacing, eye shape, nose bridge geometry, mouth, jawline, hairline, ear position preserved?
- Are apparent age, ethnic features, distinguishing marks (glasses, facial hair, hair color/texture) preserved?
- Would someone who knows the source subject recognize them in the render?

Score scale:
- 9-10: Excellent likeness, fully recognizable, commercial-grade
- 7-8:  Good likeness, recognizable, minor drift
- 5-6:  Close but noticeably off
- 3-4:  Significant drift, likeness compromised
- 1-2:  Generic face, no meaningful preservation of the source identity

If the source has multiple people, score the figure in the render against whichever source subject the render most clearly depicts (the most prominent or central source subject).

Respond with ONLY a JSON object:
{
  "score":  <int 1-10>,
  "reason": "<short, one sentence — name the strongest evidence and any drift>"
}

No preamble, no markdown.`

export async function scoreSingleFaceFidelity(input: {
  sourceImageB64:   string
  renderedImageB64: string
  openaiApiKey:     string
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
        { type: 'text', text: SINGLE_FACE_SCORE_PROMPT },
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
    return {
      figure_index: 0,
      score:        5,
      reason:       'scoring parse failed — defaulted to 5/10',
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// HOLISTIC CARICATURE SCORING (Tribal styles)
// ═══════════════════════════════════════════════════════════════
// Same shape as Groups — single composite + 3 sub-scores. Threshold ≥6/10.

const CARICATURE_SCORE_PROMPT = `You are scoring a single-subject tribal carved sculpture render against the source photograph.

This is intentionally NOT a photographic likeness — the style abstracts the face into a calm, restrained carved interpretation. Do NOT penalize for absence of literal likeness. Score the EMOTIONAL ESSENCE and the CRAFT.

Three sub-scores (each 1-10):
- "emotional_capture": Does the carved expression evoke the same mood/presence as the source subject? Does it feel like that person's essence, even though the features are abstracted?
- "craft_quality":     Does the sculpture read as a serious piece of tribal-modernist carving? Material believable? Form intentional? No CGI tells, no plastic-toy register?
- "composition":       Is the framing and staging coherent? Does the piece sit in its context well (wall mount or pedestal)?

Then one overall_score (1-10) — your holistic read of the result, not necessarily the average.

Respond with ONLY a JSON object:
{
  "overall_score":     <int 1-10>,
  "emotional_capture": <int 1-10>,
  "craft_quality":     <int 1-10>,
  "composition":       <int 1-10>,
  "reason":            "<short, one sentence>"
}

No preamble.`

export async function scoreHolisticCaricature(input: {
  sourceImageB64:   string
  renderedImageB64: string
  openaiApiKey:     string
}): Promise<HolisticCaricatureScore> {
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
        { type: 'text', text: CARICATURE_SCORE_PROMPT },
      ],
    }],
  })

  const content = (response.choices[0]?.message?.content || '{}').trim()
  try {
    const parsed = JSON.parse(content)
    return {
      overall_score:     Math.max(1, Math.min(10, Number(parsed.overall_score)     || 5)),
      emotional_capture: Math.max(1, Math.min(10, Number(parsed.emotional_capture) || 5)),
      craft_quality:     Math.max(1, Math.min(10, Number(parsed.craft_quality)     || 5)),
      composition:       Math.max(1, Math.min(10, Number(parsed.composition)       || 5)),
      reason:            String(parsed.reason || 'no reason given').slice(0, 200),
    }
  } catch {
    return {
      overall_score: 5, emotional_capture: 5, craft_quality: 5, composition: 5,
      reason: 'scoring parse failed — defaulted to 5s',
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SOURCE-SET ANALYZER (for /api/v1/portraits/analyze)
// ═══════════════════════════════════════════════════════════════
// Multi-photo analyzer. Returns subject_count_estimate, hero face stats,
// quality_verdict, recommendation. Field names align with what the route
// consumes — that was the broken contract in Groups that this fixes.
//
// The model returns face size as a percentage of the photo's shorter side.
// We compute absolute pixel size with sharp().

const SOURCE_SET_PROMPT = `You are evaluating one or more source photographs that will be used as the basis for a single-subject crafted portrait.

For EACH photograph (in the order provided), return:
- "sharpness": "good" | "fair" | "poor"
- "lighting":  "good" | "fair" | "poor"
- "faces": array of detected hero-subject faces, ordered left-to-right as they appear, each with:
    - "face_index": 0-based within this photo
    - "size_pct":   the face's bounding box shorter side as a PERCENTAGE of the photograph's shorter side (integer 1-100)
    - "bbox":       the face bounding box as NORMALIZED fractions of the photo (NOT pixels): { "x": left edge 0..1, "y": top edge 0..1, "w": width 0..1, "h": height 0..1 }. Be as accurate as you can with the box around the head.
    - "gate":       a per-face readiness verdict for a portrait of THIS person — "pass" (clear, usable), "small" (face too small to craft well), "occluded" (partly hidden by hand/object/hair), or "turned" (turned too far from camera)
- "concerns": short array of free-form notes about quality issues (occlusion, motion blur, heavy compression, harsh shadow, etc.) — use [] if none

Then aggregate across the full set:
- "subject_count_estimate": how many DISTINCT hero subjects appear (deduplicate if you can; otherwise take the max single-photo count). For Portraits this is informational — the silo will pick the hero.
- "quality_verdict": "green" if every photo is good, "yellow" if some concerns, "red" if any photo has significant quality issues that would compromise likeness.
- "recommendation": Either null when the set is great as-is, OR a single-sentence suggestion to the user about what could improve the render (e.g. "A closer photo where the face fills more of the frame would help.", "One of the photos is fairly blurry — a sharper shot would improve the result.").
- "body_coverage": classification of how much of the subject below the chin is visible across the BEST available photo in the set. One of:
    - "face_only"     — the face dominates; little or no neck/shoulders/torso visible. Examples: close-cropped headshots, ID-style portraits, selfies cropped at the jaw.
    - "head_shoulders" — face plus the shoulder line is clearly visible (a classic head-and-shoulders portrait), but the torso below the collarbone is not.
    - "upper_body"    — the bust area is visible: shoulders, upper chest, and either clothing/torso or arms are in frame.
  When the subject's clothing, posture, and silhouette below the face are not knowable from the photo, return "face_only". When they are partially knowable, "head_shoulders". When they are clearly knowable, "upper_body".
- "detected_gender": the apparent gender presentation of the hero subject. One of: "f" (female), "m" (male). When ambiguous, use the best visual estimate.
- "detected_age_group": the approximate age bracket of the hero subject. One of: "child" (roughly 0-11), "teen" (12-17), "young" (18-29), "adult" (30-49), "mature" (50-64), "senior" (65+).

Respond with ONLY valid JSON (no markdown, no preamble):
{
  "per_photo": [
    {
      "photo_index": 0,
      "sharpness":   "good",
      "lighting":    "good",
      "faces":       [{ "face_index": 0, "size_pct": 32, "bbox": { "x": 0.40, "y": 0.12, "w": 0.20, "h": 0.22 }, "gate": "pass" }],
      "concerns":    []
    }
  ],
  "subject_count_estimate": 1,
  "quality_verdict":        "green",
  "recommendation":         null,
  "body_coverage":          "face_only",
  "detected_gender":        "f",
  "detected_age_group":     "adult"
}`

export interface FaceBBox {
  x: number   // 0..1 normalized left edge
  y: number   // 0..1 normalized top edge
  w: number   // 0..1 normalized width
  h: number   // 0..1 normalized height
}

export type FaceGate = 'pass' | 'small' | 'occluded' | 'turned'

export interface SourceFaceSize {
  face_index: number
  size_pct:   number
  size_px:    number
  bbox:       FaceBBox | null
  gate:       FaceGate
}

// §5 source-control contract — one entry per detected face on the PRIMARY
// photo, consumed by the face-aware source control (Source Control v5).
// `faceFillPct` = face area / image area (the dominant face-drift signal:
// per-person intake gate + zoom seed). `subjectId` is the stable id the
// `focal` object carries back to generate.
export interface AnalyzedFace {
  id:          string
  bbox:        FaceBBox
  faceFillPct: number
  gate:        FaceGate
}

export interface SourcePhotoAnalysis {
  photo_index: number
  width:       number
  height:      number
  sharpness:   'good' | 'fair' | 'poor'
  lighting:    'good' | 'fair' | 'poor'
  faces:       SourceFaceSize[]
  concerns:    string[]
}

export type BodyCoverage = 'face_only' | 'head_shoulders' | 'upper_body'
export type DetectedGender = 'f' | 'm'
export type DetectedAgeGroup = 'child' | 'teen' | 'young' | 'adult' | 'mature' | 'senior'

export interface SourceSetAnalysisResult {
  per_photo:                  SourcePhotoAnalysis[]
  subject_count_estimate:     number
  quality_verdict:            'green' | 'yellow' | 'red'
  recommendation:             string | null
  smallest_face_min_dim_px:   number | null   // null if no faces detected
  photo_count:                number
  // 2026-05 — added to drive the Curator upper-body reconstruction flow.
  // When 'face_only', the generate pipeline should route through the
  // Curator endpoint (POST /curate-upper-body) to gather an explicit
  // upper-body concept before invoking NB2 — otherwise NB2 invents
  // body content (hats, hands, full torsos) that breaks likeness.
  body_coverage:              BodyCoverage
  detected_gender:            DetectedGender | null
  detected_age_group:         DetectedAgeGroup | null
  // §5 — detected faces on the PRIMARY photo, with normalized bbox + per-face
  // gate, for the face-aware source control's markers / subject pick / seed.
  faces:                      AnalyzedFace[]
}

// Face area below this fraction of the image is too small to craft well —
// the per-person intake gate (§7). Reuses the single-subject intent: a face
// that fills very little of the frame yields a weak likeness.
export const FACE_GATE_MIN_FILL = 0.012

// Clamp a model-returned bbox to normalized [0..1], keeping it on-image.
// Returns null when the model gave nothing usable.
function parseBBox(raw: any): FaceBBox | null {
  if (!raw || typeof raw !== 'object') return null
  const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : NaN)
  let x = n(raw.x), y = n(raw.y), w = n(raw.w), h = n(raw.h)
  if (![x, y, w, h].every(Number.isFinite)) return null
  x = Math.min(Math.max(x, 0), 1); y = Math.min(Math.max(y, 0), 1)
  w = Math.min(Math.max(w, 0), 1); h = Math.min(Math.max(h, 0), 1)
  if (w <= 0 || h <= 0) return null
  if (x + w > 1) w = 1 - x
  if (y + h > 1) h = 1 - y
  return { x, y, w, h }
}

function parseFaceGate(raw: any): FaceGate {
  return raw === 'small' || raw === 'occluded' || raw === 'turned' ? raw : 'pass'
}

// Build the §5 primary-photo faces[] from the parsed per-face data. Assigns
// stable subject ids, computes faceFillPct from bbox area, and lets the
// face-size floor (FACE_GATE_MIN_FILL) override the model's gate to 'small'.
function buildPrimaryFaces(primary: SourcePhotoAnalysis | undefined): AnalyzedFace[] {
  if (!primary) return []
  return primary.faces
    .filter(f => f.bbox)
    .map((f, i) => {
      const bbox = f.bbox as FaceBBox
      const faceFillPct = bbox.w * bbox.h
      const gate: FaceGate = faceFillPct < FACE_GATE_MIN_FILL ? 'small' : f.gate
      return { id: `subj_${i}`, bbox, faceFillPct, gate }
    })
}

export async function analyzeSourceSet(input: {
  sourceImageB64:        string
  additionalImagesB64?:  string[]
  openaiApiKey:          string
}): Promise<SourceSetAnalysisResult> {

  const allB64s = [input.sourceImageB64, ...(input.additionalImagesB64 || [])].filter(Boolean)
  if (allB64s.length === 0) {
    return {
      per_photo:                [],
      subject_count_estimate:   0,
      quality_verdict:          'red',
      recommendation:           'No photo provided.',
      smallest_face_min_dim_px: null,
      photo_count:              0,
      body_coverage:            'face_only',
      detected_gender:          null,
      detected_age_group:       null,
      faces:                    [],
    }
  }

  // Read each photo's true pixel dimensions. gpt-4o hallucinates absolute
  // pixel coordinates, so we never ask it for those.
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
  content.push({ type: 'text', text: SOURCE_SET_PROMPT })

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
        sharpness: 'fair', lighting: 'fair', faces: [], concerns: ['analyze parse failed'],
      })),
      subject_count_estimate:   1,
      quality_verdict:          'yellow',
      recommendation:           "Couldn't fully analyze the photo — render may still work but quality is unverified.",
      smallest_face_min_dim_px: null,
      photo_count:              allB64s.length,
      // Conservative default — assume face_only when we can't tell. This
      // routes through Curator and is safer than skipping the upper-body
      // reconstruction for a source we couldn't read.
      body_coverage:            'face_only',
      detected_gender:          null,
      detected_age_group:       null,
      faces:                    [],
    }
  }

  // Compute absolute pixel sizes per detected face using the known
  // dimensions of each photo. Track the smallest face across the set.
  let smallestPx: number | null = null
  const perPhoto: SourcePhotoAnalysis[] = (parsed.per_photo || []).map((p: any, i: number) => {
    const d = dims[i] || { width: 0, height: 0 }
    const photoShortSide = Math.min(d.width || 0, d.height || 0)
    const faces: SourceFaceSize[] = (p.faces || []).map((f: any) => {
      const pct = Math.max(0, Math.min(100, Number(f.size_pct) || 0))
      const px  = Math.round((pct / 100) * photoShortSide)
      if (px > 0 && (smallestPx === null || px < smallestPx)) smallestPx = px
      return {
        face_index: Number(f.face_index) || 0,
        size_pct:   pct,
        size_px:    px,
        bbox:       parseBBox(f.bbox),
        gate:       parseFaceGate(f.gate),
      }
    })
    return {
      photo_index: i,
      width:       d.width,
      height:      d.height,
      sharpness:   p.sharpness === 'good' || p.sharpness === 'poor' ? p.sharpness : 'fair',
      lighting:    p.lighting  === 'good' || p.lighting  === 'poor' ? p.lighting  : 'fair',
      faces,
      concerns:    Array.isArray(p.concerns) ? p.concerns.slice(0, 5).map(String) : [],
    }
  })

  const subjectCountEstimate = Math.max(1, Math.min(20, Number(parsed.subject_count_estimate) || 1))
  const verdict: 'green' | 'yellow' | 'red' =
    parsed.quality_verdict === 'green' || parsed.quality_verdict === 'red'
      ? parsed.quality_verdict
      : 'yellow'

  // Recommendation: null if model returned null/empty, else clamp to one
  // sentence, max ~200 chars.
  let recommendation: string | null = null
  if (parsed.recommendation && typeof parsed.recommendation === 'string') {
    const cleaned = parsed.recommendation.trim()
    if (cleaned && cleaned.toLowerCase() !== 'null') {
      recommendation = cleaned.length > 200 ? cleaned.slice(0, 197) + '...' : cleaned
    }
  }

  // Parse body coverage with fallback to face_only when the model
  // returns something unexpected.
  const bodyCoverage: BodyCoverage =
    parsed.body_coverage === 'head_shoulders' || parsed.body_coverage === 'upper_body'
      ? parsed.body_coverage
      : 'face_only'

  const VALID_GENDERS: DetectedGender[] = ['f', 'm']
  const VALID_AGE_GROUPS: DetectedAgeGroup[] = ['child', 'teen', 'young', 'adult', 'mature', 'senior']
  const detectedGender: DetectedGender | null =
    VALID_GENDERS.includes(parsed.detected_gender) ? parsed.detected_gender : null
  const detectedAgeGroup: DetectedAgeGroup | null =
    VALID_AGE_GROUPS.includes(parsed.detected_age_group) ? parsed.detected_age_group : null

  return {
    per_photo:                perPhoto,
    subject_count_estimate:   subjectCountEstimate,
    quality_verdict:          verdict,
    recommendation,
    smallest_face_min_dim_px: smallestPx,
    photo_count:              allB64s.length,
    body_coverage:            bodyCoverage,
    detected_gender:          detectedGender,
    detected_age_group:       detectedAgeGroup,
    faces:                    buildPrimaryFaces(perPhoto[0]),
  }
}
