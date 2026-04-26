// landscape-generator.ts
// lib/v1/landscape-generator.ts

import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'

// ── MOOD MODIFIERS ────────────────────────────────────────────
const MOODS: Record<string, string> = {
  golden:   'MOOD: Warm golden light — the color of late afternoon sun, nostalgic and soft. Everything glows with warmth and memory.',
  dramatic: `MOOD: Dramatic — charged weather, intense directional light, emotionally weighted atmosphere. The diorama remains the hero; the drama lives in the world around it.

KEY LIGHT (ON THE DIORAMA):
One dominant light source — a sun shaft breaking through heavy cloud, a low golden rake, stormy backlight — falls directly on the primary subject. The subject is the BRIGHTEST, most fully lit element. Every detail of the diorama stays sharp and readable.

WEATHER + ATMOSPHERE (IN THE SURROUND, NEVER IN THE DIORAMA ITSELF):
Weather and atmospheric mood live BEYOND the diorama's base — in the softly-blurred world around and above the plinth or desk. Stormy cloud banks, moody haze, shafts of sun cutting through cloud, atmospheric light. These effects belong to the surround, not to the sculpted scene on the plinth.
Do NOT invade the diorama with weather. No storm clouds inside the miniature scene, no fog layered across the base, no atmospheric particulate on the sculpted elements themselves.

COLOR PALETTE:
Deep, saturated, weathered. Rich blues, purples, warm ambers, burnt siennas. High contrast with full tonal range preserved.

PLINTH CONTAINMENT (NON-NEGOTIABLE):
Dramatic mood is LIGHTING + SURROUND, not scene expansion. The diorama stays the same precious contained object it would be in Golden mood — same plinth prominence, same footprint, same compactness. Only the key light and the surrounding atmosphere change.
Do NOT pull the camera back for a vista. Do NOT expand the scene to fill more of the frame. Do NOT blur the plinth rim to hide it in atmosphere. The plinth stays a sharp discrete object; weather stays outside of it.`,
  peaceful: 'MOOD: Peaceful dawn — first light just breaking, mist still present, the world quiet and still. Contemplative and serene.',
  vivid:    'MOOD: Bright and vivid — peak midday clarity, saturated colors, joyful and energetic. The scene at its most alive.',
}

// ── PRESENTATION STYLES ───────────────────────────────────────
const PRESENTATIONS: Record<string, string> = {
  insitu:     '', // environment description from analyze handles this
  museum:     `PRESENTATION: Museum product photograph — the diorama sits OPEN on a walnut desk, with nothing propped up behind it. NO ENCLOSURE, NO DOME, NO CIRCULAR BACKDROP, NO SIGNBOARD.

CRITICAL — THE ENTIRE DIORAMA IS 3D SCULPTED MINIATURE, NOT A FLAT PICTURE:
The diorama is a fully THREE-DIMENSIONAL sculpted miniature from front to back — real tactile depth, real volume, real objects that cast real shadows.
The scene recedes into true physical depth via actual 3D elements — sculpted terrain, standing posts, carved pilings, formed water. Not a painting, not a print, not a photograph, not a flat image.

ABSOLUTELY NO:
- Flat photo panel, printed image, or 2D backdrop standing vertically on or behind the base
- A picture, card, or print propped up as the "scene" with a small 3D skirt in front
- Any vertical rectangular or flat surface with the scene rendered ON IT instead of sculpted AS it
- Any suggestion that the distant part of the scene is a painting or image while only the foreground is 3D

Every part of the scene — near and far, foreground and distant — must be fully sculpted 3D miniature. The distant hills are small sculpted hills. If there's a horizon, it's the meeting of a real 3D ground surface with ambient space above it, not a printed line on a panel.

CRITICAL — OPEN PRESENTATION, NO ENCLOSING SHAPE:
The diorama is an open physical miniature sitting flat on the desk surface with EMPTY AIR around it on all sides.
ABSOLUTELY NO:
- Glass dome, snowglobe, or hemispheric enclosure around the scene
- Circular or oval backdrop framing the scene
- Curved boundary cropping the scene's silhouette
- Any background shape that cuts into, hides, or frames the diorama
- Any implied half-circle or arch behind the diorama
- Any signboard, plaque, placard, easel, or display marker on or near the diorama
- A vertical disc, plate, or round panel standing upright with the scene rendered on its face — FORBIDDEN

THE DIORAMA IS TOP-DOWN-VIEWABLE:
The sculpted scene sits HORIZONTALLY on top of a horizontal plinth. The camera looks DOWN onto the scene from above and slightly in front. The diorama is a 3D object you could walk around and see from any angle — NOT a disc standing upright with the scene painted on its visible face. NOT a round display plate tilted toward the camera. The scene is horizontal, the plinth is horizontal, the camera looks down onto the scene.

The only circular element permitted is the wooden plinth base itself (viewed from above at an angle). Everything else is open, rectangular, or shapeless ambient room.
The background behind the diorama is soft warm room bokeh — bookshelves and warm ambient light. Rectangular or amorphous, never circular, never domed, never enclosing. Never a painted panel standing up.

HANDLING UNBOUNDED SKY — FLOATING 3D ATMOSPHERIC ELEMENTS:
If the scene naturally has an open sky with nothing to terminate it against (coastal vista, mountain overlook, open plain, beach, cityscape), DO NOT render a flat sky backdrop, painted sky panel, or curved vertical canvas to fill the space above the diorama. These are forbidden.

Instead, above the diorama's highest point, introduce ONE floating 3D atmospheric element that reads as physically present in the air above the scene — a miniature object suspended in space, not a painted image:
- A small sculpted cloud with real volume, shadows, and thickness, hovering softly over the scene
- A wisp of low-hanging mist or fog with three-dimensional shape and soft edges
- A drifting band of cotton-wool cloud with visible depth and underside shadow
- A single hovering bird or gull if contextually appropriate

This element is a PHYSICAL miniature atmospheric sculpture in space — it has dimensional volume, catches the room's lighting, casts a soft shadow on the diorama or desk beneath it, and reads as a hovering miniature, not a 2D shape stuck to a backdrop.
The element is tastefully small — it supports the scene, it does not overwhelm it. Positioned above and slightly to one side of the diorama, with clear air between it and the diorama below.
If the scene already has its own natural sky-terminator (tree canopy, rocky walls, dense buildings, overhanging foliage), no floating element is needed — the scene closes itself.

ROOM AND ENVIRONMENT:
The diorama sits on a large dark walnut desk — book-matched grain, rich chocolate-brown with flowing figured streaks, deep satin finish. The grain is clearly visible and beautiful.
The desk surface has a strong mirror-like reflection of the diorama base — the walnut base and the lower part of the diorama reflect downward into the polished surface, doubled and slightly diffused.

LIGHTING:
A large window to one side fills the room with warm afternoon light — primary light source. Soft directional key light rakes across the diorama, catching textures and casting gentle shadows to the opposite side. Warm neutral color temperature.
In the far corner of the room, a small antique brass lamp with a silk shade glows warmly — accent only, does not light the diorama directly.

ROOM BACKDROP:
The room beyond is a warm study — bookshelves softly out of focus, framed paintings on the wall, the edge of a chair visible. Everything behind the desk is in soft warm bokeh, clearly a real room but subordinate to the diorama. Rectangular room features only, no circular or domed suggestion of any kind.

DESK PROPS (SUBTLE):
A hardcover book lies open to the left of the diorama. Reading glasses rest to the right on the desk surface. Both are slightly out of focus — they frame the diorama as a cherished object on a well-used desk.

FEEL:
An open, clean display of a prized miniature on a collector's desk. Lived-in, treasured, museum-quality. Like a curator's reference specimen sitting on a working desk — never encapsulated, never enclosed, never labeled with a prop sign.`,
  collectable_card: '', // handled by generateCollectableCard() — not a normal prompt preset
}

export async function generateLandscape(input: {
  sourceImageB64:         string
  extraImages?:           string[]
  sceneDescription?:      string   // free-form GPT-4o description of the place
  viewingDirection?:      string   // which side of the subject the viewer is on
  environment?:           string   // "diorama sits on X. Background is blurred Y."
  characterSource?:       'object' | 'atmosphere'
  distinctiveFeatures?:   string   // comma-separated specific features to preserve
  primarySubject?:        string   // 1-3 word hero of the scene
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
  const environment = input.environment || 'The diorama sits on neutral natural ground appropriate to the scene. Background is blurred natural environment with soft atmospheric light.'
  const atmosphereForward = input.characterSource === 'atmosphere'
  const pres      = presRaw.replace('__SCENE_DESCRIPTION__', sceneDesc)

  // In-Situ: diorama as a small precious object sitting in a larger real environment.
  const envBlock = (!input.presentation || input.presentation === 'insitu')
    ? `ENVIRONMENT — DIORAMA AS A SMALL PRECIOUS OBJECT IN A LARGER REAL WORLD:

${environment}

THE RELATIONSHIP:
The diorama is a jewel-like miniature sitting IN a larger real environment — like a handcrafted curio discovered on a beach, in a forest, in a wetland, wherever this place is. The environment continues beyond the turned-wood plinth in every direction as soft atmospheric depth.

THE SURROUND — ZONES OF SOFT:
Near surround (immediately around the plinth): the same material the diorama sits on, in slightly soft focus. Continues naturally outward from the base with real physical texture — grains, pebbles, blades, tufts — at the correct scale for a full-size world, NOT at miniature scale.
Mid distance: environmental features of the same place type fade into softer focus — suggestions of trees, dunes, grass, water, rocks appropriate to the scene.
Far distance: dissolves to atmospheric gradient — color and light, no defined features.

REAL-WORLD SCALE DETAILS IN THE SURROUND (reinforce the miniature's smallness):
Scatter a few real-world-scale elements in the near surround around the plinth — things like a few pebbles, a scattered leaf, a footprint, a twig, a puddle, tufts of real grass. These are SIZED TO THE REAL WORLD, meaning they dwarf the miniature scene on the plinth by size contrast. A single real-world pebble near the plinth is as tall as a miniature tree on the plinth. This size contrast sells the miniature's scale.

THE PLINTH:
Turned dark walnut wood plinth, thick and decorative, clearly visible as a discrete object with its full circular rim showing. The plinth is proud and beautiful — it does NOT blend into the surround. The rim is a sharp visual seam between the sculpted miniature world on top and the raw real-world material around the base.

SHARPNESS:
The diorama itself is razor sharp edge to edge — front, middle, and back of the scene. The surround softens progressively with distance via depth of field. Only the immediate surround (right around the base) has moderate sharpness; mid and far surround get softer.

NO BACKDROP, NO PANEL, NO HORIZON LINE:
No flat card, no printed sheet, no rectangular back plane, no vertical backdrop of any kind behind the diorama. The background is atmospheric continuation of the environment into softness — not a defined horizon, not a drawn landscape, not a specific far-distance painting. Just progressive soft fade to color-and-light.`
    : pres

  // Camera block — per-preset framing
  const cameraBlock = input.presentation === 'museum'
    ? `CAMERA — STANDARD MUSEUM PRODUCT SHOT:
Camera 30-40 degrees elevated, angled down at the diorama.
Medium-format macro lens equivalent. Natural perspective — minimal foreshortening distortion.
Pulled back far enough to show the full base with generous surrounding space.
Straightforward, refined, editorial product photography — the diorama is presented cleanly.
The base occupies roughly 55-65% of the image width.`
    : `CAMERA — IN-SITU, LOW ANGLE, FOUND-OBJECT FRAMING:
Camera LOW — roughly eye level with the diorama or only slightly above (10-20 degrees above horizontal). NOT a look-down product shot. This is the angle you'd shoot a precious small object you came across on the ground.
Standard focal length with a subtle wide-angle feel — enough to give linear subjects (piers, paths, bridges, coastlines) a sense of extending into the distance.
The diorama sits in the LOWER HALF of the frame — the environment continues above and around it. The base occupies roughly 50-60% of the image width, NEVER more than 65%. Generous breathing room on all sides — especially above, where the atmospheric surround fades to color and light.
Framing feels like editorial miniature photography — the diorama captured as a found object in a real environment, not a clinical product shot.

THE LOW ANGLE DOES NOT MEAN SOFT FOCUS OR FLAT COMPOSITION:
The low angle is a framing choice, not a focus falloff choice. The diorama itself remains razor sharp edge to edge — every element on the base, front to back, fully in focus.
The low angle INTENSIFIES forced perspective on receding linear subjects (pier, path, bridge, road): the subject races into the distance MORE dramatically at low angle, not less. Use strong near-far scale contrast — near pilings large, far pilings small.
If the subject recedes, it recedes with force. If the subject wraps the base perimeter, it curves with clean sharpness. Never flatten, never let the subject run parallel to the frame edge.`

  const prompt = [
    `Transform the provided image into a physically realistic miniature diorama presented as a professional product photograph.`,
    `CORE:
Reconstruct the scene as a handcrafted physical miniature.
Preserve the spatial layout, proportions, atmosphere, and defining features of this specific place exactly.
Do not reinterpret or redesign the scene. Capture what makes this place unique.`,
    `SCALE COMPRESSION — MANDATORY (READ BEFORE ANYTHING ELSE):

This is a MINIATURE. Everything in the source photograph must be compressed and sculpted to fit entirely on the walnut plinth — a physical base roughly the size of a dinner plate.

The source may show a vast scene (valley, coastline, mountain range, cityscape, open plain, rolling hills). Regardless of the source's real-world scale, the entire sculpted diorama is a small handheld object sitting on a plinth.

HOW TO COMPRESS THE SOURCE:

- Vistas (coastline, valley, open plain, rolling hills, river): select a COMPACT REPRESENTATIVE SEGMENT — a curve of the river, a section of coastline, a bend of valley, a clump of hills. Sculpt THAT SEGMENT at miniature scale. The rest of the vista is implied only by the soft atmospheric surround BEYOND the plinth.
- Grand scale (mountain range, entire city, wide forest): render the entire feature as a tiny sculpted 3D form that fits on the plinth — like a tabletop architectural model. Mountains become small sculpted peaks. A city becomes a cluster of miniature buildings.
- Compact subjects (bridge, waterfall, building, pier, single landmark): these already fit naturally — sculpt at miniature scale as-is, no further compression needed.

HARD EDGE RULE:

The sculpted miniature has DEFINED BOUNDARIES that correspond to the plinth rim. The scene does NOT extend past the plinth. The scene does NOT continue onto the surround. The scene stops where the plinth stops. The plinth rim is a visible seam between the sculpted world on top and the real world around it.

FORBIDDEN:
- The source scene bleeding outside the plinth onto the surround
- The plinth functioning as a decorative underline beneath a full-frame painted scene
- The sculpted scene flattening onto a disc or painted face
- The source scene preserved in full without compression — "it's too big to fit" is NEVER an excuse; crop and compress aggressively
- The diorama becoming the entire image with the plinth as a decorative addition`,
    `THIS SPECIFIC PLACE IS:\n${sceneDesc}`,
    input.distinctiveFeatures ? `DISTINCTIVE FEATURES — MUST BE PRESERVED (NON-NEGOTIABLE):
The following specific features are present in the source photograph and define what makes this place that place. Each one MUST appear in the final miniature — do not drop, simplify, or omit any of them:

${input.distinctiveFeatures}

If a feature is listed here, it exists in the source and must be rendered as a clearly visible 3D miniature element. Missing even one of these features makes the diorama feel wrong — it becomes a generic version of the place rather than THIS specific place.

Common failure mode to avoid: dropping secondary features (ponds, outbuildings, specific tree clusters, distant landmarks, signs, benches) in favor of rendering only the "obvious" main subject. The secondary features are what make the place personal and specific. Keep all of them.` : '',
    input.primarySubject ? `SUBJECT PROMINENCE — THE SCENE HAS A HERO:

Primary subject: ${input.primarySubject}

The ${input.primarySubject} is the visual anchor of the diorama. Everything else — surround, sky, secondary features — supports it without competing.

COMPOSITION:
The ${input.primarySubject} occupies the visual center of the diorama — centered on the base, or anchored along a clean one-third/two-thirds split if linear. The foreground does not dominate; empty base surface does not push the ${input.primarySubject} to a back corner.

LIGHTING HIERARCHY:
The brightest, most dramatic tonal point in the entire image falls on or near the ${input.primarySubject}. If there is a sun, a glow, a reflection hotspot, a light source — place it on the ${input.primarySubject}. The sky and surround are paler and more muted than the ${input.primarySubject}'s brightest point. A surround that competes for attention flattens the composition.

FOCUS:
The ${input.primarySubject} is razor sharp — every part of it, front to back. Softening begins only in the surround beyond the base rim.

MATERIAL DEPTH:
If the ${input.primarySubject} involves water (pier in surf, waterfall, pond), render water with real translucent depth — submerged structure visible beneath the surface, meniscus at shore and around pilings, layered clarity showing bottom rocks or sand underneath the surface. Not a glossy skin.
If the ${input.primarySubject} is a linear receding subject (pier, path, bridge, road), it MUST recede into the distance via camera perspective — the far end clearly smaller than the near end. Do not render it flat, horizontal, or parallel to the frame.` : '',
    input.viewingDirection ? `VIEWING DIRECTION — CRITICAL CAMERA ORIENTATION:
The viewer is positioned relative to the subject exactly as described below. This defines which side of the subject faces the camera, where the light source is positioned relative to the viewer, and the orientation of the scene in frame. Do NOT flip, mirror, or rotate the viewing angle. Match the source photograph's camera position.

${input.viewingDirection}

If the source shows the sun behind the subject (silhouette), the sun stays behind the subject in the miniature rendering.
If the source shows the subject from its left side, render the miniature from its left side.
Orientation fidelity is mandatory.` : '',
    `MATERIAL CONVERSION — convert all elements into physical miniature materials:
- Rock, stone, architecture → sculpted and painted resin with authentic texture
- Ground, sand, soil → textured terrain materials at correct scale
- Water, pools, sea → translucent resin with realistic surface depth and light interaction
- Vegetation → precision miniature foliage, moss, plants at correct scale
- Structural elements, furniture → painted wood and resin at scale
- Atmospheric light (shafts, glows, reflections) → recreated as physical miniature lighting effects

Every material has visible physical THICKNESS, not flat painted layers. Sand has grain depth, grass has blade height, water has translucent depth, stone has chunky irregular volume.`,
    mood,
    input.notes ? `ADDITIONAL NOTES FROM THE PERSON WHO LOVES THIS PLACE:\n${input.notes}` : '',
    `DIORAMA BASE:
Circular dark walnut display plinth with a thick, heavy, turned-wood rim clearly visible on all sides.
All physical miniature elements terminate at the base perimeter.

LINEAR SUBJECTS — two kinds:
- WRAPPING subjects (coastlines, ridgelines, treelines parallel to the viewer): curve naturally to follow the round base edge.
- RECEDING subjects (piers, paths, bridges extending away from the viewer): use FORCED PERSPECTIVE — the subject appears to extend far into the distance via camera foreshortening, even though its physical endpoint sits at the base rim. It should LOOK like it extends into the distance, not appear truncated or stubby.

The base casts a clear shadow on the surface beneath it.`,
    `COMPOSITION — MARGINS:
The base never touches any edge of the image frame. Minimum 15% clear space on every side — left, right, top, bottom. The full base rim is visible with surrounding room on all four sides.
If the scene cannot fit within these margins, pull the camera back further. Margins override frame-filling.`,
    cameraBlock,
    envBlock,
    `PHOTOGRAPHIC REALISM — PHOTOGRAPH OF A REAL OBJECT, NOT A RENDER:

LIGHTING:
Soft directional key from upper-left around 45 degrees, 1:4 fill ratio — shadow side darker but detail preserved. Subtle warm rim on the right edge. Shadows soft-edged, directional, present. Small uneven specular hits on glossy surfaces.

MATERIAL FEEL:
Subtle handmade imperfections — minor paint pooling in recesses, slight gloss variation between adjacent surfaces, fine brush strokes on painted areas. Never CGI-uniform. This is premium craftsmanship with a human's hand visible.

LENS:
Medium-format macro equivalent. The diorama is fully in focus edge to edge — front, middle, and back all sharp. Background softens naturally behind the base (room, ambient air, sky) — never the diorama itself.
Subtle chromatic aberration on brightest speculars. Bokeh hexagonal where it appears.

COLOR:
Film-adjacent grading — lifted blacks, warm midtones, subdued natural palette. Never oversaturated, never clinical.

Overall: handcrafted miniature photographed by a master product photographer. The viewer should momentarily wonder if it's a real physical object.`,
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

type CardArtworkStyle = '3d' | 'impressionist'

async function buildCardFront(input: {
  sourceImageB64:       string
  sceneDesc:            string
  viewingDirection?:    string
  distinctiveFeatures?: string
  primarySubject?:      string
  mood:                 string
  artworkStyle:         CardArtworkStyle
  openaiApiKey:         string
}): Promise<string> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  const moodHint = MOODS[input.mood] || MOODS.golden

  // Scene block varies by artwork style.
  // "3d" — photorealistic 3D-rendered scene filling the card frame, NO plinth, NO base.
  // "impressionist" — painterly illustration, NO plinth, NO base.
  // In BOTH cases the card frame IS the bounding container. No diorama-on-display.
  const sceneBlock = input.artworkStyle === '3d'
    ? `SCENE ON THE CARD — PHOTOREALISTIC 3D RENDERING OF THE SCENE ITSELF:

The image on this card is a hyperrealistic photographic rendering of this specific place: ${input.sceneDesc}

The aesthetic is photorealistic but heightened — the polish of a cinematic film still, a premium nature photograph, or the cover of a high-end travel publication. Real-looking enough to step into, but more saturated, more luminous, more composed than a casual snapshot.

CRITICAL — THE CARD IS THE ONLY FRAME:
There is NO turned-wood plinth inside the card. NO circular base. NO miniature-on-a-plinth product shot. NO diorama-on-display visible anywhere. NO walnut rim. NO pedestal. NO real-world surround beyond the frame.
The foil card border IS the bounding container. The scene fills the entire artwork zone naturally, edge to edge, as though photographed in the real world at real scale.
Do not imply this is a miniature, a model, or a collectable object inside the card. It is the PLACE itself, photographed.

AESTHETIC — HYPERREAL BUT ELEVATED:
- Razor-sharp detail throughout — every element reads as a true photograph
- Saturated but natural color with rich cinematic color grading — elevated reality, deep blacks, luminous highlights, warm mid-tones
- Bold directional light — pronounced rim light, backlight, or atmospheric glow on the primary subject
- Light catches in cinematic ways: sun flares, god rays, wet reflections, atmospheric haze, mist with volume
- Real atmospheric perspective — near elements crisp, far elements slightly softer
- NO brushstrokes, NO painterly softening, NO illustrated quality — this is photographic
- Emotionally weighted — the kind of photograph that makes you stop and look

EXAMPLES OF THE RIGHT AESTHETIC:
- A National Geographic cover photograph with the drama pushed
- A cinematic film still (Roger Deakins, Emmanuel Lubezki)
- A premium travel publication's lead image
- A high-end editorial nature photograph`

    : `SCENE ON THE CARD — IMPRESSIONIST PAINTED ARTWORK:

A richly painted impressionist illustration of this specific place: ${input.sceneDesc}

Painterly quality — think high-end art card illustration or classical impressionist landscape painting (Monet, Pissarro, Sorolla). Visible brushwork, expressive color, atmospheric light, oil-on-canvas texture. Full saturation. Strong luminous light. The scene is the subject, lovingly rendered.

CRITICAL — THE CARD IS THE ONLY FRAME:
There is NO turned-wood plinth inside the card. NO circular base. NO miniature-on-display product shot. NO diorama visible anywhere. NO walnut rim. NO pedestal.
The foil card border IS the bounding container. The painted scene fills the entire artwork zone naturally, edge to edge — the painting is OF the place, not of a miniature of the place.

AESTHETIC:
- Visible brushwork — the texture of paint on canvas
- Expressive, confident color — saturated, luminous, emotionally charged
- Atmospheric impressionist light — dappled sunlight, soft glow, shimmering reflections
- Composition rooted in the source photograph's specific character — this is impressionist treatment of a REAL place, not a generic landscape
- No hard edges — everything softened by brushstroke
- Feel: a hundred-year-old oil painting that still feels luminous and alive`

  const prompt = [
    `COLLECTABLE CARD FRONT — PREMIUM TRADING-CARD, PORTRAIT ORIENTATION.`,

    `This is the front face of a high-end collectable card, like a limited-edition art card from a premium set. Fill the entire image frame with the card front — NO desk, NO background beyond the card itself, NO shadows of the card on a surface. The image IS the card face, edge to edge. The card itself is flat and printable.`,

    sceneBlock,

    input.distinctiveFeatures ? `DISTINCTIVE FEATURES — MUST APPEAR (NON-NEGOTIABLE):
The following specific features from the source photograph define this place. Each one must be clearly visible in the card artwork:

${input.distinctiveFeatures}

Do not simplify to a generic version of the place type. The listed features are what makes this place personal and specific — keep all of them visible.` : '',

    input.primarySubject ? `SUBJECT PROMINENCE:
The ${input.primarySubject} is the hero of this card — the visual anchor. Compose around it, light peaks on it, focus locks on it. The sky and surround support without competing.` : '',

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

    `NO TITLE, NO TEXT, NO PLAQUE, NO NAMEPLATE — ABSOLUTE RULE:

Do NOT render any title, name, text, letter, word, plaque, signboard, nameplate, caption, label, banner, scroll, cartouche, inscription, or typographic element anywhere on this card.
The artwork zone is pure imagery only. Zero text of any kind.

SPECIFIC FAILURE MODES TO AVOID (these keep happening and must be prevented):
- A rectangular or oval brass/bronze plaque with the place name inscribed on it, positioned at the bottom of the artwork or along the bottom foil border — FORBIDDEN
- A scrolled banner or ribbon with text draped across the artwork — FORBIDDEN
- A carved wooden sign or placard inside the scene with the place name — FORBIDDEN
- Any decorative frame element that carries type of any kind — FORBIDDEN
- Text painted directly onto a rock, sign, or surface within the scene — FORBIDDEN
- Any lettering treated as part of the artwork composition — FORBIDDEN

The title is added in post-processing as a separate element outside the AI artwork. Do NOT attempt to render it yourself. If you render ANY text element on this card, the output is rejected.
If the real-world subject naturally contains signage (shop names, street signs, plaques), render those surfaces blank, weathered-illegible, or abstracted — no readable characters.`,

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
  primarySubject?:      string
  memoryText:           string
  displayName:          string
  mood:                 string
  plaqueText?:          string
  artworkStyle?:        CardArtworkStyle   // '3d' (photorealistic render) | 'impressionist' (painterly)
  openaiApiKey:         string
}): Promise<{ frontB64: string; backB64: string }> {
  const style: CardArtworkStyle = input.artworkStyle || '3d'

  // Front (AI) first since back needs thumbnail from it
  const frontB64 = await buildCardFront({
    sourceImageB64:      input.sourceImageB64,
    sceneDesc:           input.sceneDesc,
    viewingDirection:    input.viewingDirection,
    distinctiveFeatures: input.distinctiveFeatures,
    primarySubject:      input.primarySubject,
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

