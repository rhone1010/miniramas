// ─────────────────────────────────────────────────────────────
// MODULE 1 — GENERATION
// lib/v1/generate.ts
//
// ONE JOB: Send source image to gpt-image-1, get diorama back.
//
// Responsibilities:
//   - Build the prompt (short and clear)
//   - Call the API
//   - Return raw transparent PNG as b64
//
// Does NOT handle:
//   - Canvas placement
//   - Shadows
//   - Backgrounds
//   - Scoring
//   - Iteration
// ─────────────────────────────────────────────────────────────

import OpenAI, { toFile } from 'openai'

// ── PROMPT ────────────────────────────────────────────────────
// Short. Clear. Single subject. No contradictions.
// The AI's only job is to produce the diorama object cleanly.

const GENERATION_PROMPT = `
Create a highly realistic handcrafted miniature architectural diorama of the house in the provided photo.

STRUCTURE:
- Preserve the exact architecture, proportions, and layout of the source house
- Do not alter, simplify, or redesign any structural element
- Straight vertical lines only — no warping or distortion

DIORAMA:
- The house sits on a circular dark walnut wooden base
- The full base must be visible — do not crop it at any edge
- Simple landscaping around the house: grass, small shrubs, a stone or brick path to the entrance
- The house occupies 55–65% of the base diameter, surrounded by visible land on all sides

MATERIALS:
- Painted resin and wood — handcrafted miniature quality
- Semi-gloss finish: edges catch light, visible specular highlights on trim and base rim
- Not smooth CGI — surfaces have texture and material detail

LIGHTING:
- Warm directional light from the upper-left
- Clear highlights on left-facing surfaces, shadows on right-facing surfaces
- Strong contrast — not flat

CAMERA:
- 35° downward angle
- No lens distortion
- Entire base visible with breathing room around it

BACKGROUND:
- Solid flat hot pink #FF69B4 — nothing else
- No table, no floor, no room, no shadow beyond the base
- Clean edges — no halo or fringe
`.trim()

// ── TYPES ─────────────────────────────────────────────────────

export interface GenerateInput {
  sourceImageB64: string    // JPEG or PNG, base64
  openaiApiKey:   string
}

export interface GenerateResult {
  imagePngB64: string       // Transparent RGBA PNG, 1024x1024
}

// ── MAIN ──────────────────────────────────────────────────────

export async function generateDiorama(input: GenerateInput): Promise<GenerateResult> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const sourceFile = await toFile(
    Buffer.from(input.sourceImageB64, 'base64'),
    'source.png',
    { type: 'image/png' }
  )

  const response = await openai.images.edit({
    model:      'gpt-image-1',
    image:      sourceFile,
    prompt:     GENERATION_PROMPT,
    n:          1,
    size:       '1024x1024',
    quality:    'high',
    background: 'transparent',   // RGBA output — no chroma key needed
  })

  const b64 = response.data?.[0]?.b64_json
  if (!b64) throw new Error('[generate] gpt-image-1 returned no image data')

  console.log('[generate] Done — transparent 1024x1024 PNG')
  return { imagePngB64: b64 }
}
