// lib/v1/groups/groups-experimental.ts
//
// Experimental / custom-scene effects for the Groups silo.
// v2 (2026-07-11) — REFRAME: every effect is a hyper-realistic 3D-rendered
// ILLUSTRATION of the group — a crafted, dimensional creation, never a
// photograph and never a flat 2D image.
//
// Why v1 failed: v1 told each effect to fill the frame with its own flat
// scene, so they rendered as flat digital illustrations (off-brand) — and
// the period/photo effects (armor, daguerreotype, victorian) drifted into
// literal photography. v2 fixes both:
//   • CREATION_ANCHOR locks dimensionality + "rendered creation, not a photo"
//     for ALL effects (the analog of the Houses STRUCTURE_FIDELITY tail plus
//     a physical-presence clause).
//   • Each body reintroduces the effect as a TANGIBLE OBJECT with real depth:
//       - rendered-object creations: cubism (faceted sculpture), magic_energy
//         (energy sculpture), art_nouveau (relief), armor/elizabethan/victorian
//         (hyper-real 3D-illustrated figures, NOT photos).
//       - artwork-object creations: impressionist (impasto with real relief),
//         charcoal_chalk / pencil_sketch (drawing on real paper), ukiyo_e
//         (printed panel object), daguerreotype (silvered plate + case),
//         film_noir (rendered noir creation, not a photo).
//
// Routing unchanged: request.experimental_effect → buildGroupsExperimentalPrompt;
// preset_id / location_id ignored. NB2-native, realistic (per-figure) pipeline.
// Own-scene: refine + outpaint forced off in the generator.

import type { GroupsExperimentalEffectId } from './groups-shared'
import { GROUPS_EXPERIMENTAL_LABELS } from './groups-shared'

// ── UNIVERSAL CREATION + LIKENESS ANCHOR ──────────────────────
const CREATION_ANCHOR = `A hyper-realistic 3D-rendered illustration of the exact people in the reference photograph(s) — a crafted, dimensional creation with real depth, sculptural form, volume, and studio light falling across its surfaces. This is a MADE artwork: it has physical presence and three-dimensional form. It is NEVER a photograph and NEVER a flat 2D image. Every person is included and clearly recognizable as themselves — their own face, age, and character preserved — arranged at honest relative heights: adults at adult proportions, children at child proportions, infants at infant proportions. No one added, no one dropped, no faces blended together or swapped between people.`

const COMPOSITION = `Fill the frame with the group; tight, generous composition, the creation the clear subject in refined gallery light.`

type ExperimentalMode = 'costume' | 'interpretive'

interface GroupsExperimentalEffect {
  id:    GroupsExperimentalEffectId
  mode:  ExperimentalMode
  body:  string
  avoid: string
}

// Ordered — the UI renders one Curator button per entry in this order.
export const GROUPS_EXPERIMENTAL_EFFECTS: GroupsExperimentalEffect[] = [
  {
    id: 'ukiyo_e',
    mode: 'interpretive',
    body:
      `The medium is a traditional Japanese ukiyo-e woodblock print — but realized as a tangible, dimensional printed PANEL: heavy washi paper with visible deckled edges and a slight curl, the embossed impression of the block pressed into the fibres, the ink sitting on the surface with faint relief. Flat planes of color and confident dark key-block outlines describe the group; a graded sky and stylized cloud band behind them; a small red artist's seal and a hand-cut border at one corner. The panel is a real object on a soft neutral ground, raking light catching the paper's texture and edge.`,
    avoid:
      `Avoid a flat full-bleed image with no edges — this is a physical printed panel with paper depth, edges, curl, and real raking light. Keep the figures in woodblock style; never drop or merge people.`,
  },
  {
    id: 'art_nouveau',
    mode: 'interpretive',
    body:
      `The medium is an Art Nouveau relief in the Mucha tradition, realized as a dimensional crafted OBJECT — the group modeled in low relief within an ornamental panel of flowing whiplash lines, curling floral tendrils, and arcs of stylized hair and drapery, with inset stained-glass sections that glow where light passes through. Raised gilded outlines and carved organic ornament stand off the surface; a muted jewel palette of sage, peacock, honeyed gold, and rose. Lit as a real relief object, shadow gathering in the carved recesses.`,
    avoid:
      `Avoid a flat poster or full-bleed illustration — this is a dimensional relief with raised ornament, real depth, and cast shadow. Keep each face graceful and recognizable; never drop or merge people.`,
  },
  {
    id: 'cubism',
    mode: 'interpretive',
    body:
      `The medium is a cubist SCULPTURE — the group realized as a dimensional faceted sculptural object, each face and figure built from interlocking planes that read from several angles at once, standing in real space with volume, weight, and cast shadow. Every person's distinctive features still appear and stay recognizable, recombined across the faceted planes rather than flattened. Restrained Braque-and-Picasso palette of ochre, umber, grey-green, and tan; matte sculpted surfaces; gallery light raking across the facets.`,
    avoid:
      `Avoid a flat cubist painting — this is a three-dimensional faceted sculpture with real depth and cast shadow. Never erase anyone or merge two people into one.`,
  },
  {
    id: 'daguerreotype',
    mode: 'interpretive',
    body:
      `The medium is an 1840s daguerreotype, realized as a real physical OBJECT: a polished silvered copper plate seated in a hinged case with an embossed brass mat and pressed-velvet lining. The group's image sits IN the plate in ghostly silver monochrome, shifting from positive to shadow-negative as the mirror-bright surface catches the light; faint tarnish blooms creep in from the edges. The cased plate rests on a dark surface, tilted so the silver image resolves out of the mirror sheen — a tangible antique artifact.`,
    avoid:
      `This is the silvered PLATE-and-CASE object — do NOT render an ordinary sepia photograph or a period-costume studio photo, and do NOT confuse it with the Victorian/Elizabethan looks. Keep the mirror-metal plate, the hinged case, and the brass mat. Faces recognizable in the silver; never drop or merge people.`,
  },
  {
    id: 'film_noir',
    mode: 'interpretive',
    body:
      `The medium is a 1940s film-noir scene realized as a hyper-real 3D-rendered ILLUSTRATION — the group modeled as dimensional figures with real sculptural volume under dramatic low-key chiaroscuro: hard side light carving deep shadow, venetian-blind shadow stripes, a haze of drifting smoke, rich silver-monochrome tonality, 1940s styling. Cinematic, moody, and unmistakably a crafted rendered creation.`,
    avoid:
      `Avoid a real photograph or photographic film grain — this is a rendered 3D illustration with sculptural depth, not a photo. Keep it monochrome and dramatically lit; faces recognizable even in shadow; never drop or merge people.`,
  },
  {
    id: 'impressionist',
    mode: 'interpretive',
    body:
      `The medium is a thick impasto impressionist oil painting realized as a tangible painted OBJECT — the paint built up in heavy palette-knife and loaded-brush strokes that physically stand off the canvas in visible ridges and peaks, raking light catching the crests of the paint and casting tiny shadows in the troughs. Broken color and dabbed complementary hues describe the group; each face stays readable and recognizable. A real, textured painted surface with genuine relief.`,
    avoid:
      `Avoid a smooth flat digital image — the paint has real relief, thickness, and raking-light shadow across the surface. Never drop or merge people.`,
  },
  {
    id: 'charcoal_chalk',
    mode: 'interpretive',
    body:
      `The medium is a charcoal-and-chalk drawing realized as a physical artwork OBJECT — rendered on real warm toned paper with visible tooth and fibre, rich velvety charcoal blacks, smudged mid-tones, and bright white chalk highlights sitting on the surface. Some areas finished, others left as loose construction line. Presented and lit as a tangible sheet with edges and subtle surface texture, raking light grazing the paper.`,
    avoid:
      `Avoid a flat full-bleed digital image — this is a real drawn sheet with paper texture, edges, and surface light. Faces recognizable; never drop or merge people.`,
  },
  {
    id: 'pencil_sketch',
    mode: 'interpretive',
    body:
      `The medium is a graphite pencil sketch realized as a physical artwork OBJECT — fine crosshatching and tonal shading on real white paper with visible tooth, confident contour lines, some passages fully rendered and others left as light construction line, the graphite catching a faint sheen. Presented and lit as a tangible drawn sheet with edges and surface texture.`,
    avoid:
      `Avoid a flat full-bleed digital image — this is a real graphite drawing on paper with texture, edges, and surface sheen. Faces recognizable; never drop or merge people.`,
  },
  {
    id: 'armor',
    mode: 'costume',
    body:
      `The group realized as hyper-real 3D-illustrated figures wearing magnificent ornate engraved plate armor — burnished steel and dark iron chased with gold filigree, etched patterns, and gemstone accents, fitted across shoulders, chest, and arms. Each person's face, skin, and hair are their own — real and recognizable, NOT metal; heads bare or open-helmed so every face shows. Armor scaled to each figure, children in fitted armor at child scale. A grand rendered creation in a hall of banners and warm light.`,
    avoid:
      `Avoid a real photograph or a cheap costume-party look — this is a hyper-real rendered 3D creation, not a photo. Avoid metal faces and closed helmets. Never drop or merge people.`,
  },
  {
    id: 'elizabethan',
    mode: 'costume',
    body:
      `The group realized as hyper-real 3D-illustrated figures in richly detailed 16th-century Elizabethan finery — high starched lace ruff collars, embroidered brocade doublets and gowns with pearls and gold thread, sumptuous period fabric with real sheen and weight. Hair and styling to the era, children in period dress at child scale. Each person's face, skin, and hair are their own — real and recognizable. Composed as a grand rendered court-portrait creation with old-master light.`,
    avoid:
      `Avoid a real photograph or a costume-party look — this is a hyper-real rendered 3D creation, not a photo. Avoid modern clothing and bare shoulders. Never drop or merge people.`,
  },
  {
    id: 'victorian',
    mode: 'costume',
    body:
      `The group realized as hyper-real 3D-illustrated figures in refined 19th-century Victorian attire — high-collared coats, cravats and waistcoats, or elegant high-necked lace-trimmed dresses with cameo brooches, fabric rendered with real weight and sheen. Hair and styling to the era, children in period dress at child scale. Each person's face, skin, and hair are their own — real and recognizable. Composed as a dignified rendered family-portrait creation in muted rich tones.`,
    avoid:
      `Avoid a real photograph or a costume-party look — this is a hyper-real rendered 3D creation, not a photo. Avoid modern clothing and bare shoulders. Never drop or merge people.`,
  },
  {
    id: 'magic_energy',
    mode: 'interpretive',
    body:
      `The group realized as a dimensional SCULPTURE of pure glowing magical energy — each person given three-dimensional form by swirling luminous energy, flowing ribbons of light, drifting embers, and crackling arcs of violet, gold, cyan, and rose that coalesce into their shape and radiate light into the dark. Brighter and denser at each head, shoulders, and chest; thinning into wisps, sparks, and floating motes at the edges where the forms dissolve. Threads of energy arc between the figures. Real volumetric depth and glow — a sculptural creation of light. Each face clearly defined and recognizable, formed from light, never skin.`,
    avoid:
      `Avoid a flat 2D graphic or glow painted on a solid body — the energy IS the dimensional structure, with volume and depth, breaking into wisps at the edges. Bright cores, soft falloffs. Keep every face recognizable; never drop or merge people.`,
  },
]

// ── LOOKUPS ───────────────────────────────────────────────────
const BY_ID: Record<GroupsExperimentalEffectId, GroupsExperimentalEffect> =
  GROUPS_EXPERIMENTAL_EFFECTS.reduce((m, e) => {
    m[e.id] = e
    return m
  }, {} as Record<GroupsExperimentalEffectId, GroupsExperimentalEffect>)

export function isGroupsExperimentalEffect(
  id: string,
): id is GroupsExperimentalEffectId {
  return Object.prototype.hasOwnProperty.call(BY_ID, id)
}

// Ordered {id,label} list for the Curator UI.
export function groupsExperimentalButtons(): {
  id: GroupsExperimentalEffectId
  label: string
}[] {
  return GROUPS_EXPERIMENTAL_EFFECTS.map(e => ({
    id:    e.id,
    label: GROUPS_EXPERIMENTAL_LABELS[e.id],
  }))
}

// ── FULL-CUSTOM EXPERIMENTAL PROMPTS ──────────────────────────
// Same pattern as CUSTOM_MATERIAL_PROMPTS in groups-prompt.ts: effects whose
// tuned standalone prompt (transform + likeness + medium + staging + avoid,
// all baked in) outperforms the anchor+body+avoid assembly. When present,
// the prompt is used VERBATIM and the builder skips the wrapper entirely.
// Rich-tuned, validated live in NB2 — do not "minimize."
const CUSTOM_EXPERIMENTAL_PROMPTS: Partial<Record<GroupsExperimentalEffectId, string>> = {
  victorian: `Transform the uploaded group portrait into a refined Victorian family portrait while preserving every person's identity, facial features, expression, hairstyle, age, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Dress every person in elegant nineteenth-century Victorian clothing with beautifully tailored coats, waistcoats, cravats, lace, bustled dresses, cameo jewelry, gloves, and richly textured fabrics appropriate to each individual. Preserve every recognizable face while adapting hairstyles naturally to the Victorian era. Children wear authentic period clothing scaled appropriately.
Place the family inside an elegant Victorian drawing room filled with warm natural daylight, refined woodwork, tasteful furnishings, and understated architectural detail that supports rather than distracts from the portrait.
Ultra-photorealistic historical portraiture, physically accurate lighting, medium-format camera, HDR, exceptional textile realism, masterpiece craftsmanship.
Avoid: modern clothing, costume party, fantasy styling, cartoon, duplicate people, distorted faces, CGI, cropped people.`,

  elizabethan: `Transform the uploaded group portrait into an elegant Elizabethan family portrait while preserving every person's identity, facial features, expression, hairstyle, age, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Dress every person in magnificent sixteenth-century Elizabethan clothing featuring embroidered brocade, velvet, lace ruffs, pearls, gold thread, richly layered fabrics, and period tailoring. Children wear historically appropriate versions matching the adults. Preserve every recognizable face while naturally adapting hairstyles to the period.
Place the group within a refined great hall softly illuminated by warm natural window light. The architecture remains elegant and understated while emphasizing the family.
Ultra-photorealistic historical portraiture, physically accurate lighting, medium-format camera, HDR, luxurious textile detail, masterpiece quality.
Avoid: costume party, fantasy clothing, modern fashion, cartoon, duplicate people, distorted faces, CGI, cropped people.`,

  armor: `Transform the uploaded group portrait into a gathering of legendary heroes wearing magnificent ceremonial armor while preserving every person's identity, facial features, expression, hairstyle, age, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Every face remains completely visible and instantly recognizable. The armor is individually tailored to each person and features engraved steel, burnished iron, gold filigree, leather straps, embossed ornament, gemstones, layered plates, and exceptional medieval craftsmanship. Children wear proportionally appropriate armor matching the adults.
The group stands together naturally inside a magnificent stone hall illuminated by warm sunlight streaming through tall windows. The environment supports the composition without overwhelming the people.
Ultra-photorealistic fantasy realism, physically accurate lighting, medium-format camera, HDR, exceptional craftsmanship.
Avoid: closed helmets, metal faces, fantasy monsters, oversized weapons, cartoon armor, duplicate people, distorted anatomy, CGI, cropped people.`,

  magic_energy: `Transform the uploaded group portrait into a single monumental sculpture composed entirely of living magical energy. Preserve every person's identity, facial features, expression, hairstyle, age, clothing silhouette, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified three-dimensional composition with complete physical volume formed entirely from luminous energy. Every figure remains fully recognizable while constructed from flowing ribbons of light rather than solid matter.
The energy consists of brilliant violet, cyan, gold, sapphire, emerald, and rose light woven together into dynamic volumetric forms. Dense luminous cores define faces, torsos, and hands while elegant ribbons, sparks, embers, glowing particles, and electrical arcs flow outward and connect naturally between figures. Light itself forms the structure rather than glowing around solid bodies.
The surrounding environment is dark and understated, allowing the radiant sculpture to illuminate itself and the nearby ground with realistic volumetric glow.
Ultra-photorealistic volumetric lighting, physically accurate light transport, HDR, medium-format camera, extraordinary detail.
Avoid: superheroes, flames, smoke people, neon outlines, glowing skin, cartoon, duplicate people, distorted faces, CGI, cropped composition.`,

  daguerreotype: `Transform the uploaded group portrait into an authentic nineteenth-century daguerreotype while preserving every person's identity, facial features, expression, hairstyle, age, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one physical antique daguerreotype housed inside an elegant hinged presentation case lined with velvet. The image exists on a polished silver-plated copper surface displaying realistic mirror-like reflections that shift between positive and negative depending on the viewing angle.
The plate exhibits subtle tarnish, delicate age patina, embossed brass matting, fine handcrafted detail, and exceptional historical authenticity. Preserve recognizable faces while naturally adapting clothing and styling to the mid-1800s. The image remains sharp within the reflective silver surface rather than appearing as a printed photograph.
Display the opened case beneath soft museum lighting that enhances the reflective silver plate without obscuring the portrait.
Ultra-photorealistic artifact photography, physically accurate optics, medium-format camera, HDR, museum-quality preservation.
Avoid: sepia photograph, paper print, modern photo, cartoon, CGI, duplicate people, distorted faces, cropped case.`,

  film_noir: `Transform the uploaded group portrait into a hyper-real cinematic film noir scene while preserving every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one cohesive three-dimensional cinematic composition with realistic physical presence and depth. Every person remains fully recognizable while naturally integrated into the dramatic lighting.
Render in rich silver monochrome with deep blacks, luminous highlights, dramatic chiaroscuro, subtle atmospheric haze, soft cigarette smoke, rain-soaked reflections, venetian-blind shadows, and authentic 1940s cinematic mood. Clothing becomes refined 1940s formal attire while preserving each person's individuality. Faces remain naturally illuminated and recognizable despite the dramatic contrast.
Place the group within an elegant noir environment with understated architectural details that support the composition without distracting from the subjects.
Ultra-photorealistic cinema still, physically accurate lighting, medium-format camera, HDR, exceptional tonal range, timeless Hollywood craftsmanship.
Avoid: color image, modern clothing, cartoon, illustration, heavy film grain, duplicate people, distorted faces, CGI, cropped people.`,

  ukiyo_e: `Transform the uploaded group portrait into a handcrafted Japanese ukiyo-e woodblock print while preserving every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified physical print on handmade washi paper. Preserve recognizable faces while interpreting the scene through elegant woodblock carving, bold key lines, flat layered color, delicate gradients, carved registration, and traditional composition. The print remains a tangible handcrafted object rather than a digital illustration.
The paper displays natural fibers, deckled edges, embossed printing impressions, slight curling, visible ink sitting above the paper, and subtle handmade imperfections. Include a traditional artist seal integrated naturally into the composition.
Present the artwork beneath refined gallery lighting. Soft raking sunlight reveals the paper fibers, carved impressions, and ink texture while the gallery remains understated.
Ultra-photorealistic artwork photography, medium-format camera, HDR, exceptional printmaking craftsmanship.
Avoid: anime, manga, flat digital art, cartoon, CGI, duplicate people, distorted faces, cropped artwork.`,

  art_nouveau: `Transform the uploaded group portrait into a handcrafted Art Nouveau sculptural relief while preserving every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified decorative artwork with graceful flowing forms, elegant sculptural depth, organic ornamentation, curling botanical motifs, gilded accents, stained-glass inlays, and refined dimensional relief. Preserve recognizable facial likenesses while integrating each figure into the ornamental composition.
The artwork displays luxurious craftsmanship with carved flowing lines, raised metallic borders, jewel-toned stained glass, polished bronze details, and beautifully sculpted floral forms. The relief possesses genuine physical depth rather than appearing flat.
Display beneath elegant museum lighting where soft volumetric sunlight enhances the carved ornament, stained glass, and sculptural depth.
Ultra-photorealistic fine-art photography, medium-format camera, HDR, museum-quality craftsmanship.
Avoid: flat poster, illustration, wallpaper, duplicate people, distorted faces, CGI, cropped artwork.`,

  cubism: `Transform the uploaded group portrait into a monumental Cubist sculpture while preserving every person's identity, facial features, expression, hairstyle, age, clothing, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified sculptural artwork with complete three-dimensional volume. Every figure is constructed from interlocking geometric planes and faceted forms that reinterpret anatomy while remaining clearly recognizable. Preserve facial identity through intelligently abstracted structure rather than distortion.
The sculpture features matte stone and bronze-like surfaces with restrained tones of ochre, umber, gray, slate, and muted earth colors. Crisp intersecting planes create dramatic light and shadow while preserving convincing physical depth and mass.
Display on a circular white marble pedestal inside a refined museum gallery beneath a skylight. Volumetric sunlight emphasizes the intersecting planes and sculptural geometry while the gallery remains understated.
Ultra-photorealistic museum photography, physically accurate lighting, medium-format camera, HDR, masterpiece craftsmanship.
Avoid: flat painting, Picasso copy, low-poly, voxel, fractured anatomy, duplicate people, distorted faces, CGI, cropped sculpture.`,

  pencil_sketch: `Transform the uploaded group portrait into a museum-quality graphite drawing while preserving every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified physical drawing on premium white artist paper. Fine graphite lines, crosshatching, tonal rendering, construction marks, and subtle blending produce realistic depth while preserving recognizable faces and expressions. Clothing and backgrounds remain artistically simplified without losing the original composition.
The paper shows visible tooth, delicate graphite sheen, layered pencil strokes, erased construction lines, and subtle smudging. The graphite catches light realistically while maintaining the handcrafted appearance of a master drawing.
Display the finished artwork beneath elegant gallery lighting. Gentle raking sunlight enhances the paper texture and metallic graphite reflections while the gallery remains secondary.
Ultra-photorealistic artwork photography, medium-format camera, HDR, exceptional draftsmanship.
Avoid: digital sketch, vector art, cartoon, illustration, CGI, duplicate people, distorted faces, missing people, cropped artwork.`,

  charcoal_chalk: `Transform the uploaded group portrait into a master charcoal and white chalk drawing while preserving every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified physical drawing on heavyweight toned paper. Rich compressed charcoal establishes deep blacks while white chalk builds highlights across faces, clothing, and hands. Preserve recognizable facial likenesses with refined draftsmanship while allowing clothing and backgrounds to become expressive through confident marks and blending.
The paper displays visible tooth, soft fibers, charcoal dust, finger blending, erased highlights, construction lines, and subtle fixative texture. The drawing possesses real physical depth created by layered media rather than appearing digitally printed.
Present the drawing under refined gallery lighting. Soft raking sunlight reveals the paper texture, charcoal buildup, and chalk sitting physically above the paper surface.
Ultra-photorealistic artwork photography, medium-format camera, HDR, physically accurate lighting, museum presentation.
Avoid: digital sketch, flat illustration, clean vector lines, cartoon, colored pencil, CGI, duplicate people, distorted faces, cropped artwork.`,

  impressionist: `Transform the uploaded group portrait into a handcrafted impressionist oil painting while preserving every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Never add, remove, duplicate, replace, or reposition people.
Create one unified physical artwork with visible three-dimensional paint relief rather than a flat digital image. Heavy palette-knife strokes, loaded brushwork, and thick impasto physically build the painting from the canvas surface. Faces remain refined and recognizable while broader clothing, backgrounds, and lighting dissolve into expressive broken color and confident brushwork.
The canvas displays richly layered oil paint with visible peaks, ridges, brush hairs, palette knife texture, and subtle cracking found in master oil paintings. Warm and cool colors blend optically rather than digitally. Light rakes across the paint revealing true physical depth and texture.
The finished artwork hangs in an elegant museum gallery under natural skylight illumination. Soft volumetric sunlight grazes the thick paint surface, creating realistic highlights and tiny shadows within the impasto while the gallery remains understated.
Ultra-photorealistic fine-art photography, physically accurate lighting, medium-format camera, HDR, exceptional paint texture, museum masterpiece.
Avoid: digital painting, smooth brushwork, flat illustration, watercolor, cartoon, CGI, duplicate people, distorted faces, missing people, cropped artwork.`,
}

// ── BUILDER ───────────────────────────────────────────────────
// Full-custom effects return verbatim. Otherwise:
// CREATION_ANCHOR (dimensionality + likeness) → effect body → avoid →
// composition. No scale/margin and no plaque.
export function buildGroupsExperimentalPrompt(input: {
  effectId: GroupsExperimentalEffectId
}): string {
  const custom = CUSTOM_EXPERIMENTAL_PROMPTS[input.effectId]
  if (custom) return custom

  const fx = BY_ID[input.effectId]
  if (!fx) throw new Error(`unknown groups experimental effect: ${input.effectId}`)

  return [
    CREATION_ANCHOR,
    fx.body,
    fx.avoid,
    COMPOSITION,
  ].join('\n\n')
}
