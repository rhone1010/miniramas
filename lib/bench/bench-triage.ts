// lib/bench/bench-triage.ts
//
// Failure triage — runs ONLY on items that failed Gate 2. Uses gpt-4o
// at full detail (the one place in the bench worth the spend) to:
//   1. classify the failure into the fixed taxonomy
//   2. write a one-paragraph diagnosis
//   3. propose ONE prompt adjustment, positive-framing only
//
// The taxonomy is the product here. Individual suggestions are
// directional; the category roll-up across hundreds of items is the
// hard signal. The model must pick from FAIL_CATEGORIES verbatim —
// anything else maps to 'other'.

import OpenAI from 'openai'
import { FAIL_CATEGORIES, type FailCategory, COST_CENTS } from './bench-shared'

const TRIAGE_PROMPT = `You are a render-quality analyst for a studio that turns customer photographs into sculpted-artwork renders. You are shown the source photograph and a render that FAILED quality review (fidelity and aesthetic scores are provided).

Your job:

1. Pick the single dominant failure category from this exact list:
${FAIL_CATEGORIES.map(c => `   - ${c}`).join('\n')}

Category meanings:
- face_drift: the rendered face shifted away from the source person toward a generic face
- photo_paste: the face looks photographic while the body looks sculptural — a composite
- material_drift: the sculpture material lost its register and reads photorealistic or as the wrong material
- framing_margin: the subject is clipped, crowded against the frame, or missing breathing room
- staging_conflict: the environment or staging contradicts itself (mixed locations, impossible setting)
- anatomy_error: limbs, hands, or figures are malformed, duplicated, or fused
- subject_count: the render shows a different number of figures than the source
- background_bleed: elements of the source photo's real background leaked into the artwork
- lighting_flat: the render lost directional drama — flat, muddy, or evenly dull light
- style_generic: technically sound but reads as generic AI art with no studio character
- other: none of the above fits

2. Write a diagnosis of what specifically went wrong, referencing what you see in both images. Keep it under 50 words.

3. Propose exactly ONE prompt adjustment that describes what the render SHOULD show or match. State it as a positive directive — describe the desired outcome, never list things to leave out. Keep it under 25 words; short directives outperform long ones.

Respond with ONLY a JSON object:
{
  "category": "<one value from the list, verbatim>",
  "diagnosis": "<one paragraph>",
  "suggestion": "<one positive-framing prompt directive, under 25 words>"
}

Respond with ONLY the JSON. No preamble.`

export async function triageFailure(input: {
  sourceImageB64:   string
  renderedImageB64: string
  fidelityScore:    number | null
  fidelityReason:   string | null
  aestheticScore:   number | null
  aestheticReason:  string | null
  openaiApiKey:     string
}): Promise<{
  category:   FailCategory
  diagnosis:  string
  suggestion: string
  costCents:  number
}> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const scoreContext =
    `Review scores for the render: fidelity ${input.fidelityScore ?? 'n/a'}/10` +
    (input.fidelityReason ? ` ("${input.fidelityReason}")` : '') +
    `, aesthetic ${input.aestheticScore ?? 'n/a'}/10` +
    (input.aestheticReason ? ` ("${input.aestheticReason}")` : '') + '.'

  const response = await openai.chat.completions.create({
    model:      'gpt-4o',
    max_tokens: 800,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.sourceImageB64}`,   detail: 'high' } },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${input.renderedImageB64}`,  detail: 'high' } },
        { type: 'text', text: `${scoreContext}\n\n${TRIAGE_PROMPT}` },
      ],
    }],
  })

  const content = (response.choices[0]?.message?.content || '{}').trim()
  let parsed: any = {}
  try { parsed = JSON.parse(content) } catch {
    // Truncated or malformed JSON: salvage what we can rather than
    // defaulting straight to 'other' — a partial diagnosis with the
    // right category is far more useful than no signal.
    const cat = content.match(/"category"\s*:\s*"([^"]+)"/)
    const dia = content.match(/"diagnosis"\s*:\s*"([^"]*)/)
    const sug = content.match(/"suggestion"\s*:\s*"([^"]*)/)
    parsed = {
      category:   cat?.[1],
      diagnosis:  dia?.[1] ? dia[1] + ' [truncated]' : undefined,
      suggestion: sug?.[1],
    }
  }

  const rawCategory = String(parsed.category || 'other')
  const category: FailCategory =
    (FAIL_CATEGORIES as readonly string[]).includes(rawCategory)
      ? rawCategory as FailCategory
      : 'other'

  return {
    category,
    diagnosis:  String(parsed.diagnosis  || 'triage parse failed').slice(0, 1200),
    suggestion: String(parsed.suggestion || '').slice(0, 300),
    costCents:  COST_CENTS.gpt4o_triage,
  }
}
