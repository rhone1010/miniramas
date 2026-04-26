// actionmini-hero-figurine.ts
// lib/v1/actionmini-hero-figurine.ts
//
// HERO FIGURINE preset — rewritten against explicit user spec.
//
// HIERARCHY (NON-NEGOTIABLE):
//   1. SUBJECT occupies 75-85% of frame height — dominant visual element
//   2. ENVIRONMENT is secondary support only — never competes
//   3. EFFECTS (water, motion, impact) are sculpted resin wrapping the subject —
//      NOT a flat terrain base, NOT a miniature landscape
//
// Params (documented in prompt language):
//   SUBJECT_SCALE: 0.80        (was 0.6 — bumped per user)
//   MATERIAL: resin_collectible
//   POSE_PRIORITY: high
//   IDENTITY_FIDELITY: high
//   ENVIRONMENT: minimal_supportive
//   EFFECTS: sculpted_wrapping
//
// Pipeline: generate → expandScene (expandScene stays on — per user, outpaint still
// needed to add breathing room around the tight hero-framed output).

export interface HeroFigurineHero {
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

export interface HeroFigurineInput {
  kineticMedium:         string
  actionDescription:     string
  freezeMomentQuality?:  string
  hero:                  HeroFigurineHero | null
  distinctiveFeatures?:  string
  sourceLighting?:       string
  displayName?:          string
  mood:                  string
  plaqueText?:           string
  notes?:                string
}

// ── MOOD — studio lighting modulation only ──────────────────────
const MOODS: Record<string, string> = {
  golden:
    'MOOD LIGHTING: Warm key light with amber undertone, soft fill, gentle warm rim separating the figure from the dark backdrop. Honeyed highlights on the painted resin. Cinematic collectible-shelf warmth.',
  dramatic:
    'MOOD LIGHTING: Strong directional key from upper-left, deep shadow on the opposite side, pronounced cool rim light separating the figure from the dark backdrop. High-contrast statue presentation — theatrical and powerful.',
  peaceful:
    'MOOD LIGHTING: Soft even studio light, low contrast, cool-neutral temperature with subtle warmth on the face. Gentle product-catalog lighting.',
  vivid:
    'MOOD LIGHTING: Clean bright studio key with crisp fill and subtle rim. Saturated color on painted surfaces. The figure reads vivid and alive.',
}

// ── EFFECTS BY MEDIUM — SCULPTED RESIN WRAPPING THE SUBJECT ────
// CRITICAL REFRAME: these are not base terrain. They are sculpted motion effects
// that wrap, splash, and trail off the subject — frozen action wrapping the figure,
// integrated seamlessly into a compact base.
const MEDIUM_EFFECTS: Record<string, string> = {
  whitewater: `EFFECTS — WHITEWATER AS SCULPTED RESIN WRAPPING THE SUBJECT:
Water is NOT a flat base terrain. Water is a sculpted resin EFFECT that wraps around and trails off the kayak and the figure — frozen motion.
- A cresting wave wraps around the bow and hull of the kayak as a sculpted resin form — not flat water, but a three-dimensional curl of water rising and breaking against the boat.
- Spray fans off the paddle blade as sculpted resin arcs and individual droplets — frozen mid-flight, each one a discrete sculpted bead of clear painted resin.
- Foam trails behind the boat as a dynamic sculpted ribbon — not a patch, but a moving form with real volume and direction.
- Water splashes up along the hero's torso and arm where the kayak meets the churn — sculpted resin in motion.
- The water connects seamlessly INTO a compact display base beneath — the base is small and subtle, the water effect is prominent and wrapping.
The water is dimensional and dynamic — it behaves like a sculptor's interpretation of frozen motion, not like a miniature pond.`,

  surf: `EFFECTS — WAVE AS SCULPTED RESIN WRAPPING THE SUBJECT:
The wave is NOT a landscape. The wave is a sculpted resin EFFECT — a frozen curl wrapping around and rising behind the surfer.
- The wave face rises BEHIND the figure as a sculpted curling form with real dimensional volume — crest, curl, hollow interior.
- Spray explodes off the board edges and lip as sculpted resin arcs and discrete droplets.
- Foam trails off the heel side as a dynamic sculpted ribbon.
- The wave connects into a compact display base — base is subtle, wave is the dynamic effect wrapping the subject.
Frozen motion, not miniature terrain.`,

  snow: `EFFECTS — SNOW SPRAY AS SCULPTED RESIN WRAPPING THE SUBJECT:
Snow is NOT a slope terrain. Snow is a sculpted resin EFFECT wrapping around the hero — frozen powder in motion.
- A powder plume fans off the edges of the board or ski as a sculpted three-dimensional resin form — dense at contact, trailing outward.
- Snow crystals spray up along the rider's torso and arm as discrete sculpted particles.
- A small sculpted patch of snow texture at the rider's feet integrates into the compact base.
- The snow effect wraps and trails — dimensional, dynamic, not a flat snowfield.`,

  skate: `EFFECTS — SKATE DUST/DEBRIS AS SCULPTED RESIN WRAPPING THE SUBJECT:
Concrete is NOT a ground terrain. Motion debris IS the effect.
- A dust puff kicks off the wheels as a sculpted resin form with real volume — rim-lit, dynamic, trailing.
- If grinding, sculpted sparks or abrasion marks arc off the truck contact point.
- A small section of coping or rail under the board integrates into the compact base.
- The base is subtle. The action and motion wrapping the figure are the effect.`,

  bike: `EFFECTS — DIRT/DUST AS SCULPTED RESIN WRAPPING THE SUBJECT:
Terrain is NOT the focus. Motion debris IS.
- Dust fans off the rear tire as a sculpted three-dimensional resin cloud — dense at contact, trailing out in the direction of motion.
- Dirt chunks kick up as individual sculpted particles.
- A small sculpted dirt patch under the tire integrates into the compact base.
- Dynamic, wrapping, dimensional — not a trail scene.`,

  climb: `EFFECTS — ROCK ENGAGEMENT AND CHALK AS SCULPTED RESIN WRAPPING THE SUBJECT:
The rock is NOT a wall terrain. It is a sculpted resin EFFECT the subject engages with.
- A small sculpted rock section rises behind and alongside the climber — hands and feet in sculpted contact with sculpted holds. Just enough rock to anchor the pose.
- Chalk dust puffs from the hands and chalk bag as fine sculpted detail.
- Rope (if present) sculpted as a thin hanging cord with weight.
- The rock integrates into a compact base — rock supports the figure, not the other way around.`,

  run: `EFFECTS — MOTION DEBRIS AS SCULPTED RESIN WRAPPING THE SUBJECT:
Ground is NOT a terrain. Motion IS the effect.
- Dust or debris kicks up behind the heels as sculpted resin puffs — dynamic and dimensional.
- Small sculpted ground detail under the feet integrates into the compact base.
- The figure is mid-stride — motion is implied through sculpted debris trailing behind.`,

  dance: `EFFECTS — FABRIC AND MOTION AS SCULPTED RESIN WRAPPING THE SUBJECT:
Stage floor is NOT the focus. Motion and fabric ARE.
- Hair and fabric in motion are sculpted as flowing resin forms with real volume — frozen arcs of cloth and hair, not painted streaks.
- A small sculpted stage patch under the feet integrates into the compact base.
- The kinetic line of the body, the fabric, and the hair together form the sculpted wrapping effect.`,

  other: `EFFECTS — MOTION AS SCULPTED RESIN WRAPPING THE SUBJECT:
Whatever kinetic element appears in the source — water, dirt, dust, cloth, debris, spray — is rendered as a SCULPTED RESIN EFFECT wrapping around and trailing off the figure. Dynamic, dimensional, frozen in motion. The base is subtle and compact; the effect is the star of the scene around the subject.`,
}

// ── IDENTITY LOCK — HIGH FACE REAL ESTATE ───────────────────────
function buildIdentityLock(hero: HeroFigurineHero | null): string {
  if (!hero) {
    return `SUBJECT IDENTITY — PAINTED RESIN COLLECTIBLE FIGURINE:
Render the hero as a premium painted resin collectible statue with high facial identity preservation matching the source photograph. Museum-quality sculpt and paint — NOT a toy, NOT a cartoon, NOT stylized beyond controlled edge softening.`
  }

  const lines: string[] = []

  const coreParts = [
    hero.age_range && `age: ${hero.age_range}`,
    hero.gender_presentation && `gender presentation: ${hero.gender_presentation}`,
    hero.ethnicity_apparent && `apparent ethnicity: ${hero.ethnicity_apparent}`,
    hero.skin_tone && `skin tone (paint base): ${hero.skin_tone}`,
  ].filter(Boolean)
  if (coreParts.length) lines.push(`CORE: ${coreParts.join(' — ')}`)

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
    if (faceParts) lines.push(`FACE STRUCTURE (PRESERVE EXACTLY): ${faceParts}`)
  }

  if (hero.glasses && hero.glasses_description) lines.push(`EYEWEAR: ${hero.glasses_description}`)
  if (hero.facial_hair) lines.push(`FACIAL HAIR: ${hero.facial_hair}`)
  if (hero.expression) {
    lines.push(`EXPRESSION (SCULPTED AND PAINTED EXACTLY AS IN SOURCE): ${hero.expression}`)
  }

  const gearParts = [
    hero.gear_top && `top/torso: ${hero.gear_top}`,
    hero.gear_head && `head: ${hero.gear_head}`,
    hero.gear_hands && `hands: ${hero.gear_hands}`,
  ].filter(Boolean)
  if (gearParts.length) lines.push(`GEAR (painted resin, colors exact):\n  - ${gearParts.join('\n  - ')}`)

  if (hero.body_position) {
    lines.push(`BODY POSITION (FROZEN POSE — PRESERVE EXACTLY): ${hero.body_position}`)
  }
  if (hero.distinct_identifiers) {
    lines.push(`DISTINCT IDENTIFIERS (paint into the sculpt): ${hero.distinct_identifiers}`)
  }

  return `SUBJECT IDENTITY — MUSEUM-QUALITY PAINTED RESIN COLLECTIBLE FIGURINE:

A premium painted resin collectible statue of THIS specific person from the source photograph. Identity fidelity is the product. At 75-85% frame fill the face occupies significant pixels — use that real estate to preserve recognizable likeness.

${lines.join('\n\n')}

IDENTITY DISCIPLINE:
- Age is preserved exactly — do not render younger, older, or generic
- Every facial feature carries through: nose, eyes, mouth, jaw, proportions, distinguishing marks
- Expression is sculpted and painted exactly as in source
- Controlled stylization only — slight edge softening, minor simplification of very fine detail. No cartooning, no proportional changes, no idealization.
- Gear colors stay exact, rendered as paint on resin

MATERIAL LANGUAGE (RESIN COLLECTIBLE, NOT TOY):
- Matte-to-satin painted resin on skin — subtle cheekbone, nose bridge, brow highlights
- Hair sculpted with strand detail, painted with color variation
- Eyes: glossy resin with sharp catchlights — the single most identity-critical feature
- Clothing: simplified sculpted fabric forms with painted seams and texture
- No plastic toy sheen. No uniform matte. Premium statue territory.`
}

// ── POSE BLOCK ──────────────────────────────────────────────────
function buildPoseBlock(actionDescription: string, freezeMomentQuality?: string): string {
  return `POSE — DYNAMIC ACTION (POSE_PRIORITY: HIGH):

${actionDescription || 'The hero is captured in a dynamic action pose from the source photograph.'}
${freezeMomentQuality ? `FREEZE INSTANT: ${freezeMomentQuality}` : ''}

POSE REINFORCEMENT:
- Pose reads clearly from silhouette — a viewer across the room identifies the action immediately
- Slightly separate overlapping limbs from the torso for readability (without altering the pose's character)
- Enhance stance clarity and strength — heroic but natural, never theatrical or overextended
- Ensure balance: the figure looks physically stable. If the action is mid-air or off-balance, the sculpted effect (wave, spray, rock contact) supports the figure visibly
- Full body reconstructed if the source is partially cropped — infer legs/feet consistent with the action
- Every limb angle, rotation, and grip preserved from source. Every piece of gear (paddle, board, rope, bike) positioned exactly as source.`
}

// ── CORE + HIERARCHY BLOCK — THE THREE CRITICAL RULES ───────────
const CORE_HIERARCHY_BLOCK = `CORE:
This is a HERO COLLECTIBLE FIGURE, not a miniature diorama. A premium painted resin statue captured as a product photograph.

SCALE (CRITICAL — NON-NEGOTIABLE):
The subject must dominate the composition and occupy approximately 75-85% of the frame height. The figure is the dominant visual element. Do not reduce the subject to fit the environment — scale the environment to the subject.

ENVIRONMENT (SECONDARY):
The environment exists only to support the subject and must not compete for visual dominance. Do not build a full scene. No wide terrain, no full landscape reconstruction, no miniature world. The base is compact and subtle.

EFFECTS (CRITICAL):
Water, motion, impact, and kinetic elements are rendered as SCULPTED RESIN EFFECTS that wrap around the subject — frozen motion trailing off the figure and gear. Waves wrap around the kayak, spray fans off the paddle, dust trails off the wheels — dimensional, dynamic sculpted forms. NOT a flat miniature landscape. NOT a terrain base. The effects behave as motion wrapping the subject.`

// ── COMPOSITION AND FRAMING ─────────────────────────────────────
const COMPOSITION_BLOCK = `COMPOSITION AND FRAMING:

SUBJECT SCALE: The figure occupies 75-85% of the frame height. Tight framing centered on the hero. The figure is the dominant visual element.
BASE: Compact display base — a polished dark walnut plinth, SMALL and SUBTLE beneath the figure. The sculpted effects (water, spray, dust) integrate seamlessly into the base, not the other way around. The base does not occupy more than ~25% of the frame beneath the figure.
MARGIN: Tight but not clipping — 5-10% room around the figure on all sides. Post-generation outpainting adds studio backdrop context beyond this; render the figure as if that border is already there.
VERTICAL POSITION: Figure centered with the face in the upper-center region of the frame — the hero position.

DO NOT REDUCE THE SUBJECT TO FIT THE ENVIRONMENT. SCALE THE ENVIRONMENT TO THE SUBJECT.`

// ── CAMERA BLOCK — HERO ANGLE, TIGHT FRAMING ───────────────────
const CAMERA_BLOCK = `CAMERA — HERO STATUE PRODUCT SHOT:

Slightly low to mid-angle (25-35° above horizontal, looking UP/across at the figure) — this is the classic hero angle used by premium collectible figure photographers (Sideshow, Hot Toys, Prime 1). The low-ish angle gives the figure presence and power.

Expected view:
- The figure reads dominant and heroic — face, torso, pose all clearly readable
- Tight framing on the subject — the figure occupies most of the frame
- The compact base and sculpted effects visible at the figure's lower body, wrapping
- The viewer's eye lands on the face first, then the pose, then the effects

NOT top-down. NOT a diorama overview shot. A shoulder-level product photograph of a statue — the way a collector would photograph a prized piece on their shelf.

FOCUS:
Razor sharp across the entire figure — face especially. Effects sharp. Base sharp. Background softens only in the studio backdrop beyond.`

// ── BACKGROUND — STUDIO ─────────────────────────────────────────
const BACKGROUND_BLOCK = `BACKGROUND — DARK OR NEUTRAL STUDIO:

Clean dark or neutral studio backdrop behind the figure — a soft gradient, darker at the edges, slightly lighter behind the subject for rim-light separation. Warm dark gradient for golden mood, cool dark for dramatic, soft neutral for peaceful, clean neutral for vivid.

The backdrop is OUT OF FOCUS with gentle falloff — amorphous, no horizon, no texture, no objects. Pure product-photography backdrop isolating the subject.

NO real-world environment continuation. NO miniature scene feel. The figure stands alone against the studio backdrop.`

// ── MATERIAL / PHOTOGRAPHY FRAME ────────────────────────────────
const MATERIAL_FRAME = `PHOTOGRAPHIC STYLE — COLLECTIBLE STATUE CATALOG:

LIGHTING:
Studio lighting — directional key from upper-left around 45°, soft fill from the right, subtle rim light from behind/above to separate the figure from the backdrop. Strong but soft shadows define form on face and body.

FACE LIGHTING:
Face cleanly and flatteringly lit — no harsh shadows across identity features (nose bridge, under-eye, jaw). Face reads readable and recognizable under the key.

PAINT AND MATERIAL:
Matte-to-satin painted resin — skin reads painted, not photographic. Subtle brushwork at close inspection. Highlights layered on cheekbones, nose, knuckles. Wash pooling in cloth folds. Eyes glossy with sharp catchlights. Effects (water, spray, dust) show resin material qualities — translucent where water, opaque where foam, matte where dust.

LENS AND FOCUS:
Medium-format product-photography lens equivalent. Figure and effects fully in focus edge to edge. Studio backdrop softens naturally behind.

COLOR:
Clean catalog-accurate color. Subtle film-adjacent grade — lifted blacks, true midtones, restrained highlights. Not oversaturated, not clinical.

QUALITY:
Must feel like a premium collectible statue photographed for a high-end catalog. No miniature scene feel. No subject shrinkage. No toy-like rendering. No distortion of identity.`

// ── MAIN BUILDER ────────────────────────────────────────────────
export function buildHeroFigurinePrompt(input: HeroFigurineInput): string {
  const mood     = MOODS[input.mood] || MOODS.golden
  const effects  = MEDIUM_EFFECTS[input.kineticMedium] || MEDIUM_EFFECTS.other
  const identity = buildIdentityLock(input.hero)
  const pose     = buildPoseBlock(input.actionDescription, input.freezeMomentQuality)

  const featuresBlock = input.distinctiveFeatures
    ? `DISTINCTIVE FEATURES — PAINT THESE INTO THE SCULPT (NON-NEGOTIABLE):
${input.distinctiveFeatures}

Every named color and feature from the source carries through as paint on the figurine.`
    : ''

  const notesBlock = input.notes
    ? `NOTES FROM THE PERSON:\n${input.notes}`
    : ''

  return [
    'Transform the provided image into a museum-quality resin collectible statue of a person captured mid-action.',
    CORE_HIERARCHY_BLOCK,
    identity,
    pose,
    effects,
    featuresBlock,
    COMPOSITION_BLOCK,
    CAMERA_BLOCK,
    BACKGROUND_BLOCK,
    mood,
    MATERIAL_FRAME,
    notesBlock,
  ].filter(Boolean).join('\n\n')
}
