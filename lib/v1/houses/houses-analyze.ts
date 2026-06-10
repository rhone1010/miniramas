// houses-analyze.ts
// lib/v1/houses/houses-analyze.ts
//
// SOURCE ANALYZER — Houses silo. Mirrors portraits-refine.ts in shape.
// NOTE: named houses-analyze (not -refine) — houses-refine.ts already
// exists in the live repo with the refineHouse pipeline export.
// GPT-4o vision reads the primary photo and returns:
//   quality_verdict   green | yellow | red   (can the pipeline work with this?)
//   facade_coverage   full | partial          (is the building clearly, fully visible?)
//   reason            one plain-language sentence for the Curator to relay
//
// Routing (frontend mirror of the Portraits state machine):
//   red          → quality advisory panel (Curator suggests a different photo —
//                  but never blocks; the user may continue)
//   partial      → photo advisory (recommend more angles, non-blocking)
//   otherwise    → straight to the effects step
//
// Conservative default on parse failure: yellow / partial — routes through
// the advisory rather than past it.

import OpenAI from 'openai'

export type HousesQualityVerdict = 'green' | 'yellow' | 'red'
export type FacadeCoverage = 'full' | 'partial'

export interface HousesSourceAnalysis {
  quality_verdict: HousesQualityVerdict
  facade_coverage: FacadeCoverage
  reason:          string
}

const ANALYZER_PROMPT = `You are assessing a customer's photograph of a building for an art studio that crafts homes into sculpted artwork. The building's architecture must be readable: roofline, windows, porch, massing.

Assess two things:

1. quality_verdict:
- "green" — sharp, well-lit, building clearly the subject
- "yellow" — workable but compromised: soft focus, harsh shadows, partial obstruction (trees, vehicles), building small in frame
- "red" — unusable: severe blur, building barely visible, heavy obstruction across the facade, extreme distance, or the photo does not show a building

2. facade_coverage:
- "full" — the main facade is fully visible edge to edge, key features readable
- "partial" — significant portions hidden (trees, vehicles, crop), oblique angle hiding a wing, or only a fragment of the building shown

Respond with ONLY a JSON object:
{
  "quality_verdict": "green|yellow|red",
  "facade_coverage": "full|partial",
  "reason": "<one plain sentence a customer would understand>"
}
No preamble, no markdown fences.`

export async function analyzeHousesSource(input: {
  sourceImageB64: string
  openaiApiKey:   string
}): Promise<HousesSourceAnalysis> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey, timeout: 25_000, maxRetries: 1 })

  try {
    const response = await openai.chat.completions.create({
      model:      'gpt-4o',
      max_tokens: 150,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.sourceImageB64}`, detail: 'low' } },
          { type: 'text', text: ANALYZER_PROMPT },
        ],
      }],
    })

    const content = (response.choices[0]?.message?.content || '{}').trim()
    const parsed = JSON.parse(content)
    const verdict: HousesQualityVerdict =
      parsed.quality_verdict === 'green' || parsed.quality_verdict === 'red'
        ? parsed.quality_verdict : 'yellow'
    const coverage: FacadeCoverage =
      parsed.facade_coverage === 'full' ? 'full' : 'partial'
    return {
      quality_verdict: verdict,
      facade_coverage: coverage,
      reason: String(parsed.reason || '').slice(0, 240) || 'Assessed.',
    }
  } catch (e) {
    console.error('[houses/analyze] parse or API failure, conservative default', e)
    return {
      quality_verdict: 'yellow',
      facade_coverage: 'partial',
      reason: 'We could not fully read the photograph — more angles would help.',
    }
  }
}
