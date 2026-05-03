// lib/v1/landscapes-analyzer.ts
// Trimmed analyzer: returns just the structural classification the Curator
// needs to make decisions, plus plaque_candidates for naming/captioning.
//
// Removed: secondary_surface, vegetation_density, has_sky_dominance,
// compatible_materials. The Curator now derives compatibility from the matrix.

import OpenAI from 'openai'
import {
  AnalyzerResult, SurfaceID, SURFACE_LABELS,
} from './landscapes-shared'

const ANALYZER_PROMPT = `
You are an editorial classifier for a miniature-diorama studio. Examine this place photograph and respond ONLY with a JSON object containing exactly these five fields:

"display_name":
A short 2-4 word name for this place type. Examples: "Sea Grotto", "Beach Bar", "Alpine Meadow", "Slot Canyon", "Covered Market", "Forest Bridge".

"primary_surface":
One of these five exact strings — pick the surface category that BEST defines the place's visual identity:
- "wet_luminous" — water, ice, wet rock dominate the place's character (grottos, falls, beaches at water's edge, glaciers)
- "soft_diffused" — soft light-absorbing surfaces (meadows, dunes, mossy understory, misty forests)
- "hard_raking" — exposed rock, cliff, canyon, scree (deserts, badlands, mountainsides)
- "layered_atmospheric" — depth-and-distance is the subject (vistas, valleys, mountain ranges seen from afar)
- "lush_saturated" — dense living color (jungles, rainforests, peak-bloom gardens)

"dominant_subject":
A 5-10 word phrase naming the single most defining feature. Examples: "the wooden footbridge over the stream", "the granite cliff face above the sea", "the long covered porch with hanging flowers".

"has_water":
Boolean. True if water is a meaningful element of the scene (visible river, lake, sea, waterfall, pool — not just dampness).

"plaque_candidates":
An array of exactly 3 short evocative title options the place owner might want as a plaque or caption. Each is 2-5 words. Mix tones: one descriptive, one emotional, one poetic. Examples for a forest bridge: ["The Footbridge", "Light Through Birches", "Where We Crossed"]. Examples for a sea grotto: ["The Blue Cave", "Cathedral of Water", "Deep Light"].

Respond ONLY with valid JSON. No markdown, no explanation, no preamble.
`.trim()

export async function analyzeLandscape(input: {
  sourceImageB64: string
  openaiApiKey:   string
}): Promise<AnalyzerResult> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const response = await openai.chat.completions.create({
    model:      'gpt-4o',
    max_tokens: 350,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url:    `data:image/jpeg;base64,${input.sourceImageB64}`,
            detail: 'low',
          },
        },
        { type: 'text', text: ANALYZER_PROMPT },
      ],
    }],
  })

  const raw = response.choices[0]?.message?.content?.trim() || '{}'
  const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

  let parsed: any = {}
  try {
    parsed = JSON.parse(clean)
  } catch {
    parsed = {}
  }

  // Fallback / sanitization. Always return a valid AnalyzerResult.
  const validSurface = (s: any): s is SurfaceID =>
    typeof s === 'string' && s in SURFACE_LABELS

  const result: AnalyzerResult = {
    display_name:     typeof parsed.display_name === 'string' && parsed.display_name.trim()
                       ? parsed.display_name.trim()
                       : 'Natural Scene',
    primary_surface:  validSurface(parsed.primary_surface)
                       ? parsed.primary_surface
                       : 'soft_diffused',
    dominant_subject: typeof parsed.dominant_subject === 'string' && parsed.dominant_subject.trim()
                       ? parsed.dominant_subject.trim()
                       : 'the place itself',
    has_water:        typeof parsed.has_water === 'boolean' ? parsed.has_water : false,
    plaque_candidates: Array.isArray(parsed.plaque_candidates)
                       ? parsed.plaque_candidates
                           .filter((p: any) => typeof p === 'string' && p.trim().length > 0)
                           .slice(0, 3)
                           .map((p: string) => p.trim())
                       : [],
  }

  // Always have at least one plaque candidate
  if (!result.plaque_candidates.length) {
    result.plaque_candidates = [result.display_name]
  }

  console.log(
    `[landscapes-analyzer] ${result.display_name} / ${result.primary_surface} / ` +
    `water=${result.has_water} / ${result.plaque_candidates.length} plaque(s)`
  )

  return result
}
