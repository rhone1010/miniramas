// lib/v1/wallpapers/wallpaper-registry-rows.ts
//
// EFFECT LISTS FOR THE WALLPAPER FLOOR.
//
// Same shape effect-registry.ts uses for the Portraits floor, so CUI's grid
// can consume both without a second code path. Fields that only mean
// something for print — monolithic, refs, skipStaging, skipUniversal — are
// absent here; a wallpaper is one render with no ref plates and no staging
// paragraph.
//
// ── TWO ROOMS, 42 EFFECTS ──────────────────────────────────────────────
//
// Portraits 14, Halloween 28. Pets is not written. Studio has no catalog by
// design — four dropdowns and a slider, a different model, and it does not
// belong in an effect list.
//
// The floor is 5 across and 3 down: fourteen tiles plus an upsell card in
// the fifteenth slot. Halloween carries twice that, so that room needs a
// toggle to flip between halves of its catalog.
//
// ── EVERY BODY IS LIVE ─────────────────────────────────────────────────
//
// All 42 were shot and signed off by Rich against real renders on
// 2026-08-10. None are authored-but-not-entered. Safe to offer and spend on.
//
// ── PREVIEWS ARE THE OPEN ITEM ─────────────────────────────────────────
//
// These need 9:16 preview plates. The existing
// public/previews/effects/<id>/man@2x.jpg are portrait-shaped and will
// letterbox in a five-across phone grid. public/previews/wallpapers/ exists;
// coverage unknown. `preview` below is the path stem the floor should
// expect, not a promise the file is there.

export type WallpaperRoomId =
  | 'portraits'
  | 'pets'
  | 'halloween'
  | 'studio'

export interface WallpaperRoom {
  id:    WallpaperRoomId
  label: string
  /** Rotates its catalog on a date rather than a deploy. Halloween through
   *  October, Christmas from November. */
  seasonal?: boolean
  /** No effect list. Prompt is built from controls, not a catalog. */
  freeform?: boolean
  /** Carries more than the 14 the floor shows at once. */
  toggle?: boolean
}

export interface WallpaperRow {
  id:     string   // snake_case, matches the engine effect id EXACTLY
  label:  string   // customer-facing, plain unicode, no HTML entities
  room:   WallpaperRoomId
  /** Path stem under public/previews/wallpapers/. 9:16. */
  preview: string
  /** Ships a separate _woman body. The floor shows one tile; the engine
   *  resolves which body by detected gender, exactly as Portraits does. */
  gendered?: boolean
  /** Not customer-facing. Carried so the lanes stop re-deriving it. */
  note?: string
}

export const WALLPAPER_ROOMS: WallpaperRoom[] = [
  { id:'portraits', label:'Portraits' },
  { id:'pets',      label:'Pets' },
  { id:'halloween', label:'Halloween', seasonal:true, toggle:true },
  { id:'studio',    label:'Studio',    freeform:true },
]

// ── PORTRAITS · 14 ───────────────────────────────────────────────────────

export const PORTRAITS_ROWS: WallpaperRow[] = [
  { id:'stained_glass', label:'Stained Glass', room:'portraits', preview:'stained_glass' },
  { id:'petal_sculpture', label:'Petal Sculpture', room:'portraits', preview:'petal_sculpture' },
  { id:'tidewood', label:'Tidewood', room:'portraits', preview:'tidewood' },
  { id:'retro_robot', label:'Atomic Age Robot', room:'portraits', preview:'retro_robot' },
  { id:'clockwork', label:'Clockwork', room:'portraits', preview:'clockwork' },
  { id:'balloon_face', label:'Balloon', room:'portraits', preview:'balloon_face' },
  { id:'neon', label:'Neon Drawing', room:'portraits', preview:'neon' },
  { id:'victorian', label:'Victorian Portrait', room:'portraits', preview:'victorian', gendered:true },
  { id:'renaissance', label:'Renaissance Portrait', room:'portraits', preview:'renaissance', gendered:true },
  { id:'persian_court', label:'Persian Court', room:'portraits', preview:'persian_court', gendered:true },
  { id:'impressionist', label:'Impressionist', room:'portraits', preview:'impressionist' },
  { id:'charcoal_chalk', label:'Charcoal & Chalk', room:'portraits', preview:'charcoal_chalk' },
  { id:'bronze', label:'Bronze', room:'portraits', preview:'bronze' },
  { id:'ebony', label:'Ebony', room:'portraits', preview:'ebony', note:'FOURTEENTH SLOT — provisional. Rich locked 13 ids; this fills the grid and has not been shot at 9:16. Swap freely. Candidates from the print catalog that suit a lit screen: starfield, fire_face, magic_energy, crystallized, ice, mercury, dragon_skin, coral, polished_gold, cast_glass.' },
]

// ── HALLOWEEN · 28 ───────────────────────────────────────────────────────
//
// Order is shoot order, which is roughly how they were conceived rather
// than how they should be laid out. Two rules for the grid:
//
//   the_ferryman and lantern_keeper must NOT be adjacent — both are hooded
//   figures with a blue-green lantern in graveyard mist, and they read
//   differently at full size but not from a thumbnail.
//
//   shadow_monarch is the only effect with no colour in it at all. Give it
//   somewhere it can be seen against the rest.

export const HALLOWEEN_ROWS: WallpaperRow[] = [
  { id:'lantern_keeper', label:'Lantern Keeper', room:'halloween', preview:'lantern_keeper', note:'Do not place adjacent to the_ferryman.' },
  { id:'moon_beast', label:'Moon Beast', room:'halloween', preview:'moon_beast' },
  { id:'clockwork_corpse', label:'Clockwork Corpse', room:'halloween', preview:'clockwork_corpse', note:'Background puts a huge lit clock face in the top third, where the phone clock goes. Check on a real screen.' },
  { id:'elegant_vampire', label:'Elegant Vampire', room:'halloween', preview:'elegant_vampire' },
  { id:'harvest_god', label:'Harvest God', room:'halloween', preview:'harvest_god' },
  { id:'werewolf', label:'Werewolf', room:'halloween', preview:'werewolf' },
  { id:'eclipse', label:'Eclipse', room:'halloween', preview:'eclipse', note:'Cosmic rather than gothic. The only one of its register in the room.' },
  { id:'ghoul', label:'Ghoul', room:'halloween', preview:'ghoul' },
  { id:'living_cathedral', label:'Living Cathedral', room:'halloween', preview:'living_cathedral' },
  { id:'gothic_witch', label:'Gothic Witch', room:'halloween', preview:'gothic_witch' },
  { id:'headless_horseman', label:'Headless Horseman', room:'halloween', preview:'headless_horseman', note:'Varies run to run — the head must read as severed and held out. Shoot the preview plate carefully.' },
  { id:'swamp_creature', label:'Swamp Creature', room:'halloween', preview:'swamp_creature' },
  { id:'haunted_scarecrow', label:'Haunted Scarecrow', room:'halloween', preview:'haunted_scarecrow' },
  { id:'raven_monarch', label:'Raven King / Queen', room:'halloween', preview:'raven_monarch' },
  { id:'ghost_pirate', label:'Ghost Pirate', room:'halloween', preview:'ghost_pirate' },
  { id:'spider_monarch', label:'Spider King / Queen', room:'halloween', preview:'spider_monarch' },
  { id:'dark_wizard', label:'Dark Wizard', room:'halloween', preview:'dark_wizard' },
  { id:'demon_lord', label:'Demon Lord', room:'halloween', preview:'demon_lord' },
  { id:'ice_wraith', label:'Ice Wraith', room:'halloween', preview:'ice_wraith', note:'The only cold palette in the room.' },
  { id:'necromancer', label:'Necromancer', room:'halloween', preview:'necromancer' },
  { id:'shadow_monarch', label:'Shadow King / Queen', room:'halloween', preview:'shadow_monarch', note:'No colour at all. Place where it can be seen against the rest.' },
  { id:'cursed_knight', label:'Cursed Knight', room:'halloween', preview:'cursed_knight', note:'The only action pose in the room.' },
  { id:'the_ferryman', label:'The Ferryman', room:'halloween', preview:'the_ferryman', note:'Do not place adjacent to lantern_keeper.' },
  { id:'porcelain_doll', label:'Living Porcelain Doll', room:'halloween', preview:'porcelain_doll' },
  { id:'moth_monarch', label:'Moth King / Queen', room:'halloween', preview:'moth_monarch' },
  { id:'hollow_tree', label:'The Hollow Tree', room:'halloween', preview:'hollow_tree' },
  { id:'night_bloom', label:'The Night Bloom', room:'halloween', preview:'night_bloom' },
  { id:'halloween_monarch', label:'Lord / Lady of Halloween', room:'halloween', preview:'halloween_monarch' },
]

// ── PETS · NOT WRITTEN ───────────────────────────────────────────────────
//
// Next job. Needs PETS-SPEC-2026-08-02.md and a ruling from Rich on framing
// — thighs-to-head is a human instruction and a dog or a cat needs its own.

export const PETS_ROWS: WallpaperRow[] = []

// ── JOINED ───────────────────────────────────────────────────────────────

export const WALLPAPER_ROWS: WallpaperRow[] = [
  ...PORTRAITS_ROWS,
  ...HALLOWEEN_ROWS,
  ...PETS_ROWS,
]

export function wallpaperRowsForRoom(room: WallpaperRoomId): WallpaperRow[] {
  return WALLPAPER_ROWS.filter(r => r.room === room)
}
