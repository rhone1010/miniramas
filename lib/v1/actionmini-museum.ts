// actionmini-museum.ts
// lib/v1/actionmini-museum.ts
//
// Action Minis MUSEUM preset — desk-based product presentation.
//
// Mirrors actionmini-insitu.ts in structure (identity, pose, kinetic intensity,
// secondary figures, mood-keyed lighting, material frame), but replaces the
// scene-matched environment with a polished walnut desk in a softly-blurred
// curator's study. The diorama is presented as a precious displayable object,
// not embedded in its native environment.
//
// Use cases:
//   - Showcase the diorama as a collectible product
//   - Display variants where the action sculpt should dominate the frame
//   - Pair with In-Situ on the same image to show the object both contextualized
//     and isolated
//
// Mood-keyed studio lighting (all bright, off-screen window sunlight from left):
//   - golden:   bright warm afternoon sun streaming in
//   - dramatic: bright directional sun streaming in, well-defined shadows
//   - vivid:    bright cool morning sun streaming in

import type { ActionMiniHero, ActionMiniSecondaryFigures } from './actionmini-insitu'

export interface ActionMiniMuseumInput {
  kineticMedium:         string
  actionDescription:     string
  freezeMomentQuality?:  string
  hero:                  ActionMiniHero | null
  secondaryFigures?:     ActionMiniSecondaryFigures
  distinctiveFeatures?:  string
  sourceLighting?:       string
  displayName?:          string
  mood:                  string
  plaqueText?:           string
  notes?:                string
}

// ── MOOD + STUDIO LIGHTING ─────────────────────────────────────
// All moods anchor on BRIGHT sunlight streaming in from off-screen (window-left,
// out of frame). The diorama is brilliantly illuminated in every variant.
// Mood determines the CHARACTER of the bright light (warm/directional/cool), not its
// intensity. The room behind the diorama is bright with sun-bounce — never dim.
const MOODS: Record<string, string> = {
  golden: `MOOD: Bright warm afternoon sunlight — late afternoon sun streaming through an off-screen window from the left, honey-toned warmth saturating the scene, the room glowing.

LIGHTING APPROACH:
Strong warm directional sunlight from off-screen window-left — the light source is implied, never visible in frame. The diorama is BRILLIANTLY LIT — every painted surface catches the warm sun. The walnut desk surface gleams with warm specular highlights, wood grain glowing amber. Shadows on the desk are long, soft-edged, warm-toned, but the LIT side of everything is bright and full of color. The room behind the diorama is bright with sun-bounce — bookshelves visible in soft focus, warm ambient fill from the sunlight reflecting off walls. The whole scene reads as a sun-drenched study at the warmest part of a beautiful afternoon.

NO dim or evening connotations. The room is BRIGHT. The mood is warmth and abundance, not melancholy.

NO outdoor volumetric beams or god-rays — this is window light through glass, but it's STRONG window light filling the room.`,

  dramatic: `MOOD: Bright directional sunlight — strong sun streaming through an off-screen window-left, well-defined shadows, saturated color, theatrical without being dim.

LIGHTING APPROACH:
Strong directional sunlight from off-screen window-left — the light source is implied, never visible in frame. The diorama is BRILLIANTLY LIT on its sun-facing side — speculars bright, painted resin catching clean highlights, walnut desk gleaming where the sun lands. Shadows on the desk are well-defined but NOT muddy or black — there's plenty of bounce light filling them so detail is still readable. The shadow side of the diorama is in shade but still legible — like standing in a sunlit room and looking at a sculpture lit from one direction. The room behind has bright sun-patches where the light falls across the walls or shelves, with deeper shade in the corners.

NO theatrical-darkness. NO black-shadow drama. This is bright daylight with strong direction — confident and clear, not moody.

NO atmospheric beam visible in air — the drama is in the contrast and direction, not in volumetric rays.

The lighting should read as composed and intentional, like a photographer carefully placed the diorama in afternoon window light to bring out form and surface.`,

  vivid: `MOOD: Bright cool morning sunlight — crisp clear sun streaming through an off-screen window-left, slightly cool color temperature, the action at its most legible and alive.

LIGHTING APPROACH:
Strong neutral-cool directional sunlight from off-screen window-left — the light source is implied, never visible in frame. The diorama is BRILLIANTLY LIT — colors at full saturation, painted resin catching bright clean highlights, walnut desk surface clearly lit with grain visible. Shadows on the desk are sharp and clean but not theatrical — defined by clear morning light. The room behind is bright and crisp, slightly cool ambient, sun-bounce filling everything.

NO atmospheric haze or volumetric rays — the light is clear and direct, like a clean studio with morning daylight balance. The whole scene reads as a bright clear morning where everything is at its sharpest.

The mood is clarity and energy. The room is BRIGHT.`,
}

// ── KINETIC INTENSITY BLOCK (SAME AS IN-SITU — UNIVERSAL) ──────
const KINETIC_INTENSITY_BLOCK = `KINETIC INTENSITY (CRITICAL — APPLIES TO ALL EFFECTS):

INTENSITY SCALES WITH PHYSICAL CONTACT (READ FIRST):
The amount of kinetic detail must match the moment in the source pose:

- HIGH-CONTACT moments (wheels in dirt, board carving snow, paddle in water, grinding rail, sprint footstrike, sharp turn): full kinetic expression — large plumes, thick spray, rich contact areas, dense particulate scatter, abundant terrain detail.
- AIRBORNE or LIGHT-CONTACT moments (mid-jump, hurdle apex, mid-air trick, peak of bound, gliding stride, body extended in flight): restrained — show only the residue of recent contact (a thin trail, a dissipating puff, a faint mark on the takeoff point, a few suspended particles in air). The action is mostly clean — gravity, not abundance, defines the moment.

A hurdler at jump apex shows minimal dust because feet aren't touching ground. A kayaker driving into a wave shows full water expression. A bike rider mid-corner with rear tire grounded shows a full dust plume. A skater at the peak of a kickflip shows minimal effect, while landing the same trick shows full effect.

When in doubt, look at where the figure is in CONTACT with the terrain in the source pose, and how firmly. Match intensity to that contact.

THE THREE LAYERS BELOW APPLY AT WHATEVER INTENSITY THE MOMENT WARRANTS:

The sculpt should show three universal layers of kinetic detail beyond the main effect mass:

1. SURFACE TRAIL — the action has been MOVING through the scene, not just frozen at one point. Visible marks on the sculpted base behind the figure showing where the action came FROM: tire ruts, ski tracks, foam wake, scuff marks, footprint trails, terrain furrows. The trail extends across a significant portion of the plate top behind the figure.

2. PARTICULATE SCATTER — fine secondary detail in a halo around the main kinetic point. Not just one plume — also dozens of smaller particles, droplets, dust motes, dirt fragments, snow crystals, chalk specks, sparks scattered through the air around and behind the figure. These secondary particles read as atmospheric texture and real physics.

3. CONTACT AREAS — places on the sculpt where the kinetic action meets the terrain most firmly. Splash zones with rich foam, marks where wheels dig in, divots beneath heels, churn patches where spray meets surface, displacement detail. The terrain shows real evidence of being acted upon.

These three layers turn a clean kinetic snapshot into a real moment. Their volume matches the contact — abundant where contact is firm, restrained where the figure is airborne or in light contact.

NOTE FOR MUSEUM PRESENTATION:
All sculpted kinetic detail (spray, dust, particles, terrain) is PART OF THE SCULPT — it terminates at the plinth rim. No environmental haze around the diorama; particles exist only as resin/painted detail on the sculpted top. The desk and room around the diorama are CLEAN.`

// ── EFFECTS BY MEDIUM (SAME LANGUAGE AS IN-SITU, MINUS ATMOSPHERIC SURROUND) ──
const MEDIUM_EFFECTS: Record<string, string> = {
  whitewater: `EFFECTS — WHITEWATER KINETIC SCENE ON THE PLATE:

Sculpted water is a horizontal mass across the plate top with vertical kinetic energy — multiple foam patches, wave forms, sculpted rocks, spray rising off kinetic contact points.

- Sculpted spray rises vertically from paddle and bow impact points
- Foam crests rise from turbulence zones
- Translucent green-blue resin in calmer pockets, opaque foam on turbulence

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Foam wake and disturbed water trail behind the kayak — churned wake extending back across the plate
- SCATTER: Dozens of individual sculpted droplets and water specks in a HALO around the kayak and paddle
- CONTACT: Rich foam and white aerated water where the bow meets the wave, displacement pattern in the wave face

HERO POSITIONING:
Hero kayaker embedded in the action. Figure is 25-32% of object height (slightly larger than In-Situ since the diorama dominates the frame here).

All sculpted whitewater terminates at the plinth rim. Nothing extends onto the desk.`,

  surf: `EFFECTS — SURF KINETIC SCENE ON THE PLATE:

Sculpted wave crest rises across the plate top with sculpted spray peeling from the lip — translucent blue-green resin curl, white foam at the breaking edge, vertical spray plume where the surfer's rail cuts the face.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Foam line along the wave face behind the surfer where the board has carved
- SCATTER: Sculpted spray droplets in a halo behind the rail, fine mist particles suspended above the lip
- CONTACT: Rich foam at the wave breaking edge, displaced water around the board

HERO POSITIONING:
Hero surfer embedded on the wave face. Figure is 25-32% of object height.

All sculpted wave and spray terminates at the plinth rim. Nothing extends onto the desk.`,

  snow: `EFFECTS — SNOW KINETIC SCENE ON THE PLATE:

Sculpted snow surface across the plate top with carved turn marks, sculpted snow plume rising from the ski/board edge, suspended snow crystals in the air around the figure.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Carved ski/board tracks extending back across the plate from the figure
- SCATTER: Dozens of sculpted snow crystals and powder specks in a halo around the kinetic point
- CONTACT: Visible displacement where the edge meets the snow, sculpted plume rising from the carve

HERO POSITIONING:
Hero rider embedded in the slope. Figure is 25-32% of object height.

All sculpted snow and spray terminates at the plinth rim. Nothing extends onto the desk.`,

  skate: `EFFECTS — SKATE KINETIC SCENE ON THE PLATE:

Sculpted ramp/ledge/street terrain across the plate top with the skater mid-trick, sculpted dust and grind sparks at contact points, suspended particles in the air.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Scuff marks and wheel tracks on the sculpted concrete leading up to the trick
- SCATTER: Sculpted dust specks, grind sparks, chalk-fine debris in a halo around the trick
- CONTACT: Sculpted grind line where the trucks meet the ledge, displaced concrete dust

HERO POSITIONING:
Hero skater embedded in the trick. Figure is 25-32% of object height.

All sculpted terrain and effects terminate at the plinth rim. Nothing extends onto the desk.`,

  bike: `EFFECTS — BIKE KINETIC SCENE ON THE PLATE:

Sculpted dirt/trail/road terrain across the plate top with the rider mid-action, sculpted dust plume rising from the rear wheel, suspended dirt fragments in the air around the kinetic point.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Tire ruts extending back across the plate from where the bike came from
- SCATTER: Dozens of sculpted dust specks and dirt fragments in a halo around the bike
- CONTACT: A deep mark where the rear tire meets the surface, sculpted dust plume rising vertically from that point

HERO POSITIONING:
Hero rider embedded on the bike. Figure is 25-32% of object height.

All sculpted terrain and dust terminates at the plinth rim. Nothing extends onto the desk.`,

  climb: `EFFECTS — CLIMB KINETIC SCENE ON THE PLATE:

Sculpted rock face / boulder / wall on the plate top with the climber mid-move, sculpted chalk dust at the holds, suspended chalk specks in the air around the body.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Chalked holds visible on the sculpted rock leading up to the climber's position
- SCATTER: Fine sculpted chalk dust in a halo around the climber's hands and body
- CONTACT: Sculpted chalk smears at the active hold, displaced chalk where the foot rests

HERO POSITIONING:
Hero climber embedded on the rock. Figure is 25-32% of object height.

All sculpted rock and chalk terminates at the plinth rim. Nothing extends onto the desk.`,

  run: `EFFECTS — RUN KINETIC SCENE ON THE PLATE:

Sculpted track/trail/terrain across the plate top with the runner mid-stride, sculpted dust kicking up from the footstrike, suspended particles in the air behind.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Footprint trail on the sculpted surface extending back from the runner
- SCATTER: Sculpted dust specks and surface particles in a halo around the footstrike
- CONTACT: Sculpted divot or compression mark beneath the footfall, displaced surface material

HERO POSITIONING:
Hero runner embedded in the stride. Figure is 25-32% of object height.

All sculpted terrain and dust terminates at the plinth rim. Nothing extends onto the desk.`,

  dance: `EFFECTS — DANCE KINETIC SCENE ON THE PLATE:

Sculpted floor surface (stage, street, studio) across the plate top with the dancer mid-movement, sculpted fabric flow and motion blur in the resin, suspended particles where the body moves through air.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Whatever marks the movement leaves on the sculpted floor — scuff arcs, trailing fabric, motion implied in the sculpt
- SCATTER: Sculpted fabric folds caught mid-movement, suspended particles in the air around the figure
- CONTACT: Where the body weight grounds — sculpted compression or tension lines on the floor

HERO POSITIONING:
Hero dancer embedded in the movement. Figure is 25-32% of object height.

All sculpted floor and effects terminate at the plinth rim. Nothing extends onto the desk.`,

  combat: `EFFECTS — COMBAT KINETIC SCENE ON THE PLATE:

Sculpted mat/floor/ring surface across the plate top with the figures mid-engagement, sculpted dust and particulate where bodies grip and pivot, suspended particles in the air around the kinetic point.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Scuff arcs on the sculpted mat where bodies have moved
- SCATTER: Sculpted fabric flow, sweat droplets, fine dust specks in a halo around the engagement
- CONTACT: Visible compression where bodies engage with the mat, sculpted displacement

HERO POSITIONING:
Hero figure embedded in the action. Figure is 25-32% of object height.

All sculpted mat and effects terminate at the plinth rim. Nothing extends onto the desk.`,

  other: `EFFECTS — KINETIC SCENE ON THE PLATE:

Sculpted terrain across the plate top appropriate to the action, sculpted kinetic effects rising from contact points, suspended particles in the air.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Whatever marks the action would naturally leave on the sculpted base behind the figure
- SCATTER: Dozens of individual sculpted secondary particles in a halo around the kinetic point
- CONTACT: Visible physics evidence where the action displaces or affects the sculpted terrain

Figure is 25-32% of object height. All sculpted effects terminate at the plinth rim. Nothing extends onto the desk.`,
}

// ── IDENTITY LOCK (SAME AS IN-SITU) ────────────────────────────
function buildIdentityLock(hero: ActionMiniHero | null): string {
  if (!hero) {
    return `HERO — PAINTED RESIN MINIATURE FIGURE:
Render as a museum-quality painted resin miniature appropriate to the source photograph. Gestalt-level likeness — recognizable by general features, age, skin tone, hair, gear — not photographic identity.`
  }

  const lines: string[] = []

  const coreParts = [
    hero.age_range && `age: ${hero.age_range}`,
    hero.gender_presentation && `gender presentation: ${hero.gender_presentation}`,
    hero.ethnicity_apparent && `apparent ethnicity: ${hero.ethnicity_apparent}`,
    hero.skin_tone && `skin tone (paint base): ${hero.skin_tone}`,
  ].filter(Boolean)
  if (coreParts.length) lines.push(`APPEARANCE: ${coreParts.join(' — ')}`)

  if (hero.hair) {
    const h = hero.hair
    const hairParts = [h.color, h.length, h.style, h.distinct_features && `(${h.distinct_features})`]
      .filter(Boolean).join(', ')
    if (hairParts) lines.push(`HAIR (sculpted): ${hairParts}`)
  }

  if (hero.face) {
    const faceParts = [
      hero.face.shape && `${hero.face.shape} face shape`,
      hero.face.notable_features,
    ].filter(Boolean).join(', ')
    if (faceParts) lines.push(`FACE (general features): ${faceParts}`)
  }

  if (hero.glasses && hero.glasses_description) lines.push(`EYEWEAR: ${hero.glasses_description}`)
  if (hero.facial_hair) lines.push(`FACIAL HAIR: ${hero.facial_hair}`)
  if (hero.expression) lines.push(`EXPRESSION: ${hero.expression}`)

  const gearParts = [
    hero.gear_top && `top/torso: ${hero.gear_top}`,
    hero.gear_head && `head: ${hero.gear_head}`,
    hero.gear_hands && `hands: ${hero.gear_hands}`,
  ].filter(Boolean)
  if (gearParts.length) lines.push(`GEAR (painted resin, colors exact — PRIMARY IDENTITY ANCHOR):\n  - ${gearParts.join('\n  - ')}`)

  if (hero.body_position) lines.push(`BODY POSITION (PRESERVE EXACTLY): ${hero.body_position}`)

  return `HERO — PAINTED RESIN MINIATURE FIGURE (GESTALT-LEVEL LIKENESS):

At this small scale the hero is recognized by GEAR COLORS, POSE, and ACTION — not photographic face identity.

${lines.join('\n\n')}

IDENTITY DISCIPLINE:
- GEAR COLORS are the primary identity anchor. Every named color carries through exactly.
- POSE is the secondary anchor. Every limb angle, grip, lean preserved from source.
- Age, skin tone, hair color preserved as paint base.
- Face reads as competent painted miniature — clean features, expression preserved.

MATERIAL LANGUAGE (RESIN, NOT TOY):
- Matte-to-satin painted resin on skin
- Hair sculpted, painted with correct color
- Eyes: glossy resin with small catchlights
- Clothing: simplified sculpted forms with painted color
- Premium miniature quality`
}

// ── POSE BLOCK (SAME AS IN-SITU) ───────────────────────────────
function buildPoseBlock(actionDescription: string, freezeMomentQuality?: string): string {
  return `POSE — DYNAMIC ACTION (PRIMARY IDENTITY ANCHOR ALONGSIDE GEAR):

${actionDescription || 'The hero is captured in a dynamic action pose from the source photograph.'}
${freezeMomentQuality ? `FREEZE INSTANT: ${freezeMomentQuality}` : ''}

POSE REINFORCEMENT:
- Pose reads clearly from silhouette
- Every limb angle, rotation, grip preserved from source
- Gear positioned exactly as source
- Balance: figure stable, supported by sculpted effects
- POSE + GEAR = identity`
}

// ── SECONDARY FIGURES (SAME AS IN-SITU) ────────────────────────
function buildSecondaryBlock(sec?: ActionMiniSecondaryFigures): string {
  if (!sec || !sec.count || sec.count === 0) return ''
  return `SECONDARY FIGURES — DISTRIBUTED ACROSS THE PLATE:

There ${sec.count === 1 ? 'is' : 'are'} ${sec.count} additional painted resin figure${sec.count === 1 ? '' : 's'} in the sculpt:
${sec.description || ''}

PLACEMENT:
- Spread across different zones of the plate — horizontal distribution
- Each in own sculpted element
- Same miniature scale as hero, same material language
- Softer detail, reduced contrast
- Contained within the plinth boundary`
}

// ── CORE + HIERARCHY BLOCK — DESK PRESENTATION ────────────────
const CORE_HIERARCHY_BLOCK = `CORE:
This is a museum-quality resin collectible action diorama — a painted sculpt on a wide oval walnut display plate, presented as a precious displayable object on a polished walnut desk in a curator's study. The diorama dominates the composition: it is the subject. The desk and room behind it are quiet supporting context — present, but subordinate.

OBJECT SHAPE:
- Walnut plinth: WIDE OVAL PLATE — landscape-oriented, substantial, wider than tall
- Sculpted scene on top: sprawls horizontally with vertical kinetic energy rising

SCALE HIERARCHY:

Within the sculpted object:
- FIGURE: 25-32% of object height — embedded in the kinetic scene
- SCULPTED SCENE + KINETIC INTENSITY: dominates the object with horizontal sprawl, vertical energy, and messy secondary debris

Within the frame — DIORAMA-DOMINANT:
The diorama occupies between FORTY AND SIXTY PERCENT of the frame width. It is the clear subject. The desk surface extends in the foreground, the room recedes behind. Sparser action scenes can size up; denser scenes can size down.

The diorama sits in the LOWER-MIDDLE of the frame on the desk surface. Some desk in front of and to the sides; room behind extending up.

OBJECT BOUNDARY:
All sculpted scene elements terminate at the plinth rim. Nothing — no kinetic effects, no spray, no particles — extends onto the desk surface.`

// ── DESK PRESENTATION BLOCK ────────────────────────────────────
const DESK_PRESENTATION_BLOCK = `PRESENTATION — POLISHED WALNUT DESK IN A CURATOR'S STUDY:

THE DESK:
The diorama sits on the surface of a polished dark walnut desk — figured grain visible under the lighting, satin finish with subtle reflection, the kind of desk in a private study or museum office. The desk surface extends visibly in the foreground (in front of the diorama) and to the sides. The desk is large — the diorama sits on it as one careful object on a working surface, not crowded by other items.

THE ROOM BEHIND:
The room behind the diorama is a curator's study or private library — softly out of focus. The viewer can perceive shapes: bookshelves, a wall, perhaps the edge of a framed object, an old chair, a lamp. Specific details are blurred and recede. The room provides DEPTH and CONTEXT, not COMPETITION. The viewer's eye stays on the diorama.

WHAT MAY BE ON THE DESK NEAR THE DIORAMA (PARTIALLY VISIBLE, SUBORDINATE):
A few small contextual props may sit on the desk near the diorama — a brass desk lamp glowing softly off to one side, an open hardcover book or two with their pages visible, a pair of reading glasses, perhaps an antique brass tool. These items are partial, secondary, and tonally quiet. They reinforce the curator's-study feeling without crowding the diorama. None of them touch or overlap the plinth.

WHAT THE PRESENTATION IS NOT:
- NOT outdoors
- NOT in the action's native environment (no whitewater splash zone, no surf horizon, no skatepark, no wrestling room — those belong to In-Situ presentation)
- NOT pure white-cyclorama studio (this is warmer, more curatorial)
- NOT cluttered (the desk is clean and intentional)
- NOT a snowglobe or vitrine (the diorama sits exposed on the desk)

THE ATMOSPHERE:
The room has a quiet warmth — the feeling of a private study where serious things are appreciated. The diorama is the prized object on the desk. It has been placed there with intention.`

// ── CAMERA BLOCK ────────────────────────────────────────────────
const CAMERA_BLOCK = `CAMERA — STUDIO PRODUCT PHOTOGRAPHY, ELEVATED:

Camera positioned at desk-product height — approximately 25-40 degrees above horizontal, looking down at the diorama from the front. Pulled back enough to show the diorama dominating the frame with the desk surface and room visible around and behind it.

FOCUS HIERARCHY:
- Diorama front: RAZOR SHARP — every painted detail crisp
- Diorama back: VERY SLIGHT soft focus — natural macro DOF
- Desk surface in foreground: in focus near the diorama, softening as it recedes
- Room behind: SOFTLY BLURRED — bookshelves and props read as shapes, not specifics

The lens character is medium-format macro-equivalent — rich tonal depth, shallow but elegant DOF, the diorama feels like a precious object the photographer has taken time to capture properly.`

// ── COMPOSITION BLOCK ───────────────────────────────────────────
const COMPOSITION_BLOCK = `COMPOSITION AND FRAMING:

OBJECT POSITION:
- Diorama: occupies 40-60% of the frame width, in the lower-middle of the frame, sitting on the visible desk surface
- Desk surface: visible in the foreground (below the diorama) and slightly to the sides — provides grounding context
- Room behind: fills the upper portion of the frame in soft blur, providing depth

LAYERS FROM NEAR TO FAR:
1. Desk surface foreground (sharp, visible wood grain)
2. Diorama front (razor sharp — figure, kinetic effects)
3. Diorama back edge (very slight soft focus)
4. Desk surface behind diorama (slight soft focus)
5. Room props near desk (soft focus — lamp, book, partial details)
6. Room background (softest — blurred shapes, atmospheric)

DO NOT:
- Make the action illegibly small — the kinetic moment must read clearly
- Surround the diorama with the action's outdoor environment (that's In-Situ)
- Crowd the desk with too many objects
- Flatten the depth — the room must recede
- Crop the plate at any edge
- Let sculpt bleed past the plate rim onto the desk`

// ── MATERIAL FRAME ──────────────────────────────────────────────
const MATERIAL_FRAME = `PHOTOGRAPHIC STYLE — STUDIO PRODUCT PHOTOGRAPHY:

LIGHTING:
Per the mood block above. The lighting is intentional, controlled, and considered — like a photographer who set up the shot with care, not a snapshot.

PAINT AND MATERIAL READ:
Diorama: matte-to-satin painted resin. Brushwork visible at close inspection. Layered paint highlights catch the directional key light.
Plinth: polished dark walnut, satin finish, figured grain visible.
Desk: polished dark walnut, satin finish, the same wood family as the plinth — they belong together.
Room props: real-world materials in soft focus — leather book bindings, brass lamp, paper pages.

WHERE LIGHT HITS:
The painted resin diorama catches specular highlights from the key light. The plinth rim has rim-light. The desk surface picks up the warm tonal shift from the key. The room behind sits in slightly cooler ambient.

LENS:
Medium-format macro equivalent. Diorama front razor sharp, back edge with very slight natural DOF softening. Background blurs progressively.

COLOR:
Refined product-photography grading — clean blacks, considered midtones, restrained highlights, warm overall but not orange.

QUALITY:
This is the kind of photograph a luxury collectibles brand would commission — tactile, considered, and quietly confident. The diorama feels precious, present, and worth owning.`

// ── MAIN BUILDER ────────────────────────────────────────────────
export function buildMuseumPrompt(input: ActionMiniMuseumInput): string {
  const mood      = MOODS[input.mood] || MOODS.golden
  const effects   = MEDIUM_EFFECTS[input.kineticMedium] || MEDIUM_EFFECTS.other
  const identity  = buildIdentityLock(input.hero)
  const pose      = buildPoseBlock(input.actionDescription, input.freezeMomentQuality)
  const secondary = buildSecondaryBlock(input.secondaryFigures)

  const featuresBlock = input.distinctiveFeatures
    ? `DISTINCTIVE FEATURES — PAINT THESE INTO THE SCULPT:
${input.distinctiveFeatures}

Every named color and feature from the source carries through.`
    : ''

  const notesBlock = input.notes
    ? `NOTES FROM THE PERSON:\n${input.notes}`
    : ''

  return [
    'Transform the provided image into a museum-quality resin collectible action diorama on a wide oval walnut display plate, photographed as a precious object on a polished walnut desk in a curator\'s study. The diorama dominates the frame; the room recedes into soft focus behind. Studio product photography, intentional lighting, considered composition.',
    CORE_HIERARCHY_BLOCK,
    identity,
    pose,
    KINETIC_INTENSITY_BLOCK,
    effects,
    secondary,
    featuresBlock,
    DESK_PRESENTATION_BLOCK,
    COMPOSITION_BLOCK,
    CAMERA_BLOCK,
    mood,
    MATERIAL_FRAME,
    notesBlock,
  ].filter(Boolean).join('\n\n')
}
