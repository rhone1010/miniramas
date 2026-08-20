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
  | 'folded_book'
  // picture styles
  | 'cubism'
  | 'art_nouveau'
  | 'ukiyo_e'
  // period costume
  | 'victorian'
  | 'elizabethan'
  | 'renaissance'
  | 'persian_court'
  | 'samurai'
  | 'wild_west'
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

  // ── PERIOD COSTUME ───────────────────────────────────────────────────

  victorian: {
    id:     'victorian',
    label:  'Victorian',
    intake: 'group_photo',
    body: `Transform this photograph into a Victorian family portrait, preserving every face, skin tone and ethnicity precisely. Dress each person in period clothing appropriate to their apparent sex and age: velvet frock coats, patterned silk waistcoats and cravats for the men and boys; silk gowns with lace, high collars and long full skirts for the women and girls, hair pinned with soft curls. Hats where they suit the person. Period detailing throughout.
Deep saturated teal, peacock blue, burgundy, turquoise, ivory and antique gold dominate the portrait. Romantic painterly photography with luminous warm skin, rich directional window light, glowing highlights, deep velvety shadows and jewel-like colour. A Victorian interior dissolves behind them into dark teal, warm amber and golden bokeh.
Give the entire photograph a subtle aged finish with softened blacks, warm highlights and gentle painterly grain, while retaining saturated colour and luminous detail.
Preserve each face, skin tone, ethnicity, age, proportions and natural asymmetry. Refine temporary skin imperfections without changing anyone's identity.`,
  },

  elizabethan: {
    id:     'elizabethan',
    label:  'Elizabethan',
    intake: 'group_photo',
    body: `Transform this photograph into an Elizabethan portrait, preserving every face and ethnicity precisely. Dress each person in richly woven velvet, silk and brocade appropriate to their apparent sex and age: doublets and jerkins for the men and boys; court gowns with embroidered bodices, pearl detailing and lace cuffs for the women and girls, with period-dressed hair. Elaborate lace ruffs throughout, and restrained antique jewellery.
Everyone belongs completely to the period rather than appearing as modern people in historical costume. Natural, reserved courtly posture. Avoid modern portrait poses and contemporary fashion or glamour styling.
Photograph them deep inside an intimate Elizabethan manor chamber by dim firelight and candlelight, with dark carved oak, faded tapestries, aged plaster, heavy textiles and glimpses of leaded-glass windows disappearing into shadow. The room should feel inhabited and old rather than staged.
Give the entire photograph a softly aged, time-worn colour character: faded wine red, aged black, tarnished gold, tobacco brown, warm umber and muted forest green, with pearl and ivory in the lace. Slightly desaturated colours, lifted warm blacks, gentle amber haze, restrained contrast, subtle grain and softened highlights, as though the image has acquired centuries of patina. Deep velvety shadows and the uneven falloff of candlelight.
Romantic and intimate rather than theatrical, like an old Elizabethan oil portrait somehow captured through a camera - imperfect and atmospheric.
Preserve each face, age, ethnicity, proportions and natural asymmetry.`,
  },

  renaissance: {
    id:     'renaissance',
    label:  'Renaissance',
    intake: 'group_photo',
    body: `Transform this photograph into a realistic Renaissance family portrait. Do not modify ethnicity. Warm earth palette of umber, ochre, deep red and black. Dress each person in period clothing appropriate to their apparent sex and age: slashed velvet doublets with full soft sleeves, fine linen shirts at the collar and a single gold chain for the men and boys; velvet gowns with a squared neckline over a linen chemise, full sleeves tied at the shoulder with the chemise puffing through the lacing, hair parted at the centre and dressed with a fine pearl net for the women and girls. No ruffs.
Calm, settled expressions. Background: a Renaissance interior - a plastered wall in warm ochre, a carved walnut chest, a heavy tapestry with faded figures, and a leaded window throwing one shaft of light. Deep shadow, warm dim air, slightly out of focus.
Flattering soft key light, shadow separating jaw from neck. Clear the skin - blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age.
Desaturate skin colours 15% and add a filter to age the entire photograph slightly.`,
  },

  persian_court: {
    id:     'persian_court',
    label:  'Persian Court',
    intake: 'group_photo',
    body: `Transform this photograph into an intimate portrait of a family of the Safavid Persian court, preserving every face and ethnicity precisely. Dress each person in richly woven crimson, madder red and tarnished-gold brocade with layered period garments and restrained antique jewellery, appropriate to their apparent sex and age: jewelled sashes and Safavid turbans for the men and boys; layered pearls, delicate gold jewellery and fine silk veils flowing from small jewelled caps for the women and girls, hair falling loosely beneath.
Everyone belongs completely to the period, with natural, reserved courtly posture and quiet, self-possessed expressions. Avoid modern posing and contemporary styling.
Photograph them in an intimate Safavid palace chamber by dim oil-lamp and candlelight, with carved plaster, faded Persian textiles, dark wood and intricate tilework disappearing into shadow. Photographed by available lamplight - real skin texture, shallow depth of field, the falloff of a single flame.
Give the entire photograph a softly aged, time-worn character: faded crimson, tarnished gold, tobacco brown, warm umber and muted lapis. Slightly desaturated colours, warm lifted blacks, amber haze, subtle grain and softened highlights. Deep velvety shadows with uneven flame falloff.
Romantic and intimate rather than theatrical, like an old Persian court portrait somehow captured through a camera - imperfect and atmospheric.
Period objects may be held - a book, a scroll, a cup, prayer beads, a flower. Nothing modern.
Preserve each face, skin tone, ethnicity, age, proportions and natural asymmetry.`,
  },

  samurai: {
    id:     'samurai',
    label:  'Samurai',
    intake: 'group_photo',
    body: `Professional cinematic portrait of a family of Edo-period samurai in authentic armour, layered lacquered lamellar plates and thick silk lacing, with the convincing weight, wear and imperfection of real historical armour. Red and blue lacquer across the group. Hair naturally arranged beneath the helmets, worn or held as suits each person. Preserve every face, skin tone, ethnicity and permanent features.
Strong late-afternoon sunlight sweeps across them from the side, sculpting faces and armour with luminous highlights and deep expressive shadows. Use foreshortening and strong dynamic lighting.
Photographic realism with the richness and visual poetry of a great painted portrait - atmospheric, tactile and subtly painterly without becoming an illustration. Rich restrained colour, beautiful falloff, shallow depth of field, softly impressionistic Japanese setting. Idealized and striking while remaining completely believable as a photograph.
Age the photograph with filters and reduce saturation on skin tones by 15%.`,
  },

  wild_west: {
    id:     'wild_west',
    label:  'Wild West',
    intake: 'group_photo',
    body: `make this photograph a realistic photo of a frontier family of the American West, 1880s. muted palette of dust, tobacco brown, faded indigo and oxblood - low in contrast, no clean whites, everything worn and sun-faded. Dress each person for the period according to their apparent sex and age: wool waistcoats over collarless shirts, knotted neckerchiefs and broad felt hats creased and stained with wear for the men and boys; high-collared calico bodices buttoned to the throat, a small cameo at the collar and wool shawls over the shoulders for the women and girls, hair pinned up but loosening with strands falling around the face. do not crop the hats.
calm, settled expressions, weathered skin. do not modify ethnicity. likeness is important.
Background: a saloon back room - plank walls, a stove, bottles on a shelf, one dirty window off to the left. deep shadow, warm dim light falling off fast. heavily out of focus, only shapes and glow readable.
Flattering soft key light, shadow separating jaw from neck. Clear the skin - blemishes, spots and blotchiness go. Keep permanent structure: lines, scars and the natural asymmetry of each face. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age.`,
  },

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
    body: `highly detailed neon tube sculpture of the whole group. fully 3d in all three directions. implied volume. use negative space. use monochromatic blues with variations on value. mounted in a small shop's storefront window at night, rain on the glass, the shop dark behind. wires and electrical lines visible. at least 100 tubes per figure. Each person's own garment carries through in the same material. Flattering soft key light, shadow separating jaw from neck. Keep permanent structure on every face: lines, scars and the natural asymmetry. Add nothing that is not in the source. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding carries through in the same material - bouquets, glasses, instruments, babies, pets.`,
  },

  sea_glass: {
    id:     'sea_glass',
    label:  'Sea Glass',
    intake: 'group_photo',
    body: `The group is sculpted from a single continuous form of weathered translucent beach glass, with flowing strands of individually worn sea glass preserving each person's original hairstyle. Frosted seafoam, aqua, emerald, turquoise and cobalt glass glow with brilliant internal caustics and refracted sunlight, while tiny amber fragments appear only as subtle accents. Ocean foam, spray and flowing water wrap naturally around the sculpture as it emerges from the surf. Dramatic backlighting through sea spray. Turn all clothing into sea glass and very translucent. No skin, no real hair. Each person's own garment carries through in the same material. Clear the skin - blemishes, spots and blotchiness go. Keep permanent structure on every face: lines, scars and the natural asymmetry. Add nothing that is not in the source. Bright catchlight in both eyes on every figure. Never reshape, enlarge eyes, correct asymmetry or de-age. Anything a person is holding carries through in the same material - bouquets, glasses, instruments, babies, pets.`,
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
