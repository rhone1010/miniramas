// lib/v1/actionmini-blocks.ts
// Refinement and composition blocks for Action Minis.
//
// V6 changes vs V5 (this file):
//   • LOCATION owns scene lighting. Per-location recipes:
//       pedestal → god-ray beam + local lift
//       desk / shelf / workshop → strong 3-point
//       in_situ → daylight + directional beam + lifted key
//     Every location lighting recipe leads with explicit hero/context
//     exposure ratios and anti-averaging language so gpt-image-1 can't
//     smooth contrast back to balanced exposure.
//   • DRAMATIC_LIGHTING_RECIPES → MATERIAL_LIGHT_INTERACTION_RECIPES.
//     Per-preset block now describes ONLY how the material catches light
//     at the micro level (subsurface scatter, edge specular, grain catch).
//     ~80 chars per preset. Zero scene/atmospheric content. LOCATION
//     owns scene lighting; this owns surface optics. One concern per block.
//   • INTEGRATED_BASE rule replaced by COMPLEMENTARY_BASE.
//     Per-preset base material (default: patina'd bronze; bronze for the
//     bronze-named presets; carved_wood keeps log-as-base). Per-location
//     base shape (round for pedestal/desk/workshop/in_situ; rectangular
//     for shelf). Sized "as if the staging was designed for the figure."
//     Drops the action-surface-integration logic — figure gets a real
//     base in every location.
//   • SCENE_DETAIL_BLOCK removed (redundant — LOCATION owns surroundings).
//   • SCALE close_up adds frame-priority directive — Subject scale wins
//     over location architecture completeness.
//   • window_sill and trophy_shelf preset entries removed throughout.
//     LOCATION_OVERRIDES_PRESETS removed (no preset forces a location).
//
// Block order in final prompt:
//   1.  preset.presetLine            (in actionmini-presets.ts)
//   2.  COLLECTIBLE_ANCHOR           always
//   3.  CAMERA                       always
//   4.  FIGURE_FIDELITY              always
//   5.  MATERIAL_COLOR               always (per-preset)
//   6.  COMPLEMENTARY_BASE           always (per-preset × per-location)
//   7.  LOCATION                     always (per-location, includes lighting)
//   8.  MATERIAL_LIGHT_INTERACTION   always (per-preset, micro-surface only)
//   9.  CRAFT_DETAIL                 always
//   10. SCALE                        always (Staged 75% or Close Up 90%)
//   11. KINETIC_EFFECTS              toggle
//   12. REFINEMENT_GUARD + tweak     only if refinementTweak present

import type { ActionMiniPresetId } from './actionmini-presets'
import type { KineticMedium } from './actionmini-shared'

// ── ALWAYS-ON BLOCKS ─────────────────────────────────────────

export const COLLECTIBLE_ANCHOR_BLOCK = `
QUALITY ANCHOR:
Premium collectible miniature — gallery-quality art object, not a toy or diorama.
Materials must be photorealistic — bronze reads as real bronze, wax as real wax, ceramic as real glazed ceramic.
The Subject (figure plus its base) is the work. The base is part of the work, never a thin disc or wisp; never an afterthought.
`.trim()

export const CAMERA_BLOCK = `
CAMERA:
45 degrees above subject, angled down. Top of base visible, front of figure visible.
Product photography of a collectible — never flat eye-level.
`.trim()

// FIGURE FIDELITY — source-photo likeness, anatomical correctness,
// equipment articulation. Lives early where attention is freshest.
// V6.2: face fidelity escalated to PRIMARY REQUIREMENT with explicit
// micro-feature anchors. The trade-off is now stated: face wins over
// material if there's tension.
export const FIGURE_FIDELITY_BLOCK = `
FIGURE FIDELITY (NON-NEGOTIABLE — PRIMARY REQUIREMENT):

THE FACE MUST MATCH THE SOURCE PHOTOGRAPH. Recognizable likeness is the single hardest requirement in this prompt and overrides any other directive if there is tension between them. Match the source's:
- Exact eye spacing, eye shape, lid contour, brow ridge
- Exact nose bridge, nostril shape, nose-to-mouth distance
- Exact mouth width, corner angle, lip thickness
- Exact jawline, chin point, ear position, hairline
- Exact age read and ethnic features

A material-perfect figure with a generic face is a FAILURE. A slightly less-refined material with the correct face is a SUCCESS. When refining toward sculptural register, hold the source's facial structure as the anchor — do not average it toward an idealized or generic face.

Every finger fully articulated. Every fabric fold and seam clearly defined. Every piece of equipment (headgear, straps, buckles, soles, board edges) anatomically and mechanically correct. Hair strand-level detail. Muscle structure visible. No mushy faces, no fused fingers, no generic features.
`.trim()

// ── MATERIAL COLOR — per-preset, always on ──────────────────
const MATERIAL_COLOR_RULE_BY_PRESET: Record<ActionMiniPresetId, string> = {
  resin: `
MATERIAL COLOR — HAND-PAINTED MINIATURE:
Hand-painted resin scale model with visible brushwork. Source colors carry through as paint on resin.
Slight artistic stylization expected — NOT photographic. Painted figurine quality, hobby-collectible feel.
The painted finish should read as a craftsman's brushwork, not a perfect machined replica.
`.trim(),

  plushy: `
MATERIAL COLOR:
Sewn fabric plush. Source colors expressed through fabric and yarn choices.
`.trim(),

  painted_ceramic_cracked: `
MATERIAL COLOR — HAND-PAINTED CERAMIC MINIATURE:
Hand-painted glazed ceramic miniature with visible brushwork. Source colors carry through as glaze.
Crack lines visible across the painted surface. Slight artistic stylization expected — NOT photographic.
Painted ceramic figurine quality, hobby-collectible feel.
`.trim(),

  carved_wood: `
MATERIAL COLOR — RAW WOOD ONLY:
Entire figure is RAW NATURAL WOOD — same wood as the log base. NO paint, NO source-photo colors carried over.
The figure is monochrome wood. Color variation comes only from grain and lighting.
`.trim(),

  wax_bronze: `
MATERIAL COLOR — WAX FIGURE, BRONZE BASE:
FIGURE: solid translucent wax, pale-amber throughout. NO painted jacket, NO skin tones, NO source colors.
BASE: solid bronze with verdigris. The piece is monochrome wax-on-bronze.
`.trim(),

  bronze_bronze: `
MATERIAL COLOR — ALL BRONZE:
Entire sculpture is solid cast bronze with verdigris in recesses, polish on high points.
NO painted colors. NO source-photo colors. Fully monochrome bronze.
`.trim(),

  terracotta_cracked: `
MATERIAL COLOR — ALL TERRACOTTA:
Entire sculpture is solid weathered terracotta — warm earth-orange-brown throughout.
NO painted colors. NO source-photo colors. Fully monochrome terracotta. Cracks reveal lighter inner clay.
`.trim(),

  iron: `
MATERIAL COLOR — ALL FORGED IRON:
Entire sculpture is hand-forged iron — deep charcoal-black with a soft gunmetal sheen throughout. Burnished highlights on raised edges; darker oxide patina in recesses.
NO painted colors. NO source-photo colors. No orange rust anywhere — the palette is charcoal, graphite, and warm gunmetal only.
`.trim(),

  alabaster: `
MATERIAL COLOR — ALL ALABASTER:
Entire sculpture is solid translucent alabaster, off-white to warm-cream throughout.
NO painted colors. NO source-photo colors. Internal glow varies with thickness.
`.trim(),
}

export function getMaterialColorBlock(presetId: ActionMiniPresetId): string {
  return MATERIAL_COLOR_RULE_BY_PRESET[presetId] || MATERIAL_COLOR_RULE_BY_PRESET.resin
}

// ── COMPLEMENTARY BASE — per (preset × location) ────────────
// Per-preset base material (what the base is made of):
//   carved_wood       → no separate base; the log IS the base
//   wax_bronze        → bronze (per preset name)
//   bronze_bronze     → bronze (per preset name)
//   all others        → patina'd bronze (default complementary material)
//
// Per-location base shape (how the base is shaped):
//   pedestal / desk / workshop / in_situ → ROUND
//   shelf                                 → RECTANGULAR
//
// The base is sculpted as part of the work — substantial footprint
// (figure width + ~30% margin), intentional craftsmanship, never a thin
// disc. The base material complements but does NOT match the figure
// material unless the preset's name explicitly pairs them.

const BASE_MATERIAL_BY_PRESET: Record<ActionMiniPresetId, string> = {
  resin:                   'patinated bronze with green-grey verdigris in recessed sculpting and warm bronze polish on raised edges',
  plushy:                  'patinated bronze with green-grey verdigris in recessed sculpting and warm bronze polish on raised edges',
  painted_ceramic_cracked: 'patinated bronze with green-grey verdigris in recessed sculpting and warm bronze polish on raised edges',
  terracotta_cracked:      'patinated bronze with green-grey verdigris in recessed sculpting and warm bronze polish on raised edges',
  iron:                    'patinated bronze with green-grey verdigris in recessed sculpting and warm bronze polish on raised edges',
  alabaster:               'patinated bronze with green-grey verdigris in recessed sculpting and warm bronze polish on raised edges',
  wax_bronze:              'solid bronze with verdigris in recessed sculpting and warm polish on raised edges (per preset)',
  bronze_bronze:           'solid bronze with verdigris in recessed sculpting and warm polish on raised edges (per preset)',
  carved_wood:             '__LOG_AS_BASE__',  // sentinel — handled separately below
}

export type LocationId =
  | 'in_situ'
  | 'desk'
  | 'shelf'
  | 'workshop'
  | 'pedestal'

const BASE_SHAPE_BY_LOCATION: Record<LocationId, 'round' | 'rectangular'> = {
  pedestal: 'round',
  desk:     'round',
  workshop: 'round',
  in_situ:  'round',
  shelf:    'rectangular',
}

// Per-location fit phrasing — what the base fits to.
const BASE_FIT_BY_LOCATION: Record<LocationId, string> = {
  pedestal: 'fitting the marble pedestal cap as if the pedestal was designed to hold this exact statue',
  desk:     'sized to sit naturally on the desk surface, intentional and proportionate',
  workshop: 'sized to sit intentionally on the workbench between scattered tools, looking placed for inspection',
  shelf:    'sized to fit the shelf depth precisely, designed to sit flat against the back of the shelf',
  in_situ:  'sized to feel intentional on the action surface, anchoring the figure in the scene',
}

export function getComplementaryBaseBlock(
  presetId:   ActionMiniPresetId,
  locationId: LocationId,
): string {
  // carved_wood: log IS the base — no separate plinth. Preserve the
  // preset's signature treatment.
  if (presetId === 'carved_wood') {
    return `
THE BASE — LOG IS THE BASE (carved_wood preset):
The carved wooden log itself IS the base — flat-cut on the bottom, raw bark on the sides, no separate plinth beneath. The log's footprint is substantial: figure width plus 30% margin on all sides. NEVER add a marble disc, bronze plinth, or any second base under the log. The log sits directly on the location surface (${BASE_FIT_BY_LOCATION[locationId]}).
`.trim()
  }

  const material = BASE_MATERIAL_BY_PRESET[presetId] || BASE_MATERIAL_BY_PRESET.resin
  const shape    = BASE_SHAPE_BY_LOCATION[locationId]
  const fit      = BASE_FIT_BY_LOCATION[locationId]

  const shapePhrasing = shape === 'rectangular'
    ? 'RECTANGULAR base in plan view (rectangle-with-rounded-corners or rectangle), with the long edge running parallel to the shelf front'
    : 'ROUND base in plan view (circular or oval), centered beneath the figure'

  return `
THE BASE — COMPLEMENTARY ${shape.toUpperCase()} BASE:
The Subject sits on a ${shapePhrasing}, made of ${material}. The base is sculpted as part of the work — substantial footprint of figure width plus 30% margin on all sides, intentional craftsmanship matching the hero figure, NEVER a thin disc or wisp. The base is ${fit}.
The base material is distinct from the figure material — the figure and base read as a designed pairing. Same patina/finish on the base regardless of how the hero figure was treated.
`.trim()
}

// ── DRAMATIC LIGHTING — global rules (always-on) ─────────────
// V6.2: prompt-engineered global directive. Pairs with the per-mode
// LIGHTING_MODE_BLOCKS below. Together they define the entire lighting
// system; LOCATION blocks own staging only. The renderer behaves like
// a cinematic lighting director, NOT an automatic exposure correction
// system.
//
// Language hand-tuned by the user — strong directive against gpt-image-1's
// averaging tendency. Anti-averaging vocabulary is what makes this hold.
export const DRAMATIC_LUMINANCE_BLOCK = `
DRAMATIC LIGHTING — GLOBAL RULES:
The renderer behaves like a cinematic lighting director, NOT an automatic exposure correction system.

PRIORITIZE:
- luminance hierarchy
- intentional darkness
- localized exposure concentration
- emotional contrast
- atmospheric depth
- hero-first readability

ALLOW:
- deep shadows
- partial environmental loss
- dramatic falloff
- localized overexposure near key light sources

AVOID:
- exposure averaging
- globally balanced midtones
- uniform brightness distribution
- HDR-style flattening
- equal scene readability

EXPOSURE TARGET:
The Subject (figure plus its complementary base) sits at approximately 1.6× the brightness of its surroundings — markedly brighter, the brightest point in the frame, never matched or overpowered by environmental light sources (sun, sky, ambient daylight, room lighting). Surroundings hold detail through pools of light and shadow but stay tiered visibly below the Subject's exposure.
`.trim()

// ── LIGHTING MODE — branches by presentation mode (always-on) ──
// V6.2: lighting is now a separate axis from location. Each location maps
// to one of three modes; the mode owns the lighting recipe. LOCATION
// owns staging only.
//
// Why three modes (not five): pedestal has a unique theatrical register;
// in_situ has a unique cinematic-real-world register; desk/shelf/workshop
// share the practical-motivated collectible register. Collapsing those
// three into one mode removes redundancy without losing fidelity.

export type LightingMode = 'gallery' | 'environment' | 'collectible'

const MODE_BY_LOCATION: Record<LocationId, LightingMode> = {
  pedestal: 'gallery',
  in_situ:  'environment',
  desk:     'collectible',
  shelf:    'collectible',
  workshop: 'collectible',
}

const LIGHTING_MODE_BLOCKS: Record<LightingMode, string> = {
  gallery: `
LIGHTING — GALLERY MODE (museum artifact presentation):
The sculpture is sacred, isolated, theatrical. Use concentrated top-light or directional architectural spotlighting with aggressive luminance separation. The sculpture is the brightest object in the frame; surrounding architecture falls into deep controlled shadow.

PRIORITIZE:
- strong volumetric beams
- localized glow around hero surfaces
- dramatic shadow mass
- sculptural edge highlights
- atmospheric diffusion around light shafts
- dark environmental falloff
- high contrast between illuminated sculpture and environment

AVOID:
- evenly readable environments
- globally lifted exposure
- flat ambient fill
- soft averaged museum lighting

REFERENCE MOOD: Cathedral spotlight, luxury gallery installation, mythic artifact reveal.
`.trim(),

  environment: `
LIGHTING — IN-ENVIRONMENT MODE (sculpture in cinematic real-world setting):
The sculpture exists naturally within a real cinematic environment. The environment motivates the light source, but exposure prioritizes the sculpture as the emotional focal point.

USE:
- directional sunlight
- moonlight
- firelight
- fog diffusion
- environmental bounce light
- localized highlight accumulation on sculpture surfaces

THE SCULPTURE RECEIVES:
- slightly elevated local exposure
- enhanced specular readability
- selective rim lighting
- stronger local contrast than surrounding elements

ENVIRONMENTAL BACKGROUNDS soften and recede through:
- haze
- atmospheric perspective
- luminance suppression
- reduced detail contrast

AVOID:
- globally balanced outdoor exposure
- documentary realism
- flat HDR-style lighting
- equal readability across frame

REFERENCE MOOD: Premium cinematic fantasy photography, authored environmental storytelling.
`.trim(),

  collectible: `
LIGHTING — COLLECTIBLE MODE (sculpture in believable human space):
Use practical motivated lighting with controlled cinematic enhancement. Primary light sources may include desk lamps, workshop lighting, window light, shelf accent lighting, or warm tungsten practicals.

THE SCULPTURE MAINTAINS:
- localized highlight priority
- richer exposure than surroundings
- selective glow concentration
- controlled specular accents
- material readability

BACKGROUNDS REMAIN:
- darker
- softer
- lower contrast
- environmentally supportive rather than attention-seeking

USE:
- subtle environmental falloff
- warm pools of light
- localized bounce lighting
- selective reflections
- cinematic vignette behavior

AVOID:
- evenly exposed rooms
- bright readable walls
- flat workshop lighting
- broad ambient illumination

REFERENCE MOOD: Premium collector photography, cinematic artisan studio, luxury display catalog.
`.trim(),
}

export function getLightingModeBlock(locationId: LocationId): string {
  const mode = MODE_BY_LOCATION[locationId] || 'collectible'
  return LIGHTING_MODE_BLOCKS[mode]
}

export function getLightingMode(locationId: LocationId): LightingMode {
  return MODE_BY_LOCATION[locationId] || 'collectible'
}

// ── KINETIC EFFECTS — medium-specific, toggleable ───────────
const KINETIC_EFFECTS_BY_MEDIUM: Record<KineticMedium, string> = {
  whitewater: `
KINETIC EFFECTS — WHITEWATER:
Translucent water spray and foam frozen mid-arc. Sculpted as integrated artwork in the figure's material. NO mud, NO dust.
`.trim(),
  surf: `
KINETIC EFFECTS — SURF:
Sea spray and foam frozen mid-arc, integrated in the figure's material. NO dust, NO dirt.
`.trim(),
  snow: `
KINETIC EFFECTS — SNOW:
Snow powder bursts around the figure — sculpted in the SAME MATERIAL as the figure (bronze figure → bronze spray, alabaster → alabaster spray). NEVER white snow on a bronze figure. NO water, NO dirt.
`.trim(),
  skate: `
KINETIC EFFECTS — SKATE:
Fine concrete dust at the trucks — low haze, sculpted in figure's material. NO water, NO mud.
`.trim(),
  bike: `
KINETIC EFFECTS — DIRT TRACK:
Dramatic roost of dry dirt and small stones from the rear tire — angular, granular, sculpted in figure's material. NO mud, NO water, NO smoke.
`.trim(),
  climb: `
KINETIC EFFECTS — CLIMB:
Small puff of chalk dust at contact points, sculpted in figure's material. NO water, NO debris.
`.trim(),
  run: `
KINETIC EFFECTS — RUN:
Dust at foot strike, low haze, sculpted in figure's material. NO water.
`.trim(),
  dance: `
KINETIC EFFECTS — DANCE:
Fabric and hair mid-flight in arcs, sculpted in figure's material. Optional fine stage dust. NO water.
`.trim(),
  combat: `
KINETIC EFFECTS — MAT/COMBAT:
Burst of mat dust or chalk around impact point, sculpted in figure's material. NO water, NO mud.
`.trim(),
  other: `
KINETIC EFFECTS:
Motion evidence around the figure, sculpted in the figure's own material. ONE medium only — never mix dust and water.
`.trim(),
}

export function getKineticEffectsBlock(kineticMedium: KineticMedium): string {
  return KINETIC_EFFECTS_BY_MEDIUM[kineticMedium] || KINETIC_EFFECTS_BY_MEDIUM.other
}

// ── LOCATION — global staging, user picks one of FIVE ───────
// Each block self-contains: setting description + lighting recipe with
// explicit hero/context exposure ratios + anti-injection list. LOCATION
// owns scene lighting in V6 — material micro-surface is its own short
// block (MATERIAL_LIGHT_INTERACTION).

export const LOCATION_LABELS: Record<LocationId, string> = {
  in_situ:   'In Environment',
  desk:      'Desk',
  shelf:     'Shelf',
  workshop:  'Workshop',
  pedestal:  'Pedestal',
}

const LOCATION_BLOCKS: Record<LocationId, string> = {
  pedestal: `
LOCATION — PEDESTAL (museum rotunda):
The Subject sits on a marble pedestal cap in a rotunda of expensive polished marble — the rotunda's domed ceiling rises high above, weighty marble columns ring the perimeter, checkered marble floor recedes into atmospheric depth. The pedestal is sized as if designed to hold this exact statue, the Subject's complementary base fitting the cap precisely. The rotunda may extend out of frame — Subject scale takes priority over showing the full architecture.

NEVER add desks, books, sculpting tools, certificates, ribbons, framed photos, busts, hardcover library books, or any "collector's display" props. The marble rotunda + pedestal + Subject is the entire vocabulary.
`.trim(),

  desk: `
LOCATION — DESK (serious collector's workspace):
The Subject sits on a warm wood desk in a serious collector's space. The Subject's round complementary base sits intentionally on the desk surface. A reference book rests open or stacked nearby in soft focus, perhaps a fine pen or sculpting tool at rest. Bookshelves recede into warm atmospheric blur behind the desk.
`.trim(),

  shelf: `
LOCATION — SHELF (trophy display):
The Subject sits on a wooden shelf in a dedicated trophy display — a fan's den, a coach's office, an athlete's home study. The Subject's RECTANGULAR complementary base fits the shelf depth precisely, sitting flat with its long edge parallel to the shelf front. Around the Subject sit ACTUAL TROPHIES — gold-plated cups of varying heights, marble-base plaques with engraved nameplates, a championship cup, smaller competition trophies in a row, mounted plaques on the back wall behind the shelf, framed certificates leaning at angles, competition medals on satin ribbons. The vocabulary is championship hardware — not bedroom mementos.

DEPTH:
The shelf is one of several. Soft horizontal lines of shelves above and below visible at the frame edges, receding from view. Items closer to camera in clear focus; items further back fall into atmospheric blur.

NEVER add desks, beds, study clutter, magnifying glasses, or non-trophy props.
`.trim(),

  workshop: `
LOCATION — WORKSHOP (sculptor's studio):
The Subject sits on a rough wooden workbench in the sculptor's working studio — NOT a polished study, a real lived-in artisan's space. The Subject's round complementary base sits intentionally on the bench, fitting between scattered tools as if placed for inspection. The bench itself is scarred from years of use — knife marks, dried glue spots, faded chalk lines, water rings. Fine sawdust dusts the bench surface; small wood shavings, clay flecks, or stone chips scatter across in piles where work has paused.

THE TOOLS (plural — many tools, not one):
A row of gouges of varying sizes, files, calipers, a knife or wire rake, a small mallet, a wood-handled chisel mid-use. A vise or small bench clamp at the bench edge. A work-in-progress raw material block (partially-carved log, rough clay armature, uncut stone) sits beside the Subject for context.

THE WALL BEHIND:
Reference sketches and anatomy studies pinned to a corkboard or directly to the wood-paneled wall — pencil drawings, photocopied references, hand-written notes, scraps of paper with measurements. NOT framed art, NOT formal bookshelves with hardcover books — a working pinboard.

NEVER add hardcover library books, framed certificates of authenticity, polished oak desks, formal bookshelves with library volumes, study furniture, museum pedestals, or any "collector's display" vocabulary. The workshop is a working space — raw wood, scrap, dust, and labor are the vocabulary, not gallery curation.
`.trim(),

  in_situ: `
LOCATION — IN ENVIRONMENT (sculpture in real-world action setting):
The Subject sits in the actual setting where the action takes place — outdoor or indoor depending on the sport. The Subject's round complementary base rests directly on the real surface where this action happens: wrestling mat for wrestling, boxing ring canvas for boxing, cage floor for MMA, gym floor for gymnastics, packed dirt for flat racing, snow for winter racing/skiing/snowboarding, ocean shore or shallow water for surfing, forest floor for trail riding, rock for climbing, track surface for running, stage floor for dance, packed earth for outdoor sports played on it. The base sits on this real action surface — the base is the work, the surface is context.

In the background, set back ten to fifteen meters, IMAGINE the actual full-size scene of this action playing out. For INDOOR sports: the gym/arena/ring with blurred crowd visible behind, real wrestlers/boxers/dancers/gymnasts mid-action. For OUTDOOR sports: real horses thundering down the actual track with grandstand behind, real surfers riding actual waves, real snowboarders carving real snow, real climbers on actual rock. All in true real-world materials and colors. NEVER apply the Subject's material to the background subjects.

DEPTH: Subject razor sharp; the background world melts into heavy painterly blur with atmospheric depth.

THE COMPLEMENTARY BASE IS THE ONLY PLINTH — no second pedestal, no architectural support. The base sits directly on the action surface. NEVER add wood tables, desks, bookshelves, framed photographs, ribbons, certificates of authenticity, sculpting tools, magnifying glasses, museum pedestals, ornate columns, marble busts, or any "collector's display" vocabulary. The action's real environment is the only context.
`.trim(),
}

// Back-compat: map legacy V4 location IDs to V5/V6 IDs during UI migration.
// Once UI fully on V5+ IDs, this map can be removed.
const LEGACY_LOCATION_ID_MAP: Record<string, LocationId> = {
  'in_context':  'in_situ',
  'on_a_desk':   'desk',
  'on_a_shelf':  'shelf',
}

// V6: LOCATION_OVERRIDES_PRESETS removed. Plushy/window_sill/trophy_shelf
// no longer force a location — every preset honors the user's location pick.
// (window_sill and trophy_shelf preset entries removed entirely.)
export function resolveLocationId(
  _presetId:  ActionMiniPresetId,
  requested:  string | LocationId,
): LocationId {
  const normalized = LEGACY_LOCATION_ID_MAP[requested as string] ?? (requested as LocationId)
  if (LOCATION_BLOCKS[normalized as LocationId]) return normalized as LocationId
  return 'desk'
}

export function getLocationBlock(
  locationId: LocationId,
  _presetId:  ActionMiniPresetId,  // reserved for future per-(loc × preset) carve-outs
): string {
  return LOCATION_BLOCKS[locationId] || LOCATION_BLOCKS.desk
}

// ── CRAFT DETAIL — sculpting craftsmanship, not scene props ─
export const CRAFT_DETAIL_BLOCK = `
CRAFT DETAIL:
Maximum sculpting craftsmanship — surface texture readable, edges crisp, fabric weave and hair strands visible.
Gallery-grade work that rewards close inspection.
`.trim()

// ── MATERIAL LIGHT INTERACTION — micro-surface only ─────────
// Per-preset description of how the material catches light at the surface
// level. NO scene/atmospheric content — LOCATION owns scene lighting.
// ~80 chars per preset.
const MATERIAL_LIGHT_INTERACTION_BY_PRESET: Record<ActionMiniPresetId, string> = {
  resin: `
MATERIAL LIGHT INTERACTION:
Light reveals brushwork ridges and edge crispness on the painted surface. Subtle softness in shadow valleys. Slight matte sheen on the painted finish, no high specular.
`.trim(),
  plushy: `
MATERIAL LIGHT INTERACTION:
Light reveals fiber direction across the fabric weave; soft falloff into seams and stuffed contours. NO specularity, just woven warmth.
`.trim(),
  carved_wood: `
MATERIAL LIGHT INTERACTION:
Light reveals grain direction, gouge marks, and tool tracks. Raking light catches the high faces of cuts; deep cuts hold shadow. Matte natural wood, no varnish sheen.
`.trim(),
  wax_bronze: `
MATERIAL LIGHT INTERACTION:
SUBSURFACE SCATTER on thin wax edges (fingertips, fabric edges, spray particles) glows amber from within. Bronze base catches warm metallic specular on raised edges with cool verdigris in recesses.
`.trim(),
  painted_ceramic_cracked: `
MATERIAL LIGHT INTERACTION:
Glazed surface catches subtle wet specular highlights along raised edges. Light enters craquelure crack lines and reveals the depth of each fracture. Painted finish reads as glaze, not skin.
`.trim(),
  terracotta_cracked: `
MATERIAL LIGHT INTERACTION:
Matte clay surface, no specular. Light reveals lighter inner clay where cracks open into the body. Long raking shadows accentuate fissure depth.
`.trim(),
  bronze_bronze: `
MATERIAL LIGHT INTERACTION:
Warm metallic specular on raised edges and high points; cool green-grey verdigris in recessed areas. Classic bronze contrast — warm-vs-cool across the surface.
`.trim(),
  iron: `
MATERIAL LIGHT INTERACTION:
Low, smoky specular — burnished high points catch warm gunmetal highlights while hammer-mark facets scatter light unevenly. Recesses hold deep matte charcoal; raking light reveals forge texture across every surface.
`.trim(),
  alabaster: `
MATERIAL LIGHT INTERACTION:
SUBSURFACE SCATTER throughout — internal warmth visible through thin sections (fingers, fabric edges). Surface catches soft specular at high points; interior glows where stone is thin.
`.trim(),
}

export function getMaterialLightInteractionBlock(presetId: ActionMiniPresetId): string {
  return MATERIAL_LIGHT_INTERACTION_BY_PRESET[presetId] || MATERIAL_LIGHT_INTERACTION_BY_PRESET.resin
}

// ── SCALE — composition mode ────────────────────────────────
// Subject = figure + base combined. Two-way mode mirroring Landscapes.
//   Staged   = ~75% of frame width, environmental staging visible
//   Close Up = ~90% of frame width, figure dominates
//
// HEADS UP — ID/LABEL INVERSION IS INTENTIONAL (matches Landscapes):
//   ID 'close_up' surfaces as "Staged"  (75%)
//   ID 'fill'     surfaces as "Close Up" (90%)
// IDs are stable for code; labels reflect current product naming.

export type Scale = 'close_up' | 'fill'

export const SCALE_LABELS: Record<Scale, string> = {
  close_up: 'Staged',
  fill:     'Close Up',
}

const SCALE_BLOCKS: Record<Scale, string> = {
  close_up: `
COMPOSITION — STAGED (75% width):
The Subject (figure plus its complementary base) occupies ~75% of image width, centered, with breathing room left and right. The Subject does NOT touch left/right edges. Environmental staging reads in soft focus around the figure.

FRAME PRIORITY — Subject scale wins. If the location architecture (rotunda, gallery, workshop walls, room) does not fit at this Subject scale, CROP the architecture — let walls, columns, ceilings, doorways extend outside the frame. NEVER shrink the Subject to fit the surrounding context. The Subject's 75% width is non-negotiable; everything else conforms.
`.trim(),

  fill: `
COMPOSITION — CLOSE UP (90% width):
The Subject (figure plus its complementary base) occupies ~90% of image width, centered tight in the frame. The figure dominates — facial expression, hand articulation, equipment detail readable at large scale. Surroundings minimal, base visible at the lower edge but tight to the figure. Pull camera in close — gallery-level macro detail of the sculpture itself.
`.trim(),
}

export function getScaleBlock(scale: Scale): string {
  return SCALE_BLOCKS[scale] || SCALE_BLOCKS.close_up
}

// ── REFINEMENTS TYPE ─────────────────────────────────────────
// V5+: only kineticEffects remains as a user toggle. Other former toggles
// (craftDetail, sceneDetail, dramaticLighting, sceneEnvironment, margins)
// are permanent or removed. The kineticEffects toggle preserves the
// option to render certain presets without motion artifacts (carved_wood,
// painted_ceramic_cracked, alabaster sometimes read better static).
export interface ActionMiniRefinements {
  kineticEffects?: boolean
}

export const DEFAULT_REFINEMENTS: Required<ActionMiniRefinements> = {
  kineticEffects: true,
}

// ── BLOCK ASSEMBLER ──────────────────────────────────────────
// V6.2 prompt order:
//   1.  preset.presetLine
//   2.  COLLECTIBLE_ANCHOR
//   3.  CAMERA
//   4.  FIGURE_FIDELITY
//   5.  MATERIAL_COLOR (per-preset)
//   6.  COMPLEMENTARY_BASE (per-preset × per-location)
//   7.  DRAMATIC_LUMINANCE — global rules + 1.6× target
//   8.  LIGHTING_MODE — gallery / environment / collectible (per location's mode)
//   9.  LOCATION — staging only, lighting-stripped
//   10. MATERIAL_LIGHT_INTERACTION (per-preset, micro-surface only)
//   11. CRAFT_DETAIL
//   12. SCALE
//   13. KINETIC_EFFECTS (toggle)
//   14. REFINEMENT_GUARD + tweak (only if refinementTweak present)
export function getRefinementBlocks(
  presetId:      ActionMiniPresetId,
  kineticMedium: KineticMedium,
  locationId:    LocationId,
  scale:         Scale,
  refinements:   ActionMiniRefinements = {},
): string[] {
  const r = { ...DEFAULT_REFINEMENTS, ...refinements }
  const blocks: string[] = []
  // Always-on stack
  blocks.push(COLLECTIBLE_ANCHOR_BLOCK)
  blocks.push(CAMERA_BLOCK)
  blocks.push(FIGURE_FIDELITY_BLOCK)
  blocks.push(getMaterialColorBlock(presetId))
  blocks.push(getComplementaryBaseBlock(presetId, locationId))
  blocks.push(DRAMATIC_LUMINANCE_BLOCK)
  blocks.push(getLightingModeBlock(locationId))
  blocks.push(getLocationBlock(locationId, presetId))
  blocks.push(getMaterialLightInteractionBlock(presetId))
  blocks.push(CRAFT_DETAIL_BLOCK)
  blocks.push(getScaleBlock(scale))
  // Toggleable
  if (r.kineticEffects) blocks.push(getKineticEffectsBlock(kineticMedium))
  return blocks
}
