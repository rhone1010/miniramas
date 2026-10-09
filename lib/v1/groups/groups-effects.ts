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

import {
  GROUPS_LANDSCAPE_COMPOSITION,
  GROUPS_MOBILE_COMPOSITION,
} from '../shared/render-aspect'

export type GroupsIntake = 'group_photo' | 'multi_photo'

/** Supported generation formats. 3:2 landscape is canonical/default.
 *  9:16 Mobile requires both effect approval AND groupCount <= 3. */
export const GROUPS_FORMATS = ['9:16', '2:3', '1:1', '4:3', '3:2', '16:9'] as const
export type GroupsFormat = typeof GROUPS_FORMATS[number]
export function isGroupsFormat(value: unknown): value is GroupsFormat {
  return typeof value === 'string' && (GROUPS_FORMATS as readonly string[]).includes(value)
}
export function groupsFormatAllowed(count: number, format: GroupsFormat): boolean {
  if (!Number.isFinite(count) || count <= 0) return false
  if (count <= 3) return ['9:16', '2:3', '1:1'].includes(format)
  if (count <= 9) return format !== '9:16'
  return ['4:3', '3:2', '16:9'].includes(format)
}

/** The canonical default when an effect omits `formats`. */
export const GROUPS_DEFAULT_FORMATS: GroupsFormat[] = ['3:2']

export type GroupsEffectId =
  | 'art_deco'
  | 'art_nouveau'
  | 'art_nouveau_faces'
  | 'balloon'
  | 'bronze'
  | 'carved'
  | 'charcoal_faces'
  | 'chocolate'
  | 'clockwork'
  | 'colored_pencil'
  | 'colored_pencil_faces'
  | 'driftwood_resin'
  | 'family_mosaic'
  | 'gold'
  | 'ice'
  | 'impasto_faces'
  | 'impressionist'
  | 'impressionist_faces'
  | 'jade'
  | 'layered_paper'
  | 'layered_paper_faces'
  | 'lichen_granite'
  | 'linocut'
  | 'mosaic_faces'
  | 'neon'
  | 'origami'
  | 'petal'
  | 'plushy'
  | 'porcelain'
  | 'quilted'
  | 'retro_robot'
  | 'sea_glass'
  | 'sheet_music'
  | 'silver'
  | 'stained_glass'
  | 'stained_glass_faces'
  | 'stone'
  | 'ukiyo_e'
  | 'ukiyo_faces'
  | 'watercolor'
  | 'watercolor_faces'
  | 'wax'

export interface GroupsEffect {
  id: GroupsEffectId
  /** Customer-facing. "Effects", never "finishes". */
  label: string
  intake: GroupsIntake
  /** Locked prompt body. Rich's text. */
  body: string
  /** Negative clause, appended after the body when present. */
  avoid?: string
  /** Generation formats this effect supports. Defaults to ['3:2'] when
   *  absent. An effect approved for Mobile adds '9:16' — but only groups
   *  of <=3 people may use it (see mobileFormatAllowed). */
  formats?: GroupsFormat[]
  /** Composites that assume a set number of source photographs. The
   *  intake needs a rule for counts either side of this — refuse, or
   *  compose to what arrived. Rich's ruling, not yet made. */
  expectedSubjects?: number
  /** When true, the effect uses the shared 3–9 portrait-panel Faces
   *  layout. Explicit — do not infer from the _faces suffix. */
  faces?: boolean
  /** When false, the prompt builder skips the runtime framing clause.
   *  Defaults to true for group_photo effects. Not applicable to
   *  multi_photo effects (they carry their own arrangement). */
  runtimeFraming?: boolean
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
// FACES / PORTRAIT-COLLECTION LAYOUT — shared by all effects with
// faces: true. Accepts 3–9 individual source portraits.
//
// From the Groups Generation Governance, September 2026. 9 widened from
// the original 8-subject ceiling by the same authority, with the balanced
// 3×3 grid as its layout — Rich's correction, carried here.
// ───────────────────────────────────────────────────────────────────────

export function facesLayoutClause(subjectCount: number): string {
  switch (subjectCount) {
    case 3:
      return 'Arrange three equal portrait panels in one centered row.'
    case 4:
      return 'Arrange four equal portrait panels in a balanced 2×2 grid.'
    case 5:
      return 'Arrange five equal portrait panels in two centered rows: three across the top and two centered beneath.'
    case 6:
      return 'Arrange six equal portrait panels in a balanced 3×2 grid.'
    case 7:
      return 'Arrange seven equal portrait panels in two centered rows: four across the top and three centered beneath.'
    case 8:
      return 'Arrange eight equal portrait panels in a balanced 4×2 grid.'
    case 9:
      return 'Arrange nine equal portrait panels in a balanced 3×3 grid.'
    default:
      throw new Error(`Faces effects require 3–9 subjects; received ${subjectCount}`)
  }
}

export const FACES_LAYOUT_FINISH =
  'All portraits are the same size and scale. Fill the canvas with the arrangement, leaving only a narrow outer margin. No large empty areas.'

export const MIN_FACES_SUBJECTS = 3
export const MAX_FACES_SUBJECTS = 9

// ───────────────────────────────────────────────────────────────────────
// THE CATALOG
// ───────────────────────────────────────────────────────────────────────

export const GROUPS_EFFECTS: Record<GroupsEffectId, GroupsEffect> = {

  art_deco: {
    id: 'art_deco',
    label: 'Art Deco',
    intake: 'group_photo',
    body: `Transform the group into one magnificent 1920s Art Deco 3D sculpture. Preserve every person's identity, expression, hairstyle, pose, proportions and interaction. Likeness and natural facial asymmetry are essential.

Simplify each figure into elegant clean sculptural planes while retaining their true facial structure. Hair follows each person's real style and becomes bold sculpted forms. Clothing transforms into sophisticated geometric Deco forms.

Compose the group within a dramatic symmetrical Art Deco setting of stepped geometry, chevrons, sunbursts and fluted forms. Use black, cream, deep jade, polished gold and restrained chrome accents. Dramatic architectural lighting emphasizes dimensional form.

Elegant, luxurious, machine-age and physically sculptural. NO TEXT.`,
    avoid: `Avoid generic symmetrical faces, illustration, organic ornament, garish colors or changing hairstyles.`,
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

  art_nouveau_faces: {
    id: 'art_nouveau_faces',
    /* Portraits' own label, not a Groups-authored variant — Rich's
       Curated/Flip correction, September 2026. Matches
       lib/v1/portraits/effect-registry.ts id:'art_nouveau'. */
    label: 'Art Nouveau',
    intake: 'multi_photo',
    faces: true,
    body: `Create an elegant multi-panel Art Nouveau artwork from the people in the single supplied group photograph, one independent portrait for each person. Include every person exactly once. Never blend identities.

Show matching head-and-shoulders portraits at consistent scale. Preserve identity, expression, age, hairstyle, natural asymmetry and distinctive facial structure. Render each with confident dark outlines, graceful period linework and softly printed color. Surround each portrait with restrained flowers, whiplash vines and a circular ornamental motif. Ornament frames the face, never obscures it.

Use parchment, muted rose, celadon, ochre, dusty blue-green and antique gold with subtle aged lithographic texture.

Each portrait occupies its own distinct decorative panel. Keep the complete arrangement within the central 90% of the canvas with clear space on all sides. NO TEXT.`,
    avoid: `Avoid generic faces, photographic rendering, modern vector art, invented hair, excessive ornament or merged identities.`,
  },

  balloon: {
    id:     'balloon',
    label: 'Balloon',
    intake: 'group_photo',
    body: `Transform the group into a sculpture built from inflated balloons - glossy latex in twisted and pressed segments, every face, head of hair and garment formed from balloon shapes tied and bunched into each person's own structure. Taut curved surfaces with bright specular highlights, the pinch and knot visible where segments meet, faint seams running the length of each balloon. Use a restrained, sophisticated near-monochromatic palette of smoked amethyst, deep aubergine, dusty plum, muted mauve and blackberry, with subtle tonal variations between individual balloons. Keep the faces in warm muted blush and taupe balloon tones. Avoid primary colours, rainbow colours and children's-party colours. The overall colour treatment should feel luxurious, editorial and distinctly adult. Every face is balloon throughout - no skin, no real hair. Likeness is critical; the features read clearly through the rounded forms on each person. Idealized and beautiful. Photographic - a real object photographed in real light, not an illustration. The background is an adult style party in a club, streamers and lights out of focus behind. Keep permanent structure on every face: lines, scars and the natural asymmetry. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: `Avoid faces painted onto balloons. Avoid real skin or hair. Avoid balloon animals or novelty shapes. Avoid losing the likenesses to rounded generic features.`,
  },

  bronze: {
    id: 'bronze',
    label: 'Bronze',
    intake: 'group_photo',
    body: `Transform the group into a magnificent contemporary cast-bronze sculpture, preserving their recognizable faces, personalities, relationships and group composition. Rich warm aged bronze with deep brown patina, subtle verdigris and beautifully modeled sculptural surfaces.

Present the group as one unified work of figurative sculpture on a substantial pale marble base in an elegant sculpture garden. The figures remain close and connected, celebrating friendship and human connection.

Photograph the sculpture relatively close from a slightly low three-quarter angle, framing from approximately the knees upward so the faces and sculptural detail dominate the image. Beautiful late-afternoon directional light rakes across the bronze, revealing texture, form and patina. Garden architecture and greenery fall softly out of focus behind it.

Award-winning fine-art photography. Monumental, tactile, timeless and unmistakably sculpted bronze. NO TEXT.`,
  },

  carved: {
    id: 'carved',
    label: 'Carved',
    intake: 'multi_photo',
    body: `Create a single extraordinary hand-carved walnut family artwork from the people in the single supplied group photograph. Treat each person independently for likeness, then compose them naturally within one continuous sculptural slab.
Likeness is essential. Preserve each person's distinctive facial structure, expression, age and hairstyle while translating them completely into carved wood.
The people themselves are entirely walnut. Faces, lips, eyelids, hair, necks, clothing and every visible surface are carved from the same solid timber, with natural grain flowing continuously through the features. There is no skin, real hair or fabric anywhere.
Keep faces finely detailed and recognizable, while hair, clothing and surrounding forms become more expressive and deeply carved. Let beautiful variations of heartwood, sapwood, knots and figuring create natural shifts in tone across the composition.
Allow the grain and carved forms surrounding each portrait to flow organically into one another, connecting the separate people into a single piece of wood.
Deep carving, visible chisel work, polished high points and rougher recessed areas give the sculpture extraordinary physical presence. Warm grazing gallery light reveals the grain and dimensional carving.
World-class contemporary wood sculpture, elegant and handcrafted. No text.`,
  },

  charcoal_faces: {
    id: 'charcoal_faces',
    label: 'Charcoal Portraits',
    intake: 'multi_photo',
    faces: true,
    body: `Create a designed multi-panel charcoal portrait collection from the people in the single supplied group photograph, one independent portrait per person. Include everyone exactly once. Never blend identities.

Each portrait occupies its own equal-sized rectangular panel. Show matching head-and-shoulders portraits at identical scale, with faces large and consistently positioned. Preserve identity, expression, age, hairstyle, natural asymmetry and distinctive facial structure.

Draw with rich compressed charcoal, vine charcoal and white chalk on warm toned paper. Faces are precise and recognizable; hair, clothing and shadows become increasingly loose and gestural. Preserve visible strokes, erased highlights, charcoal dust, smudging and rough edges.

For five portraits in a 1:1 image, use exactly two centered rows: THREE equal panels across the top and TWO equal panels centered beneath. The two bottom panels must be the SAME size as the three top panels. Fill the canvas with the five-panel arrangement, leaving only a narrow outer margin. No empty lower area.

Museum-quality handmade charcoal drawing. NO TEXT.`,
    avoid: `Avoid photographic rendering, smooth digital shading, unequal portrait sizes, loose floating portraits, large empty areas or merged identities.`,
  },

  chocolate: {
    id: 'chocolate',
    label: 'Chocolate',
    intake: 'group_photo',
    body: `convert the group into a rich chocolate sculpture. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. smooth brown milk chocolate with highly detailed features. Background should be a chocolate shop (blurred). no visible letters. satin sheen on entire sculpture Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
  },

  clockwork: {
    id:     'clockwork',
    label: 'Clockwork',
    intake: 'group_photo',
    body: `The group is built as clockwork automata, photographed not illustrated. Brass and steel plate over visible movements, tiny gears, jewelled bearings and coiled springs turning in the openings at temple, throat and shoulder. No human skin, hair or nails anywhere. Every face is shaped brass, its panels following that person's own brow, cheekbones and jaw, joints hairline-fine where the plates meet. Eyes stay human in size and spacing. Hair, beards and moustaches are flat plates with deep grooves matching each person's real hairstyle and texture. Garments rebuilt in engraved plate. Warm brass, blued steel, a little verdigris in the seams. Likeness is critical.
Real made objects in real light, the finest pieces of their kind. Place them inside an intimate old Swiss watchmaker's workshop with the charm of Geppetto's shop - tools, tiny drawers and half-finished clocks in layers behind them, tall divided-light windows onto a crooked old-European lane. Warm amber workshop light inside against soft cool daylight from the street.
Keep permanent structure on every face: lines, scars and the natural asymmetry. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding carries through in the same material.`,
  },

  colored_pencil: {
    id: 'colored_pencil',
    label: 'Colored Pencil',
    intake: 'group_photo',
    body: `Transform the group into one solid three-dimensional sculpture made entirely from colored pencil. Preserve every person's identity, expression, hairstyle, clothing, pose and interaction.

Show every person full height, head to toe. Bodies must remain physically complete within the artwork; body parts may only disappear naturally beyond the outer image crop, never terminate inside the sculpture.

Build every surface from dense visible pencil strokes wrapping around the three-dimensional forms. Use rich layered colors like fine artist's pencils and pastels, with rough directional strokes, crosshatching, smudging and strongly contrasted dark recesses against bright highlights. Faces remain recognizable but unmistakably drawn in colored pencil, with no real skin or hair.

Photograph the sculpture in real light with strong directional illumination emphasizing its physical depth and cast shadows. Set it in a richly colored old-world artist's atelier with warm timber, painted canvases, pigments and a huge ribbed skylight, heavily blurred behind to contrast with the pencil sculpture.

Tactile, dimensional, slightly rough and visibly hand-sketched. NO TEXT.`,
    avoid: `Avoid flat drawings, paper, monochrome graphite, smooth illustration, real skin or hair, or figures terminating inside the artwork.`,
  },

  colored_pencil_faces: {
    id: 'colored_pencil_faces',
    label: 'Colored Pencil Portraits',
    intake: 'multi_photo',
    faces: true,
    body: `Create a modernist multi-panel colored-pencil portrait collection from the people in the single supplied group photograph, one independent portrait per person. Include everyone exactly once. Never blend identities.

Preserve identity, expression, age, hairstyle, natural asymmetry and distinctive facial structure. Render faces with exceptional detail using many layers of fine artist's colored pencil: precise eyes, subtle skin tones, fine directional hatching, crosshatching and richly layered color. From the face outward, progressively loosen the drawing. Hair, shoulders and clothing dissolve into increasingly open, energetic strokes, broken contours and untouched paper.

Use sophisticated expressive color rather than strict photographic color. Keep visible pencil grain and individual marks throughout.

For five portraits in 1:1, use exactly two centered rows: three equal panels above and two equal panels centered beneath. All portraits same size, filling the canvas with a narrow margin.

Detailed at the center, beautifully unfinished at the edges. Contemporary fine-art drawing. NO TEXT.`,
    avoid: `Avoid photorealism, smooth digital rendering, cartoon styling, fully rendered edges, unequal panels or merged identities.`,
  },

  driftwood_resin: {
    id: 'driftwood_resin',
    label: 'Driftwood & Resin',
    intake: 'group_photo',
    body: `Transform the whole group into a contemporary sculpture combining weathered driftwood and glossy colored epoxy resin — the live-edge resin-river aesthetic. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. The driftwood preserves the form and the likeness: each face and the structural planes of every head, shoulders, and major contours are carved from pale, silvery, weathered driftwood with visible grain, knots, cracks, and organic live edges, keeping every person clearly recognizable. Flowing rivers and pools of translucent colored epoxy resin run through and between the wood — deep teal, ocean blue, amber, or emerald — filling the live-edge gaps, the cracks, and the negative spaces, catching and refracting light. The resin is where the color and translucency live; the wood is where the likeness lives. The whole piece is finished in a high-gloss polish so the resin reads as liquid-clear and the wood as satin-smooth. No human skin anywhere — every face, neck, forehead, ears and every visible surface are weathered driftwood, not skin. The wood grain, cracks and live edges continue across every face. This is the most common failure. Avoid an all-wood sculpture with no resin, or an all-resin sculpture with no wood — both materials must be present and distinct. Avoid a matte or unfinished surface; the glossy high-polish finish is required. Avoid resin that looks opaque or painted — it must read as translucent, light-catching epoxy. Avoid driftwood so abstract the faces stop being recognizable; the wood carries the likeness. Sculpture on a base in a coastal woodworker's studio — a wide window onto grey sea and sky, live-edge slabs leaning against the walls, clamps and resin buckets, sawdust light. Strong depth of field heavily blurring the background. Contemporary gallery presentation. High-gloss finish catching the light. Translucent resin rivers. Weathered live-edge driftwood. Museum-quality craftsmanship. Highly tactile and dimensional. Fine-art mixed-media sculpture. No plaque. Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
  },

  family_mosaic: {
    id: 'family_mosaic',
    label: 'Family Mosaic',
    intake: 'multi_photo',
    body: `Create a single extraordinary dimensional mosaic portrait from the people in the single supplied group photograph. Treat each person independently for likeness, then bring them together within one unified artwork.

Give each person their own softly defined area of the composition, arranged naturally across the piece at complementary scales. Do not blend identities or invent interactions between people.

Construct the artwork from thousands of irregular pieces of colored glass, glazed ceramic and stone, using larger expressive fragments through clothing and backgrounds and much finer pieces across faces to preserve recognizable likeness.

Let colors originate from each person's appearance in the source group photograph, then flow outward and intermingle across the composition, gradually connecting the separate portraits into one continuous mosaic.

Rich translucent glass, occasional gold tesserae, beautiful irregular grout lines and grazing gallery light revealing the physical depth of the surface.

One family, multiple moments, one handcrafted artwork. No frames, dividing lines or text.`,
  },

  gold: {
    id: 'gold',
    label: 'Gold',
    intake: 'group_photo',
    body: `Transform the whole group into a contemporary polished gold sculpture — mirror-bright warm yellow gold with a high specular finish, the surface smooth and flowing with no visible tool marks. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. hair is poured liguid gold that matches each person's with deep carved separations catching bright highlights. No human skin anywhere — every face is polished gold like the rest. Each person's own garment carries through in the same material. the background is an expensively appointed conservatory with many windows with warm lighting streaming through inside potted trees and plants. Make the creation match age. Mainting each person's hair style, hairline, face shape. micro gestures. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
  },

  ice: {
    id:     'ice',
    label: 'Frost & Ice',
    intake: 'group_photo',
    body: `Transform every clothed figure into a softly sculpted form of dense snow and translucent ice, with milky crystalline depth, compacted snowy surfaces, soft frost and occasional clearer icy edges. Increase opacity and softness so each facial structure is beautifully defined rather than glass-like; preserve every likeness precisely with no visible skin. Set against an icy cliff with hanging icicles, deep blue glacial shadows and a snow-covered edge catching warm sunlight; golden light falls across one side of the group while cold blue-white light shapes the other, creating a dramatic warm/cool contrast. skin is translucent ice. no real skin, hair, nails or eyes. all objects whether worn or held are color drained ice.`,
  },

  impasto_faces: {
    id: 'impasto_faces',
    /* Portraits' own label, not a Groups-authored variant — Rich's
       Curated/Flip correction, September 2026. Matches
       lib/v1/portraits/effect-registry.ts id:'oil_impasto'. */
    label: 'Oil Impasto',
    intake: 'multi_photo',
    faces: true,
    body: `Create an elegant multi-panel oil impasto artwork from the people in the single supplied group photograph, one independent portrait for each person. Include every person exactly once. Never blend identities.

Show matching head-and-shoulders portraits at consistent scale. Preserve identity, expression, age, hairstyle and distinctive facial structure. Paint each entirely with a palette knife using broad flat slabs of thick oil paint laid edge to edge. No blending or brushwork. Faces are built from confident knife strokes, with likeness carried by the meeting of warm and cool color planes. Hair and clothing use broader, looser slabs.

Each portrait occupies its own distinct canvas panel, unified by consistent scale, lighting and artistic language. Raking light reveals raised ridges and small shadows in the thick paint.

Keep the complete arrangement within the central 90% of the canvas. Museum-quality contemporary oil painting. NO TEXT.`,
    avoid: `Avoid sculpture, smooth photographic faces, brushwork, blended gradients, small broken dabs or merged identities.`,
  },

  impressionist: {
    id: 'impressionist',
    label: 'Impressionist',
    intake: 'group_photo',
    body: `Create one extraordinary group artwork from the people in the single supplied group photograph, with each person sculpted entirely from exceptionally thick Impressionist oil paint. Include every person exactly once. Preserve identity, expression, age and hairstyle. Never blend identities.

Compose the group naturally with balanced spacing, depth and subtle overlap. Keep all subjects within the central 90% of the canvas with clear background visible on all sides. No subject may touch or cross an image edge.

Faces remain unmistakably recognizable, built from bold palette-knife strokes, slabs, ridges and broken color. Hair and clothing become increasingly expressive. Draw colors from each source and amplify them into rich Impressionist harmonies. Dramatic grazing light reveals the physical thickness and sculptural shadows of the paint.

One cohesive, monumental artwork. Tactile, sophisticated and unmistakably handmade. NO TEXT.`,
  },

  impressionist_faces: {
    id: 'impressionist_faces',
    label: 'Impressionist Portraits',
    intake: 'multi_photo',
    faces: true,
    body: `Create an elegant multi-panel artwork from the people in the single supplied group photograph, one independent portrait for each person. Include every person exactly once. Never blend identities.

Show matching head-and-shoulders portraits at consistent scale. Preserve identity, expression, age, hairstyle and distinctive facial structure. Render each in dimensional Impressionist oil paint with bold palette-knife strokes, rich broken color and tactile impasto.

Arrange as a triptych, quadriptych or corresponding multi-panel composition. Keep the complete arrangement within the central 90% of the canvas with clear space on all sides. No portrait may touch an image edge.

Visually distinct portraits unified by consistent scale, lighting and artistic language. Museum-quality contemporary Impressionism. NO TEXT.`,
  },

  jade: {
    id: 'jade',
    label: 'Jade',
    intake: 'group_photo',
    body: `Transform the entire group into one extraordinary sculpture carved from translucent jade. Preserve every person's identity, expression, hairstyle, clothing, pose, proportions and interaction.

Everything is jade: faces, eyes, lips, hair, garments and held objects. No real skin, hair, nails or teeth. Use rich natural variations of celadon, pale green, deep spinach green and cloudy mineral inclusions. Highly polished with a soft waxy lustre, never glassy.

External dramatic light passes through thinner areas of the jade, creating beautiful subsurface scattering while thicker forms remain deep and substantial. The jade transmits light but never emits it.

Place the sculpture in a Japanese temple garden at night with softly illuminated cherry blossoms, heavily blurred behind. Museum-quality fine-art photography. NO TEXT.`,
  },

  layered_paper: {
    id: 'layered_paper',
    label: 'Layered Paper',
    intake: 'multi_photo',
    body: `Create one unified three-dimensional paper sculpture from the people in the single supplied group photograph. Include every person exactly once and preserve identity, expression, age and hairstyle.

Every visible part of every person is physically constructed from individually cut layers of heavyweight colored paper. Build the subjects with dramatically more layers than the surrounding scene. Faces use dozens of fine, closely stacked contour-cut layers to sculpt cheeks, brows, noses, lips and jawlines with real dimensional depth. Hair and clothing use dense overlapping layers with clearly visible cut edges and separation. No drawn, painted or printed facial features.

Simplify the setting into large abstract layered-paper shapes with minimal detail. Keep foreground objects sparse and simplified. The subjects project physically forward from the simpler, flatter environment. Everything visible is constructed paper, never illustration.

Strong grazing light creates real shadows between paper layers. Keep all subjects within the central 90% of the canvas with clear space on all sides. Contemporary handcrafted paper sculpture. NO TEXT.`,
  },

  layered_paper_faces: {
    id: 'layered_paper_faces',
    label: 'Layered Paper Portraits',
    intake: 'multi_photo',
    faces: true,
    body: `Create an elegant multi-panel layered-paper artwork from the people in the single supplied group photograph, one independent portrait per person. Include everyone exactly once. Never blend identities.

Show matching head-and-shoulders portraits at consistent scale. Preserve identity, expression, age, hairstyle and facial structure. Physically sculpt every portrait from dozens of contour-cut layers of heavyweight colored paper. Faces use many fine closely stacked layers defining brows, cheeks, noses, lips and jawlines; hair and clothing use broader overlapping pieces. Clearly show paper thickness, cut edges and separation between layers. No drawn, painted or printed facial features.

For five portraits in a 1:1 image, arrange three evenly across the top and two centered beneath, all the same size. Keep the arrangement within the central 90%.

Grazing light creates real shadows between layers. Contemporary handcrafted paper sculpture. NO TEXT.`,
    avoid: `Avoid illustration, flat collage, printed faces, origami or merged identities.`,
  },

  lichen_granite: {
    id: 'lichen_granite',
    label: 'Lichen Granite',
    intake: 'group_photo',
    body: `The group is carved directly from a massive ancient granite monolith rising from the forest floor, preserving every person's likeness while remaining unmistakably part of the original boulder. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. The stone surface is weathered by centuries of moss, colorful lichens, delicate ferns, creeping vines, and tiny woodland plants that naturally reclaim cracks and ledges, while each person's existing hair becomes moss, roots, and woodland growth that preserve its original silhouette. Warm shafts of sunlight filter through towering trees, illuminating damp stone and drifting forest particles. Preserve each person's existing clothing naturally carved into the stone, no human skin. Existing clothing remains, carved from the same weathered granite and integrated seamlessly into the monolith. Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
  },

  linocut: {
    id: 'linocut',
    label: 'Linocut',
    intake: 'group_photo',
    body: `Redraw the group as a hand-cut linocut print — bold black ink on cream paper, the image built entirely from carved marks. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified artwork - it must read as one cohesive piece rather than separate busts, statues or a flat lineup, with real depth and overlap between figures. Compose the group large and close so the subjects fill at least 85% of the canvas. Broad cleared areas of pure white, dense black masses, and the form described by parallel gouge strokes that swell and taper. Visible slips of the blade and small imperfect edges where the lino chipped. Each head of hair is a solid black shape cut with a few sweeping white gouges. One second colour, a flat overprinted ochre or red, slightly out of register. Likeness is critical. No lettering. The print lies on a bench, its edges curling. Set in a beautiful old-world artist's atelier, cluttered and eclectic, with dark aged timber, plaster walls, antique easels, stacked canvases, portfolios, drawing tools and old studies casually pinned around the room. Above is a huge ribbed industrial skylight of aged iron and glass, flooding the studio with dramatic soft daylight and long directional shadows. Atmospheric, romantic, slightly dusty, collected over generations rather than designed. Shallow depth of field. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings. NO TEXT.`,
    avoid: `Avoid grey tones or shading — the image is black, white and one flat colour. Avoid photographic rendering. Avoid a sculpture.`,
  },

  mosaic_faces: {
    id: 'mosaic_faces',
    /* Portraits' own label, not a Groups-authored variant — Rich's
       Curated/Flip correction, September 2026. Matches
       lib/v1/portraits/effect-registry.ts id:'mosaic_portrait'. */
    label: 'Mosaic',
    intake: 'multi_photo',
    faces: true,
    body: `Create an elegant multi-panel mosaic artwork from the people in the single supplied group photograph, one independent portrait for each person. Include every person exactly once. Never blend identities.

Show matching head-and-shoulders portraits at consistent scale. Preserve identity, expression, age, hairstyle and distinctive facial structure. Construct each portrait from thousands of irregular pieces of colored glass, glazed ceramic and stone, using very fine pieces across faces to preserve recognizable likeness.

Arrange as a triptych, quadriptych or corresponding divided-panel composition. Each portrait occupies its own distinct panel while sharing consistent scale, craftsmanship and lighting. Rich translucent glass, occasional gold tesserae, irregular grout lines and grazing light reveal the physical mosaic surface.

Keep the complete arrangement within the central 90% of the canvas with clear space on all sides. Museum-quality handcrafted mosaic. NO TEXT.`,
  },

  neon: {
    id: 'neon',
    label: 'Neon',
    intake: 'group_photo',
    body: `highly detailed neon tube sculpture of the whole group. fully 3d in all three directions. implied volume. use negative space. use monochromatic blues with variations on value. mounted in a small shop's storefront window at night, rain on the glass, the shop dark behind. wires and electrical lines visible. at least 100 tubes per figure. Each person's own garment carries through in the same material. Keep permanent structure on every face: lines, scars and the natural asymmetry. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding carries through in the same material - bouquets, glasses, instruments, babies, pets. Behind the window is a New York diner at night.`,
  },

  origami: {
    id: 'origami',
    label: 'Origami',
    intake: 'group_photo',
    body: `The group is folded from paper - a single continuous sheet worked into the whole arrangement, every plane a crisp fold with a visible crease line, the paper's own grain and slight thickness reading at each edge. Each face is built from a few confident planes: the brow, the bridge of the nose, the cheeks, the jaw, each a flat facet meeting at a sharp crease. Warm cream and soft indigo paper. Hair keeps its real shape and volume on every figure, folded in tighter pleats. The garments fold through in the same paper. Likeness is critical - each person reads clearly through the faceting. Photographic and highly idealized - a real folded object in real light. Background: a bare table under one soft lamp, deep shadow, heavily out of focus. Keep permanent structure on every face: lines, scars and the natural asymmetry. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings.`,
    avoid: `Avoid curved or moulded surfaces - every form is a flat fold. Avoid paper cranes or novelty shapes. Avoid torn or crumpled paper. Avoid real skin or hair.`,
  },

  petal: {
    id: 'petal',
    label: 'Petal Sculpture',
    intake: 'group_photo',
    body: `Transform the entire group into one elegant sculpture formed completely from flower petals. Preserve every person's identity, expression, hairstyle, pose, proportions and interaction.

Show every person full height, head to toe. The clothing carries the effect: garments are transformed into abundant flowing layers of folded petals with rich depth, variation and graceful overlapping forms. Faces remain recognizable and softly sculpted with subtle botanical texture and delicate petal veining, never real skin. Hair becomes curled and folded petals following each person's real hairstyle.

Use rich harmonious gradients of coral, rose, crimson, burgundy, violet, peach and cream, with occasional complete flowers emerging naturally from the sculpture as accents.

Place the unified sculpture on a simple dark wood base. Warm golden-hour backlight illuminates thin petal edges and creates soft dimensional shadows. Beautiful natural landscape heavily blurred behind. Refined, tactile, romantic and unmistakably floral. NO TEXT.`,
  },

  plushy: {
    id: 'plushy',
    label: 'Plushy',
    intake: 'group_photo',
    body: `Transform every person in the group into an adorable, soft, slightly overstuffed handmade plush toy, preserving strong facial likeness for each while gently idealizing their attractiveness and warmth. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. The figures sit together as one cohesive group, nestled and gently squished against each other exactly as they are arranged in the photograph. Give each face a sweet, lovable expression, softly flattering proportions and a subtle friendly smile without becoming cartoonish. Very soft fabric, visible hand stitching, gently uneven seams and cuddly compression. Clothing carries through entirely in soft knitted and stuffed materials. Anything a person is holding in the photograph carries through in soft plush materials too. Golden light keeps the faces bright and flattering, with soft open shadows and rich tactile detail. Lovable, cuddly, safe and deeply comforting, like treasured childhood plush toys. No letters.`,
  },

  porcelain: {
    id: 'porcelain',
    label: 'Porcelain',
    intake: 'group_photo',
    body: `The group is modelled in glazed porcelain - fine white clay, hand-thrown and kiln-fired, with a soft glassy glaze pooling in the hollows and thinning to near-white on the raised planes. Hand-painted cobalt blue decoration runs across the garments and shoulders in small repeating floral motifs, the brushwork slightly uneven as a real hand leaves it. Fine crazing across the glaze, a chip at one edge, the unglazed foot showing raw biscuit. Every face is porcelain throughout, glaze catching a single soft highlight on the cheek and brow. Hair keeps its real texture, length and shape on each figure, modelled in the same clay. Likeness is critical and comes before the material. Photographic and highly idealized - a real fired object in real light, beautifully made. Keep permanent structure on every face: lines, scars and the natural asymmetry. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets. Worn jewellery is fine: necklaces, earrings, piercings. Place the group in a delicate wood shipping box with straw packing, shipping stamps and labels on the outside.`,
    avoid: `Avoid changing the hair. Avoid a plastic or resin look - this is fired clay under glaze. Avoid decoration crossing any face. Avoid real skin or hair.`,
  },

  quilted: {
    id: 'quilted',
    label: 'Quilted',
    intake: 'group_photo',
    body: `Transform the entire group into a beautiful handmade heirloom portrait quilt. Preserve every person's recognizable identity, expression, hairstyle, clothing, pose and interaction.

Reconstruct every person entirely from individually cut and sewn fabric, appliqué, embroidery and dense quilting. Faces use finely shaped cloth pieces and delicate threadwork; hair and clothing use layered textiles and visible stitching. No printed, painted or photographic faces. Simplify surrounding details so the people remain the focus.

The quilt fills the entire canvas edge to edge. Emphasize its physical construction: softly raised quilted sections, padded contours, visible batting, puckered stitching and gentle valleys between seams casting soft dimensional shadows.

Warm golden-hour light grazes across the quilt from one side, catching raised fabric and stitching and creating beautiful soft shadows and tactile depth. Intimate, warm, handcrafted and full of feeling. NO TEXT.`,
  },

  retro_robot: {
    id: 'retro_robot',
    label: 'Atomic-Age Robot',
    intake: 'group_photo',
    body: `Transform every person into a real, physically constructed 1950s atomic-age robot while preserving each person's identity, expression, hairstyle, pose, proportions and interaction.

Construct every visible surface from pressed enamelled sheet metal, chrome, rivets, fine seams and articulated joints. Faces remain unmistakably recognizable, formed from smooth shaped metal preserving each person's facial structure and expression. Eyes, lips, hair, clothing and hands are all fabricated metal — no real skin, hair, nails or teeth. Hair follows each person's real style using shaped overlapping metal strips. Use sophisticated cream, muted red, chrome and period accent colors.

Photograph the group as real manufactured objects in real light, with convincing metal thickness, reflections, wear and dimensional construction. Never illustration, cartoon or painted artwork.

Transform the original environment into its retro-futuristic 1950s equivalent while preserving the type of setting: living room becomes an atomic-age future living room, street becomes a retro-future street, office becomes a retro-future office. Streamlined forms, period materials and optimistic space-age design, softly blurred behind.

Cinematic product photography. NO TEXT.`,
    avoid: `Avoid illustration, cartoon styling, human skin, cyborgs, camera-lens eyes, mechanical teeth or exaggerated robot faces.`,
  },

  sea_glass: {
    id:     'sea_glass',
    label: 'Sea Glass',
    intake: 'group_photo',
    body: `The group is sculpted from a single continuous form of weathered translucent beach glass, with flowing strands of individually worn sea glass preserving each person's original hairstyle. Frosted seafoam, aqua, emerald, turquoise and cobalt glass glow with brilliant internal caustics and refracted sunlight, while tiny amber fragments appear only as subtle accents. Ocean foam, spray and flowing water wrap naturally around the sculpture as it emerges from the surf. Dramatic backlighting through sea spray. Turn all clothing into sea glass and very translucent. No skin, no real hair. Each person's own garment carries through in the same material. Keep permanent structure on every face: lines, scars and the natural asymmetry. Add nothing that is not in the source. Bright catchlight in both eyes on every figure. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding carries through in the same material - bouquets, glasses, instruments, babies, pets.`,
    avoid: `No skin, ceramic, mosaic or tiled appearance.`,
  },

  sheet_music: {
    id: 'sheet_music',
    label: 'Sheet Music',
    intake: 'group_photo',
    body: `Transform the entire group into one extraordinary sculpture constructed from sheet music and flowing musical scores. Preserve every person's identity, expression, hairstyle, pose and interaction.

Every visible surface is formed from thousands of folded, curled and layered manuscript pages. Musical staffs and notation follow the true contours of faces, hair, clothing, hands and bodies, creating recognizable likeness entirely from paper. Hair becomes flowing ribbons of musical score. No human skin or real hair anywhere.

Allow selected edges of the sculpture to unravel gracefully into curling pages and fragments of musical notation, while keeping every person clearly readable.

Place the sculpture on the stage of an empty symphony hall with music stands, chairs and instruments softly disappearing into darkness behind. Warm theatrical light reveals the dimensional paper layers. Elegant, emotional and museum-quality. NO TEXT.`,
    avoid: `Avoid flat collage, printed human faces, real skin, loose random pages obscuring faces or readable titles and lettering.`,
  },

  silver: {
    id: 'silver',
    label: 'Silver',
    intake: 'group_photo',
    body: `Transform the group into a single sculpture cast in solid silver. Preserve every person's identity, facial features, expression, hairstyle, age, clothing, pose, proportions, relative position, and interaction exactly as shown. Do not add, remove, duplicate, replace, or reposition any person. Create one unified sculptural artwork - it must read as one cohesive piece rather than separate statues or busts, with real depth and overlap between figures. The silver carries a slightly dull satin sheen across most of its surface - rich, dense, unmistakably heavy metal. Polish appears the way silver actually wears, burnished where a piece would be handled and rubbed: shoulders, elbows, hands, the tops of heads, the crest of a chest. The brightness rises and falls gradually out of the satin, never a hard-edged pool of mirror against dull ground. The face stays satin throughout, with no polished patches on cheeks, brows or noses. Faces, hair and garments are all the same silver: eyes are satin silver with no wet gleam, lips and mouths are silver, and hair is silver worked into each person's real style and length, never real hair. Each person's own garment carries through in the same material. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. The sculpture stands on a rich walnut table. Behind it and slightly to one side, secondary to the piece, an open walnut presentation box lined in deep red-purple velvet, with the shape of the sculpture clearly pressed into the velvet where it sits. Full-height divided windows further back are thrown far out of focus, glowing with an evening sunset. Anything a person is holding in the photograph carries through in the same material - bouquets, glasses, instruments, babies, pets.`,
  },

  stained_glass: {
    id: 'stained_glass',
    label: 'Stained Glass',
    intake: 'group_photo',
    body: `Transform the entire group into one extraordinary three-dimensional stained-glass sculpture. Preserve every person's identity, expression, hairstyle, pose, proportions, position and interaction.

Construct every visible surface from thousands of individually fitted pieces of real art glass joined by hairline-thin metallic gold wire. Use especially fine fragmentation across faces to preserve recognizable features and dimensional anatomy. Faces, eyes, lips, hair, hands, clothing and held objects are ALL glass — absolutely no real skin, hair, nails or teeth.

Use richly varied translucent cathedral, opalescent and jewel-toned glass with organic variation in color, texture and translucency. Multiple warm internal light sources glow from different areas within the sculpture, illuminating neighboring fragments at varied intensities. Soft external directional light reveals the physical volume, reflections and sculptural shadows.

Display the unified sculpture on a beautiful substantial wood table in an elegant great room with warm natural materials, large windows and soft daylight. Keep the room heavily blurred and understated so the luminous sculpture dominates.

One magnificent solid 3D artwork, never separate figures or a flat mosaic. NO TEXT.`,
    avoid: `Avoid human skin, thick lead, black outlines, large simple panels, regular tiles, flat stained glass, uniform internal glow or washed-out colors.`,
  },

  stained_glass_faces: {
    id: 'stained_glass_faces',
    /* Portraits' own label, not a Groups-authored variant — Rich's
       Curated/Flip correction, September 2026. Matches
       lib/v1/portraits/effect-registry.ts id:'stained_glass'. */
    label: 'Stained Glass',
    intake: 'multi_photo',
    faces: true,
    body: `Create a luminous multi-panel stained-glass artwork from the people in the single supplied group photograph, one independent portrait per person. Include everyone exactly once. Never blend identities.

Show matching head-and-shoulders portraits at consistent scale. Preserve identity, expression, age, hairstyle and distinctive facial structure. Construct every face, eye, lip, hair and garment from hundreds of individually fitted pieces of translucent art glass joined by hairline-thin metallic gold wire. Use especially fine pieces across faces for likeness. No real skin or hair.

Give each portrait a sophisticated jewel-toned glass palette with warm internal illumination and darker leading defining the forms.

For five portraits in a 1:1 image, arrange three evenly across the top and two centered beneath, all the same size. Keep the arrangement within the central 90%.

Five distinct luminous panels, unified by craftsmanship and lighting. NO TEXT.`,
    avoid: `Avoid human skin, thick lead, large simple panels, flat mosaic, uniform glow or merged identities.`,
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

  ukiyo_e: {
    id: 'ukiyo_e',
    label: 'Ukiyo-e',
    intake: 'group_photo',
    body: `Transform the group into one fully three-dimensional ukiyo-e woodblock sculpture, as though a traditional Japanese print has physically risen into solid form. Preserve every person's identity, expression, hairstyle, pose and interaction.

Surfaces carry confident dark key-block lines, carved marks, faint woodgrain and visible registration between colors. Faces remain recognizable through precise restrained linework. Hair follows each person's real style. Clothing carries traditional printed textile patterns and carved folds.

Use soft indigo, ochre, muted rose and warm cream. Surround the sculpture with a dimensional ukiyo-e landscape of bokashi sky, stylised clouds, distant blue hills and a blossoming branch.

Handcrafted, tactile and unmistakably woodblock while fully dimensional. NO TEXT.`,
    avoid: `Avoid photographic skin, anime, generic faces, modern digital illustration or flat printed sheets.`,
  },

  ukiyo_faces: {
    id: 'ukiyo_faces',
    label: 'Ukiyo-e Portraits',
    intake: 'multi_photo',
    faces: true,
    body: `Create an elegant multi-panel ukiyo-e artwork from the people in the single supplied group photograph, one independent portrait for each person. Include every person exactly once. Never blend identities.

Show matching head-and-shoulders portraits at consistent scale. Preserve identity, expression, age, hairstyle, natural asymmetry and distinctive facial structure. Render each as a traditional Japanese woodblock print with confident dark key-block lines, fine carved marks, subtle woodgrain and visible registration between colors. Hair follows each person's real style. Use restrained indigo, ochre, muted rose and warm cream.

Each portrait occupies its own distinct panel, unified by consistent scale and craftsmanship. Keep the complete arrangement within the central 90% of the canvas.

Handcrafted, sophisticated and unmistakably ukiyo-e. NO TEXT.`,
    avoid: `Avoid anime, generic faces, photographic rendering, modern digital illustration or merged identities.`,
  },

  watercolor: {
    id: 'watercolor',
    label: 'Watercolor',
    intake: 'group_photo',
    body: `Transform the group into one extraordinary freestanding 3D watercolor sculpture. Preserve every person's identity, expression, hairstyle, pose and interaction.

The figures are physically formed from watercolor itself: translucent washes suspended in a pale milky medium, with visible pigment blooms, granulation, overlapping brush-shaped washes, irregular dried edges and areas of nearly clear material. Faces are softly sculpted from layered watercolor washes with recognizable features, never real skin. Hair is built from loose overlapping strokes and washes, never real hair.

The watercolor becomes progressively wetter and more translucent down the bodies. Clothing dissolves into broad flowing washes, bleeding colors, transparent edges and long pigment drips, finally melting into luminous pools of watercolor on one shared pale round base.

Photograph the sculpture relatively close in a REAL old French artist's atelier: aged timber, worn plaster, easels, brushes, stacked canvases and watercolor paintings, with a large iron-ribbed glass skylight overhead. Warm directional daylight passes through thinner areas of the sculpture, illuminating pigment and casting faint colored light.

Physical, dimensional, wet, luminous and unmistakably watercolor. No real skin, hair, nails or teeth. NO TEXT.`,
  },

  watercolor_faces: {
    id: 'watercolor_faces',
    label: 'Watercolor Portraits',
    intake: 'multi_photo',
    faces: true,
    body: `Create an elegant multi-panel watercolor portrait collection from the people in the single supplied group photograph, one independent portrait per person. Include everyone exactly once. Never blend identities.

Preserve identity, expression, age, hairstyle, natural asymmetry and distinctive facial structure. Faces are beautifully detailed with layered transparent washes, subtle granulation and precise features. From the face outward, progressively loosen the painting: hair, shoulders and clothing dissolve into wet-on-wet washes, pigment blooms, broken edges, drips and untouched watercolor paper.

Use luminous sophisticated color drawn from each subject, allowing unexpected color to emerge naturally in shadows and washes.

For five portraits in 1:1, use exactly two centered rows: three equal panels above and two equal panels centered beneath. All portraits are the same size and fill the canvas with a narrow outer margin.

Detailed and intimate at the face, loose and expressive at the edges. Museum-quality watercolor. NO TEXT.`,
    avoid: `Avoid photorealism, opaque paint, hard digital edges, fully rendered backgrounds, unequal panels or merged identities.`,
  },

  wax: {
    id: 'wax',
    label: 'Wax',
    intake: 'group_photo',
    body: `Transform the group into a single sculpture cast entirely from warm honey-cream beeswax. Preserve every person's identity, expression, hairstyle, clothing, pose, proportions and interaction. No human skin, hair, nails or teeth. Everything is the same wax; differences in clothing appear only through density, translucency, relief and texture, never different hues.

Create one unified sculpture with real depth and overlap. The wax has pronounced subsurface scattering: warm light penetrates deeply and diffuses through the material, creating a soft luminous glow beneath the surface. Thinner areas — ears, noses, fingers, hair edges, shoulders and clothing folds — become especially radiant and translucent while thicker forms remain creamy and softly opaque.

Use strong warm backlight plus generous soft frontal and side illumination so faces and sculptural detail remain bright and clearly readable. Candlelight should wrap around the figures rather than leaving them in shadow.

Faces, eyes, lips, hair and garments are all wax. Preserve natural facial structure, lines and asymmetry. Hair retains each person's real style and length. Held objects carry through in wax.

The sculpture stands on an aged oak table in a 300-year-old candle shop. Numerous large candles glow throughout the softly blurred room, creating warm pools of light against dark aged wood. Luminous, intimate and richly dimensional. NO TEXT.`,
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
 * body → avoid → [Faces layout | group_photo framing] → format composition.
 *
 * Faces effects (faces: true) get the shared portrait-panel layout clause.
 * group_photo effects get the runtime framing clause (unless runtimeFraming
 * is explicitly false). Multi_photo non-Faces effects carry their own
 * arrangement in their body and receive neither.
 *
 * The format composition clause (landscape or mobile) is appended LAST
 * so it wins over anything earlier. The NO TEXT directive lives inside
 * the composition clause — one place, every effect, never baked into
 * individual bodies.
 */
export function buildGroupsPrompt(input: {
  effectId: GroupsEffectId
  subjectCount?: number
  format?: GroupsFormat
}): string {
  const effect = GROUPS_EFFECTS[input.effectId]
  if (!effect) throw new Error(`unknown groups effect: ${input.effectId}`)

  const parts: string[] = [effect.body]

  if (effect.avoid) parts.push(effect.avoid)

  if (effect.faces && input.subjectCount) {
    // Faces / portrait-collection: shared panel layout for 3–9 subjects.
    parts.push(facesLayoutClause(input.subjectCount))
    parts.push(FACES_LAYOUT_FINISH)
  } else if (effect.intake === 'group_photo' && effect.runtimeFraming !== false && input.subjectCount) {
    parts.push(framingClause(input.subjectCount))
  }

  // Format-specific composition, appended last. Carries the NO TEXT
  // directive so it does not have to be written into every effect body.
  const fmt = input.format ?? '3:2'
  if (fmt === '9:16' || fmt === '2:3') {
    parts.push(GROUPS_MOBILE_COMPOSITION)
  } else if (fmt !== '1:1') {
    parts.push(GROUPS_LANDSCAPE_COMPOSITION)
  }

  return parts.join('\n')
}
