// lib/v1/landscapes/landscapes-refine.ts
//
// Pass 2 of the 2-pass Landscape pipeline.
//
// Pass 1 (NB2 / google/nano-banana-2) handles structure, composition,
// camera, containment, circular-base logic, and environment selection.
// Pass 2 (this module, gpt-image-1) takes Pass 1's output and refines
// material realism, micro-texture, and lighting depth — without
// overriding the composition or environment Pass 1 established.
//
// Pass 1 = structure. Pass 2 = paint. Lighting is shared across both:
// Pass 1 establishes direction, atmosphere, and which features are
// brightest; Pass 2 refines how convincingly that lighting renders.
// If Pass 2's prompt contradicts Pass 1's lighting direction, Pass 2
// (the painter) wins because it has the last word on the surface.
// PASS2_LIGHTING is therefore phrased to PRESERVE Pass 1's atmospheric
// phenomena, not constrain them.
//
// REVISION HISTORY:
//   • r1: Pass 2 added (separate from Pass 1 NB2 generation)
//   • r2: env-aware reinforcement (controlled vs in_situ) added
//   • r3: compressed ~30% by deduping vs PASS2_ADDON, extracted
//         CONTAINMENT as a named prominent block
//   • r4: CONTAINMENT extended to ban floating atmospheric phenomena
//   • r5: in-situ env block header → "IN-ENVIRONMENT"
//   • r6: PASS2_LIGHTING flipped from constrain-down to preserve;
//         PASS2_REALISM plinth phrase rewritten for consolidated
//         PLINTH_BLOCK
//   • r7: 1.45× exposure anchor + local-variance directive added;
//         organic-overgrowth exception mirrored from SPATIAL_RULES;
//         3-element plinth profile lockstep with new PLINTH_BLOCK
//   • r8: tiered luminance (subject 1.45× + foreground 1.2× +
//         baseline); PLINTH gained 4:1 scene-to-plinth ratio + "err
//         thinner" hedge in lockstep with effects.ts
//   • r9: PLINTH height anchor reworked. Three competing relative
//         ratios (1/10 diameter + 4:1 scene-to-plinth + "err thinner")
//         were diluting each other and not landing a specific
//         thickness. Replaced with a single direct frame-relative
//         ceiling: "no more than 5% of image height". Profile
//         simplified from 3-element (bead / flat middle / base
//         molding) to 2-element trim (subtle top chamfer + rolled
//         bottom molding) with no minimum vertical extent on the
//         cylindrical body. The "flat middle" was implicitly
//         demanding vertical real estate. Lockstep with effects.ts
//         PLINTH_BLOCK.
//   • r10 (this): three coordinated changes after a Desk-environment
//         render produced an arched-display-panel failure (curved
//         flat panel with the scene printed on it, mounted on a
//         correct plinth). Negative directives were not enough — no
//         positive 3D-physical assertion was anywhere in the prompt.
//
//         (a) PASS2_CONTAINMENT opens with a 3D-physical assertion:
//             "real 3D physical content — actual miniature trees,
//             dirt, stone, water — standing as solid objects on the
//             plinth's flat top surface. Never a printed image,
//             billboard, curved panel, framed picture, or display
//             screen." Mirrors PLINTH_BLOCK opening in effects.ts.
//
//         (b) PASS2_CONTAINMENT restructured to consolidate the
//             organic boundary handling (ground encouraged + vertical
//             canopy + 5% image width), the no-enclosure rule
//             ("no vertical, curved, or round cropping line above
//             the base"), and source-arch reinterpretation. Mirrors
//             SPATIAL_RULES_BLOCK in effects.ts.
//
//         (c) Inline user-mode plaque block updated: plaque
//             proportion switched from "≤ three-quarters the plinth's
//             height" to "≤ 3% of image height". Frame-relative anchor
//             matching the plinth's frame-relative 5% ceiling. With
//             plinth at 5% and plaque at 3%, plaque reads as visually
//             subordinate without depending on the model computing a
//             ratio of one variable thing to another.
//
// Failure of this stage is non-fatal. The caller is expected to fall
// back to the Pass 1 output if refine throws.

import OpenAI, { toFile } from 'openai'
import type { AspectRatio, PlaqueMode, ResolvedEnvironment } from './landscapes-shared'
import { buildPass2PlaqueBlock } from './landscapes-plaque'

// ──────────────────────────────────────────────────────────────
// PASS 2 PROMPT BLOCKS — named, compressed, deduped
// ──────────────────────────────────────────────────────────────

// CORE — composition lock + scope of work.
const PASS2_CORE = `Transform this miniature diorama into a gallery-quality photograph of a real handcrafted scale model. Preserve the source image's composition, camera, plinth, ground, and scene boundaries exactly. Refine realism only — no layout changes, no environment substitution, no scene redesign.`

// REALISM — material, texture, micro-detail, natural variation.
// Plinth language must match effects.ts PLINTH_BLOCK exactly. Single
// frame-relative height ceiling (5% of image height); 2-element trim
// (subtle top chamfer + rolled bottom molding); cylindrical body has
// no minimum vertical extent.
const PASS2_REALISM = `REALISM:
Each material reads at miniature scale with natural imperfection. Terrain: fine grit, irregular variation. Vegetation: organic density, randomized non-repeating branching, dense chaotic micro-structure. Water (when present): depth, reflection, transparency, surface variation. Stone, soil, bark, grass, foliage: distinct miniature-scale texture. Walnut plinth: thin turned-wood disc with two restrained trim elements — a subtle chamfer or small bullnose at the upper edge (barely a feature), and a slightly more prominent rolled base molding at the bottom that curves outward. The cylindrical body between has no minimum vertical extent. Plinth's total vertical thickness occupies no more than 5% of the image height — read it as a serving tray rim or watch case bottom, never a pedestal, drum, or tier. Err thinner, never thicker. Richly figured grain in walnut or mahogany, deep polished sheen. Visual interest from grain and the restrained trim, not from height. Plinth front rim stays clean — no fallen branches, twigs, or debris at the front edge. Edges read as physically constructed, not digitally generated. Atmospheric effects (mist, fog, light rays) vary spatially — localized pockets influenced by terrain and water, never uniform. Edge transitions at the diorama boundary feel naturally broken via vegetation, soil variation, rocks, or erosion. Avoid smoothing, plastic finish, repeated patterns, symmetric arrangements, sparse uniformity.`

// LIGHTING — preserve Pass 1's atmospheric phenomena, refine for
// miniature-scale credibility. Tiered luminance:
//   • Subject tier 1.45× — hero, plaque, standout features
//   • Foreground tier 1.2× — front quarter of scene, depth separation
//   • Background — baseline, deliberately darker
// Local-variance directive prevents gpt-image-1 from rendering
// brightened features as uniform wash.
const PASS2_LIGHTING = `LIGHTING:
The diorama renders brighter than its surroundings with directional shadow falloff. Apply tiered localized luminance for depth:

Subject tier (~1.45× exposure): hero subject, plaque, and standout compositional features (docks, walkways, structures, water reflections) — the brightest points in the frame.

Foreground tier (~1.2× exposure): elements in the front quarter of the diorama scene (near-rim ground content, foreground grass, props closest to the viewer) that aren't already in the subject tier — softer lift establishing near-to-far depth separation.

Background and surroundings remain at baseline, deliberately underexposed by comparison.

Within the lifted tiers, lighting varies locally — facets, edges, and surfaces catch light at different intensities, never a uniform wash. PRESERVE Pass 1's atmospheric phenomena — visible sun shafts, god-rays, moonbeams, beam-interaction with mist and particulate, the dramatic volumetric depth Pass 1 established. Refine these for physical believability and miniature-scale credibility; do not mute, soften, or remove them.`

// CONTAINMENT — physical-vs-atmospheric containment + plinth
// geometry lock + organic boundary handling + no-enclosure rule.
// Mirrors SPATIAL_RULES_BLOCK in effects.ts. Carries a positive
// 3D-physical assertion at the open since Pass 2 needs to defend
// against any 2D-display-panel interpretation Pass 1 may have started.
const PASS2_CONTAINMENT = `CONTAINMENT (CRITICAL):
The diorama is always real 3D physical content — actual miniature trees, dirt, stone, water, structures — standing as solid objects on the plinth's flat top surface. Never a printed image, painted scene, billboard, curved display panel, framed picture, or display screen. The plinth's edge is the absolute boundary of the physical scene.

PHYSICAL elements — terrain, water, constructed structures, paths, rocks, props, figures — sit on or inside the wooden plinth. Constructed elements never overhang or extend past the plinth edge. The plinth is not a decorative ring inset on a larger landscape; it is the entire stage.

ORGANIC BOUNDARY HANDLING:
Ground-level organics (grass, moss, vines, ferns, low brush) — overhanging the camera-facing front and lateral rim is encouraged, not just allowed. The rear rim (away from camera) stays contained.
Vertical organics (trees, tall plants) — terminate at the top as canopy or randomized organic growth (irregular branch ends, tapering foliage). Canopy may extend laterally up to ~5% of image width past the plinth edge. Trees that exceed the image frame are CROPPED BY THE IMAGE FRAME — like a scale model photographed too close — never by an enclosure.

NO ENCLOSURE ABOVE THE PLINTH:
The space above the plinth top is open air. No vertical, curved, or round cropping line frames or terminates the scene anywhere above the base. No glass dome, bell jar, cloche, display case, transparent cover, curved panel, half-dome, arch, ring, or boundary line. No background plates, printed scenery, or sky panels.

PLINTH GEOMETRY: always a flat cylindrical disc — top, bottom, and curved side wall. NEVER extends upward into a wall, arch, half-dome, canopy, or enclosure, even when the upward extension would be wood matching the plinth itself.

If the source's composition forms an arch or converging shape (a road framed by tree canopies, a tunnel of branches, a corridor of rocks), reproduce that as TALL MINIATURE TREES or ROCKS standing as 3D objects on the flat plinth — never as the diorama's enclosure.

ATMOSPHERIC phenomena (fog, mist, light shafts, distant blur, haze) may extend past the plinth as background ambience — never as solid floating objects. No floating clouds, sun discs, halos, or fog masses hovering above the scene as filler.`

// ENV REINFORCEMENT — mode-specific. Block header for in_situ reads
// "IN-ENVIRONMENT" to match the user-facing UI label "In Environment".
const PASS2_ENV_BLOCKS: Record<ResolvedEnvironment, string> = {
  controlled: `ENVIRONMENT (DESK):
Diorama sits on a polished wood desk, stone shelf, or refined surface in an upscale study — bookshelves, framed prints, layered props softly out of focus behind. The room is secondary; the diorama is the subject. Light fixtures stay positioned out of frame so their light is felt but the source is not seen.`,

  in_situ: `ENVIRONMENT (IN-ENVIRONMENT — OUTDOORS):
The diorama is outdoors, photographed in nature. The plinth sits directly on natural terrain (grass, dirt, sand, rock, moss, leaf litter) that continues the source environment. The background is a blurred continuation of the source scene — sky, foliage, terrain, weather.

NEVER add wood tables, desks, shelves, mantles, counters, tile, painted wood, room walls, ceilings, windows, doors, furniture, indoor lighting, hanging bulbs, or lamps. Natural ground only beneath and around the plinth. If the source shows the diorama on natural terrain, preserve that ground exactly.`,
}

// ──────────────────────────────────────────────────────────────
// PROMPT ASSEMBLER
// ──────────────────────────────────────────────────────────────

function buildPass2Prompt(opts: {
  plaqueMode:          PlaqueMode
  plaqueText?:         string
  resolvedEnvironment: ResolvedEnvironment
}): string {
  const blocks: string[] = [
    PASS2_CORE,
    PASS2_REALISM,
    PASS2_LIGHTING,
    PASS2_CONTAINMENT,
    PASS2_ENV_BLOCKS[opts.resolvedEnvironment],
  ]

  if (opts.plaqueMode === 'user' && opts.plaqueText?.trim()) {
    const safe = opts.plaqueText.trim().replace(/"/g, '\\"')
    blocks.push(`PLAQUE:
A small brass plaque is mounted on the front rim of the walnut plinth — at most 3% of the image height, never the visual hero. The plaque reads exactly: "${safe}". Render the text clearly and legibly in engraved capitals. Do not change, abbreviate, paraphrase, or invent any other text on the plaque. Plaque text must never include timestamps, filenames, "Screenshot", or technical metadata under any condition.`)
  } else {
    blocks.push(buildPass2PlaqueBlock(opts.plaqueMode))
  }

  return blocks.join('\n\n')
}

// ── ASPECT → GPT-IMAGE-1 SIZE ─────────────────────────────────
type GptImageSize = '1024x1024' | '1536x1024' | '1024x1536' | 'auto'

function aspectToGptSize(aspect?: AspectRatio): GptImageSize {
  if (!aspect) return 'auto'
  const [w, h] = aspect.split(':').map(Number)
  if (!w || !h) return 'auto'
  const ratio = w / h
  if (ratio > 1.15) return '1536x1024'
  if (ratio < 0.87) return '1024x1536'
  return '1024x1024'
}

// ── INPUT/OUTPUT ──────────────────────────────────────────────
export interface RefineInput {
  imageB64:             string
  aspectRatio?:         AspectRatio
  plaqueMode:           PlaqueMode
  plaqueText?:          string
  resolvedEnvironment:  ResolvedEnvironment
  openaiApiKey:         string
}

export interface RefineOutput {
  imageB64:   string
  promptUsed: string
  size:       GptImageSize
}

// ── MAIN ENTRY POINT ──────────────────────────────────────────
export async function refineLandscape(input: RefineInput): Promise<RefineOutput> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  const size   = aspectToGptSize(input.aspectRatio)
  const prompt = buildPass2Prompt({
    plaqueMode:          input.plaqueMode,
    plaqueText:          input.plaqueText,
    resolvedEnvironment: input.resolvedEnvironment,
  })

  const buf  = Buffer.from(input.imageB64, 'base64')
  const file = await toFile(buf, 'pass1.png', { type: 'image/png' })

  console.log(
    `[landscape/refine] Pass 2 dispatching: aspect=${input.aspectRatio || 'auto'} ` +
    `size=${size} input_bytes=${buf.length} env=${input.resolvedEnvironment} ` +
    `plaque_mode=${input.plaqueMode}${input.plaqueText ? ` plaque_text="${input.plaqueText}"` : ''} ` +
    `prompt_chars=${prompt.length}`,
  )

  const t0 = Date.now()

  const res = await openai.images.edit({
    model:  'gpt-image-1',
    image:  file,
    prompt,
    size:   size === 'auto' ? undefined : size,
  })

  const b64 = res.data?.[0]?.b64_json
  if (!b64) {
    throw new Error('GPT-image-1 returned no image data')
  }

  console.log(
    `[landscape/refine] Pass 2 done in ${Date.now() - t0}ms · ` +
    `output_chars=${b64.length}`,
  )

  return {
    imageB64:   b64,
    promptUsed: prompt,
    size,
  }
}
