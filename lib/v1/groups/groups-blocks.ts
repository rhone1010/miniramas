// lib/v1/groups/groups-blocks.ts
//
// All prompt blocks for the Groups silo. Style-branched assembly:
// the assembleBlocks() function picks the right block stack based on
// the chosen style.
//
// File map:
//   1. SHARED BLOCKS         — figure fidelity, camera, luminance, height
//   2. LOCATION BLOCKS       — mantel, tea_house, pedestal, wall_mount, plushy_shelf
//   3. LIGHTING MODE BLOCKS  — gallery / collectible
//   4. ARRANGEMENT BLOCKS    — cluster, triangle, semicircle, line, tiered
//   5. STYLE: REALISTIC      — chest-line cutoff emergence + merging (8 materials)
//   6. STYLE: PEOPLE RESOLVING — gradient organic mass (4 materials)
//   7. STYLE: TRIBAL WALL MASKS — vertically oriented carved masks (2 materials)
//   8. STYLE: TRIBAL STATUE  — interlocking carved family (wood, mixed species)
//   9. STYLE REFERENCE DIRECTIVE  — when an aesthetic ref image is provided
//  10. assembleBlocks()      — branches by style, returns ordered block list

import type {
  GroupsPresetId,
  LocationId,
  LightingMode,
  Scale,
  GroupArrangement,
  GroupsRefinements,
  GroupsStyleId,
} from './groups-shared'
import { LIGHTING_MODE_BY_LOCATION } from './groups-shared'

// ════════════════════════════════════════════════════════════════
// 1. SHARED BLOCKS
// ════════════════════════════════════════════════════════════════

// MULTI-SUBJECT FIGURE FIDELITY — used by Realistic + People Resolving.
// NOT used by Tribal styles (they intentionally abstract likeness).
export const MULTI_SUBJECT_FIGURE_FIDELITY = `
FIGURE FIDELITY (PRIMARY REQUIREMENT — APPLIES TO EVERY SUBJECT):
Every face in this group must be recognizably the specific person from the source photograph. The MOST IMPORTANT requirement is that each individual subject's likeness is preserved.

Per-subject anchor features to lock per face:
- Eye spacing, eye shape, eyelid character
- Nose bridge geometry, nostril shape, nose tip
- Mouth corners, lip thickness, philtrum
- Jawline, chin shape, cheekbone structure
- Ear position and size relative to skull
- Hairline shape, hair color, hair texture
- Apparent age, ethnic features, distinguishing marks

Each subject's individual features must be preserved AS THEMSELVES — never blend two subjects' features together, never average toward a "typical" face for the group.
`.trim()

// TRIBAL FIDELITY — used by Tribal styles instead of MULTI_SUBJECT_FIGURE_FIDELITY.
// Preserves emotional essence rather than photographic likeness.
export const TRIBAL_FIDELITY = `
EXPRESSION REGISTER:
The carved faces are calm, restrained, and contemplative — soft closed or nearly-closed eyes, subtle upturned mouth corner with closed lips. Even if the source photo shows wide grins, open-mouth laughter, or animated joy, the carved interpretation is serene. The emotional read comes from form and stillness, not facial expression.
`.trim()

export const GROUPS_CAMERA_BLOCK = `
CAMERA FRAMING:
Photographed head-on, at the sculpture's eye level. The camera lens is parallel to the front face plane of the group — no overhead angle, no oblique tilt, no looking down on the subjects. Frame the full sculpture from approximately mid-thigh up (or as the framing decision dictates), with the plinth or base anchoring the bottom of the frame.

SUBJECT DOMINANCE — THE SCULPTURE IS THE FOCAL POINT:
The sculpture fills approximately 80% of the frame area. The supporting staging (mantel, shelf, pedestal, plushies, etc.) and environment are the REMAINING 20% — visible at the edges and behind the sculpture as supporting context, never competing with it for visual weight. This is a hero shot of the sculpture as a product, not an interior-design shot where the sculpture is one prop among many.

Practical translation: the sculpture's silhouette reaches close to the top and bottom edges of the frame (with comfortable but tight margin) and spans most of the horizontal frame. Staging elements (candlesticks, books, vase, walls) get pushed to the periphery and into soft focus.

The camera is positioned to read all faces clearly and frontally. No subject is blocked by another subject's body or shoulder. If figures are arranged in depth, the back-row faces sit slightly higher in frame so they read above the front row, but the camera itself stays head-on and level — not angled down to achieve this. Slight tier adjustments come from the sculpture's internal staging, not from camera tilt.

NEGATIVE: no high-angle "drone" view, no looking-down product-photo angle, no Dutch tilt, no three-quarter perspective, no wide environmental shot where the sculpture is small in frame. Front-facing, eye-level, square to the group, sculpture-dominant.
`.trim()

export const WALL_MOUNT_CAMERA_BLOCK = `
CAMERA FRAMING (WALL MOUNT):
Photographed dead head-on, perpendicular to the gallery wall. The camera is at the sculpture's vertical center, lens parallel to the wall surface. The sculpture fills approximately 80% of the frame area — close in, tight margin around the piece. The surrounding gallery wall is the remaining 20%, visible as supporting context only. No floor visible, no ceiling visible — only the gallery wall behind.

NEGATIVE: no looking up, no looking down, no oblique angle, no Dutch tilt, no wide-room shot where the sculpture is a small object on a large wall. Square, level, head-on, sculpture-dominant.
`.trim()

export const DRAMATIC_LUMINANCE_BLOCK = `
DRAMATIC LUMINANCE:
The sculpture is the brightest, most defined element in the frame. Every subject's face is lit to read clearly, but the overall composition uses cinematic light: deep shadows where they belong, hero-bright tier on the subjects, atmospheric falloff into the surroundings. Exposure target on the figures is approximately 1.6× the surrounding context.

Anti-averaging directive: no flat even illumination. Light has a clear direction and motivation. Surfaces that should be in shadow STAY in shadow.
`.trim()

export const GALLERY_LUMINANCE_BLOCK = `
GALLERY LUMINANCE:
Soft directional museum lighting. Subjects evenly readable but the lighting has direction — primary key light from one upper side, soft fill, subtle shadows that anchor the sculpture to the wall or pedestal. Neutral background, no atmospheric haze.

Anti-averaging directive: no ring-light flatness, no studio-flash overexposure. Light is gentle but directional, gallery-quality.
`.trim()

export const HEIGHT_CLASS_BLOCK = `
HEIGHT AND PROPORTION:
Preserve each subject's apparent height and bodily proportions from the source photograph. If the source contains adults and children, the sculpture must show that difference — children are smaller in scale than adults, infants smaller still. Do not render every figure at uniform adult proportions.

If the source is a multi-generation family with grandparents, parents, and children, preserve all three scales. Each subject's apparent age is communicated through height, body shape, head-to-body ratio, and facial proportions consistent with that age.
`.trim()

// ════════════════════════════════════════════════════════════════
// 2. LOCATION BLOCKS
// ════════════════════════════════════════════════════════════════

const LOCATION_BLOCKS: Record<LocationId, string> = {

  mantel: `
LOCATION — MANTEL:
The sculpture is displayed on a curated upscale mantel. White painted paneling on the wall behind, with carved rosette molding and architectural detail. Polished marble mantel surface (light cream marble with subtle gray-warm veining), clean and uncluttered.

A gilded antique mirror hangs above the mantel, partially visible behind the sculpture. THE MIRROR IS BLANK. Its reflective surface shows ONLY soft warm ambient room light, abstract paneling shadows, and a hint of unfocused wall texture — it functions as a luminous architectural element, NOT as a literal mirror.

ABSOLUTE NEGATIVES FOR THE MIRROR:
- NO reflection of the sculpture
- NO reflection of any human face, figure, or body
- NO reflection of any object on the mantel (candlesticks, books, vase)
- NO duplicate or reverse view of the scene
- NO crowd, no people, no background visible in the mirror
- The mirror's reflective surface MUST be empty, soft, and ambient — treat it like a softly lit cream-colored glass panel, not a working mirror

To one side: brass candlesticks (tarnished antique brass, two heights, white tapers). To the other side: a stack of large-format art books with visible spines (architecture, photography, monographs in the design-magazine register), and a small marble bowl. A stoneware vase with cherry blossom or magnolia branches sits at the far edge, soft and out of focus.

The mantel is a curated decorator's mantel, not a family photos mantel. No grandma's framed photographs, no kid's school portraits, no holiday cards. Sophisticated, art-world adjacent, quiet luxury.

THE PLINTH IS THE ONLY BASE — sits directly on the marble mantel surface.
`.trim(),

  tea_house: `
LOCATION — TEA HOUSE (INTERIOR):
The sculpture is displayed INSIDE a Japanese tea house — a quiet tatami-floored room with refined wabi-sabi character. The plinth sits on a low dark-wood display platform (a tokonoma alcove or a low cedar shelf), set against a soft earth-tone plaster wall (light umber, ochre, or pale clay). Tatami mats with their woven texture and dark cloth borders cover the floor in front of the platform.

Behind and to one side: white shoji paper screens with their characteristic dark wood grid, glowing softly with diffused daylight from outside. Exposed dark cedar or cypress post-and-beam framing visible at the room's structural lines. A single deliberate object accompanies the sculpture in the alcove — a small ikebana arrangement in a ceramic vessel, OR a hanging scroll (kakemono) with restrained brushwork above. Never both. Never cluttered.

Lighting is soft, indoor, intimate: warm diffused daylight filtering through the shoji screens as the primary key, with a hint of warmer interior glow (an unseen paper lantern off-frame). The light has clear direction — it rakes across the sculpture from the screened wall, defining every surface with gentle dimensional shadow. Deep restful shadows in the corners of the room.

NO outdoor garden, NO gravel, NO bonsai trees in frame, NO stone lanterns. This is the interior of the tea house, not the garden outside it.

THE PLINTH IS THE ONLY BASE — sits directly on the cedar display platform or tokonoma floor.
`.trim(),

  pedestal: `
LOCATION — PEDESTAL (BURLED WALNUT LIBRARY):
The sculpture is displayed on a rich burled walnut surface — figured grain with deep highly-polished swirling patterns, the kind found in a private library. The surface is a console table or low credenza, not a desk. Behind the sculpture, leather-bound books and matched literary sets recede into wall-deep bookshelves — warm spines, gilt lettering, decades of curation, deep architectural shadow between the shelves.

Through a tall arched window or doorway visible at one edge of the frame: a Victorian glass conservatory or greenhouse, with diffused daylight filtering through the panes, hints of green foliage and orchids inside. The conservatory's warm light spills back into the library, softening the deep wood tones.

Supporting props on the burled walnut surface, in soft focus: a brass desk lamp with a green glass shade (lit, glowing warm), a small antique magnifying glass, a leather-bound journal, possibly a globe or astrolabe at the far edge. Sophisticated scholar's collection, never cluttered.

THE PLINTH IS THE ONLY BASE — sits directly on the burled walnut surface.
`.trim(),

  wall_mount: `
LOCATION — WALL MOUNT:
The sculpture is mounted on a clean neutral gallery wall — soft warm-white or pale gray plaster surface, slight wall texture visible in raking light. NO pedestal, NO shelf, NO furniture. The piece hangs directly on the wall with subtle directional shadow cast on the wall surface itself.

The space around the sculpture is empty: no other artwork, no objects, no labels visible. Generous negative space framing the piece on all sides. The wall extends out of frame in every direction. Reads as a contemporary art gallery's hero presentation.

LIGHTING (critical for carved-mask read): two warm gallery accent spots, one from the upper-left and one from the upper-right, both at approximately 30–40° angles above the masks. The crossed key lights carve every plane, ridge, and stepped facet of the carving with crisp dimensional shadow — eye sockets, brow ridge, cheekbone, jaw, hair-mass relief all read distinctly. Color temperature of the accents is warm tungsten (≈3000K), slightly warmer than the wall's ambient. The wall behind catches a soft warm halo from the spots but stays subordinate to the sculpture, which is the brightest, most defined element in frame.

Anti-flatness directive: NO ring-light evenness, NO single overhead source, NO dim ambient-only lighting. The lighting is what makes the carving read — directional, warm, sculptural.

Subtle floor or ceiling line may be implied at the far edges but stays out of focus and out of frame center.
`.trim(),

  plushy_shelf: `
LOCATION — PLUSHY SHELF:
The sculpture is nestled into a child's pillow nest on a soft bedroom shelf or bed corner — surrounded by other larger plushies (teddy bears, soft animals, well-loved companions in worn pastels and creams). Soft cream-colored linens, a small pile of children's books with worn cloth spines visible at one edge, a knitted blanket folded loosely.

The composition reads as the most loved corner of a child's room: warm, soft, lived-in. Lighting is golden-warm and soft — early morning sun through sheer curtains, or warm bedside-lamp glow at evening. No harsh shadows.

The plushy sculpture sits directly among the other plushies, slightly elevated by a folded soft blanket beneath it. NO formal plinth, NO display pedestal — the plushies themselves are the staging.
`.trim(),
}

export function getLocationBlock(locationId: LocationId): string {
  return LOCATION_BLOCKS[locationId] || LOCATION_BLOCKS.pedestal
}

// ════════════════════════════════════════════════════════════════
// 3. LIGHTING MODE BLOCKS
// ════════════════════════════════════════════════════════════════

const LIGHTING_MODE_BLOCKS: Record<LightingMode, string> = {

  gallery: `
LIGHTING MODE — GALLERY:
Theatrical museum lighting. Volumetric beam from above, deep architectural shadow surrounding, dust motes catching the light shaft. Subjects ~1.6× the exposure of the surroundings.

PRIORITIZE: defined directional beam, dramatic top-down spotlight, deep shadows in negative space, atmospheric haze made visible by the beam, cinematic gravitas, strong tonal hierarchy.

AVOID: flat even fill, uniform brightness, soft beauty-dish wraparound, photograph-of-a-product flatness, cheerful or even illumination.

REFERENCE MOOD: cathedral spotlight on a sacred relic; private museum at twilight; auction-house preview lighting.
`.trim(),

  collectible: `
LIGHTING MODE — COLLECTIBLE:
Practical motivated lighting from the room's own sources. Warm directional light from one upper side (window, room lamp, candle, brass desk lamp). Pools of light on the subjects, cinematic vignette around the edges, soft shadows that anchor the figures to their surface.

PRIORITIZE: warm directional pools from a believable in-room source, sharp specular catches on metal surfaces, subjects ~1.6× the surrounding exposure, intentional shadow density at the frame edges.

AVOID: flat catalog flash, ring-light evenness, beam-from-nowhere drama, harsh top-down gallery shadow on a domestic scene.

REFERENCE MOOD: luxury display catalog; a Vermeer interior with one window light; collector's-cabinet hero shot at dusk.
`.trim(),
}

export function getLightingModeBlock(locationId: LocationId): string {
  const mode = LIGHTING_MODE_BY_LOCATION[locationId] || 'collectible'
  return LIGHTING_MODE_BLOCKS[mode]
}

// ════════════════════════════════════════════════════════════════
// 4. ARRANGEMENT BLOCKS — used by Realistic + People Resolving
// ════════════════════════════════════════════════════════════════

const ARRANGEMENT_BLOCKS: Record<GroupArrangement, string> = {

  cluster: `
GROUP ARRANGEMENT — CLUSTER:
Subjects gathered together in a tight informal grouping. Slight depth variation — some figures slightly forward, others slightly back — but no formal rows. Bodies oriented toward the center of the group, with subtle inward angles. Comfortable spacing, not lined up, not posed for a portrait — staged as if caught mid-conversation.
`.trim(),

  triangle: `
GROUP ARRANGEMENT — TRIANGLE:
Subjects composed into a triangular pyramid. One figure at the apex, two or more at the base. Strong stable composition; the eye reads upward through the group. Good for 3-4 figures with one focal subject.
`.trim(),

  semicircle: `
GROUP ARRANGEMENT — SEMICIRCLE:
Subjects arranged in a gentle arc, all bodies facing slightly toward an imaginary center point. Reads as inclusive — every figure has equal visual weight. Good for 5-7 figures. Wing subjects angle inward; central figures face camera. Soft curve, not a hard line.
`.trim(),

  line: `
GROUP ARRANGEMENT — LINE:
Subjects in a horizontal lineup, shoulder-to-shoulder, all facing camera. Equal hierarchy. Slight stagger in depth optional but the dominant read is horizontal. Even spacing between figures.
`.trim(),

  tiered: `
GROUP ARRANGEMENT — TIERED:
Subjects arranged on multiple vertical levels — front row sitting or kneeling, back row standing, possibly a third level if the group is large. Each level clearly readable; faces don't overlap between rows.
`.trim(),
}

export function getArrangementBlock(arrangement: GroupArrangement): string {
  return ARRANGEMENT_BLOCKS[arrangement] || ARRANGEMENT_BLOCKS.cluster
}

// ════════════════════════════════════════════════════════════════
// 5. STYLE: REALISTIC — chest-line cutoff emergence + merging
// 7 materials: plushy, wax, terracotta, bronze, iron, alabaster, wood
// ════════════════════════════════════════════════════════════════

const REALISTIC_PRESET_LINES: Record<GroupsPresetId, string> = {

  resin: `Style: hand-painted resin figurines across every subject — collectible-grade smooth resin, crisp hand-painted detail in faithful source colors, satin finish, clean sculpted edges.`,

  plushy: `Style: plushy, three-dimensional handmade fabric figures across every subject — soft sculptural register, embroidered facial features, stitched seams visible in joinery.`,

  wax: `Style: solid translucent wax sculpture across every subject, each figure pale-amber and luminous, all atop a shared cast bronze base with verdigris in the recesses.`,

  terracotta: `Style: weathered terracotta sculpture across every subject — warm earth-orange-brown clay throughout, fired and aged, the material register of an excavated artifact.`,

  bronze: `Style: cast bronze sculpture across every subject — verdigris in recesses, polish on high points, monumental register, all figures atop a shared bronze plinth.`,

  iron: `Style: hand-forged iron sculpture across every subject — deep charcoal-black metal with a soft gunmetal sheen, visible hammer-work texture on every surface, burnished highlights on raised features, darker oxide patina settled into recesses. The iron IS the color: no paint, no flesh tones, no orange rust anywhere; the palette is charcoal, graphite, and warm gunmetal only.`,

  alabaster: `Style: solid translucent alabaster sculpture across every subject — off-white to warm-cream throughout, internal glow varying with thickness, museum-grade carved stone register.`,

  wood: `Style: carved from a single wooden log as if all subjects emerge from the same trunk. The log itself is the base — flat-cut on the bottom, raw bark on the sides, no additional plinth. Subjects share grain direction and material continuity.`,

  marble: ``, // not used in Realistic
}

const REALISTIC_EMERGENCE_BLOCKS: Partial<Record<GroupsPresetId, string>> = {

  plushy: `
PLUSHY EMERGENCE:
Every face, head, and upper torso fully formed in stitched fabric with embroidered features — finished, intact, complete down through the chest. From the chest line all the way down to the base, the lower body is ENTIRELY REPLACED by visible stitches, exposed batting peeking through unfinished seams, loose threads where forms aren't yet sealed, raw fabric edges. Reads as handmade and mid-sewing.

NO RE-RESOLUTION BELOW THE CHEST: there are no fully-formed legs, hips, knees, ankles, feet, or toes; no stitched clothing that completes itself underneath; no intact plush surface that returns. The lower half of every figure exists ONLY as this exposed-stitching treatment, continuous from chest to base.

NEVER apply emergence above the chest line. Faces, hair, necks, shoulders, and upper chests stay fully stitched, sealed, finished across every figure.
`.trim(),

  wax: `
WAX EMERGENCE:
Every face, head, and upper torso fully formed in solid translucent wax — finished, intact, complete down through the chest. From the chest line all the way down to the base, the lower body is ENTIRELY REPLACED by melting: soft deformation, dripping vertical runs, pooled translucent edges, semi-transparent sagging. Resolves at the base into pools of cooled wax atop the bronze plinth.

NO RE-RESOLUTION BELOW THE CHEST: there are no fully-formed legs, hips, knees, ankles, feet, or toes; no clothing that completes itself underneath the melt; no intact wax surface that returns. The lower half of every figure exists ONLY as this melting/pooling treatment, continuous from chest to base.

NEVER apply emergence above the chest line. Faces, hair, necks, shoulders, and upper chests stay fully resolved, smooth, intact across every figure.
`.trim(),

  terracotta: `
TERRACOTTA EMERGENCE — ANCIENT AMPHORA, NOT PUZZLE PIECES:
Every face, head, and upper torso fully formed in solid weathered terracotta — finished, intact, complete down through the chest. From the chest line downward, the lower body progressively breaks away as if a centuries-old artifact had lost its lower portion to time. The breakage is LARGE, ORGANIC, and ANCIENT in character — like a recovered amphora or a weathered ruin — never small repetitive pits.

VERTICAL GRADIENT — CRITICAL:
- Just below the chest: MOSTLY INTACT terracotta, with only subtle aging cracks and a few small chips. The torso reads as solid.
- Mid-region (waist area): breakage begins — a few large missing sections at the sides and bottom edges, sweeping curved broken rims with lighter inner clay revealed at the breaks.
- Bottom edges and corners: most pronounced erosion — substantial removed portions, large jagged edges, big swept-away curves. This is where the artifact has lost the most material.

BREAKAGE CHARACTER:
- LARGE removed sections (not small pits)
- FEWER but more pronounced breaks (not many tiny ones)
- ORGANIC sweeping rims (not regular puzzle-piece holes)
- ANCIENT and WEATHERED (centuries of erosion, not freshly chipped)
- Concentrated at the BOTTOM EDGES AND CORNERS — not distributed evenly across the whole lower body
- Lighter inner clay color revealed at each broken edge

NEGATIVES — CRITICAL:
- NO uniform pitting across the surface
- NO small repeated cavities or holes
- NO puzzle-piece fragmentation
- NO regular hollow pockmarks
- The lower body is NOT a colander of small holes

NO RE-RESOLUTION BELOW THE CHEST: no fully-formed legs, hips, knees, ankles, feet, or toes; no clothing that completes itself underneath the eroded mass; no intact terracotta surface that returns past the breakage gradient described above.

NEVER apply emergence above the chest line. Faces, ears, hair, necks, shoulders, and upper chests stay fully resolved, smooth and unbroken across every figure.
`.trim(),

  bronze: `
BRONZE EMERGENCE:
Every face, head, and upper torso fully formed in cast bronze with verdigris in recesses and polish on high points — finished, intact, complete down through the chest. From the chest line all the way down to the base, the lower body is ENTIRELY REPLACED by exposed armature: skeletal wire framework, partial casting, unfinished molten pours, raw foundry transitions. Reads as a monument mid-cast.

NO RE-RESOLUTION BELOW THE CHEST: no fully-formed legs, hips, knees, ankles, feet, or toes; no clothing that completes itself underneath; no intact bronze surface that returns.

NEVER apply emergence above the chest line. Faces, hair, necks, shoulders, and upper chests stay fully cast, never showing armature or skeletal exposure.
`.trim(),

  iron: `
IRON EMERGENCE:
Every face, head, and upper torso fully formed in hand-forged iron — hammer-finished, burnished, complete down through the chest. From the chest line all the way down to the base, the lower body is ENTIRELY REPLACED by raw forge-work: hammer-welded seams, exposed rivets, rough-joined iron plates, unfinished strap-iron armature between sections.

NO RE-RESOLUTION BELOW THE CHEST: no fully-formed legs, hips, knees, ankles, feet, or toes; no iron clothing that completes itself underneath; no intact finished iron surface that returns.

NEVER apply emergence above the chest line. Faces, hair, necks, shoulders, and upper chests stay fully forged, sealed, finished — never showing weld marks across any figure.
`.trim(),

  alabaster: `
ALABASTER EMERGENCE:
Every face, head, and upper torso fully formed in solid alabaster — finished, intact, complete down through the chest. From the chest line all the way down to the base, the lower body is ENTIRELY REPLACED by translucent veiling, thin planes glowing internally where light passes through, soft mist-like dissolves. Resolves at the base into raw-cut stone, partially polished, partially unfinished.

NO RE-RESOLUTION BELOW THE CHEST: no fully-formed legs, hips, knees, ankles, feet, or toes; no clothing that completes itself underneath; no intact alabaster surface that returns.

NEVER apply emergence above the chest line. Faces, ears, hair, necks, shoulders, and upper chests stay fully resolved, opaque, intact.
`.trim(),

  wood: `
WOOD EMERGENCE:
Every face, head, and upper torso fully formed in carved natural wood — refined, polished, intact, complete down through the chest. From the chest line all the way down to the base, the lower body steps back into raw material: visible chisel and gouge marks, exposed grain planes. The lower body remains continuous with the unworked log/trunk that forms the base.

NO RE-RESOLUTION BELOW THE CHEST: no fully-formed legs, hips, knees, ankles, feet, or toes; no clothing that completes itself underneath the rough carving; no polished anatomy that returns below the chest.

NEVER apply emergence above the chest line. Faces, hair, necks, shoulders, and upper chests stay fully resolved, polished, refined across every figure.
`.trim(),
}

const REALISTIC_MERGING_BLOCKS: Partial<Record<GroupsPresetId, string>> = {

  plushy: `
PLUSHY MERGING:
Figures share stitched seams running between them — exposed batting blending between subjects below the chest, loose threads connecting forms, hand-sewn seams visibly joining one figure to the next. Reads as one continuous handmade plush. Faces and upper torsos remain individually stitched and distinct.
`.trim(),

  wax: `
WAX MERGING:
Figures connect through melted runs pooling between them — wax drips from one figure flow into shared pools at the base, lower bodies merged through suspended drip structures and joined translucent sags. Reads as a candle tableau, separate figures merged in shared melt. Faces and upper torsos remain individually formed.
`.trim(),

  terracotta: `
TERRACOTTA MERGING:
Figures emerge from a single shared mass of rough excavated clay — lower bodies fused together like ruins recovered as one piece, hollow cavities open where bodies overlap. Faces and upper torsos remain individually formed and distinct.
`.trim(),

  bronze: `
BRONZE MERGING:
Figures share a single internal armature framework — exposed skeletal structure runs between subjects below the chest, partial-cast bronze pours connecting bodies through shared structural members. Reads as a single monumental cast. Faces and upper torsos remain individually cast and distinct.
`.trim(),

  iron: `
IRON MERGING:
Figures connect through raw forge joins — hammer-welded seams span between bodies, riveted iron straps bridge across figures, rough structural iron members joining the group below the chest. Reads as one forged monument.
`.trim(),

  alabaster: `
ALABASTER MERGING:
Where figures stand close or overlap, their lower forms blend through ghostlike translucent overlap — alabaster planes pass through one another with thin glowing edges at the intersections. All subjects share a single base of raw-cut stone, bodies merging into shared translucency below the chest line.
`.trim(),

  wood: `
WOOD MERGING:
Figures emerge from a single trunk or block of wood — shared grain direction flowing through all subjects, intertwined forms connected through the unworked base, lower bodies still continuous with the raw material. Reads as one carving, not separate figures joined.
`.trim(),
}

// CROSS-CUTTING FACE RULE — Realistic style only.
// People Resolving uses a softer rule (gradient, not hard cutoff).
export const REALISTIC_FACE_RULE = `
ABSOLUTE FACE RULE — APPLIES TO EVERY SUBJECT, NO EXCEPTIONS:
Whatever transformation language the material brings (emergence, breakage, melting, exposed armature, stitched seams, or just an organic base) NEVER applies to any face, head, hair, neck, shoulder, or upper chest. These zones are ALWAYS fully resolved, intact, complete in the chosen material.

No face is ever eroded, melted, fractured, sliced, carved-incomplete, exposed-armature, mid-stitched, or geometrically-broken. No subject's face is ever blended with another subject's face. Every face is the specific source person, fully formed.

If the material's character seems to want to extend upward into the face — STOP and resolve the upper body completely. The material character lives lower in the composition (on the lower body or on the base, depending on what the material block specifies), never on the head or upper chest.
`.trim()

// ════════════════════════════════════════════════════════════════
// 6. STYLE: PEOPLE RESOLVING — gradient organic mass
// 4 materials: wood, alabaster, wax, bronze
// ════════════════════════════════════════════════════════════════

const PEOPLE_RESOLVING_MATERIAL_BEHAVIOR: Partial<Record<GroupsPresetId, string>> = {
  wood:      'Wood — flowing carved grain, smooth hand-carved transitions, weathered driftwood elegance.',
  alabaster: 'Alabaster — softly translucent stone with subtle internal glow and polished carved surfaces.',
  bronze:    'Bronze — smooth cast-metal surfaces with refined patina and sculptural weight.',
  wax:       'Wax — smooth semi-translucent material with elegant softened edges and subtle material pooling.',
}

/**
 * Unified gradient-organic block for People Resolving style.
 * Replaces emergence + merging + base for the 4 supported materials.
 */
export function getPeopleResolvingBlock(
  presetId:     GroupsPresetId,
  subjectCount: number,
): string {
  const isGroup = subjectCount > 1
  const behavior = PEOPLE_RESOLVING_MATERIAL_BEHAVIOR[presetId] || PEOPLE_RESOLVING_MATERIAL_BEHAVIOR.alabaster!

  const groupOpener = isGroup
    ? `All ${subjectCount} subjects emerge together from a SHARED flowing abstract sculptural mass that unifies the entire composition into a single artwork. The base and lower structure behave as ONE continuous organic form — never separate pedestals, never separate figures merely placed side by side.`
    : `The single subject emerges from a smooth flowing abstract mass that transitions gradually into the resolved human form.`

  const variation = isGroup
    ? `\n\nVARIATION ACROSS FIGURES — transition zones differ from figure to figure. Some subjects resolve beginning at the thighs, others at the waist or stomach, others near the lower chest or mid-arm. This variation is intentional and artistic, helping the composition feel dynamic and organically assembled rather than symmetrical or mechanically repeated.`
    : ''

  const massDescriptor = isGroup
    ? `large and small eroded voids, smooth openings, carved pockets, flowing structural bridges between figures, smooth tunnels, and elegant negative space`
    : `large and small eroded voids, smooth openings, carved pockets, and flowing negative space`

  return `
PEOPLE RESOLVING — GRADIENT ORGANIC MASS:

${groupOpener}

GRADIENT TRANSITION (NOT a hard cutoff):
The figure${isGroup ? 's' : ''} transition gradually from abstract mass to resolved realism — not abruptly. The progression is:
  • 100% abstract organic mass at the base
  • partially resolved anatomy through the legs, hips, waist, and lower torso
  • fully resolved realism at the upper chest, shoulders, arms, neck, head${isGroup ? 's' : ''}, and face${isGroup ? 's' : ''}

The disambiguation is mostly below the lower pectorals and does NOT significantly consume the arms, shoulders, or head${isGroup ? 's' : ''}. Arms and faces remain largely complete and readable.${variation}

ABSTRACT MASS AESTHETIC:
The abstract material below the resolved figure${isGroup ? 's' : ''} is a smooth flowing organic mass with ${massDescriptor} — inspired by driftwood, weathered stone, root systems, and modern organic architecture. Larger flowing masses with selectively placed openings, smooth transitions between solid and void.

NOT TO BE CONFUSED WITH:
• NOT gooey, melted-plastic, or oozing
• NOT coral, sponge-like, or chaotically pitted
• NOT oatmeal-textured or noisy
• NOT sharp fragmentation or shattered edges
The forms are SMOOTH, sculptural, elegant, emotionally readable.

BASE STRUCTURE:
The sculpture mass originates from a smaller central area — approximately 50–75% the width of the final sculpture — then spreads outward and upward in irregular asymmetrical growth to encompass the ${isGroup ? 'full group composition' : 'figure'}. A thin discrete oval plinth disc in matching material sits beneath the organic mass, color-matched to the figures.

MATERIAL BEHAVIOR:
${behavior}

PRESENTATION:
Premium gallery / collectible / museum-grade. Soft directional gallery lighting, neutral studio backdrop, premium material rendering. Emotionally expressive, architectural, modern, collectible.
`.trim()
}

export const PEOPLE_RESOLVING_FACE_RULE = `
FACE + UPPER-BODY RULE (gradient register):
Faces, heads, hair, necks, and shoulders are ALWAYS fully resolved across every figure. Arms remain largely complete and readable — never consumed by the abstract mass. The gradient transition begins below the upper pectorals and continues downward through the body into the base.

CLOTHING PRESERVATION — CRITICAL:
Every figure wears CLOTHING in the resolved upper-body zone. Shirts, dresses, jackets, tank tops, t-shirts — whatever the source photograph shows — are rendered as INTACT FABRIC in the resolved material (carved wood folds, sculpted alabaster drape, cast bronze fabric, etc.). Clothing covers the chest, shoulders, and torso fully. NEVER render figures bare-chested. NEVER let the abstract mass treatment dissolve the clothing on the upper body. If a source figure wore a shirt, the carved figure also wears a shirt; if a dress, a carved dress; if a tank top, a carved tank top.

NEVER blend two subjects' faces. NEVER apply the abstract-mass treatment to face, head, hair, neck, shoulders, or upper-body clothing. Above the upper-pectoral line, every figure is a finished resolved realistic statue of the specific source person, fully clothed in carved/sculpted versions of the source clothing.
`.trim()

// ════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════
// 7. STYLE: TRIBAL WALL MASKS — one unified merged mask sculpture
// 2 materials: wood, marble
// ════════════════════════════════════════════════════════════════

const TRIBAL_WALL_MASK_MATERIAL: Partial<Record<GroupsPresetId, string>> = {
  wood: `MATERIAL — CARVED WOOD (NATURAL, MIXED SPECIES):
Natural carved wood only — pale oak, walnut, driftwood, aged hardwood, carved ash. Different sections of the sculpture may use different wood species; the species variation IS part of the visual character, intentionally readable as multiple woods carved into one piece. Preserve visible wood grain, knots, cracks, natural variation, weathering, hand-carved texture, softened worn edges. Warm natural tones throughout.`,
  marble: `MATERIAL — CARVED WHITE MARBLE: WHITE STONE. The sculpture material is COOL WHITE MARBLE — Carrara or Statuario white marble. The dominant color reading is WHITE, with subtle cool-grey veining. NOT cream, NOT tan, NOT ivory, NOT yellow, NOT warm, NOT wood-toned. The stone reads as cool-white in any lighting, never as warm cream. Surfaces vary between polished smooth planes and hand-tooled raw carved sections. Subtle grey veining flows naturally through the merged masses; the sculpture reads as carved from a single block of white Carrara stone. If the style reference image shows warm-toned wood, IGNORE the reference's color and render the sculpture in cool WHITE marble — only borrow the BLOCK GEOMETRY from the reference, not the color.`,
}

export function getTribalWallMasksBlock(
  presetId:     GroupsPresetId,
  subjectCount: number,
): string {
  const material = TRIBAL_WALL_MASK_MATERIAL[presetId] || TRIBAL_WALL_MASK_MATERIAL.wood!

  const composition = subjectCount === 1
    ? `A single carved face sculpture mounted on the gallery wall in shallow relief.`
    : `ONE unified merged sculpture in shallow relief mounted on the gallery wall, in which ${subjectCount} carved faces interlock and overlap through shared carved forms — physically connected as a single integrated piece, NOT separate masks placed beside each other on a wall. Where the source contains a clear age/role hierarchy, smaller figures nest lower and forward; larger figures rise taller around them.`

  return `
TRIBAL WALL MASKS — UNIFIED CARVED PORTRAIT SCULPTURE:
${composition}

${material}

The faces are abstract carved caricature, NOT photographic. Preserve each subject's IDENTITY REFERENCES from the source photo: apparent age, hair shape, distinguishing features, who is parent/child, relative size. Every face stays distinct — never blend two subjects into a generic mask.

MATERIAL COLOR OVERRIDES REFERENCE COLOR:
If the style reference shows a different material color than the MATERIAL block above, the MATERIAL block wins on color. Use the reference for BLOCK GEOMETRY only, never for color.
`.trim()
}

// ════════════════════════════════════════════════════════════════
// 8. STYLE: TRIBAL STATUE — interlocking carved family
// 1 material: wood (mixed species inside the prompt)
// ════════════════════════════════════════════════════════════════

export function getTribalStatueBlock(subjectCount: number): string {
  const composition = subjectCount === 1
    ? `A single carved tribal-modernist face sculpture, free-standing on a discrete pedestal.`
    : `${subjectCount} carved tribal-modernist faces unified into ONE free-standing sculpture on a discrete pedestal — physically connected as a single integrated piece, NOT separate sculptures placed together. Where the source contains a clear age/role hierarchy, smaller figures nest lower and forward; larger figures rise taller around them.`

  return `
TRIBAL STATUE — UNIFIED CARVED FAMILY (FREE-STANDING):
${composition}

MATERIAL — CARVED WOOD: Natural carved wood — pale oak, walnut, driftwood, aged hardwood, or weathered timber. Different sections may show different wood species. Preserve visible grain, knots, hand-carved tool marks, softened worn edges. Warm natural tones.

The faces are abstract carved caricature, NOT photographic. Preserve each subject's IDENTITY REFERENCES from the source photo: apparent age, hair shape, distinguishing features, who is parent/child, relative size. Every face stays distinct — never blend two subjects into a generic mask.
`.trim()
}

// ════════════════════════════════════════════════════════════════
// 9. STYLE REFERENCE DIRECTIVE — when an aesthetic ref is provided
// ════════════════════════════════════════════════════════════════

export const STYLE_REFERENCE_DIRECTIVE = `
STYLE REFERENCE IMAGE (LAST IMAGE IN THE INPUT SET) — STYLE AUTHORITY:
The final image in the input set is a STYLE AUTHORITY — it shows the exact sculptural aesthetic, abstraction level, block-construction language, surface treatment, and expression register your output must match. Treat it as the artistic specification for THIS render.

MATCH from the reference (these are non-negotiable):
- Material color, grain, and surface texture
- LEVEL OF ABSTRACTION — how blocky, how stylized, how far from photorealism. Match this level closely. If the reference is highly abstract, your output is also highly abstract.
- BLOCK GEOMETRY AND SILHOUETTE — if the reference shows a stepped right-angle silhouette built from rectangular blocks, your output silhouette must also be stepped right-angle blocks. If the reference shows large cuboid masses with carved faces emerging from them, your output must show the same. The proportion of "visible block geometry" to "carved face surface" in your output must match the reference proportion.
- EXPRESSION REGISTER — calm, restrained, serene. Match the reference's expression character exactly. Never render faces more expressively than the reference does.
- The way figures merge with each other and with the base

PRESERVE from the source photograph(s) (the earlier images in the input set):
- The identity and apparent age of each subject (which person is the parent, which is the child)
- The number of subjects
- The relationship cues (who is close to whom, who is held by whom)
- Distinguishing physical traits at a high level (general hair shape, face shape)

The reference dictates HOW the sculpture looks. The source supplies WHO is in it.
Where they conflict, the reference wins on aesthetic, expression, AND silhouette geometry; the source wins on identity only.
NEVER let the source's photographic register override the reference's abstract carved register. NEVER render a sculpture more photorealistic, more expressive, more literally smiling, OR with a smoother silhouette than the reference image shows.
`.trim()

// ════════════════════════════════════════════════════════════════
// 10. REFINEMENT BLOCKS — toggleable detail layers
// ════════════════════════════════════════════════════════════════

export const CRAFT_DETAIL_BLOCK = `
CRAFT DETAIL:
Maximum sculpting craftsmanship across every figure — surface texture readable, edges crisp, fabric weave and hair strands visible, equipment and clothing detail at miniature scale. Each subject's individual craft is fully realized; no figure rendered with less detail than the others.
`.trim()

export const SCENE_DETAIL_BLOCK = `
SCENE DETAIL:
The surrounding environment is richly detailed — supporting elements appropriate to the chosen location are visible but secondary, never competing with the sculpture for attention. Supporting elements MUST be consistent with the LOCATION block; do not add props from a different setting.
`.trim()

// ════════════════════════════════════════════════════════════════
// COMPLEMENTARY BASE — Realistic style only.
// People Resolving handles base inside its unified block.
// Tribal styles handle presentation in their own blocks.
// ════════════════════════════════════════════════════════════════

interface BaseShapeRule {
  shape:    'round' | 'rectangular' | 'oval' | 'log' | 'integrated'
  material: string
  notes:    string
}

function getBaseShape(
  presetId:     GroupsPresetId,
  arrangement:  GroupArrangement,
  subjectCount: number,
): BaseShapeRule {

  if (presetId === 'wood') {
    return {
      shape:    'log',
      material: 'raw wood log, flat-cut bottom, raw bark sides',
      notes:    'No additional plinth — the log IS the base. The shared base is one log/trunk continuous through all figures.',
    }
  }

  const baseMaterialByPreset: Partial<Record<GroupsPresetId, string>> = {
    plushy:       'soft cushioned fabric pad, color-matched to subjects',
    wax:          'pale bronze base with verdigris in recesses',
    terracotta:   'rough cast terracotta plinth, integrated with the figures themselves',
    bronze:       'cast bronze plinth, polished top edges, verdigris recesses',
    iron:         'forged iron plinth, hammer-textured sides, burnished top edge',
    alabaster:    'raw-cut alabaster block, subtly veined',
  }

  const material = baseMaterialByPreset[presetId] || 'matching plinth, color-coordinated to subjects'

  let shape: BaseShapeRule['shape']
  let notes: string

  if (arrangement === 'line') {
    shape = 'rectangular'
    notes = `Wide rectangular plinth, length proportional to the lineup. All ${subjectCount} figures stand on this single shared base.`
  } else if (arrangement === 'tiered') {
    shape = 'rectangular'
    notes = `Stepped rectangular plinth — back row stands on the upper tier, front row on the lower tier. Both tiers continuous, single integrated base.`
  } else if (subjectCount >= 6 || arrangement === 'semicircle') {
    shape = 'oval'
    notes = `Oval plinth, longer axis spanning the group's width with comfortable margin. All ${subjectCount} figures stand on this single shared base.`
  } else {
    shape = 'round'
    notes = `Round plinth, diameter proportional to the group's footprint. All ${subjectCount} figures stand on this single shared base.`
  }

  return { shape, material, notes }
}

export function getComplementaryBaseBlock(
  presetId:     GroupsPresetId,
  arrangement:  GroupArrangement,
  subjectCount: number,
): string {
  const rule = getBaseShape(presetId, arrangement, subjectCount)
  return `
COMPLEMENTARY BASE:
Shape: ${rule.shape}.
Material: ${rule.material}.
${rule.notes}

The base is a single shared plinth across all subjects in the group. Where the transformation language merges figures together at their lower bodies, those merged forms emerge from this single base. The base material is consistent and intentional — never two separate plinths butted together, never a generic museum mount.
`.trim()
}

// Helper exports for legacy callers / tests
export function getEmergenceBlock(presetId: GroupsPresetId): string {
  return REALISTIC_EMERGENCE_BLOCKS[presetId] || REALISTIC_EMERGENCE_BLOCKS.alabaster!
}
export function getMergingBlock(presetId: GroupsPresetId): string {
  return REALISTIC_MERGING_BLOCKS[presetId] || REALISTIC_MERGING_BLOCKS.alabaster!
}
export function getRealisticPresetLine(presetId: GroupsPresetId): string {
  return REALISTIC_PRESET_LINES[presetId] || REALISTIC_PRESET_LINES.alabaster
}

// ════════════════════════════════════════════════════════════════
// BLOCK ASSEMBLY — branches by style
// ════════════════════════════════════════════════════════════════

export interface BlockAssemblyInput {
  styleId:           GroupsStyleId
  presetId:          GroupsPresetId
  locationId:        LocationId
  scale:             Scale
  arrangement:       GroupArrangement
  subjectCount:      number
  refinements?:      GroupsRefinements
  hasStyleReference?: boolean
}

export function assembleBlocks(input: BlockAssemblyInput): string[] {
  switch (input.styleId) {
    case 'realistic':
      return assembleRealistic(input)
    case 'people_resolving':
      return assemblePeopleResolving(input)
    case 'tribal_wall_masks':
      return assembleTribalWallMasks(input)
    case 'tribal_statue':
      return assembleTribalStatue(input)
    default:
      return assembleRealistic(input)
  }
}

function assembleRealistic(input: BlockAssemblyInput): string[] {
  const blocks: string[] = []
  blocks.push(MULTI_SUBJECT_FIGURE_FIDELITY)
  if (input.hasStyleReference) blocks.push(STYLE_REFERENCE_DIRECTIVE)
  blocks.push(GROUPS_CAMERA_BLOCK)
  blocks.push(DRAMATIC_LUMINANCE_BLOCK)
  blocks.push(HEIGHT_CLASS_BLOCK)
  blocks.push(getArrangementBlock(input.arrangement))
  blocks.push(getLocationBlock(input.locationId))
  blocks.push(getLightingModeBlock(input.locationId))
  blocks.push(getComplementaryBaseBlock(input.presetId, input.arrangement, input.subjectCount))
  const emergence = REALISTIC_EMERGENCE_BLOCKS[input.presetId]
  const merging   = REALISTIC_MERGING_BLOCKS[input.presetId]
  if (emergence) blocks.push(emergence)
  if (merging)   blocks.push(merging)
  blocks.push(REALISTIC_FACE_RULE)
  if (input.refinements?.craftDetail !== false) blocks.push(CRAFT_DETAIL_BLOCK)
  if (input.refinements?.sceneDetail !== false) blocks.push(SCENE_DETAIL_BLOCK)
  return blocks
}

function assemblePeopleResolving(input: BlockAssemblyInput): string[] {
  const blocks: string[] = []
  blocks.push(MULTI_SUBJECT_FIGURE_FIDELITY)
  if (input.hasStyleReference) blocks.push(STYLE_REFERENCE_DIRECTIVE)
  blocks.push(GROUPS_CAMERA_BLOCK)
  blocks.push(GALLERY_LUMINANCE_BLOCK)
  blocks.push(HEIGHT_CLASS_BLOCK)
  blocks.push(getArrangementBlock(input.arrangement))
  blocks.push(getLocationBlock(input.locationId))
  blocks.push(getLightingModeBlock(input.locationId))
  blocks.push(getPeopleResolvingBlock(input.presetId, input.subjectCount))
  blocks.push(PEOPLE_RESOLVING_FACE_RULE)
  if (input.refinements?.craftDetail !== false) blocks.push(CRAFT_DETAIL_BLOCK)
  return blocks
}

function assembleTribalWallMasks(input: BlockAssemblyInput): string[] {
  const blocks: string[] = []
  blocks.push(TRIBAL_FIDELITY)
  if (input.hasStyleReference) blocks.push(STYLE_REFERENCE_DIRECTIVE)
  blocks.push(WALL_MOUNT_CAMERA_BLOCK)
  blocks.push(GALLERY_LUMINANCE_BLOCK)
  blocks.push(getLocationBlock('wall_mount'))
  blocks.push(getTribalWallMasksBlock(input.presetId, input.subjectCount))
  return blocks
}

function assembleTribalStatue(input: BlockAssemblyInput): string[] {
  const blocks: string[] = []
  blocks.push(TRIBAL_FIDELITY)
  if (input.hasStyleReference) blocks.push(STYLE_REFERENCE_DIRECTIVE)
  blocks.push(GROUPS_CAMERA_BLOCK)
  blocks.push(GALLERY_LUMINANCE_BLOCK)
  blocks.push(HEIGHT_CLASS_BLOCK)
  blocks.push(getLocationBlock('pedestal'))
  blocks.push(getTribalStatueBlock(input.subjectCount))
  return blocks
}
