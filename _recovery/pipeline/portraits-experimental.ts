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
import { framingBlock, CRAFT_PERSONALITY, HUE_LOCK, STUDIO_DIRECTIVES, COSTUME_DIRECTIVES } from './portraits-prompt'

export type ExperimentalEffectId =
  | 'deep_sea'
  | 'circuit'
  | 'reclaimed_bronze'
  | 'mercury'
  | 'blown_glass'
  | 'amber'
  | 'neon'
  | 'nebula_resin'
  | 'dragon_skin'
  | 'magic_energy'
  | 'armor'
  | 'elizabethan'
  | 'victorian'
  | 'fantasy_crystal'

interface ExperimentalEffect {
  id:         ExperimentalEffectId
  label:      string
  monolithic: boolean   // true → receives the TIER-2 hue lock
  mode?:      'material' | 'costume'  // 'costume' → real face, costume clothing (default 'material')
  body:       string    // transformation + presentation (NB2-facing)
  avoid:      string    // negative constraints
}

// Ordered — the UI renders one Curator button per entry in this order.
export const EXPERIMENTAL_EFFECTS: ExperimentalEffect[] = [
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
      `Render the subject as a fully three-dimensional neon-tube sculpture whose bent-glass tubes travel through all three axes — not a flat relief or a sign on a plane. The glowing tubes wrap around the head, loop forward and back through the depth of the form, and build the clothed bust as a true volumetric armature of light you could circle and see through, tubes crossing in front of and behind one another to carve out real volume with clear foreground, midground, and background layers. The tubes are NOT uniformly lit — some glow at full brilliance while others sit dimmer and cooler, giving the piece depth, modeling, and pockets of shadow between the lit runs. Rich electric color — magenta, cyan, warm white, deep blue, amber — with bright cores and soft halos, colored light spilling onto a darkened gallery setting and the surface below. A premium, high-value commissioned neon artwork with genuine sculptural depth.`,
    avoid:
      `Avoid a flat single-plane sign, relief, or outline drawing — the tubes must occupy real depth and wrap around the form in three dimensions. Avoid uniform, evenly-lit tubes; vary the brightness for depth and shadow. Avoid filling solid areas; the portrait is built from glowing tube with dark space between, layered front-to-back. Avoid a dim, washed-out overall look; the brightest tubes glow vividly with real bloom. Avoid skin or flesh — the face is built from neon tube like the rest.`,
  },
  {
    id: 'nebula_resin',
    label: 'Nebula Resin',
    monolithic: false,
    body:
      `The figure is FORMED ENTIRELY FROM deep-space nebula — wispy gas, cosmic dust, and glowing stars, with NO solid surface anywhere and NO skin anywhere, including the face. Swirls of violet, magenta, teal, and blue gas curl through the form, dense where they gather into shoulders, chest, and hair, thinning to nothing elsewhere so portions of the body dissolve into open starfield and reappear further on. Pinpoint stars and aurora light glimmer throughout. The face is recognizable ONLY through the way the gas and stars gather, glow, and shadow into the person's features — it is made of the same nebula gas and dust as everything else, never of skin, flesh, or any solid or opaque surface. Light, gas, and dust are the entire structure.`,
    avoid:
      `Avoid ANY photorealistic skin, flesh, or solid opaque surface anywhere — most importantly on the face, which must be gas and stars like the rest, never a real face floating in nebula. Avoid a solid human body with a galaxy texture painted on top. Avoid a complete, uniformly solid silhouette — parts of the form thin, break, and dissolve into space. Avoid a glossy resin or poured-solid look; this is gaseous and luminous.`,
  },
  {
    id: 'dragon_skin',
    label: 'Dragon Skin',
    monolithic: false,
    body:
      `Transform the subject into a dragon-human hybrid sculpture. The face, hair, and garment are rendered in fine iridescent dragon scales — deep emerald, oil-slick violet, bronze, and gold that shift in the light — larger and armored across the shoulders and chest, finer across the face. Behind and below the figure, a full dragon's body grows out of the back and shoulders: a scaled, spined draconic neck, ridged spine, and sweeping serpentine body curving down and away, as if the person is carved as one with a great dragon. Ridged horns and spines rise along the crown and back. The face is clearly defined and unmistakably this person, rendered entirely in fine scale, never in skin. Powerful, mythic, and jewel-like.`,
    avoid:
      `Avoid photorealistic human skin on the face — the face is fine dragon scale. Avoid a smooth, scaleless surface; overlapping scales are required. Avoid a flat single color; the scales are iridescent and shift hue. Avoid omitting the dragon body — a scaled draconic neck, spine, and body must grow from the back and curve down and away. Avoid a cartoonish or costume look — this is a museum-grade sculpture.`,
  },
  {
    id: 'magic_energy',
    label: 'Magic Energy',
    monolithic: false,
    body:
      `Sculpt the figure from pure glowing magical energy — arcane power given human form. The body is made of swirling luminous energy, flowing ribbons of light, drifting embers, and crackling arcs of color — violet, gold, cyan, and rose — that coalesce into the shape of a person and radiate light into the darkness around them. Denser and brighter where the energy gathers into the head, shoulders, and chest; thinning into wisps, sparks, and floating motes at the edges where portions of the form dissolve into raw magic. The face is clearly defined and unmistakably this person — but formed from light and energy, never from skin or flesh. Glowing runic sigils and faint particles orbit the figure. Awe-inspiring and otherworldly.`,
    avoid:
      `Avoid a solid body with an energy glow painted on top — the energy IS the structure, and the form breaks into wisps and sparks at the edges. Avoid photorealistic skin or flesh on the face. Avoid a dim, flat look; the piece radiates its own light with bright cores and soft falloffs. Avoid losing the likeness; the face stays defined within the energy.`,
  },
  {
    id: 'armor',
    label: 'Armor',
    monolithic: false,
    mode: 'costume',
    body:
      `Depict the subject as a realistic portrait wearing a magnificent suit of ornate, engraved plate armor — burnished steel and dark iron chased with gold filigree, etched patterns, and a few gemstone accents, fitted and layered like a masterwork ceremonial suit across the shoulders, chest, and arms. The face, skin, and hair are the person's own — real, accurate, and lifelike, NOT metal and NOT stylized. The head is bare or open-helmed so the real face shows clearly. A regal, heroic portrait of this exact person in armor.`,
    avoid:
      `Avoid a metallic, bronzed, or material-rendered face — the face and skin are realistic and this exact person. Avoid a closed helmet hiding the face. Avoid a plain, undetailed surface; the armor is intricately engraved. Avoid a cheap costume-party look — this is museum-grade.`,
  },
  {
    id: 'elizabethan',
    label: 'Elizabethan Portrait',
    monolithic: false,
    mode: 'costume',
    body:
      `Depict the subject as a realistic Elizabethan-era portrait — the person dressed in richly detailed 16th-century finery: a high starched lace ruff collar, an embroidered brocade doublet or gown with pearls and gold thread, sumptuous period fabric. Hair and makeup are styled to the Elizabethan era. The face, skin, and hair are the person's own — real, accurate, and lifelike. Composed in the manner of a grand Elizabethan court portrait, but as this exact person.`,
    avoid:
      `Avoid a material-rendered or stylized face — the face is realistic and this exact person. Avoid any modern clothing; the dress is fully Elizabethan. Avoid a cheap costume look; this is opulent period finery. Avoid nudity or bare shoulders — fully period-clothed.`,
  },
  {
    id: 'victorian',
    label: 'Victorian Portrait',
    monolithic: false,
    mode: 'costume',
    body:
      `Depict the subject as a realistic Victorian-era portrait — the person dressed in refined 19th-century attire: a high-collared coat, cravat, and waistcoat, or an elegant high-necked lace-trimmed dress with a cameo brooch. Hair and makeup are styled to the Victorian era. The face, skin, and hair are the person's own — real, accurate, and lifelike. Composed like a dignified Victorian studio portrait, but as this exact person.`,
    avoid:
      `Avoid a material-rendered or stylized face — the face is realistic and this exact person. Avoid any modern clothing; the dress is fully Victorian. Avoid a costume-party look; this is refined period attire. Avoid nudity or bare shoulders — fully period-clothed.`,
  },
  {
    id: 'fantasy_crystal',
    label: 'Enchanted Crystal',
    monolithic: false,
    body:
      `Transform the entire clothed figure into a sculpture of luminous enchanted crystal — a magical gemstone material carved into the subject's likeness. The face, hair, and garment are faceted, translucent crystal that glows softly from within, shifting through amethyst, aquamarine, rose, and gold as light passes through. Deeper, richer color pools in the mass of the shoulders and chest; the thin edges and facets catch and refract light into tiny rainbows. A faint magical aura and a few floating crystal shards drift around the piece. The face is clearly defined and unmistakably this person — but rendered in glowing carved crystal, never in skin. Enchanted, luminous, and jewel-like.`,
    avoid:
      `Avoid photorealistic skin on the face — the face is faceted glowing crystal like the rest. Avoid an opaque or dull surface; the crystal is translucent and lit from within. Avoid a single flat color; the enchanted crystal shifts hue and refracts light. Avoid a cheap plastic look — this reads as precious magical gemstone.`,
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

  // Plaque/inscription cut product-wide (2026-07-08) — every piece renders a
  // clean unmarked base. plaqueText remains inert plumbing (request shape kept).
  const plaqueLine = 'Clean unmarked base.'

  const directives = fx.mode === 'costume' ? COSTUME_DIRECTIVES : STUDIO_DIRECTIVES

  return [
    framingBlock(input.framing),
    CRAFT_PERSONALITY,
    directives,
    fx.monolithic ? HUE_LOCK : '',
    fx.body,
    fx.avoid,
    plaqueLine,
  ]
    .filter(Boolean)
    .join('\n\n')
}
