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
//
// ── ASPECT IS NOT BAKED IN EITHER, 2026-08-20 ──────────────────────────
//
// folded_book and family_impressionism carried aspect: '16:9'. Both were
// shot square on 20 August and both held — five busts across a square
// frame, and the five Impressionist panels without needing a horizontal.
// Rich approved. The fields are gone.
//
// The aspect now comes from ONE constant on the calling surface, so
// changing it later is one line rather than a hunt through the catalog.
// family_impressionism's BODY still says "a single 16:9 horizontal
// composition" — that is Rich's text and it is left alone; it rendered
// square anyway, which says the aspect argument outranks the sentence.
//
// ── PERIOD COSTUME, ADDED 2026-08-18 ───────────────────────────────────
// Six effects merged from the Portraits gendered pairs and approved by
// Rich against live renders the same day. They are group_photo intake and
// take the runtime framing clause like the rest.
//
// WHAT THE MERGE DROPPED, and why it matters if one is ever revisited:
//
//   Class language. "aristocratic", "lavish", "opulent", "sumptuous",
//   "nobleman", "society portrait". Stacked, they push NB2 toward a stock
//   idea of wealth instead of toward THESE people in period dress. The
//   look survives in the palette and the light, which is where it was
//   coming from all along.
//
//   Pose instructions. "three-quarter profile", "head turned 30 degrees",
//   "arm resting on a pedestal". Single-subject rules that cannot apply to
//   five people.
//
//   Framing. Several Portraits bodies carry two or three framing
//   sentences at once — elizabethan_woman has three. That is the dominant
//   failure mode in this repo and none of it is reproduced here.
//
//   The no-held-objects rule, per the standing Groups change above.
//
// ── NINE PORTS FROM PORTRAITS, ADDED 2026-08-18 ────────────────────────
// Rich's picks, each approved against a live group render the same day.
// The same three removals apply as to the period effects, plus one more
// that is specific to the material bodies:
//
//   THE ARM-AND-HAND RULE. "An arm or hand appears only when it is
//   touching the body" is a bust rule. It fights people standing together
//   with their arms around each other, which is what a group photograph
//   is.
//
// dragon_skin was shot and CUT. It is the only one of the ten that adds
// anatomy rather than resurfacing what is already there — a spined neck
// and serpentine body per person — and at five subjects the frame could
// not hold five dragons. Every other port keeps the silhouette and changes
// only the material. That is the rule for judging the next candidate.
//
// Two findings from the shoot, both worth applying before a render rather
// than after:
//
//   OVER-CONSTRAINT READS AS ILLUSTRATION. Clockwork failed twice, coming
//   back as an engraving. The body stated the material four times, said
//   "photographic" twice, and spent three sentences on workshop furniture.
//   Cutting it roughly in half fixed it. Redundancy is the failure mode,
//   not insufficient instruction.
//
//   EVERY MATERIAL LEAKS AT EYES, HAIR AND NAILS. Naming the material is
//   not enough; each part has to be named. Sea Glass holds because it says
//   "bright catchlight in both eyes" — an eye that is glass and still
//   reads as an eye. Ice, which does not, came back with human irises.
//
// ETHNICITY IS NAMED EXPLICITLY IN EVERY PERIOD EFFECT. The first Victorian render
// returned five white faces from a source where three subjects were Black
// or mixed-race, because the body said "preserving every face" and never
// said skin tone. Naming it fixed it. Do not drop it from any of these,
// and name it in any period effect added later.
//
// Sex-appropriate dress is written as "appropriate to their apparent sex
// and age" rather than assigned per figure. NB2 reads the photograph,
// which is the thing it is good at; a script deciding who was male is what
// produced the dinner-jacket error.

export type GroupsIntake = 'group_photo' | 'multi_photo'

export type GroupsEffectId =
  // materials
  | 'bronze'
  | 'ebony'
  | 'stone'
  | 'reclaimed_bronze'
  | 'plushy'
  // picture styles
  | 'cubism'
  | 'art_nouveau'
  | 'ukiyo_e'
  // period costume
  // ported from Portraits, 2026-08-18
  | 'ice'
  | 'pencil_sketch'
  | 'balloon_face'
  | 'origami'
  | 'porcelain'
  | 'clockwork'
  | 'retro_robot'
  | 'neon'
  | 'sea_glass'
  // multi-photo composites
  | 'family_impressionism'
  | 'family_mosaic'
  | 'layered_paper'
  | 'carved_family'
  // material effects added 2026-08-23, replacing the costume five
  | 'quilted'
  | 'petal_sculpture'
  | 'sand_form'
  | 'watercolour'
  | 'impressionist'
  | 'driftwood_resin'
  | 'chocolate'
  | 'linocut'
  | 'lichen_granite'
  | 'polished_gold'
  | 'wax'
  | 'silver'

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
    body: `Transform the group into a realistic patinated bronze sculpture — classic warm bronze with deep verdigris settling into the recesses and bright polish on the raised features: brow, cheekbones, nose bridge and jaw. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified sculptural artwork — it must read as one cohesive piece rather than separate statues, busts, or relief carvings. Faces, hair and garments all rendered in the same patinated bronze, dignified and tasteful, never costume-like. Hard directional key light from the upper left with deep shadow across the right and strong falloff. Professional magazine-cover photography. No letters, no plaque. The entire sculpture is bronze — no other materials, no real skin, hair or nails. Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material — bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings. Award-winning fine-art photography. Dynamic camera angle, slightly off-axis rather than square on. Rich directional key light with soft fill and clean falloff, sculpting form and separating the piece from behind. A complementary background, heavily blurred, shallow depth of field.`,
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

  // ── PERIOD COSTUME ───────────────────────────────────────────────────







  // ── PORTED FROM PORTRAITS ────────────────────────────────────────────

  ice: {
    id:     'ice',
    label:  'Frost & Ice',
    intake: 'group_photo',
    body: `Transform every clothed figure into a softly sculpted form of dense snow and translucent ice, with milky crystalline depth, compacted snowy surfaces, soft frost and occasional clearer icy edges. Increase opacity and softness so each facial structure is beautifully defined rather than glass-like; preserve every likeness precisely with no visible skin. Set against an icy cliff with hanging icicles, deep blue glacial shadows and a snow-covered edge catching warm sunlight; golden light falls across one side of the group while cold blue-white light shapes the other, creating a dramatic warm/cool contrast. skin is translucent ice. no real skin, hair, nails or eyes. all objects whether worn or held are color drained ice.`,
  },

  pencil_sketch: {
    id:     'pencil_sketch',
    label:  'Pencil Sketch',
    intake: 'group_photo',
    body: `A solid sculpted group carved entirely from graphite - soft pencil-lead grey with a burnished sheen, the surface worked in visible pencil strokes that wrap the forms: crosshatching in the recesses, broad shading across the planes, edges softly smudged. Eyes and lips are graphite. Hair keeps its real length and silhouette on every figure in long directional strokes. No skin, no real hair. The garments carry through in the same material. A real object standing in real light, casting its own shadow. Set in a beautiful old-world artist's atelier - dark timber, plaster walls, antique easels, stacked canvases and old studies pinned around the room, a huge ribbed skylight above flooding it with soft daylight. Monochrome throughout. Likeness is critical on every face. Keep permanent structure on every face: lines, scars and the natural asymmetry. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings. dont show a table. either cut the image at the legs or carry the legs out of the scene.`,
    avoid: `Avoid a drawing on paper, an easel-mounted picture or any flat image. Avoid duplicated faces. Avoid colour.`,
  },

  balloon_face: {
    id:     'balloon_face',
    label:  'Balloon',
    intake: 'group_photo',
    body: `Transform the group into a sculpture built from inflated balloons - glossy latex in twisted and pressed segments, every face, head of hair and garment formed from balloon shapes tied and bunched into each person's own structure. Taut curved surfaces with bright specular highlights, the pinch and knot visible where segments meet, faint seams running the length of each balloon. Use a restrained, sophisticated near-monochromatic palette of smoked amethyst, deep aubergine, dusty plum, muted mauve and blackberry, with subtle tonal variations between individual balloons. Keep the faces in warm muted blush and taupe balloon tones. Avoid primary colours, rainbow colours and children's-party colours. The overall colour treatment should feel luxurious, editorial and distinctly adult. Every face is balloon throughout - no skin, no real hair. Likeness is critical; the features read clearly through the rounded forms on each person. Idealized and beautiful. Photographic - a real object photographed in real light, not an illustration. The background is an adult style party in a club, streamers and lights out of focus behind. Keep permanent structure on every face: lines, scars and the natural asymmetry. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: `Avoid faces painted onto balloons. Avoid real skin or hair. Avoid balloon animals or novelty shapes. Avoid losing the likenesses to rounded generic features.`,
  },

  origami: {
    id:     'origami',
    label:  'Origami',
    intake: 'group_photo',
    body: `The group is folded from paper - a single continuous sheet worked into the whole arrangement, every plane a crisp fold with a visible crease line, the paper's own grain and slight thickness reading at each edge. Each face is built from a few confident planes: the brow, the bridge of the nose, the cheeks, the jaw, each a flat facet meeting at a sharp crease. Warm cream and soft indigo paper. Hair keeps its real shape and volume on every figure, folded in tighter pleats. The garments fold through in the same paper. Likeness is critical - each person reads clearly through the faceting. Photographic and highly idealized - a real folded object in real light. Background: a bare table under one soft lamp, deep shadow, heavily out of focus. Keep permanent structure on every face: lines, scars and the natural asymmetry. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: `Avoid curved or moulded surfaces - every form is a flat fold. Avoid paper cranes or novelty shapes. Avoid torn or crumpled paper. Avoid real skin or hair.`,
  },

  porcelain: {
    id:     'porcelain',
    label:  'Porcelain',
    intake: 'group_photo',
    body: `The group is modelled in glazed porcelain - fine white clay, hand-thrown and kiln-fired, with a soft glassy glaze pooling in the hollows and thinning to near-white on the raised planes. Hand-painted cobalt blue decoration runs across the garments and shoulders in small repeating floral motifs, the brushwork slightly uneven as a real hand leaves it. Fine crazing across the glaze, a chip at one edge, the unglazed foot showing raw biscuit. Every face is porcelain throughout, glaze catching a single soft highlight on the cheek and brow. Hair keeps its real texture, length and shape on each figure, modelled in the same clay. Likeness is critical and comes before the material. Photographic and highly idealized - a real fired object in real light, beautifully made. Keep permanent structure on every face: lines, scars and the natural asymmetry. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings. Place the group in a delicate wood shipping box with straw packing, shipping stamps and labels on the outside.`,
    avoid: `Avoid changing the hair. Avoid a plastic or resin look - this is fired clay under glaze. Avoid decoration crossing any face. Avoid real skin or hair.`,
  },

  clockwork: {
    id:     'clockwork',
    label:  'Clockwork',
    intake: 'group_photo',
    body: `The group is built as clockwork automata, photographed not illustrated. Brass and steel plate over visible movements, tiny gears, jewelled bearings and coiled springs turning in the openings at temple, throat and shoulder. No human skin, hair or nails anywhere. Every face is shaped brass, its panels following that person's own brow, cheekbones and jaw, joints hairline-fine where the plates meet. Eyes stay human in size and spacing. Hair, beards and moustaches are flat plates with deep grooves matching each person's real hairstyle and texture. Garments rebuilt in engraved plate. Warm brass, blued steel, a little verdigris in the seams. Likeness is critical.
Real made objects in real light, the finest pieces of their kind. Place them inside an intimate old Swiss watchmaker's workshop with the charm of Geppetto's shop - tools, tiny drawers and half-finished clocks in layers behind them, tall divided-light windows onto a crooked old-European lane. Warm amber workshop light inside against soft cool daylight from the street.
Keep permanent structure on every face: lines, scars and the natural asymmetry. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding carries through in the same material.`,
  },

  retro_robot: {
    id:     'retro_robot',
    label:  'Atomic-Age Robot',
    intake: 'group_photo',
    body: `Transform every person into a charming atomic-age tin robot, each unmistakably themselves. Preserve the exact silhouette, shape and proportions of every face, and preserve the natural size, spacing and placement of their features. Construct each familiar face from a few simple, smoothly pressed pieces of enamelled sheet metal, rather than reproducing human skin or substituting mechanical facial features. Eyes remain each subject's normal size and shape, set naturally into the metal face. Mouths are simple articulated metal mouths that preserve each subject's expression. No camera lenses, mechanical teeth, grille noses or exaggerated robot features. Do not change expressions. Hair is overlapping pressed-metal strips about the width and thickness of gum wrappers, following each subject's real hairstyle, length and volume. Cream, red and chrome sheet metal, rivets, seams, gauges and antennae complete the robots. The feeling is charming vintage tin toys brought to life, not cyborgs, androids or humanoid machinery. Retro-futurist 1950s city softly out of focus. No text or signage. Keep permanent structure on every face: lines, scars and the natural asymmetry. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
  },

  neon: {
    id:     'neon',
    label:  'Neon',
    intake: 'group_photo',
    body: `highly detailed neon tube sculpture of the whole group. fully 3d in all three directions. implied volume. use negative space. use monochromatic blues with variations on value. mounted in a small shop's storefront window at night, rain on the glass, the shop dark behind. wires and electrical lines visible. at least 100 tubes per figure. Each person's own garment carries through in the same material. Keep permanent structure on every face: lines, scars and the natural asymmetry. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding carries through in the same material - bouquets, glasses, instruments, babies, pets.`,
  },

  sea_glass: {
    id:     'sea_glass',
    label:  'Sea Glass',
    intake: 'group_photo',
    body: `The group is sculpted from a single continuous form of weathered translucent beach glass, with flowing strands of individually worn sea glass preserving each person's original hairstyle. Frosted seafoam, aqua, emerald, turquoise and cobalt glass glow with brilliant internal caustics and refracted sunlight, while tiny amber fragments appear only as subtle accents. Ocean foam, spray and flowing water wrap naturally around the sculpture as it emerges from the surf. Dramatic backlighting through sea spray. Turn all clothing into sea glass and very translucent. No skin, no real hair. Each person's own garment carries through in the same material. Keep permanent structure on every face: lines, scars and the natural asymmetry. Add nothing that is not in the source. Bright catchlight in both eyes on every figure. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding carries through in the same material - bouquets, glasses, instruments, babies, pets.`,
    avoid: `No skin, ceramic, mosaic or tiled appearance.`,
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
  quilted: {
    id: 'quilted',
    label: 'Quilted',
    intake: 'group_photo',
    body: `The group is sewn from quilted fabric — panels of patterned cotton pieced together and stitched, with visible seams, running stitch lines and the soft puff of batting between the layers. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. Every face is quilted cloth throughout: pieced panels shaped to the brow, cheeks and jaw, the stitching following the planes rather than the features. Every set of eyes and mouth is embroidered in thread. Each person's hair is cut and layered fabric in their real style and length. A folk palette of faded indigo, madder red, ochre and cream, prints small and repeating, the cloth softly worn. Each person's own garment carries through in pieced quilt. Likeness is critical. Idealized and beautiful. Photographic — a real object photographed in real light, not an illustration. Background: a quilter's room — a frame, folded bolts, a window with soft daylight, heavily out of focus. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: `Avoid real skin or hair. Avoid a flat printed quilt or wall hanging — this is dimensional and sewn. Avoid a rag doll or novelty toy. Avoid stitching that traces the wrinkles of the face.`,
  },
  petal_sculpture: {
    id: 'petal_sculpture',
    label: 'Petal Sculpture',
    intake: 'group_photo',
    body: `The group is sculpted entirely from thousands of densely layered flower petals, creating a seamless floral sculpture with no visible skin. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. The likeness emerges through flowing planes of overlapping petals rather than individual flowers, while only occasional blossoms appear to reveal the material. Rich gradients of crimson, scarlet, coral, tangerine, peach, magenta, fuchsia, violet, lavender, and deep burgundy flow naturally across the sculpture like a living oil painting. Each person's hair transforms into sweeping masses of layered petals that preserve their original hairstyle, blending seamlessly into the figure. Dramatic spring sunlight with warm rim light. Avoid bouquets, floral crowns, flower garlands, makeup effects, visible skin, individual flowers covering the face, decorative arrangements, or flowers attached to a person. The petals themselves are the sculptural material. The sculpture stands on a polished dark wood plinth, blurred green foliage behind, warm sunlight from the left. Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
  },
  sand_form: {
    id: 'sand_form',
    label: 'Sand Form',
    intake: 'group_photo',
    body: `The group is formed entirely from desert sand — a face and figure held for a moment in drifting dune, the whole mass loose grain all the way through with no skin, teeth or real hair anywhere. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. Every set of lips, eyes and mouth is sand like everything else. The windward side is sharp and fully resolved; on the leeward side the wind has scooped a shallow cavity out of the cheek and temple, the edge crumbling and streaming off into the air in fine ribbons, the shoulder dissolving into the dune it rises from. Warm ochre, bone and pale gold, the low sun raking across and throwing the ripple texture into relief. Each face is clearly that person while it lasts — brow, cheek and jaw carved by wind rather than hand. Each person's hair keeps its real length and silhouette, streaming back as blown sand. Likeness is critical. Photographic and highly idealized — beautiful, quiet, already going. Background: windblown dunes at low sun, a sky bleached pale, heavily out of focus. Preserve each person's natural facial character, asymmetry, lines and scars. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: `Avoid sand dusted over a real person. Avoid real skin, lips, teeth, eyes or hair. Avoid a solid sandstone carving — this is loose grain, mid-collapse. Avoid a symmetrical or fully intact face.`,
  },
  watercolour: {
    id: 'watercolour',
    label: 'Watercolour',
    intake: 'group_photo',
    body: `Rebuild the group as one three-dimensional sculpture painted in watercolour — a solid object with real volume, not a picture on paper. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. rotate the group 20 degrees left. The whole form is soft transparent washes: the face, hair, shoulders and garment modelled in light and shade, with hard edges where a wash dried against itself and the white of the surface left bare at the brightest points. The paint is still wet. Colour runs down the shoulders and the front of the garment in fine coloured rivulets and drips, gathering in bright pools of red, ochre and violet on the round white board the group stands on. Colours natural to each person's complexion and clothing, transparent and luminous, granulating in the low spots. Likeness is critical. Keep permanent structure: lines, scars and the natural asymmetry of each face. Never reshape, enlarge eyes, correct asymmetry or de-age. Set in a beautiful old-world artist's atelier, cluttered and eclectic, with dark aged timber, plaster walls, antique easels, stacked canvases, portfolios, drawing tools and old studies casually pinned around the room. Above is a huge ribbed industrial skylight of aged iron and glass, flooding the studio with dramatic soft daylight and long directional shadows. Atmospheric, romantic, slightly dusty, collected over generations rather than designed. Shallow depth of field. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: `Avoid a flat painting or anything on paper — this is a solid object standing on a board. Avoid opaque or body colour. Avoid a photographic face. Avoid a bright white modern gallery; the room is an old cluttered atelier.`,
  },
  impressionist: {
    id: 'impressionist',
    label: 'Impressionist',
    intake: 'group_photo',
    body: `Rebuild the group as **one three-dimensional sculptural work made entirely from thick Impressionist oil paint**, standing physically in the room. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. Faces, hair, necks, clothing and shoulders are formed from heavy palette-knife impasto: broad slabs, ridges and lifted strokes with real depth, hard edges and tiny cast shadows. **Preserve every person's likeness, face shape, skin tone, distinctive features, and exact hairstyle, length and colour.** Every face remains clearly recognizable despite the expressive construction. Hair is especially sculptural, formed from bold ropes, sweeps and ridges of paint following each person's original hair direction and volume. Use broken natural color, with violet, blue and green worked into shadows instead of grey or black. The work stands on a round base, with excess paint running over the shoulders and pooling naturally around the base. Place it in a romantic, generations-old artist's atelier: aged timber, worn plaster, antique easels, stacked canvases, portfolios, drawing tools and pinned studies. A huge ribbed iron-and-glass industrial skylight fills the studio with soft directional daylight, atmospheric dust and long shadows. Shallow depth of field. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: `**Avoid:** flat paintings, canvas portraits, smooth or photorealistic skin, thin or blended paint, uniform brushwork, grey or black shadows. The subject must read unmistakably as a **solid sculptural object physically built from thick oil paint**.`,
  },
  driftwood_resin: {
    id: 'driftwood_resin',
    label: 'Driftwood & Resin',
    intake: 'group_photo',
    body: `Transform the whole group into a contemporary sculpture combining weathered driftwood and glossy colored epoxy resin — the live-edge resin-river aesthetic. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. The driftwood preserves the form and the likeness: each face and the structural planes of every head, shoulders, and major contours are carved from pale, silvery, weathered driftwood with visible grain, knots, cracks, and organic live edges, keeping every person clearly recognizable. Flowing rivers and pools of translucent colored epoxy resin run through and between the wood — deep teal, ocean blue, amber, or emerald — filling the live-edge gaps, the cracks, and the negative spaces, catching and refracting light. The resin is where the color and translucency live; the wood is where the likeness lives. The whole piece is finished in a high-gloss polish so the resin reads as liquid-clear and the wood as satin-smooth. No human skin anywhere — every face, neck, forehead, ears and every visible surface are weathered driftwood, not skin. The wood grain, cracks and live edges continue across every face. This is the most common failure. Avoid an all-wood sculpture with no resin, or an all-resin sculpture with no wood — both materials must be present and distinct. Avoid a matte or unfinished surface; the glossy high-polish finish is required. Avoid resin that looks opaque or painted — it must read as translucent, light-catching epoxy. Avoid driftwood so abstract the faces stop being recognizable; the wood carries the likeness. Sculpture on a base in a coastal woodworker's studio — a wide window onto grey sea and sky, live-edge slabs leaning against the walls, clamps and resin buckets, sawdust light. Strong depth of field heavily blurring the background. Contemporary gallery presentation. High-gloss finish catching the light. Translucent resin rivers. Weathered live-edge driftwood. Museum-quality craftsmanship. Highly tactile and dimensional. Fine-art mixed-media sculpture. No plaque. Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
  },
  chocolate: {
    id: 'chocolate',
    label: 'Chocolate',
    intake: 'group_photo',
    body: `convert the group into a rich chocolate sculpture. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. smooth brown milk chocolate with highly detailed features. Background should be a chocolate shop (blurred). no visible letters. satin sheen on entire sculpture Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
  },
  linocut: {
    id: 'linocut',
    label: 'Linocut',
    intake: 'group_photo',
    body: `Redraw the group as a hand-cut linocut print — bold black ink on cream paper, the image built entirely from carved marks. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. Broad cleared areas of pure white, dense black masses, and the form described by parallel gouge strokes that swell and taper. Visible slips of the blade and small imperfect edges where the lino chipped. Each head of hair is a solid black shape cut with a few sweeping white gouges. One second colour, a flat overprinted ochre or red, slightly out of register. Likeness is critical. No lettering. The print lies on a bench, its edges curling. Set in a beautiful old-world artist's atelier, cluttered and eclectic, with dark aged timber, plaster walls, antique easels, stacked canvases, portfolios, drawing tools and old studies casually pinned around the room. Above is a huge ribbed industrial skylight of aged iron and glass, flooding the studio with dramatic soft daylight and long directional shadows. Atmospheric, romantic, slightly dusty, collected over generations rather than designed. Shallow depth of field. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: `Avoid grey tones or shading — the image is black, white and one flat colour. Avoid photographic rendering. Avoid a sculpture.`,
  },
  lichen_granite: {
    id: 'lichen_granite',
    label: 'Lichen Granite',
    intake: 'group_photo',
    body: `The group is carved directly from a massive ancient granite monolith rising from the forest floor, preserving every person's likeness while remaining unmistakably part of the original boulder. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. The stone surface is weathered by centuries of moss, colorful lichens, delicate ferns, creeping vines, and tiny woodland plants that naturally reclaim cracks and ledges, while each person's existing hair becomes moss, roots, and woodland growth that preserve its original silhouette. Warm shafts of sunlight filter through towering trees, illuminating damp stone and drifting forest particles. Preserve each person's existing clothing naturally carved into the stone, no human skin. Existing clothing remains, carved from the same weathered granite and integrated seamlessly into the monolith. Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
  },
  polished_gold: {
    id: 'polished_gold',
    label: 'Polished Gold',
    intake: 'group_photo',
    body: `Transform the whole group into a contemporary polished gold sculpture — mirror-bright warm yellow gold with a high specular finish, the surface smooth and flowing with no visible tool marks. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. hair is poured liguid gold that matches each person's with deep carved separations catching bright highlights. No human skin anywhere — every face is polished gold like the rest. Each person's own garment carries through in the same material. the background is an expensively appointed conservatory with many windows with warm lighting streaming through inside potted trees and plants. Make the creation match age. Mainting each person's hair style, hairline, face shape. micro gestures. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
  },
  wax: {
    id: 'wax',
    label: 'Wax',
    intake: 'group_photo',
    body: `Transform the group into a single sculpture cast in fine wax. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. No human skin, hair, nails, teeth. Everything is wax. The entire sculpture is cast from ONE wax in a single colour - warm honey-cream, the colour of a beeswax candle. Garments, hair, skin and every surface are that same wax. Differences between people and between clothes appear only as shifts in density and translucency, never as different hues: a dark jacket is deeper, more opaque wax and never brown; a red shirt is denser wax and never red. Any pattern in the clothing - checks, stripes, knitwear - is carried as relief and texture pressed into the wax surface, never as printed colour. Do not add, remove, duplicate, replace, or reposition any person. Create one unified sculptural artwork - it must read as one cohesive piece rather than separate statues or busts, with real depth and overlap between figures. The wax has deep subsurface scattering: light enters the surface and glows out from within, warmest where the material is thinnest. Translucency is artistically placed - the outer edge of an ear, the bridge of a nose, the rim of a shoulder, the trailing edge of a sleeve - while the mass of each figure stays dense and softly opaque. Strong backlighting drives that glow through the edges of the group. Faces, hair and garments are all the same wax: eyes are wax with no wet gleam, lips and mouths are wax, and hair is wax formed into each person's real style and length, never real hair. Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. The sculpture stands on a rich aged oak plank table in a 300-year-old candle shop at night, dark wood throughout. Every light in the room is a large burning candle, casting a warm yellow-orange glow with deep shadow beyond. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
  },
  silver: {
    id: 'silver',
    label: 'Silver',
    intake: 'group_photo',
    body: `Transform the group into a single sculpture cast in solid silver. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified sculptural artwork - it must read as one cohesive piece rather than separate statues or busts, with real depth and overlap between figures. The silver carries a slightly dull satin sheen across most of its surface - rich, dense, unmistakably heavy metal. Polish appears the way silver actually wears, burnished where a piece would be handled and rubbed: shoulders, elbows, hands, the tops of heads, the crest of a chest. The brightness rises and falls gradually out of the satin, never a hard-edged pool of mirror against dull ground. The face stays satin throughout, with no polished patches on cheeks, brows or noses. Faces, hair and garments are all the same silver: eyes are satin silver with no wet gleam, lips and mouths are silver, and hair is silver worked into each person's real style and length, never real hair. Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. The sculpture stands on a rich walnut table. Behind it and slightly to one side, secondary to the piece, an open walnut presentation box lined in deep red-purple velvet, with the shape of the sculpture clearly pressed into the velvet where it sits. Full-height divided windows further back are thrown far out of focus, glowing with an evening sunset. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets.`,
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
