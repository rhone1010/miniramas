// lib/v1/wallpapers/wallpapers-pets-halloween.ts
//
// PETS HALLOWEEN — 20 wallpaper effects, 9:16, download only.
//
// Rich's text, verbatim, from Halloween_Pet_Transformation_Prompts.docx,
// locked 2026-08-11. Nothing here was tidied, compressed or reconciled
// against any other room's conventions.
//
// ── THIS IS A SEPARATE ROOM FROM THE HUMAN HALLOWEEN 28 ────────────────
//
// Both carry silo 'halloween', because Halloween is a season rather than a
// room and it holds the photo effects, the pets and the Studio. But these
// twenty are a different register from the human catalog and from the pet
// COSTUME set Rich is still writing: those are cute — pumpkin caps, tiny
// capes, a broom — and these are epic dark fantasy creatures.
//
// A grid mixing the two would read as a mistake rather than as range. The
// ids are prefixed `pethw_` so the glass can separate them without
// consulting a list.
//
// ── FRAMING IS RICH'S, AND IT IS NOT THE HUMAN ROOM'S ──────────────────
//
// Every body here ends with "Exclude the subject from the upper 1/3 of the
// image. This is a mobile wallpaper." The human Halloween room says "Keep
// subject in lower 2/3 of image to allow for phone UI elements."
//
// Same intent, different words, and the words are not interchangeable —
// they were tuned against different renders. Do not normalise one to the
// other.
//
// The 20-30% face rule that governs the standard Pets wallpaper room is
// deliberately NOT here. These bodies put the animal in wide action —
// charging a dying field, racing beside the Horseman, bursting from black
// water — and the epic framing is the effect. Rich ruled the room locked
// as written.
//
// ── LIKENESS ───────────────────────────────────────────────────────────
//
// Every one of the twenty says "preserving unmistakable likeness", which is
// more consistent than the human Halloween room manages — that one has
// three different scales in play. If a single lever is ever settled on
// across the product, this room is the one already speaking with one voice.
//
// ── SPECIES ────────────────────────────────────────────────────────────
//
// The bodies name "skin, scales, feathers, hair or fur" rather than
// branching on species, and ask for "species-appropriate" action rather
// than naming a movement. That is the Pets rule working as intended: it
// lets NB2 choose, which is how a macaw got a waistcoat around its wings
// instead of a dog's.

import type { WallpaperEffect } from './wallpapers-shared'

export const PETS_HALLOWEEN_WALLPAPERS: Record<string, WallpaperEffect> = {

  pethw_harvest_gods_beast: {
    id:    'pethw_harvest_gods_beast',
    label: "Harvest God's Beast",
    silo:  'halloween',
    body: `Transform this pet into an epic-level dark fantasy creature of the Harvest God while preserving unmistakable likeness. Radically transform its skin, scales, feathers, hair or fur with gnarled roots, black thorns, dead wheat and ember-lit fissures. Show it charging through a dying field as the colossal Harvest God emerges through storm and fog behind it. Cinematic dark folklore. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_graveyard_guardian: {
    id:    'pethw_graveyard_guardian',
    label: 'Graveyard Guardian',
    silo:  'halloween',
    body: `Transform this pet into an epic-level supernatural guardian of the dead while preserving unmistakable likeness. Dramatically transform its anatomy and surface with ancient bone-like growths, spectral veins, weathered textures and mismatched luminous eyes. Show it surging through a ruined cemetery as ghostly creatures rise from the fog around it. Moonlight, mausoleums and twisted trees. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_hellborn_beast: {
    id:    'pethw_hellborn_beast',
    label: 'Hellborn Beast',
    silo:  'halloween',
    body: `Transform this pet into an epic-level infernal creature while preserving unmistakable likeness. Radically transform its body with charred skin, scales, feathers or fur, obsidian growths, horns and molten fissures glowing beneath the surface. Capture it lunging powerfully forward as the ground erupts beneath it. A monumental gateway to the underworld burns in the distance. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_blood_moon_beast: {
    id:    'pethw_blood_moon_beast',
    label: 'Blood Moon Beast',
    silo:  'halloween',
    body: `Transform this pet into an epic-level creature awakened by the Blood Moon while preserving unmistakable likeness. Make its anatomy larger and supernatural, with wild transformed textures, crimson veins, dark organic armor and glowing eyes. Capture it in a dramatic species-appropriate cry, rear, leap or threat display beneath an enormous blood-red moon, surrounded by ruined gothic countryside. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_storm_wraith: {
    id:    'pethw_storm_wraith',
    label: 'Storm Wraith',
    silo:  'halloween',
    body: `Transform this pet into an epic-level supernatural storm creature while preserving unmistakable likeness. Radically transform its skin, scales, feathers, hair or fur with electrically charged textures, luminous fissures and storm energy flowing through its body. Capture it in powerful motion as lightning strikes around it on a windswept mountain ridge, with a vast supernatural storm gathering behind. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_banshees_familiar: {
    id:    'pethw_banshees_familiar',
    label: "Banshee's Familiar",
    silo:  'halloween',
    body: `Transform this pet into an epic-level spectral creature while preserving unmistakable likeness. Transform its skin, scales, feathers, hair or fur into flowing ghostlike textures with pale luminous energy beneath. Capture it making a dramatic species-appropriate cry or display as a towering banshee materializes from swirling mist behind it. Ancient Celtic ruins and windswept moors. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_thorn_kings_beast: {
    id:    'pethw_thorn_kings_beast',
    label: "Thorn King's Beast",
    silo:  'halloween',
    body: `Transform this pet into the legendary creature of the Thorn King while preserving unmistakable likeness. Radically transform its body with living black thorns, twisted wood, bark, vines and deep crimson light glowing between organic layers. Show it violently breaking through an enormous wall of thorns as the gigantic thorn-crowned king appears through the forest fog. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_drowned_revenant: {
    id:    'pethw_drowned_revenant',
    label: 'Drowned Revenant',
    silo:  'halloween',
    body: `Transform this pet into an epic-level creature risen from a drowned world while preserving unmistakable likeness. Transform its natural surface with spectral wet textures, dark aquatic growth, seaweed, shells and eerie blue-green light beneath the body. Capture it bursting from black water among submerged gravestones as a ruined church rises from the stormy sea behind it. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_witchs_familiar: {
    id:    'pethw_witchs_familiar',
    label: "Witch's Familiar",
    silo:  'halloween',
    body: `Transform this pet into an extraordinary dark magical familiar while preserving unmistakable likeness. Radically transform its skin, scales, feathers, hair or fur with smoke, black crystalline growths, magical markings and strange internal light. Capture it leaping, rearing, spreading its wings or striking dramatically through a glowing ritual circle as objects and candles rise around it. Ancient witch's sanctuary deep in the forest. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_shadow_beast: {
    id:    'pethw_shadow_beast',
    label: 'Shadow Beast',
    silo:  'halloween',
    body: `Transform this pet into an epic-level creature made partly from living darkness while preserving unmistakable likeness. Portions of its body dissolve into black supernatural smoke filled with faint eyes, tendrils and violet energy. Capture it emerging explosively from shadow into moonlight in a powerful species-appropriate movement. Abandoned gothic streets and towering architecture disappear into darkness behind it. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_plague_beast: {
    id:    'pethw_plague_beast',
    label: 'Plague Beast',
    silo:  'halloween',
    body: `Transform this pet into an epic-level creature of plague while preserving unmistakable likeness. Transform its skin, scales, feathers, hair or fur with ancient decay, strange fungal growths, smoky textures and sickly supernatural light. Capture it stalking aggressively through an abandoned medieval village as ravens explode into flight and a towering plague doctor appears through the haze. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_frost_wraith: {
    id:    'pethw_frost_wraith',
    label: 'Frost Wraith',
    silo:  'halloween',
    body: `Transform this pet into an epic-level frozen supernatural creature while preserving unmistakable likeness. Radically transform its natural surface with frost, translucent ice, crystalline growths and luminous blue fissures. Capture it racing, flying, rearing or striking through a violent blizzard as the ground and surrounding landscape freeze outward from it. Ancient frozen ruins loom through the storm. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_bone_collectors_beast: {
    id:    'pethw_bone_collectors_beast',
    label: "Bone Collector's Beast",
    silo:  'halloween',
    body: `Transform this pet into the supernatural companion of the Bone Collector while preserving unmistakable likeness. Radically transform its body with elaborate ivory growths, ancient bone armor, weathered natural textures and eerie internal light. Capture it tearing through an ancient burial ground as bones, earth and dust erupt around it. A colossal cloaked Bone Collector approaches through graveyard fog. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_swamp_revenant: {
    id:    'pethw_swamp_revenant',
    label: 'Swamp Revenant',
    silo:  'halloween',
    body: `Transform this pet into an epic-level creature resurrected by a cursed swamp while preserving unmistakable likeness. Merge its skin, scales, feathers, hair or fur with wet bark, moss, roots, reeds and eerie swamp light. Capture it exploding from black water in a powerful species-appropriate action, sending water and vegetation outward. Dead cypress trees and a ruined mansion disappear into green-black mist. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_raven_lords_familiar: {
    id:    'pethw_raven_lords_familiar',
    label: "Raven Lord's Familiar",
    silo:  'halloween',
    body: `Transform this pet into the epic supernatural familiar of the Raven Lord while preserving unmistakable likeness. Transform its natural surface with black feathers, obsidian growths, smoky darkness and luminous violet eyes. Capture it launching, leaping, rearing or striking forward as hundreds of ravens erupt around it. A gigantic ruined castle and the shadowy Raven Lord emerge through a violent storm behind. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_demons_familiar: {
    id:    'pethw_demons_familiar',
    label: "Demon's Familiar",
    silo:  'halloween',
    body: `Transform this pet into an epic-level demonic creature while preserving unmistakable likeness. Radically transform its anatomy and surface with scorched textures, horn-like growths, blackened armor and infernal light glowing beneath the skin, scales, feathers, hair or fur. Capture it breaking free from enormous ancient chains as a colossal demon emerges through fire and smoke behind it. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_ancient_crypt_beast: {
    id:    'pethw_ancient_crypt_beast',
    label: 'Ancient Crypt Beast',
    silo:  'halloween',
    body: `Transform this pet into an epic-level creature awakened after centuries beneath an ancient crypt while preserving unmistakable likeness. Transform its body with weathered stone-like textures, supernatural bone growths, luminous cracks and remnants of ancient burial ornament. Capture it bursting through massive crypt doors as stone and dust explode outward. A vast underground cathedral lies behind it. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_headless_horsemans_familiar: {
    id:    'pethw_headless_horsemans_familiar',
    label: "Headless Horseman's Familiar",
    silo:  'halloween',
    body: `Transform this pet into the supernatural companion of the Headless Horseman while preserving unmistakable likeness. Transform its natural form with blackened textures, ember-lit fissures, spectral edges and ancient armor fused organically into its body. Capture it racing at full speed through a moonlit autumn forest alongside the charging Headless Horseman, earth and leaves exploding around them. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_nightmare_creature: {
    id:    'pethw_nightmare_creature',
    label: 'Nightmare Creature',
    silo:  'halloween',
    body: `Transform this pet into an epic-level creature born from a nightmare while preserving unmistakable likeness. Radically distort and enhance its natural anatomy with elongated supernatural forms, shifting dark textures, strange luminous eyes and shadowy growths while keeping the original animal recognizable. Capture it emerging dynamically through a fractured dreamscape where architecture bends impossibly around it. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

  pethw_spirit_caller: {
    id:    'pethw_spirit_caller',
    label: 'Spirit Caller',
    silo:  'halloween',
    body: `Transform this pet into an epic-level supernatural creature capable of summoning the dead while preserving unmistakable likeness. Transform its skin, scales, feathers, hair or fur with glowing ancient symbols, spectral energy and intricate supernatural textures. Capture it performing a powerful species-appropriate cry, display or movement as dozens of animal spirits spiral upward around it from an ancient ritual ground. Exclude the subject from the upper 1/3 of the image. This is a mobile wallpaper.`,
  },

}

export const PETS_HALLOWEEN_IDS = Object.keys(PETS_HALLOWEEN_WALLPAPERS)
