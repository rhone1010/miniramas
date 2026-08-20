// lib/v1/wallpapers/wallpapers-halloween.ts
//
// HALLOWEEN SILO — 28 wallpaper effects, 9:16, download only.
//
// Locked against live renders by Rich on 2026-08-10, in one sitting. Every
// body below is his text, verbatim, including his own capitalisation,
// spelling and line breaks. Nothing here was tidied.
//
// ── TWENTY-EIGHT, NOT FOURTEEN ─────────────────────────────────────────
//
// The wallpaper floor is 5 across and 3 down: fourteen effects and an
// upsell card. Halloween carries twice that, so the room needs a toggle to
// flip between the two halves of the catalog. That is CUI's control; the
// engine just returns 28 ids for this silo.
//
// ── SEASONAL ───────────────────────────────────────────────────────────
//
// This room took the slot originally scoped for Groups. Halloween runs
// through October; Christmas replaces it from November. That wants a
// rotation date the glass can read rather than a deploy.
//
// ── WHAT THE ROOM SETTLED ON ───────────────────────────────────────────
//
// Framing is stated inside each body rather than appended, because Rich
// wrote these directly at 9:16 rather than porting them from a print
// catalog. Most open with "Keep subject in lower 2/3 of image to allow for
// phone UI elements. This is a mobile wallpaper."
//
// The top third is always occupied and always dark. A moon appears in
// nearly every background — eclipsed, blood-red, sickly, cold — and the
// strongest solutions let something break it up: antlers on Harvest God,
// bare branches on Hollow Tree, swarming moths on Moth King.
//
// NB2 draws its own status bar and clock if not stopped. It produced
// "Trnday, Nep 26" on an early Portraits shot and a full wifi-and-battery
// row on The Ferryman. "" is the wording
// that holds.
//
// ── OPEN, FOR RICH ─────────────────────────────────────────────────────
//
// The likeness lever is written three different ways across this room:
// "keep 60% likeness", "likeness should be at least 80%", and plain
// "likeness unmistakable". They are not the same scale and were tuned in
// isolation from each other. Worth settling on one before the room ships.
//
// Two near-neighbours should not sit adjacent in the grid: The Ferryman
// and Lantern Keeper are both hooded figures with a blue-green lantern in
// graveyard mist. They read differently, but not from a thumbnail.

import type { WallpaperEffect } from './wallpapers-shared'

export const HALLOWEEN_WALLPAPERS: Record<string, WallpaperEffect> = {

  lantern_keeper: {
    id:    'lantern_keeper',
    label: 'Lantern Keeper',
    silo:  'halloween',
    body: ` 
Transform the subject into the ancient Lantern Keeper, preserving exact facial identity. Weathered gothic clothing, blackened armor and a colossal supernatural lantern burning with ghostly blue fire, spectral faces barely visible within its glass. Smoke and cold light curl around the body. Epic photoreal dark fantasy horror, haunting and powerful. cast a ghoslty pale blue light on the subject from the side. the rest of the face and body is in shadow. The lantern is 20% of the image
Background: A forgotten cobblestone road winds through a vast cemetery toward the gates of a ruined gothic city, illuminated only by scattered spectral lanterns. The upper third fades into deep blue-black fog, twisted trees and distant cathedral towers beneath a dim moon.`,
  },

  moon_beast: {
    id:    'moon_beast',
    label: 'Moon Beast',
    silo:  'halloween',
    body: `Transform the subject into the legendary Moon Beast while preserving unmistakable facial likeness. Pale moonlit skin becomes subtly inhuman, with predatory luminous eyes, elongated features, black claws, silver-white fur accents and ancient bone armor. Powerful, feral and otherworldly, distinctly unlike a werewolf. Epic photoreal creature horror.
Background: Jagged mountains surround an ancient ruined temple high above a forest drowned in silver mist. An impossibly enormous full moon fills the darkened upper third, partially obscured by racing clouds and circling nocturnal creatures.`,
  },

  clockwork_corpse: {
    id:    'clockwork_corpse',
    label: 'Clockwork Corpse',
    silo:  'halloween',
    body: `Transform the subject into a terrifying Victorian Clockwork Corpse while preserving exact facial identity. Portions of the recognizable face and body open into intricate antique brass gears, springs and glowing machinery beneath pale cracked skin. Victorian clothing, mechanical ribs, steam and tarnished metal complete the transformation. Epic photoreal gothic horror, intricate and uncanny.
Background: An abandoned Victorian clockworks fills a cavernous industrial chamber with enormous gears, pendulums and hundreds of stopped clocks. Towering machinery disappears into the dim upper third where a huge broken clock face glows faintly through steam and darkness.`,
    // WATCH: the broken clock face is the brightest thing in the frame and
    // sits in the top third, where the phone's own clock goes. Check on a
    // real screen before this ships.
  },

  elegant_vampire: {
    id:    'elegant_vampire',
    label: 'Elegant Vampire',
    silo:  'halloween',
    body: `Transform the subject into an elegant cinematic vampire while preserving unmistakable facial likeness. Pale luminous skin, subtle fangs, dark crimson-and-black Victorian tailoring, high collar, intense but attractive expression. Thighs-to-head portrait filling the lower two-thirds. Dramatic moonlit rim light, rich blacks and deep reds. Sophisticated supernatural fantasy, beautiful and frightening at the same time. add a slight red glow to the lower 1/4 of the eyes, with gradient falloff. Enhance the looks to be the subjects best camera day ever. leave permanent features (freckles, scars, tattoos) remove blemishes. 
Background: A distant Gothic castle rises through rolling midnight fog beneath a huge pale moon.`,
  },

  harvest_god: {
    id:    'harvest_god',
    label: 'Harvest God',
    silo:  'halloween',
    body: `Transform the subject into an ancient terrifying Harvest God, preserving unmistakable facial likeness. Human features intertwine with dried corn husks, twisted roots, dead vines and cracked pumpkin growth, crowned by enormous branching antlers. deep blood red light burns beneath transformed skin and harvest armor. Epic photoreal folk horror, primal, imposing and richly detailed. no bare chest or stomach
Background: Endless dead cornfields surround an ancient stone altar, with burning pumpkins, crooked scarecrows and distant farmhouses disappearing into harvest fog. The upper third darkens around an enormous blood-red harvest moon, black trees and gathering storm clouds.`,
    // The antlers reaching into and framing the moon is the best top-third
    // solution in the room — it makes the composition rather than working
    // around it.
  },

  werewolf: {
    id:    'werewolf',
    label: 'Werewolf',
    silo:  'halloween',
    body: `Transform the subject into a magnificent human-werewolf hybrid while preserving recognizable facial structure and expression. Powerful but elegant, textured silver-brown fur emerging naturally across the face and body, luminous amber eyes, subtle fangs, torn dark clothing. Thighs-to-head in the lower two-thirds. Cinematic moonlight, adventurous supernatural fantasy, change jaw slightly and have the subject howling. 
Background: A moonlit forest surrounds the subject with twisted trees, drifting mist and a distant mountain ridge. A full moon anchors the upper third while the surrounding sky and forest fade darker toward the top.`,
  },

  eclipse: {
    id:    'eclipse',
    label: 'Eclipse',
    silo:  'halloween',
    body: `Transform the subject into an ancient supernatural entity known as The Eclipse, preserving exact facial identity. Recognizable human features emerge from living black cosmic material, skin fractured with celestial light, eyes glowing like dying stars, shadow armor dissolving into space. A blazing solar eclipse forms an immense halo behind the head. Epic photoreal cosmic horror, majestic and ominous. 
Background: A ruined alien landscape stretches beneath a black sky as mountains and ancient monoliths dissolve upward into stars and cosmic dust. The enormous eclipsed sun dominates the dim upper third, its fiery corona fading through black clouds and drifting celestial debris.`,
  },

  ghoul: {
    id:    'ghoul',
    label: 'Ghoul',
    silo:  'halloween',
    body: `Transform the subject into an elegant ghoul while retaining their recognizable identity. Beautiful aged ivory bone, dark formal clothing, subtle supernatural glow within the eyes. Thighs-to-head composition occupying the lower two-thirds. Highly detailed cinematic fantasy, mysterious and playful rather than macabre or frightening. keep 60% likeness
Background: An old cemetery stretches into blue-black fog with crooked monuments, bare trees and tiny distant lanterns. Moonlight creates depth below while the upper third gradually falls into a dark, quiet night sky.`,
  },

  living_cathedral: {
    id:    'living_cathedral',
    label: 'Living Cathedral',
    silo:  'halloween',
    body: `
Transform the subject into the Living Cathedral while preserving exact facial identity. Recognizable human features become ancient carved stone as monumental gothic architecture grows organically from the body: arches form the shoulders, illuminated windows glow beneath cracked stone skin, flying buttresses and gargoyles emerge from elaborate armor. Epic photoreal gothic horror, colossal and awe-inspiring. The catherdrals hand is reaching out towards us. the hand is 20% of the image. Strong use of foreshortening to make things feel massive
Background: The figure rises from the center of an immense ruined medieval city as streets and buildings appear to merge physically into its cathedral body. The upper third becomes a dark storm-filled sky where towering spires, gargoyles and a pale moon disappear into clouds and mist.`,
  },

  gothic_witch: {
    id:    'gothic_witch',
    label: 'Gothic Witch',
    silo:  'halloween',
    body: `Transform the subject into an epic gothic witch, likeness unmistakable. Beautiful but terrifying, deathly pale skin, blackened eyes, wind-whipped hair, towering distressed hat, shredded black velvet, occult jewelry, claw-like fingers, supernatural smoke and violet energy. Thighs-to-head fills lower 2/3. Photoreal cinematic dark fantasy, extreme detail, sinister, powerful, genuinely frightening.
Background: A colossal ruined gothic castle rises through storm clouds, ravens circling its broken towers as lightning illuminates distant mountains. The upper third descends into near-black storm, moonlight and atmospheric haze.`,
  },

  headless_horseman: {
    id:    'headless_horseman',
    label: 'Headless Horseman',
    silo:  'halloween',
    body: `Transform the subject into an epic Headless Horseman, armored in battered blackened steel and a shredded 18th-century riding coat, holding their severed spectral head beneath one arm, likeness unmistakable, eyes burning orange. Embers, smoke, supernatural fire, terrifying presence. Thighs-to-head fills lower 2/3. Photoreal cinematic dark fantasy, monumental scale, intricate detail. The spectre is throwing the firey head at us. the face is transformed into a howling firey ball, the hair transitions to streaming deatiled volume flames, the mouth is a gaping maw of fire. the horseman is on the horse. epic level fantasy image
Background: A burning jack-o'-lantern-lined road tears through a dead forest toward a ruined gothic village beneath a blood-orange moon. Twisted branches and smoke climb into a dramatically darker upper third.`,
    // Varies run to run: the head must read as SEVERED and held out. When
    // it renders still attached the whole concept is lost.
  },

  swamp_creature: {
    id:    'swamp_creature',
    label: 'Swamp Creature',
    silo:  'halloween',
    body: `Transform the subject into an ancient terrifying swamp creature, likeness unmistakable beneath reptilian skin, moss, roots, wet bark and decaying aquatic growth. Powerful humanoid form, predatory amber eyes, jagged organic crown, water streaming from the body, vines curling around limbs. Thighs-to-head fills lower 2/3. Epic photoreal creature fantasy, primal, ominous, extraordinarily detailed.
Background: A primordial blackwater swamp surrounds ruined stone structures, enormous cypress roots, hanging moss and ghostly lights beneath dense fog. A sickly moon barely penetrates the canopy as the upper third fades into deep black-green atmosphere and shadow.`,
  },

  haunted_scarecrow: {
    id:    'haunted_scarecrow',
    label: 'Haunted Scarecrow',
    silo:  'halloween',
    body: `Transform the subject into a terrifying supernatural scarecrow, likeness preserved through a warped burlap face shaped precisely around their features. Deep stitched seams, ember-lit eyes, jagged straw, enormous battered hat, shredded harvest coat, twisted branches and black feathers. Thighs-to-head fills lower 2/3. Epic photoreal dark fantasy, menacing, intricate, cinematic Halloween horror. likeness should be at least 80%
Background: A vast dead cornfield burns faintly beneath an enormous harvest moon, with crooked scarecrows disappearing into rolling ground fog and a decaying farmhouse beyond. The upper third becomes darker and stormier`,
    // Burlap shaped around the real features is the hardest likeness
    // problem in the room and it holds. The clause doing it is "shaped
    // precisely around their features".
  },

  raven_monarch: {
    id:    'raven_monarch',
    label: 'Raven King / Queen',
    silo:  'halloween',
    body: `Transform the subject into a terrifying Raven King or Queen, likeness unmistakable. Black feathered skin and armor, obsidian crown, predatory dark eyes, enormous raven-feather mantle, clawed hands, feathers exploding into supernatural shadow. Thighs-to-head fills lower 2/3. Epic photoreal dark fantasy, regal, sinister, monumental, intricate cinematic detail.
Background: Thousands of ravens spiral around the towers of a ruined mountaintop fortress beneath a cold silver moon. Storm clouds and distant peaks fade into a dramatically darker upper third, with scattered birds silhouetted against the night.`,
  },

  ghost_pirate: {
    id:    'ghost_pirate',
    label: 'Ghost Pirate',
    silo:  'halloween',
    body: `Transform the subject into a terrifying undead pirate captain, likeness unmistakable. Weathered spectral face, glowing dead eyes, rotting black tricorn, shredded captain's coat, tarnished gold, barnacles, seaweed and supernatural blue-green flame. Thighs-to-head fills lower 2/3. Epic photoreal dark fantasy, sinister, seaworn, cinematic, intensely detailed. Likeness is importan. have eye glow fall of into a blue green gradient
Background: A colossal ghost ship emerges from violent black seas behind the captain, its torn sails glowing faintly through supernatural fog. Lightning, spectral rigging and a pale moon disappear upward into a dark storm-filled upper third.`,
  },

  spider_monarch: {
    id:    'spider_monarch',
    label: 'Spider King / Queen',
    silo:  'halloween',
    body: `Transform the subject into a terrifying Spider King or Queen, likeness unmistakable. Elegant human face merging into glossy black chitin, multiple sinister eyes, bladed crown, articulated spider armor, long jointed limbs emerging behind the body, intricate webs and venomous highlights. Thighs-to-head fills lower 2/3. Epic photoreal dark fantasy, beautiful, predatory, deeply unsettling. The armor extends out in overlapping layers as shell encompassing the the subject and extending offscreen. no spider emblems. have the crowns eyes slightly glowing with amber falloff. the crown should be a part of the entire armor shell. the subjects face should have chitinous layers and an evil smile. the mouth is open and dark
Background: An enormous abandoned gothic palace has been consumed by cathedral-sized webs, with shadowy spiders moving across distant arches. Moonlight catches strands of silk while the upper third fades into black vaulted architecture, mist and barely visible webbing.`,
  },

  dark_wizard: {
    id:    'dark_wizard',
    label: 'Dark Wizard',
    silo:  'halloween',
    body: `Transform the subject into an immensely powerful dark wizard, preserving exact facial identity and proportions. Weathered human face, blackened eyes with supernatural fire, ancient runic armor, shredded robes, arcane crown, swirling shadow and violent magical energy around the hands. Epic photoreal dark fantasy horror, intimidating and monumental. USe gradient purple green pink glowing falloff as effects`,
    // "do not include phone elements" is the cleanest wording found for
    // stopping NB2 drawing its own clock and status bar.
  },

  demon_lord: {
    id:    'demon_lord',
    label: 'Demon Lord',
    silo:  'halloween',
    body: `Transform the subject into an epic Demon Lord while preserving exact facial identity and proportions. Human features remain unmistakable beneath obsidian skin fissures glowing with internal fire, sweeping horns, blackened crown, infernal armor and enormous shadowed wings. Photoreal cinematic dark fantasy horror, terrifying, regal, monumental.
Background: A vast infernal fortress rises from volcanic cliffs surrounded by fire, smoke and drifting embers. The upper third fades into a nearly black crimson sky with distant peaks and an enormous eclipsed moon.`,
  },

  ice_wraith: {
    id:    'ice_wraith',
    label: 'Ice Wraith',
    silo:  'halloween',
    body: `Transform the subject into an ancient Ice Wraith while preserving unmistakable facial likeness. Pale human features become partially frozen and translucent, frost spreading across skin, glowing icy eyes, jagged crystal crown, frozen armor and shredded spectral robes dissolving into snow. Epic photoreal dark fantasy horror, haunting and powerful. the face is entirely carved from ice, no real skin or hair
Background: A frozen ruined kingdom disappears into a violent supernatural blizzard, with enormous ice formations and shattered castle towers beyond. The upper third darkens into a deep blue-black storm`,
  },

  necromancer: {
    id:    'necromancer',
    label: 'Necromancer',
    silo:  'halloween',
    body: `Transform the subject into an immensely powerful Necromancer while preserving unmistakable facial likeness. Pale recognizable face, blackened eyes glowing sickly green, elaborate bone-and-obsidian crown, ancient robes, skeletal armor and swirling spectral energy. Ghostly figures emerge from darkness around them. Epic photoreal dark fantasy horror, sinister, commanding, intensely detailed.
Background: An enormous ruined crypt opens onto a cemetery filled with crooked monuments and spectral mist. The upper third fades into near-black clouds, distant mausoleums and faint supernatural light.`,
  },

  shadow_monarch: {
    id:    'shadow_monarch',
    label: 'Shadow King / Queen',
    silo:  'halloween',
    body: `Transform the subject into the terrifying Shadow King or Queen while preserving exact facial identity. Recognizable human face partially consumed by living black shadow, obsidian crown. Obsidian armor with black gray gradient wispy smoke wrapping the subject and extending off image. glowing silver eyes and enormous tendrils of darkness forming behind the body. Epic photoreal supernatural horror, elegant, sinister, otherworldly, monumental. subjects face should be at least 20% of image. Skin should be bone white with hairline cracks. 
Background: A colossal black palace emerges from an endless landscape swallowed by supernatural darkness and silver fog. A pale eclipsed moon and distant towers dissolve into the dim upper third.`,
    // The only effect in the room with no colour in it at all. Keep it
    // that way — it is what makes it stand out in the grid.
  },

  cursed_knight: {
    id:    'cursed_knight',
    label: 'Cursed Knight',
    silo:  'halloween',
    body: `Transform the subject into an ancient Cursed Knight, preserving exact facial identity and proportions. Their battle-scarred black armor is fused unnaturally into the body, split by deep fractures leaking deep amber and oxblood light; corrupted runes crawl across the steel, a shattered crown rises behind the head, and spectral darkness pours from the armor. Thighs-to-head, epic photoreal gothic horror, terrifying, regal, monumental. The face is parchment paper. eyes glow with pale light. The knight is in a dynamic pose with raised sword in both hands ready to strike. the face is in rage and agony with mouth agape
Background: A colossal ruined fortress and battlefield disappear beneath supernatural storm clouds, with spectral armies barely visible through smoke and ash. The upper third is dominated by a huge obscured moon, lightning and broken castle towers fading into darkness.`,
    // The only action pose in the room. Everything else stands and stares.
  },

  the_ferryman: {
    id:    'the_ferryman',
    label: 'The Ferryman',
    silo:  'halloween',
    body: `Transform the subject into the legendary Ferryman of the dead while preserving unmistakable facial likeness. Gaunt recognizable face beneath a deep weathered hood, ancient black robes, bone ornaments, spectral lantern and skeletal staff, surrounded by cold blue-green ghost light. Epic photoreal mythic horror, ancient, ominous, hauntingly beautiful.
Background: A black wooden boat crosses an endless mist-covered river while ghostly silhouettes gather along distant ruined shores. The upper third fades into darkness beneath towering cliffs and a dim spectral`,
    // NB2 drew a full status bar on this one — wifi, signal, battery. This
    // body has no text ban. Add one if it recurs.
  },

  porcelain_doll: {
    id:    'porcelain_doll',
    label: 'Living Porcelain Doll',
    silo:  'halloween',
    body: `Keep subject in lower 2/3 of image
Transform the subject into an exquisitely terrifying living porcelain doll while preserving exact facial identity. Their recognizable face becomes polished antique porcelain with delicate cracks, unnaturally glassy eyes, fine painted details and subtle darkness visible beneath broken porcelain. Epic photoreal gothic horror, beautiful, uncanny, deeply unsettling.  Likeness is essential do not change shape of face. do not use makeup
Background: An abandoned Victorian nursery contains antique toys, enormous shadowed furniture and dozens of barely visible dolls. Moonlight enters through tall windows as the upper third fades into dusty darkness and indistinct silhouettes.`,
    // Best restraint in the room. The everyday clothing against the
    // porcelain face is what makes it unsettling — do not add costume.
  },

  moth_monarch: {
    id:    'moth_monarch',
    label: 'Moth King / Queen',
    silo:  'halloween',
    body: `Transform the subject into an ancient nocturnal Moth King or Queen, preserving exact facial identity. Their recognizable face is eerily transformed with pale powdery skin, enormous luminous black eyes, delicate chitin and death's-head markings emerging across the temples. A colossal mantle of layered moth wings forms their royal silhouette, surrounded by thousands of moths. Epic photoreal dark fantasy horror, sinister, alien, majestic. cover the subject completly in moths. hands are at side. expression is eeirily queit and vacant. skin tone is the same as the moths. face should be at least 15% of the image
Background: An ancient ruined palace has been completely overtaken by enormous moths, silk, cocoons and pale nocturnal vegetation. A huge cold moon burns through the dark upper third while countless moth silhouettes swarm across its surface.`,
    // REWRITTEN and re-locked. The first version used a wing mantle; full
    // moth coverage with matching skin tone is stronger, and the vacant
    // expression is more unsettling than the snarl everything else wears.
  },

  hollow_tree: {
    id:    'hollow_tree',
    label: 'The Hollow Tree',
    silo:  'halloween',
    body: `
Transform the subject into The Hollow Tree, preserving unmistakable facial likeness. Their human form becomes ancient twisted black wood, recognizable face carved naturally into cracked bark, with deep hollow fractures glowing amber from within. Massive roots form the body, dead branches crown the head, and ghostly faces emerge subtly from the wood. Epic photoreal folk horror, ancient, terrifying, monumental. face should be projecting outward from wood. mouth open. Skin matches trees surface
Background: A dead primordial forest surrounds a circle of enormous standing stones, its trees twisted into unnatural shapes through dense ground fog. The upper third fades into black branches silhouetted against an enormous sickly harvest moon.`,
    // REWRITTEN and re-locked. The first version's face sat flat in the
    // bark and read as texture. "projecting outward" and "mouth open" are
    // what make it a person trapped in the wood.
  },

  night_bloom: {
    id:    'night_bloom',
    label: 'The Night Bloom',
    silo:  'halloween',
    body: `
Transform the subject into The Night Bloom. Their recognizable human form is overtaken by  black nocturnal flowers, thorned vines and glossy petals growing through skin and gothic clothing, with faint violet bioluminescence glowing from within each blossom. Epic photoreal botanical horror, beautiful, sinister, supernatural, intensely detailed. skin is a deep dark purple with spider cracks that blue light shines through No text. Hair is in the same style but black and oily. Subjects face should be at least 15% of image. one hand is reaching out with strong foreshortening. hand should be 20% of image
Background: A forbidden midnight garden surrounds a ruined gothic conservatory, filled with enormous dark flowers opening beneath moonlight and vines consuming the architecture. The upper third fades into deep violet-black fog, twisted branches and a dim crescent moon.`,
  },

  halloween_monarch: {
    id:    'halloween_monarch',
    label: 'Lord / Lady of Halloween',
    silo:  'halloween',
    body: `Transform the subject into the supreme Lord or Lady of Halloween while preserving exact facial identity. Recognizable human face transformed with subtle cracked pumpkin texture and supernatural ember light, enormous twisted black crown, raven feathers, bones, thorns, gothic armor and spectacular burning cloak. Epic photoreal dark fantasy horror, terrifying, majestic, impossibly elaborate. the subjects face is stoic and reserved. the skin is pale
Background: An entire Halloween kingdom unfolds behind them: haunted castle, dead forest, cemetery, burning pumpkins, circling ravens and rolling supernatural fog. The upper third darkens dramatically around an enormous eclipsed harvest moon, storm clouds and distant castle spires.`,
    // The closer. It gathers the whole room into one frame and works
    // because the face stays quiet in the middle of it.
  },
}

export const HALLOWEEN_WALLPAPER_IDS = Object.keys(HALLOWEEN_WALLPAPERS)
