// houses-artists-score.ts
// lib/v1/houses-artists-score.ts
//
// STRUCTURAL FIDELITY SCORER — the Houses analog of scoreFaceFidelity.
// Compares the source photograph against an Artists Gallery render and
// rates ARCHITECTURAL likeness 1-10, explicitly ignoring the medium
// (impasto, watercolor, charcoal, ink are intentional and correct).
//
// NOT YET WIRED. The Houses generate route currently carries only the
// Replicate token; wiring this requires threading OPENAI_API_KEY through
// the route (same pattern as Portraits). Recommended first step:
// telemetry-only — log the score on every artists render, no gate, no
// retry — then decide thresholds from real data. gpt-4o-mini at
// detail:'low' costs ~$0.001 and ~1-2s per call.

import OpenAI from 'openai'

const STRUCTURE_FIDELITY_PROMPT = `You are scoring a fine-art rendering of a building against the source photograph it was based on.

The artwork has been intentionally stylized in an artistic medium (sculpted oil paint, watercolor, charcoal and chalk, or pen and ink). The medium, palette, scene, and surface treatment are correct by design and must NOT factor into your score. Score ONLY architectural fidelity.

Compare the building in the two images:
- Roofline geometry — same roof type, slope angles, gable/hip/mansard forms, complex roof breaks
- Window count, placement, shape, and grouping
- Bay projections, porch shape and extent, towers or turrets
- Dormer count and placement; chimney count and position
- Door position; overall massing and proportions
- Would someone who lives in the source building recognize it immediately in the artwork?

Respond with ONLY a JSON object:
{
  "score": <integer 1-10>,
  "reason": "<one sentence — what's faithful or what drifted>"
}

Score scale:
- 9-10: Exact architecture, immediately recognizable, commercial-grade
- 7-8: Faithful, recognizable, minor drift on small details
- 5-6: Close but noticeably off — features moved, simplified, or missing
- 3-4: Significant drift — generic example of the style, not this building
- 1-2: Different building entirely

Respond with ONLY the JSON. No preamble.`

export async function scoreStructureFidelity(input: {
  sourceImageB64:   string
  renderedImageB64: string
  openaiApiKey:     string
}): Promise<{ score: number; reason: string }> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const response = await openai.chat.completions.create({
    model:      'gpt-4o-mini',
    max_tokens: 100,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.sourceImageB64}`,   detail: 'low' } },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.renderedImageB64}`, detail: 'low' } },
        { type: 'text', text: STRUCTURE_FIDELITY_PROMPT },
      ],
    }],
  })

  const content = (response.choices[0]?.message?.content || '{}').trim()
  try {
    const parsed = JSON.parse(content)
    const score = Math.max(1, Math.min(10, Number(parsed.score) || 5))
    return {
      score,
      reason: String(parsed.reason || 'no reason given').slice(0, 240),
    }
  } catch {
    return { score: 5, reason: 'scoring parse failed, defaulting to neutral 5' }
  }
}
