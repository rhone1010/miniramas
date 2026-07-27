// lib/bench/bench-gates.ts
//
// Gate 1 (intake) and the bench-owned half of Gate 2 (aesthetic).
// Fidelity scoring stays inside each Series pipeline — the adapters
// surface it. These two scorers are series-agnostic by design.
//
// Prompt discipline (per prompt-system learnings):
//   * Positive framing only — describe what to assess, never what to avoid.
//   * One concern per scorer. Intake judges the SOURCE. Aesthetic judges
//     the RENDER. Neither touches likeness — that's the silo scorer's job.
//   * JSON-only responses, parsed defensively, neutral defaults on parse
//     failure so a flaky scorer never hard-blocks a run.

import OpenAI from 'openai'
import { type IntakeResult, COST_CENTS } from './bench-shared'

// ─── GATE 1: INTAKE ──────────────────────────────────────────────

const INTAKE_PROMPT_SUBJECT = `You are assessing whether a customer photograph is a strong source for a sculpted-figure artwork of the people in it.

Assess the photograph on these qualities:
- Subject clarity: the main person or people are sharp and well separated from the background
- Face usability: faces are visible, large enough to read fine features, and lit evenly
- Lighting: the subject is well exposed, with detail in both highlights and shadows
- Pose readability: the body position and activity are clear and unambiguous
- Occlusion: faces and bodies are fully visible rather than blocked by objects or other people
- File integrity: the image is intact, with the subject free of corruption bands, glitch artifacts, heavy banding, or large damaged regions

Count the hero subjects — the people the photograph is clearly about.

Respond with ONLY a JSON object:
{
  "score": <integer 1-10, overall usability as art source>,
  "face_visible": <boolean>,
  "face_size_ok": <boolean>,
  "sharpness_ok": <boolean>,
  "lighting_ok": <boolean>,
  "occlusion_ok": <boolean>,
  "subject_count": <integer>,
  "reasons": ["<up to 3 short notes on what helps or limits this photo>"]
}

Score scale:
- 9-10: Excellent source — sharp, well lit, faces fully readable
- 7-8: Good source — minor softness or lighting unevenness
- 5-6: Workable but compromised — small faces, mixed lighting, or partial occlusion
- 3-4: Weak source — faces hard to read or subject unclear
- 1-2: Unusable as a likeness source

Respond with ONLY the JSON. No preamble.`

const INTAKE_PROMPT_PLACE = `You are assessing whether a customer photograph is a strong source for a sculpted miniature artwork of the place it shows.

Assess the photograph on these qualities:
- Subject clarity: the building or landscape that the photo is about is clearly the dominant element
- Composition: the main structure or scene is framed with its key forms fully in view
- Lighting: the scene is well exposed with readable detail and depth
- Sharpness: structural edges and textures are crisp enough to model from
- Obstruction: the subject is visible rather than blocked by vehicles, crowds, or foreground clutter
- File integrity: the image is intact, with the subject free of corruption bands, glitch artifacts, or large damaged regions

Respond with ONLY a JSON object:
{
  "score": <integer 1-10, overall usability as art source>,
  "face_visible": false,
  "face_size_ok": true,
  "sharpness_ok": <boolean>,
  "lighting_ok": <boolean>,
  "occlusion_ok": <boolean>,
  "subject_count": 1,
  "reasons": ["<up to 3 short notes on what helps or limits this photo>"]
}

Score scale:
- 9-10: Excellent source — clear subject, strong light, full structure visible
- 7-8: Good source — minor clutter or exposure issues
- 5-6: Workable but compromised — partial obstruction or flat light
- 3-4: Weak source — subject unclear or heavily obstructed
- 1-2: Unusable as a place source

Respond with ONLY the JSON. No preamble.`

export async function scoreIntake(input: {
  sourceImageB64: string
  mode:           'subject' | 'place'
  threshold:      number
  openaiApiKey:   string
  // computed locally before the model call:
  resolutionOk:   boolean
}): Promise<IntakeResult & { costCents: number }> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  const prompt = input.mode === 'subject' ? INTAKE_PROMPT_SUBJECT : INTAKE_PROMPT_PLACE

  const response = await openai.chat.completions.create({
    model:      'gpt-4o-mini',
    max_tokens: 220,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.sourceImageB64}`, detail: 'low' } },
        { type: 'text', text: prompt },
      ],
    }],
  })

  const content = (response.choices[0]?.message?.content || '{}').trim()
  let parsed: any = {}
  try { parsed = JSON.parse(content) } catch { /* neutral defaults below */ }

  const score = Math.max(1, Math.min(10, Number(parsed.score) || 5))
  const reasons: string[] = Array.isArray(parsed.reasons)
    ? parsed.reasons.slice(0, 3).map((r: unknown) => String(r).slice(0, 160))
    : ['intake parse failed, defaulting to neutral 5']

  // Resolution is a local computation, not a model opinion. A photo that
  // fails the resolution floor fails intake regardless of model score.
  if (!input.resolutionOk) reasons.unshift('below resolution floor')

  // Calibration run 01 finding: small faces are the dominant face-drift
  // driver across ALL materials (a face that is too small in frame gives
  // the generator too few identity pixels to hold likeness). For subject
  // photos, face_size_ok is therefore a hard intake requirement, same as
  // the resolution floor. Production upload flow mirrors this rule;
  // customer-facing guidance: crop closer to the face for the truest
  // likeness.
  const faceSizeOk = input.mode !== 'subject' || Boolean(parsed.face_size_ok ?? true)
  if (!faceSizeOk) reasons.unshift('face too small in frame for reliable likeness — crop closer')

  const passed = input.resolutionOk && faceSizeOk && score >= input.threshold

  return {
    score,
    passed,
    reasons,
    signals: {
      face_visible:  Boolean(parsed.face_visible ?? true),
      face_size_ok:  Boolean(parsed.face_size_ok ?? true),
      sharpness_ok:  Boolean(parsed.sharpness_ok ?? true),
      lighting_ok:   Boolean(parsed.lighting_ok ?? true),
      occlusion_ok:  Boolean(parsed.occlusion_ok ?? true),
      subject_count: Math.max(1, Number(parsed.subject_count) || 1),
      resolution_ok: input.resolutionOk,
    },
    costCents: COST_CENTS.gpt4o_mini_score,
  }
}

// Local resolution floor — run before the model call, free.
// 1024px long edge is the practical floor for NB2 likeness work;
// configurable here in one place.
export const MIN_LONG_EDGE_PX = 1024

// ─── GATE 2 (bench half): AESTHETIC ──────────────────────────────

const AESTHETIC_PROMPT = `You are scoring a finished sculpted-artwork render for gallery presentation quality. The piece is intentionally stylized as a sculpture — the chosen material and stylization are correct by definition. Score ONLY presentation quality.

Assess:
- Composition: the piece is framed with intention; the eye goes to the subject
- Material believability: the surface reads as a consistent physical material throughout
- Lighting drama: directional light gives the piece dimension and mood
- Craft coherence: the piece reads as one deliberate artwork rather than assembled parts
- Distinctiveness: the image has the presence of a gallery piece someone would hang
- Inscription: any plaque or engraved lettering on the piece reads as clean, correctly formed, legible text

Respond with ONLY a JSON object:
{
  "score": <integer 1-10>,
  "reason": "<one sentence — the strongest quality or the weakest link>"
}

Score scale:
- 9-10: Gallery-grade — striking, coherent, would anchor a wall
- 7-8: Strong — clean presentation with minor weaknesses
- 5-6: Acceptable but unremarkable — reads as competent rather than special
- 3-4: Compromised — visible coherence or lighting problems
- 1-2: Presentation failure

Respond with ONLY the JSON. No preamble.`

export async function scoreAesthetic(input: {
  renderedImageB64: string
  openaiApiKey:     string
}): Promise<{ score: number; reason: string; costCents: number }> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const response = await openai.chat.completions.create({
    model:      'gpt-4o-mini',
    max_tokens: 100,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/png;base64,${input.renderedImageB64}`, detail: 'low' } },
        { type: 'text', text: AESTHETIC_PROMPT },
      ],
    }],
  })

  const content = (response.choices[0]?.message?.content || '{}').trim()
  try {
    const parsed = JSON.parse(content)
    return {
      score:  Math.max(1, Math.min(10, Number(parsed.score) || 5)),
      reason: String(parsed.reason || 'no reason given').slice(0, 240),
      costCents: COST_CENTS.gpt4o_mini_score,
    }
  } catch {
    return { score: 5, reason: 'aesthetic parse failed, defaulting to neutral 5', costCents: COST_CENTS.gpt4o_mini_score }
  }
}
