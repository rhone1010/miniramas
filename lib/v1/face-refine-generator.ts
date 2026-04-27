// face-refine-generator.ts
// lib/v1/face-refine-generator.ts
//
// Per-face hero refinement on gpt-image-1.
//
// Stylization MUST match the group-generator stylization (~12%, Pixar-adjacent
// realism, premium figurine idealization). If stylization levels differ
// between the body (group-generator output) and the refined face, the
// composite reads as a Photoshopped mismatch — uncanny.
//
// Cost per call: ~$0.04. Latency: ~10-15s per face.

import OpenAI                     from 'openai'
import sharp                      from 'sharp'
import { toFile }                 from 'openai/uploads'
import { PersonIdentity }         from './group-analyzer'

export interface RefineFaceResult {
  imageB64:   string
  promptUsed: string
}

export async function refineFace(input: {
  faceCropB64:  string                // tight crop of one person's face from source
  identity:     PersonIdentity | null  // analysis entry for this person
  openaiApiKey: string
  attempt?:     number
}): Promise<RefineFaceResult> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const prompt = buildPrompt(input.identity, input.attempt ?? 1)

  // Light brightness lift on dark face crops
  const buf    = Buffer.from(input.faceCropB64, 'base64')
  const stats  = await sharp(buf).greyscale().stats()
  const bright = stats.channels[0].mean
  const lift   = bright < 170 ? Math.min(170 / bright, 2.2) : 1.0
  const prepared = lift > 1.0
    ? await sharp(buf).modulate({ brightness: lift }).png().toBuffer()
    : await sharp(buf).png().toBuffer()

  const file = await toFile(prepared, 'face.png', { type: 'image/png' })

  const result = await openai.images.edit({
    model:   'gpt-image-1',
    image:   file as any,
    prompt,
    size:    '1024x1024',
    quality: 'high' as any,
    n:       1,
  })

  const b64 = result.data?.[0]?.b64_json
  if (!b64) throw new Error('face_refine_no_image_returned')

  return { imageB64: b64, promptUsed: prompt }
}

// ── PROMPT ──────────────────────────────────────────────────────

function buildPrompt(p: PersonIdentity | null, attempt: number): string {
  const identityBlock = p
    ? buildIdentityBlock(p)
    : `(No structured identity profile available. Use the source crop as the absolute reference. Match age, hair, expression, and every facial feature exactly.)`

  const retryReinforcement = attempt > 1
    ? `\nRETRY ATTEMPT ${attempt} — PRIORITIZE LIKENESS:
Previous attempts didn't match closely enough. Treat this face as a portrait sculpture commission. Match every feature directly from the source crop. Reduce stylization further.\n`
    : ''

  return [
    'Transform the provided face photograph into a museum-quality painted resin collectible figurine BUST — head and shoulders portrait, hero scale.',

    `FRAMING — HERO PORTRAIT BUST:
- Head and shoulders only (no full body, no legs)
- Face occupies 50-65% of frame height
- Subject centered, looking slightly toward camera
- Plain neutral light-grey studio backdrop, soft gradient
- Tight cropped composition — bust and a hint of upper chest`,

    `LIKENESS — ABSOLUTE PRIORITY:
This is a portrait sculpture of a real, specific person. Every identity-critical feature carries through from the source crop. The sculpt must be unmistakably them.`,

    identityBlock,

    `IDENTITY DISCIPLINE — NON-NEGOTIABLE (STYLIZATION MUST NOT TOUCH THESE):

AGE PRESERVATION:
- Render this person at their EXACT age in the source crop
- If hair is grey or salt-and-pepper, hair stays grey or salt-and-pepper
- If smile lines, weathered skin, age signals are present, they remain — these are identity, not blemishes
- Do not de-age, do not idealize age away
- Stylization smooths surface texture, NEVER reduces apparent age

FACE GEOMETRY:
- Same face shape (round, oval, square, heart-shaped) as source
- Same nose shape and size, same mouth shape, same eye spacing and shape
- Same jaw, same cheekbones, same brow line
- Same expression — sculpt the exact smile or look from the source

HAIR:
- Exact color, exact style, exact part
- If grey, paint it grey. If brown, paint brown. Never substitute.

DISTINGUISHING FEATURES (preserve all):
- Glasses: present iff present in source
- Facial hair: exact shape, density, color
- Visible moles, freckles, scars: preserve
- Ear shape and size: preserve
- Body weight indicators (face fullness, jawline): preserve`,

    retryReinforcement,

    `STYLIZATION — PREMIUM MINIATURE COLLECTIBLE TREATMENT (~12%):

Apply the gentle stylization of premium hand-painted resin collectibles.
Aesthetic target: Pixar-adjacent realism — slightly idealized but unmistakably this person.

SOFTEN (these are stylization moves):
- Skin texture: smooth, subtly painterly — no skin pores, no harsh wrinkle detail (unless they're identity-critical age signals)
- Edges and contours: cleaner and slightly rounded compared to a scan
- Fine surface noise: removed — surfaces read as hand-painted resin
- Eyes: slightly more luminous, catchlights pronounced for life
- Skin tone: unified with subtle warmth, painterly quality

PRESERVE (never stylize away — see Identity Discipline above):
- Age, hair color, face geometry, expression, glasses, distinguishing features

Result: "premium handcrafted figurine portrait" — recognizable as this exact person, presented with the warmth of a master sculptor.

NOT chibi, NOT Funko Pop, NOT anime, NOT cartoon. Sideshow / Hot Toys / Iron Studios premium territory.`,

    `MATERIAL — PREMIUM PAINTED RESIN COLLECTIBLE:
- Matte-to-satin painted resin on skin with subtle highlights on cheekbones, brow, nose bridge, chin
- Hair sculpted with strand definition, painted with color variation (never a flat block)
- Eyes glossy with sharp catchlights — most identity-critical feature
- Eyebrows and lashes sculpted and painted with detail
- Skin shows fine painted brushwork at close inspection`,

    `LIGHTING — CLEAN STUDIO PORTRAIT:
- Warm key light from upper-left, ~45° above horizon, soft and broad
- Face cleanly and flatteringly lit — no harsh shadows across nose, eyes, jaw
- Sharp catchlights in eyes
- Soft fill from right
- Subtle warm rim from behind for separation
- Shadows soft-edged

Lighting is clean and even — no atmospheric mood, no dramatic shadows. The bust must read clearly so it composites cleanly into the surrounding group image.`,

    `OUTPUT:
- Square 1024x1024
- Subject sharp and crisp
- Background out of focus, neutral, recedes`,

    `DO NOT:
- Render younger or older than source
- Substitute hair color
- Drop or add facial hair vs source
- Drop glasses present in source
- Change face shape, nose, or expression
- Replace with an idealized or generic face
- Slim body weight (preserve face fullness from source)
- Apply chibi, Funko, or cartoon stylization`,

    'A family member should look at this bust and immediately recognize this exact person at their actual age — softened by tasteful sculptor\'s warmth, but unmistakably them.',
  ].filter(Boolean).join('\n\n')
}

function buildIdentityBlock(p: PersonIdentity): string {
  const lines = [
    'PERSON PROFILE (from source group photograph):',
    `  Approximate age: ${p.approximate_age}`,
    `  Age signals (preserve exactly): ${p.age_indicators}`,
    `  Presentation: ${p.presentation}`,
    `  Face shape: ${p.face_shape}`,
    `  Notable features: ${p.notable_features}`,
    `  Hair color (paint exactly): ${p.hair_color}`,
    `  Hair style: ${p.hair_style}`,
    `  Facial hair: ${p.facial_hair}`,
    `  Skin tone: ${p.skin_tone}`,
    `  Glasses: ${p.glasses}`,
    `  Expression (sculpt exactly): ${p.expression}`,
  ]
  if (p.notable) lines.push(`  Notable: ${p.notable}`)
  return lines.join('\n')
}
