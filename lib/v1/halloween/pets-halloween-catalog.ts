// lib/v1/halloween/pets-halloween-catalog.ts
//
// PETS HALLOWEEN ON LITENCO MAIN - 27 effects, 1:1.
//
// ── A COPY, LIKE THE HUMAN 28 ──────────────────────────────────────────
//
// Source is lib/v1/wallpapers/wallpapers-pets-halloween.ts, which is NOT
// imported. Both rooms ship. Rich's ruling of 20 August: duplicate and edit
// to suit, so a change here cannot move the wallpaper room.
//
// ── NOTHING WAS EDITED ─────────────────────────────────────────────────
//
// The human 28 needed surgery: twelve of them carried phone framing in nine
// phrasings, buried mid-paragraph. These twenty-seven carry NONE. Checked
// body by body on 21 August against upper 1/3, lower 2/3, mobile wallpaper,
// phone and 9:16 - zero hits in twenty-seven bodies.
//
// So this is a verbatim copy. Rich's text, his capitalisation, his line
// breaks, unchanged.
//
// The file header on the wallpaper original says every body ends with an
// exclusion clause. It does not describe the bodies underneath it. Read the
// bodies, not the header - which is the whole reason the human room lost a
// day.
//
// ── NO FRAMING CONSTANT, DELIBERATELY ──────────────────────────────────
//
// The human room appends HALLOWEEN_MAIN_FRAMING - chest to the top of the
// head. This room appends NOTHING.
//
// Rich, 21 August: pets Halloween is working without constraints, so keep
// it that way. These bodies already stage themselves - charging through a
// dying field, surging through a ruined cemetery - and each carries its own
// distance, its own action and its own background. A framing sentence
// appended after a body is the later instruction on the same axis and the
// later one wins, which means one constant would flatten twenty-seven
// different stagings into one.
//
// It is also NOT the Pets main rule. That room puts the animal's head at
// 20% of frame height for a print of a specific pet. These are creatures in
// a scene, and the scene is most of the picture.
//
// If a framing constant is ever wanted here, it is one export and one line
// in buildPetsHalloweenPrompt - written that way on purpose.
//
// ── ASPECT ─────────────────────────────────────────────────────────────
//
// MAIN_ASPECT, from lib/v1/shared/render-aspect.ts, passed to NB2 as a
// parameter. No body carries an aspect.
//
// ── PLATES: THERE ARE NONE ─────────────────────────────────────────────
//
// The only pet Halloween plates that exist are 9:16, in
// public/previews/wallpapers/halloween-pets/, named <id minus pethw_>.jpeg
// - note the extension, they were shot as .jpeg while the rest of the repo
// uses .jpg.
//
// NO SQUARE PLATES EXIST. There is deliberately no platePath helper in this
// file, because writing one would mean inventing a folder nobody has shot
// into. The room cannot show a grid until they are shot, and whether they
// are shot or the room launches on the wallpaper plates is Rich's open
// decision.
//
// ── THE PREFIX STAYS ───────────────────────────────────────────────────
//
// Every id keeps pethw_. The ids are unchanged from the wallpaper room so
// the two catalogs stay traceable to each other, and the prefix keeps them
// from ever colliding with the human 28 if the two are merged for a grid.

export interface PetsHalloweenEffect {
  id:     string
  label:  string
  body:   string
  avoid?: string
}

export const PETS_HALLOWEEN_MAIN: Record<string, PetsHalloweenEffect> = {
  pethw_harvest_god_beast: {
    id:    'pethw_harvest_god_beast',
    label: "Harvest God's Beast",
    body: `Transform this pet into an epic-level dark fantasy creature of the Harvest God while preserving unmistakable likeness. Radically transform its skin, scales, feathers, hair or fur with gnarled roots, black thorns, dead wheat and ember-lit fissures. Show it charging through a dying field as the colossal Harvest God emerges through storm and fog behind it. Cinematic dark folklore.`,
  },

  pethw_graveyard_guardian: {
    id:    'pethw_graveyard_guardian',
    label: 'Graveyard Guardian',
    body: `Transform this pet into an epic-level supernatural guardian of the dead while preserving unmistakable likeness. Dramatically transform its anatomy and surface with ancient bone-like growths, spectral veins, weathered textures and mismatched luminous eyes. Show it surging through a ruined cemetery as ghostly creatures rise from the fog around it. Moonlight, mausoleums and twisted trees.`,
  },

  pethw_hellborn_beast: {
    id:    'pethw_hellborn_beast',
    label: 'Hellborn Beast',
    body: `Transform this pet into an epic-level infernal creature while preserving unmistakable likeness. Radically transform its body with charred skin, scales, feathers or fur, obsidian growths, horns and molten fissures glowing beneath the surface. Capture it lunging powerfully forward as the ground erupts beneath it. A monumental gateway to the underworld burns in the distance.`,
  },

  pethw_blood_moon_beast: {
    id:    'pethw_blood_moon_beast',
    label: 'Blood Moon Beast',
    body: `Transform this pet into an epic-level creature awakened by the Blood Moon while preserving unmistakable likeness. Make its anatomy larger and supernatural, with wild transformed textures, crimson veins, dark organic armor and glowing eyes. Capture it in a dramatic species-appropriate cry, rear, leap or threat display beneath an enormous blood-red moon, surrounded by ruined gothic countryside.`,
  },

  pethw_storm_wraith: {
    id:    'pethw_storm_wraith',
    label: 'Storm Wraith',
    body: `Transform this pet into an epic-level supernatural storm creature while preserving unmistakable likeness. Radically transform its skin, scales, feathers, hair or fur with electrically charged textures, luminous fissures and storm energy flowing through its body. Capture it in powerful motion as lightning strikes around it on a windswept mountain ridge, with a vast supernatural storm gathering behind.`,
  },

  pethw_banshee_familiar: {
    id:    'pethw_banshee_familiar',
    label: "Banshee's Familiar",
    body: `Transform this pet into an epic-level spectral creature while preserving unmistakable likeness. Transform its skin, scales, feathers, hair or fur into flowing ghostlike textures with pale luminous energy beneath. Capture it making a dramatic species-appropriate cry or display as a towering banshee materializes from swirling mist behind it. Ancient Celtic ruins and windswept moors.`,
  },

  pethw_thorn_king_beast: {
    id:    'pethw_thorn_king_beast',
    label: "Thorn King's Beast",
    body: `Transform this pet into the legendary creature of the Thorn King while preserving unmistakable likeness. Radically transform its body with living black thorns, twisted wood, bark, vines and deep crimson light glowing between organic layers. Show it violently breaking through an enormous wall of thorns as the gigantic thorn-crowned king appears through the forest fog.`,
  },

  pethw_drowned_revenant: {
    id:    'pethw_drowned_revenant',
    label: 'Drowned Revenant',
    body: `Transform this pet into an epic-level creature risen from a drowned world while preserving unmistakable likeness. Transform its natural surface with spectral wet textures, dark aquatic growth, seaweed, shells and eerie blue-green light beneath the body. Capture it bursting from black water among submerged gravestones as a ruined church rises from the stormy sea behind it.`,
  },

  pethw_witch_familiar: {
    id:    'pethw_witch_familiar',
    label: "Witch's Familiar",
    body: `Transform this pet into an extraordinary dark magical familiar while preserving unmistakable likeness. Radically transform its skin, scales, feathers, hair or fur with smoke, black crystalline growths, magical markings and strange internal light. Capture it leaping, rearing, spreading its wings or striking dramatically through a glowing ritual circle as objects and candles rise around it. Ancient witch's sanctuary deep in the forest.`,
  },

  pethw_shadow_beast: {
    id:    'pethw_shadow_beast',
    label: 'Shadow Beast',
    body: `Transform this pet into an epic-level creature made partly from living darkness while preserving unmistakable likeness. Portions of its body dissolve into black supernatural smoke filled with faint eyes, tendrils and violet energy. Capture it emerging explosively from shadow into moonlight in a powerful species-appropriate movement. Abandoned gothic streets and towering architecture disappear into darkness behind it.`,
  },

  pethw_plague_beast: {
    id:    'pethw_plague_beast',
    label: 'Plague Beast',
    body: `Transform this pet into an epic-level creature of plague while preserving unmistakable likeness. Transform its skin, scales, feathers, hair or fur with ancient decay, strange fungal growths, smoky textures and sickly supernatural light. Capture it stalking aggressively through an abandoned medieval village as ravens explode into flight and a towering plague doctor appears through the haze.`,
  },

  pethw_frost_wraith: {
    id:    'pethw_frost_wraith',
    label: 'Frost Wraith',
    body: `Transform this pet into an epic-level frozen supernatural creature while preserving unmistakable likeness. Radically transform its natural surface with frost, translucent ice, crystalline growths and luminous blue fissures. Capture it racing, flying, rearing or striking through a violent blizzard as the ground and surrounding landscape freeze outward from it. Ancient frozen ruins loom through the storm.`,
  },

  pethw_bone_collector_beast: {
    id:    'pethw_bone_collector_beast',
    label: "Bone Collector's Beast",
    body: `Transform this pet into the supernatural companion of the Bone Collector while preserving unmistakable likeness. Radically transform its body with elaborate ivory growths, ancient bone armor, weathered natural textures and eerie internal light. Capture it tearing through an ancient burial ground as bones, earth and dust erupt around it. A colossal cloaked Bone Collector approaches through graveyard fog.`,
  },

  pethw_swamp_revenant: {
    id:    'pethw_swamp_revenant',
    label: 'Swamp Revenant',
    body: `Transform this pet into an epic-level creature resurrected by a cursed swamp while preserving unmistakable likeness. Merge its skin, scales, feathers, hair or fur with wet bark, moss, roots, reeds and eerie swamp light. Capture it exploding from black water in a powerful species-appropriate action, sending water and vegetation outward. Dead cypress trees and a ruined mansion disappear into green-black mist.`,
  },

  pethw_raven_lord_familiar: {
    id:    'pethw_raven_lord_familiar',
    label: "Raven Lord's Familiar",
    body: `Transform this pet into the epic supernatural familiar of the Raven Lord while preserving unmistakable likeness. Transform its natural surface with black feathers, obsidian growths, smoky darkness and luminous violet eyes. Capture it launching, leaping, rearing or striking forward as hundreds of ravens erupt around it. A gigantic ruined castle and the shadowy Raven Lord emerge through a violent storm behind.`,
  },

  pethw_demon_familiar: {
    id:    'pethw_demon_familiar',
    label: "Demon's Familiar",
    body: `Transform this pet into an epic-level demonic creature while preserving unmistakable likeness. Radically transform its anatomy and surface with scorched textures, horn-like growths, blackened armor and infernal light glowing beneath the skin, scales, feathers, hair or fur. Capture it breaking free from enormous ancient chains as a colossal demon emerges through fire and smoke behind it.`,
  },

  pethw_ancient_crypt_beast: {
    id:    'pethw_ancient_crypt_beast',
    label: 'Ancient Crypt Beast',
    body: `Transform this pet into an epic-level creature awakened after centuries beneath an ancient crypt while preserving unmistakable likeness. Transform its body with weathered stone-like textures, supernatural bone growths, luminous cracks and remnants of ancient burial ornament. Capture it bursting through massive crypt doors as stone and dust explode outward. A vast underground cathedral lies behind it.`,
  },

  pethw_headless_horseman_familiar: {
    id:    'pethw_headless_horseman_familiar',
    label: "Headless Horseman's Familiar",
    body: `Transform this pet into the supernatural companion of the Headless Horseman while preserving unmistakable likeness. Transform its natural form with blackened textures, ember-lit fissures, spectral edges and ancient armor fused organically into its body. Capture it racing at full speed through a moonlit autumn forest alongside the charging Headless Horseman, earth and leaves exploding around them.`,
  },

  pethw_nightmare_creature: {
    id:    'pethw_nightmare_creature',
    label: 'Nightmare Creature',
    body: `Transform this pet into an epic-level creature born from a nightmare while preserving unmistakable likeness. Radically distort and enhance its natural anatomy with elongated supernatural forms, shifting dark textures, strange luminous eyes and shadowy growths while keeping the original animal recognizable. Capture it emerging dynamically through a fractured dreamscape where architecture bends impossibly around it.`,
  },

  pethw_spirit_caller: {
    id:    'pethw_spirit_caller',
    label: 'Spirit Caller',
    body: `Transform this pet into an epic-level supernatural creature capable of summoning the dead while preserving unmistakable likeness. Transform its skin, scales, feathers, hair or fur with glowing ancient symbols, spectral energy and intricate supernatural textures. Capture it performing a powerful species-appropriate cry, display or movement as dozens of animal spirits spiral upward around it from an ancient ritual ground.`,
  },

  pethw_the_soul_eater: {
    id:    'pethw_the_soul_eater',
    label: 'The Soul Eater',
    body: `Transform this pet into an epic-level creature that feeds on wandering spirits while preserving unmistakable likeness. Transform its natural anatomy with translucent supernatural layers, glowing veins, dark crystalline growths and ghostly energy flowing through its body. Capture it drawing swirling spirits toward itself in a violent supernatural vortex among ancient ruins.`,
  },

  pethw_spider_queen_familiar: {
    id:    'pethw_spider_queen_familiar',
    label: "Spider Queen's Familiar",
    body: `Transform this pet into the epic familiar of an ancient Spider Queen while preserving unmistakable likeness. Radically transform its skin, scales, feathers, hair or fur with intricate black chitin, silken textures, subtle additional supernatural structures and luminous markings. Capture it tearing free from enormous webs inside a ruined cathedral as the colossal Spider Queen emerges from darkness behind it.`,
  },

  pethw_the_possessed: {
    id:    'pethw_the_possessed',
    label: 'The Possessed',
    body: `Transform this pet into an epic-level possessed creature while preserving unmistakable likeness. Its familiar body is overtaken by an ancient supernatural force, creating distorted textures, glowing cracks, levitating hair, fur, feathers or scales and brilliant unnatural eyes. Capture it rising or arching dramatically as furniture, debris and dust lift around it inside an abandoned Victorian house.`,
  },

  pethw_gargoyle_beast: {
    id:    'pethw_gargoyle_beast',
    label: 'Gargoyle Beast',
    body: `Transform this pet into an epic living gargoyle while preserving unmistakable likeness. Merge its natural anatomy with cracked ancient stone, weathered sculptural details, monstrous growths and supernatural light glowing through deep fractures. Capture it awakening violently atop a Gothic cathedral as pieces of stone break away and rain lashes the rooftops below.`,
  },

  pethw_phantom_of_the_forest: {
    id:    'pethw_phantom_of_the_forest',
    label: 'Phantom of the Forest',
    body: `Transform this pet into an epic ancient forest spirit while preserving unmistakable likeness. Transform its body with ghostly bark, luminous moss, twisted roots, fungi and translucent supernatural growths. Capture it emerging powerfully from an enormous hollow tree as the surrounding forest bends and awakens around it. Strange lights and distant spectral creatures fill the mist.`,
  },

  pethw_vampire_familiar: {
    id:    'pethw_vampire_familiar',
    label: "The Vampire's Familiar",
    body: `Transform this pet into the magnificent supernatural familiar of an ancient vampire while preserving unmistakable likeness. Transform its anatomy with elegant predatory proportions, midnight textures, subtle crimson veins and luminous blood-red eyes. Capture it launching dramatically from the steps of a vast ruined castle as bats erupt around it and its vampire master watches from the doorway.`,
  },

  pethw_death_companion: {
    id:    'pethw_death_companion',
    label: "Death's Companion",
    body: `Transform this pet into the legendary supernatural companion of Death while preserving unmistakable likeness. Radically transform its natural surface with ash, spectral darkness, ancient silver textures and pale otherworldly light flowing through its body. Capture it moving powerfully across a dead landscape beside the towering figure of Death as spirits rise from the earth around them. Epic, haunting and beautiful.`,
  },
}

export const PETS_HALLOWEEN_MAIN_ORDER: string[] = Object.keys(PETS_HALLOWEEN_MAIN)

/**
 * The body, verbatim. Nothing is appended: no framing, no phone clause, no
 * aspect, no plaque.
 *
 * Contrast buildHalloweenPrompt in halloween-catalog.ts, which appends the
 * chest-to-head constant. The asymmetry is the point and is Rich's call.
 */
export function buildPetsHalloweenPrompt(id: string): string {
  const fx = PETS_HALLOWEEN_MAIN[id]
  if (!fx) throw new Error(`[pets-halloween] unknown effect id: ${id}`)
  return fx.avoid ? `${fx.body.trim()}\n${fx.avoid}` : fx.body.trim()
}

export function isPetsHalloweenEffect(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(PETS_HALLOWEEN_MAIN, id)
}
