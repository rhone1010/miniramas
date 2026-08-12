// lib/v1/wallpapers/studio-halloween.ts
//
// THE HALLOWEEN VOCABULARY.
//
// A season is a vocabulary, not a product. The same four axes, the same
// builder, different words - which is why Christmas in November is one more
// file rather than one more thing to build and maintain.
//
// Rich, 11 August 2026.
//
// ── THE NEGATIONS WERE CUT ─────────────────────────────────────────────
//
// The authored entries each ended with a corrective clause: "rather than
// conventional white-sheet ghosts", "no modern satanic imagery", "never
// dependent on gore". The intent is right and the mechanism is wrong.
//
// flux-schnell has no negative-prompt channel. Everything in the string is
// a positive instruction, so "rather than white-sheet ghosts" arrives as
// the noun "white-sheet ghosts" and the model draws one. The word "rather"
// is not something four denoising steps can act on.
//
// So the closing clauses are gone and the positive description carries the
// weight. Where a negation was doing real work - keeping Infernal away from
// gore - it has been rewritten as a positive: "ancient, powerful and
// visually magnificent".
//
// SAME RULE FOR ANY ENTRY ADDED LATER. If a body needs to say what
// something is not, it is not finished.
//
// ── AND THE AXES STILL DO NOT TRESPASS ─────────────────────────────────
//
//     WORLD    what the image is made of
//     MOOD     light, atmosphere, contrast - never a subject
//     ENERGY   composition and motion - shared with the general Studio
//     PALETTE  colour, always against a ground
//     TWIST    one compositional idea, hidden from the customer
//
// Rich's independence test still applies: Gothic x Majestic and Spectral x
// Ominous must each be sensible without knowing the other axis. They are,
// because no Mood names a place.

import type { Entry, EnergyId } from './studio-prompt'

export type HwWorldId =
  | 'haunted' | 'spectral' | 'infernal' | 'harvest'
  | 'occult' | 'gothic' | 'nightmare' | 'otherworld'

export type HwMoodId =
  | 'bewitched' | 'haunting' | 'ominous'
  | 'macabre' | 'nightmarish' | 'majestic'

export type HwPaletteId =
  | 'blood_moon' | 'pumpkin_fire' | 'witchlight' | 'ghostlight' | 'poison'
  | 'midnight' | 'dead_forest' | 'gothic_jewel' | 'eclipse' | 'phantom_rose'

export type TwistId =
  | 'impossible_scale' | 'living_architecture' | 'beautiful_decay'
  | 'hidden_presence' | 'material_transformation' | 'unnatural_light'
  | 'ancient_monument' | 'endless_depth' | 'emerging_form'
  | 'impossible_weather' | 'organic_geometry' | 'something_watching'

export interface HwChoice {
  world:   HwWorldId
  mood:    HwMoodId
  energy:  EnergyId
  palette: HwPaletteId
}

// ── WORLDS · territories, not object lists ─────────────────────────────
export const HW_WORLDS: Entry<HwWorldId>[] = [
  { id:'haunted', label:'Haunted', body:
    'A vast supernatural environment of impossible haunted mansions, ruined ' +
    'castles, forgotten estates and ancient graveyards. Architecture feels ' +
    'alive and subtly wrong: impossible corridors, leaning towers, ' +
    'illuminated windows, monumental gates and structures disappearing into ' +
    'fog. Unseen inhabitants are suggested through distant lights, ' +
    'silhouettes and movement. Elegant gothic horror.' },

  { id:'spectral', label:'Spectral', body:
    'A world suspended between physical reality and the spirit realm. ' +
    'Translucent apparitions, spectral architecture, luminous mist and ' +
    'enormous ghostly forms emerge from darkness, clouds, water and ' +
    'landscape. Solid objects dissolve into ethereal material and re-form ' +
    'elsewhere. Haunting, beautiful and otherworldly.' },

  { id:'infernal', label:'Infernal', body:
    'An immense mythic underworld of obsidian formations, volcanic chasms, ' +
    'ruined citadels and monumental demonic architecture. Molten light glows ' +
    'through cracks in black stone while smoke, embers and enormous shadowy ' +
    'entities occupy impossible distances. Ancient, powerful and visually ' +
    'magnificent.' },

  { id:'harvest', label:'Harvest', body:
    'An enchanted late-autumn world overtaken by twisted vines, enormous ' +
    'pumpkins, ancient orchards, cornfields, wheat, gnarled wood and strange ' +
    'harvest monuments. Natural forms grow into impossible structures and ' +
    'creatures beneath enormous autumn moons. Rich, tactile and slightly ' +
    'threatening, balancing folk-horror mystery with spectacular seasonal ' +
    'beauty.' },

  { id:'occult', label:'Occult', body:
    'An ancient world shaped by mysterious forbidden rituals: monumental ' +
    'circles, floating relics, candles, arcane geometry, strange altars, ' +
    'suspended objects and luminous symbols embedded into architecture and ' +
    'landscape. Invisible forces distort light, gravity and space. ' +
    'Sophisticated supernatural mystery.' },

  { id:'gothic', label:'Gothic', body:
    'A monumental dark-romantic world of cathedrals, gargoyles, ruined ' +
    'abbeys, ironwork, ancient stone, enormous windows and impossible ' +
    'vertical architecture. Structures rise dramatically through mist and ' +
    'darkness, illuminated by moonlight, candles and supernatural glow. ' +
    'Ornate, decaying and breathtaking, beauty and menace in equal measure.' },

  { id:'nightmare', label:'Nightmare', body:
    'A surreal dream-world where familiar reality has become beautifully ' +
    'impossible. Landscapes bend, structures grow organically, enormous ' +
    'mysterious creatures appear at impossible scale and ordinary objects ' +
    'transform into unsettling forms. Dream logic replaces physics. Strange ' +
    'and psychologically eerie, and visually beautiful.' },

  { id:'otherworld', label:'Otherworld', body:
    'An immense supernatural realm beneath impossible moons, eclipses and ' +
    'unfamiliar skies. Floating landscapes, colossal celestial bodies, ' +
    'ancient structures, luminous atmospheric phenomena and mysterious ' +
    'distant forms create overwhelming scale. Halloween imagery appears as ' +
    'if discovered in an alien mythology.' },
]

// ── MOODS · light and treatment. Never a subject. ──────────────────────
//
// MAJESTIC is the one that earns the room its place. Without it every
// Halloween wallpaper is horror, and horror on a lock screen wears out in a
// week - somebody looks at their phone a hundred times a day. Majestic is
// what makes a piece from this room worth keeping into November.
export const HW_MOODS: Entry<HwMoodId>[] = [
  { id:'bewitched', label:'Bewitched', body:
    'Seductive supernatural illumination, luminous haze and mysterious ' +
    'coloured light. Shadows remain soft and dimensional while magical ' +
    'highlights appear unexpectedly throughout the scene. Enchanting, ' +
    'mysterious and beautiful, with a subtle sense that something impossible ' +
    'is happening.' },

  { id:'haunting', label:'Haunting', body:
    'Quiet, melancholy and deeply atmospheric. Diffused moonlight, pale ' +
    'illumination, long shadows, drifting fog and restrained contrast create ' +
    'the feeling of a place inhabited by memories or unseen presences. ' +
    'Beautiful first, unsettling second.' },

  { id:'ominous', label:'Ominous', body:
    'Heavy darkness, approaching weather, deep directional shadows and ' +
    'isolated pools of illumination create mounting tension. The composition ' +
    'suggests that something enormous is about to happen without revealing ' +
    'exactly what it is.' },

  { id:'macabre', label:'Macabre', body:
    'Elegant darkness with stronger mortality and decay: aged surfaces, ' +
    'skeletal forms, dead vegetation, ruined grandeur and stark chiaroscuro. ' +
    'Sophisticated gothic beauty, disturbing details used sparingly against ' +
    'richly rendered darkness.' },

  { id:'nightmarish', label:'Nightmarish', body:
    'Unnatural lighting, extreme scale, distorted depth and impossible ' +
    'shadows make the scene feel like a vivid nightmare. Familiar forms ' +
    'become subtly wrong and visual logic begins to break down. Intensely ' +
    'unsettling and surreal, sophisticated and visually spectacular.' },

  { id:'majestic', label:'Majestic', body:
    'Grand cinematic illumination, monumental scale, deep dimensional ' +
    'contrast and radiant focal light. Darkness frames moments of ' +
    'extraordinary beauty and power. The scene inspires awe as much as fear, ' +
    'treating Halloween fantasy with the visual grandeur of an epic myth.' },
]

// ── PALETTES · ten, and deliberately not ten shades of orange ──────────
//
// Rich's discipline, 11 August: "visually distinct, not six variations of
// orange/red darkness." Ghostlight, Poison, Gothic Jewel and Phantom Rose
// are what stop this room looking like every other Halloween product.
//
// Each names a ground. A colour is only itself against something.
export const HW_PALETTES: Entry<HwPaletteId>[] = [
  { id:'blood_moon', label:'Blood Moon', body:
    'Blood red, crimson and burnt orange against black.' },

  { id:'pumpkin_fire', label:'Pumpkin Fire', body:
    'Pumpkin orange, amber and copper against deep umber.' },

  { id:'witchlight', label:'Witchlight', body:
    'Violet, ultraviolet and magenta against black.' },

  { id:'ghostlight', label:'Ghostlight', body:
    'Spectral cyan, pale aqua and icy white against midnight blue.' },

  { id:'poison', label:'Poison', body:
    'Acid green, emerald and chartreuse against black.' },

  { id:'midnight', label:'Midnight', body:
    'Midnight blue, indigo and moon silver against near-black.' },

  { id:'dead_forest', label:'Dead Forest', body:
    'Umber, moss green and rust against smoky black.' },

  { id:'gothic_jewel', label:'Gothic Jewel', body:
    'Garnet, emerald, sapphire and amethyst with antique gold.' },

  { id:'eclipse', label:'Eclipse', body:
    'Charcoal and black with burning gold and solar orange.' },

  { id:'phantom_rose', label:'Phantom Rose', body:
    'Spectral lavender, dusty rose and pale moonlight against smoky violet.' },
]

// ── TWIST · the hidden axis ────────────────────────────────────────────
//
// THE MOST IMPORTANT THING IN THIS FILE, and the customer never sees it.
//
// Without it, the same four choices return the same picture and the fifth
// press feels exhausted - the failure that kills every generator of this
// kind. Twelve twists over 8 x 6 x 5 x 10 means the fifth press is still a
// surprise.
//
// It is one compositional IDEA rather than a subject or a style, so it
// combines with any world without arguing with it. Gothic + Majestic +
// Stillness + Ghostlight + Living Architecture might give a cathedral whose
// towers form the silhouette of a sleeping creature; the same four choices
// with Hidden Presence gives an apparition barely perceptible inside the
// same cathedral.
//
// Rolled per image, not per round - so the four in a round differ by twist
// as well as by energy.
export const TWISTS: Entry<TwistId>[] = [
  { id:'impossible_scale', label:'Impossible Scale', body:
    'One element is vastly larger than it could be, dwarfing everything ' +
    'around it.' },

  { id:'living_architecture', label:'Living Architecture', body:
    'Built structures behave like a creature: breathing, watching, reaching, ' +
    'or forming a silhouette that is almost a body.' },

  { id:'beautiful_decay', label:'Beautiful Decay', body:
    'Ruin rendered as splendour: collapse, erosion and overgrowth arranged ' +
    'into something lovelier than the intact thing was.' },

  { id:'hidden_presence', label:'Hidden Presence', body:
    'Something enormous is barely perceptible within the scene, read only ' +
    'as a shape in the mist, the stone or the shadow.' },

  { id:'material_transformation', label:'Material Transformation', body:
    'One substance becomes another mid-form: stone into smoke, water into ' +
    'glass, cloth into flame.' },

  { id:'unnatural_light', label:'Unnatural Light', body:
    'Light behaves impossibly: falling upward, casting the wrong shadow, ' +
    'glowing from within a solid, or illuminating only one thing.' },

  { id:'ancient_monument', label:'Ancient Monument', body:
    'A single colossal made object dominates, older than anything around it ' +
    'and built for a purpose nobody remembers.' },

  { id:'endless_depth', label:'Endless Depth', body:
    'The scene recedes far past where it should end, plane behind plane into ' +
    'immeasurable distance.' },

  { id:'emerging_form', label:'Emerging Form', body:
    'A shape is resolving out of the environment itself, half-formed and ' +
    'still becoming.' },

  { id:'impossible_weather', label:'Impossible Weather', body:
    'The atmosphere does something it could not: falling upward, standing ' +
    'still, burning, or moving as one body.' },

  { id:'organic_geometry', label:'Organic Geometry', body:
    'Living forms arranged into exact geometry, or geometry grown the way a ' +
    'plant grows.' },

  { id:'something_watching', label:'Something Watching', body:
    'The composition is arranged around an unseen observer, and the scene ' +
    'knows it is being looked at.' },
]

// ── THE BUILDER ────────────────────────────────────────────────────────
//
// Same order as the general Studio and for the same reason: base and
// composition first, because a four-step model weights early tokens and the
// wallpaper-ness has to survive.
//
// THE COMPOSITION BLOCK IS SHARED, not rewritten. It is the largest quality
// lever in either room, it costs nothing per image, and two copies would
// drift the first time one was improved.

export const HW_BASE =
  'A single striking Halloween artwork made as a mobile phone wallpaper. ' +
  'One extraordinary focal idea, composed as a scene rather than an ' +
  'arrangement of seasonal objects.'

function entry<T extends string>(list: Entry<T>[], id: T): Entry<T> | null {
  for (const e of list) if (e.id === id) return e
  return null
}

export function randomTwist(): Entry<TwistId> {
  return TWISTS[Math.floor(Math.random() * TWISTS.length)]
}

export function isHwValid(c: Partial<HwChoice>): c is HwChoice {
  return !!(c.world && entry(HW_WORLDS, c.world) &&
            c.mood && entry(HW_MOODS, c.mood) &&
            c.palette && entry(HW_PALETTES, c.palette) &&
            c.energy)
}
