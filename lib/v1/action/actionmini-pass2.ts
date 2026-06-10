// lib/v1/actionmini-pass2.ts
//
// Pass 2 of the 2-pass Action Minis pipeline.
//
// Pass 1 (NB2 / google/nano-banana-2, in actionmini-generator.ts) handles
// figure identity, pose, expression, anatomy, equipment, material identity,
// the complementary base, location, and scene lighting register driven
// by the LOCATION block in actionmini-blocks.ts.
//
// Pass 2 (this module, gpt-image-1) takes Pass 1's output and refines
// material micro-texture, surface tactility, tiered luminance, and
// miniature-scale credibility — without overriding the figure, material,
// base, or lighting register Pass 1 established.
//
// V6 changes vs V5:
//   • PASS2_LIGHTING aligned to V6 architecture: lighting register is
//     LOCATION-owned, not preset-owned. The block declares THREE registers
//     (god-ray beam at pedestal; 3-point at desk/shelf/workshop; daylight+
//     beam+key at in_situ) and instructs Pass 2 to preserve whichever
//     register Pass 1 used for the resolved location. Strong anti-averaging
//     language carried throughout — explicit hero/context exposure ratios.
//   • PASS2_LOCATION_BLOCKS rewritten to mirror Pass 1's V6 LOCATION blocks
//     with full lighting reinforcement. Each block leads with the location
//     setup, then the lighting recipe and exposure ratio. Pass 2 stays in
//     lockstep with Pass 1 by construction.
//   • Material refinement lines updated for the 9-preset list (window_sill
//     and trophy_shelf removed throughout).
//
// Failure of this stage is non-fatal. Generator falls back to Pass 1 on error.

import OpenAI, { toFile } from 'openai'
import type { ActionMiniPresetId } from './actionmini-presets'
import type { LocationId } from './actionmini-blocks'

// ──────────────────────────────────────────────────────────────
// PASS 2 PROMPT BLOCKS
// ──────────────────────────────────────────────────────────────

// CORE — composition lock + scope of work + camera-angle preservation.
const PASS2_CORE = `Transform this miniature sculpture render into a gallery-quality photograph of a real handcrafted physical 3D sculpture. Refine realism ONLY. Pass 1 has established the figure's identity, pose, expression, anatomy, equipment, material register, complementary base, location, and lighting register — Pass 2's job is to PRESERVE all of that exactly while refining surface tactility, edge crispness, miniature-scale credibility, and contrast intensity.

CAMERA ANGLE — PRESERVE EXACTLY:
The source was photographed from approximately 45° above subject, angled down — top of base visible, front of figure visible, product-photography framing. PRESERVE this exact high-angle framing. Never lower toward eye-level, never flatten perspective.

NO RESTRUCTURING:
- No pose changes, no body angle shifts, no expression substitution
- No equipment alterations, additions, or removals
- No material recasting (bronze stays bronze, wax stays wax, painted resin stays painted resin)
- No environment substitution or location redesign
- No lighting register changes — if Pass 1 used a god-ray beam, Pass 2 keeps the beam; if Pass 1 used 3-point, Pass 2 keeps 3-point`

// FIGURE PRESERVATION — the single most important block for Action.
// Aggressive about face/hands/equipment because gpt-image-1's most common
// regression sites.
const PASS2_FIGURE_PRESERVATION = `FIGURE PRESERVATION (NON-NEGOTIABLE — FACE FIDELITY IS THE PRIMARY REQUIREMENT):

The figure's face, body, anatomy, pose, expression, and equipment match Pass 1 exactly. Pass 2 refines surface detail and material rendering only — never restructure the figure.

FACE FIDELITY IS THE PRIMARY REQUIREMENT. If you must choose between refining material/surface and preserving the source-photo facial likeness, ALWAYS preserve the face. A material-perfect figure with a generic or drifted face is a FAILURE. A slightly less-refined material with the correct, recognizable face is a SUCCESS.

FACE — match the SOURCE PHOTOGRAPH exactly:
- Exact eye spacing, eye shape, lid contour, brow ridge
- Exact nose bridge, nostril shape, nose-to-mouth distance
- Exact mouth width, corner angle, lip thickness
- Exact jawline, chin point, ear position, hairline
- Exact age read and ethnic features
NEVER alter facial proportions, age read, eye position, mouth shape. NEVER swap one face for another. NEVER drift toward an idealized or generic face. The source photo's face is the anchor — hold it through any material refinement.

HANDS AND FINGERS: every finger fully articulated as in Pass 1. Refine knuckle definition, fingernail edges, grip detail. NEVER fuse fingers, NEVER simplify gestures, NEVER substitute one hand pose for another.

EQUIPMENT (helmets, straps, buckles, soles, board edges, gloves, hardware, gear): every piece anatomically and mechanically correct as in Pass 1. Refine surface detail (stitching, padding, hard-edge crispness, fabric weave). NEVER alter equipment identity or articulation.

POSE AND BODY: pose, body angle, leaning, gesture, weight distribution preserved exactly. Refine muscle definition, fabric folds, hair strands. NEVER restructure the pose.

This block overrides any softening from other directives. Figure fidelity, and especially face fidelity, is the hardest requirement in the prompt.`

// FACE STRUCTURAL FREEZE — V6.2 critical directive. Splits the face into
// two explicit zones: GEOMETRY (locked, do not edit) and SURFACE
// (refinable). Gives gpt-image-1 permission to do nothing — better to
// leave the face untouched than to drift it. Lives at the END of the
// Pass 2 prompt for highest attention weight.
const PASS2_FACE_FREEZE = `=== FACE STRUCTURAL FREEZE — CRITICAL DIRECTIVE (HIGHEST PRIORITY) ===

The face GEOMETRY from Image 2 (Pass 1's render) — and, when Image 1 is provided, further anchored to the source photograph's face features — is LOCKED. Pass 2's only job for the face is SURFACE refinement, never structural change.

LOCKED (DO NOT EDIT — face geometry):
- Eye positions, eye spacing, eye shape, eyelid contours, brow ridge
- Nose bridge angle, nose width, nostril shape, nose-to-mouth distance
- Mouth width, mouth corner position, lip shape, lip thickness
- Jawline angle, chin point position
- Ear position and shape
- Hairline shape and position
- Overall facial proportions, age read, ethnic features, gender presentation

REFINABLE (Pass 2 may polish — face surface only):
- Material rendering on the face (alabaster subsurface glow, bronze patina, ceramic glaze, painted resin brushwork, wax translucency, terracotta clay matte — whatever material register Pass 1 established)
- Edge sharpness around eyes, nose, mouth — WITHOUT moving them
- Micro-shadows under brow, chin, nose — WITHOUT changing geometry
- Material-specific micro-texture (craquelure on ceramic, grain on wood, verdigris in recesses on bronze)

PERMISSION TO DO NOTHING:
If you cannot refine the face surface without altering the face geometry, do NOTHING to the face. Leave the face pixels exactly as they appear in the input. The only acceptable failure mode for the face is "no refinement applied." The UNACCEPTABLE failure mode is "drifted features" — a face whose geometry shifted, eyes moved, nose changed, mouth substituted, jaw redrawn, or any structural alteration.

A face left untouched from Pass 1 is correct. A face refined toward an idealized or generic geometry is broken, regardless of how good the material rendering looks.`

// TWO-IMAGE INPUT — included in the prompt only when Pass 2 receives both
// the source photograph and the Pass 1 render. Assigns explicit roles per
// image so gpt-image-1 transfers face features from the source while
// preserving everything else from Pass 1. Without this block the model
// would blend the two images in unintended ways (color, composition,
// background bleed from the source).
const PASS2_TWO_IMAGE_INPUT = `TWO-IMAGE INPUT — EXPLICIT ROLES PER IMAGE:

You are receiving TWO images. They have specific, NON-INTERCHANGEABLE roles.

IMAGE 1 — THE SOURCE PHOTOGRAPH:
Use ONLY for facial likeness reference. Read the source's face features (eye spacing, eye shape, nose bridge, mouth, jawline, ears, hairline, age, ethnic features) and transfer those features onto the figure(s) in Image 2. If Image 1 has multiple subjects, map each subject's face onto the corresponding figure in Image 2 by pose / position / equipment correspondence.

DO NOT pull from Image 1: color palette, material, lighting, background, composition, framing, base/plinth, atmospheric register, sculpture vs. photo register. Image 1 is photorealistic and full-color; the OUTPUT IS NOT photorealistic — the output remains a sculpted miniature in the material register established by Image 2.

IMAGE 2 — THE RENDERED MINIATURE (PASS 1 OUTPUT):
Preserve everything else from Image 2: material (bronze stays bronze, wax stays wax, painted resin stays painted resin, alabaster stays alabaster, wood stays wood, etc.), pose, body angle, gesture, equipment articulation, complementary base, location/staging, atmospheric depth, lighting register, beam direction, exposure tiering, framing, scale.

OUTPUT:
The OUTPUT is Image 2's miniature sculpture rendering with Image 1's specific facial likeness transferred onto the figure(s). The output is NOT a blend, NOT a composite, NOT a photo of the source — it is the Pass 1 miniature with the correct face anchored from the source. Material register is INVIOLABLE: a hand-painted resin figure stays painted resin even when the source photo is full-color skin; an alabaster figure stays alabaster even when the source has skin tones; a bronze figure stays bronze even when the source is a person with hair color.`

// MATERIAL REFINEMENT — per-material refinement targets, with explicit
// preservation rules to prevent gpt-image-1 from photorealizing
// hand-painted finishes or adding color where Pass 1 established monochrome.
// Also covers the complementary base material (patina'd bronze for most
// presets, bronze for wax_bronze/bronze_bronze, raw wood for carved_wood).
const PASS2_MATERIAL_REFINEMENT = `MATERIAL REFINEMENT — PRESERVE MATERIAL REGISTER:
Refine the material rendering exactly in the register Pass 1 established. Material identity is INVIOLABLE — Pass 2 does not recast materials, translate hand-painted finishes into photoreal skin or leather, or add color where Pass 1 established monochrome.

PER-MATERIAL REFINEMENT TARGETS (apply only the one Pass 1 used):
- Solid bronze: verdigris in deep recesses, polish on raised surfaces, warm metallic catchlights along edges. Stays fully monochrome bronze — no painted color anywhere.
- Cast wax: subsurface translucency, amber thinness at edges (fingertips, thin fabric, spray particles), warm internal glow. Stays fully monochrome wax.
- Hand-painted resin or ceramic: visible brushwork, slight artistic stylization. Source colors carried through as PAINT on the surface, NOT as photorealistic skin/leather/fabric. Painted finish reads as a craftsman's brushwork — hobby-collectible quality, not photographic.
- Plushy fabric: woven yarn texture, soft sewn material, visible seams. NOT photorealistic skin, NOT photorealistic leather.
- Terracotta: warm earth-orange-brown, crack-line interior depth showing lighter inner clay where breaks occur. Stays fully monochrome terracotta — no painted colors.
- Alabaster: translucent stone, internal warm glow varying with thickness, off-white to warm-cream throughout. Stays fully monochrome alabaster.
- Mixed metals: each metal's distinct surface holds its own character — copper warm, brass golden, bronze warm, pewter cool, titanium cool-blue, steel neutral. No paint anywhere.
- Carved wood: raw natural wood throughout, color variation from grain and lighting only. Stays fully monochrome wood — no source-photo colors.

THE BASE: the figure sits on a complementary base (patina'd bronze for most presets; solid bronze for wax_bronze/bronze_bronze; the carved log itself for carved_wood). Refine the base material with the same care as the hero figure — verdigris in recesses, warm polish on raised edges, sculpting visible. The base is part of the work, NOT a thin disc. Same patina/finish on the base regardless of how the hero figure was treated.

MICRO-TEXTURE: surface reads at miniature scale with natural imperfection. Sculpting tool marks visible where appropriate. Edges crisp and physical, not digitally smoothed. Avoid plastic finish, repeated patterns, sparse uniformity.`

// LIGHTING — V6.2 global rules + mode preservation. Pass 1 owns the full
// lighting mode description (gallery / environment / collectible); Pass 2
// preserves whichever Pass 1 used and refines within it. This block is
// substantially shorter than the V6.1 version because it no longer
// re-describes each mode — Pass 2 trusts Pass 1's mode block.
const PASS2_LIGHTING = `LIGHTING — DRAMATIC LUMINANCE HIERARCHY (preserve from Pass 1):

The renderer behaves like a cinematic lighting director, NOT an automatic exposure correction system. Preserve Pass 1's luminance hierarchy — DO NOT smooth it back to balanced.

PRIORITIZE on refine: luminance hierarchy, intentional darkness, localized exposure concentration, emotional contrast, atmospheric depth, hero-first readability.

ALLOW: deep shadows, partial environmental loss, dramatic falloff, localized overexposure near key light sources.

AVOID: exposure averaging, globally balanced midtones, uniform brightness distribution, HDR-style flattening, equal scene readability.

EXPOSURE TARGET (preserve from Pass 1):
The Subject (figure plus its complementary base) sits at approximately 1.6× the brightness of its surroundings — the brightest point in the frame, never matched or overpowered by environmental light sources (sun, sky, ambient daylight, room lighting). Surroundings hold detail through pools of light and shadow but stay tiered visibly below the Subject's exposure. Within the lifted Subject tier, lighting varies locally — facets, edges, and surfaces catch light at different intensities, never a uniform wash.

LIGHTING MODE PRESERVATION:
Pass 1 used one of three lighting modes — GALLERY (concentrated top-light or volumetric beam, deep architectural shadow), IN-ENVIRONMENT (motivated natural light from sun/moon/firelight with environmental backgrounds receding through haze), or COLLECTIBLE (practical motivated lighting from desk lamps, window light, workshop lighting, with backgrounds in cinematic vignette behavior). Identify which mode Pass 1 used and refine WITHIN it. Do not convert mode A into mode B. Refine each mode's defining qualities — beam volumetrics, environmental haze and atmospheric perspective, practical-light pools and bounce — without altering the mode itself.`

// LOCATION REINFORCEMENT — per-location, V6-aligned. Each block re-states
// the V6 location setup (with complementary base) and the lighting recipe
// Pass 1 was given. Pass 2 stays in lockstep with Pass 1 by construction.
const PASS2_LOCATION_BLOCKS: Record<LocationId, string> = {
  pedestal: `LOCATION (PEDESTAL — museum rotunda):
The Subject sits on a marble pedestal cap in a rotunda of expensive polished marble — domed ceiling above, marble columns ringing the perimeter, checkered marble floor receding into atmospheric depth. The Subject's complementary base fits the pedestal cap as if designed for it. Refine marble surface micro-detail and the figure's hero highlights without altering the staging Pass 1 established.

NEVER add desks, books, sculpting tools, certificates, ribbons, framed photos, busts, hardcover library books, or any "collector's display" props.`,

  desk: `LOCATION (DESK — serious collector's wood desk):
The Subject sits on a warm wood desk in a serious collector's space. The Subject's round complementary base sits intentionally on the desk surface. A reference book, fine pen, or sculpting tool may rest nearby in soft focus. Bookshelves recede into warm atmospheric blur behind. Refine wood grain to read richly figured; refine prop materials and bokeh depth; preserve the staging Pass 1 established.`,

  shelf: `LOCATION (SHELF — trophy display on rectangular shelf):
The Subject sits on a wooden shelf in a dedicated trophy display. The Subject's RECTANGULAR complementary base fits the shelf depth precisely, parallel to the shelf front. Surrounded by actual trophies — gold-plated cups, marble-base plaques, championship hardware, framed certificates leaning at angles, competition medals on satin ribbons. Soft horizontal lines of shelves above and below visible at frame edges. Refine wood grain (worn satin finish), trophy metal finishes (warm gold, polished brass), marble base textures, ribbon satin, certificate paper, and engraving depth on plaques.

NEVER add desks, beds, study clutter, magnifying glasses, or non-trophy props.`,

  workshop: `LOCATION (WORKSHOP — sculptor's studio in active use):
The Subject sits on a rough wooden workbench in the sculptor's working studio. The Subject's round complementary base sits intentionally on the bench between scattered tools. The bench is scarred from years of use — knife marks, dried glue, chalk lines, water rings, fine sawdust, wood shavings or clay flecks. Many sculpting tools (gouges, files, calipers, knife, mallet, vise at the bench edge). A work-in-progress raw material block (partial log, rough armature, uncut stone) sits nearby. Reference sketches pinned to a corkboard or wood-paneled wall behind. Refine the rough bench grain, tool metal finishes, sawdust granularity, paper texture on pinned sketches, and walls receding into depth.

NEVER add hardcover library books, framed certificates of authenticity, polished oak desks, formal bookshelves, study furniture, museum pedestals, or "collector's display" props.`,

  in_situ: `LOCATION (IN ENVIRONMENT — sculpture in real-world action setting):
The Subject sits on the actual surface where the action happens — wrestling mat, boxing canvas, cage floor, gym floor, packed dirt, snow, ocean shore, rock, track, stage, packed earth — depending on the sport. The Subject's round complementary base sits directly on this real action surface; the base is the work, the surface is context. In the background, the actual full-size scene plays out (gym/arena/ring with blurred crowd for indoor sports; natural environment with real action for outdoor sports). All in true real-world materials and colors, NEVER the sculpture's material applied to background subjects. Refine atmospheric depth, surface texture beneath the base at miniature scale, and the heavy painterly blur of distant real-world action. Figure stays razor sharp; background heavily blurred.

THE COMPLEMENTARY BASE IS THE ONLY PLINTH — no second pedestal, no architectural support beneath. NEVER add desks, bookshelves, framed photos, ribbons, certificates, tools, busts, trophies, books, magnifying glasses, or any "collector's display" props.`,
}

// ──────────────────────────────────────────────────────────────
// PROMPT ASSEMBLER
// ──────────────────────────────────────────────────────────────

function buildPass2Prompt(opts: {
  resolvedLocation: LocationId
  presetId:         ActionMiniPresetId
  faceAnchored:     boolean
}): string {
  void opts.presetId  // reserved for future per-preset carve-outs

  const blocks: string[] = []
  // TWO_IMAGE_INPUT must lead when faceAnchored — it tells gpt-image-1
  // how to interpret the two images before any other directive applies.
  if (opts.faceAnchored) blocks.push(PASS2_TWO_IMAGE_INPUT)
  blocks.push(
    PASS2_CORE,
    PASS2_FIGURE_PRESERVATION,
    PASS2_MATERIAL_REFINEMENT,
    PASS2_LIGHTING,
    PASS2_LOCATION_BLOCKS[opts.resolvedLocation],
  )
  // PASS2_FACE_FREEZE goes LAST — closing position has the highest
  // attention weight in attention-decay models. The face freeze is the
  // single most important directive for likeness; it must read last.
  blocks.push(PASS2_FACE_FREEZE)

  return blocks.join('\n\n')
}

// ──────────────────────────────────────────────────────────────
// ASPECT → GPT-IMAGE-1 SIZE
// ──────────────────────────────────────────────────────────────
type GptImageSize = '1024x1024' | '1536x1024' | '1024x1536' | 'auto'

export type AspectRatio =
  | '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '16:9'

function aspectToGptSize(aspect?: AspectRatio): GptImageSize {
  if (!aspect) return 'auto'
  const [w, h] = aspect.split(':').map(Number)
  if (!w || !h) return 'auto'
  const ratio = w / h
  if (ratio > 1.15) return '1536x1024'
  if (ratio < 0.87) return '1024x1536'
  return '1024x1024'
}

// ──────────────────────────────────────────────────────────────
// INPUT / OUTPUT
// ──────────────────────────────────────────────────────────────
export interface ActionMiniRefineInput {
  imageB64:         string             // Pass 1 output (NB2)
  sourceImageB64?:  string             // Original source photograph — used as face-likeness anchor.
                                       //   When provided, Pass 2 receives [source, pass1] and the
                                       //   prompt instructs gpt-image-1 to take face features from
                                       //   the source while preserving everything else from Pass 1.
                                       //   Optional for back-compat; strongly recommended.
  aspectRatio?:     AspectRatio
  resolvedLocation: LocationId
  presetId:         ActionMiniPresetId
  openaiApiKey:     string
}

export interface ActionMiniRefineOutput {
  imageB64:      string
  promptUsed:    string
  size:          GptImageSize
  durationMs:    number
  faceAnchored:  boolean   // true when source photo was provided to Pass 2
}

// ──────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ──────────────────────────────────────────────────────────────
export async function refineActionMini(input: ActionMiniRefineInput): Promise<ActionMiniRefineOutput> {
  const t0     = Date.now()
  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  const size   = aspectToGptSize(input.aspectRatio)
  const faceAnchored = Boolean(input.sourceImageB64)
  const prompt = buildPass2Prompt({
    resolvedLocation: input.resolvedLocation,
    presetId:         input.presetId,
    faceAnchored,
  })

  // Build the image input. With faceAnchored=true, gpt-image-1 receives
  // [source, pass1] and the prompt assigns explicit roles per image.
  const pass1Buf  = Buffer.from(input.imageB64, 'base64')
  const pass1File = await toFile(pass1Buf, 'pass1.png', { type: 'image/png' })

  let imageInput: any
  let inputBytes: number
  if (faceAnchored && input.sourceImageB64) {
    const sourceBuf  = Buffer.from(input.sourceImageB64, 'base64')
    const sourceFile = await toFile(sourceBuf, 'source.jpg', { type: 'image/jpeg' })
    imageInput = [sourceFile, pass1File]
    inputBytes = sourceBuf.length + pass1Buf.length
  } else {
    imageInput = pass1File
    inputBytes = pass1Buf.length
  }

  console.log(
    `[actionmini/pass2] Pass 2 dispatching: aspect=${input.aspectRatio || 'auto'} ` +
    `size=${size} input_bytes=${inputBytes} location=${input.resolvedLocation} ` +
    `preset=${input.presetId} face_anchored=${faceAnchored} prompt_chars=${prompt.length}`,
  )

  const res = await openai.images.edit({
    model:  'gpt-image-1',
    image:  imageInput,
    prompt,
    size:   size === 'auto' ? undefined : size,
  })

  const b64 = res.data?.[0]?.b64_json
  if (!b64) {
    throw new Error('gpt-image-1 returned no image data')
  }

  const durationMs = Date.now() - t0

  console.log(
    `[actionmini/pass2] Pass 2 done in ${durationMs}ms · output_chars=${b64.length} ` +
    `face_anchored=${faceAnchored}`,
  )

  return {
    imageB64:     b64,
    promptUsed:   prompt,
    size,
    durationMs,
    faceAnchored,
  }
}
