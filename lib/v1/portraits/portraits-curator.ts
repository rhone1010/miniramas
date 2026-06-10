// lib/v1/portraits/portraits-curator.ts
//
// Curated Guess Mode — Upper Body Reconstruction.
//
// When the user's source photo is face-only (no torso/clothing/shoulders
// visible), NB2 invents body content to fill the bust silhouette. The
// invention frequently breaks the piece — random hats, hand-covering-mouth
// gestures, full teenager torsos with crossed arms, severed-head-on-plate
// failures. This is most pronounced in Artists Gallery materials where
// the artistic register needs SURFACE AREA to spread across; given only
// a face, the effect crams onto the face plane and breaks identity.
//
// The Curator path intercepts before NB2 runs. It reads the face for
// personality signals (age, expression, hair, character) and proposes
// three plausible upper-body interpretations — clothing, posture,
// neckline, shoulder presentation, and where the bust is cut off. The
// user picks one (or rerolls for three new concepts, max two rounds).
// The chosen concept is woven into the generate prompt so the bust has
// a defined silhouette before the artistic effect spreads.
//
// Wardrobe register, per Rich's spec:
//   "almost better quality and fashion than most people ever think about,
//    mostly high quality casual"
// — think art-school faculty, thoughtful creative, considered intentional
// dress. Never overly formal, never lazy-casual. The expression and
// material drive the personality cue.

import OpenAI from 'openai'
import type { PortraitsStyleId, PortraitsPresetId } from './portraits-shared'

export interface UpperBodyConcept {
  id:           string   // 'concept_1' | 'concept_2' | 'concept_3'
  label:        string   // 2-4 word card title (e.g. "Slate Crewneck")
  description:  string   // 10-25 word prompt insert
}

export interface CurateUpperBodyInput {
  sourceImageB64:  string
  styleId:         PortraitsStyleId
  presetId:        PortraitsPresetId
  round:           1 | 2
  rejectedLabels?: string[]   // round 2: labels from round 1 to avoid repeating
  openaiApiKey:    string
}

export interface CurateUpperBodyResult {
  concepts:    UpperBodyConcept[]
  round:       1 | 2
  durationMs:  number
}

// Material → personality / wardrobe register hint. Drives the Curator
// toward concepts that feel coherent with the final piece. Per Rich:
// the material implies who this person reads as.
const MATERIAL_REGISTER: Partial<Record<PortraitsPresetId, string>> = {
  // Realistic series
  bronze:         'classic, intentional, slightly formal but lived-in',
  alabaster:      'refined, quietly elegant',
  iron:           'forged, deliberate, quietly strong',
  plushy:         'soft, approachable, character-driven',
  stone:          'grounded, sturdy, authentically casual',
  ebony:          'dignified, deliberate, well-tailored',
  walnut:         'thoughtful, warm, considered casual',
  // Artists Gallery series — each material implies a specific persona
  impressionist:  'painterly, expressive, slightly bohemian',
  torn_paper:     'literary, contemplative, soft layered casual',
  folded_book:    'well-read casual — turtleneck, soft jacket, slight scarf, the kind of person who lives in libraries',
  charcoal_chalk: 'studio creative — paint-flecked workshirt, rolled sleeves, soft collar',
  pencil_sketch:  'thoughtful contemporary — interesting layering, statement collar, considered drape',
  sheet_music:    'studied artistic — soft jacket over knit, scarf, quiet musicality in the dress',
}

function buildCuratorPrompt(input: {
  styleId:        PortraitsStyleId
  presetId:       PortraitsPresetId
  round:          1 | 2
  rejectedLabels: string[]
}): string {

  const materialRegister =
    MATERIAL_REGISTER[input.presetId] ||
    'high-quality casual, intentional, considered'

  const roundContext =
    input.round === 1
      ? 'This is round 1 — propose three distinct, plausible interpretations.'
      : `This is round 2 — the user rejected round 1's options${
          input.rejectedLabels.length
            ? ` (which were: ${input.rejectedLabels.join('; ')})`
            : ''
        }. Propose THREE FRESH concepts that do not repeat the rejected directions.`

  return `You are the Curator for a fine-art sculpture studio. The studio renders portraits as half-figure sculptures — head to waist, both arms complete and ending in fully sculpted hands. The studio does NOT produce severed heads, head-on-plinth pieces, classical busts with truncated arms, or any arm ending in a cut or stump. The torso, clothing, arms, and hands are not decoration — they are the surface area the artistic effect needs to spread across. Without them, the effect compresses onto the face and the likeness suffers.

A user has uploaded a face-only photograph (no shoulders, no clothing, no torso visible). To turn that face into a substantial bust, you must propose THREE plausible upper-body interpretations the sculptor will use to construct the silhouette around the face.

THE FACE IN THE SOURCE IS NON-NEGOTIABLE. Read it for:
- approximate age range
- hair style and character
- expression and personality signal
- gender presentation
- any visible quality (warmth, intelligence, gravitas, playfulness, etc.)

Use those signals to propose three upper-body interpretations that would feel BELIEVABLE for this specific person.

Material register for this render: ${input.presetId} — ${materialRegister}.

Wardrobe quality bar:
- Aim slightly above what the average person dresses themselves in. Think art-school faculty, thoughtful designer, considered creative.
- High-quality casual: well-cut, intentional, lived-in.
- Never gym wear, t-shirts, or hoodies UNLESS the face clearly reads as a teenager or young adult where that's correct.
- Never tuxedos, gowns, or stiff formalwear UNLESS the face/hair clearly signals that's right.

FIGURE EXTENT — CRITICAL:
Every concept is a HALF-FIGURE: head to waist or stomach, with SUBSTANTIAL TORSO VISIBLE. The chest, shoulders, garment, arms, and hands collectively occupy MORE visible area than the head alone.

TERMINATION RULES:
- Exactly one termination is allowed: the figure ends at the waist or stomach with BOTH ARMS COMPLETE AND BOTH HANDS FULLY VISIBLE. Every concept MUST name where the hands are (crossed, clasped, resting on the base, relaxed at the sides).
- NEVER an arm ending in a cut, stump, or slice — not at the shoulder, bicep, elbow, forearm, or wrist. Arms run unbroken from shoulder to hand.
- Both shoulders are FULLY visible — not implied by collar, not cropped at the shoulder line.
- Visible garment fabric across the chest is REQUIRED.
- DO NOT propose terminations at: the collarbone, "upper torso below collarbone", "just below shoulders", "upper chest", "the collar". These collapse the figure onto the face and break the effect.

Each concept MUST specify:
- Clothing: a specific, considered garment with visible fabric across the chest
- Posture: subtle directional cue
- Bust cut-line: explicitly one of the two allowed terminations. Acceptable cut-lines include:
    "Half-figure to the waist, hands resting crossed at the base."
    "Half-figure to the stomach, hands clasped together."
    "Half-figure to the waist, hands relaxed at the sides."

FORMATTING — IMPORTANT:
Each description is composed of SHORT DIRECTIVE SENTENCES separated by periods, NOT comma-spliced runs. This matches the downstream prompt structure where the wardrobe block reads as a series of declarative facts. Use 4-7 short sentences.

Example of CORRECT format:
  "Rust-colored fine-knit crewneck sweater. Full chest visible. Relaxed shoulders. Slight forward tilt. Clean termination at the upper bicep."
Example of INCORRECT format (comma-spliced — do not produce this):
  "Rust-colored fine-knit crewneck sweater, full chest visible, shoulders relaxed, slight forward tilt, ending at the upper bicep."

Variations across the three concepts:
- Different garments (knit / woven / structured / draped)
- Different posture energies (open / contemplative / direct)
- Different hand placements (crossed / clasped / resting / at the sides) — all concepts are half-figures with hands
- All three must be coherent with the SAME face and the SAME material register

${roundContext}

Output JSON ONLY — no markdown, no preamble. Three concepts in this shape:
{
  "concepts": [
    {
      "id": "concept_1",
      "label": "Slate Crewneck",
      "description": "Slate gray fine-knit crewneck. Soft V at the collar. Full chest visible. Relaxed shoulders. Half-figure to the waist, hands resting crossed."
    },
    {
      "id": "concept_2",
      "label": "...",
      "description": "..."
    },
    {
      "id": "concept_3",
      "label": "...",
      "description": "..."
    }
  ]
}

Label: 2-4 words, evocative but plain (Rich's preferred register — natural, not sophisticated).
Description: 4-7 short directive sentences separated by periods. Names the garment, neckline, posture, AND the hand placement of the waist/stomach half-figure. The hand placement must appear in every description.`
}

export async function curateUpperBody(
  input: CurateUpperBodyInput,
): Promise<CurateUpperBodyResult> {

  const t0 = Date.now()
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const promptText = buildCuratorPrompt({
    styleId:        input.styleId,
    presetId:       input.presetId,
    round:          input.round,
    rejectedLabels: input.rejectedLabels || [],
  })

  console.log(
    `[portraits/curate] start style=${input.styleId} preset=${input.presetId} ` +
    `round=${input.round} rejected=${input.rejectedLabels?.length || 0}`,
  )

  const response = await openai.chat.completions.create({
    model:           'gpt-4o',
    max_tokens:      900,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: {
            url:    `data:image/jpeg;base64,${input.sourceImageB64}`,
            detail: 'high',
        }},
        { type: 'text', text: promptText },
      ],
    }],
  })

  const raw = (response.choices[0]?.message?.content || '{}').trim()
  let parsed: any = {}
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    console.warn(`[portraits/curate] JSON parse failed — returning empty concept set`)
    return {
      concepts:   [],
      round:      input.round,
      durationMs: Date.now() - t0,
    }
  }

  // Normalize / validate. Coerce malformed entries; require label and
  // description; clamp lengths so a runaway response can't blow the
  // generate prompt.
  const rawConcepts: any[] = Array.isArray(parsed.concepts) ? parsed.concepts : []
  const concepts: UpperBodyConcept[] = rawConcepts
    .slice(0, 3)
    .map((c, i) => {
      const id          = `concept_${i + 1}`
      const labelStr    = typeof c?.label       === 'string' ? c.label.trim()       : ''
      const descStr     = typeof c?.description === 'string' ? c.description.trim() : ''
      return {
        id,
        label:       labelStr.length > 40  ? labelStr.slice(0, 37)  + '...' : (labelStr || 'Concept ' + (i + 1)),
        description: descStr.length  > 300 ? descStr.slice(0, 297) + '...' : descStr,
      }
    })
    .filter(c => c.description.length > 0)

  console.log(
    `[portraits/curate] done in ${Date.now() - t0}ms — ` +
    `concepts=${concepts.length} labels=[${concepts.map(c => c.label).join(', ')}]`,
  )

  return {
    concepts,
    round:      input.round,
    durationMs: Date.now() - t0,
  }
}
