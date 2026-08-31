// lib/v1/halloween/halloween-catalog.ts
//
// HALLOWEEN ON LITENCO MAIN - 28 effects, 1:1.
//
// ── THIS IS A COPY. THAT IS DELIBERATE. ────────────────────────────────
//
// The originals are lib/v1/wallpapers/wallpapers-halloween.ts and they are
// NOT imported here. Both rooms ship: Halloween wallpapers at 9:16 and
// Halloween portraits at 1:1, and the two want different framing.
//
// Rich's ruling, 20 August: duplicate and edit to suit. An import would
// mean one body serving two shapes, and the shape is exactly what differs.
// Change a body here and the wallpaper room does not move. That is the
// point, and it is also the cost - a wording improvement has to be made
// twice, on purpose.
//
// Contrast lib/v1/wallpapers/wallpapers-pets.ts, which DOES import from
// pets-catalog-35.ts and swaps one paragraph. That worked because the pet
// bodies differ by one paragraph. These differ by a sentence buried
// mid-paragraph in twelve of twenty-eight, in nine different phrasings.
//
// ── WHAT CHANGED FROM THE WALLPAPER ORIGINALS ──────────────────────────
//
// Exactly one thing: the phone framing came out. Nothing else was touched
// - not a word, not a line break, not Rich's spelling.
//
// Twelve bodies carried it, in nine phrasings:
//
//   elegant_vampire     "Thighs-to-head portrait filling the lower two-thirds."
//   werewolf            "Thighs-to-head in the lower two-thirds."
//   ghoul               "Thighs-to-head composition occupying the lower two-thirds."
//   gothic_witch        "Thighs-to-head fills lower 2/3."
//   headless_horseman   (same)
//   swamp_creature      (same)
//   haunted_scarecrow   (same)
//   raven_monarch       (same)
//   ghost_pirate        (same)
//   spider_monarch      (same)
//   cursed_knight       "Thighs-to-head, epic photoreal ..." - only the two
//                       words came out; the sentence continues and was kept.
//   porcelain_doll      "Keep subject in lower 2/3 of image" - its own
//                       opening line, removed whole.
//
// The carryover of 20 August recorded that the strip had caught all but
// one of these. It had caught one. The other eleven read "thighs-to-head
// ... lower 2/3" rather than naming a phone, so a search for the phone
// missed them. Counted here so nobody has to find that out twice.
//
// THE DARK UPPER THIRD STAYS. It appears in the BACKGROUND sentences -
// "the upper third fades into deep blue-black fog" - and it is atmosphere,
// not framing. It reads correctly in a square. Only the sentence telling
// the SUBJECT where to sit was removed.
//
// ── FRAMING IS APPENDED, NOT BAKED ─────────────────────────────────────
//
// HALLOWEEN_MAIN_FRAMING below is appended to every body by
// buildHalloweenPrompt. One line to tune, twenty-eight effects to move -
// which is the lesson the phone clause taught at a cost of a whole day.
//
// Chest to the top of the head. Rich, 20 August.
//
// Appended LAST, because whatever follows a body is the later instruction
// and the later one wins.
//
// ── ASPECT IS NOT IN HERE ──────────────────────────────────────────────
//
// It comes from MAIN_ASPECT in lib/v1/shared/render-aspect.ts and is
// passed to NB2 as a parameter. No body carries an aspect again.
//
// ── PLATES ─────────────────────────────────────────────────────────────
//
// public/previews/halloween/<gender>_<id>.jpg, 800x800, quality 72,
// resized 20 August from H:\minramas\public\previews\halloween-1to1.
//
// The gender prefix is a property of the PLATE, not of the effect - one
// plate per effect, whichever gender rendered best. There is no gender
// axis in this catalog and the ids carry no prefix. Verified 20 August:
// all 28 filenames minus their prefix match these 28 ids exactly.

export interface HalloweenEffect {
  id:     string
  label:  string
  body:   string
  avoid?: string
}

/**
 * Appended to every body by buildHalloweenPrompt.
 *
 * The wallpaper room's equivalent is PHONE_COMPOSITION, re-exported as
 * WALLPAPER_COMPOSITION. This is the 1:1 counterpart and the two must not
 * be confused: one says lower two-thirds, this one says fill the frame.
 */
export const HALLOWEEN_MAIN_FRAMING =
  `Framed from the chest to the top of the head, filling the frame.`

export const HALLOWEEN_MAIN: Record<string, HalloweenEffect> = {
  lantern_keeper: {
    id:    'lantern_keeper',
    label: 'Lantern Keeper',
    body: `Transform the subject into the ancient Lantern Keeper, preserving exact facial identity. Weathered gothic clothing, blackened armor and a colossal supernatural lantern burning with ghostly blue fire, spectral faces barely visible within its glass. Smoke and cold light curl around the body. Epic photoreal dark fantasy horror, haunting and powerful. cast a ghoslty pale blue light on the subject from the side. the rest of the face and body is in shadow. The lantern is 20% of the image
Background: A forgotten cobblestone road winds through a vast cemetery toward the gates of a ruined gothic city, illuminated only by scattered spectral lanterns. The upper third fades into deep blue-black fog, twisted trees and distant cathedral towers beneath a dim moon.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject. Leave permanent features — freckles, scars, tattoos — untouched; remove only temporary blemishes.`,
  },
  moon_beast: {
    id:    'moon_beast',
    label: 'Moon Beast',
    body: `Transform the subject into the legendary Moon Beast while preserving unmistakable facial likeness. Pale moonlit skin becomes subtly inhuman, with predatory luminous eyes, elongated features, black claws, silver-white fur accents and ancient bone armor. Powerful, feral and otherworldly, distinctly unlike a werewolf. Epic photoreal creature horror.
Background: Jagged mountains surround an ancient ruined temple high above a forest drowned in silver mist. An impossibly enormous full moon fills the darkened upper third, partially obscured by racing clouds and circling nocturnal creatures.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject. Leave permanent features — freckles, scars, tattoos — untouched; remove only temporary blemishes.`,
  },
  clockwork_corpse: {
    id:    'clockwork_corpse',
    label: 'Clockwork Corpse',
    body: `Transform the subject into a terrifying Victorian Clockwork Corpse while preserving exact facial identity. Portions of the recognizable face and body open into intricate antique brass gears, springs and glowing machinery beneath pale cracked skin. Victorian clothing, mechanical ribs, steam and tarnished metal complete the transformation. Epic photoreal gothic horror, intricate and uncanny.
Background: An abandoned Victorian clockworks fills a cavernous industrial chamber with enormous gears, pendulums and hundreds of stopped clocks. Towering machinery disappears into the dim upper third where a huge broken clock face glows faintly through steam and darkness.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject. Leave permanent features — freckles, scars, tattoos — untouched; remove only temporary blemishes.`,
  },
  elegant_vampire: {
    id:    'elegant_vampire',
    label: 'Elegant Vampire',
    body: `Transform the subject into an elegant cinematic vampire while preserving unmistakable facial likeness. Pale luminous skin, subtle fangs, dark crimson-and-black Victorian tailoring, black turtleneck, high collar, intense but attractive expression. Dramatic moonlit rim light, rich blacks and deep reds. Sophisticated supernatural fantasy, beautiful and frightening at the same time. the eyes have a luminous glow of their natural color with a subtle falloff. Enhance the looks to be the subjects best camera day ever. leave permanent features (freckles, scars, tattoos) remove blemishes. Background: a great hall in a castle with 20 foot tall gothic windows. pale moonlight streams through the windows leaving ribbed shadows and light on the floor. (blurred).
Sensuous: beautiful but restrained, direct intimate gaze, elegant bone structure, slightly parted lips, immaculate skin, graceful posture, luxurious dark fabrics, warm highlights on otherwise cool skin. Less overt sexuality, more invitation.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject.
Mysterious: controlled expression, unreadable eyes, deep shadows, partial concealment, old-world elegance, unusual stillness. They look as though they know something you don't.
Scary: subtle predatory anatomy. a gaze that makes the beauty suddenly unsafe.
The combination: avoid monster-face. The vampire should be 90% alluring human, 10% unmistakable predator. The fear comes from realizing what's underneath the beauty.
Framed from the stomach to the top of the head, filling the frame.`,
  },
  harvest_god: {
    id:    'harvest_god',
    label: 'Harvest God',
    body: `Transform the subject into an ancient terrifying Harvest God, preserving unmistakable facial likeness. Human features intertwine with dried corn husks, twisted roots, dead vines and cracked pumpkin growth, crowned by enormous branching antlers. deep blood red light burns beneath transformed skin and harvest armor. Epic photoreal folk horror, primal, imposing and richly detailed. no bare chest or stomach
Background: Endless dead cornfields surround an ancient stone altar, with burning pumpkins, crooked scarecrows and distant farmhouses disappearing into harvest fog. The upper third darkens around an enormous blood-red harvest moon, black trees and gathering storm clouds.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject. Leave permanent features — freckles, scars, tattoos — untouched; remove only temporary blemishes.`,
  },
  werewolf: {
    id:    'werewolf',
    label: 'Werewolf',
    body: `Transform the subject into a magnificent human-werewolf hybrid while preserving recognizable facial structure and expression. Powerful but elegant, textured silver-brown fur emerging naturally across the face and body, luminous amber eyes, subtle fangs, torn dark clothing. Cinematic moonlight, adventurous supernatural fantasy, change jaw slightly and have the subject howling. Background: A moonlit forest surrounds the subject with twisted trees, drifting mist and a distant mountain ridge. A full moon anchors the upper third while the surrounding sky and forest fade darker toward the top. Do not make full animal, maintain at least 75% human
Framed from the chest to the top of the head, filling the frame.`,
  },
  eclipse: {
    id:    'eclipse',
    label: 'Eclipse',
    body: `Transform the subject into an ancient supernatural entity known as The Eclipse, preserving exact facial identity. Recognizable human features emerge from living black cosmic material, skin fractured with celestial light, eyes glowing like dying stars, shadow armor dissolving into space. A blazing solar eclipse forms an immense halo behind the head. Epic photoreal cosmic horror, majestic and ominous. Background: A ruined alien landscape stretches beneath a black sky as mountains and ancient monoliths dissolve upward into stars and cosmic dust. The enormous eclipsed sun dominates the dim upper third, its fiery corona fading through black clouds and drifting celestial debris.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject.`,
  },
  ghoul: {
    id:    'ghoul',
    label: 'Ghoul',
    body: `Transform the subject into an elegant ghoul while retaining their recognizable identity. Beautiful aged ivory bone, dark formal clothing, subtle supernatural glow within the eyes. Highly detailed cinematic fantasy, mysterious and playful rather than macabre or frightening. keep 60% likeness Background: An old cemetery stretches into blue-black fog with crooked monuments, bare trees and tiny distant lanterns. Moonlight creates depth below while the upper third gradually falls into a dark, quiet night sky. the subject wheres a worn black top hat with sash that matches its eye color. do not remove the nose.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject. Leave permanent features — freckles, scars, tattoos — untouched; remove only temporary blemishes.`,
  },
  living_cathedral: {
    id:    'living_cathedral',
    label: 'Living Cathedral',
    body: `Transform the subject into the Living Cathedral while preserving exact facial identity. Recognizable human features become ancient carved stone as monumental gothic architecture grows organically from the body: arches form the shoulders, illuminated windows glow beneath cracked stone skin, flying buttresses and gargoyles emerge from elaborate armor. Epic photoreal gothic horror, colossal and awe-inspiring. The catherdrals hand is reaching out towards us. the hand is 20% of the image. Strong use of foreshortening to make things feel massive Background: The figure rises from the center of an immense ruined medieval city as streets and buildings appear to merge physically into its cathedral body. The upper third becomes a dark storm-filled sky where towering spires, gargoyles and a pale moon disappear into clouds and mist. the face is made entirely of stone`,
  },
  gothic_witch: {
    id:    'gothic_witch',
    label: 'Gothic Witch',
    body: `Transform the subject into an epic gothic witch, likeness unmistakable. Beautiful but terrifying, deathly pale skin, faintly glowing eyes, wind-whipped oily black hair, towering distressed hat, a plague hat, occult jewelry, claw-like fingers, coiling bands of crackling energy of pale purple and gold wrap around the arms with tiny tendrils wisping up from the fingers. Photoreal cinematic dark fantasy, extreme detail, sinister, powerful, genuinely frightening. Background: A colossal ruined gothic castle rises through storm clouds, ravens circling its broken towers as lightning illuminates distant mountains. The upper third descends into near-black storm, moonlight and atmospheric haze.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject.`,
  },
  headless_horseman: {
    id:    'headless_horseman',
    label: 'Headless Horseman',
    body: `Transform the subject into an epic Headless Horseman, armored in battered blackened steel and a shredded 18th-century riding coat, holding their severed spectral head beneath one arm, likeness unmistakable, eyes burning orange. Embers, smoke, supernatural fire, terrifying presence. Photoreal cinematic dark fantasy, monumental scale, intricate detail. The spectre is throwing the firey head at us. the face is transformed into a howling firey ball, the hair transitions to streaming deatiled volume flames, the mouth is a gaping maw of fire. the horseman is on the horse. epic level fantasy image Background: A burning jack-o'-lantern-lined road tears through a dead forest toward a ruined gothic village beneath a blood-orange moon. the thrown head is 15% of the image with the subjects face on it. Twisted branches and smoke climb into a dramatically darker upper third.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject.`,
  },
  swamp_creature: {
    id:    'swamp_creature',
    label: 'Swamp Creature',
    body: `Transform the subject into an ancient terrifying swamp creature, likeness unmistakable beneath reptilian skin, moss, roots, wet bark and decaying aquatic growth. Powerful humanoid form, predatory amber eyes, jagged organic crown, water streaming from the body, vines curling around limbs. Epic photoreal creature fantasy, primal, ominous, extraordinarily detailed. Background: A primordial blackwater swamp surrounds ruined stone structures, enormous cypress roots, hanging moss and ghostly lights beneath dense fog. A sickly moon barely penetrates the canopy as the upper third fades into deep black-green atmosphere and shadow.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject. Leave permanent features — freckles, scars, tattoos — untouched; remove only temporary blemishes.`,
  },
  haunted_scarecrow: {
    id:    'haunted_scarecrow',
    label: 'Haunted Scarecrow',
    body: `Transform the subject into a terrifying supernatural scarecrow, likeness is preserved through skin that has thick stiching holding the face together. the skin has a mild burlap texture to it. Deep stitched seams, ember-lit eyes, jagged straw, enormous battered hat, shredded harvest coat, twisted branches and black feathers. Epic photoreal dark fantasy, menacing, intricate, cinematic Halloween horror. likeness should be at least 80% Background: A vast dead cornfield burns faintly beneath an enormous harvest moon, with crooked scarecrows disappearing into rolling ground fog and a decaying farmhouse beyond. The upper third becomes darker and stormier
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject.`,
  },
  raven_monarch: {
    id:    'raven_monarch',
    label: 'Raven King / Queen',
    body: `Transform the subject into a terrifying Raven King or Queen, likeness unmistakable. Black feathered skin and armor, obsidian crown, predatory dark eyes, enormous raven-feather mantle, clawed hands, feathers exploding into supernatural shadow. Epic photoreal dark fantasy, regal, sinister, monumental, intricate cinematic detail. Background: Thousands of ravens spiral around the towers of a ruined mountaintop fortress beneath a cold silver moon. Storm clouds and distant peaks fade into a dramatically darker upper third, with scattered birds silhouetted against the night. the skin is pale and luminous
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject. Leave permanent features — freckles, scars, tattoos — untouched; remove only temporary blemishes.`,
  },
  ghost_pirate: {
    id:    'ghost_pirate',
    label: 'Ghost Pirate',
    body: `Transform the subject into a terrifying undead pirate captain, likeness unmistakable. Weathered spectral face, glowing dead eyes, rotting black ornate captains pirate hat, shredded captain's coat, tarnished gold, barnacles, seaweed and supernatural blue-green flame. Epic photoreal dark fantasy, sinister, seaworn, cinematic, intensely detailed. Background: A colossal ghost ship thrusts up on a wave from the deep in violent thunderous leap from the ocean. its torn sails glowing faintly through supernatural fog. Lightning, spectral rigging and a pale moon disappear upward into a dark storm-filled upper third. the skin is pale with holes in it that go right out the other side. the subject is visible from stomach to top of hat. the subject has a ruffled torn once white shirt.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject.`,
  },
  spider_monarch: {
    id:    'spider_monarch',
    label: 'Spider King / Queen',
    body: `Transform the subject into a terrifying Spider King or Queen, likeness unmistakable. Elegant human face merging into glossy black chitin, multiple sinister eyes, bladed crown, articulated spider armor, long jointed limbs emerging behind the body, intricate webs and venomous highlights. Epic photoreal dark fantasy, beautiful, predatory, deeply unsettling. The armor extends out in overlapping layers as shell encompassing the the subject and extending offscreen. no spider emblems. have the crowns eyes slightly glowing with amber falloff. the crown should be a part of the entire armor shell. the subjects face should have chitinous layers and an evil smile. the mouth is open and dark Background: An enormous abandoned gothic palace has been consumed by cathedral-sized webs, with shadowy spiders moving across distant arches. Moonlight catches strands of silk while the upper third fades into black vaulted architecture, mist and barely visible webbing.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject.`,
  },
  dark_wizard: {
    id:    'dark_wizard',
    label: 'Dark Wizard',
    body: `Transform the subject into an immensely powerful dark wizard, preserving exact facial identity and proportions. Weathered human face, blackened eyes with deep orange glow, ancient runic armor, shredded robes, arcane crown with pale glowing sontes, swirling shadow and violent magical energy around the hands. Epic photoreal dark fantasy horror, intimidating and monumental. USe gradient purple green pink glowing arcing energy with strong falloff as effects wrap from the shoulders to the fingertips with wispy tendrils climbing into the night. the skin is pale.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject.`,
  },
  demon_lord: {
    id:    'demon_lord',
    label: 'Demon Lord',
    body: `Transform the subject into an epic Demon Lord while preserving exact facial identity and proportions. Human features remain unmistakable beneath obsidian skin fissures glowing with internal fire, sweeping horns, blackened crown, infernal armor and enormous shadowed wings. Photoreal cinematic dark fantasy horror, terrifying, regal, monumental. Background: A vast infernal fortress rises from volcanic cliffs surrounded by fire, smoke and drifting embers. The upper third fades into a nearly black crimson sky with distant peaks and an enormous eclipsed moon.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject. Leave permanent features — freckles, scars, tattoos — untouched; remove only temporary blemishes.`,
  },
  ice_wraith: {
    id:    'ice_wraith',
    label: 'Ice Wraith',
    body: `Transform the subject into an ancient Ice Wraith while preserving unmistakable facial likeness. Pale human features become partially frozen and translucent, the skin is ice, glowing icy eyes, jagged large ornate crystal crown, frozen armor and shredded spectral robes dissolving into snow. Epic photoreal dark fantasy horror, haunting and powerful. the face is entirely carved from ice, no real skin or hair Background: A frozen ruined kingdom disappears into a violent supernatural blizzard, with enormous ice formations and shattered castle towers hundreds of feet high extend in the background into the frozen night sky.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject. Leave permanent features — freckles, scars, tattoos — untouched; remove only temporary blemishes.`,
  },
  necromancer: {
    id:    'necromancer',
    label: 'Necromancer',
    body: `Transform the subject into an immensely powerful Necromancer while preserving unmistakable facial likeness. Pale recognizable face, blackened eyes glowing sickly green, elaborate bone-and-obsidian crown, ancient robes, skeletal armor and swirling spectral energy. Ghostly figures emerge from darkness around them. Epic photoreal dark fantasy horror, sinister, commanding, intensely detailed. Background: An enormous ruined crypt opens onto a cemetery filled with crooked monuments and spectral mist. The upper third fades into near-black clouds, distant mausoleums and faint supernatural light.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject.`,
  },
  shadow_monarch: {
    id:    'shadow_monarch',
    label: 'Shadow King / Queen',
    body: `Transform the subject into the terrifying Shadow King or Queen while preserving exact facial identity. Recognizable human face partially consumed by living black shadow, large ornate obsidian crown. Obsidian armor with black gray gradient wispy smoke wrapping the subject and extending off image. glowing eyes and enormous tendrils of darkness forming behind the body. Epic photoreal supernatural horror, elegant, sinister, otherworldly, monumental. subjects face should be at least 20% of image. Skin should be bone white with hairline cracks. Background: A colossal black palace emerges from an endless landscape swallowed by supernatural darkness and silver fog. A pale eclipsed moon and distant towers dissolve into the dim upper third. drak hair
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject.`,
  },
  cursed_knight: {
    id:    'cursed_knight',
    label: 'Cursed Knight',
    body: `Transform the subject into an ancient Cursed Knight, preserving exact facial identity and proportions. Their battle-scarred black armor is fused unnaturally into the body, split by deep fractures leaking deep amber and oxblood light; corrupted runes crawl across the steel, a shattered crown rises behind the head, and spectral darkness pours from the armor. Epic photoreal gothic horror, terrifying, regal, monumental. The face is parchment paper. eyes glow with pale light. The knight is in a dynamic pose with raised sword in both hands ready to strike. the face is in rage and agony with mouth agape Background: A colossal ruined fortress and battlefield disappear beneath supernatural storm clouds, with spectral armies barely visible through smoke and ash. The upper third is dominated by a huge obscured moon, lightning and broken castle towers fading into darkness.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject. Leave permanent features — freckles, scars, tattoos — untouched; remove only temporary blemishes.`,
  },
  the_ferryman: {
    id:    'the_ferryman',
    label: 'The Ferryman',
    body: `Transform the subject into the legendary Ferryman of the dead while preserving unmistakable facial likeness. Gaunt recognizable face beneath a deep weathered hood, ancient black robes, bone ornaments, spectral lantern and skeletal staff, surrounded by cold blue-green ghost light. Epic photoreal mythic horror, ancient, ominous, hauntingly beautiful. Background: A black wooden boat crosses an endless mist-covered river while ghostly silhouettes gather along distant ruined shores. The upper third fades into darkness beneath towering cliffs and a dim spectral. pale skin, glowing eyes
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject.`,
  },
  porcelain_doll: {
    id:    'porcelain_doll',
    label: 'Living Porcelain Doll',
    body: `Transform the subject into an exquisitely terrifying living porcelain doll while preserving exact facial identity. Their recognizable face becomes polished antique porcelain with delicate cracks, unnaturally glassy eyes, fine painted details and subtle darkness visible beneath broken porcelain. Epic photoreal gothic horror, beautiful, uncanny, deeply unsettling.  Likeness is essential do not change shape of face. do not use makeup
Background: An abandoned Victorian nursery contains antique toys, enormous shadowed furniture and dozens of barely visible dolls. Moonlight enters through tall windows as the upper third fades into dusty darkness and indistinct silhouettes.`,
  },
  moth_monarch: {
    id:    'moth_monarch',
    label: 'Moth King / Queen',
    body: `Transform the subject into an ancient nocturnal Moth King or Queen, preserving exact facial identity. Their recognizable face is eerily transformed with pale powdery skin matches the moths tone, luminous eyes, delicate chitin and death's-head markings emerging across the temples. A colossal mantle of layered moth wings forms their royal silhouette, surrounded by thousands of moths. Epic photoreal dark fantasy horror, sinister, alien, majestic. cover the subject completly in moths. hands are at side. expression is eeirily queit and vacant. skin tone is the same as the moths. face should be at least 15% of the image Background: An ancient ruined palace has been completely overtaken by enormous moths, silk, cocoons and pale nocturnal vegetation. A huge cold moon burns through the dark upper third while countless moth silhouettes swarm across its surface.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject. Leave permanent features — freckles, scars, tattoos — untouched; remove only temporary blemishes.`,
  },
  hollow_tree: {
    id:    'hollow_tree',
    label: 'The Hollow Tree',
    body: `Transform the subject into The Hollow Tree, preserving unmistakable facial likeness. Their human form becomes ancient twisted black wood, recognizable face carved naturally into cracked bark, with deep hollow fractures glowing amber from within. Massive roots form the body, dead branches crown the head, and ghostly faces emerge subtly from the wood. Epic photoreal folk horror, ancient, terrifying, monumental. face should be projecting outward from wood. mouth open. Skin matches trees surface Background: A dead primordial forest surrounds a circle of enormous standing stones, its trees twisted into unnatural shapes through dense ground fog. The upper third fades into black branches silhouetted against an enormous sickly harvest moon. no human skin the face should be made entirely of wood
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject.`,
  },
  night_bloom: {
    id:    'night_bloom',
    label: 'The Night Bloom',
    body: `Transform the subject into The Night Bloom. Their recognizable human form is overtaken by black nocturnal flowers, thorned vines and glossy petals growing through skin and gothic clothing, with faint violet bioluminescence glowing from within each blossom. Epic photoreal botanical horror, beautiful, sinister, supernatural, intensely detailed. skin is a medium pale luminous purple with spider cracks that blue light shines through No text. Hair is in the same style but black and oily. Subjects face should be at least 15% of image. one hand is reaching out with strong foreshortening. hand should be 20% of image Background: A forbidden midnight garden surrounds a ruined gothic conservatory, filled with enormous dark flowers opening beneath moonlight and vines consuming the architecture. The upper third fades into deep violet-black fog, twisted branches and a dim crescent moon.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject.`,
  },
  halloween_monarch: {
    id:    'halloween_monarch',
    label: 'Lord / Lady of Halloween',
    body: `Transform the subject into the supreme Lord or Lady of Halloween while preserving exact facial identity. Recognizable human face transformed with cracked pumpkin texture and supernatural ember light, enormous twisted black crown, raven feathers, bones, thorns, gothic armor and spectacular burning cloak. Epic photoreal dark fantasy horror, terrifying, majestic, impossibly elaborate. the subjects face is stoic and reserved. the skin is pale Background: An entire Halloween kingdom unfolds behind them: haunted castle, dead forest, cemetery, burning pumpkins, circling ravens and rolling supernatural fog. The upper third darkens dramatically around an enormous eclipsed harvest moon, storm clouds and distant castle spires.
The likeness is essential. Preserve the subject's facial shape, structure and natural asymmetry exactly, along with their micro facial gestures, imperfections and expression — all the characteristics that make this person this person. Keep hairline, hairstyle, length, direction and colour exactly as photographed; do not invent hair, prematurely grey it, or embellish it. The hair should be organically faithful, whether messy or neatly kept. Preserve the subject's real weight and build. Do not add weight, and do not age or de-age the subject.`,
  },
}

export const HALLOWEEN_MAIN_ORDER: string[] = Object.keys(HALLOWEEN_MAIN)

/** Preview plate path. The gender prefix belongs to the file, so it is
 *  passed in rather than derived - there is no gender axis on the effect. */
export function halloweenPlatePath(id: string, gender: 'man' | 'woman'): string {
  return `/previews/halloween/${gender}_${id}.jpg`
}

/**
 * Body + framing, in that order. Nothing else is appended: no phone
 * clause, no aspect, no plaque.
 */
export function buildHalloweenPrompt(id: string): string {
  const fx = HALLOWEEN_MAIN[id]
  if (!fx) throw new Error(`[halloween] unknown effect id: ${id}`)
  const avoid = fx.avoid ? `\n${fx.avoid}` : ''
  return `${fx.body.trim()}\n${HALLOWEEN_MAIN_FRAMING}${avoid}`
}

export function isHalloweenEffect(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(HALLOWEEN_MAIN, id)
}
