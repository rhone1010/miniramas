// lib/v1/landscapes-blocks.ts
// All prompt blocks for landscape generation.
// Forked from houses-blocks.ts day one — landscape-specific failure modes and language.
// Snow_globe and gingerbread excluded (Houses-only).

import {
  SurfaceID, AtmosphereID, MaterialID, EnvironmentID,
  LandscapeParams, ATMOSPHERE_FORCED_NIGHT,
  ScaleID,
} from './landscapes-shared'

// ═══════════════════════════════════════════════════════════════
// PLINTHLESS MODE DETECTION
// ═══════════════════════════════════════════════════════════════
// Triggered ONLY by surface + in_situ + edge_to_edge.
// Customer's intent at this combination: "the place itself, filling the frame,
// in its own world." A plinth at this combination produces flat-slab artifacts
// (the model resolves the conflict between edge_to_edge scene and rectangular
// frame by inventing a glass dome OR flattening the scene into a picture
// mounted on the plinth). Removing the plinth entirely at this combination
// removes the conflict and gives a third visual language: the place as
// immersive fragment.
export function isPlinthlessMode(params: LandscapeParams): boolean {
  return params.mainKind === 'surface'
      && params.environment === 'in_situ'
      && params.scale === 'edge_to_edge'
}

// ═══════════════════════════════════════════════════════════════
// ALWAYS-ON STACK
// ═══════════════════════════════════════════════════════════════

export const COLLECTIBLE_ANCHOR_BLOCK = `
THIS IS A PREMIUM COLLECTIBLE MINIATURE — A SCULPTURAL OBJECT, NOT A TOY.
The diorama is a precision handcrafted scale model of a specific real place.
It belongs on a collector's shelf, in a museum vitrine, or as the centerpiece of a serious gift.
Every surface has the tactile authority of a physical object — material truth, weight, dimensionality.
This is sculpture from a photograph. Treat it with the gravity that implies.

CRITICAL FORM: This is an OPEN sculpture on a plinth — NOT a snowglobe, NOT a cloche, NOT enclosed in glass or any dome shape. The scene rises freely from a flat circular plinth top into open air. Any glass dome, transparent enclosure, or arching shell over the scene is wrong and forbidden.
`.trim()

export const CAMERA_BLOCK = `
CAMERA: macro product photography.
Camera positioned 35-45 degrees above the diorama, angled downward.
Lens captures the full miniature in sharp focus — every surface and detail crisp.
Background blur applies ONLY to the scene behind the plinth — never to the miniature itself.
No tilt-shift. No selective blur on any part of the miniature.
The diorama reads as a real physical object you could pick up.
`.trim()

export const COMPOSITION_BLOCK = `
COMPOSITION:
The diorama sits on a circular dark walnut plinth — turned wood, thick and substantial, with a clean rounded edge profile.
The full circular plinth including its bottom rim is completely visible in frame — do not crop the base.
Approximately 15-20% breathing room between the plinth's outer edge and the image frame on all sides.
The plinth is the foundation. The scene lives on it. The frame contains both with room to breathe.

ABSOLUTELY CRITICAL — OPEN PLINTH, NOT ENCLOSED:
The diorama is an OPEN sculptural piece — the scene rises freely into open air from the plinth top.
There is NO glass dome over it. NO cloche. NO bell jar. NO snowglobe enclosure. NO transparent shell.
Nothing arches over, encloses, surrounds, or covers the scene.
The trees, rocks, water, and all scene elements extend UP and OUTWARD into open studio air with no surface above them.
The sky is the room or environment behind the diorama — never a curved dome of glass enclosing the model.
If you find yourself rendering anything arching above the scene, STOP. The scene must be entirely open to the air above.

This is a museum-display sculpture on an open plinth. Imagine a bronze sculpture in a gallery — plinth below, sculpture rising freely, no glass around it. Same logic for this miniature.
`.trim()

// ═══════════════════════════════════════════════════════════════
// PLINTHLESS VARIANTS — only used at surface + in_situ + edge_to_edge
// ═══════════════════════════════════════════════════════════════

export const COLLECTIBLE_ANCHOR_BLOCK_PLINTHLESS = `
THIS IS A PREMIUM CINEMATIC FRAGMENT OF A REAL PLACE — NOT AN OBJECT, NOT A TOY.
The render captures a circular section of the world — as if a piece of real terrain itself has been brought into focus by a macro lens.
Every surface has the tactile authority of real ground, real rock, real water, real foliage. The place itself, captured in immersive miniature framing.
This is sculpture-quality reproduction of a fragment of the world, not a sculpture sitting in a room.

CRITICAL FORM: This is an IMMERSIVE WORLD FRAGMENT. There is NO plinth, NO base, NO pedestal, NO display object beneath the scene. There is NO snowglobe, NO cloche, NO glass dome, NO transparent enclosure of any kind. The scene IS the world — a piece of real terrain rendered with sculptural care, blending into more of the same world at its edges.

NOTE ON VOCABULARY: where the instructions below say "the miniature," read "the focused scene." This render is a world fragment, not an object on a plinth.
`.trim()

export const CAMERA_BLOCK_PLINTHLESS = `
CAMERA: macro product photography of real terrain.
Camera positioned 35-45 degrees above the focused scene, angled downward.
Lens captures the focused scene in razor-sharp focus — every surface and detail crisp at center.
Background blur applies to the surrounding terrain at the perimeter — soft focus falloff away from the focused area.
No tilt-shift. No selective blur within the focused scene itself.
The focused area reads as a real piece of place — sculpted, sharp, present, sitting amid its larger world.
`.trim()

export const COMPOSITION_BLOCK_PLINTHLESS = `
COMPOSITION — IMMERSIVE WORLD FRAGMENT (NO PLINTH, NO BASE, NO PEDESTAL):

This render does NOT sit on a wooden plinth. There is NO base. NO platform. NO pedestal. NO turned-wood profile. NO circular wooden rim. NO display object beneath the scene.

The focused scene is a fragment of the world itself — as if the camera has zoomed into a section of real terrain. The scene fills approximately 85-95% of the frame. At the perimeter, the surrounding environment fades softly through gradual focus falloff and atmospheric blending.

THE EDGES OF THE SCENE:
- Foreground terrain extends naturally toward the camera and falls into soft focus
- Side and rear terrain blend into the surrounding environment through atmospheric haze and depth-of-field blur
- There is NO hard edge, NO rim, NO border, NO curve, NO wooden profile anywhere in the image
- The transition from focused scene to wider environment is gradual and organic

ABSOLUTELY CRITICAL — NEGATIVE CONSTRAINTS:
- NO wooden plinths, NO walnut bases, NO turned bases, NO pedestals
- NO glass cloches, NO glass domes, NO glass enclosures, NO snow globes, NO bell jars
- NO picture frames, NO photo edges, NO flat slab presentations, NO mounted-photograph artifacts
- NO museum platforms, NO gallery stands, NO display rings
- NO circular wooden object beneath the scene of any kind
- NO arching shell, dome, or anything covering the scene from above

This is NOT a sculpture on a plinth. The scene is a piece of the world, rendered with the loving authority of a macro photograph of real terrain. The viewer should feel they are looking at the place itself — not at an object representing it.
`.trim()

// ── SCALE BLOCK BUILDER ───────────────────────────────────────
// Scene-on-plinth occupancy. Plinth is always fully visible in frame —
// these numbers govern how much of the plinth's TOP SURFACE the scene fills.
//
// Plinthless mode (only triggered at surface + in_situ + edge_to_edge)
// overrides scale meaning: the focused scene fills the frame with soft falloff,
// not a fixed percentage of plinth diameter.
export function buildScaleBlock(scale: ScaleID, plinthless = false): string {
  if (plinthless) {
    return `
SCALE — IMMERSIVE FRAME FILL:
The focused scene fills approximately 85-95% of the frame.
At the perimeter, the focused scene transitions into surrounding terrain through soft focus falloff and atmospheric blending.
There is no rigid boundary, no hard edge — the scene fades organically into the world around it.
`.trim()
  }

  switch (scale) {
    case 'composed':
      return `
SCALE — COMPOSED:
The miniature scene occupies 55-65% of the plinth diameter.
30-35% of the plinth top surface is visible plinth, not scene — generous breathing room around the scene on all sides.
No element of the scene reaches or overhangs the plinth edge.
Any pathway, stream, or extending element runs from the scene toward the plinth edge but ends in plinth surface before reaching it.
The reading: a precious small object set within a generous display surround.
`.trim()
    case 'generous':
      return `
SCALE — GENEROUS:
The miniature scene occupies 70-78% of the plinth diameter.
20-25% of the plinth top surface is visible plinth, not scene — moderate breathing room around the scene.
Scene elements approach the plinth edge but do not overhang it. A clear ring of plinth is visible all the way around.
The reading: the scene fills its display, with the plinth still framing it clearly as a base.
`.trim()
    case 'edge_to_edge':
      return `
SCALE — EDGE TO EDGE:
The miniature scene occupies 85-92% of the plinth diameter.
8-12% of the plinth top surface is visible — a narrow ring of plinth visible around the scene edge.
The scene extends nearly to the plinth perimeter, just stopping short of overhanging.
Distant horizon elements and recede-into-distance vistas read at full ambition — the subject fills its display rather than floating in the middle of one.
The reading: a vast scene captured at full grandeur, with the plinth as a discrete frame around it rather than a generous surround.
The plinth bottom rim and side profile are still fully visible — only the TOP surface of the plinth is mostly covered by scene.
`.trim()
  }
}

export const PLACE_FIDELITY_BLOCK = `
PLACE-CHARACTER FIDELITY — THIS IS THE NON-NEGOTIABLE.

The source image is a photograph of a SPECIFIC real place that someone loves.
The miniature must preserve what makes THIS place THIS place — not a generic example of the place's category.

WHAT MUST BE PRESERVED EXACTLY:
- The specific surface character — the exact texture and material reading of every major surface in the scene
- The specific light interaction — the way light catches, refracts, absorbs, or rakes across this place's surfaces
- The specific colors — the actual hues of water, rock, foliage, soil, sky as they appear in the source
- The specific spatial layout — major lines, horizon position, scale relationships between scene elements
- The specific defining features — the unique geological, vegetative, or atmospheric details that identify THIS place
- The specific overall atmosphere — the mood and feeling captured in the source

WHAT THIS PLACE IS NOT:
- A generic example of its category. A sea grotto is not "a sea grotto" — it is THIS sea grotto, with its specific arch shape, its specific water color, its specific cave wall coloration.
- A reinterpretation. A redesign. A "better" version. A cleaner version.
- An average of all places of this type.

ANTI-DRIFT INSTRUCTIONS:
Do NOT substitute a generic example of the place's overall category.
Do NOT smooth, simplify, or idealize the surface character — preserve the actual roughness, irregularity, weathering present in the source.
Do NOT shift colors toward a "more pleasing" palette — the actual colors of THIS place are what makes it identifiable.
Do NOT add elements not visible in the source — no extra trees, water, structures, or features that weren't there.
Do NOT remove distinctive features that ARE visible — every quirk, irregularity, and unusual detail is part of the place's identity.

The brief: a parent or owner of this place must look at the miniature and immediately recognize it as THE place they know.
`.trim()

// ═══════════════════════════════════════════════════════════════
// SURFACE BLOCKS (5) — fidelity-led realistic path
// Also used as fidelity baseline beneath material blocks.
// ═══════════════════════════════════════════════════════════════

export const SURFACE_BLOCKS: Record<SurfaceID, string> = {

wet_luminous: `
SURFACE TREATMENT: WET & LUMINOUS

This place's identity is defined by water, ice, or wet surfaces — and how light behaves through them.
The miniature must capture the optical truth of wet materials at scale.

WATER SURFACES (where present):
- Translucent miniature resin with real optical depth — the eye reads through the surface to suggested volume below
- Surface tension visible — meniscus at edges, ripples or stillness exactly as in source
- Reflections: the world above mirrored on the surface with appropriate distortion for water state (still=mirror, moving=fragmented)
- Color: the exact color of THIS water — the specific blue-green of this lagoon, the tea-stain of this pond, the silver of this rapid

WET SURFACES (rock, stone, sand):
- Specular highlights catching light at glancing angles — wet surfaces have a clear sheen distinct from dry
- Saturated color — wet stone is darker and richer than dry stone, hold that
- Visible micro-reflections in pooled water on textured surfaces
- The reading: this surface is wet right now, you could touch it and your hand would come away damp

ICE / SNOW (where present):
- Translucent edges, internal light scatter, density readable at thickness changes
- Frost: dendritic crystal patterns at fine scale on appropriate surfaces

LIGHT INTERACTION:
- Light refracts THROUGH translucent elements rather than just reflecting OFF them
- Caustics where appropriate — light patterns cast through water onto submerged surfaces
- Highlights are crisp specular points, not diffuse glows
- The luminous quality comes from light's interaction with the wet substrate, not from external glow

The whole scene reads wet, alive, optically rich.
`.trim(),

soft_diffused: `
SURFACE TREATMENT: SOFT & DIFFUSED

This place's identity is defined by soft, light-absorbing surfaces — meadow grass, mist, sand, moss, lichen.
The miniature must capture the velvet quality of these surfaces and how light is scattered, not reflected.

SURFACE CHARACTER:
- Grass and meadow: dense miniature ground cover with depth — individual blades suggested but blended, like fine flocking with directional grain
- Sand: textured surface with grain visible at scale, soft tonal transitions, no harsh edges
- Moss and lichen: irregular organic patches with visible fuzz — the surface has a velvet nap that reads slightly soft-focus even when sharp
- Mist and atmospheric haze: physical volume in the scene, not a flat overlay — gradient density, particles you can almost see

LIGHT INTERACTION:
- Light is absorbed and scattered, not reflected — surfaces glow softly from within rather than catching highlights
- Shadow edges are soft and gradient — no hard shadow lines anywhere on diffused surfaces
- Highlights are gentle and broad — wide soft falloff rather than crisp specular points
- The overall contrast is reduced — the scene is luminous but not high-contrast

COLOR CHARACTER:
- Muted, layered, atmospheric — the source's colors but read through soft falloff
- Subtle shifts of hue across surfaces as light moves — no flat color blocks
- Greens are layered — sage, olive, lime, forest, all coexisting with subtle variation

ANTI-INSTRUCTIONS:
- Do NOT render diffused surfaces with crisp specular highlights — that breaks the surface category
- Do NOT use hard shadow edges on grass, moss, or sand — soft falloff only
- Do NOT increase contrast for "punch" — the soft quality IS the place

The whole scene reads soft, breathable, luminous in a quiet way.
`.trim(),

hard_raking: `
SURFACE TREATMENT: HARD & RAKING

This place's identity is defined by hard mineral surfaces — cliff, canyon, scree, weathered rock, exposed strata.
The miniature must capture the aggressive textural detail of stone and how raking light reveals it.

SURFACE CHARACTER:
- Rock and stone: every fissure, crack, weathering pattern, mineral vein visible at miniature scale — sculpted with authority
- Striations and bedding planes: the layered geology of the place readable as physical relief
- Surface roughness: granular, pitted, scoured — never smooth or sanded
- Color variation across mineral surfaces: the iron stains, lichen patches, mineral seeps that mark THIS specific stone

LIGHT INTERACTION:
- Light rakes ACROSS surfaces at low angle — every micro-relief casts a tiny shadow that reveals texture
- Highlights are hard, crisp, narrow — they sit on edges and ridges only
- Shadows are deep and well-defined — the contrast between lit face and shadow face is high
- Where light hits, the surface explodes with detail; where shadow falls, the form reads as solid geometric mass

COLOR CHARACTER:
- The actual mineral colors of THIS rock — the specific red-orange of this sandstone, the specific grey of this granite, the specific black of this basalt
- Subtle color shifts across faces as light angle changes
- Higher saturation in raking light, deeper tones in shadow

ANTI-INSTRUCTIONS:
- Do NOT smooth or sand mineral surfaces — preserve every visible roughness and irregularity
- Do NOT use diffuse soft lighting — raking directional light is what reveals the surface character
- Do NOT generic-ify the color toward "rock-colored" — the specific palette of THIS stone is identity

The whole scene reads hard, ancient, geologically authoritative.
`.trim(),

layered_atmospheric: `
SURFACE TREATMENT: LAYERED & ATMOSPHERIC

This place's identity is defined by depth and atmosphere — distant peaks receding through air, hazy valleys, forest layers fading into distance.
The miniature must capture aerial perspective at scale: the way distance softens and shifts color through atmosphere.

DEPTH STRUCTURE:
- Foreground: full saturation, sharp detail, warm tones — the closest scene elements rendered at maximum clarity
- Midground: slightly desaturated, slightly hazed, secondary detail level — the middle distance
- Background: significantly desaturated toward blue-grey, soft edges, suggested rather than detailed — the far distance
- The progression must be readable across the depth of the scene — at miniature scale this means the receding planes are physically built up with subtle haze between them

ATMOSPHERIC HAZE:
- Physical atmosphere between viewer and distant elements — particulate light scatter
- Slightly brighter toward the back-upper area where sky meets distance
- Particles glow because suspended in luminous haze — never as visible cones or beams
- Color: warm in golden light, cool blue-grey in neutral or stormy light, never neutral grey

LIGHT INTERACTION:
- Light builds up through air — distant surfaces don't receive direct light the way foreground does
- Color saturation drops with distance — the famous aerial perspective shift toward blue
- Edge sharpness drops with distance — far elements have softer silhouettes
- The whole scene has volumetric depth, not flat layered cards

COLOR CHARACTER:
- Foreground holds the source's specific colors at full strength
- Background drifts toward atmospheric blue or warm-haze depending on atmosphere setting
- The transition is smooth and continuous, never stepped

ANTI-INSTRUCTIONS:
- Do NOT render distant elements at the same sharpness/saturation as foreground — that flattens depth
- Do NOT use flat fog overlays or haze plates — the atmosphere must read as physical volume
- Do NOT lose the source's specific color identity in the foreground while applying atmospheric desaturation only to distance

The whole scene reads vast, deep, atmospheric.
`.trim(),

lush_saturated: `
SURFACE TREATMENT: LUSH & SATURATED

This place's identity is defined by living color — jungle canopy, peak-bloom flora, mossy temperate rainforest, tropical abundance.
The miniature must capture the chlorophyll glow and color saturation that make this place feel alive.

SURFACE CHARACTER:
- Foliage: dense layered miniature plant material with visible leaf structure at scale, multiple greens coexisting
- Bark, bamboo, vines: organic textures with full color authority — never muted toward neutral
- Flowers: where present, rendered at scale with petal structure and color saturation that pops against green
- Water (where present): saturated by surrounding color reflections — green-tinted, jewel-toned

LIGHT INTERACTION:
- Light filters through leaves — backlit foliage glows from within with chlorophyll-translucent green
- Dappled light pattern on lower surfaces from canopy above — visible light/shadow mottling
- Colors are at peak saturation — greens are vivid, flowers are jewel-bright, surfaces glow
- Slight humidity in the air softens edges marginally without dropping saturation

COLOR CHARACTER:
- The specific lush palette of THIS place — the particular jungle-green, the specific bloom colors
- Multiple chromatic greens across the scene — sage, lime, emerald, forest, jade, all reading distinctly
- Accent colors (flowers, fruit, butterflies) at full saturation against green field
- Overall color temperature warm-and-vivid rather than neutral

ANTI-INSTRUCTIONS:
- Do NOT desaturate toward "natural" — lush saturation IS the place's identity
- Do NOT collapse the multiple greens into one uniform green — variety is the texture
- Do NOT mute the chlorophyll glow with grey or beige — keep the living color
- Do NOT add atmospheric haze that drops saturation — this surface category lives at full color

The whole scene reads alive, abundant, chromatically rich.
`.trim(),

}

// ═══════════════════════════════════════════════════════════════
// ATMOSPHERE BLOCKS (10) — apply on both paths
// ═══════════════════════════════════════════════════════════════

export const ATMOSPHERE_BLOCKS: Record<AtmosphereID, string> = {

golden: `
ATMOSPHERE: GOLDEN HOUR
Warm low-angle sunlight — the color of late afternoon sun, the hour before sunset.
Long soft shadows stretching across the scene at low angle.
Warm orange-gold highlights on lit surfaces, cooler purple-blue tones in shadow.
Atmospheric haze warmed by the low sun — slightly brighter toward the back-upper area where the sun sits.
The luminous quality comes from warm directional light interacting with the surfaces — never visible beams or shafts.
The scene feels nostalgic, beloved, captured at its most beautiful moment.
`.trim(),

peaceful_dawn: `
ATMOSPHERE: PEACEFUL DAWN
First light — the moment before sunrise, when the world is hushed and luminous.
Cool soft light with the first warm undertones beginning to creep in from the horizon.
Mist still lingering in low places, rising slowly from water or grass.
Shadows are long but soft-edged — the sun is low but still below or just at horizon.
The atmospheric haze reads as physical volume — particles suspended in luminous quiet.
The scene feels still, contemplative, on the edge of awakening.
`.trim(),

vivid_midday: `
ATMOSPHERE: VIVID MIDDAY
Peak sun overhead — colors at maximum saturation, the world at full brightness.
Strong directional light from above with crisp short shadows.
Skies vivid blue (where visible), clouds bright white with crisp edges.
High contrast between lit faces and shadow faces.
Atmospheric haze minimal — the air is clear, distance still readable but not heavily faded.
The scene feels energetic, alive, captured at peak day.
`.trim(),

dusk_blue_hour: `
ATMOSPHERE: DUSK / BLUE HOUR
The hour after sunset — sky deepening to indigo, last warm glow on the horizon.
Cool ambient light dominates with warm accent only at the lowest sky edge.
Surfaces read in cool blue-violet tones with subtle warm rim where they catch the residual light.
Shadows are long and very soft — direct sunlight has gone, only sky-light remains.
Atmospheric haze tinged with blue-violet — the deepening color of evening air.
The scene feels quiet, settled, holding the day's last light.
`.trim(),

dramatic_storm: `
ATMOSPHERE: DRAMATIC STORM
Heavy weather — dark clouds, broken light, raw natural drama.
Light is broken: deep shadows under heavy cloud cover with bright shafts of sun breaking through where clouds part.
Where direct light hits, surfaces explode with high-contrast detail; elsewhere, deep moody shadow.
The luminous quality of broken light catching on wet surfaces, edges of foliage, distant peaks.
Wind suggested through directionality of any soft elements — leaves, water surface, mist.
Atmospheric haze heavy and moving — visible weight in the air.
The scene feels charged, weighted, witness to natural power.
`.trim(),

deep_night: `
ATMOSPHERE: DEEP NIGHT
True night — moonlight as the primary illumination, stars visible in any sky area.
Cool blue-silver light from moon as the dominant source — directional, soft, lunar.
Where present in source: any natural light sources (lit windows, lanterns, bioluminescence) glow warm against the cool ambient.
Shadows are deep but not crushed — moonlit detail still readable in shadow areas.
Sky reads as deep navy fading to near-black overhead, with subtle gradient near horizon.
Stars suggested as fine pinpoint detail where sky is visible.
Atmospheric haze cool and still — the night air has weight and silence.
The scene feels nocturnal, mysterious, alive in its own way.
`.trim(),

fog_rolled_in: `
ATMOSPHERE: FOG ROLLED IN
Heavy fog — visibility reduced, distance disappearing, the world reduced to nearby forms.
Foreground elements still readable but with softer edges than normal.
Midground elements partially veiled — silhouettes visible but detail dropping.
Background elements suggested rather than rendered — pure tonal shapes fading to white-grey.
Light is omnidirectional and soft — fog scatters light from all angles, no clear sun direction.
Atmospheric haze IS the scene — physical volume of suspended water droplets visible everywhere.
Color drops toward neutral grey-white in distance, holds slightly more in foreground.
The scene feels intimate, mysterious, the world reduced to immediate surroundings.
`.trim(),

after_rain: `
ATMOSPHERE: AFTER RAIN
The storm has passed — surfaces still wet, light beginning to break through clearing clouds.
All surfaces show their wet character: saturated colors, specular highlights, pooled water in low spots.
Where the source has hard surfaces, they read newly wet — rock darkened and gleaming, foliage glistening.
Where the source has soft surfaces, they read freshly damp — saturated and slightly heavier.
Light is breaking — soft warm shafts where clouds part, cool ambient elsewhere.
Petrichor suggested visually through luminous moisture in the air — fine atmospheric haze rising from warming wet surfaces.
Sky still shows broken cloud — patches of blue beginning to show through grey.
The scene feels renewed, washed clean, captured in the moment after weather.
`.trim(),

snow_falling: `
ATMOSPHERE: SNOW FALLING
Active snowfall — snow on the ground and in the air, the moment of being inside a snowstorm.
Snow accumulated on horizontal surfaces of the miniature — dusting of white on rock ledges, foliage, scene elements.
Active snowflakes rendered as fine particulate detail in the air — varying sizes, soft-edged, suggesting motion blur.
Ground accumulation appropriate to scene — light dusting if early, deeper coverage if heavy.
Sky reads as flat luminous grey-white — overcast snow-sky, the diffuse light of falling snow.
Light is omnidirectional and very soft — snow scatters light from all angles.
Color overall muted toward white-grey, but source's distinctive color identity still readable in unsnowed areas.
Atmospheric haze heavy with falling snow — air thick with motion.
The scene feels hushed, transformed, alive with quiet motion.
`.trim(),

aurora_surreal: `
ATMOSPHERE: AURORA / SURREAL LIGHT
Otherworldly atmospheric phenomenon — northern lights, alien sky, supernatural illumination.
Sky shows ribbons of luminous color — green, violet, magenta — drifting and flowing across the scene background.
The aurora illumination casts colored light onto the miniature surfaces — green-tinted highlights on lit faces where the aurora is brightest, with shifts to violet in other areas.
Stars visible through and around the aurora — clear night sky between the light ribbons.
Snow or wet surfaces (if present) catch and reflect the aurora colors with extra brilliance.
Foreground elements lit by the aurora's color cast plus residual ambient — the unusual color is the scene's signature.
Atmospheric haze cool and still with subtle color tint matching the aurora overhead.
The scene feels transcendent, magical, witness to phenomena.
`.trim(),

}

// ═══════════════════════════════════════════════════════════════
// MATERIAL BLOCKS (7) — costume path
// ═══════════════════════════════════════════════════════════════

export const MATERIAL_BLOCKS: Record<MaterialID, string> = {

bronze: `
MATERIAL TREATMENT: CAST BRONZE — MONOCHROMATIC

The entire scene is rendered as a single cast-bronze sculptural object.
This is a museum-grade bronze casting of the place — every surface, every element, all bronze.

SURFACE CHARACTER:
- Cast bronze with the warm metallic tone of aged statuary bronze — rich amber-brown with subtle warm undertones
- High points and edges catch warm specular highlights — the polished sheen of raised cast surfaces
- Recesses and crevices hold deeper patina — slightly cooler, slightly darker tones in shadow areas
- Subtle verdigris suggestion in deepest recesses only — never spreading across primary surfaces

WORKED EXAMPLE — SOURCE COLOR REJECTION:
If the source has a blue-green sea, the bronze sculpture has bronze water — not blue-tinted bronze, not green-tinted bronze, BRONZE water with cast surface ripples.
If the source has red rock, the bronze sculpture has bronze rock — not amber-tinted-toward-red, BRONZE rock.
If the source has green foliage, the bronze sculpture has bronze foliage — leaves cast in bronze, not bronze that's been painted green.
The source's COLORS DO NOT CARRY through. Only the FORMS carry through.

CRITICAL — NAMED FAILURE MODE:
The most common failure on this material is treating bronze as an accent — bronze rocks against blue water, bronze trees against green grass.
This is wrong. The ENTIRE SCENE is bronze. Water is bronze. Sky elements (where present in scene as physical features like cloud-on-mountain) are bronze.
Every visible surface of the miniature scene is cast bronze. No exceptions.

LIGHT INTERACTION:
- Highlights are warm metallic specular — sharp, bright, golden-amber
- Shadows hold the deeper bronze tones with hint of cooler patina
- The whole sculpture has the unmistakable optical signature of cast metal

ANTI-INSTRUCTIONS:
- Do NOT carry source colors through as bronze tinting
- Do NOT treat bronze as accent material against other materials
- Do NOT add color washes, paint, or non-bronze elements anywhere in the scene
- Do NOT render water with blue/green tint even if source water is colored

The reading: a single bronze sculpture of this place, monolithic in material, rich in form.
`.trim(),

museum_quality: `
MATERIAL TREATMENT: MUSEUM-QUALITY SCALE MODEL

The scene is rendered as the apex of miniature craftsmanship — the quality of an institutional architectural model or natural history museum diorama.
This is what every other material aspires to in different costume.

SURFACE CHARACTER:
- Every material rendered at its highest plausible miniature realization
- Stone reads as carefully sculpted and painted resin with authentic geological character
- Water reads as crystal-clear casting resin with optical depth and surface tension
- Foliage reads as precision miniature plant material — laser-cut leaf forms, hand-flocked groundcovers, scaled accurately
- Architectural elements (where present) at architect's-presentation-model standard

LIGHT INTERACTION:
- Studio-quality even illumination with subtle directional bias
- Every surface reveals its character without harshness or mystery
- Highlights are precise, shadows are clean, midtones are rich
- The lighting flatters the model the way museum lighting flatters an exhibit

COLOR CHARACTER:
- The source's exact colors at full saturation and accuracy
- Premium pigments — nothing washed out, nothing oversaturated
- The reading: a model that cost a year of skilled labor to produce

QUALITY MARKERS:
- Tactile authority on every surface
- Scale-appropriate detail throughout — nothing oversimplified, nothing inappropriately fine
- The plinth and integration of model-to-plinth is impeccable
- This is the model that gets photographed for the catalogue

ANTI-INSTRUCTIONS:
- Do NOT shortcut surface complexity — every element gets its full realization
- Do NOT introduce stylization — this is realism executed at the highest level
- Do NOT lose the source's color identity in pursuit of "quality"

The reading: this is the scale model someone would commission for $50,000.
`.trim(),

alabaster: `
MATERIAL TREATMENT: CARVED ALABASTER

The scene is rendered as a single carved-alabaster sculptural object.
Translucent stone carving with the soft luminous quality alabaster is famous for.

SURFACE CHARACTER:
- Pale cream-to-warm-white stone with visible internal translucency
- Light penetrates a few millimeters into the surface before scattering — the famous alabaster glow
- Edges and thin sections show subtle backlit luminescence — light passing partly through
- Surface finish is satin — neither matte nor glossy, with soft micro-reflections
- Subtle natural veining visible at fine scale — the geological signature of real alabaster

LIGHT INTERACTION:
- The luminous quality comes from internal scatter — surfaces glow softly from within rather than reflecting harshly
- Highlights are diffuse and broad — never sharp specular points
- Shadows are warm and gradient — softened by the stone's translucent character
- Where the carving is thin, real backlight glow shows — depth of material readable in the light

COLOR CHARACTER:
- Monochrome — entire scene rendered in alabaster's natural cream-white-amber range
- Subtle warmth where light hits, subtle coolness in shadow
- Source colors DO NOT carry through — only forms carry

WORKED EXAMPLE — SOURCE COLOR REJECTION:
If the source has bright blue water, the alabaster sculpture has cream-white water with carved ripples — not blue-tinted alabaster, just alabaster shaped like water.
If the source has green foliage, the alabaster has cream foliage — every leaf and stem carved in stone.

CARVING CHARACTER:
- This is a unified carved object — not assembled, not painted
- Tool marks suggested at intimate scale where appropriate
- Forms slightly softened compared to source — stone carving naturally rounds sharp edges

ANTI-INSTRUCTIONS:
- Do NOT add color anywhere — alabaster is monochrome
- Do NOT use harsh specular highlights — the soft glow is the signature
- Do NOT lose the translucency reading — internal light scatter is what makes alabaster alabaster

The reading: a single alabaster carving of this place, glowing softly from within.
`.trim(),

glass: `
MATERIAL TREATMENT: BLOWN GLASS WITH OPTICAL MASS

The scene is rendered as a single blown or sculpted glass object.
Real glass with real optical mass — refraction, internal reflection, and light play through transparent material.

SURFACE CHARACTER:
- Crystal-clear glass with real volume — every form has visible thickness and optical density
- Light refracts THROUGH the glass — backgrounds visible through the sculpture are slightly distorted
- Edges catch sharp specular highlights at angles — the signature of polished glass
- Internal reflections visible at form intersections — light bouncing inside the glass mass
- The glass has weight readable through how light behaves in it

LIGHT INTERACTION:
- Highlights: sharp, narrow, bright specular points on edges and curves
- Refraction: visible bending of light through the glass body
- Caustics: bright pattern projected onto the plinth where light passes through and focuses
- Internal glow where light enters and scatters within the form

COLOR CHARACTER:
- Predominantly clear with subtle tint pickup from environment
- Where source has water elements: those elements may carry subtle aqua-tint as artistic choice (water carved in glass tinted faintly with water-color)
- Otherwise: clear glass, with environment colors visible through the sculpture as refracted echoes

CARVING / BLOWING CHARACTER:
- Forms have the smooth flowing quality of blown or kiln-cast glass
- Slight imperfections suggesting hand-craft — minor surface variations, tiny internal bubbles where appropriate
- Forms more flowing than rigid — glass remembers it was once liquid

ANTI-INSTRUCTIONS:
- Do NOT render glass as a thin shell — it must have real optical mass throughout
- Do NOT lose the refraction reading — light passing THROUGH is the signature
- Do NOT carry source colors through as glass tints (except optionally for water elements)
- Do NOT render forms with hard sharp edges — glass forms flow

The reading: a substantial blown-glass sculpture of this place, full of internal light and clarity.
`.trim(),

carved_stone: `
MATERIAL TREATMENT: CARVED LIMESTONE

The scene is rendered as a single carved-limestone sculptural object.
Honey-colored limestone with visible tool marks and the warm textural authority of architectural stone carving.

SURFACE CHARACTER:
- Warm cream-to-honey limestone with subtle natural color variation across the form
- Visible tool marks at intimate scale — the chisel-and-rasp evidence of hand carving
- Surface finish is matte to soft satin — never glossy
- Subtle pitting and natural stone character — this is real stone, not polished marble

LIGHT INTERACTION:
- Direct light reveals tool marks and surface micro-relief — every facet of the carving readable
- Shadows are warm and well-defined — stone holds its form with authority
- Highlights are diffuse warm — the soft sheen of fine limestone, never harsh specular
- The luminous quality comes from light raking across the carved surface

COLOR CHARACTER:
- Monochrome warm limestone — cream, honey, soft amber range only
- Subtle variation across the form suggesting natural stone variation
- Source colors DO NOT carry through — only forms carry

CARVING CHARACTER:
- This is hand-carved stone — visible craft, not machine-perfect
- Forms slightly softened where the carver's intention met the stone's resistance
- Sharper detail in protected areas, slightly weathered detail in exposed areas
- Reading: a sculpture you would see in a cathedral courtyard or museum garden

ANTI-INSTRUCTIONS:
- Do NOT polish to marble smoothness — limestone has visible texture
- Do NOT add color — stone is monochrome warm
- Do NOT use sharp specular highlights — the matte-satin reading is the signature

The reading: a single limestone carving of this place, warm and stone-still.
`.trim(),

carved_wood: `
MATERIAL TREATMENT: CARVED HARDWOOD

The scene is rendered as a single carved-hardwood sculptural object.
Rich figured wood — walnut, cherry, or similar — with visible grain following the form, hand-carved with authority.

SURFACE CHARACTER:
- Warm wood grain visible across all surfaces — figured grain that flows with the carving
- Color: rich brown with warm undertones, slight variation suggesting different parts of the wood block
- Surface finish: hand-rubbed oil or satin wax — soft sheen, never high gloss
- Carved facets show grain alignment — the carver chose how grain reveals on each face

LIGHT INTERACTION:
- Directional light catches the grain — bright reflective grain lines visible on lit surfaces
- Shadows hold the deeper warm wood tones
- Highlights are warm and broad — the soft sheen of oiled hardwood
- The luminous quality comes from light interacting with figured grain

COLOR CHARACTER:
- Monochrome wood-warm — rich browns with amber, gold, and chocolate variations
- Source colors DO NOT carry through — the wood's own warmth is the only color
- Subtle variation across the carving as different grain reveals at different angles

CARVING CHARACTER:
- Visible chisel and gouge marks at intimate scale — this is hand-carved
- Forms soft-edged where the carver rounded with sandpaper, sharper where chisel was final
- Grain followed thoughtfully — long forms run with grain, short details cross it
- Reading: the kind of folk-art-meets-fine-art carving in a high-end woodworker's studio

ANTI-INSTRUCTIONS:
- Do NOT render with painted color — wood's own color is the only color
- Do NOT polish to high gloss — satin-oil finish is the signature
- Do NOT lose the grain reading — figured grain is what makes wood wood

The reading: a single hardwood carving of this place, warm and grain-alive.
`.trim(),

watercolor_wood: `
MATERIAL TREATMENT: WATERCOLOR-PAINTED CARVED WOOD

The scene is rendered as carved hardwood with delicate watercolor painting applied — the costume of a hand-painted folk-art object.
Wood substrate readable through translucent washes of color.

SURFACE CHARACTER:
- Underlying carved wood structure — same character as carved_wood, with grain visible through paint
- Watercolor washes applied on top — translucent color that lets wood grain show through
- Soft pigment edges where wash boundaries meet — the bleed and feather of real watercolor
- Slightly absorbent appearance — paint sat into the wood rather than on top

PAINT CHARACTER:
- Translucent washes — never opaque coverage
- Source colors carry through but softened, slightly desaturated, painted-rather-than-photographed quality
- Soft edge transitions between color areas — wet-into-wet bleeds at boundaries
- Slight color variation within each wash — never flat fields

LIGHT INTERACTION:
- Wood grain visible THROUGH the paint where light catches
- Highlights are soft warm wood tones cutting through pigment
- Shadows are paint-deepened wood — the wash plus wood absorption
- The luminous quality comes from grain showing through translucent color

COLOR CHARACTER:
- Source colors present but softened — the watercolor reading
- Slightly muted, slightly cooler, slightly atmospheric compared to source
- Subtle color bleeds at boundaries between elements

CARVING CHARACTER:
- Same hand-carved authority as carved_wood
- Paint follows form rather than disguising it
- Reading: folk-art-meets-craft tradition — Scandinavian, Appalachian, or similar painted carving traditions

ANTI-INSTRUCTIONS:
- Do NOT use opaque paint coverage — translucency is the signature
- Do NOT lose the wood grain entirely under paint — grain visible through
- Do NOT use sharp painted edges — soft watercolor bleeds throughout
- Do NOT make this look like flat illustration — the dimensional carving reads through

The reading: a single watercolor-painted hardwood carving of this place, warm and softly colored.
`.trim(),

}

// ═══════════════════════════════════════════════════════════════
// ENVIRONMENT BLOCKS (3)
// ═══════════════════════════════════════════════════════════════

export const ENVIRONMENT_BLOCKS: Record<EnvironmentID, string> = {

in_situ: `
ENVIRONMENT: IN SITU — SCENE-MATCHED OUTDOOR SETTING

The miniature sits outdoors in a setting drawn from the source's own environment — not a studio, not a room.
The plinth rests on natural ground appropriate to the place: rock for geological scenes, sand for beach scenes, grass for meadow scenes, wet stone for grotto scenes.
The background is the place itself, but in heavy painterly blur — the same environment as the miniature, completely out of focus.
Background color, light, and tonal character match the miniature's place — visual continuity between the small and the large.
The reading: the miniature is here, in this place, on this ground, with its world blurring softly behind it.
Foreground ground surface: scene-appropriate, softly textured, in focus where it meets the plinth and falling out of focus toward the camera.
Background blur: heavy painterly bokeh, no readable detail, but unmistakably the place's environment.
The miniature is the only sharp element. Everything else is the place, suggested.
`.trim(),

desk: `
ENVIRONMENT: ON DESK — STUDY SETTING

The miniature sits on a large dark walnut desk in a study or library.
The desk surface is rich figured walnut — chocolate-brown with visible grain, mirror-satin finish, deep saturated color.
The desk extends well beyond the plinth in every direction — the miniature is a small precious object on a large surface.
A hardcover book lies open near the diorama. Reading glasses rest folded nearby. A small ceramic mug suggests a recent moment of attention.
Beyond the desk: a study softly out of focus — bookshelves suggested, a leather chair, a window with warm light, framed paintings on walls.
Lighting is warm and directional — afternoon light from a window as the primary source, falling on the diorama.
A small antique brass lamp with silk shade glows in the far background — accent only, does not light the diorama directly.
The desk surface reflects the diorama softly — the bottom of the plinth visible mirrored in the polished wood.
The reading: a beloved miniature on a beloved desk in a beloved room — small, precious, attended to.
`.trim(),

gallery: `
ENVIRONMENT: GALLERY — EXHIBITION SPOTLIGHT

The miniature sits as the sole subject in a museum or gallery vitrine setting.
Background is deep dark — near-black with subtle gradient suggesting unlit gallery space behind.
Lighting is dramatic exhibition style: a single warm directional source from above and slightly to one side illuminates the diorama.
The light has the focused quality of museum exhibit lighting — bright on the subject, dropping to deep shadow everywhere else.
The miniature glows like a jewel in darkness — every surface readable, every detail caught by the directional light.
Subtle hint of plinth setting visible — the kind of low pedestal a museum would use, suggested in the foreground but not the focus.
No competing objects, no environmental context — the miniature is presented in isolation as the worthy subject.
The reading: this is what is being looked at. This is the exhibit. This is the work.
`.trim(),

}

// ═══════════════════════════════════════════════════════════════
// PLINTHLESS ENVIRONMENT — only used at surface + in_situ + edge_to_edge
// ═══════════════════════════════════════════════════════════════

export const ENVIRONMENT_IN_SITU_PLINTHLESS = `
ENVIRONMENT: IMMERSIVE IN-SITU — THE PLACE ITSELF AS WORLD FRAGMENT

The focused scene IS a piece of the place's environment — sitting amongst more of the same world.
The ground beneath the focused area is the source's ground: rock blending into more rock, sand blending into more sand, wet stone blending into more wet stone, moss blending into more moss, grass blending into more grass.
At the perimeter, the focused scene transitions softly into surrounding terrain through gradual focus falloff and atmospheric blending. This surrounding terrain is the SAME place at slightly larger scope, deeply out of focus.

There is no separation between the focused scene and the surrounding world — they are the same continuous environment, with the focal point sharply rendered and the surroundings veiled in depth-of-field blur.

The reading: not an object IN a place, but a piece OF the place — captured at the moment the camera chose to focus on it.
`.trim()

// ═══════════════════════════════════════════════════════════════
// NIGHT OVERRIDE BLOCK
// ═══════════════════════════════════════════════════════════════

export const NIGHT_OVERRIDE_BLOCK = `
NIGHT OVERRIDE — APPLIED IN ADDITION TO BASE LIGHTING

The scene is at night. Lighting reconstructed accordingly while preserving all surface and material instructions.

LIGHT SOURCES:
- Cool moonlight from above as the primary ambient source — soft directional light with the silver-blue character of moon
- Where the place has natural warm light sources (campfires, lit windows, lanterns, bioluminescence): those glow warmly against the cool moonlight
- Where the environment is desk: a small antique lamp in the room background contributes warm fill, does not light the miniature directly
- Where the environment is in_situ: a distant warm point of light suggested in the blurred background — a lit cabin, a streetlamp, a candle — for emotional warmth

LIGHTING CHARACTER:
- Cool blue-silver overall ambient with warm accent points
- Shadows are deeper than day but never crushed — moonlit detail still readable
- Sky reads as deep navy fading to near-black overhead, stars suggested as fine pinpoint detail
- Atmospheric haze cool and still

WHAT DOESN'T CHANGE:
- All surface treatment instructions still apply — the place's surface character is preserved, just lit at night
- All material treatment instructions still apply — material reads the same, lit by night light
- All composition and camera instructions still apply

ANTI-INSTRUCTIONS:
- Do NOT use spotlights, lamps, or visible artificial light cones as light sources
- Do NOT render the scene in flat darkness — moonlit detail is the signature
- Do NOT lose the place's color identity — colors read cooler at night but remain recognizable
`.trim()

// ═══════════════════════════════════════════════════════════════
// PROMPT BUILDER
// ═══════════════════════════════════════════════════════════════

export function buildLandscapePrompt(params: LandscapeParams): string {
  const blocks: string[] = []
  const plinthless = isPlinthlessMode(params)

  // Always-on stack — swap plinth vs plinthless variants
  blocks.push(plinthless ? COLLECTIBLE_ANCHOR_BLOCK_PLINTHLESS : COLLECTIBLE_ANCHOR_BLOCK)
  blocks.push(plinthless ? CAMERA_BLOCK_PLINTHLESS              : CAMERA_BLOCK)
  blocks.push(plinthless ? COMPOSITION_BLOCK_PLINTHLESS         : COMPOSITION_BLOCK)
  blocks.push(buildScaleBlock(params.scale, plinthless))
  blocks.push(PLACE_FIDELITY_BLOCK)

  // The place this is
  if (params.displayName || params.dominantSubject) {
    const placeLines: string[] = ['THIS SPECIFIC PLACE:']
    if (params.displayName)     placeLines.push(`Place type: ${params.displayName}`)
    if (params.dominantSubject) placeLines.push(`Defining feature: ${params.dominantSubject}`)
    blocks.push(placeLines.join('\n'))
  }

  // Surface or material path.
  // Plinthless mode is surface-only by definition — the material branch
  // never fires when plinthless is true. Both branches kept for safety.
  if (params.mainKind === 'surface' && params.surface) {
    blocks.push(SURFACE_BLOCKS[params.surface])
  } else if (params.mainKind === 'material' && params.material) {
    // Material path: include underlying primary surface as fidelity baseline FIRST,
    // then the material costume on top. Material wins where they conflict.
    if (params.primarySurface) {
      blocks.push(SURFACE_BLOCKS[params.primarySurface])
    }
    blocks.push(MATERIAL_BLOCKS[params.material])
  }

  // Atmosphere (option A)
  blocks.push(ATMOSPHERE_BLOCKS[params.atmosphere])

  // Environment (option B) — swap plinthless variant when applicable.
  // Plinthless mode is in_situ-only by definition, so the swap only needs
  // to handle in_situ.
  if (plinthless) {
    blocks.push(ENVIRONMENT_IN_SITU_PLINTHLESS)
  } else {
    blocks.push(ENVIRONMENT_BLOCKS[params.environment])
  }

  // Night override — only if night AND atmosphere doesn't have its own night recipe
  const isForcedNight = ATMOSPHERE_FORCED_NIGHT.includes(params.atmosphere)
  const effectiveTod  = isForcedNight ? 'night' : params.tod
  if (effectiveTod === 'night' && !isForcedNight) {
    blocks.push(NIGHT_OVERRIDE_BLOCK)
  }

  // Optional notes from the customer
  if (params.notes?.trim()) {
    blocks.push(`ADDITIONAL NOTES FROM THE PERSON WHO LOVES THIS PLACE:\n${params.notes.trim()}`)
  }

  return blocks.join('\n\n').trim()
}
