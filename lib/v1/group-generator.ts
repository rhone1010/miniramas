// group-generator.ts
// lib/v1/group-generator.ts
//
// Group composition generator on gpt-image-1.
//
// Path A architecture: this pass focuses on COMPOSITION — bodies, poses,
// gear, base, arrangement, relative scale, lighting unity. Faces will be
// refined per-face downstream by face-refine, where each face gets full
// hero pixel budget instead of the 150-200px it gets here in a group of 3-4.
//
// The identity prompt blocks are preserved because they still help with:
//   - Age signals visible in body proportion (kid vs adult)
//   - Clothing colors and patterns (must match source exactly)
//   - Hair color (visible from a distance even if face detail is soft)
//   - Glasses presence (silhouette feature)
//   - Overall posture and expression (shapes the body language)
//
// Cost: ~$0.04/call. With retries up to 3, worst case ~$0.12 for composition
// before face refinement adds another ~$0.04 × num_people.

import OpenAI                       from 'openai'
import sharp                        from 'sharp'
import { toFile }                   from 'openai/uploads'
import { GroupAnalysis, PersonIdentity } from './group-analyzer'

// ── CORE / HIERARCHY ────────────────────────────────────────────

const CORE_HIERARCHY_BLOCK = `CORE:
This is a HERO COLLECTIBLE GROUP FIGURINE — a premium painted resin statue of multiple real people, captured as a product photograph. Not a miniature diorama, not a toy, not a dollhouse scene. A premium statue you'd see on a collector's shelf.

SCALE (CRITICAL — NON-NEGOTIABLE):
The figures must dominate the composition. The group + base occupies 75-85% of the frame area. The tallest figure occupies 75-85% of the frame HEIGHT. This is a hero statue product shot — faces should be large enough to read facial features clearly. Do not shrink the figures to fit a scene — scale the scene to the figures.

ENVIRONMENT (SECONDARY):
The environment supports the figures and never competes for attention. No wide rooms, no full furniture, no busy desk surfaces. The base is compact and subtle.`

// ── LIKENESS HEADER ─────────────────────────────────────────────

const LIKENESS_HEADER = `LIKENESS — KEEP EACH PERSON RECOGNIZABLE FROM THE SOURCE:

The source photograph is the absolute primary reference. Sculpt each person so they look clearly like the same person in the photo — same age, same hair, same face shape, same expression, same clothing.`

// ── PER-PERSON BLOCK ────────────────────────────────────────────

function formatPerson(p: PersonIdentity, totalPeople: number): string {
  const lines = [
    `PERSON ${p.index + 1} of ${totalPeople} (${p.position}):`,
    `  Age: ${p.approximate_age}`,
    `  Age signals (preserve exactly): ${p.age_indicators}`,
    `  Presentation: ${p.presentation}`,
    `  Face: ${p.face_shape}, ${p.notable_features}`,
    `  Hair color (paint exactly): ${p.hair_color}`,
    `  Hair style: ${p.hair_style}`,
    `  Facial hair: ${p.facial_hair}`,
    `  Skin tone: ${p.skin_tone}`,
    `  Glasses: ${p.glasses}`,
    `  Clothing (colors and garment exact): ${p.clothing}`,
    `  Expression (sculpt exactly): ${p.expression}`,
    `  Pose: ${p.pose}`,
  ]
  if (p.notable) lines.push(`  Notable detail: ${p.notable}`)
  return lines.join('\n')
}

// ── IDENTITY DISCIPLINE ─────────────────────────────────────────

const IDENTITY_DISCIPLINE_BLOCK = `IDENTITY DISCIPLINE (NON-NEGOTIABLE):

AGE PRESERVATION — MOST IMPORTANT:
- Render each person at their EXACT age in the source photograph
- DO NOT render older adults as middle-aged
- DO NOT render middle-aged adults as young adults
- DO NOT render adults as children, or children as older
- If hair is grey or salt-and-pepper in the source, hair is grey or salt-and-pepper in the output
- If smile lines, weathered skin, or other age signals are present in the source, they are present in the output

LIKENESS:
- Every facial feature carries through: nose, eyes, mouth, jaw shape, cheekbones, distinguishing marks
- Expression is sculpted and painted exactly as in source
- Hair color and style match source exactly — never substitute
- Glasses present if present in source, absent if absent
- Facial hair (or absence) preserved exactly

CLOTHING:
- Colors and garment types match source exactly
- Patterns (stripes, stars, prints) preserved
- Layering and fit preserved

CONTROLLED STYLIZATION ONLY:
- Slight edge softening, minor simplification of very fine detail
- NO cartooning, NO chibi proportions, NO idealization, NO beautifying
- The product is recognition by family — every concession to style is a concession to fidelity`

// ── STYLIZATION ─────────────────────────────────────────────────

const STYLIZATION_BLOCK_DEFAULT = `STYLIZATION — LIGHT TOUCH (5-10%):
- Heads slightly larger (~5%) for clarity at small scale
- Bodies slightly slimmer (~10%) for clean silhouette
- Edges and forms slightly cleaner than reality
- Faces remain photoreal-faithful — stylization affects body silhouette, not face geometry

NOT chibi, NOT Funko, NOT anime, NOT cartoon. Premium statue territory.`

const STYLIZATION_BLOCK_REINFORCED = `STYLIZATION — MINIMAL (RETRY: PRIORITIZE LIKENESS):
Previous attempts drifted from the source. Reduce stylization to almost nothing:
- Heads only ~2% larger
- Bodies only ~5% slimmer
- Treat each face as a portrait sculpture — match the source as closely as possible`

// ── MATERIAL ────────────────────────────────────────────────────

const MATERIAL_BLOCK = `MATERIAL LANGUAGE — PREMIUM PAINTED RESIN COLLECTIBLE (NOT A TOY):

- Matte-to-satin painted resin on skin — subtle highlights on cheekbones, nose bridge, brow, chin
- Hair sculpted with strand detail and painted with color variation — never a flat block of color
- Eyes: glossy resin with sharp catchlights — sharp and alive
- Eyebrows and eyelashes: sculpted and painted with detail
- Clothing: simplified sculpted fabric forms with painted seams, prints, and texture
- Hard accessories (glasses, jewelry, buttons): semi-gloss to gloss
- Skin shows painted brushwork at close inspection — not a photograph, a hand-finished statue

Avoid:
- Plastic toy sheen, vinyl PVC look
- Uniform matte chalkiness
- Clay or polymer-clay texture
- 3D-print layer lines`

// ── BASE ────────────────────────────────────────────────────────

const BASE_BLOCK = `BASE — COMPACT AND SUBTLE:
- Polished dark walnut plinth, oval or rounded-rectangular shape
- Thin profile (~1cm at scale) — visible but not dominant
- Figured wood grain, satin finish
- Subtle terrain on top: a hint of texture matching the implied ground in source — minimal
- All figures grounded firmly on the base, no floating, no warping at contact`

// ── COMPOSITION ─────────────────────────────────────────────────

const COMPOSITION_BLOCK = `COMPOSITION AND FRAMING:

SCALE:
- Figures + base occupy 75-85% of the frame area
- Tallest figure occupies 75-85% of frame HEIGHT
- Faces sized so features (eyes, nose, mouth, expression) read clearly

MARGIN — TIGHT BUT NOT CLIPPING:
- 8-12% room around the figures on all sides
- The base is fully visible — bottom edge of base above the bottom edge of frame
- Top of tallest figure has 8-12% headroom above

ARRANGEMENT:
- Match the source group arrangement exactly — same left-to-right order, same physical contact, same relative spacing
- Children stay shorter than adults (preserve relative scale from source)
- Bodies and gear positioned as in source

FOCUS:
- Razor-sharp across all figures and the base — every face crisp and clear
- Background softens beyond the figures only — never on the figures or base`

// ── CAMERA ──────────────────────────────────────────────────────

const CAMERA_BLOCK = `CAMERA — HERO STATUE PRODUCT SHOT:

20-30° above horizontal — slightly elevated, looking nearly LEVEL at the figures with a soft downward tilt. Classic hero angle for premium collectible figures (Sideshow, Hot Toys, Prime 1) — gives figures presence and lets faces face the camera at full readability.

NOT top-down. NOT a diorama overview. NOT a 45° looking-down shot.

Expected view:
- Faces clearly visible and readable
- Full bodies head-to-toe
- Compact base visible at the bottom`

// ── LIGHTING ────────────────────────────────────────────────────

const LIGHTING_BLOCK = `LIGHTING — PREMIUM PRODUCT PHOTOGRAPHY (FACE-PRIORITY):

KEY LIGHT: Warm directional from upper-left, ~45° above horizon. Strong but soft.

FACE LIGHTING (CRITICAL):
Every face cleanly and flatteringly lit. NO harsh shadows across identity features (nose bridge, under-eye, jaw line). Catchlights in the eyes for life and presence.

FILL: Soft ambient bounce from the right.
RIM: Subtle warm rim light from behind/above to separate figures from background.
SHADOWS: Cast slightly to lower-right of figures and base — natural, warm, soft-edged.`

// ── BACKGROUND ──────────────────────────────────────────────────

const BACKGROUND_BLOCK = `BACKGROUND — DARK NEUTRAL STUDIO BACKDROP:

Clean dark or warm-neutral studio backdrop behind the figures. Soft gradient — slightly darker at the edges, slightly lighter behind the subject for rim-light separation.

The backdrop is OUT OF FOCUS with gentle falloff. No horizon, no texture, no objects, no furniture.

NO miniature scene feel. NO real-world environment continuation.`

// ── FORBIDDEN ───────────────────────────────────────────────────

const FORBIDDEN_BLOCK = `DO NOT:
- Render anyone older or younger than they appear in the source
- Substitute hair color (grey to brown, blonde to black, etc.)
- Drop facial hair that's present in source, or add facial hair that isn't
- Drop glasses that are present in source
- Replace anyone with a generic, idealized, or "average" face
- Beautify, slim, or de-age anyone
- Shrink the figures to fit a scene — scale the scene to the figures
- Use cartoon, anime, chibi, or Funko proportions
- Use a top-down or steep-down camera angle
- Build a wide diorama scene around the figures
- Add or remove people from the source group
- Reorder the group
- Change clothing colors, patterns, or garment types
- Reinterpret toys or props as real weapons or real military gear`

// ── PUBLIC API ──────────────────────────────────────────────────

export interface RetryHint {
  attempt:           number
  reinforceLikeness: boolean
  reduceStylization: boolean
}

export interface GenerateGroupResult {
  imageB64:   string
  promptUsed: string
}

export async function generateGroup(input: {
  sourceImageB64: string
  analysis:       GroupAnalysis | null
  notes?:         string
  retryHint?:     RetryHint
  openaiApiKey:   string
}): Promise<GenerateGroupResult> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  // Build per-person blocks
  let peopleBlocks: string
  let sceneBlock:   string
  if (input.analysis && input.analysis.people.length > 0) {
    const total = input.analysis.num_people
    peopleBlocks = input.analysis.people
      .map(p => formatPerson(p, total))
      .join('\n\n')
    sceneBlock = `SCENE NOTES (FROM SOURCE):
- People: ${input.analysis.num_people}
- Arrangement: ${input.analysis.arrangement}
- Mood: ${input.analysis.mood}
- Setting: ${input.analysis.setting}

Reproduce the exact arrangement, spacing, and physical contact between people from the source photograph.`
  } else {
    peopleBlocks = `(Reference notes unavailable — work directly from the source photograph. Sculpt every person visible, in the order they appear left to right, with their exact age, hair, clothing, and expression.)`
    sceneBlock = `SCENE NOTES:
Use the source photograph as the sole reference for arrangement, spacing, age, and likeness.`
  }

  const stylizationBlock = input.retryHint?.reduceStylization
    ? STYLIZATION_BLOCK_REINFORCED
    : STYLIZATION_BLOCK_DEFAULT

  const retryReinforcement = input.retryHint?.reinforceLikeness
    ? `RETRY — PRIORITIZE LIKENESS (ATTEMPT ${input.retryHint.attempt}):
Previous attempts didn't match the source closely enough. Treat the source photograph as the absolute reference. Pay special attention to AGE — if anyone in the previous attempt looked younger or older than the source, fix that first.`
    : ''

  const prompt = [
    'Transform the provided source photograph into a museum-quality painted resin group collectible figurine — a premium statue of these real people, photographed as a product shot.',
    CORE_HIERARCHY_BLOCK,
    LIKENESS_HEADER,
    peopleBlocks,
    sceneBlock,
    IDENTITY_DISCIPLINE_BLOCK,
    retryReinforcement,
    stylizationBlock,
    MATERIAL_BLOCK,
    BASE_BLOCK,
    COMPOSITION_BLOCK,
    CAMERA_BLOCK,
    LIGHTING_BLOCK,
    BACKGROUND_BLOCK,
    input.notes ? `ADDITIONAL NOTES:\n${input.notes}` : '',
    FORBIDDEN_BLOCK,
    'A family member should look at this miniature and recognize every person at their actual age. Toy props remain toys (preserve their plastic look, colors, LEDs); never reinterpret toys as real weapons.',
  ].filter(Boolean).join('\n\n')

  // Brightness normalization — same as before
  const srcBuf = Buffer.from(input.sourceImageB64, 'base64')
  const stats  = await sharp(srcBuf).greyscale().stats()
  const bright = stats.channels[0].mean
  const lift   = bright < 165 ? Math.min(165 / bright, 2.0) : 1.0
  const prepared = lift > 1.0
    ? await sharp(srcBuf).modulate({ brightness: lift }).png().toBuffer()
    : await sharp(srcBuf).png().toBuffer()

  const file = await toFile(prepared, 'source.png', { type: 'image/png' })

  const result = await openai.images.edit({
    model:   'gpt-image-1',
    image:   file as any,
    prompt,
    size:    '1024x1024',
    quality: 'high' as any,
    n:       1,
  })

  const b64 = result.data?.[0]?.b64_json
  if (!b64) throw new Error('group_generate_no_image_returned')

  const peopleCount = input.analysis?.num_people ?? '?'
  console.log(
    `[group-generator] gpt-image-1 group of ${peopleCount}` +
    (input.retryHint ? ` (attempt ${input.retryHint.attempt})` : '')
  )
  return { imageB64: b64, promptUsed: prompt }
}
