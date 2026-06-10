// lib/v1/portraits/portraits-prompt.ts
//
// Minimal prompt builder for the Portraits silo. Mirrors groups-prompt.ts.
//
// NB2 understands "portrait photo rendered as 3D bronze sculpture" natively —
// it produces a clean, recognizable single-subject bust without any of the
// 700+ lines of prompt machinery the silo used to ship with. The whole
// assembled prompt sits at 11–17 words. NB2 figures out:
//   - which person in the source is the hero subject (when multiple faces visible)
//   - bust framing (head + shoulders)
//   - plinth shape and material
//   - surrounding setting / lighting / props from the location phrase
//
// Two intentional design differences from groups-prompt:
//   1. Lead-in is "Portrait of a person rendered as 3D ..." instead of
//      "Group photo rendered as 3D ...". This biases NB2 toward a single-
//      subject bust rather than a multi-figure ensemble.
//   2. Location phrases are otherwise identical — Portraits inherits the
//      same staging vocabulary as Groups for now. As the silo's location set
//      evolves (writing desk, library shelf, display niche per the carryover
//      doc), this map is where they'll plug in.

import type { PortraitsPresetId, LocationId, Scale } from './portraits-shared'
import { DEFAULT_PLAQUE_TEXT } from './portraits-shared'

const MATERIAL_PHRASE: Record<PortraitsPresetId, string> = {
  bronze:
    'polished bronze sculpture — face and hair rendered in classic patinated bronze, with clothing optionally in muted patinated bronze, ceramic, enamel, or textile-like sculpted surface used subtly and tastefully, dignified not costume-like',
  alabaster:
    'carved translucent alabaster sculpture with warm subsurface scattering, milky stone depth, soft glowing edges, faint amber veining, polished and semi-translucent high points, and deeper cloudy opacity in thicker areas. The ENTIRE bust including hair and garment is rendered in this same translucent alabaster; do not retain the source subject\'s hair color or clothing color — hair, collar, sweater, and torso are also alabaster stone with the same translucent character as the face',
  iron:
    'hand-forged iron sculpture in deep charcoal-black metal with a soft gunmetal sheen — visible hammer-work texture across every surface, burnished highlights on raised features (brow, cheekbones, nose bridge, hair ridges), and darker oxide patina settling into recesses and undercuts. The ENTIRE bust including hair and garment is rendered in this same forged iron; do not retain the source subject\'s hair color or clothing color — hair, collar, sweater, and torso are forged iron with the same hammered character as the face. Do not crop to head. Do not create a helmet, mask, or faceplate-only sculpture. No paint, no flesh tones, and no orange rust anywhere on the bust; the palette is charcoal, graphite, and warm gunmetal only',
  plushy:        'soft plushy figure',
  stone:
    'polished Taj Mahal quartzite sculpture with characteristic creamy-beige base tones, warm gold and amber veining, smoky brown ribbons, and occasional charcoal-gray mineral threads — the stone pattern flows organically across face, hair, clothing, shoulders, and arms. The ENTIRE bust including hair and garment is rendered in this same quartzite stone; do not retain the source subject\'s hair color or clothing color — hair, collar, sweater, and torso are also Taj Mahal quartzite. Avoid pink, peach, rose, salmon, or flesh-toned veining anywhere on the bust; the mineral palette is cream, gold, brown, and charcoal only',
  ebony:         'carved ebony wood sculpture in deep black-brown, visible wood grain with subtle natural color variation, burls and whorls placed in the base and shoulders, fine smooth grain on the face',
  walnut:
    'carved walnut wood sculpture with rich grain variation visible across the entire bust — pronounced flowing wood grain patterns, natural color shifts ranging from warm honey-amber through chestnut to deep chocolate-walnut, occasional figured-grain knots, burls, and ribbon-grain character in the shoulders and torso. Finished in soft satin lacquer that catches studio lighting in subtle specular highlights — semi-gloss only, not varnish, not high-gloss wet-shine. The grain reads as living, characterful hardwood with depth and warmth — not flat or uniformly stained',
  // Artists Gallery — these materials use full custom prompts (see
  // ARTISTS_BLOCKS below). The standard MATERIAL_PHRASE entry is
  // a placeholder kept only to satisfy the Record<PortraitsPresetId, …>
  // type — buildPortraitsPrompt routes these to buildArtistsPrompt before
  // MATERIAL_PHRASE is ever read.
  impressionist:  '__custom_artists_prompt__',
  torn_paper:     '__custom_artists_prompt__',
  folded_book:    '__custom_artists_prompt__',
  charcoal_chalk: '__custom_artists_prompt__',
  pencil_sketch:  '__custom_artists_prompt__',
  sheet_music:    '__custom_artists_prompt__',
}

// Location phrases lifted from groups-prompt.ts. Same staging register,
// same proven NB2 cues. Diverge here when Portraits-specific locations
// (writing desk, library shelf, display niche) come in.
const LOCATION_PHRASE: Record<LocationId, string> = {
  mantel:       'as the focal subject on an elegant marble mantel in an upscale sun-lit great room with skylights and ornate window trim, the room softly blurred behind the sculpture',
  tea_house:    'on a small Japanese-style display base inside a traditional tea house, scaled like a tabletop model, cherry blossom trees visible through shoji screen doors',
  pedestal:     'on a round marble pedestal in a museum gallery, illuminated by a volumetric beam of natural light streaming from a skylight above',
  gradient:     'against a seamless studio gradient backdrop that falls softly from light into deep shadow, gentle atmospheric haze separating the sculpture cleanly from the surround',
  plushy_shelf: "on a child's plush-toy shelf",
  wall_mount:   'mounted on a gallery wall',
}

// ─── ADVANCED LIGHTING TAIL ──────────────────────────────────────
// Lifted verbatim from groups-prompt.ts — same advanced lighting bundle on
// the frontend, same backend behaviour.
interface AdvancedLighting {
  beam?:       'off' | 'on'
  threePoint?: 'off' | 'on'
  brightness?: '0' | '5' | '10' | '15'
  enhanced?:   'off' | 'on'
}

function buildAdvancedTail(adv?: AdvancedLighting): string {
  if (!adv) return ''
  const parts: string[] = []
  if (adv.beam       === 'on') parts.push('with a volumetric beam of light from above')
  if (adv.threePoint === 'on') parts.push('three-point studio lighting')
  if (adv.brightness && adv.brightness !== '0') {
    parts.push(`brightness boosted by ${adv.brightness}%`)
  }
  if (adv.enhanced   === 'on') parts.push('enhanced contrast and microcontrast')
  if (parts.length === 0) return ''
  return `, ${parts.join(', ')}`
}

/**
 * Build the prompt sent to NB2 for a Portraits render.
 *
 * Scale handling (back-compat with Groups, code values are inverted from
 * UI labels — intentional, do not "fix"):
 *   - `'fill'`     (UI "Close Up") — append ", tight composition"
 *   - `'close_up'` (UI "Margins")  — append a wide-framing directive that
 *      asks NB2 to leave ~15% margin on each side of the bust. Per prior
 *      testing, NB2 responds well to concrete numeric framing directives
 *      ('central 70% of frame width') vs abstract ones ('breathing room').
 *      A baseline soft-lighting cue is also included here — without it,
 *      NB2's default lighting varies wildly across renders. The Advanced
 *      Lighting bundle (three-point, beam, brightness) still layers on top.
 *
 * Plaque handling: undefined/empty → DEFAULT_PLAQUE_TEXT, string verbatim,
 * null → "clean unmarked base".
 */
// ── ARTISTS GALLERY PROMPTS ────────────────────────────────────
// These materials produce fundamentally different artworks than the
// standard sculpture register. Each gets a full custom prompt that
// bakes in its own composition, location, lighting, and DoF. They
// bypass MATERIAL_PHRASE / LOCATION_PHRASE / composition / advanced
// tail entirely. NB2 still receives the source image as identity
// conditioning.

const ARTISTS_PRESETS = [
  'impressionist', 'torn_paper', 'folded_book', 'charcoal_chalk',
  'pencil_sketch', 'sheet_music',
] as const
type ArtistsPresetId = (typeof ARTISTS_PRESETS)[number]

function isArtistsPreset(p: PortraitsPresetId): p is ArtistsPresetId {
  return (ARTISTS_PRESETS as readonly string[]).includes(p)
}


// ═══════════════════════════════════════════════════════════════════════
// ARTISTS GALLERY — STRUCTURED PROMPT ARCHITECTURE
// ═══════════════════════════════════════════════════════════════════════
//
// Final prompt is composed of universal blocks (shared across all artists
// presets) + per-preset blocks (transformation language + avoid list +
// gallery tail). Subject wardrobe block (from the Curator) slots in
// between universal and per-preset.
//
// Composition order (joined with double newlines for paragraph separation):
//   1. ARTISTS_BUST_EXTENT     — universal — defines bust extent + cut-line
//   2. ARTISTS_EVEN_DISTRIBUTION — universal — 60/40 effect distribution rule
//   3. Subject wardrobe         — Curator-provided (omitted if no concept)
//   4. Transformation           — per-preset
//   5. ARTISTS_IDENTITY         — universal — facial identity preservation
//   6. Avoid list               — per-preset
//   7. Gallery tail + plaque    — per-preset (tail) + universal (plaque)
//
// History: face-dominant renders kept compressing the artistic effect onto
// the face plane, breaking likeness. Fix: explicitly demand substantial
// torso surface area AND a 60/40 effect distribution rule that forces NB2
// to allocate transformation craftsmanship across hair/shoulders/chest/
// garment/arms — not just the face.

// ── Universal bust block (shared by Realistic AND Artists builders) ──
//
// Rich's "anatomy first, material second" principle (2026-06): NB2 keeps
// choosing "cool head sculpture" instead of "complete bust" when the
// material register is established before the bust silhouette is locked.
// This block runs FIRST in every prompt — Realistic and Artists alike —
// to lock bust anatomy, posture, crop, and identity BEFORE the material
// transformation is applied. The 60% / 40% distribution rule keeps the
// artistic material from compressing onto the face plane.
const BUST_UNIVERSAL =
  `Create a substantial portrait bust, not a floating head. The sculpture must include the full head, hair, neck, both shoulders, upper chest, visible garment structure, and both upper arms ending at mid-bicep. The bust must fill the composition from head to mid-bicep. The shoulders, chest, clothing, and arms must occupy at least as much visual importance as the face — ideally hair, shoulders, chest, clothing, and arms carry 60% or more of the visual transformation, and the face carries no more than 40%. Pose has character: slight forward lean, relaxed shoulders, natural asymmetry, believable human posture. Lock the bust anatomy, posture, and crop first; then apply likeness and material treatment. Preserve facial identity, eye spacing, nose, mouth, jawline, age, and expression.`

// ── Per-preset blocks: transformation + avoid + tail ──
interface ArtistsBlocks {
  transformation: string
  avoid:          string
  tail:           string
  // When true, the BUST_UNIVERSAL block is skipped for this preset.
  // Used for presets whose composition fundamentally conflicts with
  // the universal "front-facing bust, both arms at mid-bicep" framing
  // — e.g. Pencil Sketch, where the asymmetric 3D-emerging-from-2D
  // composition IS the artistic identity of the style.
  skipUniversal?: boolean
}

const ARTISTS_BLOCKS: Record<ArtistsPresetId, ArtistsBlocks> = {
  // Folded Book — Rich's "limited / use with upper-body reference only"
  // refinement: face must remain restrained; paper motion belongs in
  // periphery (hair, garment, shoulders, background curls), not across
  // the face plane where it destabilizes likeness.
  //
  // 2026-06 follow-up (post wild-curls failure): hair MUST follow the
  // source subject's actual hairstyle. Paper ribbons interpret hair —
  // they do not invent generic wild curls, paper spirals, or fantasy
  // hairstyles. Likeness in the hair is as important as likeness in
  // the face; if flowing-paper aesthetics conflict with the source's
  // real hair, the source wins.
  folded_book: {
    transformation:
      `Transform the entire bust — face included — into a fine-art sculpture assembled from folded and layered book pages, emerging from an open book. Every surface is paper: the face, hair, neck, shoulders, chest, garment, and arms are all built from curled paper ribbons, folded pages, and layered printed sheets. The paper layers across the face follow the person's real facial structure — overlapping pages shape the planes of the forehead, brow, nose, cheeks, and lips so the likeness stays clearly recognizable, while the surface reads unmistakably as layered paper rather than skin. Hair is formed from paper ribbons that follow the source subject's actual hairstyle exactly — same length, direction, volume, and character; the paper interprets the real hair and never invents wild curls, paper spirals, or fantasy hair shapes. Broad sweeping ribbons define the major forms; individual printed pages stay visible throughout. The construction continues uninterrupted across the whole bust. The sculpture feels assembled from pages rather than carved into pages.`,
    avoid:
      `Avoid a photo-realistic or smooth lifelike face — the face is built from layered paper like the rest of the bust, not left as skin. Avoid carved relief, engraved surfaces, stacked page-edge carving, paper-cut or woodcut techniques, and topographic page slicing. Avoid chaotic paper strips that destroy the likeness, and avoid generic wild paper curls or spirals replacing the real hairstyle — the paper must follow the person's true facial structure and real hair so they remain recognizable.`,
    tail:
      `Contemporary gallery presentation. Museum-quality craftsmanship. Extraordinary dimensionality. Flowing organic forms. Visible printed text. Elegant paper architecture. Emotionally expressive. Fine-art collectible sculpture.`,
  },

  // Impressionist — Rich's note: working. Just enforce impasto across
  // clothing and shoulders, not just face.
  impressionist: {
    transformation:
      `Transform the entire bust into an impressionist paint sculpture rendered in thick impasto strokes carrying real visible texture and dimensional thickness. The complete sculpture—including head, hair, shoulders, chest, garment fabric, and arms—is built from layered impasto paint applied with sculptural mass. Maintain strong impasto across clothing and shoulders, not just face. Each brushstroke has physical depth. Thick visible paint covers the head, hair, neck, shoulders, garment, chest, and arms equally. The paint also runs down onto a round plinth the sculpture sits on. Use tones natural to this person's complexion and clothing throughout.`,
    avoid:
      `Avoid smooth painted surfaces, flat color application, photo-realistic finishing, 2D painted treatment, or thin paint layers. The paint must carry physical mass and dimensional depth.`,
    tail:
      `Sculpture on a base in a contemporary museum, center focused. Skylights cast luminous volumetric light down and around the sculpture. Strong depth of field blurring the background. Museum-quality craftsmanship. Fine-art collectible sculpture.`,
  },

  torn_paper: {
    transformation:
      `Transform the entire bust into a sculpture constructed from thousands of torn and layered paper contours. The complete sculpture—including head, hair, shoulders, chest, garment fabric, and arms—emerges from stacked topographic layers similar to a terrain map. Every contour follows the underlying form, creating depth through elevation rather than shading. Different paper tones create highlights and shadows naturally through layering. Paper edges remain visible and handcrafted, revealing fiber texture and subtle imperfections. Hair, shoulders, garment folds, chest contours, and arm structure are all built from the same torn paper contours with equal layering density.`,
    avoid:
      `Avoid smooth painted finishes, carved relief, engraved surfaces, 2D paper-cut techniques, or paper that lays flat without elevation. The construction must read as topographic layers with depth.`,
    tail:
      `Contemporary gallery presentation. Museum-quality craftsmanship. Soft directional lighting emphasizing depth and edge detail. Fine-art paper sculpture. Architectural precision. Highly detailed, tactile, and dimensional. Professional studio photography.`,
  },

  // Charcoal & Chalk — Rich's note: working. Just enforce material density
  // extension through sweater, shoulders, arms, and base fragments.
  charcoal_chalk: {
    transformation:
      `Transform the entire bust into a fine-art sculpture constructed from compressed charcoal, broken charcoal sticks, charcoal dust, and white Conté chalk. The complete sculpture—including head, hair, shoulders, chest, garment fabric, and arms—is physically built from charcoal materials with sculptural mass; the sculpture is not drawn. Material density must extend through sweater, shoulders, arms, and base fragments — equal carving complexity across every part of the bust. All planes—face, hair, shoulders, clothing folds, chest, and arms—are carved from dense charcoal masses with visible chisel marks, fractured edges, and layered charcoal fragments. White Conté chalk forms raised highlights and structural details across the entire bust, creating dimensional contrast against deep black charcoal surfaces. Floating charcoal dust, chalk powder, and broken fragments drift in the surrounding air as if the sculpture is still emerging from the material. Hair forms from sweeping charcoal ribbons, fractured charcoal splines, and layered charcoal shards.`,
    avoid:
      `Avoid drawn charcoal portraits, 2D charcoal renderings, smooth surfaces, blended shading, or paper-as-substrate aesthetics. The charcoal must carry true sculptural depth and physical mass everywhere on the bust.`,
    tail:
      `Contemporary museum gallery lighting reveals the texture of compressed charcoal, chalk buildup, carved surfaces, and airborne particles. Fine-art contemporary sculpture. Dramatic craftsmanship. Highly dimensional, tactile, expressive.`,
  },

  // Pencil Sketch — Rich's locked composition (2026-06): side-angle
  // camera, asymmetric emergence. The head, far hand, far arm, and far
  // shoulder are fully three-dimensional graphite sculpture; the near
  // arm, shoulder, and torso remain hand-drawn pencil sketch on the
  // page. This composition is INTENTIONAL and defines the style.
  //
  // 2026-06 follow-up (kinetic refinement): closer camera + dramatic
  // foreshortening on the reaching hand/arm to give the figure a sense
  // of active forward motion. The reach now thrusts toward the viewer
  // with the hand appearing larger than the head behind it. The face
  // expression stays calm/serene from the source — only the COMPOSITION
  // gets kinetic, not the face.
  //
  // skipUniversal: true — the BUST_UNIVERSAL block describes a
  // front-facing symmetric bust. That conflicts with the asymmetric
  // emergence here. Per Rich's instruction: delete the conflicting
  // constraints for THIS piece only. The pencil_sketch transformation
  // block includes its own likeness preservation language.
  pencil_sketch: {
    skipUniversal: true,
    transformation:
      `Close-up side-angle three-quarter camera composition showing a portrait actively emerging from a vertical sheet of drawing paper. The figure fills the frame. DRAMATIC FORESHORTENING: the reaching hand and arm thrust forward toward the viewer, appearing larger in the frame than the head behind them — conveying kinetic energy and the intent of active emergence. The page is visible behind and beside the figure, its edges and corners showing. The composition is INTENTIONALLY ASYMMETRIC — split into two states:

ONE SIDE — fully three-dimensional graphite sculpture thrusting forward: the subject's head, far hand, far arm, and far shoulder are physical graphite sculpture with real sculptural mass, dimensional depth, and palpable forward motion. The reaching hand and arm are foreshortened toward the viewer, larger in the frame than they would appear in flat side-view, conveying urgency and the moment of becoming. This side has fully escaped the page with kinetic energy.

OTHER SIDE — still hand-drawn pencil sketch on the flat page: the near arm, near shoulder, and torso (including garment on that side) remain as pencil drawing — visible construction lines, expressive crosshatching, unfinished contours, eraser marks. Two-dimensional drawing only. No sculptural depth on this side.

THE TRANSITION — graphite peeling from the page: between the drawn side and the sculpted side, pencil lines lift off the paper and become physical graphite ribbons. Broken pencil fragments, eraser dust, and stray sketch marks suspend in the air. Graphite dust drifts. The exact moment imagination becomes reality.

The face must preserve identity with high accuracy — eye spacing, nose, mouth, jawline, age, and expression all read as the source subject. The expression stays calm and as-source; the kinetic energy lives in the composition and the foreshortened reach, NOT in the face. Hair follows the source's actual hairstyle. The asymmetric pose (one side dimensional, one side flat) defines this style; both arms, both shoulders, and the torso are present in the composition but in different material states.

Museum-quality gallery lighting catches the dimensional side and casts subtle shadows from sketched details on the flat side.`,
    avoid:
      `Avoid fully-formed photorealistic surfaces with no sketch element visible. Avoid pure 2D pencil drawings on flat paper with no dimensional emergence. Avoid symmetric front-facing busts where both arms are equally three-dimensional. Avoid distant framing where the foreshortening reads as flat — the reaching hand must appear noticeably larger than the head. The asymmetric emergence — one side sculpture, one side drawing on the visible page — is REQUIRED for this style. The page must be visible behind the figure with its edges showing.`,
    tail:
      `Museum-quality lighting. Extraordinary dimensionality. Fine-art installation. Impossible transformation. Emotional impact. Highly detailed graphite textures. Visible construction process. Masterpiece-level craftsmanship.`,
  },

  sheet_music: {
    transformation:
      `Transform the entire bust into a museum-quality sculpture constructed from sheet music, musical notation, manuscript pages, and flowing musical scores. The complete sculpture—including head, hair, shoulders, chest, garment fabric, and arms—emerges from thousands of folded, curled, layered, and suspended pages. No conventional human surfaces remain anywhere on the form. Musical staffs sweep across the face, neck, shoulders, chest, garment, and arms like topographic contours. Notes, rests, clefs, and dynamic markings become structural elements that define the nose, lips, cheeks, hair, collar, shoulder line, and arm contours. Hair is formed from cascading ribbons of sheet music twisting through space like melodies frozen in motion. Portions of the sculpture appear to unravel into floating pages and drifting notes, creating a sense of music escaping the form.`,
    avoid:
      `Avoid flat printed surfaces, 2D sheet music collage, or pages without dimensional architecture. The construction must read as sculptural music with physical mass.`,
    tail:
      `Museum gallery lighting reveals paper texture, page edges, layered depth, and extraordinary craftsmanship. Fine-art paper sculpture. Highly dimensional, emotional, elegant.`,
  },
}

function buildArtistsPrompt(input: {
  presetId:          ArtistsPresetId
  plaqueText?:       string | null
  upperBodyConcept?: string | null
}): string {
  const blocks = ARTISTS_BLOCKS[input.presetId]
  const parts: string[] = []

  // 1. Universal bust block — anatomy + pose + 60/40 + identity preservation.
  //    Runs FIRST: lock the bust before the material register is applied.
  //    EXCEPTION: presets that opt out via skipUniversal handle their own
  //    composition entirely within the transformation block (e.g. Pencil
  //    Sketch's side-angle asymmetric emergence).
  if (!blocks.skipUniversal) {
    parts.push(BUST_UNIVERSAL)
  }

  // 2. Subject wardrobe (Curator-provided — omitted entirely when no concept).
  //    Legacy flow input; the new Curator workflow no longer populates this.
  if (input.upperBodyConcept && input.upperBodyConcept.trim()) {
    parts.push(`Subject wardrobe: ${input.upperBodyConcept.trim()}`)
  }

  // 3. Material transformation (per-preset) — runs AFTER bust anatomy.
  parts.push(blocks.transformation)

  // 4. Avoid list (per-preset).
  parts.push(blocks.avoid)

  // 5. Gallery tail (per-preset) + plaque.
  let finalBlock = blocks.tail
  if (input.plaqueText !== null) {
    const text = (input.plaqueText && input.plaqueText.trim()) || DEFAULT_PLAQUE_TEXT
    finalBlock += ` Small plaque on base reads: "${text}".`
  }
  parts.push(finalBlock)

  return parts.join('\n\n')
}


export function buildPortraitsPrompt(input: {
  presetId:          PortraitsPresetId
  locationId:        LocationId
  scale:             Scale
  plaqueText?:       string | null
  advanced?:         AdvancedLighting
  upperBodyConcept?: string | null
}): string {

  // Route Artists Gallery presets to their custom prompt builder.
  // location/scale/advanced are intentionally ignored — the artist
  // prompt is fully self-contained.
  if (isArtistsPreset(input.presetId)) {
    return buildArtistsPrompt({
      presetId:         input.presetId,
      plaqueText:       input.plaqueText,
      upperBodyConcept: input.upperBodyConcept,
    })
  }

  const material    = MATERIAL_PHRASE[input.presetId]
  const location    = LOCATION_PHRASE[input.locationId]
  const composition = input.scale === 'fill' ? ', tight composition' : ''
  const lighting    = ', lit by soft directional studio lighting that brings out facial detail'
  const tail        = buildAdvancedTail(input.advanced)

  // Upper-body concept — woven inline before the lighting cue when set.
  let bodyClause = ''
  if (input.upperBodyConcept && input.upperBodyConcept.trim()) {
    bodyClause = `, with the subject's upper body rendered as: ${input.upperBodyConcept.trim()}`
  }

  // Margins are handled by the local canvas-pad post-process (see
  // portraits-expand.ts), not by prompt language. NB2 ignored the
  // prompt directive across multiple wording attempts — its prior to
  // fill the frame is too strong. The expand step adds real canvas
  // padding around the rendered bust.

  let plaqueClause: string
  if (input.plaqueText === null) {
    plaqueClause = ', with a clean unmarked base'
  } else {
    const text = (input.plaqueText && input.plaqueText.trim()) || DEFAULT_PLAQUE_TEXT
    plaqueClause = `, with a small plaque on the base reading "${text}"`
  }

  // Realistic prompt now ALSO leads with the universal bust block.
  // Bronze and Alabaster were rendering as head-only because the prior
  // single-sentence prompt didn't lock bust anatomy first. Same fix
  // applied to both series: anatomy first, material second.
  const realisticSentence =
    `Portrait of a person rendered as 3D ${material}, ${location}${composition}${bodyClause}${lighting}${tail}${plaqueClause}. ` +
    `Likeness must be exact — the subject's face, expression, head angle and tilt, and gaze direction must match the source photograph precisely.`

  return `${BUST_UNIVERSAL}\n\n${realisticSentence}`
}
