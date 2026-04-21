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
  museum:     `PRESENTATION: Museum product photograph — the diorama presented on a large walnut desk in a warm study.

ROOM AND ENVIRONMENT:
The diorama sits on a large dark walnut desk — book-matched grain, rich chocolate-brown with flowing figured streaks, deep satin finish. The grain is clearly visible and beautiful.
The desk surface has a strong mirror-like reflection of the diorama base — the walnut base and the lower part of the diorama reflect downward into the polished surface, doubled and slightly diffused.

LIGHTING:
A large window to one side fills the room with warm afternoon light — this is the primary light source. Soft directional key light rakes across the diorama, catching textures and casting gentle shadows to the opposite side. Warm neutral color temperature.
In the far corner of the room, a small antique brass lamp with a silk shade glows warmly — accent only, does not light the diorama directly.

ROOM BACKDROP:
The room beyond is a warm study — bookshelves softly out of focus, framed paintings on the wall, the edge of a chair visible. Everything behind the desk is in soft warm bokeh, clearly a real room but subordinate to the diorama.

DESK PROPS (SUBTLE):
A hardcover book lies open to the left of the diorama. Reading glasses rest to the right on the desk surface. Both are slightly out of focus — they frame the diorama as a cherished object on a well-used desk.

FEEL:
The diorama as a prized possession in a warm, personal study — not a sterile studio. Lived-in, treasured, beautifully lit.`,
  collectable_card: '', // handled by generateCollectableCard() — not a normal prompt preset
  cinematic:  `PRESENTATION: Cinematic hero shot — the diorama staged as a richly lit dramatic movie-poster subject.

BACKDROP:
A rich MID-TONE atmospheric gradient — deeper tones at the edges, lifting to a soft warm glow directly behind the diorama. The backdrop is moody but NOT dark, NOT underexposed, NOT crushed. Think "theatrical stage with full stage lighting" rather than "shadowy void" — midtone warm greys, soft purples, amber, or deep earth tones, clearly readable throughout.

LIGHTING — BRIGHT DRAMATIC, NOT DIM DRAMATIC:
Strong directional key light from above or side creates pronounced highlights and sculptural shadows on the diorama. Ambient fill is LIFTED — shadows read as dimensional and detailed, never crushed to black. The diorama itself is brightly and richly lit; the lighting is dramatic through contrast and direction, not through dimness. High dynamic range with full detail visible in both highlights and shadows.

SURFACE AROUND BASE:
Darker tonal surface — deep warm bronze, rich dark stone, or moody textured fabric — but clearly visible and lit by spill from the key light. Reads as substantial material surface, not absent void.

BOUNDARY:
The base rim remains a sharp visual break. On the base: richly lit, high saturation, dramatic highlight/shadow sculpting. Off the base: mid-tone moody surround, still clearly visible and lit.
The base casts a long dramatic shadow on the surface beneath it.

FEEL:
Heroic theatrical presentation — the diorama is the star under full stage lighting. Dramatic and luminous, not dim or shadowy.`,
}

export async function generateLandscape(input: {
  sourceImageB64:         string
  extraImages?:           string[]
  sceneDescription?:      string   // free-form GPT-4o description of the place
  environmentSurface?:    string   // just the ground material
  environmentAtmosphere?: string   // just sky/weather/light
  characterSource?:       'object' | 'atmosphere'
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
Photographic depth of field is the only softening — material near the base is razor-sharp; toward the horizon it softens progressively from camera blur, NOT from material simplification. The material keeps its identity throughout.
The ground zone reaches naturally to a soft distant horizon line roughly 40-45% up the frame.

SKY ZONE (everything above the horizon line — the upper portion of the frame):
A soft atmospheric gradient — gentle color transition from horizon upward, matching the tonal mood of the scene (warm amber-to-peach for golden mood, cool grey-to-blue for peaceful, moody greyish-purple for dramatic, clear bright blue fade for vivid).
NO defined clouds, NO mountains, NO trees, NO distant buildings, NO horizon features, NO scene duplicates — only soft gradient color and atmospheric tone.
The sky is blurred and slightly desaturated compared to the diorama, subordinate but present.

HIERARCHY:
The diorama is the fully-rendered, sharp, saturated subject. The matching ground stage is tactilely 3D but softer with distance from depth of field. The sky gradient is the softest element.

BOUNDARY:
The base rim is a sharp visual break. On the base: crisp, miniature, fully saturated. Off the base: same material extended with photographic softness, meeting a gradient sky above.
The base casts a clear shadow on the surface beneath it.

NO PHOTO CARDS OR BACKDROP PLANES:
No rectangular card edges, no printed backdrop planes, no scene duplicates, nothing vertical behind the diorama except the atmospheric sky gradient.`
    : pres

  // Camera block — default is standard product shot; cinematic overrides with foreshortened wide-angle
  const cameraBlock = input.presentation === 'cinematic'
    ? `CAMERA — CINEMATIC FORESHORTENING:
Camera 35-45 degrees elevated, angled down at the diorama — the same look-down angle, NOT a low-angle shot.
WIDE-ANGLE lens perspective applied to the entire frame, creating STRONG FORESHORTENING:
- The nearest edge of the base and the nearest environmental elements loom LARGE, thrust forward toward the viewer
- Far elements of the base and anything behind compress and recede rapidly into the distance
- Near-far scale contrast is exaggerated — the closest sand, rocks, or surface appears visibly larger than equivalent elements on the far side of the base
- Depth feels deep even though the physical object is small
Hero shot framing. The diorama fills the frame with maximum presence under dramatic perspective.`
    : `CAMERA:
35-45 degrees elevated, angled down at the diorama.
Pulled back far enough to show the full base with surrounding space.
Macro product photography — a precious small object in space.`

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
    `DIORAMA BASE — CONTAINMENT IS A HARD RULE:
Circular dark walnut display plinth with a thick, heavy, turned-wood rim clearly visible on all sides.
The miniature is a discrete physical object sitting ON TOP of this base — it MUST terminate at the base perimeter on every side.
All scene elements (rocks, water, cliffs, terrain, vegetation, structures, horizon) are contained within the circular footprint of the base.
If the source scene is too wide or expansive to fit naturally, COMPRESS or CURVE it to fit within the circle — do NOT extend the miniature past the rim into the surrounding environment.
The coastline, ridgeline, or linear features of the source must bend to follow the base perimeter rather than continuing off into the frame.
Nothing in the miniature crosses the base edge. The base rim is a hard visual boundary.
The base casts a clear shadow on the surface beneath it, reinforcing that it is a self-contained object placed on a larger world.`,
    `COMPOSITION — MARGINS ARE MANDATORY (APPLIES TO ALL PRESENTATIONS EXCEPT SCENE CARD):
The base occupies approximately 65% of the image width — NOT more.
The image frame shows 15-20% clear breathing room on the LEFT side of the base, and 15-20% clear breathing room on the RIGHT side of the base. The base does NOT touch, kiss, or extend to the left or right image edges under any circumstances.
The image frame also shows 10-15% clear space above and below the base.
The entire base including its full rim profile is visible with generous space around it. Pull the camera back if needed to satisfy these margins — the diorama should feel like a small precious object in surrounding space, not a cropped subject pressing against the frame.`,
    cameraBlock,
    envBlock,
    `QUALITY:
Must look like a genuinely handcrafted physical miniature — tactile, three-dimensional, real.
Every surface has physical texture and material weight. No flat planes. No stylization or cartoon effects.
Museum-quality miniature craftsmanship — the kind someone would display with pride.`,
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

async function buildCardFront(input: {
  sourceImageB64: string
  sceneDesc:      string
  displayName:    string
  mood:           string
  openaiApiKey:   string
}): Promise<string> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  const moodHint = MOODS[input.mood] || MOODS.golden

  const prompt = [
    `COLLECTABLE CARD FRONT — PREMIUM TRADING-CARD ARTWORK, PORTRAIT ORIENTATION.`,

    `This is the front face of a high-end collectable card, like a limited-edition art card from a premium set. Fill the entire image frame with the card front — NO desk, NO background beyond the card itself, NO shadows of the card on a surface. The image IS the card face, edge to edge.`,

    `SCENE ON THE CARD:
A richly illustrated miniature diorama of this specific place: ${input.sceneDesc}
Full saturation, strong light, the scene is the subject. Premium handcrafted miniature aesthetic with tactile material depth.`,

    moodHint,

    `BORDER-BREAKING ILLUSTRATION (key feature):
A thin elegant foil-style border (metallic gold or soft silver, 20-30 pixels wide) frames the card illustration — but the illustration INTENTIONALLY BREAKS the border at 2-3 points:
- A tree branch, rocky outcrop, or foliage element extends past the TOP edge of the border
- Grass, terrain, or plant life crosses past the BOTTOM edge of the border
- Optional: a stone, wave, or vegetation element pokes past the LEFT or RIGHT border edge
Border-breaks are dramatic and deliberate, giving the card a 3D poppable feel. The illustration rules the card; the border is a supporting frame.`,

    `TITLE TREATMENT:
Near the bottom of the card (in the lower 15% of the frame), display the place name in a clean elegant serif typeface, centered or slightly left-aligned: "${input.displayName}"
The title is small and refined — about 40-55 pixels tall — not dominant. It sits within a small clean typographic block or plate that the border-breaking elements do not overlap.`,

    `CARD MATERIAL FEEL:
Satin-finish card stock with subtle sheen. The illustration has premium print quality — crisp edges, rich color. No visible physical card thickness or shadow (this is a straight-on frontal view of the card face, not a product shot of a card on a desk).`,

    `COMPOSITION:
Portrait orientation. The illustration fills the card. Margins inside the foil border: roughly 8-12%. Do not show any surface or environment outside the card — the image is the card, nothing else.`,
  ].join('\n\n')

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
  const thumbTop    = 180      // y-position of thumbnail top
  const thumbSize   = 760      // thumbnail is square, ~50% of card height
  const thumbLeft   = Math.round((CARD_W - thumbSize) / 2)
  const titleY      = thumbTop + thumbSize + 90  // title baseline
  const textTop     = titleY + 60                // memory text block top

  // ── Prepare thumbnail from front image (square crop + resize) ──
  const frontBuf = Buffer.from(input.frontImageB64, 'base64')
  const frontMeta = await sharp(frontBuf).metadata()
  const fw = frontMeta.width  ?? CARD_W
  const fh = frontMeta.height ?? CARD_H
  const squareSide = Math.min(fw, fh)
  const cropLeft   = Math.round((fw - squareSide) / 2)
  const cropTop    = Math.round((fh - squareSide) / 2)
  const thumbBuf = await sharp(frontBuf)
    .extract({ left: cropLeft, top: cropTop, width: squareSide, height: squareSide })
    .resize({ width: thumbSize, height: thumbSize, fit: 'cover' })
    .png()
    .toBuffer()

  // ── Thumbnail border overlay (thin hairline frame) ──
  const thumbBorderSvg = Buffer.from(`
    <svg width="${thumbSize}" height="${thumbSize}" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="${thumbSize - 2}" height="${thumbSize - 2}"
            fill="none" stroke="#8B6F3F" stroke-width="2" opacity="0.6"/>
    </svg>
  `)

  // ── Word-wrap memory text, build SVG ──
  const textLines   = wrapText(input.memoryText || '', 38) // ~38 chars per line at this font size
  const lineHeight  = 58
  const titleText   = escapeSvgText(input.displayName || '')
  const bodyLinesSvg = textLines.map((ln, i) => `
    <text x="${CARD_W / 2}" y="${textTop + i * lineHeight}"
          text-anchor="middle"
          font-family="Georgia, 'Times New Roman', serif"
          font-size="42" font-style="italic" fill="#3A2818">${escapeSvgText(ln)}</text>
  `).join('')

  // ── Plaque block (optional) — sits above the MINISCAPE footer ──
  const plaqueText = (input.plaqueText || '').trim().slice(0, 40)
  const plaqueSvg  = plaqueText ? (() => {
    const pW = 560
    const pH = 90
    const pX = Math.round((CARD_W - pW) / 2)
    const pY = CARD_H - pad - 140  // above the monogram
    const pr = 8
    const fs = Math.max(22, Math.min(40, Math.floor((pW * 0.92) / (plaqueText.length * 0.55))))
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

  // ── Full back card SVG: cream background + foil border + title + body text + plaque + monogram ──
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
            font-size="68" font-weight="400" fill="#2A1E10"
            letter-spacing="2">${titleText}</text>

      <!-- Thin rule under title -->
      <line x1="${CARD_W / 2 - 120}" y1="${titleY + 20}"
            x2="${CARD_W / 2 + 120}" y2="${titleY + 20}"
            stroke="url(#foil)" stroke-width="1.5"/>

      <!-- Memory body text -->
      ${bodyLinesSvg}

      <!-- Decorative plaque (optional) -->
      ${plaqueSvg}

      <!-- Bottom monogram/mark -->
      <text x="${CARD_W / 2}" y="${CARD_H - pad - 40}"
            text-anchor="middle"
            font-family="Georgia, 'Times New Roman', serif"
            font-size="22" letter-spacing="6" fill="#8B6F3F" opacity="0.7">MINISCAPE</text>
    </svg>
  `)

  // ── Composite: SVG background + thumbnail + thumbnail border ──
  const composed = await sharp(backSvg)
    .composite([
      { input: thumbBuf,          left: thumbLeft, top: thumbTop },
      { input: thumbBorderSvg,    left: thumbLeft, top: thumbTop },
    ])
    .png({ quality: 95 })
    .toBuffer()

  return composed.toString('base64')
}

// ── 3D PRODUCT SHOT ───────────────────────────────────────────
// Takes a flat card image and renders it as a tilted product shot on a walnut desk.
// One gpt-image-1 edit call per face when enabled.
async function buildCardProductShot(input: {
  flatCardB64:  string
  face:         'front' | 'back'
  displayName:  string
  openaiApiKey: string
}): Promise<string> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })

  const prompt = [
    `CARD PRODUCT PHOTOGRAPH — PREMIUM COLLECTABLE SHOWCASE.`,

    `The provided image IS a flat collectable card (${input.face} face). Recreate this EXACT card as a tactile physical object photographed at a 3/4 angle on a premium display surface.`,

    `CARD FIDELITY — ABSOLUTELY PRESERVE:
The entire artwork, text, colors, borders, typography, and composition of the source card must remain exactly as shown. Do NOT redesign, stylize, or reinterpret the card's artwork. Treat the source as a printed reference to be photographed as-is.
Every visual element on the card face in the source must appear on the card face in the output, in the same positions, at the same sizes, with the same colors.`,

    `CAMERA & POSITIONING:
Camera positioned at approximately 30-40 degrees above the card, angled downward.
The card is tilted slightly toward the viewer with a soft rotation (roughly 8-12 degrees off-vertical from the camera's perspective) — enough to reveal the card's edge thickness without distorting the artwork.
The full card is visible in frame with generous margin on all sides (roughly 15-20%).
Portrait orientation of the card is preserved — the card is taller than wide in the frame.`,

    `CARD PHYSICALITY:
The card is clearly a real physical object with tactile card stock:
- Visible edge thickness along the exposed edges (approximately 1-2mm), revealing the layered card material
- Subtle specular sheen on the card surface suggesting a satin or soft-gloss finish
- The foil border element on the card catches the light with a subtle metallic highlight
- The card sits flat on the surface with its full weight grounded
- Gentle, realistic drop shadow cast onto the desk beneath the card — soft-edged, appropriate to the lighting`,

    `DISPLAY SURFACE:
A warm dark walnut desk surface with visible book-matched grain and deep satin-polished finish — the same premium display surface used in our other product photography.
The surface extends across the full frame behind and beside the card, softly out of focus toward the edges.
A subtle mirror-quality reflection of the card's lower edge is visible in the polished surface directly beneath it.`,

    `LIGHTING:
Warm directional studio light from one side — the quality of afternoon light through a window. The key light rakes gently across the card, catching the foil border and creating a soft highlight on the card's lit face while the opposite edge falls into gentle shadow.
The walnut surface picks up warm ambient bounce. No harsh shadows, no clinical fluorescence — this is premium editorial product photography.`,

    `COMPOSITION:
Single hero card, centered or slightly offset. No other cards in frame. No hands, no additional props, no clutter.
Shallow depth of field — the card is razor sharp, the desk surface softens gently into the background.
Treat this as a high-end product beauty shot for a premium collectables retailer.`,

    `ABSOLUTE CONSTRAINT:
Do not modify, redesign, or reinvent the card artwork in any way. The card you are photographing is the source image. Your only job is to photograph it as a physical object on a walnut desk, from a tilted angle, with the artwork preserved exactly.`,
  ].join('\n\n')

  const flatBuf = Buffer.from(input.flatCardB64, 'base64')
  const file = await toFile(flatBuf, 'card.png', { type: 'image/png' })
  const res = await openai.images.edit({
    model: 'gpt-image-1',
    image: file,
    prompt,
    size:  '1024x1536',
  })
  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error(`card_${input.face}_3d_generation_failed`)
  return b64
}

export async function generateCollectableCard(input: {
  sourceImageB64: string
  sceneDesc:      string
  memoryText:     string
  displayName:    string
  mood:           string
  plaqueText?:    string
  render3d?:      boolean
  openaiApiKey:   string
}): Promise<{ frontB64: string; backB64: string; front3dB64?: string; back3dB64?: string }> {
  // Front (AI) first since back needs thumbnail from it
  const frontB64 = await buildCardFront({
    sourceImageB64: input.sourceImageB64,
    sceneDesc:      input.sceneDesc,
    displayName:    input.displayName,
    mood:           input.mood,
    openaiApiKey:   input.openaiApiKey,
  })

  const backB64 = await buildCardBack({
    frontImageB64: frontB64,
    displayName:   input.displayName,
    memoryText:    input.memoryText,
    plaqueText:    input.plaqueText,
  })

  // Optional 3D product shots — fire front and back in parallel
  let front3dB64: string | undefined
  let back3dB64:  string | undefined
  if (input.render3d) {
    const [f3, b3] = await Promise.all([
      buildCardProductShot({
        flatCardB64:  frontB64,
        face:         'front',
        displayName:  input.displayName,
        openaiApiKey: input.openaiApiKey,
      }).catch(e => { console.warn('[landscape] 3d front failed:', e.message); return null }),
      buildCardProductShot({
        flatCardB64:  backB64,
        face:         'back',
        displayName:  input.displayName,
        openaiApiKey: input.openaiApiKey,
      }).catch(e => { console.warn('[landscape] 3d back failed:', e.message); return null }),
    ])
    if (f3) front3dB64 = f3
    if (b3) back3dB64  = b3
  }

  const suffix = input.render3d ? ' + 3D renders' : ''
  console.log(`[landscape] collectable_card ${input.displayName} — front + back${suffix} done`)
  return { frontB64, backB64, front3dB64, back3dB64 }
}

