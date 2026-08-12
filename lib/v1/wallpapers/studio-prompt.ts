// lib/v1/wallpapers/studio-prompt.ts
//
// THE STUDIO PROMPT BUILDER.
//
// Four choices in, one string out. No model in this file, no LLM anywhere
// in the pipeline, no network call - the whole builder is data and
// concatenation, which is what makes the Studio instant and very nearly
// free. Anything that "improves" a prompt with a model call adds a second
// of latency and a cost per image to a product whose only advantage is
// having neither.
//
// Spec: docs/GOVERNANCE/STUDIO-PROMPT-ALGORITHM-2026-08-11.md
//
// ── THE RULE EVERY ENTRY OBEYS ─────────────────────────────────────────
//
// A four-step model rewards concrete nouns and punishes adjectives. It has
// four steps to resolve a whole frame; abstraction gives it nothing to
// resolve. "Ethereal, dreamlike" returns mush. "Backlit fog over wet
// obsidian, one lamp" returns a picture.
//
// ── AND THE ONE THAT KEEPS THE MATRIX REAL ─────────────────────────────
//
// Each axis speaks about ONE thing and never trespasses on another:
//
//     WORLD    what the image is made of
//     MOOD     light, atmosphere, contrast - never a place or a subject
//     ENERGY   composition and motion - never material, light or colour
//     PALETTE  colour, always against a ground
//
// Rich's test, 11 August: Glass x Storm, Architecture x Dream, Botanical x
// Eclipse and Cosmos x Midnight must all be independently sensible. They
// are, because no Mood names a place. The day a Mood says "at sea" the
// matrix stops being 8 x 6 and becomes a list of the combinations somebody
// happened to think of.
//
// Apply that test to every entry added later. It is cheap to run and the
// failure it catches is expensive.

export type WorldId =
  | 'cosmos' | 'ocean' | 'glass' | 'botanical'
  | 'liquid' | 'architecture' | 'light' | 'mineral'

export type MoodId =
  | 'dream' | 'storm' | 'twilight' | 'eclipse' | 'midnight' | 'inferno'

export type EnergyId =
  | 'stillness' | 'drift' | 'flow' | 'surge' | 'eruption'

export type PaletteId =
  | 'aurora' | 'ember' | 'deep_ocean' | 'ultraviolet' | 'solar' | 'neon_noir'
  | 'emerald' | 'opal' | 'inferno' | 'arctic' | 'midnight' | 'prismatic'

export interface Choice {
  world:   WorldId
  mood:    MoodId
  energy:  EnergyId
  palette: PaletteId
}

export interface Entry<T extends string> {
  id:    T
  label: string
  body:  string
}

// ── THE COMPOSITION BLOCK ──────────────────────────────────────────────
//
// Fixed. Rides every generation. Nobody chooses it and nobody sees it.
//
// THE LARGEST QUALITY LEVER IN THE PRODUCT, because it costs nothing per
// image and applies to all 2,880 combinations at once. Most wallpaper
// generators fail here rather than on style - they produce a tall picture
// instead of a wallpaper, and the difference is entirely in this block.
//
// It sits near the FRONT of the prompt. A four-step model weights early
// tokens heavily and composition is the thing that has to survive.
//
// THE TOP THIRD. Named as what goes there, never as what it is for. The
// photo-side wallpapers taught this the hard way: name the clock and the
// model draws a clock. So the instruction is "the upper region is open and
// unadorned" - never "leave room for the phone's clock".
//
// TEXT. Excluded explicitly because diffusion models put letterforms into
// things unprompted, and an image with garbled type on it cannot be sold.
//
// THREE PLANES. What stops a wallpaper reading as flat pattern, and the
// difference between an image that survives a home screen full of icons
// and one that turns to soup behind them.
export const COMPOSITION = [
  'Vertical 9:16 mobile wallpaper, full-bleed edge to edge composition.',
  'The upper region of the frame is open and unadorned — atmosphere,',
  'gradient falloff or empty depth, no detail and no focal point there.',
  'The principal subject sits in the lower two thirds, weighted below',
  'centre and placed off the vertical axis.',
  'Clear depth across three planes: near, middle and far.',
  'No text, no letterforms, no numerals, no signature, no watermark,',
  'no logo, no border and no frame.',
].join(' ')

// The base. What kind of object this is, before anything about it.
export const BASE =
  'A single striking abstract artwork made as a mobile phone wallpaper.'

// ── WORLDS · what the image is made of ─────────────────────────────────
// Rich, 11 August 2026.
export const WORLDS: Entry<WorldId>[] = [
  { id:'cosmos', label:'Cosmos', body:
    'Vast celestial forms, nebulae, star fields, cosmic dust, planetary ' +
    'curves, gravitational arcs and luminous interstellar structures.' },

  { id:'ocean', label:'Ocean', body:
    'Deep water, waves, currents, suspended droplets, foam, bubbles, ' +
    'translucent depths and fluid underwater forms.' },

  { id:'glass', label:'Glass', body:
    'Transparent and translucent glass, refraction, caustics, prisms, ' +
    'curved surfaces, crystalline edges, internal reflections and ' +
    'luminous optical depth.' },

  { id:'botanical', label:'Botanical', body:
    'Leaves, petals, vines, roots, branches, blossoms, seeds and intricate ' +
    'organic plant structures woven into layered compositions.' },

  { id:'liquid', label:'Liquid', body:
    'Flowing, suspended and colliding fluids; ribbons, droplets, splashes, ' +
    'folds, pools and smooth sculptural forms shaped by surface tension.' },

  { id:'architecture', label:'Architecture', body:
    'Arches, columns, vaults, stairs, towers, passages and monumental ' +
    'geometric structures arranged with dramatic scale and depth.' },

  { id:'light', label:'Light', body:
    'Beams, halos, luminous ribbons, glowing fields, volumetric rays, ' +
    'reflections and radiant forms constructed primarily from illumination.' },

  { id:'mineral', label:'Mineral', body:
    'Crystals, geodes, stone, metallic ore, fractured rock, polished ' +
    'mineral surfaces and intricate geological structures.' },
]

// ── MOODS · light, atmosphere and contrast. Never a place. ─────────────
//
// Each of these is a lighting instruction wearing a mood's name. That is
// what lets Storm land on glass as readily as on the sea: none of them
// names weather, water or a location, only what the light is doing.
export const MOODS: Entry<MoodId>[] = [
  { id:'dream', label:'Dream', body:
    'Soft diffused illumination, luminous haze, gentle tonal transitions, ' +
    'restrained contrast, subtle bloom and an ethereal atmospheric glow.' },

  { id:'storm', label:'Storm', body:
    'Hard raking light through broken darkness, sharp highlights, deep ' +
    'shadows, high contrast and dense moisture-filled atmosphere.' },

  { id:'twilight', label:'Twilight', body:
    'Low directional light, long soft shadows, subdued highlights, layered ' +
    'atmospheric haze and a gradual transition between luminous and dark ' +
    'values.' },

  { id:'eclipse', label:'Eclipse', body:
    'Strong backlighting, deep silhouettes, narrow brilliant rim light, ' +
    'extreme separation between darkness and radiance, with restrained ' +
    'atmospheric glow.' },

  { id:'midnight', label:'Midnight', body:
    'Predominantly deep values, sparse concentrated illumination, rich ' +
    'shadows, isolated highlights and quiet low-light atmosphere.' },

  { id:'inferno', label:'Inferno', body:
    'Intense internal illumination, brilliant hot highlights, deep ' +
    'surrounding shadows, glowing atmospheric haze and aggressive ' +
    'high-contrast luminosity.' },
]

// ── ENERGY · composition and motion only ───────────────────────────────
//
// Five named states rather than a numbered slider, because a slider
// position means nothing to a model and "drift" is a physical instruction.
//
// STILLNESS IS THE HARDER END AND THE MORE VALUABLE ONE. A generative
// model's default is to fill a frame, so restraint takes an explicit
// instruction - and somebody looks at a phone screen a hundred times a
// day, where spectacle wears out and quiet does not.
export const ENERGIES: Entry<EnergyId>[] = [
  { id:'stillness', label:'Stillness', body:
    'Centered, balanced composition with generous negative space, minimal ' +
    'directional movement, simple large forms and a strong sense of visual ' +
    'stability.' },

  { id:'drift', label:'Drift', body:
    'Gentle directional movement, softly displaced forms, subtle asymmetry ' +
    'and relaxed visual flow across the composition.' },

  { id:'flow', label:'Flow', body:
    'Continuous sweeping movement, interconnected forms, graceful curves ' +
    'and clear directional pathways carrying the eye through the ' +
    'composition.' },

  { id:'surge', label:'Surge', body:
    'Forceful directional movement, strong diagonals, overlapping forms, ' +
    'dynamic scale changes and pronounced visual momentum.' },

  { id:'eruption', label:'Eruption', body:
    'Explosive outward movement, fragmented forms, dramatic displacement, ' +
    'extreme scale variation and dense controlled complexity radiating ' +
    'through the composition.' },
]

// ── PALETTES · colour, always against a ground ─────────────────────────
//
// Rich, 11 August 2026. EVERY ONE NAMES A GROUND, which is what most
// palette lists miss - a colour is only itself against something, and a
// triad with nothing behind it renders as three colours at full
// saturation filling the frame.
//
// Note the limiting words: "tiny" on Deep Ocean, "restrained" on Arctic,
// "controlled" on Prismatic, "sparse" on Midnight. Each is a ceiling, and
// a palette without one comes back shouting. Keep the habit in any palette
// added later.
export const PALETTES: Entry<PaletteId>[] = [
  { id:'aurora', label:'Aurora', body:
    'Electric cyan, violet and emerald, luminous against midnight.' },

  { id:'ember', label:'Ember', body:
    'Molten orange, crimson and amber against charcoal.' },

  { id:'deep_ocean', label:'Deep Ocean', body:
    'Cobalt, teal and turquoise with tiny aqua highlights.' },

  { id:'ultraviolet', label:'Ultraviolet', body:
    'Saturated violet, magenta and electric blue against black.' },

  { id:'solar', label:'Solar', body:
    'Radiant gold, amber and warm ivory against deep bronze.' },

  { id:'neon_noir', label:'Neon Noir', body:
    'Hot magenta, cyan and violet against near-black.' },

  { id:'emerald', label:'Emerald', body:
    'Deep forest, emerald and jade with luminous chartreuse accents.' },

  { id:'opal', label:'Opal', body:
    'Pearl, lavender, pale cyan and blush with iridescent highlights.' },

  { id:'inferno', label:'Inferno', body:
    'Scarlet, vermilion and molten gold against black.' },

  { id:'arctic', label:'Arctic', body:
    'Ice blue, silver and white with restrained cobalt shadows.' },

  { id:'midnight', label:'Midnight', body:
    'Navy, indigo and black with sparse electric-blue illumination.' },

  { id:'prismatic', label:'Prismatic', body:
    'Controlled spectrum colour, rich refraction, luminous transitions.' },
]

// 8 x 6 x 5 x 12 = 2,880 combinations, before any variation.

// ── VARIATION ──────────────────────────────────────────────────────────
//
// Applied to the third image in a round. Not a style and not a filter -
// a different camera on the same idea, so a set reads as four ways of
// seeing one thing rather than four attempts at it.
const COMPOSITION_VARIANTS = [
  'Composed close, filling the frame, the subject cropped by the edges.',
  'Composed wide, the subject small against great depth.',
  'Composed low, looking upward, the forms rising through the frame.',
]

function pick<T>(list: T[], n: number): T {
  return list[Math.abs(n) % list.length]
}

function entry<T extends string>(list: Entry<T>[], id: T): Entry<T> | null {
  for (const e of list) if (e.id === id) return e
  return null
}

export function isValid(c: Partial<Choice>): c is Choice {
  return !!(c.world && entry(WORLDS, c.world) &&
            c.mood && entry(MOODS, c.mood) &&
            c.energy && entry(ENERGIES, c.energy) &&
            c.palette && entry(PALETTES, c.palette))
}

/**
 * One prompt from one set of choices.
 *
 * ORDER IS DELIBERATE, and it is not the order the customer chooses in.
 * Base and composition first, because a four-step model weights early
 * tokens and the wallpaper-ness has to survive. World next - it is what
 * the thing is made of. Then how it is lit, how it moves, and what colour
 * it is, which are all modifiers on a subject that already exists.
 */
export function buildPrompt(c: Choice, opts?: { variant?: number }): string {
  const w = entry(WORLDS, c.world)
  const m = entry(MOODS, c.mood)
  const e = entry(ENERGIES, c.energy)
  const p = entry(PALETTES, c.palette)
  if (!w || !m || !e || !p) throw new Error('studio: unknown vocabulary id')

  const parts = [BASE, COMPOSITION, w.body, m.body, e.body, p.body]

  if (opts && typeof opts.variant === 'number') {
    parts.push(pick(COMPOSITION_VARIANTS, opts.variant))
  }

  // Single spaces. A stray double space is harmless to the model and makes
  // two identical prompts compare unequal in a log.
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * THE FOUR IN A ROUND.
 *
 * NOT FOUR SEEDS ON ONE PROMPT. Four seeds returns four near-identical
 * images and the customer concludes the machine is stuck - the commonest
 * way a generator of this kind feels broken.
 *
 * So the four move along ONE axis, Energy, and the third takes a different
 * camera instead. Recognisably the same idea, visibly four pictures. It
 * costs nothing: the same four calls either way.
 *
 *     1  the chosen Energy
 *     2  one step calmer
 *     3  the chosen Energy, another composition
 *     4  one step wilder
 *
 * Bounded at the ends, so Stillness runs 1 · 1 · 2 · 3 rather than falling
 * off the list.
 */
export function buildRound(c: Choice): { prompt: string; energy: EnergyId }[] {
  const i = ENERGIES.findIndex(e => e.id === c.energy)
  if (i < 0) throw new Error('studio: unknown energy id')

  // AT THE ENDS THE SPREAD TURNS ROUND RATHER THAN CLAMPING.
  //
  // Clamping looked right and was not: at Stillness, "one calmer" is
  // Stillness again, so the round came back stillness / stillness /
  // stillness / drift - three near-identical images, which is precisely
  // the failure this function exists to prevent, arriving at the two
  // settings most likely to be chosen first.
  //
  // So the ends spread INWARD by two instead. Every round is four
  // different Energies-worth of picture regardless of where it started.
  const last = ENERGIES.length - 1
  const calmer = i === 0 ? i + 2 : i - 1
  const wilder = i === last ? i - 2 : i + 1

  const spread: { at: number; variant?: number }[] = [
    { at: i },
    { at: calmer },
    { at: i, variant: 1 },
    { at: wilder },
  ]

  return spread.map((s, n) => {
    const energy = ENERGIES[s.at].id
    return {
      energy,
      prompt: buildPrompt({ ...c, energy },
        s.variant === undefined ? undefined : { variant: s.variant + n }),
    }
  })
}

/** A legal combination, for SURPRISE ME. */
export function randomChoice(): Choice {
  const any = <T>(l: T[]) => l[Math.floor(Math.random() * l.length)]
  return {
    world:   any(WORLDS).id,
    mood:    any(MOODS).id,
    energy:  any(ENERGIES).id,
    palette: any(PALETTES).id,
  }
}

/**
 * REMIX. Six fixed nudges, appended to a built prompt. No prompt editor -
 * the absence of free text is also the absence of a moderation problem,
 * and four dropdowns cannot be talked into anything.
 */
export const REMIXES: { id: string; label: string; body: string }[] = [
  { id:'glassier', label:'More Glassy', body:
    'More refraction, caustics and transparent overlapping surfaces.' },
  { id:'organic', label:'More Organic', body:
    'More growth, branching and irregular natural structure.' },
  { id:'dramatic', label:'More Dramatic', body:
    'Deeper shadows, stronger highlights, greater contrast.' },
  { id:'simpler', label:'Simpler', body:
    'Fewer elements, larger forms, more empty ground.' },
  { id:'stranger', label:'Stranger', body:
    'Unexpected structure and impossible geometry.' },
  { id:'colour', label:'Change Colours', body: '' },   // re-rolls the palette
]

export function remix(base: string, id: string): string {
  const r = REMIXES.find(x => x.id === id)
  if (!r || !r.body) return base
  return (base + ' ' + r.body).replace(/\s+/g, ' ').trim()
}
