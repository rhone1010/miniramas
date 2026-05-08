// houses-refine.ts
// lib/v1/houses-refine.ts
//
// Pass 2 of the 2-pass Houses pipeline.
//
// Pass 1 (NB2 / google/nano-banana-2, in houses-generator.ts) handles
// structure, composition, camera, architectural fidelity, environment
// selection, and the atmosphere/material identity established by the
// preset's MATERIAL/LIGHTING/LAYER blocks.
//
// Pass 2 (this module, gpt-image-1) takes Pass 1's output and refines
// material realism, micro-texture, and lighting depth — without
// overriding the architecture, environment, or atmospheric character
// Pass 1 established.
//
// Pass 1 = structure. Pass 2 = paint. Pass 2 always defers to Pass 1
// on identity (material register, atmospheric mood, room/environment,
// disaster context); Pass 2 owns surface tactility, tiered luminance,
// and miniature-scale credibility. PASS2_LIGHTING is phrased to PRESERVE
// Pass 1's atmospheric phenomena (firelight, moonlight, alien glow,
// haunted streetlamp+moon, fog) — never to mute, soften, or redirect them.
//
// FUTURE — known carve-outs not yet implemented:
//   • snow_globe preset explicitly REQUIRES enclosure (the glass dome).
//     PASS2_CONTAINMENT's "no enclosure above the plinth" rule will
//     conflict. When snow_globe is added to the Pass 2 rollout, swap
//     PASS2_CONTAINMENT for a snow-globe-specific containment block
//     that preserves the dome.
//   • event presets (haunted, fire, alien, abandoned, explosion) have
//     room-matches-disaster rooms that need explicit PRESERVE language
//     in their per-preset env reinforcement. Generic ROOM_IN_HOUSE
//     block is a starting point; events may want preset-specific notes.
//
// Failure of this stage is non-fatal. The caller (houses-generator.ts)
// is expected to fall back to the Pass 1 output if refine throws.

import OpenAI, { toFile } from 'openai'
import type { AspectRatio, EnvironmentId, PresetId, TimeOfDay } from './houses-shared'

// ──────────────────────────────────────────────────────────────
// PASS 2 PROMPT BLOCKS — named, compressed, deduped
// ──────────────────────────────────────────────────────────────

// CORE — composition lock + scope of work. Houses-specific additions
// vs Landscapes: explicit "building geometry" preservation (Pass 1's
// STRUCTURE_FIDELITY_BLOCK is load-bearing — Pass 2 must not redrift
// the architecture) and "atmospheric character" preservation (Houses
// atmospheres are dramatic and preset-specific — fire, haunted, alien
// each have purpose-built lighting that must not be normalized).
const PASS2_CORE = `Transform this miniature diorama into a gallery-quality photograph of a real handcrafted architectural scale model. Preserve the source image's composition, camera, plinth, building geometry, environment, and atmospheric character exactly. Refine realism only — no architectural changes, no environment substitution, no scene redesign.`

// REALISM — material, texture, micro-detail, plinth geometry. Material
// register is preserved from Pass 1 (do NOT homogenize bronze into
// painted wood, or gingerbread into stone). Architectural micro-texture
// targets the surface vocabulary actually rendered by Houses sources:
// clapboards, shingles, brick, trim, glass, foundation. Plinth geometry
// is NEW guidance vs current Houses Pass 1 (the COMPOSITION_BLOCK in
// houses-blocks.ts handles plinth-internal margin but never constrained
// the plinth's height/profile — the chunky double-tier failure mode
// visible in V4 outputs lands here).
const PASS2_REALISM = `REALISM:
Each material reads at miniature scale with natural imperfection, refined in the material register Pass 1 established — preserve the material identity exactly. If Pass 1 rendered solid bronze, refine bronze with verdigris in recesses; if cast wax, refine wax with subsurface translucency; if hand-crafted realistic miniature, refine its painted siding and miniature shingles; if gingerbread, refine gingerbread bake texture and royal-icing trim; if a snow-covered model under glass, refine snow piles and the glass dome's optical mass. Pass 2 does NOT recast materials.

ARCHITECTURAL MICRO-TEXTURE: clapboards or planks read at scale with subtle plank-to-plank tonal variation; shingles individually scribed with weathering subtleties; trim profiles crisp with hand-painted edge irregularity; brick coursework with mortar joint depth and tonal variation between bricks; window glass with micro-glazing, slight reflection, and the suggestion of interior depth; porch detailing (railings, balusters, columns, brackets) with hand-carved chisel-mark fidelity; foundation stone or brick with naturalistic tonal variation; metal elements (weathervanes, gutters, hardware) with appropriate finish.

VEGETATION AND GROUND: organic density, randomized non-repeating branching, dense chaotic micro-structure. Foliage clusters never repeat; grass varies in length and tone; soil and pathway materials carry fine grit and irregular variation.

PLINTH GEOMETRY: the walnut plinth is a thin turned-wood disc — top, bottom, and curved side wall. Two restrained trim elements: a subtle chamfer or small bullnose at the upper edge (barely a feature), and a slightly more prominent rolled base molding at the bottom that curves outward. The cylindrical body between has no minimum vertical extent. Plinth's total vertical thickness occupies no more than 5% of the image height — read it as a serving tray rim or watch case bottom, never a pedestal, drum, or tier. Err thinner, never thicker. Richly figured grain in walnut or mahogany, deep polished sheen. Visual interest from grain and the restrained trim, not from height. Plinth front rim stays clean — no fallen branches, twigs, or debris piled at the front edge.

Edges read as physically constructed, not digitally generated. Avoid smoothing, plastic finish, repeated patterns, symmetric arrangements, sparse uniformity.`

// LIGHTING — preserve Pass 1's atmospheric character, refine for
// miniature-scale credibility. Tiered luminance:
//   • Subject tier 1.45× — house structure + standout features
//   • Foreground tier 1.2× — front-yard plantings, walkway, near rim
//   • Background — baseline, deliberately darker
// Local-variance directive prevents gpt-image-1 from rendering
// brightened features as uniform wash.
const PASS2_LIGHTING = `LIGHTING:
The diorama renders brighter than its surroundings with directional shadow falloff. Apply tiered localized luminance for depth:

Subject tier (~1.45× exposure): the house structure and standout architectural features (porch detail, key facade, prominent windows or interior glow when present, defining trim profiles) — the brightest points in the frame.

Foreground tier (~1.2× exposure): elements in the front quarter of the diorama scene (front-yard plantings, walkway, ground content nearest the viewer) that aren't already in the subject tier — softer lift establishing near-to-far depth separation.

Background and surroundings (rear of plinth, room or in-environment context behind) remain at baseline, deliberately underexposed by comparison.

Within the lifted tiers, lighting varies locally — facets, edges, and surfaces catch light at different intensities, never a uniform wash. PRESERVE Pass 1's atmospheric character: the haze quality, directional warmth, time-of-day mood, atmospheric back-upper brightening, any disaster-driven lighting (firelight from within, alien moonglow, haunted streetlamp meeting cold moon, abandoned dust-haze, snow globe two-source), any preset-specific lighting setup. Refine these for physical believability and miniature-scale credibility; do not mute, soften, or redirect them.`

// CONTAINMENT — physical-vs-atmospheric containment + no-enclosure
// rule. Adapted from Landscapes; Houses-specific addition for tall
// architectural elements (chimneys, towers, turrets, steeples) and
// the source-architecture reinterpretation rule (porte-cochères,
// arched porticos must not become the diorama's frame).
//
// NOTE: snow_globe preset is the documented exception — see header.
const PASS2_CONTAINMENT = `CONTAINMENT:
The diorama is always real 3D physical content — actual miniature architecture, vegetation, terrain, props — standing as solid objects on the plinth's flat top surface. Never a printed image, painted scene, billboard, curved display panel, framed picture, or display screen.

PHYSICAL elements — building walls, porches, walks, foundations, foundation plantings, fences, paths, props — sit on or inside the wooden plinth. Constructed elements (the house itself, walls, paths, foundations) never overhang or extend past the plinth edge. Vegetation may have organic overhang at the front and lateral rim only; the rear rim stays contained.

NO ENCLOSURE ABOVE THE PLINTH:
The space above the plinth top is open air. No vertical, curved, or round cropping line frames or terminates the scene anywhere above the base. No glass dome, bell jar, cloche, display case, transparent cover, curved panel, half-dome, arch, or boundary line — even when the upward extension would be wood matching the plinth itself.

Tall architectural elements (chimneys, towers, turrets, steeples, finials) that exceed the image frame are CROPPED BY THE IMAGE FRAME — like a scale model photographed too close — never by an enclosure within the image.

If the source's architecture features arches, cupolas, or covered entries (a porte-cochère, an arched portico, a deep covered porch), reproduce these as architectural CONTENT projecting from the building — never as the diorama's framing or enclosure.

ATMOSPHERIC phenomena (haze, mist, fog, smoke, dust, light effects) may extend past the plinth as background ambience — never as solid floating objects. No floating clouds, sun discs, halos, or fog masses hovering above the scene as filler.`

// ENV REINFORCEMENT — mode-specific. Block header for in_situ reads
// "IN-ENVIRONMENT" to match the user-facing UI label "In Environment"
// (internal ID stays 'in_situ' for code stability).
const PASS2_ENV_BLOCKS: Record<EnvironmentId, string> = {
  in_situ: `ENVIRONMENT (IN-ENVIRONMENT — OUTDOORS ON THE LAWN):
The diorama is outdoors, photographed on the actual front lawn of the full-size building. The plinth sits directly on real grass; in the background, set back ten to fifteen meters, the actual full-size house — same building as the model, in its true real-world materials and colors (never the model's material), with mature trees and foundation plantings, deeply out of focus.

Strong depth of field: plinth and model razor sharp; everything beyond melts into heavy painterly blur.

NEVER add wood tables, desks, shelves, mantels, counters, room walls, ceilings, indoor lighting, hanging bulbs, or interior furniture. Natural ground only beneath and around the plinth. If Pass 1 placed the diorama on natural terrain, preserve that ground exactly.`,

  desk: `ENVIRONMENT (DESK):
The diorama sits on a polished dark walnut desk in a warm study — book-matched grain, satin finish, the desk surface extending well beyond the plinth in every direction. A hardcover book lies open to the left, reading glasses to the right, a small ceramic mug nearby. The room beyond — bookshelves, framed paintings, the edge of a chair — is in soft warm bokeh. The diorama is a small precious object on a large desk; the camera pulls back to show the whole scene. No visible light fixtures in frame.

Preserve Pass 1's room-mood and atmospheric color exactly — refine the desk grain, book texture, room bokeh depth, and warm directional light without changing the room's character.`,

  room_in_house: `ENVIRONMENT (ROOM IN THIS HOUSE):
The diorama sits on a side table or pedestal inside an interior room of the very building it depicts — the room's character matches the building's architectural style and the mood Pass 1 established (period parlor, vintage study, restored hall, or — for events — the disaster-matched room: burning, blown open, abandoned, alien research facility, haunted Victorian study). Period furniture, wallpaper or paneling, framed art, architectural details glimpsed beyond — softly out of focus around the plinth. The plinth and model are razor sharp; the room recedes into atmospheric blur.

PRESERVE Pass 1's room identity exactly — for event presets the room IS the scene, sharing the disaster with the model. Refine room textures, bokeh depth, and atmospheric haze without altering the room's role in the composition. No visible light fixtures in frame.`,
}

// ──────────────────────────────────────────────────────────────
// PROMPT ASSEMBLER
// ──────────────────────────────────────────────────────────────

function buildPass2Prompt(opts: {
  resolvedEnvironment: EnvironmentId
  presetId:            PresetId
  timeOfDay:           TimeOfDay
}): string {
  // For the Summer/Fall/Spring/Winter pilot, no per-preset variation
  // needed — the universal blocks cover the seasons cleanly. Per-preset
  // hooks (snow_globe containment swap, event-specific room reinforcement)
  // will land in their respective rollout passes.
  void opts.presetId   // reserved for per-preset branching
  void opts.timeOfDay  // reserved for tod-specific tuning

  const blocks: string[] = [
    PASS2_CORE,
    PASS2_REALISM,
    PASS2_LIGHTING,
    PASS2_CONTAINMENT,
    PASS2_ENV_BLOCKS[opts.resolvedEnvironment],
  ]

  return blocks.join('\n\n')
}

// ──────────────────────────────────────────────────────────────
// ASPECT → GPT-IMAGE-1 SIZE
// ──────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────
// INPUT / OUTPUT
// ──────────────────────────────────────────────────────────────
export interface RefineInput {
  imageB64:            string
  aspectRatio?:        AspectRatio
  resolvedEnvironment: EnvironmentId
  presetId:            PresetId
  timeOfDay:           TimeOfDay
  openaiApiKey:        string
}

export interface RefineOutput {
  imageB64:    string
  promptUsed:  string
  size:        GptImageSize
  durationMs:  number
}

// ──────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ──────────────────────────────────────────────────────────────
export async function refineHouse(input: RefineInput): Promise<RefineOutput> {
  const t0     = Date.now()
  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  const size   = aspectToGptSize(input.aspectRatio)
  const prompt = buildPass2Prompt({
    resolvedEnvironment: input.resolvedEnvironment,
    presetId:            input.presetId,
    timeOfDay:           input.timeOfDay,
  })

  const buf  = Buffer.from(input.imageB64, 'base64')
  const file = await toFile(buf, 'pass1.png', { type: 'image/png' })

  console.log(
    `[houses/refine] Pass 2 dispatching: aspect=${input.aspectRatio || 'auto'} ` +
    `size=${size} input_bytes=${buf.length} env=${input.resolvedEnvironment} ` +
    `preset=${input.presetId} tod=${input.timeOfDay} prompt_chars=${prompt.length}`,
  )

  const res = await openai.images.edit({
    model:  'gpt-image-1',
    image:  file,
    prompt,
    size:   size === 'auto' ? undefined : size,
  })

  const b64 = res.data?.[0]?.b64_json
  if (!b64) {
    throw new Error('gpt-image-1 returned no image data')
  }

  const durationMs = Date.now() - t0

  console.log(
    `[houses/refine] Pass 2 done in ${durationMs}ms · output_chars=${b64.length}`,
  )

  return {
    imageB64:   b64,
    promptUsed: prompt,
    size,
    durationMs,
  }
}
