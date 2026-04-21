// landscape-generator.ts
// lib/v1/landscape-generator.ts

import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'

// ── MOOD MODIFIERS ────────────────────────────────────────────
const MOODS: Record<string, string> = {
  golden:   'MOOD: Warm golden light — the color of late afternoon sun, nostalgic and soft. Everything glows with warmth and memory.',
  dramatic: 'MOOD: Wild and dramatic — stormy sky, moody atmosphere, weather and raw natural power. Deep contrast, rich shadow, rolling clouds or shafts of storm light. The scene has weight and intensity.',
  peaceful: 'MOOD: Peaceful dawn — first light just breaking, mist still present, the world quiet and still. Contemplative and serene.',
  vivid:    'MOOD: Bright and vivid — peak midday clarity, saturated colors, joyful and energetic. The scene at its most alive.',
}

// ── PRESENTATION STYLES ───────────────────────────────────────
const PRESENTATIONS: Record<string, string> = {
  insitu:     '', // environment description from analyze handles this
  museum:     `PRESENTATION: Museum product photograph — the diorama sits OPEN on a walnut desk, with a physically separate display sign staked into the ground behind it. NO ENCLOSURE, NO DOME, NO CIRCULAR BACKDROP.

CRITICAL — THE ENTIRE DIORAMA IS 3D SCULPTED MINIATURE, NOT A FLAT PICTURE:
The diorama is a fully THREE-DIMENSIONAL sculpted miniature from front to back — real tactile depth, real volume, real objects that cast real shadows.
The scene recedes into true physical depth via actual 3D elements — sculpted terrain, standing posts, carved pilings, formed water. Not a painting, not a print, not a photograph, not a flat image.

ABSOLUTELY NO:
- Flat photo panel, printed image, or 2D backdrop standing vertically on or behind the base
- A picture, card, or print propped up as the "scene" with a small 3D skirt in front
- Any vertical rectangular or flat surface with the scene rendered ON IT instead of sculpted AS it
- Any suggestion that the distant part of the scene is a painting or image while only the foreground is 3D

Every part of the scene — near and far, foreground and distant — must be fully sculpted 3D miniature. The distant hills are small sculpted hills. The distant sky is open air above the scene (or room bokeh beyond). If there's a horizon, it's the meeting of a real 3D ground surface with the ambient space above it, not a printed line on a panel.

CRITICAL — OPEN PRESENTATION, NO ENCLOSING SHAPE:
The diorama is an open physical miniature sitting flat on the desk surface with EMPTY AIR around it on all sides. The sky extends freely upward from the scene into the room's bokeh.
ABSOLUTELY NO:
- Glass dome, snowglobe, or hemispheric enclosure around the scene
- Circular or oval backdrop framing the scene
- Curved boundary cropping the scene's silhouette
- Any background shape that cuts into, hides, or frames the diorama
- Any implied half-circle or arch behind the diorama

The only circular element permitted is the wooden plinth base itself (viewed from above at an angle). Everything else is open, rectangular, or shapeless ambient room.
The sky and background behind the diorama is soft warm room bokeh — bookshelves and warm ambient light. Rectangular or amorphous, never circular, never domed, never enclosing.

ROOM AND ENVIRONMENT:
The diorama sits on a large dark walnut desk — book-matched grain, rich chocolate-brown with flowing figured streaks, deep satin finish. The grain is clearly visible and beautiful.
The desk surface has a strong mirror-like reflection of the diorama base — the walnut base and the lower part of the diorama reflect downward into the polished surface, doubled and slightly diffused.

PHYSICALLY SEPARATE DISPLAY SIGN — BEHIND THE DIORAMA:
A small, physically separate decorative display marker is staked or planted into the desk surface a few inches behind the diorama base — clearly a distinct physical object.
The sign is one of: a small circular brass plaque on a vertical rod, a small oval wooden placard on a wire stand, a miniature folded museum card on a tiny easel.
The sign is a RESPECTFUL accent — small, tasteful, clearly subordinate to the diorama. It does NOT dominate, overlap, or frame the diorama.

CRITICAL — THE DIORAMA IS NEVER CLIPPED OR OVERLAPPED BY THE SIGN OR ANY OTHER BACKGROUND ELEMENT:
Every part of the diorama is fully visible, no part cropped, hidden, or cut off by any background shape, frame, sign, or object.
The sign sits strictly BEHIND the diorama in depth, not overlapping it visually, and NEVER cuts into the diorama's silhouette.

LIGHTING:
A large window to one side fills the room with warm afternoon light — primary light source. Soft directional key light rakes across the diorama, catching textures and casting gentle shadows to the opposite side. Warm neutral color temperature.
In the far corner of the room, a small antique brass lamp with a silk shade glows warmly — accent only, does not light the diorama directly.

ROOM BACKDROP:
The room beyond is a warm study — bookshelves softly out of focus, framed paintings on the wall, the edge of a chair visible. Everything behind the desk is in soft warm bokeh, clearly a real room but subordinate to the diorama. Rectangular room features only, no circular or domed suggestion of any kind.

DESK PROPS (SUBTLE):
A hardcover book lies open to the left of the diorama. Reading glasses rest to the right on the desk surface. Both are slightly out of focus — they frame the diorama as a cherished object on a well-used desk.

FEEL:
An open, clean display of a prized miniature on a collector's desk, labeled with a small physical display marker. Lived-in, treasured, museum-quality. Like a curator's reference specimen sitting on a working desk — never encapsulated, never enclosed.`,
  collectable_card: '', // handled by generateCollectableCard() — not a normal prompt preset
  cinematic:  `PRESENTATION: Cinematic hero shot — the diorama staged as a richly lit dramatic movie-poster subject.

BACKDROP:
A rich MID-TONE atmospheric gradient — deeper tones at the edges, lifting to a soft warm glow directly behind the diorama. The backdrop is moody but NOT dark, NOT underexposed, NOT crushed. Think "theatrical stage with full stage lighting" rather than "shadowy void" — midtone warm greys, soft purples, amber, or deep earth tones, clearly readable throughout.

LIGHTING — BRIGHT DRAMATIC, NOT DIM DRAMATIC:
Strong directional key light from above or side creates pronounced highlights and sculptural shadows on the diorama. Ambient fill is LIFTED — shadows read as dimensional and detailed, never crushed to black. The diorama itself is brightly and richly lit; the lighting is dramatic through contrast and direction, not through dimness. High dynamic range with full detail visible in both highlights and shadows.

SHARPNESS — NON-NEGOTIABLE:
Every element of the diorama must be rendered with CRISP, PHOTOGRAPHIC SHARPNESS — not painterly, not soft, not atmospheric-blurred.
- Individual pier pilings, lamp posts, pebbles, blades of grass, water ripples all have hard crisp edges
- Material textures (wood grain, stone, sand, water) are sharp enough to read at close inspection
- NO painterly brush-feel, NO impressionistic softening, NO watercolor atmosphere
- The dramatic mood comes from LIGHT and SHADOW only — NEVER from blur or soft focus
- Hyperreal, detailed, photographically sharp — a cinematic hero shot of a physical object

SURFACE AROUND BASE:
Darker tonal surface — deep warm bronze, rich dark stone, or moody textured fabric — but clearly visible and lit by spill from the key light. Reads as substantial material surface, not absent void.

BOUNDARY:
The base rim remains a sharp visual break. On the base: richly lit, high saturation, dramatic highlight/shadow sculpting. Off the base: mid-tone moody surround, still clearly visible and lit.
The base casts a long dramatic shadow on the surface beneath it.

FEEL:
Heroic theatrical presentation — the diorama is the star under full stage lighting. Dramatic and luminous, sharp and detailed throughout.`,
}

export async function generateLandscape(input: {
  sourceImageB64:         string
  extraImages?:           string[]
  sceneDescription?:      string   // free-form GPT-4o description of the place
  viewingDirection?:      string   // which side of the subject the viewer is on
  environmentSurface?:    string   // just the ground material
  environmentAtmosphere?: string   // just sky/weather/light
  characterSource?:       'object' | 'atmosphere'
  distinctiveFeatures?:   string   // comma-separated specific features to preserve
  displayName?:           string
  mood?:                  string
  presentation?:          string
  scaleFeel?:             string
  notes?:                 string
  openaiApiKey:           string
}): Promise<{ imageB64: string; promptUsed: string }> {

  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const mood      = MOODS[input.mood || 'golden'] || MOODS.golden
  const presRaw   = PRESENTATIONS[input.presentation || 'insitu'] || ''
  const sceneDesc = input.sceneDescription || 'A beautiful natural place with unique character and atmosphere.'
  const surface   = input.environmentSurface    || 'neutral natural ground appropriate to the scene'
  const sky       = input.environmentAtmosphere || 'softly diffused sky with gentle ambient light'
  const atmosphereForward = input.characterSource === 'atmosphere'
  const pres      = presRaw.replace('__SCENE_DESCRIPTION__', sceneDesc)

  // Environment block — in-situ is: diorama on extended matching-material ground, with a soft gradient sky above.
  const envBlock = (!input.presentation || input.presentation === 'insitu')
    ? `ENVIRONMENT — DIORAMA ON A GROUND STAGE OF MATCHING MATERIAL, BENEATH A SOFT GRADIENT SKY:

GROUND ZONE (the entire lower portion of the frame — from foreground up to the horizon line):
The diorama sits on a continuous extended surface made of the SAME material as its terrain — if the base shows sand, the surround IS sand; if grass, grass; if forest floor, the same forest floor continues outward; if stone, the same stone; if shoreline, matching wet sand or pebbles.
Tactile physical dimension across the full ground zone — individual grains, blades, pebbles, tufts, ripples, crumbs. The material should read as sinkable and touchable anywhere you look, not just near the base.

SHARPNESS DISTINCTION — CRITICAL:
THE DIORAMA ITSELF (the scene on the base, including front edge, back edge, and everything in between) IS RAZOR SHARP FROM EDGE TO EDGE. Every pier piling, every lamp post, every blade of grass, every pebble on the diorama — front and back — is fully in focus.
ONLY the ground stage AROUND and BEYOND the base (the matching ground material extending outside the base rim into the surrounding frame) softens with distance via photographic depth of field.
DoF applies to: the extended ground surround, the sky gradient, the horizon.
DoF does NOT apply to: anything on the diorama itself. The back edge of the base, the far end of a receding pier, the rear of the scene — all razor sharp.

The ground zone reaches naturally to a soft distant horizon line roughly 40-45% up the frame.

SKY ZONE (everything above the horizon line — the upper portion of the frame):
A soft atmospheric gradient — gentle color transition from horizon upward, matching the tonal mood of the scene (warm amber-to-peach for golden mood, cool grey-to-blue for peaceful, moody greyish-purple for dramatic, clear bright blue fade for vivid).
NO defined clouds, NO mountains, NO trees, NO distant buildings, NO horizon features, NO scene duplicates — only soft gradient color and atmospheric tone.
The sky is blurred and slightly desaturated compared to the diorama, subordinate but present.

HIERARCHY:
The diorama itself: fully sharp, fully saturated, fully rendered, edge to edge.
The ground stage around and beyond the base: tactilely 3D but softer with distance from DoF.
The sky gradient: softest element.

BOUNDARY:
The base rim is a sharp visual break. On the base: crisp, miniature, fully saturated. Off the base: same material extended with photographic softness, meeting a gradient sky above.
The base casts a clear shadow on the surface beneath it.

NO PHOTO CARDS OR BACKDROP PLANES:
No rectangular card edges, no printed backdrop planes, no scene duplicates, nothing vertical behind the diorama except the atmospheric sky gradient.`
    : pres

  // Camera block — per-preset foreshortening behavior
  const cameraBlock = input.presentation === 'cinematic'
    ? `CAMERA — CINEMATIC FORESHORTENING (STRONG):
Camera 35-45 degrees elevated, angled down at the diorama — look-down angle, NOT low-angle.
WIDE-ANGLE lens perspective creates STRONG FORESHORTENING throughout the frame:
- The nearest edge of the base and near elements loom LARGE, thrust forward toward the viewer
- Far elements compress and recede rapidly into the distance
- Near-far scale contrast is exaggerated — closest sand, rocks, or surfaces appear visibly larger than equivalent far-side elements
- Linear subjects (piers, paths, bridges) benefit strongly — they race into the distance and feel epic in scale
Hero shot framing. Maximum dramatic depth from the lens, not from physical truncation.`
    : input.presentation === 'museum'
    ? `CAMERA — STANDARD MUSEUM PRODUCT SHOT:
Camera 30-40 degrees elevated, angled down at the diorama.
Medium-format macro lens equivalent. Natural perspective — minimal foreshortening distortion.
Pulled back far enough to show the full base with generous surrounding space.
Straightforward, refined, editorial product photography — the diorama is presented cleanly.`
    : `CAMERA — IN-SITU WITH MILD FORCED PERSPECTIVE:
Camera 35-45 degrees elevated, angled down at the diorama.
Standard focal length with a SUBTLE wide-angle feel — just enough perspective to give linear subjects (piers, paths, bridges, coastlines) a convincing sense of extending into the distance via forced perspective.
The foreshortening is MILD, not dramatic — think "natural documentary photography" rather than "cinematic hero shot." Linear features recede gracefully.
Pulled back far enough to show the full base with surrounding space.`

  // Scale + distance tuning — how to fit content-rich scenes without cropping
  const scaleTuningBlock = `SCALE & DISTANCE TUNING — FIT ALL CONTENT WITHOUT CROPPING:

If the scene is content-rich (many distinctive features, extended linear elements, or multiple zones of interest), do NOT crop content or violate margin rules to fit it. Instead, use the macro-photographer's technique:

1. SHRINK THE ENTIRE MINIATURE physically smaller on its base — the whole scene scales down proportionally so every feature fits within the base perimeter with comfortable spacing. A pier that would otherwise overflow the base becomes a smaller-scale pier; a field with distant hills becomes a smaller field with smaller hills.

2. MOVE THE CAMERA CLOSER to the miniature and use a WIDER ANGLE LENS (think 24-35mm equivalent rather than 85mm). The close-in wide-angle camera compensates for the smaller subject — the foreground still looms large and feels immediate, while the wider field of view captures all the background features at once.

Net effect: all scene content visible, foreground feels close and prominent, no cropping, margins still respected.

WHEN TO APPLY:
- Scene has 3+ distinct zones (foreground + midground + distant features)
- Distinctive features list contains multiple items that all need to appear
- Scene has a long linear element PLUS additional features (e.g. a path AND a pond AND distant hills)
- Any time you would otherwise have to crop content or shrink margins to fit everything

WHEN NOT TO APPLY:
- Single-subject scenes with minimal background (pier alone at sea, single rock formation, solo tree)
- Scenes where the subject is meant to dominate dramatically

CRITICAL — THIS IS ONLY A CAMERA-AND-SCALE TECHNIQUE, NOT A STYLIZATION:
The miniature is still fully 3D sculpted throughout. The diorama is still razor-sharp edge to edge. The base still has full margins. The only thing changing is the physical scale of the miniature contents and the camera's lens choice and distance. Everything else about the presentation stays identical.`

  const prompt = [
    `Transform the provided image into a physically realistic miniature diorama presented as a professional product photograph.`,
    `CORE:
Reconstruct the scene as a handcrafted physical miniature.
Preserve the spatial layout, proportions, atmosphere, and defining features of this specific place exactly.
Do not reinterpret or redesign the scene. Capture what makes this place unique.`,
    `STRUCTURE PRESERVATION:
Maintain major lines, horizon placement, and object relationships from the source.
Preserve repeating elements and spacing patterns exactly.
Keep perspective, orientation, and the unique character of this specific place.`,
    `THIS SPECIFIC PLACE IS:\n${sceneDesc}`,
    input.distinctiveFeatures ? `DISTINCTIVE FEATURES — MUST BE PRESERVED (NON-NEGOTIABLE):
The following specific features are present in the source photograph and define what makes this place that place. Each one MUST appear in the final miniature — do not drop, simplify, or omit any of them:

${input.distinctiveFeatures}

If a feature is listed here, it exists in the source and must be rendered as a clearly visible 3D miniature element. Missing even one of these features makes the diorama feel wrong — it becomes a generic version of the place rather than THIS specific place.

Common failure mode to avoid: dropping secondary features (ponds, outbuildings, specific tree clusters, distant landmarks, signs, benches) in favor of rendering only the "obvious" main subject. The secondary features are what make the place personal and specific. Keep all of them.` : '',
    input.viewingDirection ? `VIEWING DIRECTION — CRITICAL CAMERA ORIENTATION:
The viewer is positioned relative to the subject exactly as described below. This defines which side of the subject faces the camera, where the light source is positioned relative to the viewer, and the orientation of the scene in frame. Do NOT flip, mirror, or rotate the viewing angle. Match the source photograph's camera position.

${input.viewingDirection}

If the source shows the sun behind the subject (silhouette), the sun stays behind the subject in the miniature rendering.
If the source shows the subject from its left side, render the miniature from its left side.
Orientation fidelity is mandatory.` : '',
    `MATERIAL CONVERSION — convert all elements into physical miniature materials:
- Rock, stone, cave walls, architecture → sculpted and painted resin with authentic texture
- Ground, sand, soil, floor → textured terrain materials at correct scale
- Water, pools, sea → translucent resin with realistic surface detail, depth, and light interaction
- Vegetation → precision miniature foliage, moss, plants at correct scale
- Structural elements, furniture, fixtures → painted wood and resin at scale
- Atmospheric light (shafts, glows, reflections) → recreated as physical miniature lighting effects`,
    `MATERIAL DEPTH — TACTILE THICKNESS OF THE MINIATURE TERRAIN:
Every surface material ON the diorama (the miniature world on top of the base) has visible physical THICKNESS and tactile depth. Materials must never read as a flat painted-on layer or a surface decal.
- Sand: a deep sandy layer with visible grain, soft drifts, subtle ripples — the kind you could sink your toes into
- Water: true translucent depth with visible bottom shading, partially submerged rocks or debris, meniscus at edges — not a painted-on surface
- Grass / moss: individual blade or tuft height, layered density, clearly 3D at edges where it meets other materials
- Soil / dirt: crumbly texture with small pebbles, twigs, subtle undulation and small mounds
- Snow: fresh-fallen softness with drifts and depth, not a white coating on a flat surface
- Stone / rock: chunky irregular volumes with visible crevices, chips, and moss tucked into cracks
The viewer should feel they could press a thumb into any material on the diorama and leave an imprint.`,
    mood,
    input.notes ? `ADDITIONAL NOTES FROM THE PERSON WHO LOVES THIS PLACE:\n${input.notes}` : '',
    `DIORAMA BASE — CONTAINMENT WITH FORCED PERSPECTIVE ALLOWED:
Circular dark walnut display plinth with a thick, heavy, turned-wood rim clearly visible on all sides.
The miniature is a discrete physical object sitting ON TOP of this base — all physical miniature elements terminate at the base perimeter.

TWO KINDS OF LINEAR SUBJECTS — HANDLE DIFFERENTLY:

WRAPPING SUBJECTS (bend to fit the base perimeter):
- Coastlines, ridgelines, riverbanks, treelines, low walls that run parallel to the viewer
- These features curve naturally to follow the round base edge
- Nothing crosses the base rim

RECEDING SUBJECTS (use forced perspective, preserve full linear extent visually):
- Piers, bridges, boardwalks, paths, roads, jetties, alleyways extending AWAY from the viewer into the distance
- These features use FORCED PERSPECTIVE (camera angle creating visual foreshortening) rather than physical compression
- The subject should LOOK like it extends far into the distance even though it must terminate at the base edge
- Its endpoint at the far rim should recede into the distance via perspective, getting smaller as it goes — not be chopped off short
- A pier going out to sea must APPEAR to extend a long way out via camera foreshortening; it should NOT look truncated or stubby
- Preserve the full visual sense of linear extent even though the physical endpoint sits at the base rim

The base rim is a physical boundary for the miniature's materials, not a visual truncation of the scene's apparent depth.
The base casts a clear shadow on the surface beneath it, reinforcing that it is a self-contained object placed on a larger world.`,
    `COMPOSITION — MARGINS ARE MANDATORY AND NON-NEGOTIABLE:

ABSOLUTE RULE (do not violate under any circumstances):
The base NEVER touches the left, right, top, or bottom edge of the image frame.
Minimum 15% clear breathing room on EVERY SIDE — left, right, top, bottom. The entire base rim is fully visible with empty surround on all four sides.
If the diorama's scene has receding elements (pier, path, bridge) going into the distance, those elements recede via CAMERA PERSPECTIVE only — the physical base still terminates well within the frame with full margin visible on all sides.
The base occupies approximately 60-65% of the image width — NOT more. NEVER more than 70%.

If you cannot fit the scene while respecting these margins, pull the camera back further. Pull back as much as needed. The margins override any sense of "filling the frame."

Failure mode to avoid:
- Base touching or exceeding the right/left/top/bottom frame edge
- Water, sand, or terrain extending off-frame past where the base ends
- Any portion of the base rim being clipped by the frame`,
    cameraBlock,
    scaleTuningBlock,
    envBlock,
    `PHOTOGRAPHIC REALISM — THIS IS A PHOTOGRAPH OF A REAL OBJECT, NOT A RENDER:

LIGHTING (photographic, not studio-render):
Single softbox key light from upper-left at approximately 45 degrees above horizontal. Fill ratio 1:4 — shadow side clearly darker but detail preserved.
Subtle warm rim light catches the right edge and top of the subject, separating it from background.
Noticeable light falloff into shadow — not flat even illumination. Slight color temperature drift across the frame (warmer toward key, cooler toward shadow).
Shadows are soft-edged but present and directional — never absent, never sharp.
Small specular hits on glossy materials where light catches micro-geometry — these hits are imperfect and uneven, catching some details and missing others.

MATERIAL MICRO-DETAIL (handmade, not CGI-perfect):
This miniature has subtle handmade imperfections that signal its handcrafted nature:
- Micro paint pooling in recessed corners where a painter's brush lingered
- Irregular gloss patches — some surfaces slightly glossier than adjacent ones in a non-systematic way
- Occasional tiny dust specks in deep crevices
- Hand-applied tool marks visible on resin and wood surfaces under raking light
- Fine brush strokes visible on painted areas at close inspection
- One or two micro chips or edge wear points on rim or high-traffic edges
NEVER perfectly uniform. The imperfections are small and premium — this is master craftsmanship, not sloppy work. But the surface tells you a human made it.

ENVIRONMENTAL GROUNDING (real space, not backdrop):
The desk surface has fine grain, visible wood pores, and occasional tiny dust motes catching the raking light near the base.
Warm ambient color bounce from out-of-frame objects tints the shadow side of the subject subtly — this is reflected light from a real room, not a neutral studio infinity.
Faint airborne dust or soft particles may be visible in the lit atmosphere, very subtle.
A suggestion of out-of-focus environment behind (soft shapes, gentle color fields) implies the diorama exists in a real room with depth, not floating in a void.

LENS AND FOCUS (real camera, not perfect CG):
Shot on medium-format digital with an 85-110mm macro equivalent.
CRITICAL — THE ENTIRE DIORAMA IS RAZOR SHARP FROM EDGE TO EDGE: the front of the base, the middle of the scene, and the back of the base are ALL in crisp focus. Every detail on the physical miniature — front, back, left, right — is clearly readable and sharp. The diorama is a three-dimensional physical object and every surface of that object must be fully in focus.
Depth of field applies ONLY to the scene BEYOND the diorama — the room, the desk, the surrounding ambient space behind and around the base softens with distance. Not the diorama itself, never the diorama itself.

FAILURE MODE TO AVOID (this is what I keep seeing and it is WRONG):
The far end of the pier fading into soft blur. The back lamp posts going fuzzy. Sky haze creeping onto the diorama sky. The back rim of the base going soft. ANY portion of the physical miniature rendered with reduced sharpness.
EVERY element physically attached to the base — including the far-most lamp post, the furthest piling, the back rim of the base, the far water edge on the base — must be rendered at the SAME sharpness as the nearest front element. No falloff. No gradient of focus. No "atmospheric softening" on the diorama itself.

The only things allowed to blur are: the room behind the diorama, the desk surface extending behind the base, ambient air/light behind the scene, a sky gradient that is clearly SKY (not part of the miniature).

Background blur follows optical physics with hexagonal bokeh shapes on any specular highlights in the room behind.
Very slight chromatic aberration on the brightest specular highlights (thin color fringe, barely perceptible) — the tell of a real lens.
No digital perfection — the image has the subtle imperfections of real photography, but the diorama itself is always in full sharp focus.

COLOR SCIENCE (film-adjacent, not digital-vivid):
Subdued natural color palette with rich shadow detail. Lifted blacks rather than crushed shadows.
Natural contrast curve — skin tones of any figures warm and believable, no digital neon in highlights.
Slight film-adjacent color grading: warmer shadows, slightly cooler highlights, overall midtone warmth.
NEVER oversaturated. NEVER clinical-clean. This reads as a capture of the physical world.

OVERALL:
Must look like a genuinely handcrafted physical miniature photographed by a master product photographer — not a CG render of a miniature.
Museum-quality craftsmanship, premium editorial photography. The viewer should momentarily wonder if this is a real miniature.`,
  ].filter(Boolean).join('\n\n')

  // Prepare source image with brightness normalization
  const srcBuf = Buffer.from(input.sourceImageB64, 'base64')
  const bright = (await sharp(srcBuf).greyscale().stats()).channels[0].mean
  const lift   = bright < 165 ? Math.min(165 / bright, 2.0) : 1.0
  const prepared = lift > 1.0
    ? await sharp(srcBuf).modulate({ brightness: lift }).png().toBuffer()
    : srcBuf

  const file = await toFile(prepared, 'source.png', { type: 'image/png' })
  const res  = await openai.images.edit({
    model: 'gpt-image-1',
    image: file,
    prompt,
    size:  '1024x1024',
  })

  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('landscape_generation_failed')

  console.log(`[landscape] ${input.displayName || 'scene'} / ${input.mood || 'golden'} / ${input.presentation || 'insitu'} — done`)
  return { imageB64: b64, promptUsed: prompt }
}

// ── COLLECTABLE CARD ──────────────────────────────────────────
// Two-image preset: AI-generated hero front + code-built info back.
// Returns both as base64; landscape-route forwards both to frontend.

const CARD_W = 1024
const CARD_H = 1536  // 2:3 portrait — closest gpt-image-1 size to 5:7 playing card

// Simple word-wrap for SVG text rendering
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxCharsPerLine) {
      if (line) lines.push(line)
      line = w
    } else {
      line = (line ? line + ' ' : '') + w
    }
  }
  if (line) lines.push(line)
  return lines
}

function escapeSvgText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

type CardArtworkStyle = 'artwork' | 'miniature'

async function buildCardFront(input: {
  sourceImageB64:       string
  sceneDesc:            string
  viewingDirection?:    string
  distinctiveFeatures?: string
  displayName:          string
  mood:                 string
  artworkStyle:         CardArtworkStyle
  openaiApiKey:         string
}): Promise<string> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  const moodHint = MOODS[input.mood] || MOODS.golden

  // Scene block varies by artwork style — "artwork" is painted illustration,
  // "miniature" is hyperrealistic photograph of the SCENE ITSELF (no plinth inside the card).
  const sceneBlock = input.artworkStyle === 'miniature'
    ? `SCENE ON THE CARD — HYPERREALISTIC PHOTOGRAPH OF THE SCENE ITSELF, ELEVATED WITH EDITORIAL STYLIZATION:

CRITICAL — READ CAREFULLY:
The image on this card is a HYPERREALISTIC PHOTOGRAPH of this specific place: ${input.sceneDesc}
The aesthetic is photorealistic BUT stylized — "hyperreal" in the sense of heightened, cinematically elevated reality. Think the cinematic polish of a collectable art card from a premium trading card set: real-looking enough to step into, but more dramatic, more saturated, more composed than a snapshot.

DO NOT INCLUDE A DIORAMA PLINTH OR BASE INSIDE THE CARD:
This card artwork is the SCENE itself — not a miniature-on-a-plinth product shot. There is no turned-wood base, no circular platform, no diorama-on-display visible inside the card frame. The scene fills the card frame naturally as though photographed in the real world.
The foil border is the only frame. The artwork inside is a pure photographic scene, not a product photo of a miniature.

AESTHETIC — HYPERREAL BUT ELEVATED:
- Razor-sharp detail throughout — every pier piling, every lamp post, every ripple on the water, every grain of sand reads as a real photograph
- Saturated but natural color with strong cinematic color grading — elevated reality, rich blacks, lifted warmth, luminous highlights
- Bold dramatic lighting — strong directional light with pronounced rim light, backlight, or atmospheric glow
- Light catches subjects in a way that feels cinematic — sun flares, god rays, wet surface reflections, atmospheric haze
- Depth and dimension via real atmospheric perspective plus slightly heightened contrast between near and far
- NO brushstrokes, NO painterly softening, NO illustrated quality — but YES to dramatic editorial polish
- The scene should feel like a film still from a Malick or Deakins-shot movie: photographic, elevated, emotionally weighted

EXAMPLES OF THE RIGHT AESTHETIC:
- A National Geographic cover photograph with the drama turned up
- A cinematic film still (Roger Deakins, Emmanuel Lubezki)
- A premium collectable trading card's photorealistic art (Topps Chrome, Panini Spectra nature/travel series)
- A high-end travel ad where the photo looks almost too good to be real

EXAMPLES OF WHAT TO AVOID:
- Any painterly, illustrated, or drawn quality
- Soft-focus atmospheric painting
- Cartoon or stylized-as-in-simplified artwork (we want stylized-as-in-cinematically-heightened)
- Product photography of a physical miniature (the miniature-with-plinth aesthetic — that belongs in In Situ, NOT here)
- A flat documentary snapshot — too ordinary, needs drama`

    : `SCENE ON THE CARD — PAINTED ARTWORK:
A richly painted illustration of this specific place: ${input.sceneDesc}
Painterly quality — think high-end art card illustration or classical landscape painting. Rich brushwork, expressive color, artistic interpretation. Full saturation, strong light, the scene is the subject.
This is artwork, not a photograph — stylized but rooted in the specific character of this place.`

  const prompt = [
    `COLLECTABLE CARD FRONT — PREMIUM TRADING-CARD, PORTRAIT ORIENTATION.`,

    `This is the front face of a high-end collectable card, like a limited-edition art card from a premium set. Fill the entire image frame with the card front — NO desk, NO background beyond the card itself, NO shadows of the card on a surface. The image IS the card face, edge to edge. The card itself is flat and printable.`,

    sceneBlock,

    input.distinctiveFeatures ? `DISTINCTIVE FEATURES — MUST APPEAR (NON-NEGOTIABLE):
The following specific features from the source photograph define this place. Each one must be clearly visible in the card artwork:

${input.distinctiveFeatures}

Do not simplify to a generic version of the place type. The listed features are what makes this place personal and specific — keep all of them visible.` : '',

    input.viewingDirection ? `VIEWING DIRECTION — CRITICAL CAMERA ORIENTATION:
The scene is captured from this exact viewpoint: ${input.viewingDirection}
Do NOT flip, mirror, or rotate the viewing angle. Match the source photograph's orientation.` : '',

    moodHint,

    `FRAME-BREAKING & PROJECTION (KEY STYLIZATION — MANDATORY):

Popular collectable cards (Pokémon holographic, Magic the Gathering mythic rare, Panini Spectra, premium tarot art cards) use dramatic FRAME-BREAKING to create a "projecting into the viewer's space" effect. Art elements punch past the foil border at specific points, sometimes continuing off the card edge entirely as if thrust forward.

REQUIRED: At least TWO of the following frame-breaking elements must appear, chosen based on subject:
- A foreground element (wave crest, sand spray, foliage, rock) extends OVER the bottom foil border and may even run off the bottom edge of the card entirely — as if splashing out of the card toward the viewer
- A vertical structural element (lamp post, pier piling, tree, column) extends UP over the top foil border into the sky zone, projecting past the frame
- A side element (branch, structure, bird, wave) extends past the LEFT or RIGHT foil border
- An element may PROJECT AND CUT OFF — extending past the foil border AND off the card edge, creating the sense of dimensional projection out of the card plane

The foil border is partially OBSCURED by the projecting elements — the element crosses OVER the foil gold, not behind it. The foil appears interrupted at those points, sometimes with small shadow underneath suggesting the element is physically above the frame plane.

STYLE INTENSITY:
Not subtle. Not timid. This is the main visual hook of the card. Dramatic, confident projection. If a pier is the subject, make a lamp post arc past the top frame AND let wet sand or wave foam spill past the bottom. If a forest, let a branch sweep past the top AND roots or ferns project past the bottom. Every subject has at least two projection opportunities — find them and commit.

EXAMPLES FOR COMMON SUBJECTS:
- Pier/boardwalk: lamp post breaks top, wave foam or pier piling breaks bottom, railing may extend past side
- Beach/coast: a cresting wave breaks bottom, a gull silhouette or driftwood breaks top
- Forest: a branch breaks top, fern fronds or exposed roots break bottom
- Mountain: a cloud wisp breaks top, a boulder breaks bottom
- Urban: a lamp post or sign post breaks top, a curb or figure breaks bottom
- Architecture: a spire or weathervane breaks top, garden hedge or walkway breaks bottom

FAILURE MODE TO AVOID:
A clean rectangular card with a clean foil border and the art neatly contained inside is WRONG. That reads as a poster, not a collectable card. Frame-breaking is the single most important style element.`,

    `TITLE TREATMENT:
Near the bottom of the card (in the lower 15% of the frame), display the place name in a clean elegant serif typeface, centered or slightly left-aligned: "${input.displayName}"
The title is small and refined — about 40-55 pixels tall — not dominant. It sits within a small clean typographic block or plate that the border-breaking elements do not overlap.`,

    `CARD MATERIAL FEEL:
Satin-finish card stock with subtle sheen. Premium print quality — crisp edges, rich color. No visible physical card thickness or shadow (this is a straight-on frontal view of the card face, not a product shot of a card on a desk).`,

    `COMPOSITION:
Portrait orientation. The artwork fills the card. Margins inside the foil border: roughly 8-12%. Do not show any surface or environment outside the card — the image is the card, nothing else.`,
  ].filter(Boolean).join('\n\n')

  const srcBuf = Buffer.from(input.sourceImageB64, 'base64')
  const bright = (await sharp(srcBuf).greyscale().stats()).channels[0].mean
  const lift   = bright < 165 ? Math.min(165 / bright, 2.0) : 1.0
  const prepared = lift > 1.0
    ? await sharp(srcBuf).modulate({ brightness: lift }).png().toBuffer()
    : srcBuf

  const file = await toFile(prepared, 'source.png', { type: 'image/png' })
  const res = await openai.images.edit({
    model: 'gpt-image-1',
    image: file,
    prompt,
    size:  '1024x1536',
  })
  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('card_front_generation_failed')
  return b64
}

async function buildCardBack(input: {
  frontImageB64: string
  displayName:   string
  memoryText:    string
  plaqueText?:   string
}): Promise<string> {
  // ── Layout constants ──
  const pad         = 70       // outer padding from card edge to foil border
  const borderW     = 4        // foil border stroke width

  // Thumbnail — portrait rectangle mirroring the unbordered front artwork aspect
  const thumbTop    = 140
  const thumbW      = Math.round(CARD_W * 0.72)    // ~737 px
  const thumbH      = Math.round(thumbW * 1.33)    // portrait 3:4 — ~980 px
  const thumbLeft   = Math.round((CARD_W - thumbW) / 2)

  const titleY      = thumbTop + thumbH + 80       // title baseline below thumb
  const textTop     = titleY + 55                  // memory text block top

  // ── Prepare thumbnail from front image — trim the foil border margin ──
  // The front was generated with ~8% border on each side; trimming that yields the unbordered scene.
  const frontBuf = Buffer.from(input.frontImageB64, 'base64')
  const frontMeta = await sharp(frontBuf).metadata()
  const fw = frontMeta.width  ?? CARD_W
  const fh = frontMeta.height ?? CARD_H
  const trimRatio = 0.085  // matches "Margins inside the foil border: roughly 8-12%" in front prompt
  const cropX = Math.round(fw * trimRatio)
  const cropY = Math.round(fh * trimRatio)
  const cropW = fw - cropX * 2
  const cropH = fh - cropY * 2
  const thumbBuf = await sharp(frontBuf)
    .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
    .resize({ width: thumbW, height: thumbH, fit: 'cover' })
    .png()
    .toBuffer()

  // ── Thumbnail hairline frame ──
  const thumbBorderSvg = Buffer.from(`
    <svg width="${thumbW}" height="${thumbH}" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="${thumbW - 2}" height="${thumbH - 2}"
            fill="none" stroke="#8B6F3F" stroke-width="2" opacity="0.6"/>
    </svg>
  `)

  // ── Word-wrap memory text, build SVG ──
  const textLines   = wrapText(input.memoryText || '', 38)
  const lineHeight  = 54
  const titleText   = escapeSvgText(input.displayName || '')
  const bodyLinesSvg = textLines.map((ln, i) => `
    <text x="${CARD_W / 2}" y="${textTop + i * lineHeight}"
          text-anchor="middle"
          font-family="Georgia, 'Times New Roman', serif"
          font-size="38" font-style="italic" fill="#3A2818">${escapeSvgText(ln)}</text>
  `).join('')

  // ── Plaque block (optional) — sits above the MINISCAPE footer ──
  const plaqueText = (input.plaqueText || '').trim().slice(0, 40)
  const plaqueSvg  = plaqueText ? (() => {
    const pW = 520
    const pH = 78
    const pX = Math.round((CARD_W - pW) / 2)
    const pY = CARD_H - pad - 120
    const pr = 7
    const fs = Math.max(20, Math.min(34, Math.floor((pW * 0.92) / (plaqueText.length * 0.55))))
    return `
      <g transform="translate(${pX},${pY})">
        <defs>
          <linearGradient id="plaqueBronze" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"   stop-color="#8A6A3A"/>
            <stop offset="30%"  stop-color="#C49A5A"/>
            <stop offset="55%"  stop-color="#E4C48A"/>
            <stop offset="80%"  stop-color="#A07838"/>
            <stop offset="100%" stop-color="#5A3E1E"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${pW}" height="${pH}" rx="${pr}"
              fill="url(#plaqueBronze)" stroke="#3E2A12" stroke-width="1.2"/>
        <rect x="3" y="3" width="${pW - 6}" height="${pH - 6}" rx="${pr - 2}"
              fill="none" stroke="#FFF3C8" stroke-width="0.7" opacity="0.35"/>
        <text x="${pW / 2}" y="${pH / 2 + fs * 0.35}"
              text-anchor="middle"
              font-family="Georgia, 'Times New Roman', serif"
              font-size="${fs}" font-weight="500" fill="#2A1A0A"
              letter-spacing="1.5">${escapeSvgText(plaqueText)}</text>
      </g>
    `
  })() : ''

  // ── Full back card SVG: cream background + foil border + thumbnail slot + title + body + plaque + monogram ──
  const backSvg = Buffer.from(`
    <svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cream" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stop-color="#F5EEDE"/>
          <stop offset="100%" stop-color="#EBE1CC"/>
        </linearGradient>
        <linearGradient id="foil" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stop-color="#C9A45A"/>
          <stop offset="50%"  stop-color="#E8CC84"/>
          <stop offset="100%" stop-color="#9E7E3E"/>
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="${CARD_W}" height="${CARD_H}" fill="url(#cream)"/>

      <!-- Foil border -->
      <rect x="${pad}" y="${pad}"
            width="${CARD_W - pad * 2}" height="${CARD_H - pad * 2}"
            fill="none" stroke="url(#foil)" stroke-width="${borderW}"/>

      <!-- Inner decorative hairline -->
      <rect x="${pad + 18}" y="${pad + 18}"
            width="${CARD_W - (pad + 18) * 2}" height="${CARD_H - (pad + 18) * 2}"
            fill="none" stroke="#8B6F3F" stroke-width="1" opacity="0.35"/>

      <!-- Title -->
      <text x="${CARD_W / 2}" y="${titleY}"
            text-anchor="middle"
            font-family="Georgia, 'Times New Roman', serif"
            font-size="56" font-weight="400" fill="#2A1E10"
            letter-spacing="2">${titleText}</text>

      <!-- Thin rule under title -->
      <line x1="${CARD_W / 2 - 110}" y1="${titleY + 18}"
            x2="${CARD_W / 2 + 110}" y2="${titleY + 18}"
            stroke="url(#foil)" stroke-width="1.5"/>

      <!-- Memory body text -->
      ${bodyLinesSvg}

      <!-- Decorative plaque (optional) -->
      ${plaqueSvg}

      <!-- Bottom monogram/mark -->
      <text x="${CARD_W / 2}" y="${CARD_H - pad - 36}"
            text-anchor="middle"
            font-family="Georgia, 'Times New Roman', serif"
            font-size="20" letter-spacing="6" fill="#8B6F3F" opacity="0.7">MINISCAPE</text>
    </svg>
  `)

  // ── Composite: SVG background + thumbnail + thumbnail border ──
  const composed = await sharp(backSvg)
    .composite([
      { input: thumbBuf,       left: thumbLeft, top: thumbTop },
      { input: thumbBorderSvg, left: thumbLeft, top: thumbTop },
    ])
    .png({ quality: 95 })
    .toBuffer()

  return composed.toString('base64')
}

export async function generateCollectableCard(input: {
  sourceImageB64:       string
  sceneDesc:            string
  viewingDirection?:    string
  distinctiveFeatures?: string
  memoryText:           string
  displayName:          string
  mood:                 string
  plaqueText?:          string
  artworkStyle?:        CardArtworkStyle   // 'artwork' (painted) | 'miniature' (3D render)
  openaiApiKey:         string
}): Promise<{ frontB64: string; backB64: string }> {
  const style: CardArtworkStyle = input.artworkStyle || 'artwork'

  // Front (AI) first since back needs thumbnail from it
  const frontB64 = await buildCardFront({
    sourceImageB64:      input.sourceImageB64,
    sceneDesc:           input.sceneDesc,
    viewingDirection:    input.viewingDirection,
    distinctiveFeatures: input.distinctiveFeatures,
    displayName:         input.displayName,
    mood:                input.mood,
    artworkStyle:        style,
    openaiApiKey:        input.openaiApiKey,
  })

  const backB64 = await buildCardBack({
    frontImageB64: frontB64,
    displayName:   input.displayName,
    memoryText:    input.memoryText,
    plaqueText:    input.plaqueText,
  })

  console.log(`[landscape] collectable_card ${input.displayName} / ${style} — front + back done`)
  return { frontB64, backB64 }
}

