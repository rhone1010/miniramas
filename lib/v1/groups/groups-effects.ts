// lib/v1/groups/groups-effects.ts
//
// THE GROUPS CATALOG. Flat list, one pipeline, NB2 only.
//
// Replaces the style/material/location/scale/arrangement axes entirely.
// There is no GroupsStyleId, no LOCATION_PHRASE, no STYLE_MATERIALS filter
// and no experimental split — Tribal, People Resolving and the twelve
// "experimental" effects are gone, and every id below is reachable the same
// way: pick an effect, press Craft.
//
// ── PROMPT TEXT IS RICH'S ──────────────────────────────────────────────
// Every `body` below is text Rich approved against a live NB2 render on
// 2026-08-10, verbatim including his own capitalisation and phrasing. No
// lane rewrites one without a green light from him. "Restore", "reconcile",
// "normalise" and "align" are overwrites wearing a different word.
//
// ── TWO INTAKE PATHS ───────────────────────────────────────────────────
// `intake: 'group_photo'` — one photograph containing everybody. Eleven of
// the fourteen. Framing is composed at runtime from subject count.
//
// `intake: 'multi_photo'` — several individual photographs, composed into
// one artwork. Five effects. These bodies carry their own framing and
// arrangement, so the runtime framing clause does not apply to them.
//
// ── STANDING CHANGES APPLIED ───────────────────────────────────────────
// Held objects: Portrait's no-held-objects rule was cut. A group photograph
// is an event — bouquets, trophies, instruments, babies — and stripping
// them strips the occasion. The Iron render proved the clause was biting:
// it removed the bridesmaids' bouquets. Bodies ported from Portraits carry
// the replacement clause instead.
//
// Framing: never baked into a group_photo body. See FRAMING_CLAUSE.

export type GroupsIntake = 'group_photo' | 'multi_photo'

export type GroupsEffectId =
  // materials
  | 'bronze'
  | 'iron'
  | 'ebony'
  | 'stone'
  | 'reclaimed_bronze'
  | 'plushy'
  | 'folded_book'
  // picture styles
  | 'cubism'
  | 'art_nouveau'
  | 'ukiyo_e'
  // multi-photo composites
  | 'family_impressionism'
  | 'family_mosaic'
  | 'layered_paper'
  | 'carved_family'

export interface GroupsEffect {
  id: GroupsEffectId
  /** Customer-facing. "Effects", never "finishes". */
  label: string
  intake: GroupsIntake
  /** Locked prompt body. Rich's text. */
  body: string
  /** Negative clause, appended after the body when present. */
  avoid?: string
  /** Fixed output aspect where the body composes to one. Null means the
   *  aspect comes from subject count and the Prodigi size chosen. */
  aspect?: string
  /** Composites that assume a set number of source photographs. The
   *  intake needs a rule for counts either side of this — refuse, or
   *  compose to what arrived. Rich's ruling, not yet made. */
  expectedSubjects?: number
}

// ───────────────────────────────────────────────────────────────────────
// FRAMING — composed at request time, group_photo effects only.
//
// Rich's rule: somewhere between six and eight people the piece has to go
// head to toe. Set at >= 6 until renders say otherwise.
// ───────────────────────────────────────────────────────────────────────

export const FRAMING_HEAD_TO_TOE =
  'Framed head to toe, every figure fully in frame.'

export const FRAMING_STOMACH_UP =
  'Framed from the stomach to the top of the head.'

export const FRAMING_THRESHOLD = 6

export function framingClause(subjectCount: number): string {
  return subjectCount >= FRAMING_THRESHOLD
    ? FRAMING_HEAD_TO_TOE
    : FRAMING_STOMACH_UP
}

// ───────────────────────────────────────────────────────────────────────
// THE CATALOG
// ───────────────────────────────────────────────────────────────────────

export const GROUPS_EFFECTS: Record<GroupsEffectId, GroupsEffect> = {

  // ── MATERIALS ────────────────────────────────────────────────────────

  bronze: {
    id: 'bronze',
    label: 'Bronze',
    intake: 'group_photo',
    body: `Transform the group into a realistic patinated bronze sculpture — classic warm bronze with deep verdigris settling into the recesses and bright polish on the raised features: brow, cheekbones, nose bridge and jaw. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified sculptural artwork — it must read as one cohesive piece rather than separate statues, busts, or relief carvings. Faces, hair and garments all rendered in the same patinated bronze, dignified and tasteful, never costume-like. Hard directional key light from the upper left with deep shadow across the right and strong falloff. Professional magazine-cover photography. No letters, no plaque. The entire sculpture is bronze — no other materials, no real skin, hair or nails. Each person's own garment carries through in the same material. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material — bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings. Award-winning fine-art photography. Dynamic camera angle, slightly off-axis rather than square on. Rich directional key light with soft fill and clean falloff, sculpting form and separating the piece from behind. A complementary background, heavily blurred, shallow depth of field.`,
  },

  iron: {
    id: 'iron',
    label: 'Iron',
    intake: 'group_photo',
    body: `Transform the group into a hand-forged iron sculpture in deep charcoal-black metal with a soft gunmetal sheen — visible hammer-work texture across every surface, burnished highlights on raised features (brow, cheekbones, nose bridge, hair ridges), and darker oxide patina settling into recesses and undercuts. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified sculptural artwork — it must read as one cohesive piece rather than separate statues, busts, or relief carvings. No orange rust anywhere; the palette is charcoal, graphite, and warm gunmetal only. Each person's own garment carries through in the same material. Clear the skin — blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material — bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings. Award-winning fine-art photography. Dynamic camera angle, slightly off-axis rather than square on. Rich directional key light with soft fill and clean falloff, sculpting form and separating the piece from behind. A complementary background, heavily blurred, shallow depth of field.`,
  },

  ebony: {
    id: 'ebony',
    label: 'Ebony',
    intake: 'group_photo',
    body: `Transform the group into one unified sculpture hand-carved from ebony, with deep black-brown heartwood, subtle natural grain, and a rich polished lustre. Preserve every person's identity, expression, hairstyle, clothing, pose, proportions, relative position and interaction.
Carve the group fully in the round with real depth and overlap between figures, never as a relief or flat lineup. Faces are smooth, precise and highly recognizable, while hair and clothing carry deeper carving and richer grain.
Present the sculpture in a striking contemporary gallery setting with pale limestone or plaster architecture, soft curves, and warm neutral tones. Keep the background heavily blurred and elegant, creating strong contrast against the dark ebony.
Use dramatic side and rim lighting to catch the polished edges, separate overlapping figures, and reveal the brown undertones and grain within the wood. Slightly off-axis camera angle, shallow depth of field, museum-quality fine-art photography.`,
    avoid: `Avoid flat frontal lighting, pure featureless black, bronze or metallic surfaces, relief carving, backing panels, busy backgrounds, or losing facial likeness.`,
  },

  stone: {
    id: 'stone',
    label: 'Stone',
    intake: 'group_photo',
    body: `transform the entire group into one extraordinary sculpture carved from Taj Mahal quartzite, preserving every person's identity, expression, hairstyle, clothing, pose, relative position and interaction.
The stone has beautiful natural variation across the sculpture: warm ivory, cream, honey, pale champagne and occasional smoky grey, with elegant gold-brown veining flowing primarily through clothing and larger forms. Faces remain relatively clean and finely carved.
The figures emerge organically from a substantial piece of raw fractured quarry stone along the base and one edge, transitioning into highly finished polished carving.
Stage the sculpture in a dramatic, elegant architectural setting of dark stone and shadow, understated enough that the luminous quartzite remains the focus. Strong soft backlighting creates a halo around the group and passes through thinner areas of the quartzite, revealing its natural translucency with subtle warm internal luminosity. Add a directional key light for dimensional faces and deep sculptural shadows.
The result should feel monumental, rare and museum-worthy, photographed like the centerpiece of an international art or design magazine.`,
    avoid: `Avoid uniform beige stone, excessive orange glow, marble-white stone, separate individual statues, backing slabs, plaques or lettering. The entire group is one continuous quartzite sculpture.`,
  },

  reclaimed_bronze: {
    id: 'reclaimed_bronze',
    label: 'Reclaimed Bronze',
    intake: 'group_photo',
    body: `Transform the entire group into a single monumental cast-bronze sculpture reclaimed by nature, preserving every person, face, expression, hairstyle, clothing, pose and position.
The bronze is richly aged with varied warm brown, blackened bronze, turquoise and blue-green verdigris, with polished bronze showing through on raised edges and rain-worn surfaces. Moss and pale lichen settle naturally into seams and sheltered crevices, with occasional delicate ferns emerging between figures and around the base. Keep growth restrained enough that every face remains clearly recognizable.
Transform the surrounding setting into a forgotten garden monument: weathered stone, climbing greenery, soft foliage and an atmospheric architectural backdrop disappearing into shadow. The sculpture feels as though it has stood there beautifully for a century.
Soft overcast daylight with subtle warm backlight catching bronze edges, moisture and foliage. Romantic, cinematic fine-art photography with deep dimensionality and a quiet sense of time passing.`,
    avoid: `Avoid uniform green metal, metallic human skin, excessive moss covering faces, separate statues, fantasy ruins or heavy decay.`,
  },

  plushy: {
    id: 'plushy',
    label: 'Plushy',
    intake: 'group_photo',
    body: `Transform every person in the group into an adorable, soft, slightly overstuffed handmade plush toy, preserving strong facial likeness for each while gently idealizing their attractiveness and warmth. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. The figures sit together as one cohesive group, nestled and gently squished against each other exactly as they are arranged in the photograph. Give each face a sweet, lovable expression, softly flattering proportions and a subtle friendly smile without becoming cartoonish. Very soft fabric, visible hand stitching, gently uneven seams and cuddly compression. Clothing carries through entirely in soft knitted and stuffed materials. Anything a person is holding in the photograph carries through in soft plush materials too. Golden light keeps the faces bright and flattering, with soft open shadows and rich tactile detail. Lovable, cuddly, safe and deeply comforting, like treasured childhood plush toys. No letters.`,
  },

  folded_book: {
    id: 'folded_book',
    label: 'Folded Book',
    intake: 'group_photo',
    body: `Transform every person in the group — faces included — into fine-art busts assembled from folded and layered book pages, each emerging from its own open book. Every surface is paper: the faces, hair, necks, shoulders, chests and garments are all built from curled paper ribbons, folded pages, and layered printed sheets. The paper layers across each face follow that person's real facial structure — overlapping pages shape the planes of the forehead, brow, nose, cheeks, and lips so every likeness stays clearly recognizable, while the surface reads unmistakably as layered paper rather than skin. Hair is formed from paper ribbons that follow each subject's actual hairstyle exactly — same length, direction, volume, and character; the paper interprets the real hair and never invents wild curls, paper spirals, or fantasy hair shapes. Broad sweeping ribbons define the major forms; individual printed pages stay visible throughout. Each bust feels assembled from pages rather than carved into pages.
Preserve every person's identity, expression, hairstyle, age, garment and relative position exactly as shown. Do not add, remove, duplicate, replace or merge people.
Arrange the busts in a shallow arc across the frame, evenly spaced at the same height and scale, each on its own open book. Reading from the centre outward, the rotations are zero degrees at centre, five degrees for the busts immediately either side, and ten degrees for the busts at each end — each turned outward from centre. The arc also curves back in depth: the centre bust sits nearest the camera, the pair either side set back slightly, and the end busts set back furthest, so the group forms a gentle concave curve receding at the edges. 
Avoid a photo-realistic or smooth lifelike face — the faces are built from layered paper like the rest of the figures, not left as skin. Avoid carved relief, engraved surfaces, stacked page-edge carving, paper-cut or woodcut techniques, and topographic page slicing. Avoid chaotic paper strips that destroy the likenesses, and avoid generic wild paper curls or spirals replacing the real hairstyles. Avoid full figures, bodies below the chest, or any bust merging into its neighbour — each is a separate piece.
The group stands in a grand two-storey private library — a wrought-iron spiral staircase rising to a mezzanine gallery, floor-to-ceiling shelves on both levels, a tall arched window, warm lamplight, dust in the air. Strong depth of field heavily blurring the background. Museum-quality craftsmanship. Extraordinary dimensionality. Elegant paper architecture. Fine-art collectible sculpture.
Facing the camera directly, warm natural smiles, eyes to the viewer. Camera at eye level. Fully clothed in source garments, collars closed, no bare shoulders. Each bust ends at the chest. No plaque. No legible text or titles on the surrounding books.`,
    aspect: '16:9',
    // KNOWN CONFLICT, RICH AWARE, LOCKED AS-IS 2026-08-10:
    // the arrangement paragraph rotates the busts outward and the final
    // paragraph says "facing the camera directly, eyes to the viewer".
    // The final paragraph wins — the approved render has all five square
    // to camera. Do not resolve this without a green light.
  },

  // ── PICTURE STYLES ───────────────────────────────────────────────────

  cubism: {
    id: 'cubism',
    label: 'Cubism',
    intake: 'group_photo',
    body: `Redraw the group as a sophisticated analytical Cubist portrait, preserving every person's identity, expression, hairstyle, age, pose, proportions, position and interaction.
Keep each face immediately recognizable while breaking it into large intersecting geometric planes, subtly combining frontal and profile viewpoints within the same head. Eyes, nose, mouth and jaw remain clearly readable and correctly characteristic of that person; fragmentation reorganizes the face without replacing it.
Let the Cubism become progressively bolder through hair, clothing and bodies, with neighboring figures interlocking through shared angular planes to create one cohesive composition rather than isolated portraits.
Use expressive charcoal-like contour lines and a restrained palette of warm ochre, parchment, dusty olive, muted blue-grey, umber, clay and soft black, with occasional lighter cream planes creating rhythm across the group.
The original environment dissolves into simplified architectural geometry that echoes the figures. Matte painted surface, subtle canvas texture, sophisticated museum-quality early modernist painting.`,
    avoid: `Avoid extreme facial distortion, duplicated features, misplaced eyes, abstracted-away faces, cartoon Cubism, bright primary colors, text or collage lettering.`,
  },

  art_nouveau: {
    id: 'art_nouveau',
    label: 'Art Nouveau',
    intake: 'group_photo',
    body: `Redraw the group as a sumptuous Art Nouveau lithographic poster, preserving every person's identity, expression, hairstyle, age, clothing, pose, proportions, position and interaction.
Likeness is essential. Preserve the distinctive geometry of each face: face shape, hairline, brow, eyes, nose, mouth, jaw, age and natural asymmetry. Stylize the rendering, not the facial structure.
Use a restrained, harmonious Art Nouveau palette of faded celadon, dusty blue-green, muted rose, soft ochre, parchment, warm taupe and tarnished antique gold. Colors are gently desaturated and softened as though printed by an early 20th-century lithographic process. Avoid strong jewel tones and large areas of saturated color.
Keep the ornamental background delicate and secondary to the group: graceful iris and lily forms, thin whiplash vines and subtle geometric motifs on warm parchment. The decoration should frame the family rather than dominate them.
Slightly faded ink, warm aged paper, subtle lithographic grain and gentle variation in color registration give the finished piece the character of a beautifully preserved 1900s Art Nouveau print.
Keep each person's real hairstyle and silhouette, simplifying it into graceful Art Nouveau linework without lengthening or inventing hair.
Integrate the original porch architecture into an elaborate decorative composition of arched geometry, stylized iris and lily forms, whiplash vines and one large circular ornamental motif behind the group. Frame the image with an intricate period border.
Elegant, sophisticated, richly printed and slightly aged, with subtle paper texture and lithographic ink character. More fine-art poster than coloring-book illustration.
No lettering or text.`,
    avoid: `Avoid genericized faces, anime features, modern vector-art smoothness, invented hair, excessive facial simplification or identical skin tones.`,
    // NOTE for Rich: "the original porch architecture" is baked in from the
    // source photograph this was approved against. It will read oddly on a
    // beach or a garden. Flagged once, not changed.
  },

  ukiyo_e: {
    id: 'ukiyo_e',
    label: 'Ukiyo-e',
    intake: 'group_photo',
    body: `Redraw the group as an elegant Japanese ukiyo-e woodblock print on warm handmade washi paper, preserving every person's identity, expression, hairstyle, age, clothing, pose, proportions, position and interaction.
Likeness is essential. Preserve the distinctive geometry of each face: face shape, hairline, eyes, nose, mouth and jaw. Simplify the rendering into carved linework without genericizing or beautifying the people.
Render the figures with the tactile character of a genuine hand-carved woodblock: expressive dark key-block lines with subtle variation, broken pigment, faint woodgrain, imperfect ink density and occasional slight registration shifts. Faces remain relatively precise and restrained while clothing and larger forms carry stronger print texture.
Translate the original clothing colors into a sophisticated traditional palette of faded indigo, Prussian blue, muted persimmon, iron-oxide red, ochre, tea brown, grey-green and natural washi cream. Use restrained bokashi gradients across garments and overlapping forms to create gentle dimensionality without losing the flat graphic character of ukiyo-e.
Keep each person's actual hairstyle, length and silhouette, rendered as simplified dark shapes with delicate carved highlight lines.
Transform the surroundings into a lyrical Japanese landscape inspired by the original setting: layered blue-grey mountains, flowing water, atmospheric distance, soft cloud forms and a flowering branch entering from one edge. Use overlapping planes and bokashi to create depth and generous negative space.
The finished piece should feel hand-printed, sophisticated and quietly dimensional, with the beauty and imperfections of an antique Japanese woodblock rather than modern vector illustration.`,
    avoid: `Avoid anime or manga styling, genericized faces, changing ethnicity, modern digital outlines, photographic shading, bright synthetic colors, excessive facial abstraction, lettering or text.`,
  },

  // ── MULTI-PHOTO COMPOSITES ───────────────────────────────────────────
  // These take several individual photographs, not one group shot. They
  // carry their own framing and arrangement — FRAMING_CLAUSE must not be
  // appended to them.

  family_impressionism: {
    id: 'family_impressionism',
    label: 'Family Impressionism',
    intake: 'multi_photo',
    expectedSubjects: 5,
    aspect: '16:9',
    body: `Create five completely independent three-dimensional Impressionist portrait sculptures, one from each supplied reference, arranged side-by-side across a single 16:9 horizontal composition. Treat each reference as a separate identity. Likeness is paramount. Never blend facial characteristics between subjects.
Each portrait is physically sculpted from exceptionally thick oil paint with extraordinary mass and depth. Use bold, decisive palette-knife strokes, heavy slabs of pigment, deep furrows, raised ridges, broken edges and sweeping ropes of paint. Individual strokes should be clearly visible from across the image, casting real shadows onto neighboring strokes.
Push the work toward masterful expressive Impressionism rather than painted realism. Faces remain unmistakably recognizable but are constructed from large, confident planes and broken strokes of color rather than smoothly rendered skin. Allow edges to dissolve, colors to collide and forms to become increasingly abstract through hair, clothing and shoulders.
Derive each portrait's palette directly from that person's original colors, then amplify them into rich, sophisticated harmonies. Shadows should contain unexpected complementary color rather than black or grey. Let beautiful passages of cobalt, ochre, rose, violet, emerald, turquoise and warm cream emerge naturally from each subject.
Give each portrait its own softly blurred museum-gallery environment, complementary to its individual palette. Dramatic grazing side light and subtle backlight reveal the enormous physical thickness, glossy peaks, matte valleys and sculptural shadows of the paint.
The five portraits remain visually independent but share consistent scale, craftsmanship and artistic language. No frames or borders.
The result should feel like five monumental works by a world-class contemporary Impressionist painter-sculptor: fearless, sophisticated, tactile, emotionally expressive and unmistakably handmade. Not photorealism with paint texture applied over it. The paint itself creates the people.`,
  },

  family_mosaic: {
    id: 'family_mosaic',
    label: 'The Family Mosaic',
    intake: 'multi_photo',
    body: `Create a single extraordinary dimensional mosaic portrait from the supplied individual photographs. Treat each person independently for likeness, then bring them together within one unified artwork.
Give each person their own softly defined area of the composition, arranged naturally across the piece at complementary scales. Do not blend identities or invent interactions between people.
Construct the artwork from thousands of irregular pieces of colored glass, glazed ceramic and stone, using larger expressive fragments through clothing and backgrounds and much finer pieces across faces to preserve recognizable likeness.
Let colors originate from each person's source photograph, then flow outward and intermingle across the composition, gradually connecting the separate portraits into one continuous mosaic.
Rich translucent glass, occasional gold tesserae, beautiful irregular grout lines and grazing gallery light revealing the physical depth of the surface.
One family, multiple moments, one handcrafted artwork. No frames, dividing lines or text.`,
  },

  layered_paper: {
    id: 'layered_paper',
    label: 'Layered Paper',
    intake: 'multi_photo',
    body: `Create one unified three-dimensional layered-paper family portrait from the supplied individual photographs. Establish each person's likeness independently before assembling them into the final composition.
Build every portrait from many individually cut and sculpted layers of heavyweight artist paper. Faces use finer, closely spaced layers for recognizable detail, becoming progressively broader and more expressive through hair, clothing and surrounding forms.
Draw colors from each person's source photograph, translated into a sophisticated palette of richly colored and subtly textured papers. Let layers from neighboring portraits overlap, curl and flow into one another so five separate portraits become one continuous artwork.
Strong grazing light creates beautiful real shadows between the paper layers and reveals their physical depth.
Elegant, intricate, contemporary paper sculpture with exceptional craftsmanship. Not flat illustration, collage or origami. No text.`,
    // "five separate portraits" is in Rich's approved text. It will read
    // oddly at other counts. Flagged, not changed.
    expectedSubjects: 5,
  },

  carved_family: {
    id: 'carved_family',
    label: 'Carved Family',
    intake: 'multi_photo',
    body: `Create a single extraordinary hand-carved walnut family artwork from the supplied individual portraits. Treat each person independently for likeness, then compose them naturally within one continuous sculptural slab.
Likeness is essential. Preserve each person's distinctive facial structure, expression, age and hairstyle while translating them completely into carved wood.
The people themselves are entirely walnut. Faces, lips, eyelids, hair, necks, clothing and every visible surface are carved from the same solid timber, with natural grain flowing continuously through the features. There is no skin, real hair or fabric anywhere.
Keep faces finely detailed and recognizable, while hair, clothing and surrounding forms become more expressive and deeply carved. Let beautiful variations of heartwood, sapwood, knots and figuring create natural shifts in tone across the composition.
Allow the grain and carved forms surrounding each portrait to flow organically into one another, connecting the separate people into a single piece of wood.
Deep carving, visible chisel work, polished high points and rougher recessed areas give the sculpture extraordinary physical presence. Warm grazing gallery light reveals the grain and dimensional carving.
World-class contemporary wood sculpture, elegant and handcrafted. No text.`,
  },
}

// ───────────────────────────────────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────────────────────────────────

export const GROUPS_EFFECT_IDS = Object.keys(
  GROUPS_EFFECTS,
) as GroupsEffectId[]

export function isGroupsEffectId(v: unknown): v is GroupsEffectId {
  return typeof v === 'string' && v in GROUPS_EFFECTS
}

export function groupsEffectsByIntake(intake: GroupsIntake): GroupsEffect[] {
  return GROUPS_EFFECT_IDS.map(id => GROUPS_EFFECTS[id]).filter(
    e => e.intake === intake,
  )
}

/**
 * Assemble the string NB2 receives.
 *
 * body → avoid → framing. Framing is appended for group_photo effects only;
 * the composites carry their own arrangement and adding a second framing
 * instruction is exactly the conflict that flattened stained_glass.
 */
export function buildGroupsPrompt(input: {
  effectId: GroupsEffectId
  subjectCount?: number
}): string {
  const effect = GROUPS_EFFECTS[input.effectId]
  if (!effect) throw new Error(`unknown groups effect: ${input.effectId}`)

  const parts: string[] = [effect.body]

  if (effect.avoid) parts.push(effect.avoid)

  if (effect.intake === 'group_photo' && input.subjectCount) {
    parts.push(framingClause(input.subjectCount))
  }

  return parts.join('\n')
}
