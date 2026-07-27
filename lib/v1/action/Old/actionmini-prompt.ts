// lib/v1/action/actionmini-prompt.ts
//
// Action Mini prompt system — tight build.
//
// 9-block architecture: 6 shared + 1 material module + 2 mode-specific.
// Designed so NB2 handles scene reconstruction and kinetic effects from
// the source image itself rather than from hard-coded vocabulary tables.
//
// Target: ~4,000 chars assembled per render. Lean prose, only what NB2
// needs to commit. The user's working ceramic prompt landed at ~5,700
// chars; this is the same template but trimmed across the board.

import type { ActionMiniPresetId } from './actionmini-presets'

export type RenderMode = 'environment' | 'gallery'

// ──────────────────────────────────────────────────────────────
// SHARED BLOCKS (used by both render modes)
// ──────────────────────────────────────────────────────────────

const OPENING = `Photograph of a real physical three-dimensional sculpture. The sculpture exists as a tangible object in space with authentic lighting, shadow, depth, and material response. Premium gallery-quality collectible art object.`

const FIGURE_FIDELITY = `FIGURE FIDELITY (PRIMARY REQUIREMENT — OVERRIDES ALL OTHER DIRECTIVES)

The face must match the source photograph exactly. Recognizable likeness is the highest priority and overrides all stylistic, material, or environmental considerations. Match the source's eye spacing, eye shape, nose bridge, mouth, jawline, ears, hairline, age, and ethnic features.

A material-perfect sculpture with a generic face is a failure. A less-refined sculpture with the correct face is a success.

All anatomy, pose, clothing, and equipment must be mechanically and anatomically correct. Fingers fully articulated. Maximum craftsmanship throughout.`

const CAMERA = `CAMERA

Professional product photography. Camera 45 degrees above the sculpture, angled downward. Top of base visible. Front of figure visible. Sculpture and base occupy approximately 75% of image width, centered with breathing room around all sides. Never crop the sculpture.`

const COMPLEMENTARY_BASE = `COMPLEMENTARY BASE

The sculpture stands on a substantial round patinated bronze base — part of the artwork, not a support. Warm bronze tone with polished highlights and green-grey verdigris in recesses. Substantial footprint, approximately 30% margin around the figure.

The base sits directly on the real-world action surface depicted by the scene. No secondary pedestal, table, shelf, certificate, ribbon, or collector props.`

const ACTION_DYNAMICS = `ACTION DYNAMICS — SOURCE AWARE

Analyze the action, environment, surface, weather, speed, and force shown in the source image. Generate physically appropriate motion effects and material interaction that naturally arise from the depicted action.

Effects may include: water spray, foam, snow, ice particles, dirt, mud, dust, sand, chalk, sweat, debris, vegetation displacement, fabric movement, hair movement, equipment flex, surface compression, plus material interaction (water/mud/snow transfer onto sculpture, fabric tension or stretching, surface wear).

Use only effects that naturally belong to the depicted action. Never add unrelated effects. Motion should appear physically connected to the subject and frozen at a dramatic moment of peak action.`

const CRAFTSMANSHIP = `CRAFTSMANSHIP

Maximum collectible-quality execution. Crisp edges, readable fabric weave, visible stitching, clear material transitions, realistic textile behavior, exceptional sculptural fidelity. Premium limited-edition gallery collectible photographed in its action environment.`

// ──────────────────────────────────────────────────────────────
// MODE-SPECIFIC BLOCKS
// ──────────────────────────────────────────────────────────────

const LIGHTING_ENVIRONMENT = `LIGHTING

Cinematic authored lighting. Sculpture and base are the brightest, most visually important elements in the frame. Allow deep shadows, localized brightness, dramatic falloff, atmospheric depth, selective rim lighting. Avoid HDR appearance, uniform exposure, flat documentary lighting. The sculpture has enhanced readability while remaining naturally integrated into the environment.`

const ENVIRONMENT_SCENE_AWARE = `ENVIRONMENT — SCENE AWARE

The sculpture exists within the real-world location where the action takes place. Reconstruct the broader environment from the source image — terrain, architecture, spectators, weather, equipment, vegetation as appropriate.

The sculpture is the sole hero subject. Background stays secondary through heavy depth-of-field blur, atmospheric perspective, reduced contrast and luminance. The environment supports the story; the sculpture remains the focus.`

const LIGHTING_GALLERY = `LIGHTING — GALLERY MODE

Sculpture presented as a museum artifact — sacred, isolated, theatrical. A concentrated volumetric beam of warm directional light shines down from a skylight in the distant dome, raking the sculpture from upper-left at 30-45 degrees with dust motes suspended in the beam.

Sculpture is the brightest object in the frame. Surrounding architecture falls into deep controlled shadow with bright pools where the beam catches stone. Allow strong volumetric beams, dramatic shadow mass, sculptural edge highlights. Avoid evenly readable environments, globally lifted exposure, flat museum lighting.

Reference mood: cathedral spotlight, luxury gallery installation, mythic artifact reveal.`

const ENVIRONMENT_GALLERY = `ENVIRONMENT — GALLERY ROTUNDA

The sculpture sits on a marble pedestal in a museum-quality gallery rotunda. Polished marble columns ring the perimeter at distance. Checkered marble floor recedes into atmospheric depth. The sculpture's complementary base sits on the pedestal cap as if designed for it.

The marble rotunda + pedestal + sculpture is the entire environmental vocabulary. Never add desks, books, certificates, ribbons, props, museum cases, busts, sculpting tools, or any "collector's display" elements.`

// ──────────────────────────────────────────────────────────────
// MATERIAL MODULES (per-preset, ~800-1,000 chars each)
// ──────────────────────────────────────────────────────────────

const MATERIAL_RESIN = `RESIN MATERIAL MODULE

Handcrafted painted resin collectible, professionally sculpted and hand-finished. Smooth painted resin with hand-applied color, fine brushwork on details, subtle paint variation in shadow.

Material reads as hard, smooth painted-resin: dense, lightweight, no ceramic glaze depth, no metallic weight.

Fine details remain crisp: facial features, fingers, fabric folds, equipment preserved.

Subtle handcrafted evidence: slight paint variation, hand-finished refinement, soft brush texture on broad planes, minor hand-finishing wear.

Avoid: ceramic glaze pools, fabric weave, plush, metal patina, vinyl, uniform glossy plastic.

Light interacts through soft satin specular on highlights, natural skin response on flesh, matte-to-satin transitions on painted clothing.

Premium painted resin collectible from a master figure sculptor.`

const MATERIAL_PLUSHY = `PLUSHY MATERIAL MODULE

Handcrafted soft plush toy sculpture, sewn from fabric panels with stuffing inside. Visible fabric texture (felt, plush, microfiber) with plush nap; embroidered features replace sculpted detail.

Material reads as soft, deformable-looking, fabric-on-stuffing. No hardness, no rigidity, no realistic anatomy beyond what plush construction allows.

Stitched seams visible at panel transitions and detail boundaries.

Subtle handcrafted evidence: hand-stitched variation, slight shape softness in limbs, minor compression where stuffing settles, fabric nap direction.

Avoid: ceramic hardness, painted glaze, metallic specular, polished surfaces, realistic anatomical features.

Light interacts through matte diffuse response across fabric nap, soft shadow rolloff with no specular, gentle volumetric softness in recesses.

Premium handcrafted plush collectible from a master soft-toy maker.`

const MATERIAL_CARVED_WOOD = `CARVED WOOD MATERIAL MODULE

Handcrafted carved hardwood sculpture from a single block of warm-toned wood. Satin-smooth surface with grain pattern following the form — deeper in recesses, lighter on raised planes. Hand-tooled facets visible on broader areas.

Material reads as solid hardwood: organic, warm, dense, weight-bearing.

Fine details remain crisp through the grain: facial features, fingers, fabric folds preserved.

Subtle handcrafted evidence: visible gouge facets on broader planes, hand-finished refinement, natural grain reading, minor tool marks at hidden transitions.

Avoid: ceramic glaze, painted color (figure stays uniform wood), plastic, metal, fabric texture, glossy varnish over grain.

Light interacts through matte-to-satin warm specular on highlights, depth in the grain pattern, warm reflected tone in shadow.

Premium carved hardwood sculpture from a master woodcarver.`

const MATERIAL_WAX_BRONZE = `WAX-BRONZE MATERIAL MODULE

Dual-material sculpture: figure in pale amber translucent wax, mounted on patinated bronze base.

Figure: solid translucent wax in pale amber throughout — monochrome wax-on-bronze. NO painted skin tones, NO clothing colors. Light passes through thin edges creating subsurface scatter glow.

Base: solid patinated bronze with warm polished highlights on raised edges and cool green-grey verdigris in recesses.

Material reads as a master wax study mounted on bronze — classical mold-stage sculpture in translucent wax form.

Subtle handcrafted evidence: wax pour irregularities, slight amber color variation, hand-polished refinement, bronze patina depth.

Avoid: skin tones on figure (stays monochrome amber), painted clothing, ceramic glaze, plastic. NEVER reads as painted resin.

Light through wax: subsurface scatter on thin edges glowing warmly from within, polished specular on broader surfaces. Bronze base: metallic specular on raised edges, verdigris in recesses.

Master wax sculpture on bronze plinth — European classical tradition.`

const MATERIAL_PAINTED_CERAMIC_CRACKED = `PAINTED CERAMIC CRACKED MATERIAL MODULE

Handcrafted painted ceramic with visible fine craquelure (controlled crackle glaze), professionally sculpted, kiln fired, hand painted. Glazed ceramic with hand-applied color and authentic crackle lines across the surface — fine, irregular, following the form.

Material reads as hard, dense ceramic with visible age character from the crackle pattern.

Fine details remain crisp through paint and crackle: facial features, fingers, fabric folds preserved.

Subtle handcrafted evidence: hand-painted color variation, authentic crackle aging pattern, glaze depth at edges, hand-finished refinement.

Avoid: smooth uncracked glaze (this preset must show craquelure), plastic, vinyl, plush, metallic specular, artificial weathering layered on top.

Light interacts through specular on glazed surface, crackle lines catching light at their edges giving micro-depth, authentic depth in the glaze layer.

Hand-painted craquelure ceramic sculpture — museum-quality with authentic age character.`

const MATERIAL_TERRACOTTA_CRACKED = `TERRACOTTA CRACKED MATERIAL MODULE

Handcrafted unfired terracotta clay in uniform terracotta-red, sculpted by hand with natural surface cracks from drying. Matte porous clay, monochrome terracotta throughout.

Material reads as unfired clay: matte, porous, monochrome, slightly chalky in highlights.

Fine details remain crisp: facial features, fingers, fabric folds preserved despite rough clay character.

Subtle handcrafted evidence: hand-sculpting fingerprints, natural drying cracks, slight color variation in shadow recesses, hand-finished refinement.

Avoid: skin tones (figure stays uniform terracotta — NO skin colors, NO painted clothing, NO glaze), ceramic glaze pools, paint, plastic, polished surfaces.

Light interacts through matte diffuse response (no specular), soft shadow rolloff, warm color depth in shadow recesses.

Master terracotta clay study — classical sculptor's working maquette preserved.`

const MATERIAL_BRONZE_BRONZE = `BRONZE-BRONZE MATERIAL MODULE

Handcrafted solid cast bronze, figure and base both bronze. Master metalwork at miniature scale. Warm patinated bronze with polished highlights on raised edges and cool green-grey verdigris in recessed sculpting.

Material reads as solid cast bronze: dense, metallic, weight-bearing, monochrome metal throughout.

Fine details remain crisp: facial features, fingers, fabric folds, equipment preserved in cast bronze precision.

Subtle handcrafted evidence: hand-finished patina variation, polished highlights on raised forms, verdigris pooling in deeper sculpting, cast bronze surface character.

Avoid: painted color (entire sculpture stays bronze — figure and base both — NO skin tones, NO clothing colors), ceramic glaze, plastic, plush, fabric weave.

Light interacts through warm metallic specular on raised surfaces, cool verdigris in recesses, dramatic depth in the patina.

Master cast bronze sculpture — European classical bronze tradition at miniature scale.`

const MATERIAL_IRON = `FORGED IRON MATERIAL MODULE

Handcrafted hand-forged iron sculpture — deep charcoal-black metal with a soft gunmetal sheen and authentic forge character. Visible hammer-work texture across every surface, burnished highlights on raised features, darker oxide patina settled into recesses and undercuts.

Material reads as professional blacksmith work: hammer-mark facets, deliberate burnishing on high points, honest forge texture — never machined-smooth.

Fine details remain crisp in the iron: facial features, fingers, fabric folds preserved.

Subtle handcrafted evidence: hand-hammered surface variation, burnish wear on raised edges, patina pooling in undercuts.

Avoid: painted color (no painted skin), orange rust, flesh tones, ceramic glaze, plastic, plush, fabric. The palette is charcoal, graphite, and warm gunmetal only.

Master forged-iron sculpture — contemporary blacksmith craft in the European metalwork tradition.`

const MATERIAL_ALABASTER = `ALABASTER MATERIAL MODULE

Handcrafted carved alabaster stone, sculpted from a single block in pale cream-white. Smooth carved stone with subtle subsurface translucency through thin sections, soft natural veining visible through the form, hand-polished refinement.

Material reads as carved alabaster: solid stone with characteristic subsurface translucency that no other stone possesses.

Fine details remain crisp: facial features, fingers, fabric folds preserved through hand-polished stone.

Subtle handcrafted evidence: subtle natural veining, soft sculptural transitions, hand-polished refinement, minor cream tone variation.

Avoid: skin tones (figure stays uniform alabaster — NO painted skin, NO clothing colors), ceramic glaze, paint, plastic, plush, metallic specular.

Light interacts through subsurface scatter on thin edges (figure glows softly where light passes through), soft falloff into interior, matte stone specular on broader polished surfaces.

Master carved alabaster sculpture — European classical tradition with characteristic translucent glow.`

// Map presets → material modules
const MATERIAL_MODULES: Record<ActionMiniPresetId, string> = {
  resin:                     MATERIAL_RESIN,
  plushy:                    MATERIAL_PLUSHY,
  carved_wood:               MATERIAL_CARVED_WOOD,
  wax_bronze:                MATERIAL_WAX_BRONZE,
  painted_ceramic_cracked:   MATERIAL_PAINTED_CERAMIC_CRACKED,
  terracotta_cracked:        MATERIAL_TERRACOTTA_CRACKED,
  bronze_bronze:             MATERIAL_BRONZE_BRONZE,
  iron:                      MATERIAL_IRON,
  alabaster:                 MATERIAL_ALABASTER,
}

// ──────────────────────────────────────────────────────────────
// ASSEMBLER
// ──────────────────────────────────────────────────────────────

/**
 * Build the Pass 1 prompt for an Action render.
 *
 * @param preset  Material preset id (selects the material module)
 * @param mode    'environment' (default) — scene reconstructed from source
 *                'gallery' — sculpture on marble pedestal in rotunda
 * @returns assembled prompt string (~4,000 chars typical)
 */
export function buildActionPrompt(
  preset: ActionMiniPresetId,
  mode:   RenderMode = 'environment',
): string {
  const blocks = [
    OPENING,
    FIGURE_FIDELITY,
    MATERIAL_MODULES[preset],
    CAMERA,
    COMPLEMENTARY_BASE,
    mode === 'gallery' ? LIGHTING_GALLERY    : LIGHTING_ENVIRONMENT,
    ACTION_DYNAMICS,
    mode === 'gallery' ? ENVIRONMENT_GALLERY : ENVIRONMENT_SCENE_AWARE,
    CRAFTSMANSHIP,
  ]
  return blocks.join('\n\n')
}

// Re-export blocks for testing / partial use
export const ACTION_BLOCKS = {
  OPENING,
  FIGURE_FIDELITY,
  CAMERA,
  COMPLEMENTARY_BASE,
  ACTION_DYNAMICS,
  CRAFTSMANSHIP,
  LIGHTING_ENVIRONMENT,
  ENVIRONMENT_SCENE_AWARE,
  LIGHTING_GALLERY,
  ENVIRONMENT_GALLERY,
  MATERIAL_MODULES,
}
