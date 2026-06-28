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
    id: 'geode_druzy',
    label: 'Geode Druzy',
    monolithic: false,
    body:
      `Transform the clothed figure into a sculpture of banded agate — face, hair, and garment all carved from concentric agate layers in earthy grey, white, and amber, polished smooth. The geode cavity does NOT cut through the plane of the face or the front of the chest; instead it opens on the upper back and shoulder, the cut rotated roughly thirty degrees toward the rear and thirty degrees downward, so the crystal interior is revealed at an angle rather than head-on. The opening is irregular and jagged — not a clean disc — pulling back layers of agate to expose a deep, generous pocket of sparkling druzy: glittering quartz and amethyst points in violet, lilac, and clear, catching the light. The front and face stay solid agate carrying the likeness; the angled, irregular back cavity is the reveal.`,
    avoid:
      `Avoid cutting the geode opening across the face or the front of the chest — it belongs on the upper back and shoulder, angled toward the rear and down. Avoid a clean circular cut; the opening is irregular and reveals deep internal crystal structure. Avoid dull, non-sparkling crystals. Avoid garish or neon crystal colors; keep them natural amethyst and quartz.`,
  },
  {
    id: 'deep_sea',
    label: 'Bioluminescent Deep-Sea',
    monolithic: false,
    body:
      `Sculpt the figure as a living deep-sea bioluminescent scene where light and water ARE the structure — not a solid body filled with light, but a form whose very substance is dark ocean water, glowing plankton, and the cold light of deep-sea creatures. Anglerfish with glowing lures, luminous jellyfish, and other bioluminescent fish drift WITHIN the form, their glow radiating outward into the surrounding body with soft, beautiful falloffs — pools of teal, cobalt, and violet light fading into deep shadow, so the piece reads as areas of luminous brightness and areas of near-darkness. Parts of the body are open and missing, dissolving into black water, then coalescing again where the creatures gather. The face stays clearly defined and unmistakably this person — but formed from water and living light, never from skin or flesh. Suspended in dark deep-water space with drifting motes.`,
    avoid:
      `Avoid a solid body of blue-green glass with light inside — the water, glow, and creatures ARE the structure, and the form breaks open with missing sections. Avoid photorealistic skin or flesh on the face. Avoid even, uniform glow — there must be dramatic dark and bright regions with soft falloffs. Avoid losing the likeness; the face stays defined within the luminous water.`,
  },
  {
    id: 'circuit',
    label: 'Silicon Circuit Board',
    monolithic: false,
    body:
      `Transform the entire clothed figure — face, hair, garment, and all — into intricate futuristic circuitry. EVERY surface, including the face, is built from fine etched conductive traces, tiny chips, and contacts following the contours; the face is circuitry too, clearly defined and recognizable but never photorealistic skin. The palette is sleek and futuristic: a dark substrate with fine copper and silver traces, accented by a FEW pale, muted glowing system lights and softly lit wires here and there — restrained, not a blaze. The likeness emerges from the density and flow of the circuitry. Precise, advanced, and consistent across the whole sculpture.`,
    avoid:
      `Avoid any photorealistic skin face on a circuit body — the face must be circuitry like the rest; this is the most common failure. Avoid realism creeping in; the whole piece is etched circuitry. Avoid heavy or gaudy glow — only a few muted, pale system lights and softly glowing traces. Avoid random component clutter that breaks the face; traces follow and reveal the likeness.`,
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
      `Render the subject in liquid mercury caught in dynamic transformation — a mirror-perfect chrome figure in the act of dissolving and re-forming. The clothed bust is hyper-reflective polished liquid metal, but alive with motion: ribbons and sheets of mercury peel and fling outward, droplets break away and hang suspended in the air, and parts of the form stretch into liquid tendrils mid-splash, like the surface of mercury disturbed and frozen at its most dramatic instant. Strong directional gallery light rakes across the chrome so reflections and droplets blaze. Surreal, kinetic, and impossibly fluid — a body in liquid-metal flux, not a static statue.`,
    avoid:
      `Avoid a still, solid, symmetric chrome bust — the drama is in the motion, the breaking droplets, and the peeling ribbons of metal. Avoid reflections so chaotic the face is lost; the likeness reads clearly in the mirrored surface. Avoid any non-silver color. Avoid photorealistic skin on the face; it is liquid chrome like the rest.`,
  },
  {
    id: 'blown_glass',
    label: 'Blown Art Glass',
    monolithic: false,
    body:
      `Transform the clothed figure into a single breathtaking piece of hand-blown art glass in the Chihuly and Murano master tradition — a museum-grade studio-glass sculpture, never a cheap molded trinket. The form is seamless, deeply translucent, and alive with motion: bold ribbons and veils of molten color — amber, cobalt, crimson, gold, teal — swirl and twist through the glass in dramatic organic currents, with internal bubbles, lenses, and optical depth bending the light. The entire piece including the face is this swirled translucent glass — the face is clearly defined but rendered in glass, never as photorealistic skin. The glass glows from within. Capture it from a dynamic, slightly low three-quarter camera angle under raking gallery light so the color and translucency blaze. Fluid, virtuosic, expensive.`,
    avoid:
      `Avoid faceted or leaded stained-glass cells — this is seamless blown glass, not a window. Avoid photorealistic skin or flesh tones on the face — the face is swirled glass like the body. Avoid a flat, static, symmetric, mold-made look; this is dynamic, asymmetric, virtuoso studio glass. Avoid an opaque or painted surface; the glass is translucent and light-filled.`,
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
      `Render the subject as a fully three-dimensional neon-tube sculpture whose bent-glass tubes travel through all three axes — not a flat relief or a sign on a plane. The glowing tubes wrap around the head, loop forward and back through the depth of the form, and build the clothed bust as a true volumetric armature of light you could circle and see through, tubes crossing in front of and behind one another to carve out real volume. Rich electric color — magenta, cyan, warm white, deep blue, amber — with bright cores and soft halos, colored light spilling onto a darkened gallery setting and the surface below. A premium, high-value commissioned neon artwork with genuine sculptural depth.`,
    avoid:
      `Avoid a flat single-plane sign, relief, or outline drawing — the tubes must occupy real depth and wrap around the form in three dimensions. Avoid filling solid areas; the portrait is built from glowing tube with dark space between, but layered front-to-back. Avoid dim or washed-out neon; the tubes glow vividly with real bloom. Avoid skin or flesh — the face is built from neon tube like the rest.`,
  },
  {
    id: 'nebula_resin',
    label: 'Nebula',
    monolithic: false,
    body:
      `The figure is FORMED FROM deep-space nebula itself — not a solid body painted with stars, but actual wispy, gaseous, glowing stellar matter that coalesces into the shape of a person. Swirls of violet, magenta, teal, and blue cosmic gas drift and curl through the form, dense and opaque where they gather into shoulders, chest, and hair, thinning to almost nothing elsewhere so portions of the body dissolve into open starfield and reappear further on. Pinpoint stars and faint aurora light glimmer throughout. The face is clearly defined and unmistakably this person — but sculpted FROM luminous gas and stardust, never from skin or flesh. Light and gas are the structure; there is no solid surface beneath.`,
    avoid:
      `Avoid a solid human body with a galaxy texture painted on top — the gas and stars ARE the structure. Avoid any photorealistic skin or flesh tones on the face. Avoid a complete, uniformly solid silhouette — parts of the form should thin, break, and dissolve into space, then coalesce again. Avoid a glossy resin or poured-solid look; this is gaseous and luminous.`,
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
