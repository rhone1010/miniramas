// lib/v1/groups/groups-prompt.ts
//
// Minimal prompt builder for the Groups silo.
//
// NB2 (google/nano-banana-2 on Replicate) understands a sentence like
// "group photo rendered as 3D bronze statue" natively — it produces clean,
// recognizable, multi-figure sculptural renders without any of the prompt
// machinery the silo used to ship with (700+ lines of emergence blocks,
// merging blocks, face rules, plinth instructions, per-subject descriptors,
// height-class warnings, etc.). Every one of those blocks was fighting the
// model rather than helping it.
//
// Empirically validated on:
//   - 12-subject wedding party, navy + sage, well-lit outdoors → spot on
//   - 17-subject multi-generation family with four toddlers in laps → spot on,
//     including correct child proportions which the old pipeline needed
//     explicit HEIGHT_CLASS guard language to maintain
//
// The whole assembled prompt is between 11 and 17 words. NB2 figures out:
//   - exact subject count (no need to interpolate it)
//   - per-figure likeness (faceswap is no longer the default)
//   - child vs adult proportions
//   - plinth / base shape and material
//   - surrounding setting / lighting / props from the location phrase
//
// If a render misses likeness on a particular face, that's the analyzer's
// job to flag and the user's decision via the QA gate — not something this
// prompt should try to prevent with directives the model would just ignore.

import type { GroupsPresetId, LocationId, Scale } from './groups-shared'

const MATERIAL_PHRASE: Record<GroupsPresetId, string> = {
  bronze:       'bronze statue',
  alabaster:    'alabaster statue',
  marble:       'marble statue',
  wood:         'carved wood statue',
  iron:         'hand-forged iron sculpture',
  resin:        'hand-painted resin figurine',
  plushy:       'soft handmade plushy figures',
  // ── Bucket A — ported from Portraits (minimal noun phrases) ──
  ebony:            'polished ebony wood statue',
  walnut:           'carved walnut wood statue',
  stone:            'carved stone statue',
  reclaimed_bronze: 'weathered bronze statue reclaimed by nature, verdigris patina with soft moss and lichen',
  blown_glass:      'hand-blown translucent art-glass sculpture with swirling ribbons of color',
  amber:            'golden amber sculpture, the whole group suspended together inside a single translucent drop',
  nebula_resin:     'translucent nebula-resin sculpture with swirling galaxies and starlight suspended inside',
  fantasy_crystal:  'solid faceted crystal sculpture carved fully in the round — deep clear glassy crystal with sharp cut facets, strong internal refraction and rainbow caustics, rich saturated color and real depth, lit from within; full sculptural volume and weight, never a flat panel, slab, or low-poly cutout',
  // reward (Together) — Legacy Edition, the flagship. Routed to
  // CUSTOM_MATERIAL_PROMPTS; placeholder only.
  legacy_edition:   '__custom_material_prompt__',
}

// Location phrases are written as directorial cues, not just labels. Each
// captures the staging the silo is selling — scale, framing, lighting,
// background register. NB2 reliably picks these up when phrased as visual
// nouns rather than abstract design language.
//
// Tea House — the sculpture is on a small Japanese display base inside a
//   traditional tea house. The view is filled by the sculpture but the
//   "scaled like a tabletop model" cue keeps it from filling the room.
//   Cherry blossoms outside the shoji screens set the aesthetic register.
//
// Mantel — sculpture is the hero on an elegant marble mantel. The great
//   room behind it (skylights, ornate trim) is softly blurred so the
//   sculpture stays the focal subject. No directive about the mirror —
//   trust the model to handle reflection logic.
//
// Pedestal — round marble pedestal in a museum gallery. Gallery lighting
//   PLUS a volumetric beam from a skylight above. "Natural light from a
//   skylight" implies the source without naming a visible fixture.
//
// Plushy Shelf and Wall Mount remain in the type for API compatibility
// (Art Gallery may pick them up later) but no Groups material routes here.
const LOCATION_PHRASE: Record<LocationId, string> = {
  mantel:       'as the focal subject on an elegant marble mantel in an upscale sun-lit great room with skylights and ornate window trim, the room softly blurred behind the sculpture',
  tea_house:    'on a small Japanese-style display base inside a traditional tea house, scaled like a tabletop model, cherry blossom trees visible through shoji screen doors',
  pedestal:     'on a round marble pedestal in a museum gallery, illuminated by a volumetric beam of natural light streaming from a skylight above',
  plushy_shelf: "on a child's plush-toy shelf",
  wall_mount:   'mounted on a gallery wall',
}

/**
 * Build the prompt sent to NB2 for a Groups render.
 *
 * Scale handling:
 *   - `'fill'` — render tight, append composition note. Margins are retired
 *     product-wide, so this is effectively the only path the UI sends.
 *
 * Plaques and inscriptions are RETIRED product-wide (2026-07-11). The base
 * always renders clean and unmarked — we positively state that rather than
 * relying on a negative, since NB2 otherwise confabulates a fictional
 * surname on the base ("The Anderson Family Reunion - Autumn 1980").
 */
// ── FULL-CUSTOM MATERIAL PROMPTS ──────────────────────────────
// A few materials have optics/physics the minimal one-line phrase can't
// hold — it collapses them flat (crystal went low-poly/panel). Those ship a
// full standalone prompt here and BYPASS the minimal template entirely
// (transform + likeness + dimensionality + material physics + staging +
// camera + avoid all baked in). Rich-tuned, validated live in NB2 — treat
// as verbatim; do not "minimize."
//
// NOTE: these bake their own staging, so the location picker does not apply
// to them (crystal is locked to its tuned museum/skylight scene).
const CUSTOM_MATERIAL_PROMPTS: Partial<Record<GroupsPresetId, string>> = {
  legacy_edition: `Transform the uploaded group portrait into a single monumental sculpture carved from one block of flawless white statuary marble — the flagship, highest-tier artwork on the platform. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified sculpture with complete three-dimensional volume, convincing anatomical depth, and natural overlap between figures. Every figure is fully carved in the round while remaining instantly recognizable, with crisp facial likenesses, flowing hair, clothing folds, and hands rendered with master craftsmanship.
The marble is cool luminous white Carrara/Statuario stone — softly polished with a gentle sheen, subtle cool-grey veining flowing naturally through the merged masses, and a few honest hand-tooled passages beside the polished planes. Cool white throughout, never cream, ivory, tan, or warm. No paint, no source-photo colors carry through.
Display on a dark stone-and-bronze plinth inside an elegant museum gallery beneath a single perfect skylight. One controlled key of soft daylight with gentle fill and clean falloff models the form; deep quiet negative space surrounds the piece; master, confident, balanced composition.
Absolute ceiling of realism and craftsmanship — refined textures, rich depth, timeless beauty. Restraint over spectacle: nothing exaggerated, nothing flashy, no added ornament, no novelty, no clutter. It should feel impossible to improve, unmistakably the highest tier.
Ultra-photorealistic museum photography, medium-format camera, HDR, physically accurate lighting, masterpiece craftsmanship.
Avoid: warm or cream stone, colored marble, painted surfaces, over-design, excessive ornament, visual clutter, novelty, fantasy, mixing multiple effects, relief carving, flat panel, low-poly, duplicate people, distorted faces, CGI, cropped sculpture.`,

  plushy: `Transform the uploaded group portrait into a collection of premium handcrafted plush figures displayed together as one cohesive scene. Preserve every person's identity, facial features, expression, hairstyle, age, clothing colors, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Each person becomes an adorable handmade plush character with soft rounded forms, stitched construction, embroidered facial features, realistic fabric seams, premium fleece and minky fabrics, gently stuffed proportions, and carefully sewn clothing details. Preserve recognizable facial likenesses while embracing the warmth and charm of handcrafted plush toys.
Arrange the complete group naturally together on a beautifully organized children's display shelf. The plush figures interact naturally while maintaining their original composition and scale relationships. The shelf is warm, inviting, and softly styled without distracting from the characters.
Soft natural window light creates gentle fabric shadows, visible textile textures, and cozy warmth throughout the scene.
Ultra-photorealistic product photography, premium artisan plush craftsmanship, medium-format camera, shallow depth of field, exceptional textile detail.
Avoid: plastic toys, vinyl figures, action figures, flat fabric cutouts, duplicate people, distorted faces, CGI, cropped characters.`,

  nebula_resin: `Transform the uploaded group portrait into a single monumental sculpture cast from translucent nebula resin. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified sculpture with complete three-dimensional volume, convincing anatomical depth, and natural overlap between figures. Every figure is fully sculpted in the round while remaining instantly recognizable.
The resin contains luminous galaxies, colorful nebula clouds, distant stars, cosmic dust, and subtle light within its depth. Rich blues, violets, magentas, and cyan swirl naturally through the translucent material while preserving clear facial details and sculptural form. The cosmic effects exist inside the resin rather than painted on the surface.
Display on a circular white marble pedestal inside an elegant museum gallery beneath a large skylight. Volumetric sunlight illuminates the sculpture, revealing glowing celestial depth and subtle internal light while the gallery remains understated.
Ultra-photorealistic museum photography, physically accurate lighting, medium-format camera, HDR, exceptional craftsmanship.
Avoid: outer space background, floating galaxies, opaque resin, plastic toy, relief carving, flat panel, low-poly, duplicate people, distorted faces, CGI, cropped sculpture.`,

  amber: `Transform the uploaded group portrait into a single monumental sculpture preserved inside one flawless piece of golden amber. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified sculpture with complete three-dimensional volume, convincing anatomical depth, and natural overlap between figures. The entire group is naturally suspended within one continuous amber form while remaining fully recognizable.
The amber displays warm honey and deep golden coloration, exceptional clarity, subtle internal inclusions, realistic resin depth, polished surfaces, beautiful internal light diffusion, and natural optical variation. The figures appear permanently preserved inside the amber while remaining fully sculptural rather than encased as flat silhouettes.
Display on a circular white marble pedestal inside an elegant museum gallery beneath a large skylight. Warm volumetric sunlight passes through the amber creating rich glowing depth and golden illumination while the gallery remains understated.
Ultra-photorealistic museum photography, physically accurate lighting, medium-format camera, HDR, exceptional craftsmanship.
Avoid: insects, fossils, cloudy resin, plastic, relief carving, flat panel, separate statues, low-poly, duplicate people, distorted anatomy, CGI, cropped sculpture.`,

  blown_glass: `Transform the uploaded group portrait into a single monumental sculpture formed from hand-blown studio art glass. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified sculpture with complete three-dimensional volume, convincing anatomical depth, and natural overlap between figures. Every figure is fully formed in the round while remaining instantly recognizable.
The sculpture is created from exceptionally clear hand-blown glass with flowing ribbons of translucent color suspended within the material. Elegant internal swirls, controlled bubbles, smooth organic transitions, brilliant transparency, realistic refraction, polished surfaces, luminous depth, and subtle color blending create a museum-quality glass artwork. Preserve crisp facial likenesses while allowing the flowing glass to enhance rather than obscure the figures.
Display on a circular white marble pedestal inside an elegant museum gallery beneath a large skylight. Dramatic volumetric sunlight illuminates the sculpture, creating realistic internal glow, colorful caustics, and brilliant edge highlights while the gallery remains understated.
Ultra-photorealistic museum photography, physically accurate optics, medium-format camera, HDR, exceptional craftsmanship.
Avoid: opaque glass, cracked glass, frosted glass, plastic, resin, relief carving, flat panel, low-poly, duplicate people, distorted faces, CGI, cropped sculpture.`,

  reclaimed_bronze: `Transform the uploaded group portrait into a single monumental sculpture cast in reclaimed bronze and naturally aged through time. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified sculpture with complete three-dimensional volume, convincing anatomical depth, and natural overlap between figures. Every figure is fully sculpted in the round with exceptional craftsmanship while remaining instantly recognizable.
The bronze displays rich verdigris patina, aged oxidation, subtle weathering, patches of soft moss and delicate lichen nestled naturally within recessed areas, while polished bronze highlights remain visible on exposed edges and raised details. Crisp facial features, flowing hair, clothing folds, and hands emerge beautifully through the aged metal, giving the sculpture a timeless archaeological elegance.
Display on a circular white marble pedestal inside an elegant museum gallery beneath a large skylight. Volumetric sunlight reveals the contrast between polished bronze, aged patina, moss, and sculptural form while the gallery remains understated.
Ultra-photorealistic museum photography, medium-format camera, HDR, physically accurate lighting, masterpiece craftsmanship.
Avoid: rusted scrap metal, broken sculpture, relief carving, flat panel, low-poly, duplicate people, distorted faces, plastic, resin, CGI, cropped sculpture.`,

  stone: `Transform the uploaded group portrait into a single monumental sculpture carved from natural stone. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified sculpture with complete three-dimensional volume, convincing anatomical depth, and natural overlap between figures. Every figure is fully carved in the round while preserving realistic expressions and recognizable likenesses.
The stone displays subtle mineral variation, realistic grain, hand-chiseled detail, softly weathered texture, crisp carved edges, and substantial physical mass. Facial features, flowing hair, clothing folds, and hands remain carefully sculpted while maintaining the timeless appearance of expertly carved natural stone.
Display on a circular white marble pedestal inside an elegant museum gallery beneath a large skylight. Dramatic volumetric sunlight enhances the stone texture and carved depth while keeping the gallery understated.
Ultra-photorealistic museum photography, medium-format camera, HDR, physically accurate lighting, museum-quality craftsmanship.
Avoid: concrete, plastic, resin, relief carving, flat panel, slab, floating heads, separate statues, low-poly, duplicate people, distorted anatomy, CGI, cropped sculpture.`,

  walnut: `Transform the uploaded group portrait into a single monumental sculpture hand-carved from premium walnut hardwood. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified sculpture with complete three-dimensional volume, convincing anatomical depth, and natural overlap. Every figure is fully carved in the round with graceful handcrafted transitions while preserving recognizable facial features.
The walnut displays flowing natural grain, rich chocolate-brown coloration, smooth satin finish, subtle carving marks, realistic end grain, and exceptional artisan craftsmanship. Hair, clothing, hands, and facial features are finely detailed while allowing the natural wood character to remain visible throughout the sculpture.
Display on a circular white marble pedestal inside an elegant museum gallery beneath a large skylight. Warm volumetric sunlight enhances the wood grain and sculptural form while keeping the gallery secondary.
Ultra-photorealistic museum photography, medium-format camera, HDR, physically accurate lighting, exceptional craftsmanship.
Avoid: painted wood, plastic, resin, relief carving, flat panel, floating heads, separate statues, low-poly, duplicate people, distorted faces, CGI, cropped sculpture.`,

  ebony: `Transform the uploaded group portrait into a single monumental sculpture hand-carved from solid polished ebony. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified sculpture with complete three-dimensional volume, convincing anatomical depth, and graceful overlap between figures. Every figure is fully carved in the round with elegant transitions while remaining instantly recognizable.
The ebony displays deep black wood with rich natural grain, mirror-smooth hand-polished surfaces, subtle carved tool marks, luxurious warmth, and exceptional craftsmanship. Fine facial details, flowing hair, clothing folds, and hands are precisely carved while preserving the richness and density of the hardwood.
Display on a circular white marble pedestal inside an elegant museum gallery beneath a large skylight. Warm volumetric sunlight reveals the subtle grain, polished highlights, and sculptural depth while the gallery remains understated.
Ultra-photorealistic museum photography, medium-format camera, HDR, physically accurate lighting, masterpiece craftsmanship.
Avoid: painted wood, plastic, resin, relief carving, flat panel, floating heads, separate statues, low-poly, duplicate people, distorted faces, CGI, cropped sculpture.`,

  marble: `Transform the uploaded group portrait into a single monumental sculpture carved from flawless white marble. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified sculpture with complete three-dimensional volume, convincing anatomical depth, and graceful natural overlap. Every figure is fully carved in the round with exceptional craftsmanship, preserving recognizable expressions and fine details.
The marble displays subtle natural veining, finely polished surfaces, crisp carved edges, soft light diffusion across smooth forms, and timeless museum-quality craftsmanship. Hair, clothing folds, hands, and facial features are delicately sculpted while maintaining elegant classical proportions. The sculpture possesses realistic weight, thickness, and permanence.
Display on a circular white marble pedestal inside an elegant museum gallery beneath a skylight. Dramatic volumetric sunlight enhances the carved forms with soft shadows and refined highlights while the gallery remains understated.
Ultra-photorealistic museum photography, physically accurate lighting, medium-format camera, HDR, exceptional microdetail, masterpiece quality.
Avoid: relief carving, flat panel, slab, floating heads, busts, separate statues, low-poly, duplicate people, distorted faces, plastic, resin, CGI, cropped sculpture.`,

  resin: `Transform the uploaded group portrait into a single premium collector-quality resin sculpture. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified sculpture with complete three-dimensional volume and realistic physical depth. Every figure is fully sculpted in the round with crisp anatomy and natural overlap.
The resin features flawless casting, smooth satin surfaces, subtle hand-painted coloration, realistic skin tones, detailed clothing textures, finely painted eyes, hair, and accessories, with premium collectible craftsmanship comparable to luxury display statues. Preserve realistic facial likenesses while maintaining a handcrafted appearance.
Display on a circular white marble pedestal inside an elegant museum gallery beneath a skylight. Soft volumetric lighting highlights the sculptural detail while remaining secondary to the artwork.
Ultra-photorealistic collector statue photography, medium-format camera, HDR, physically accurate lighting, exceptional craftsmanship.
Avoid: toy, vinyl figure, cartoon proportions, relief carving, flat panel, low-poly, duplicate people, distorted anatomy, plastic shine, CGI, cropped sculpture.`,

  wood: `Transform the uploaded group portrait into a single monumental sculpture hand-carved from fine hardwood. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified sculpture with complete three-dimensional volume, natural overlap, and convincing sculptural depth. Every figure is fully carved in the round with graceful transitions between forms while remaining instantly recognizable.
The wood displays rich natural grain flowing continuously through the sculpture, subtle carving marks, smooth hand-finished surfaces, warm organic coloration, realistic end grain, and exceptional craftsmanship. Fine facial details, flowing hair, clothing folds, and hands are carefully carved while preserving the beauty of the natural timber.
Display on a circular white marble pedestal inside an elegant museum gallery beneath a skylight. Warm volumetric sunlight enhances the wood grain and carved textures while keeping the gallery understated.
Ultra-photorealistic museum photography, medium-format camera, HDR, physically accurate lighting, master woodcarving.
Avoid: painted wood, plastic, resin, relief carving, flat panel, floating heads, separate statues, low-poly, duplicate people, distorted faces, CGI, cropped sculpture.`,

  iron: `Transform the uploaded group portrait into a single monumental sculpture forged from solid hand-worked iron. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified sculpture with complete three-dimensional volume and convincing physical mass. Every figure is fully sculpted in the round with realistic depth, natural overlap, and strong anatomical structure.
The iron displays forged textures, subtle hammer marks, dark charcoal tones with burnished highlights, realistic oxidation, and exceptional craftsmanship. Crisp sculpted faces, hair, clothing, and hands emerge naturally from the forged metal while preserving recognizable likenesses. The sculpture appears heavy, durable, and masterfully fabricated.
Display on a circular white marble pedestal inside an elegant museum gallery beneath a skylight. Dramatic volumetric sunlight reveals the forged textures and subtle metallic reflections without becoming glossy.
Ultra-photorealistic museum photography, physically accurate lighting, medium-format camera, HDR, exceptional detail.
Avoid: chrome, polished steel, plastic, resin, relief carving, flat panel, low-poly, duplicate people, distorted anatomy, CGI, cropped sculpture.`,

  alabaster: `Transform the uploaded group portrait into a single monumental sculpture carved from luminous white alabaster. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified sculpture with complete three-dimensional volume, natural overlap, and convincing anatomical depth. Every head, face, torso, arms, hands, legs, and clothing is fully carved in the round with elegant sculptural transitions, never appearing as a relief, flat panel, or collection of separate statues.
The alabaster is smooth, dense, and finely polished with subtle natural veining, soft translucency around thin edges, warm ivory coloration, and gentle subsurface light transmission. Delicate facial details, flowing hair, fabric folds, and hands are crisply carved while broader forms remain graceful and refined. The sculpture feels handcrafted, timeless, and substantial.
Display on a circular white marble pedestal inside an elegant museum gallery beneath a skylight. Soft volumetric sunlight gently illuminates the stone, revealing its translucent depth and natural mineral character while keeping the gallery understated.
Ultra-photorealistic museum photography, medium-format camera, HDR, physically accurate lighting, exceptional craftsmanship.
Avoid: relief carving, flat panel, slab, floating heads, busts, separate statues, low-poly, duplicate people, distorted faces, plastic, resin, CGI, cartoon, cropped sculpture.`,

  bronze: `Transform the uploaded group portrait into a single monumental sculpture cast in solid bronze. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person.
Create one unified sculptural artwork with complete three-dimensional volume, substantial physical mass, and natural overlap between figures. Every head, face, hair, torso, arms, hands, legs, and clothing is fully sculpted in the round with convincing anatomical depth. The sculpture must read as one cohesive artwork rather than separate statues, busts, or relief carvings.
The bronze is museum-quality with rich warm tones, subtle variations in polished and satin finishes, crisp sculpted detail, realistic cast texture, and beautifully aged highlights across raised surfaces. Fine facial details, hair, clothing folds, and hands remain sharply defined while broader surfaces display smooth sculptural transitions. The metal possesses realistic weight, thickness, edge definition, and craftsmanship with naturally worn high points and slightly darker recessed areas.
Display the sculpture on a circular white marble pedestal inside an elegant museum gallery beneath a large architectural skylight. Dramatic volumetric sunlight reveals the sculptural form with realistic bronze reflections and soft bounce light while keeping the gallery understated and secondary to the artwork.
Ultra-photorealistic museum photography, physically accurate lighting, medium-format camera, HDR, exceptional microdetail, luxury craftsmanship, masterpiece quality.
Avoid: flat panel, bas-relief, wall plaque, slab, cutout, floating heads, busts, separate statues, low-poly, voxel, duplicate people, distorted faces, extra limbs, melted forms, plastic, resin, chrome, painted metal, illustration, cartoon, CGI, cropped sculpture, cropped pedestal.`,

  fantasy_crystal: `Transform the uploaded group portrait into a single monumental sculpture carved from one flawless monolithic block of optical crystal. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified sculpture with complete three-dimensional volume, convincing anatomical depth, and natural overlap between figures. Every figure is fully carved in the round while preserving recognizable facial likenesses and expressions.
The crystal is exceptionally clear, thick, and luxurious with precision-cut gemstone facets that follow the anatomy. Fine facets preserve facial details while larger facets define clothing and structure. The crystal exhibits realistic transparency, internal refraction, total internal reflection, brilliant polished edges, luminous internal light paths, chromatic dispersion, and vivid rainbow caustics with substantial optical depth.
Display on a circular white marble pedestal inside an elegant museum gallery beneath a large skylight. Dramatic volumetric sunlight passes through the sculpture producing brilliant rainbow caustics across the pedestal and polished gallery floor while the gallery remains understated.
Ultra-photorealistic museum photography, physically accurate optics, medium-format camera, HDR, masterpiece craftsmanship.
Avoid: relief carving, flat panel, slab, floating heads, separate statues, low-poly, cloudy glass, frosted glass, cracked crystal, plastic, acrylic, resin, chrome, duplicate people, distorted anatomy, CGI, cropped sculpture.`,
}

export function buildGroupsPrompt(input: {
  presetId:    GroupsPresetId
  locationId:  LocationId
  scale:       Scale
}): string {
  // Full-custom materials bake their own scene — bypass the minimal template.
  const custom = CUSTOM_MATERIAL_PROMPTS[input.presetId]
  if (custom) return custom

  const material    = MATERIAL_PHRASE[input.presetId]
  const location    = LOCATION_PHRASE[input.locationId]
  const composition = input.scale === 'fill' ? ', tight composition' : ''

  return `Group photo rendered as 3D ${material}, ${location}${composition}, with a clean unmarked base.`
}
