// group-scorer.ts
// lib/v1/group-scorer.ts
//
// PHASE 8 — Quality scoring of the generated miniature against the source photograph.
//
// Reframed as art-critique style review rather than identification matching,
// to avoid the same refusal pattern the analyzer was hitting.

import OpenAI from 'openai'

export interface GroupScore {
  likeness_accuracy:     number   // 0–40
  structural_integrity:  number   // 0–20
  material_quality:      number   // 0–15
  composition_margins:   number   // 0–15
  lighting_presentation: number   // 0–10

  total:                 number   // 0–100
  likeness_0_100:        number   // likeness_accuracy normalized to 0–100

  identity_drift:        boolean  // true if a person reads as someone notably different
  notes:                 string
}

const SCORING_PROMPT = `You're reviewing a sculpted miniature figurine against the source photograph it was made from. The first image is the source. The second image is the miniature.

Score the miniature as if you're a quality reviewer at a collectibles studio. Be honest — this is a quality gate.

Rate each criterion:

1. LIKENESS ACCURACY (0–40): Does each person in the miniature look like the same person from the source? Hair color and style match? Skin tone match? Glasses present if in source? Clothing colors match? Asymmetry preserved (not idealized)?

2. STRUCTURAL INTEGRITY (0–20): Are figures grounded properly on the base? No warping, no floating, no broken proportions? Number of people matches the source exactly? Left-to-right order matches?

3. MATERIAL QUALITY (0–15): Does it read as premium sculpted resin with soft satin finish? No clay texture, no plastic toy look, no hobbyist finish?

4. COMPOSITION & MARGINS (0–15): Base + figures occupy ≤50% of frame? At least 20% breathing room on all sides? Base fully visible, not cropped?

5. LIGHTING & PRESENTATION (0–10): Premium product-photography quality? Faces well-lit and well-modeled?

Also flag IDENTITY_DRIFT (boolean): true if anyone in the miniature looks notably different from the source (wrong hair, wrong age, generic-looking face). False if everyone is reasonably recognizable.

Respond ONLY with valid JSON:
{
  "likeness_accuracy":     <int 0-40>,
  "structural_integrity":  <int 0-20>,
  "material_quality":      <int 0-15>,
  "composition_margins":   <int 0-15>,
  "lighting_presentation": <int 0-10>,
  "identity_drift":        <boolean>,
  "notes": "<one short sentence on biggest issue, or 'none' if score is high>"
}

No markdown, no preamble, no apology. Just JSON.`

export async function scoreGroup(input: {
  sourceImageB64:    string
  generatedImageB64: string
  openaiApiKey:      string
}): Promise<GroupScore> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'SOURCE PHOTOGRAPH (the reference):' },
        {
          type: 'image_url',
          image_url: {
            url:    `data:image/jpeg;base64,${input.sourceImageB64}`,
            detail: 'high',
          },
        },
        { type: 'text', text: 'SCULPTED MINIATURE (to review):' },
        {
          type: 'image_url',
          image_url: {
            url:    `data:image/jpeg;base64,${input.generatedImageB64}`,
            detail: 'high',
          },
        },
        { type: 'text', text: SCORING_PROMPT },
      ],
    }],
  })

  const raw   = response.choices[0]?.message?.content?.trim() || '{}'
  const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

  // Detect refusal
  if (!clean.startsWith('{') && /sorry|can'?t (assist|help)|unable to/i.test(clean)) {
    console.warn('[group-scorer] Model refused. Raw:', raw.slice(0, 200))
    throw new Error('group_score_refused')
  }

  let parsed: Partial<GroupScore>
  try {
    parsed = JSON.parse(clean)
  } catch (e: any) {
    console.error('[group-scorer] JSON parse failed:', e.message, '\nRaw:', raw.slice(0, 300))
    throw new Error('group_score_parse_failed')
  }

  const likeness   = clamp(parsed.likeness_accuracy     ?? 0, 0, 40)
  const structural = clamp(parsed.structural_integrity  ?? 0, 0, 20)
  const material   = clamp(parsed.material_quality      ?? 0, 0, 15)
  const composit   = clamp(parsed.composition_margins   ?? 0, 0, 15)
  const lighting   = clamp(parsed.lighting_presentation ?? 0, 0, 10)
  const total      = likeness + structural + material + composit + lighting
  const likeness100 = Math.round((likeness / 40) * 100)

  const score: GroupScore = {
    likeness_accuracy:     likeness,
    structural_integrity:  structural,
    material_quality:      material,
    composition_margins:   composit,
    lighting_presentation: lighting,
    total,
    likeness_0_100:        likeness100,
    identity_drift:        Boolean(parsed.identity_drift),
    notes:                 parsed.notes || '',
  }

  console.log(
    `[group-scorer] total=${total}/100 likeness=${likeness100}/100 drift=${score.identity_drift}` +
    (score.notes ? ` — ${score.notes}` : '')
  )
  return score
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}
