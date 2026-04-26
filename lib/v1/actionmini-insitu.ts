// actionmini-insitu.ts
// lib/v1/actionmini-insitu.ts
//
// THE Action Minis preset (v11 — adaptive sizing).
//
// Change from v10: replaced rigid percentage targets with intent-based range.
// Diorama now sized for KINETIC IMPACT — between one-third and one-half of
// frame width, letting the model find the right scale for content density.
// Sparse scenes (single bike, single climber) can size up. Dense scenes
// (whitewater chaos with secondaries) can size down. Same prompt, same blocks,
// adaptive composition.

export interface ActionMiniHero {
  position_in_frame?:    string
  age_range?:            string
  gender_presentation?:  string
  ethnicity_apparent?:   string
  skin_tone?:            string
  hair?: {
    color?:             string
    length?:            string
    style?:             string
    distinct_features?: string
  }
  face?: {
    shape?:             string
    notable_features?:  string
  }
  glasses?:              boolean
  glasses_description?:  string | null
  facial_hair?:          string
  expression?:           string
  gear_top?:             string
  gear_head?:            string
  gear_hands?:           string
  body_position?:        string
  distinct_identifiers?: string
}

export interface ActionMiniSecondaryFigures {
  count?:        number
  description?:  string
}

export interface ActionMiniInSituInput {
  kineticMedium:         string
  actionDescription:     string
  freezeMomentQuality?:  string
  hero:                  ActionMiniHero | null
  secondaryFigures?:     ActionMiniSecondaryFigures
  environment:           string
  distinctiveFeatures?:  string
  sourceLighting?:       string
  displayName?:          string
  mood:                  string
  plaqueText?:           string
  notes?:                string
}

// ── MOOD + VOLUMETRIC LIGHTING ─────────────────────────────────
const MOODS: Record<string, string> = {
  golden: `MOOD: Warm golden light — late afternoon sun raking through the expansive environment, honey highlights on the resin, long warm shadows, nostalgic atmosphere.

VOLUMETRIC LIGHTING:
A substantial visible sunbeam / god-ray streams through the environment from upper portion of frame — a dominant shaft of warm golden light cutting through atmospheric depth above and around the diorama. Physically visible in the air over significant frame area. Should be one of the dominant features of the shot.
Where the beam intersects sculpted spray or particulate, it LIGHTS UP — backlit droplets and motes glow golden.
Atmospheric haze throughout mid and far environment. Dust motes drifting in the beam.`,

  dramatic: `MOOD: Dramatic — charged weather, intense directional light, emotionally weighted atmosphere.

VOLUMETRIC LIGHTING:
A single dramatic shaft of light breaks through heavy cloud or dark canopy and lands on the diorama — a theatrical spotlight cutting through expansive atmospheric haze. Beam physically visible over substantial frame area.
Where the beam meets sculpted spray or particulate, droplets and motes spark with backlit intensity.
Moody atmospheric haze throughout — heavy, charged, weather-bearing.`,

  peaceful: `MOOD: Peaceful — quiet light, low contrast, contemplative.

VOLUMETRIC LIGHTING:
Soft diffused morning light fills the scene with gentle atmospheric depth. A single soft shaft filters through mist. Humid, misty, quiet. Mist veils the mid and far environment with dreamy atmospheric layering.
Spray and particulate catch soft light without harsh speculars.`,

  vivid: `MOOD: Bright and vivid — peak midday clarity, saturated color, the action at its most alive.

VOLUMETRIC LIGHTING:
A clean bright sunbeam cuts through light haze with substantial volumetric presence. Environment has bright clean depth.
Where sunlight hits sculpted spray or particulate, droplets and motes gleam sharp and bright.`,
}

// ── KINETIC INTENSITY BLOCK (SHARED ACROSS ALL MEDIUMS) ────────
const KINETIC_INTENSITY_BLOCK = `KINETIC INTENSITY (CRITICAL — APPLIES TO ALL EFFECTS):

The kinetic action is INTENSE and MESSY. The sculpt should show three universal layers of kinetic detail beyond the main effect mass:

1. SURFACE TRAIL — the action has been MOVING through the scene, not just frozen at one point. Visible marks on the sculpted base behind the figure showing where the action came FROM: tire ruts, ski tracks, foam wake, scuff marks, footprint trails, displacement furrows. The trail extends across a significant portion of the plate top behind the figure.

2. PARTICULATE SCATTER — fine secondary debris in a HALO around the main kinetic point. Not just one spray plume — also dozens of smaller particles, droplets, dust motes, dirt chunks, snow crystals, chalk specks, sparks scattered through the air around and behind the figure. These secondary particles read as kinetic chaos, atmospheric texture, real physics.

3. IMPACT ZONES — places on the sculpt where the kinetic action is hitting the terrain HARDER. Splash zones with deep churn, gouge marks where wheels dig in, divots from heel strikes, churn patches where spray hits surface, displacement craters. The terrain shows real evidence of being acted upon.

These three layers turn a clean kinetic snapshot into a chaotic intense moment. The effect should read MESSIER and more dynamic than a tidy diorama — like the action is genuinely happening, not posed.`

// ── EFFECTS BY MEDIUM — WITH TRAIL/SCATTER/IMPACT APPLIED ─────
const MEDIUM_EFFECTS: Record<string, string> = {
  whitewater: `EFFECTS — WHITEWATER KINETIC SCENE ON THE PLATE:

Sculpted water is a horizontal mass across the plate top with vertical kinetic energy — multiple foam patches, wave forms, sculpted rocks, spray rising off kinetic contact points.

KINETIC VERTICALITY (PRESERVE PROPORTIONALLY):
- Sculpted spray rises vertically from paddle and bow impact points
- Foam crests rise from turbulence zones
- Wave forms wrap around rocks with real volume

HORIZONTAL SPRAWL:
- Foam and whitewater extend across the full width of the plinth top
- Multiple sculpted rock outcroppings rise from water at different points
- Secondary kayakers in different zones of the plate
- Translucent green-blue resin in calmer pockets, opaque foam on turbulence

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Foam wake and disturbed water trail behind the kayak — the boat has been carving through the rapid, leaving a churned wake extending back across the plate
- SCATTER: Dozens of individual sculpted droplets and water specks in a HALO around the kayak and paddle
- IMPACT: Deep churn and white aerated foam where the bow plows into the wave, gouge-pattern in the wave face, displaced water around the cockpit

HERO POSITIONING:
Hero kayaker embedded in one zone of the plate. Figure is 20-25% of object height.

Containment at plinth rim.`,

  surf: `EFFECTS — WAVE KINETIC SCENE ON THE PLATE:

Sculpted wave as horizontal mass with vertical kinetic energy — breaking crest, curling face, spray rising, foam trailing.

KINETIC VERTICALITY: Wave face rises vertically. Spray arcs up from board edges and wave lip.
HORIZONTAL SPRAWL: Wave extends across plinth width. Flat water, foam patches, secondary surfers distributed.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Foam wake behind the board's path through the wave face — visible cut line and trailing whitewater
- SCATTER: Dozens of individual sculpted droplets and spray specks in a HALO around the board and figure
- IMPACT: Deep aerated foam where the rail engages the wave, gouge in the wave face, rooster-tail behind

Surfer is 20-25% of object height. Containment at plinth rim.`,

  snow: `EFFECTS — SNOW KINETIC SCENE ON THE PLATE:

Sculpted snow scene with vertical kinetic energy — powder plume rising, spray arcing, carving lines.

KINETIC VERTICALITY: Powder plume rises vertically. Snow spray arcs up.
HORIZONTAL SPRAWL: Slope contour across plate. Carving lines, rock shadows, secondary riders distributed.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Sculpted ski/board tracks carved into the snow behind the rider — clear deep trails extending across the plate
- SCATTER: Dozens of individual sculpted snow crystals and ice particles in a HALO around the rider
- IMPACT: Deep gouged carving lines under the board/skis, displaced snow chunks at edge engagement, churned snow at impact

Rider is 20-25% of object height. Containment at plinth rim.`,

  skate: `EFFECTS — SKATE KINETIC SCENE ON THE PLATE:

Sculpted scene with vertical kinetic energy — dust plume rising, sparks arcing.

KINETIC VERTICALITY: Dust rises vertically. Sparks arc upward if grinding.
HORIZONTAL SPRAWL: Ramp/street section across plate. Coping, graffiti, debris distributed.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Wheel marks and scuff trails on the sculpted concrete behind the skater
- SCATTER: Dozens of individual sculpted dust motes, concrete chips, and sparks in a HALO around the wheels and trucks
- IMPACT: Scuff scoring on coping or rail, dust kicked up at wheel contact, debris fragments at hard contact zones

Skater is 20-25% of object height. Containment at plinth rim.`,

  bike: `EFFECTS — BIKE KINETIC SCENE ON THE PLATE:

Sculpted trail with vertical kinetic energy — dust plume rising.

KINETIC VERTICALITY: Dust rises vertically. Dirt chunks arc upward.
HORIZONTAL SPRAWL: Trail across plate. Rocks, roots, features distributed.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Deep tire ruts carved into the sculpted dirt behind the bike — clear gouged lines showing where the bike has come from, edges torn and irregular
- SCATTER: Dozens of individual sculpted dirt chunks, pebbles, and dust motes in a HALO around the rear tire — secondary debris caught in flight beyond the main dust plume
- IMPACT: Deep displacement crater at rear tire contact, churned dirt with torn edges, rocks kicked at edge of wheel engagement

Rider is 20-25% of object height. Containment at plinth rim.`,

  climb: `EFFECTS — ROCK KINETIC SCENE ON THE PLATE:

Sculpted rock face with vertical kinetic energy — rock rising, climber engaged.

KINETIC VERTICALITY: Rock rises vertically. Chalk puffs at engagement points.
HORIZONTAL SPRAWL: Rock extends across plate with multiple features.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Chalk smudges on holds the climber has previously gripped — a visible chalk-marked path up the rock face
- SCATTER: Dozens of individual sculpted chalk dust specks in a HALO around the climber's hands and chalk bag
- IMPACT: Deeper chalk patches at current grip zones, rock dust at foot smears, micro-debris at high-stress contact points

Climber is 20-25% of object height. Containment at plinth rim.`,

  run: `EFFECTS — TRAIL KINETIC SCENE ON THE PLATE:

Sculpted trail with vertical kinetic energy — dust rising.

KINETIC VERTICALITY: Dust rises vertically.
HORIZONTAL SPRAWL: Trail across plate. Ground variation distributed.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Sculpted footprints and stride marks behind the runner extending across the plate
- SCATTER: Dozens of individual sculpted dirt specks, pebbles, and dust motes in a HALO around the heels
- IMPACT: Deep heel-strike divots at footplant points, displaced dirt at toe-off, debris kicked rearward at push-off

Runner is 20-25% of object height. Containment at plinth rim.`,

  dance: `EFFECTS — STAGE KINETIC SCENE ON THE PLATE:

Sculpted stage with vertical kinetic energy — fabric and hair arcing up.

KINETIC VERTICALITY: Fabric and hair rise vertically.
HORIZONTAL SPRAWL: Stage surface across plate.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Sculpted scuff arcs and shoe marks on the stage surface behind the dancer
- SCATTER: Dozens of individual sculpted glitter specks, fabric particles, or atmospheric motes in a HALO around the figure
- IMPACT: Concentrated sheen and pressure marks at planted foot, displaced atmospheric haze around explosive movements

Dancer is 20-25% of object height. Containment at plinth rim.`,

  other: `EFFECTS — KINETIC SCENE ON THE PLATE:

Whatever kinetic elements sprawl horizontally with vertical kinetic energy preserved.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Whatever marks the action would naturally leave on the sculpted base behind the figure
- SCATTER: Dozens of individual sculpted secondary particles in a halo around the kinetic point
- IMPACT: Visible physics evidence where the action displaces or affects the sculpted terrain

Figure is 20-25% of object height. Containment at plinth rim.`,
}

// ── IDENTITY LOCK ──────────────────────────────────────────────
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

// ── POSE BLOCK ──────────────────────────────────────────────────
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

// ── SECONDARY FIGURES ──────────────────────────────────────────
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

// ── CORE + HIERARCHY BLOCK — ADAPTIVE SIZING LANGUAGE ──────────
const CORE_HIERARCHY_BLOCK = `CORE:
This is a museum-quality resin collectible action diorama — a painted sculpt on a wide oval walnut display plate, photographed in a real-world outdoor environment. The diorama is sized for KINETIC IMPACT: large enough that the action reads clearly, small enough that the environment surrounds it as a substantial atmospheric presence.

OBJECT SHAPE:
- Walnut plinth: WIDE OVAL PLATE — landscape-oriented, substantial, wider than tall
- Sculpted scene on top: sprawls horizontally with vertical kinetic energy rising

SCALE HIERARCHY:

Within the sculpted object:
- FIGURE: 20-25% of object height — embedded in the kinetic scene
- SCULPTED SCENE + KINETIC INTENSITY: dominates the object with horizontal sprawl, vertical energy, and messy secondary debris
- Kinetic verticality preserved proportionally

Within the frame — SIZED FOR KINETIC IMPACT:
The diorama is sized so the ACTION PUNCHES. The viewer can clearly read the pose, the figure's gear, the kinetic detail, the impact moment. As a guide, the diorama occupies between ONE-THIRD AND ONE-HALF of the frame width — sized so the action is legible but the environment still surrounds it as a substantial co-subject. Sparser action scenes (single figure, simple sculpt) sit toward the larger end of this range so the action reads. Denser action scenes (multiple figures, complex sculpt) sit toward the smaller end because the sculpt already carries detail.

The diorama sits in the LOWER PORTION of the frame with the environment rising tall above it. Not pinned to the lower edge, but biased downward — environment fills more of the upper frame than the lower.

OBJECT BOUNDARY:
All sculpted scene elements terminate at the plinth rim.`

// ── ENVIRONMENT BLOCK ──────────────────────────────────────────
function buildEnvBlock(environment: string): string {
  return `ENVIRONMENT — SUBSTANTIAL ATMOSPHERIC SURROUND:

${environment}

THE RELATIONSHIP:
The diorama sits on the ground in a real outdoor setting with environment rising tall ABOVE and extending wide AROUND. The environment is a substantial co-subject — atmospheric depth, tall canopy, layered ground detail.

The environment surrounds the diorama on all sides without crowding it. Trees and atmospheric depth fill significant frame area above the diorama; ground detail extends to the sides; the diorama is the focal point but not the only thing in the shot.

THE SURROUND:
Near surround: real-world material in moderate focus at REAL-WORLD scale — moss, pebbles, ferns, leaf-litter, pine needles. These dwarf the miniature by size contrast.
Mid distance: environmental features in soft focus — trunks, rocks, terrain.
Far distance and ABOVE: tall atmospheric depth — canopy, sky layers, the volumetric sunbeam filling the upper frame.

THE PLATE:
Dark walnut wood, wide oval profile, thick and substantial.

THE EDGE:
Sharp seam between sculpted resin on top and raw real-world material around the plate.`
}

// ── CAMERA BLOCK ────────────────────────────────────────────────
const CAMERA_BLOCK = `CAMERA — FOUND-OBJECT EDITORIAL, LOW ANGLE:

Camera positioned low, slightly elevated (20-35° above horizontal), pulled back enough to capture the diorama with substantial environmental surround. The diorama is sized for kinetic impact — large enough that the action is legible, with environment rising tall above it.

FOCUS HIERARCHY:
- Diorama front: RAZOR SHARP
- Diorama back: VERY SLIGHT soft focus — natural DOF feel
- Background environment: softens progressively with depth

Editorial found-object photography — the scene feels discovered.`

// ── COMPOSITION BLOCK ───────────────────────────────────────────
const COMPOSITION_BLOCK = `COMPOSITION AND FRAMING:

OBJECT POSITION:
- Diorama: sized for KINETIC IMPACT (one-third to one-half of frame width), in the lower portion of the frame with environment rising above
- Environment: substantial co-subject filling the remaining frame area, especially above the diorama

LAYERS FROM NEAR TO FAR:
1. Diorama front (razor sharp — figure, front kinetic effects)
2. Diorama back edge (very slight soft focus)
3. Near forest floor around the plinth (moderate focus)
4. Mid forest (soft focus)
5. Far atmospheric depth (canopy, sunbeam — softest)

Post-generation outpainting adds further context — render as if ~15% more border is already present.

DO NOT:
- Make the action illegibly small — the kinetic moment must read clearly
- Shrink environment to a thin border — it remains a substantial co-subject
- Make the figure dominate the sculpted object (figure is 20-25% of object)
- Reduce kinetic effects to a thin band beneath the figure
- Skip the kinetic intensity layers (trail, scatter, impact must be visible)
- Use multiple sunbeams — one substantial shaft is enough
- Crop the plate at any edge
- Let sculpt bleed past the plate rim`

// ── MATERIAL / PHOTOGRAPHY FRAME ────────────────────────────────
const MATERIAL_FRAME = `PHOTOGRAPHIC STYLE — EDITORIAL CINEMATIC SCENE:

LIGHTING:
Soft directional key consistent with the mood's volumetric beam. Painted resin on the diorama catches specular highlights where the beam touches it. Environment softens into atmospheric haze.

PAINT AND MATERIAL READ:
Diorama: matte-to-satin painted resin. Brushwork at close inspection. Layered highlights.
Forest floor: moss textures, leaf-litter, real-world organic detail.

WHERE VOLUMETRIC LIGHT HITS:
Spray droplets and particulate scatter glow luminous in the beam. Plinth walnut rim catches rim-light.

LENS:
Medium-format macro equivalent. Diorama front razor sharp, back edge with very slight natural DOF softening. Background softens with depth.

COLOR:
Film-adjacent grading — lifted blacks, warm midtones, restrained highlights.

QUALITY:
Editorial product photography for a premium commemorative collectible — cinematic, natural, intentional, and kinetically alive.`

// ── MAIN BUILDER ────────────────────────────────────────────────
export function buildInSituPrompt(input: ActionMiniInSituInput): string {
  const mood      = MOODS[input.mood] || MOODS.golden
  const effects   = MEDIUM_EFFECTS[input.kineticMedium] || MEDIUM_EFFECTS.other
  const identity  = buildIdentityLock(input.hero)
  const pose      = buildPoseBlock(input.actionDescription, input.freezeMomentQuality)
  const secondary = buildSecondaryBlock(input.secondaryFigures)
  const envBlock  = buildEnvBlock(input.environment)

  const featuresBlock = input.distinctiveFeatures
    ? `DISTINCTIVE FEATURES — PAINT THESE INTO THE SCULPT:
${input.distinctiveFeatures}

Every named color and feature from the source carries through.`
    : ''

  const notesBlock = input.notes
    ? `NOTES FROM THE PERSON:\n${input.notes}`
    : ''

  return [
    'Transform the provided image into a museum-quality resin collectible action diorama on a wide oval walnut display plate, photographed in a real-world outdoor environment with intense kinetic detail. The diorama is sized for KINETIC IMPACT — the action should read clearly while the environment surrounds it as a substantial atmospheric co-subject. A single volumetric sunbeam cuts through the atmospheric depth above.',
    CORE_HIERARCHY_BLOCK,
    identity,
    pose,
    KINETIC_INTENSITY_BLOCK,
    effects,
    secondary,
    featuresBlock,
    envBlock,
    COMPOSITION_BLOCK,
    CAMERA_BLOCK,
    mood,
    MATERIAL_FRAME,
    notesBlock,
  ].filter(Boolean).join('\n\n')
}
