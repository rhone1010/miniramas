// lib/v1/portraits/portraits-experimental.ts
//
// Experimental Effects addon. Ten "out there" materials surfaced as
// buttons in the Curator section — a lightweight, additive path that
// deliberately does NOT route through PortraitsPresetId.
//
// Why separate: making these first-class presets would force an entry in
// every exhaustive Record<PortraitsPresetId,…> (MATERIAL_PHRASE,
// ARTISTS_BLOCKS, PASS2_MATERIAL_REFINEMENT_BY_PRESET, the curator
// register, the effect-curator catalog) plus tiers, labels, style
// assignment, and a preview render each — a lot of surface for effects
// still under test. Instead they live here behind their own
// ExperimentalEffectId union and reuse the same tier primitives
// (framing → personality → optional hue-lock → effect) so a render still
// feels consistent with the core pipeline.
//
// CONTRACT FOR THE UI (Curator buttons):
//   experimentalButtons() → [{ id, label }]  (ordered; one button each)
//   On tap, POST { experimental_effect: <id>, framing?, plaque? } to the
//   portraits generate route. The route detects experimental_effect and
//   calls buildExperimentalPrompt instead of buildPortraitsPrompt; no
//   preset_id / material / location is sent for an experimental render —
//   each effect carries its own setting.

import type { Framing } from './portraits-shared'
import { framingBlock, CRAFT_PERSONALITY, HUE_LOCK, STUDIO_DIRECTIVES } from './portraits-prompt'

export type ExperimentalEffectId =
  | 'kintsugi'
  | 'geode_druzy'
  | 'deep_sea'
  | 'circuit'
  | 'reclaimed_bronze'
  | 'mercury'
  | 'blown_glass'
  | 'amber'
  | 'neon'
  | 'nebula_resin'

interface ExperimentalEffect {
  id:         ExperimentalEffectId
  label:      string
  monolithic: boolean   // true → receives the TIER-2 hue lock
  body:       string    // transformation + presentation (NB2-facing)
  avoid:      string    // negative constraints
}

// Ordered — the UI renders one Curator button per entry in this order.
export const EXPERIMENTAL_EFFECTS: ExperimentalEffect[] = [
  {
    id: 'kintsugi',
    label: 'Kintsugi Porcelain',
    monolithic: true,
    body:
      `Transform the entire clothed figure into pure white glazed porcelain — smooth, luminous, faintly translucent at the thin edges. The piece has been shattered and lovingly rebuilt in the kintsugi tradition, and the repair is abundant and beautiful: a rich, sprawling network of gold-filled cracks runs everywhere across the face, hair, and garment — many seams, some hairline-fine and others wide rivers of lustrous gold where whole fragments were rejoined, with gold pooling at the junctions. The porcelain stays uniformly white; gold appears ONLY along the repaired breaks. The more numerous and golden the repairs, the better — the history of breakage is celebrated, traced in veins of light across the whole sculpture.`,
    avoid:
      `Avoid colored or painted porcelain, flesh tones, or any hue other than white in the ceramic itself. Avoid gold anywhere except along the crack seams. Avoid a sparse or nearly-pristine surface — the repairs should be plentiful, varied in width, and visually rich.`,
  },
  {
    id: 'geode_druzy',
    label: 'Geode Druzy',
    monolithic: false,
    body:
      `Transform the clothed figure into a sculpture of banded agate — face, hair, and garment all carved from concentric agate layers in earthy grey, white, and amber. The piece is deliberately asymmetric and organic: on one side the agate is whole, while on the other a great geode cavity has burst open and overtaken a shoulder and arm, dissolving the limb into a rough crystal-lined edge. That open cavity — breaking through the chest of the garment — is packed with sparkling druzy crystals: glittering quartz and amethyst points in violet, lilac, and clear, catching the light. The solid agate carries the likeness; the asymmetric crystal growth and its open cavity are the drama.`,
    avoid:
      `Avoid a fully crystalline figure with no solid stone — the face and form stay carved agate. Avoid dull, non-sparkling crystals; the druzy must glitter. Avoid a tidy, symmetric bust — the crystal growth should organically consume one shoulder and arm. Avoid garish or neon crystal colors; keep them natural amethyst and quartz.`,
  },
  {
    id: 'deep_sea',
    label: 'Bioluminescent Deep-Sea',
    monolithic: false,
    body:
      `Transform the entire clothed figure into a translucent, bioluminescent deep-sea form that glows with its own inner light. The body and garment read as semi-transparent, gelatinous, faintly iridescent tissue — lit from within by cool light in teal, cobalt, violet, and aqua, with luminous veins and glowing filaments tracing the contours of the face, shoulders, and clothing. Suspend it dramatically in dark deep-water space with drifting motes and a shaft of light from above, captured at a dynamic three-quarter angle. Ethereal, otherworldly, and alive.`,
    avoid:
      `Avoid an opaque, solid, or matte surface — translucency and inner glow are required. Avoid bare skin or nudity; the clothed form glows as one translucent piece. Avoid warm colors; the palette is cool ocean light. Avoid losing the likeness in abstraction — the face stays recognizable beneath the glow.`,
  },
  {
    id: 'circuit',
    label: 'Silicon Circuit Board',
    monolithic: false,
    body:
      `Transform the entire bust into an intricate technological sculpture grown from circuit-board components. The face and form are built from a dark printed-circuit substrate traced with fine copper and gold conductive lines that follow the contours like topography, studded with tiny black microchips, gold contacts, and soldered components. The likeness emerges from the density and flow of the traces. A "digital soul" portrait — precise, gleaming, intricate.`,
    avoid:
      `Avoid a flat 2D circuit diagram — this is a dimensional sculpted bust. Avoid random component clutter that breaks the face; the traces must follow and reveal the likeness. Avoid flesh tones or painted skin.`,
  },
  {
    id: 'reclaimed_bronze',
    label: 'Reclaimed Bronze',
    monolithic: false,
    body:
      `Transform the bust into a weathered bronze statue long reclaimed by nature. The metal is deep verdigris — green-blue patina over warm bronze — and across it grows a living layer of soft moss, pale lichen, and a few small ferns sprouting from crevices at the shoulders and base. Some bronze still gleams where rain has worn it smooth; elsewhere nature has taken hold. A romantic image of time passing and beauty in gentle decay.`,
    avoid:
      `Avoid a clean, polished, growth-free statue — the moss and lichen are essential. Avoid burying the face in foliage; the bronze likeness stays clear. Avoid bright artificial greens; keep the moss and patina natural and muted.`,
  },
  {
    id: 'mercury',
    label: 'Liquid Mercury',
    monolithic: true,
    body:
      `Transform the entire clothed figure into a frozen splash of liquid mercury — flowing, seamless, mirror-perfect chrome capturing the face, hair, and garment mid-motion. The surface is hyper-reflective, like polished liquid silver, with smooth rounded forms, beading droplets, and ribbons of metal flinging off the shoulders and sleeves. The likeness is held in the gleaming reflective contours. Stage it under dramatic gallery light at a dynamic angle. Surreal, fluid, and impossibly smooth.`,
    avoid:
      `Avoid a matte or brushed surface — the mirror-chrome reflectivity is the effect. Avoid reflections so chaotic the face is lost; the likeness must read clearly in the metal. Avoid any non-silver color.`,
  },
  {
    id: 'blown_glass',
    label: 'Blown Art Glass',
    monolithic: false,
    body:
      `Transform the clothed figure into a single breathtaking piece of hand-blown art glass in the Chihuly and Murano master tradition — a museum-grade studio-glass sculpture, never a cheap molded trinket. The form is seamless, deeply translucent, and alive with motion: bold ribbons and veils of molten color — amber, cobalt, crimson, gold, teal — swirl and twist through the glass in dramatic organic currents, with internal bubbles, lenses, and optical depth bending the light. The glass glows from within. Capture it from a dynamic, slightly low three-quarter camera angle under raking gallery light so the color and translucency blaze. Fluid, virtuosic, expensive — the work of a master glassblower.`,
    avoid:
      `Avoid faceted or leaded stained-glass cells — this is seamless blown glass, not a window. Avoid a flat, static, symmetric, mold-made look; this is dynamic, asymmetric, virtuoso studio glass. Avoid an opaque or painted surface; the glass is translucent and light-filled. Avoid muddy or washed-out color; the swirled ribbons stay vivid and deep.`,
  },
  {
    id: 'amber',
    label: 'Amber Inclusion',
    monolithic: true,
    body:
      `Transform the entire bust into a sculpture of golden translucent amber, glowing warm honey-gold as if lit from behind. Suspended within the amber are tiny natural inclusions — small bubbles, a fern frond, a leaf, flecks of ancient debris — caught mid-float. The surface is smooth and polished; the depth of the amber gives the piece an inner glow. The subject preserved in time, like life caught in fossil resin.`,
    avoid:
      `Avoid an opaque or dark surface — the translucent honey glow is essential. Avoid colors outside the amber range (gold, honey, warm brown). Avoid so many inclusions that the face is obscured.`,
  },
  {
    id: 'neon',
    label: 'Neon Light-Drawing',
    monolithic: false,
    body:
      `Render the subject as a dimensional, free-standing neon-tube sculpture — a premium gallery light installation, not a flat wall sign. Real bent-glass neon tubes, layered front-to-back with genuine depth, trace the full clothed bust: the contours of the face, the hair, the garment, the shoulders and arms built up in overlapping luminous lines you could walk around. The tubes glow in rich electric color — magenta, cyan, warm white, deep blue, amber — with bright cores, soft halos, and colored light spilling onto a darkened gallery setting and the surface below. Layered, intricate, and three-dimensional, with the craftsmanship and presence of a high-value commissioned neon artwork.`,
    avoid:
      `Avoid a flat single-plane neon sign or storefront logo — this is a dimensional sculpture with front-to-back depth. Avoid sparse, simple outlines; the piece is richly layered and detailed. Avoid filling solid areas; the portrait is built from lines of glowing tube with dark space between. Avoid dim or washed-out neon; the tubes glow vividly with real light bloom.`,
  },
  {
    id: 'nebula_resin',
    label: 'Nebula Resin',
    monolithic: false,
    body:
      `Transform the entire bust into dark cosmic resin swirled with the colors of a galaxy — deep space-black shot through with currents of violet, magenta, teal, and blue nebula clouds, with tiny embedded points of light like stars and a faint aurora shimmer. The resin is glossy and semi-translucent, catching light across its surface. The likeness emerges from the swirling cosmos. Dreamy, infinite, otherworldly.`,
    avoid:
      `Avoid a flat painted galaxy print — the cosmos lives in the depth of glossy resin. Avoid an opaque matte surface. Avoid losing the face; the likeness stays clear within the swirl.`,
  },
]

// id → effect lookup
const BY_ID: Record<ExperimentalEffectId, ExperimentalEffect> =
  EXPERIMENTAL_EFFECTS.reduce((m, e) => {
    m[e.id] = e
    return m
  }, {} as Record<ExperimentalEffectId, ExperimentalEffect>)

export function isExperimentalEffect(id: string): id is ExperimentalEffectId {
  return Object.prototype.hasOwnProperty.call(BY_ID, id)
}

// What the Curator UI renders its buttons from.
export function experimentalButtons(): { id: ExperimentalEffectId; label: string }[] {
  return EXPERIMENTAL_EFFECTS.map(e => ({ id: e.id, label: e.label }))
}

// Assembles an experimental render prompt using the same tier order as the
// core builders: TIER 1 universal (framing + personality) → TIER 2 hue lock
// (monolithic effects only) → effect body + avoid → plaque → likeness.
// No location is injected — each effect carries its own setting in its body.
export function buildExperimentalPrompt(input: {
  effectId:    ExperimentalEffectId
  framing?:    Framing
  plaqueText?: string | null
}): string {
  const fx = BY_ID[input.effectId]
  if (!fx) throw new Error(`unknown experimental effect: ${input.effectId}`)

  let plaqueLine = ''
  if (input.plaqueText === null) {
    plaqueLine = 'Clean unmarked base.'
  } else if (input.plaqueText && input.plaqueText.trim()) {
    plaqueLine = `Small plaque on the base reading "${input.plaqueText.trim()}".`
  }

  return [
    framingBlock(input.framing),
    CRAFT_PERSONALITY,
    STUDIO_DIRECTIVES,
    fx.monolithic ? HUE_LOCK : '',
    fx.body,
    fx.avoid,
    plaqueLine,
  ]
    .filter(Boolean)
    .join('\n\n')
}
