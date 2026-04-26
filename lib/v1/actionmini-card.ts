// actionmini-card.ts
// lib/v1/actionmini-card.ts
//
// Premium Collector Card preset — diorama presented as the centerpiece "art"
// of a high-end collector card (think Pokemon ultra-rare, sports rookie card
// art series, premium gaming cards).
//
// Composition: rectangular framed card, vertical orientation, minimal foil-edge
// border, large diorama art zone in the center, stylized environmental
// backdrop behind the diorama (softer/more graphic than In-Situ's editorial
// surround), blank name plate at bottom.
//
// Text on card: NOT rendered into image. UI caption handles it.
//
// Pipeline: same as In-Situ — generate → applyLevels → expandScene.

export interface ActionMiniCardHero {
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

export interface ActionMiniCardSecondaryFigures {
  count?:        number
  description?:  string
}

export interface ActionMiniCardInput {
  kineticMedium:         string
  actionDescription:     string
  freezeMomentQuality?:  string
  hero:                  ActionMiniCardHero | null
  secondaryFigures?:     ActionMiniCardSecondaryFigures
  environment:           string
  distinctiveFeatures?:  string
  sourceLighting?:       string
  displayName?:          string
  mood:                  string
  plaqueText?:           string
  notes?:                string
}

// ── MOOD — TUNED FOR CARD AESTHETIC ────────────────────────────
// Card mood is more graphic and less editorial than In-Situ. Lighting
// supports the diorama as art, not as found object.
const MOODS: Record<string, string> = {
  golden: `MOOD: Warm golden card aesthetic — honey light raking the diorama from upper-left, rich amber tones in the backdrop, warm cinematic glow throughout. Premium collector card energy — like a foil-stamped rare card under display lighting.

LIGHTING:
Strong directional key from upper-left at 30-40°. Warm amber rim-light separates diorama from backdrop. Subtle internal glow on translucent effects (water, spray). Specular highlights on glossy resin surfaces.`,

  dramatic: `MOOD: Dramatic card aesthetic — deep moody backdrop, theatrical key light striking the diorama, high contrast, premium foil-edge collector card feel. Like a holographic rare against a black-velvet display.

LIGHTING:
Strong dramatic key light spotlighting the diorama from upper angle. Deep shadow falloff. Cool atmospheric backdrop with warm focused subject. Strong rim separation.`,

  peaceful: `MOOD: Peaceful card aesthetic — soft diffused light, low contrast, contemplative collector card feel. Like a watercolor-art-series card.

LIGHTING:
Soft diffused key from upper portion. Low contrast. Even illumination across diorama. Atmospheric soft backdrop with gentle glow.`,

  vivid: `MOOD: Bright vivid card aesthetic — saturated color, clean directional light, high-energy collector card feel. Like a peak-tier sports card under bright store lighting.

LIGHTING:
Clean bright directional key. Saturated colors. Crisp shadows on diorama with clean fill. Bright clean backdrop.`,
}

// ── KINETIC INTENSITY (SAME AS IN-SITU — TRANSFERABLE) ─────────
const KINETIC_INTENSITY_BLOCK = `KINETIC INTENSITY (CRITICAL — APPLIES TO ALL EFFECTS):

The kinetic action is INTENSE and MESSY. The sculpt should show three universal layers of kinetic detail beyond the main effect mass:

1. SURFACE TRAIL — visible marks on the sculpted base behind the figure showing where the action came from: tire ruts, ski tracks, foam wake, scuff marks, footprint trails.

2. PARTICULATE SCATTER — fine secondary debris in a HALO around the main kinetic point — droplets, dust motes, dirt chunks, snow crystals, chalk specks, sparks.

3. IMPACT ZONES — visible physics evidence where the action hits the terrain — splash zones, gouge marks, divots, churn patches, displacement craters.

These three layers turn a clean kinetic snapshot into a chaotic intense moment.`

// ── EFFECTS BY MEDIUM (CARRIED FROM IN-SITU) ───────────────────
const MEDIUM_EFFECTS: Record<string, string> = {
  whitewater: `EFFECTS — WHITEWATER KINETIC SCENE:

Sculpted water across the plate top with vertical kinetic energy — foam, wave forms, rocks, spray rising off paddle and bow contact points.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Foam wake behind the kayak across the plate
- SCATTER: Droplets and water specks in a halo around the kayak and paddle
- IMPACT: Deep churn at bow contact, gouge in wave face, displaced water around cockpit

Hero kayaker is 20-25% of object height. Containment at plinth rim.`,

  surf: `EFFECTS — WAVE KINETIC SCENE:

Sculpted wave across plinth with breaking crest, curling face, spray rising, foam trailing.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Foam wake behind the board's path
- SCATTER: Droplets and spray specks halo around board and figure
- IMPACT: Aerated foam at rail engagement, gouge in wave face, rooster-tail behind

Surfer is 20-25% of object height. Containment at plinth rim.`,

  snow: `EFFECTS — SNOW KINETIC SCENE:

Powder plume rising, spray arcing, carving lines across plinth.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Sculpted ski/board tracks behind the rider
- SCATTER: Snow crystals halo around the rider
- IMPACT: Gouged carving lines, displaced snow chunks at edges

Rider is 20-25% of object height. Containment at plinth rim.`,

  skate: `EFFECTS — SKATE KINETIC SCENE:

Dust plume rising, sparks arcing across sculpted ramp/street section.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Wheel marks and scuff trails
- SCATTER: Dust motes, concrete chips, sparks halo
- IMPACT: Scuff scoring, dust at wheel contact, debris fragments

Skater is 20-25% of object height. Containment at plinth rim.`,

  bike: `EFFECTS — BIKE KINETIC SCENE:

Sculpted trail with dust plume rising, dirt chunks arcing across plinth.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Deep tire ruts behind the bike
- SCATTER: Dirt chunks, pebbles, dust motes halo around rear tire
- IMPACT: Displacement crater at tire contact, churned dirt with torn edges

Rider is 20-25% of object height. Containment at plinth rim.`,

  climb: `EFFECTS — ROCK KINETIC SCENE:

Sculpted rock face with chalk puffs at engagement points, multiple features across plinth.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Chalk smudges on previous holds
- SCATTER: Chalk dust specks halo around hands
- IMPACT: Deeper chalk patches at grip zones, rock dust at smears

Climber is 20-25% of object height. Containment at plinth rim.`,

  run: `EFFECTS — TRAIL KINETIC SCENE:

Sculpted trail with dust rising, terrain variation across plinth.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Footprints and stride marks behind the runner
- SCATTER: Dirt specks, pebbles, dust motes halo around heels
- IMPACT: Heel-strike divots, displaced dirt at toe-off

Runner is 20-25% of object height. Containment at plinth rim.`,

  dance: `EFFECTS — STAGE KINETIC SCENE:

Sculpted stage with fabric and hair arcing up.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Scuff arcs and shoe marks behind dancer
- SCATTER: Glitter, fabric particles, atmospheric motes halo
- IMPACT: Sheen and pressure marks at planted foot

Dancer is 20-25% of object height. Containment at plinth rim.`,

  other: `EFFECTS — KINETIC SCENE:

Whatever kinetic elements sprawl horizontally with vertical energy preserved.

KINETIC INTENSITY APPLICATIONS:
- TRAIL: Marks the action would naturally leave behind
- SCATTER: Secondary particles halo around kinetic point
- IMPACT: Visible physics evidence on terrain

Figure is 20-25% of object height. Containment at plinth rim.`,
}

// ── IDENTITY LOCK — SAME AS IN-SITU, GESTALT-LEVEL ─────────────
function buildIdentityLock(hero: ActionMiniCardHero | null): string {
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

${lines.join('\n\n')}

IDENTITY DISCIPLINE:
- GEAR COLORS are the primary identity anchor
- POSE is the secondary anchor — preserved exactly from source
- Age, skin tone, hair color preserved as paint base
- Face reads as competent painted miniature

MATERIAL LANGUAGE (RESIN, NOT TOY):
- Matte-to-satin painted resin on skin
- Eyes glossy with small catchlights
- Premium miniature quality, not plastic toy`
}

function buildPoseBlock(actionDescription: string, freezeMomentQuality?: string): string {
  return `POSE — DYNAMIC ACTION:

${actionDescription || 'The hero is captured in a dynamic action pose from the source photograph.'}
${freezeMomentQuality ? `FREEZE INSTANT: ${freezeMomentQuality}` : ''}

POSE REINFORCEMENT:
- Pose reads clearly from silhouette
- Every limb angle, rotation, grip preserved from source
- Gear positioned exactly as source
- Balance: figure stable, supported by sculpted effects`
}

function buildSecondaryBlock(sec?: ActionMiniCardSecondaryFigures): string {
  if (!sec || !sec.count || sec.count === 0) return ''
  return `SECONDARY FIGURES — DISTRIBUTED ACROSS THE PLATE:

There ${sec.count === 1 ? 'is' : 'are'} ${sec.count} additional painted resin figure${sec.count === 1 ? '' : 's'}:
${sec.description || ''}

Same miniature scale, lower visual prominence, contained within plinth boundary.`
}

// ── CARD CORE BLOCK ────────────────────────────────────────────
const CARD_CORE_BLOCK = `CORE — PREMIUM COLLECTOR CARD AESTHETIC:

This is a museum-quality painted resin action diorama presented as the CENTERPIECE ART of a premium collector card. Think Pokemon ultra-rare, sports rookie card art series, gaming card master tier — the diorama IS the artwork inside an elegant minimal frame.

OVERALL COMPOSITION:
The image is rendered AS A COLLECTOR CARD — vertical/portrait-oriented rectangular frame fills most of the image. The card itself is the product. Inside the card frame:
- The diorama is the hero subject in the upper 65-70% of the card area
- A clean blank name plate area in the lower 15-20% of the card area (intentionally blank — text added separately)
- Background behind the diorama is stylized contextual environment, softer than editorial photography

CARD FRAME:
- Minimal premium frame around the entire card edge — ~3-4% of image width
- Frame style: brushed metal or subtle dark border with FOIL-EDGE accent (a thin metallic line just inside the outer frame edge)
- Frame is elegant and understated — NOT ornate, NOT gilded heavily, NOT vintage
- Premium modern collector aesthetic — the kind of frame on a Pokemon ultra-rare or a Topps Chrome rookie

BACKGROUND BEHIND THE DIORAMA:
- Stylized contextual environment — recognizable as the action setting (forest for whitewater, ocean for surf, mountain for snow, etc.) but rendered with a more graphic, atmospheric, painterly quality than In-Situ's editorial photography
- Soft gradient or atmospheric haze
- Subtle radiating glow or halo effect emanating from behind the diorama — like the card is highlighting the action
- NOT a literal forest photograph — a STYLIZED environmental backdrop befitting a premium collector card

NAME PLATE AREA:
- Lower 15-20% of card area — clean horizontal band, slightly inset from card edges
- Brushed metal or dark glossy surface
- INTENTIONALLY BLANK — no engraved text, no decorative letters, no specific characters
- May have a subtle separator line or minimal flourish but no text content
- Text will be added separately in post-processing or as UI caption`

const CARD_DIORAMA_BLOCK = `THE DIORAMA WITHIN THE CARD:

OBJECT SHAPE:
- Walnut plinth: WIDE OVAL PLATE — landscape-oriented, substantial, wider than tall
- Sculpted scene on top: sprawls horizontally with vertical kinetic energy

SIZING WITHIN THE CARD:
The diorama is sized to be the clear centerpiece art of the card. It occupies approximately 60-70% of the card's INNER ART AREA (the zone above the name plate, inside the frame). The action is legible and impactful — this is the card's hero artwork.

WITHIN THE SCULPTED OBJECT:
- FIGURE: 20-25% of object height, embedded in the kinetic scene
- SCULPTED SCENE + KINETIC INTENSITY: dominates the object, sprawling horizontally with vertical energy
- All effects contained within plinth rim

POSITIONING:
- Diorama in the center-to-upper-center of the card art zone
- Slight downward bias so the name plate has clean separation below
- Backlit slightly by the radiating glow behind it`

const CARD_CAMERA_BLOCK = `CAMERA — CARD ART PRESENTATION:

The shot frames the diorama as it would appear ON a collector card. Slightly elevated angle (20-30°), looking at the diorama from a hero perspective. Pulled back enough that the diorama sits comfortably within the card art area with substantial backdrop visible behind it.

The camera is presenting THE CARD — meaning the rectangular card frame is the outer boundary of the image, and the diorama is centered within that frame as the card's artwork.

FOCUS:
- Diorama: razor sharp throughout
- Backdrop: softer, more atmospheric, slightly out of focus to keep diorama as the focal point
- Card frame: sharp and present at the outer edges`

const CARD_COMPOSITION_BLOCK = `COMPOSITION:

LAYERS:
1. Card frame at outer edges (sharp, present)
2. Diorama (sharp, centerpiece, ~60-70% of inner art zone)
3. Stylized environmental backdrop behind diorama (softer focus, atmospheric)
4. Subtle glow halo behind diorama (radiating outward)
5. Blank name plate at lower 15-20% of card area

RATIO TARGETS:
- Card frame: surrounds the entire image edge, ~3-4% of image width
- Inner art zone: ~92-94% of card interior
- Diorama within art zone: ~60-70% of art zone
- Name plate area: lower 15-20% of card interior

DO NOT:
- Render specific text on the name plate (it must be BLANK)
- Make the frame ornate, gilded, or vintage
- Use a literal photographic environment behind the diorama (use stylized graphic backdrop)
- Crop the card frame at any edge
- Skip the kinetic intensity layers
- Make the figure dominate the sculpted object`

const CARD_MATERIAL_FRAME = `PHOTOGRAPHIC STYLE — PREMIUM COLLECTOR CARD AESTHETIC:

OVERALL FEEL:
The image reads as a high-end collector card photograph — like product photography of a premium foil card. Clean, graphic, slightly stylized, premium quality.

CARD FRAME MATERIAL:
Brushed metal or dark glossy edge with thin foil-line accent. Modern collector aesthetic. Subtle premium without being flashy.

DIORAMA MATERIAL READ:
Matte-to-satin painted resin (same as In-Situ). Brushwork, layered highlights, glossy eyes with catchlights, premium miniature quality.

BACKDROP STYLE:
Stylized environmental haze — atmospheric, painterly, recognizable as the action's setting but rendered as a graphic backdrop rather than a literal photograph. Soft gradients, subtle color, premium illustrative quality.

GLOW HALO:
Subtle radiating glow behind the diorama — like the card is highlighting the action. Soft warm light fading outward into the backdrop. Not a hard ring — a smooth atmospheric emanation.

WHERE LIGHT HITS THE DIORAMA:
Spray droplets and particulate scatter glow luminous. Plinth walnut rim catches rim-light. Wet sculpted surfaces gleam with specular highlights.

COLOR:
Premium graded — saturated but not garish. Mood-keyed (warm/cool/dramatic/clean depending on selected mood).

QUALITY:
Premium collector card art — the kind of image that belongs on the front of a foil-stamped rare card.`

// ── MAIN BUILDER ────────────────────────────────────────────────
export function buildCardPrompt(input: ActionMiniCardInput): string {
  const mood      = MOODS[input.mood] || MOODS.golden
  const effects   = MEDIUM_EFFECTS[input.kineticMedium] || MEDIUM_EFFECTS.other
  const identity  = buildIdentityLock(input.hero)
  const pose      = buildPoseBlock(input.actionDescription, input.freezeMomentQuality)
  const secondary = buildSecondaryBlock(input.secondaryFigures)

  const featuresBlock = input.distinctiveFeatures
    ? `DISTINCTIVE FEATURES — PAINT INTO SCULPT:
${input.distinctiveFeatures}`
    : ''

  const notesBlock = input.notes
    ? `NOTES FROM THE PERSON:\n${input.notes}`
    : ''

  return [
    'Transform the provided image into a PREMIUM COLLECTOR CARD featuring a museum-quality resin action diorama as its centerpiece artwork. The output should look like a high-end collector card photograph — minimal foil-edged frame, stylized atmospheric backdrop, blank name plate at the bottom, intense kinetic detail in the sculpted diorama.',
    CARD_CORE_BLOCK,
    identity,
    pose,
    KINETIC_INTENSITY_BLOCK,
    effects,
    secondary,
    featuresBlock,
    CARD_DIORAMA_BLOCK,
    CARD_COMPOSITION_BLOCK,
    CARD_CAMERA_BLOCK,
    mood,
    CARD_MATERIAL_FRAME,
    notesBlock,
  ].filter(Boolean).join('\n\n')
}
