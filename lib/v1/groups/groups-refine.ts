// lib/v1/groups/groups-refine.ts
//
// Render-refinement and quality-gate support for Groups.
//
// Two scoring rubrics:
//   • scorePerFigureFidelity   — Realistic + People Resolving styles.
//                                 Returns one score per detected figure.
//                                 Used with size-tiered evaluator (9+/10
//                                 for ≤5, sliding 70/30 for ≥6).
//   • scoreHolisticCaricature  — Tribal Wall Masks + Tribal Statue.
//                                 Returns one composite score per render
//                                 plus three sub-scores (emotional capture,
//                                 craft quality, composition). Used with
//                                 6+/10 average threshold.

import OpenAI from 'openai'
import type {
  PerFigureScore,
  HolisticCaricatureScore,
} from './groups-shared'

// ─── REFINEMENT GUARD BLOCK ─────────────────────────────────────
export const REFINEMENT_GUARD_BLOCK = `
USER REFINEMENT (HIGHEST PRIORITY ADJUSTMENT):
The previous render of this prompt produced a result that needed correction. The line below describes the specific adjustment to make on this re-render. Honor the adjustment exactly while keeping every other rule from the prompt above intact:
- Same material, same staging, same lighting, same scene, same composition, same subject count.
- Each subject's identity (face, body, age, ethnicity) stays exactly as before — only the requested adjustment changes.
- Do NOT add anything not present in the source photograph(s).
- Do NOT remove anything that should be present per the prompt above.
- The adjustment is for arrangement, posture, expression, eye-line, physical contact, or visible equipment only.
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

// ─── PRE-FLIGHT FACE VISIBILITY DETECTION ───────────────────────

const FACE_VISIBILITY_PROMPT = `You are looking at a source photograph that will be used to generate a multi-figure miniature sculpture (a Groups sculpture).

Your job is to count the HERO SUBJECTS of the photograph — the people who are clearly the intended subjects, NOT background bystanders, crowds, spectators, photobombers, or incidental people.

A HERO SUBJECT is someone who:
- Is prominently positioned (foreground, mid-ground, or otherwise compositionally central)
- Is in focus or near-focus relative to the image
- Occupies a meaningful portion of the frame (their face is large enough that an artist could carve a recognizable likeness)
- Appears intentional to the photo — posing, performing the photo's action, or part of the photo's primary group

EXCLUDE from the count:
- Crowd members in the background of a sporting event, concert, parade, etc.
- Spectators at the edges of the scene
- People walking by, distant tourists, anyone clearly incidental
- Faces too small or too out-of-focus for the carving to capture
- Mannequins, photos-within-photos, statues, characters on shirts/screens

METHOD — enumerate hero subjects, then count:
1. Scan the image and identify only the HERO subjects per the above. For each, add an entry to the "faces" array describing rough position and apparent age class.
2. Set "subject_count_estimate" to the LENGTH of the faces array.
3. Verify by re-scanning: is each entry truly a hero subject, not a background bystander? Pay special attention to:
   • Infants and toddlers held in adults' arms — INCLUDE if the family/group is the photo's subject
   • Small children standing in front of or behind adults — INCLUDE
   • Faces near the edges of the frame — INCLUDE only if they appear to be part of the intentional group
   • Crowds and spectators — ALWAYS EXCLUDE, no matter how visible

Age classes: "infant" (under ~2 yrs), "child" (~2–12 yrs), "teen" (~13–17 yrs), "adult" (18+), "elder" (visibly senior).

Respond with ONLY a JSON object — no preamble, no commentary:
{
  "faces": [
    { "position": "<short — e.g. 'front center', 'left foreground', 'held in mother's arms'>",
      "age_class": "infant" | "child" | "teen" | "adult" | "elder" },
    ...
  ],
  "subject_count_estimate": <integer — must equal the length of faces[]>,
  "face_visible": true | false,
  "background_faces_excluded": <integer — rough count of non-hero faces you ignored>,
  "reason": "<one short sentence: e.g. 'soccer match — 3 hero players in foreground, ~40 spectators excluded'>"
}`

export async function detectFaceVisibility(input: {
  sourceImageB64: string
  openaiApiKey:   string
}): Promise<{ face_visible: boolean; subject_count_estimate: number; reason: string }> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const response = await openai.chat.completions.create({
    model:           'gpt-4o',
    max_tokens:      600,
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
    // Trust the enumerated array length over the model's self-reported count if they disagree.
    const facesArr = Array.isArray(parsed.faces) ? parsed.faces : []
    const enumeratedCount = facesArr.length
    const reportedCount = Number(parsed.subject_count_estimate) || 0
    const finalCount = Math.max(enumeratedCount, reportedCount)
    return {
      face_visible:           Boolean(parsed.face_visible),
      subject_count_estimate: Math.max(1, Math.min(20, finalCount || 1)),
      reason:                 String(parsed.reason || 'no reason given').slice(0, 200),
    }
  } catch {
    return { face_visible: true, subject_count_estimate: 2, reason: 'detection parse failed' }
  }
}

// ─── PER-FIGURE FACE FIDELITY (Realistic + People Resolving) ───

// ─── PER-FIGURE FACE FIDELITY (Realistic + People Resolving) ───
 
const PER_FIGURE_SCORE_PROMPT = (expectedCount: number) => `You are scoring a multi-figure miniature sculpture render against the source photograph(s).
 
The source photograph(s) contain exactly ${expectedCount} HERO SUBJECT${expectedCount === 1 ? '' : 'S'}. The render must contain the same ${expectedCount} subject${expectedCount === 1 ? '' : 's'} and NO others.
 
The miniature has been intentionally stylized as a sculpted figurine — the material register is correct and should NOT factor into your score. Score ONLY facial likeness preservation, per subject.
 
== STEP 1: COUNT THE FIGURES IN THE RENDER ==
 
Look carefully at the render. Count every distinct human figure you can see, including:
- Figures at the table / in the foreground
- Figures standing behind, in the background, or partially obscured
- Faces visible at any size, even small or in shadow
 
Report this as figure_count_in_render. If figure_count_in_render > ${expectedCount}, the render contains INVENTED FIGURES — people who don't exist in the source.
 
== STEP 2: SCORE EACH FIGURE ==
 
Subjects in the render are in the SAME left-to-right visual order as the source for the first ${expectedCount} figures.
 
For figures 0 through ${expectedCount - 1}, compare to the source:
- Is the figure recognizable as the same person?
- Are eye spacing, nose shape, mouth, jawline, hairline preserved?
- Would someone who knows the source subject recognize them?
 
Score scale for source-matched figures:
- 9-10: Excellent likeness, fully recognizable, commercial-grade
- 7-8: Good likeness, recognizable, minor drift
- 5-6: Close but noticeably off
- 3-4: Significant drift, likeness compromised
- 1-2: Generic face, no meaningful preservation
 
For ANY figures beyond figure_index ${expectedCount - 1} (i.e., figures in the render that do NOT correspond to a source subject), ALWAYS score them at 1 with reason "invented figure (not in source)". DO NOT score them on likeness — they shouldn't exist.
 
Respond with ONLY a JSON object:
{
  "expected_count": ${expectedCount},
  "figure_count_in_render": <int — total figures you counted in the render>,
  "extra_figures": <int — figures beyond ${expectedCount}, can be 0>,
  "scores": [
    { "figure_index": 0, "score": <int 1-10>, "reason": "<short>" },
    ...
  ]
}
 
Important: the scores array MUST include one entry per figure you counted (figure_count_in_render entries), not just per source subject. The extras must be in the array, scored at 1.
 
Respond with ONLY the JSON. No preamble.`
 
export async function scorePerFigureFidelity(input: {
  sourceImageB64:        string
  renderedImageB64:      string
  openaiApiKey:          string
  expectedSubjectCount?: number
}): Promise<PerFigureScore[]> {
 
  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  // Default to 2 subjects when not provided — same default as state.subjectCount
  // on the frontend. The prompt requires a concrete number to compare against.
  const expectedCount = Math.max(1, input.expectedSubjectCount || 2)
 
  const response = await openai.chat.completions.create({
    model:           'gpt-4o-mini',
    max_tokens:      1500,  // raised slightly — extras add JSON entries
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.sourceImageB64}`,  detail: 'high' } },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${input.renderedImageB64}`, detail: 'high' } },
        { type: 'text', text: PER_FIGURE_SCORE_PROMPT(expectedCount) },
      ],
    }],
  })
 
  const content = (response.choices[0]?.message?.content || '{}').trim()
  try {
    const parsed = JSON.parse(content)
    // Log the count comparison so we can see the analyzer's verdict in the
    // server logs — useful for tuning the prompt and for Testing Claude.
    const renderCount = parsed.figure_count_in_render ?? '?'
    const extraCount  = parsed.extra_figures ?? 0
    console.log(
      `[groups/refine] figure-count check — expected ${expectedCount}, ` +
      `render counted ${renderCount}, extras ${extraCount}`,
    )
    if (!Array.isArray(parsed.scores)) return []
    return parsed.scores.map((s: any, idx: number): PerFigureScore => ({
      figure_index: typeof s.figure_index === 'number' ? s.figure_index : idx,
      score:        Math.max(1, Math.min(10, Number(s.score) || 5)),
      reason:       String(s.reason || 'no reason given').slice(0, 240),
    }))
  } catch (e) {
    console.warn('[groups/refine] per-figure score parse failed:', e)
    return [{ figure_index: 0, score: 5, reason: 'scoring parse failed' }]
  }
}

// ─── HOLISTIC CARICATURE (Tribal Wall Masks + Tribal Statue) ───

const HOLISTIC_CARICATURE_PROMPT = `You are scoring a Tribal-style abstracted carved sculpture against the source photograph(s) it was based on.

This sculpture is INTENTIONALLY ABSTRACTED — likeness is interpreted as caricature, NOT photographic accuracy. DO NOT score for facial accuracy. Score on caricature/abstraction quality:

EMOTIONAL CAPTURE (1-10): does the carving capture each subject's emotional essence (warmth, humor, gentleness, confidence, intimacy, playfulness)? Would someone who knows the subjects sense their personalities through the abstraction?
- 9-10: Every subject's personality reads through the abstraction, dominant traits sensitively exaggerated
- 7-8: Most subjects' essence comes through, minor missed cues
- 5-6: Generic emotional read, personality vague but present
- 3-4: Emotional essence largely absent
- 1-2: Generic faces with no personality

CRAFT QUALITY (1-10): is the carving / segmentation aesthetically successful as a sculpture? Smooth transitions, intentional asymmetry, varied block sizes, natural material variation, organic randomness, museum-grade finish.
- 9-10: Gallery-collectible craft, every detail intentional
- 7-8: Strong craft, minor mechanical or repetitive moments
- 5-6: Acceptable craft, some puzzle-piece or AI-generated feel
- 3-4: Weak craft, mechanical or rigid segmentation
- 1-2: Failed — voxelized, Minecraft-like, chaotic noise

COMPOSITION (1-10): does the overall sculpture work as one artwork? Subject count correct, arrangement intentional, mounting (wall or pedestal) appropriate, presentation gallery-worthy.
- 9-10: Cohesive single artwork, presentation hits museum register
- 7-8: Strong overall composition, minor staging issues
- 5-6: Acceptable composition, presentation feels slightly off
- 3-4: Weak composition, feels assembled rather than designed
- 1-2: Failed composition

OVERALL_SCORE (1-10): your overall judgment of the sculpture as a successful tribal-style caricature artwork.

Respond with ONLY a JSON object:
{
  "overall_score": <int 1-10>,
  "emotional_capture": <int 1-10>,
  "craft_quality": <int 1-10>,
  "composition": <int 1-10>,
  "reason": "<one or two sentences explaining the scores>"
}

Respond with ONLY the JSON. No preamble.`

export async function scoreHolisticCaricature(input: {
  sourceImageB64:    string
  renderedImageB64:  string
  openaiApiKey:      string
}): Promise<HolisticCaricatureScore> {

  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const response = await openai.chat.completions.create({
    model:           'gpt-4o-mini',
    max_tokens:      400,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.sourceImageB64}`,  detail: 'high' } },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${input.renderedImageB64}`, detail: 'high' } },
        { type: 'text', text: HOLISTIC_CARICATURE_PROMPT },
      ],
    }],
  })

  const content = (response.choices[0]?.message?.content || '{}').trim()
  try {
    const parsed = JSON.parse(content)
    return {
      overall_score:     Math.max(1, Math.min(10, Number(parsed.overall_score) || 6)),
      emotional_capture: Math.max(1, Math.min(10, Number(parsed.emotional_capture) || 6)),
      craft_quality:     Math.max(1, Math.min(10, Number(parsed.craft_quality) || 6)),
      composition:       Math.max(1, Math.min(10, Number(parsed.composition) || 6)),
      reason:            String(parsed.reason || 'no reason given').slice(0, 400),
    }
  } catch (e) {
    console.warn('[groups/refine] caricature score parse failed:', e)
    return {
      overall_score:     6,
      emotional_capture: 6,
      craft_quality:     6,
      composition:       6,
      reason:            'scoring parse failed, defaulting to neutral 6/10 across the board',
    }
  }
}

// ─── ANALYZE-RENDER (for user-facing Refine button) ────────────

const ANALYZE_PROMPT = `You are reviewing a rendered multi-figure miniature sculpture against the source photograph(s).

The miniature should preserve every subject's POSE, EXPRESSION, EYE-LINE, PHYSICAL CONTACT, and visible ARRANGEMENT — even though the material has changed.

Identify the SINGLE MOST IMPORTANT thing wrong about the miniature's group composition compared to the source.

Respond with ONE short adjustment instruction:
- Maximum 200 characters
- Start with "Adjust" or "Show"
- Focus on arrangement / posture / eye-line / physical contact / expressions ONLY
- Do NOT suggest changes to identity, face shape, age, ethnicity, additions, or removals
- Do NOT mention the material, lighting, base, or surrounding scene

If the miniature looks substantially correct, respond exactly: "No adjustment needed."

Respond with ONLY the instruction.`

export async function analyzeGroupRender(input: {
  sourceImageB64:   string
  renderedImageB64: string
  openaiApiKey:     string
}): Promise<{ suggestion: string; needsAdjustment: boolean }> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const response = await openai.chat.completions.create({
    model:      'gpt-4o',
    max_tokens: 120,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.sourceImageB64}`,  detail: 'high' } },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${input.renderedImageB64}`, detail: 'high' } },
        { type: 'text', text: ANALYZE_PROMPT },
      ],
    }],
  })

  let suggestion = (response.choices[0]?.message?.content || '').trim()
  suggestion = suggestion.replace(/^["']|["']$/g, '').trim()
  if (suggestion.length > 200) suggestion = suggestion.slice(0, 197) + '...'

  const needsAdjustment = !/^no adjustment needed/i.test(suggestion)
  return { suggestion, needsAdjustment }
}

// ─── SOURCE-SET ANALYZER ────────────────────────────────────────
// Multi-photo analyzer used by the /api/v1/groups/analyze endpoint.
// Evaluates the primary + any aux photos for technical quality and
// returns per-face size data so the frontend can warn on Tier 2
// (face-size) issues independently of Tier 1 (raw image resolution).
//
// The model returns face size as a percentage of the photo's shorter
// side (much more reliable than asking gpt-4o for absolute pixel bbox
// coordinates). We compute the absolute pixel size on this side using
// sharp() to read each photo's true dimensions.

import sharp from 'sharp'

const SOURCE_SET_PROMPT = `You are evaluating one or more source photographs that will be used as the basis for a stylized group sculpture render. Assess each photograph for technical quality and identify each visible face's size in the frame.

For EACH photograph (in the order they were provided), return:
- "sharpness": "good" | "fair" | "poor"
- "lighting":  "good" | "fair" | "poor"
- "faces": array of detected faces, each with:
    - "face_index": 0-based within this photo
    - "size_pct":   the face's bounding box shorter side as a PERCENTAGE of the photograph's shorter side (integer 1-100)
- "concerns": short array of free-form notes about any issues (occlusion, motion blur, heavy compression, etc.) — use [] if none

Then aggregate across ALL photographs:
- "total_subjects": best estimate of how many UNIQUE people appear across the full set (deduplicate if you can tell; otherwise take the max single-photo count)
- "verdict": "green" if every photo is good, "yellow" if some concerns, "red" if any photo has significant quality issues

Respond with ONLY valid JSON in this shape (no markdown, no preamble):
{
  "per_photo": [
    {
      "photo_index": 0,
      "sharpness": "good",
      "lighting": "good",
      "faces": [
        { "face_index": 0, "size_pct": 18 },
        { "face_index": 1, "size_pct": 16 }
      ],
      "concerns": []
    }
  ],
  "total_subjects": 2,
  "verdict": "green"
}`

export interface SourceFaceSize {
  face_index: number
  size_pct:   number      // shorter side as % of photo's shorter side
  size_px:    number      // computed: size_pct * min(photo_w, photo_h) / 100
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

export interface SourceSetAnalysisResult {
  per_photo:                  SourcePhotoAnalysis[]
  total_subjects:             number
  verdict:                    'green' | 'yellow' | 'red'
  smallest_face_min_dim_px:   number | null   // null if no faces detected anywhere
  photo_count:                number
}

export async function analyzeSourceSet(input: {
  primaryB64:    string
  auxB64s?:      string[]
  openaiApiKey:  string
}): Promise<SourceSetAnalysisResult> {

  const allB64s = [input.primaryB64, ...(input.auxB64s || [])].filter(Boolean)
  if (allB64s.length === 0) {
    return {
      per_photo:                [],
      total_subjects:           0,
      verdict:                  'red',
      smallest_face_min_dim_px: null,
      photo_count:              0,
    }
  }

  // Read each photo's true pixel dimensions — gpt-4o doesn't know these
  // and asking it for absolute pixel sizes returns hallucinations.
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
  try { parsed = JSON.parse(raw) } catch {
    return {
      per_photo:                dims.map((d, i) => ({
        photo_index: i, width: d.width, height: d.height,
        sharpness: 'fair', lighting: 'fair', faces: [], concerns: ['analyze parse failed'],
      })),
      total_subjects:           1,
      verdict:                  'yellow',
      smallest_face_min_dim_px: null,
      photo_count:              allB64s.length,
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
      return { face_index: Number(f.face_index) || 0, size_pct: pct, size_px: px }
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

  const totalSubjects = Math.max(1, Math.min(20, Number(parsed.total_subjects) || 1))
  const verdict: 'green' | 'yellow' | 'red' =
    parsed.verdict === 'green' || parsed.verdict === 'red' ? parsed.verdict : 'yellow'

  return {
    per_photo:                perPhoto,
    total_subjects:           totalSubjects,
    verdict,
    smallest_face_min_dim_px: smallestPx,
    photo_count:              allB64s.length,
  }
}
