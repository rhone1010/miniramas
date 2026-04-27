// actionmini-card.ts
// lib/v1/actionmini-card.ts
//
// Action Mini Card — mirrors the Landscapes Card pattern exactly.
// Two-image preset: AI-generated hero front (gpt-image-1) + code-built info back (SVG composite).
// Returns both as base64; the route forwards both to frontend.
//
// Pattern reference: lib/v1/landscape-generator.ts → generateCollectableCard()
//
// Key inversions vs In-Situ:
//   - NO plinth, NO walnut base — card frame is the only frame
//   - Scene fills card edge-to-edge (no diorama-on-display)
//   - Painterly only — Action Mini cards are always rendered as dimensional painted
//     card art (MTG mythic / Hearthstone hero / premium fantasy trading card aesthetic)
//   - Frame-breaking required (action elements project past foil border)
//   - All text is post-processed SVG on back, never AI-rendered
//   - Bypasses normal pipeline (no levels, no expand)

import OpenAI, { toFile } from 'openai'
import sharp from 'sharp'

// ── CARD CANVAS ───────────────────────────────────────────────
const CARD_W = 1024
const CARD_H = 1536  // 2:3 portrait — closest gpt-image-1 size to 5:7 playing card

// artwork_style is preserved as a typed field for backward compat, but Action Mini
// cards are always rendered Painterly. The field is accepted and ignored.
export type CardArtworkStyle = 'painterly' | 'impressionist' | '3d'

export interface ActionMiniCardHero {
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

// ── MOOD MODIFIERS (CARD-TUNED) ───────────────────────────────
const MOODS: Record<string, string> = {
  golden:   'MOOD: Warm golden light — late afternoon sun, honey highlights, long warm shadows, nostalgic atmosphere.',
  dramatic: 'MOOD: Dramatic — charged weather, intense directional light, emotionally weighted atmosphere. The hero is fully lit and sharp; weather and mood live in the surrounding world.',
  vivid:    'MOOD: Bright and vivid — peak clarity, saturated color, the action at its most alive.',
}

// ── SVG HELPERS (FROM LANDSCAPES PATTERN) ─────────────────────
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

// ── HERO IDENTITY (TIGHT) ─────────────────────────────────────
function describeHero(hero: ActionMiniCardHero | null | undefined): string {
  if (!hero) return ''
  const parts: string[] = []
  if (hero.age_range)            parts.push(hero.age_range)
  if (hero.gender_presentation)  parts.push(hero.gender_presentation)
  if (hero.ethnicity_apparent)   parts.push(`apparent ${hero.ethnicity_apparent}`)
  if (hero.hair?.color || hero.hair?.length) {
    const h = hero.hair
    parts.push(`${[h.color, h.length, h.style].filter(Boolean).join(' ')} hair`)
  }
  if (hero.expression)           parts.push(`${hero.expression} expression`)
  const gear = [hero.gear_top, hero.gear_head, hero.gear_hands].filter(Boolean).join(', ')
  if (gear) parts.push(`wearing ${gear}`)
  if (hero.body_position) parts.push(`pose: ${hero.body_position}`)
  return parts.join(', ')
}

// ── FRAME-BREAKING SUGGESTIONS BY MEDIUM ──────────────────────
const FRAME_BREAKING_BY_MEDIUM: Record<string, string> = {
  whitewater: '- A paddle blade or spray plume extends past the TOP foil border\n- Foam or churning water spills past the BOTTOM foil border, optionally running off the bottom edge as if splashing toward viewer\n- A secondary kayaker or rock element may project past the LEFT or RIGHT border',
  surf:       '- The wave crest or spray extends past the TOP foil border\n- Foam wash spills past the BOTTOM foil border\n- Board nose or rail may project past a SIDE border',
  snow:       '- Powder plume or ski tip extends past the TOP foil border\n- Snow spray spills past the BOTTOM foil border\n- A pole or trailing snow may project past a SIDE border',
  skate:      '- A grabbed board edge or raised hand extends past the TOP foil border\n- Wheel spray, dust, or sparks spill past the BOTTOM foil border\n- A ramp lip or trick element may project past a SIDE border',
  bike:       '- Front wheel, fork, or rider arm extends past the TOP foil border\n- Dirt spray, dust, or rear-tire chunks spill past the BOTTOM foil border\n- A handlebar end or trailing dust may project past a SIDE border',
  climb:      '- A reaching hand or chalk puff extends past the TOP foil border\n- A hanging foot, rope, or rock spall spills past the BOTTOM foil border\n- A rock formation or harness loop may project past a SIDE border',
  run:        '- A raised arm, knee, or hair extends past the TOP foil border\n- Heel-strike dust spills past the BOTTOM foil border\n- A trailing leg or stride particles may project past a SIDE border',
  dance:      '- An extended hand, hair, or fabric extends past the TOP foil border\n- Skirt or fabric flow spills past the BOTTOM foil border\n- An outstretched leg or sleeve may project past a SIDE border',
  combat:     '- A reaching arm, fist, or extended leg projects past the TOP or SIDE foil border\n- A pinned figure\'s outstretched limb extends past the BOTTOM foil border\n- The dominant figure\'s shoulder or hair may project past a SIDE border with implied weight and motion',
  other:      '- A high-energy element extends past the TOP foil border\n- A foreground motion element spills past the BOTTOM foil border\n- A side element may project past LEFT or RIGHT border',
}

// ── BUILD FRONT (AI) ──────────────────────────────────────────
async function buildCardFront(input: {
  sourceImageB64:        string
  kineticMedium:         string
  actionDescription:     string
  freezeMomentQuality?:  string
  hero:                  ActionMiniCardHero | null
  secondaryFigures?:     ActionMiniCardSecondaryFigures
  distinctiveFeatures?:  string
  environment:           string
  mood:                  string
  artworkStyle:          CardArtworkStyle
  openaiApiKey:          string
}): Promise<string> {
  const openai = new OpenAI({ apiKey: input.openaiApiKey })
  const moodHint = MOODS[input.mood] || MOODS.golden
  const heroDesc = describeHero(input.hero)
  const frameBreakingHints = FRAME_BREAKING_BY_MEDIUM[input.kineticMedium] || FRAME_BREAKING_BY_MEDIUM.other

  // Scene block varies by artwork style.
  // '3d'           — photorealistic cinematic rendering, stylized atmospheric environment, NO plinth.
  // PAINTERLY ONLY — Action Mini cards are always rendered as dimensional painted card art.
  // Reference: MTG mythic rare (Manchess/Giancola), Hearthstone hero portrait, premium fantasy
  // trading card with painted finish and real 3D depth.
  const sceneBlock = `SCENE ON THE CARD — DIMENSIONAL PAINTED CARD ART (PAINTERLY HERO ART):

REFERENCE THE FOLLOWING SPECIFIC AESTHETIC FIRST:
- A Magic the Gathering MYTHIC RARE card by Greg Manchess, Donato Giancola, or Chase Stone
- A HEARTHSTONE hero portrait with dimensional sculpted form
- A premium FANTASY TRADING CARD with painted finish but real 3D depth
- A digital painted character render where the figure pops in 3D and the surface reads as paint
- An exceedingly beautiful, expensive, highly-illustrated action art card

THIS IS NOT:
- A flat oil painting like Monet, Renoir, Sorolla, or any Impressionist
- A canvas painting, watercolor, or 2D illustration
- A children's book painting
- A photograph with a painterly filter
- A flat brushwork field with no dimensional lighting

PROCESS — DIMENSIONAL RENDER FIRST, PAINTED FINISH SECOND:
Step 1: Render the figure with FULL PHOTOREAL THREE-DIMENSIONAL LIGHTING — rim light, key light, fill light, dimensional shadows, real form, real volume. The figure has photoreal sculptural depth.
Step 2: Apply a PAINTED SURFACE FINISH on top of the dimensional form — visible brushwork in skin, hair, fabric, gear surfaces. The brushwork is the topcoat over real 3D form.

THE RESULT: The figure FEELS sculpted and dimensionally lit. The SURFACE feels hand-painted. Both qualities are present simultaneously — not one or the other.

ACTION:
${input.actionDescription || 'A dynamic action moment.'}
${input.freezeMomentQuality ? `Freeze instant: ${input.freezeMomentQuality}` : ''}

HERO — IDENTITY MUST MATCH THE SOURCE PHOTOGRAPH EXACTLY:
${heroDesc || 'The hero figure from the source photograph.'}

HERO FIDELITY (CRITICAL — NON-NEGOTIABLE):
The painted figure on this card must be UNMISTAKABLY THE SAME PERSON shown in the source photograph. This is a portrait of a specific real person, painted in a premium illustrated style — not a generic athlete in their general look.

- FACE: Render the hero's actual facial structure as painted — same face shape, same features, same expression. Painted style does NOT mean generalized face.
- GEAR COLORS: Every named color in the source photo carries through exactly. Jersey color, helmet color, gloves color, shoe color, accessory color — all painted at full saturation, exact match to source. Gear is the primary identity anchor.
- HAIR: Same color, same length, same style as the source. If a ponytail is in the source, paint a ponytail. If short hair, paint short hair.
- BODY POSITION: The pose from the source photograph preserved exactly — every limb angle, lean, grip, balance.
- AGE AND BUILD: The hero reads as the same age and build as the source. Painted style is the topcoat — the figure underneath is THIS SPECIFIC PERSON.

The painted treatment is on the SURFACE. The IDENTITY underneath is photographically faithful to the source.

ENVIRONMENT — BLURRY, ATMOSPHERIC, OR SWIRLING PAINTED BACKDROP:
The hero performs against a stylized painted backdrop — NOT a literal photograph of the action's setting, NOT a recognizable specific location. The background is loose, atmospheric, and painterly:
- Painted color field in the action's natural palette (track-orange and stadium-blue for hurdling; deep ocean and crashing wave-blues for surf; saturated forest greens with sun shafts for trail bike; mountain alpine blue and snow-glare for ski; dirt-track ochre and sky for moto)
- Swirling brushstrokes, soft bokeh, painted atmospheric haze allowed and encouraged
- Loose painterly suggestion of place — color and mood only, never literal architecture or landscape
- Background recedes; hero is the sharp dimensional focus

KINETIC ENERGY — RENDERED PAINTERLY BUT FULLY PRESENT (CRITICAL):
The kinetic energy of the action MUST be present and visible — but rendered in the painted style. This is non-negotiable. A static painted portrait without kinetic energy is a FAILURE.

REQUIRED KINETIC ELEMENTS — ALL RENDERED AS PAINTED EFFECTS:
- DUST, SPRAY, OR PARTICULATE: kicked up from the action point, painted with real volume and brushwork — visible plumes, individual painted droplets or specks, painted scatter around the figure
- MOTION TRAIL: behind the figure showing where the action came from — painted scuff arcs, tire tracks, foam wakes, footstrike ruts, all rendered as painted marks
- CONTACT AREA: where the action meets the surface — painted marks, splash zones, displacement, foam — all rendered with painterly texture
- LIGHT EFFECTS: rim light separating the figure from the backdrop, painted speculars on metal/wet surfaces/skin highlights, painted god-rays or light shafts where atmospherically appropriate, the hero clearly LIT against the surrounding world
- Any natural ambient effect of the action (sweat, splash, breath in cold air, sun glare on visor) painted in with confidence

INTENSITY SCALES WITH CONTACT (read from source pose):
- HIGH-CONTACT in source (wheels in dirt, board carving, paddle in water): full painted expression — large painted plumes, thick painted spray, dense painted scatter
- AIRBORNE in source (mid-jump, hurdle apex, mid-air trick): restrained — minimal painted residue (a thin painted dust trail, a faint painted mark at takeoff, a few suspended painted particles). The figure is clean and gravity-defined, not particle-buried.

The kinetic energy is what makes this an ACTION ART card and not a portrait. It must be visible. Render it painterly.

CRITICAL — THE CARD IS THE ONLY FRAME:
NO turned-wood plinth inside the card. NO circular base. NO miniature-on-display product shot. NO diorama visible. NO walnut rim. NO pedestal. The foil card border IS the bounding container.

REQUIRED VISUAL CHARACTERISTICS:
- Hero figure has CLEAR THREE-DIMENSIONAL FORM with rim light separating it from the backdrop
- Visible BRUSHWORK on hero's skin, fabric, hair, gear — but not at the expense of dimensional structure or identity
- DEEP shadows on the hero's form (under chin, behind near-side limbs, under clothing) showing real volumetric lighting
- HIGHLIGHTS catch on the hero's most lit surfaces with painted specular detail
- Hero's edges have CONFIDENT defined silhouette against the painted backdrop — not blurred into the background
- COLOR is heightened/saturated but applied as paint, not as color filter
- The hero's face is RECOGNIZABLY the source person's face, painted

REPEAT — IF THE OUTPUT LOOKS LIKE A FLAT IMPRESSIONIST CANVAS WHERE THE FIGURE BLENDS INTO THE BACKGROUND, THE OUTPUT IS WRONG. The figure must POP dimensionally with real lighting and form, painted surface notwithstanding.

THE FRAME-BREAKING ELEMENTS HAVE REAL DIMENSIONAL PROJECTION:
When painted elements cross the foil border, they project DIMENSIONALLY — a hand reaching past the frame casts a soft shadow on the foil; hair flowing past the top has volumetric depth crossing the border; a foot punching through the bottom has real form projecting toward viewer. The painted surface continues across the frame line, but the DIMENSIONAL STRUCTURE is felt and the foil shows shadow under the projecting element.`

  const prompt = [
    `COLLECTABLE CARD FRONT — PREMIUM TRADING-CARD, PORTRAIT ORIENTATION.`,

    `This is the front face of a high-end collectable card, like a limited-edition art card from a premium set. Fill the entire image frame with the card front — NO desk, NO background beyond the card itself, NO shadows of the card on a surface. The image IS the card face, edge to edge. The card itself is flat and printable.`,

    sceneBlock,

    input.distinctiveFeatures ? `DISTINCTIVE FEATURES — MUST APPEAR (NON-NEGOTIABLE):
The following specific gear and details from the source photograph define this hero's identity. Each must be clearly visible:

${input.distinctiveFeatures}

Gear colors are non-negotiable. Match the source exactly.` : '',

    input.secondaryFigures && input.secondaryFigures.count && input.secondaryFigures.count > 0 ? `SECONDARY FIGURES:
${input.secondaryFigures.count} additional figure(s) in the scene: ${input.secondaryFigures.description || ''}
Distributed naturally in the action — softer detail, supporting cast, do not compete with hero.` : '',

    moodHint,

    `KINETIC INTENSITY (CRITICAL — SCALES WITH PHYSICAL CONTACT):

The action shows real kinetic energy — but the amount of kinetic detail must match the moment.

INTENSITY SCALES WITH CONTACT:
- HIGH-CONTACT moments (wheels in dirt, board carving snow, paddle in water, grinding rail, sprint footstrike): full kinetic expression — large plumes, thick spray, rich contact areas, dense particulate scatter, abundant terrain detail
- AIRBORNE or LIGHT-CONTACT moments (mid-jump, mid-air trick, hurdle apex, peak of bound, gliding stride): RESTRAINED — only the small residue of recent contact (a thin dust trail, a dissipating puff, a faint mark on the takeoff point, a few suspended particles)

Match the intensity to the pose. A hurdler at jump apex shows minimal dust because feet aren't touching ground. A kayaker driving into a wave shows full water chaos. A bike rider mid-corner with rear tire grounded shows full dust plume.`,

    `FRAME-BREAKING & DIMENSIONAL PROJECTION (KEY STYLIZATION — MANDATORY):

Popular collectable cards (Pokémon holographic, Magic the Gathering mythic rare, Panini Spectra, premium sports cards) use dramatic FRAME-BREAKING to create a "projecting into the viewer's space" effect. Action elements punch past the foil border at specific points, sometimes continuing off the card edge entirely as if thrust forward.

REQUIRED: At least TWO frame-breaking elements must appear, chosen based on the action:
${frameBreakingHints}

THE PROJECTION HAS REAL DIMENSION (KEY DETAIL):
When an element crosses the foil border, it does so DIMENSIONALLY — the element has volume, depth, and form crossing the frame line. Specifically:
- The element crosses OVER the foil gold (not behind it). The foil is OBSCURED at those points.
- A SMALL SOFT SHADOW falls on the foil border directly beneath the projecting element — confirming the element has physical thickness above the frame plane.
- The element retains its full rendering style (cinematic 3D for the 3D card, dimensional painterly for the painterly card) as it crosses the border.
- Edge of the projecting element where it leaves the card is sharp and confident — never fading or feathered.

STYLE INTENSITY:
Not subtle. Not timid. This is the main visual hook of the card. Dramatic, confident dimensional projection. Every action has at least two projection opportunities — find them and commit.

FAILURE MODE TO AVOID:
A clean rectangular card with a clean foil border and the art neatly contained inside is WRONG. That reads as a poster, not a collectable card. Frame-breaking with dimensional projection is the single most important style element.`,

    `NO TITLE, NO TEXT, NO PLAQUE, NO NAMEPLATE — ABSOLUTE RULE:

Do NOT render any title, name, text, letter, word, plaque, signboard, nameplate, caption, label, banner, scroll, cartouche, inscription, or typographic element anywhere on this card.
The artwork zone is pure imagery only. Zero text of any kind.

SPECIFIC FAILURE MODES TO AVOID:
- A rectangular or oval brass/bronze plaque with the athlete's name, positioned at the bottom of the artwork or along the bottom foil border — FORBIDDEN
- A scrolled banner or ribbon with text draped across the artwork — FORBIDDEN
- Any decorative frame element that carries type of any kind — FORBIDDEN
- Text painted on jersey, helmet, bib number, or surface within the scene — RENDER AS BLANK or ABSTRACTED, never readable characters
- Any lettering treated as part of the artwork composition — FORBIDDEN

The title is added in post-processing as a separate element outside the AI artwork. Do NOT attempt to render it yourself. If you render ANY text element on this card, the output is rejected.
If the real-world subject naturally contains signage (jersey numbers, sponsor logos, race bibs), render those surfaces blank, weathered-illegible, or abstracted — no readable characters.`,

    `CARD MATERIAL FEEL:
Satin-finish card stock with subtle sheen. Premium print quality — crisp edges, rich color. No visible physical card thickness or shadow (this is a straight-on frontal view of the card face, not a product shot of a card on a desk).`,

    `COMPOSITION:
Portrait orientation. The artwork fills the card. Margins inside the foil border: roughly 8-12%. Do not show any surface or environment outside the card — the image is the card, nothing else.`,
  ].filter(Boolean).join('\n\n')

  // Source prep — same brightness lift pattern as Landscapes
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
  if (!b64) throw new Error('actionmini_card_front_generation_failed')
  return b64
}

// ── BUILD BACK (CODE) ─────────────────────────────────────────
async function buildCardBack(input: {
  frontImageB64: string
  displayName:   string
  memoryText:    string
  plaqueText?:   string
}): Promise<string> {
  // Layout constants — mirror Landscapes Card back layout
  const pad         = 70
  const borderW     = 4

  const thumbTop    = 140
  const thumbW      = Math.round(CARD_W * 0.72)
  const thumbH      = Math.round(thumbW * 1.33)
  const thumbLeft   = Math.round((CARD_W - thumbW) / 2)

  const titleY      = thumbTop + thumbH + 80
  const textTop     = titleY + 55

  // Trim foil border off front to use as thumbnail
  const frontBuf = Buffer.from(input.frontImageB64, 'base64')
  const frontMeta = await sharp(frontBuf).metadata()
  const fw = frontMeta.width  ?? CARD_W
  const fh = frontMeta.height ?? CARD_H
  const trimRatio = 0.085
  const cropX = Math.round(fw * trimRatio)
  const cropY = Math.round(fh * trimRatio)
  const cropW = fw - cropX * 2
  const cropH = fh - cropY * 2
  const thumbBuf = await sharp(frontBuf)
    .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
    .resize({ width: thumbW, height: thumbH, fit: 'cover' })
    .png()
    .toBuffer()

  const thumbBorderSvg = Buffer.from(`
    <svg width="${thumbW}" height="${thumbH}" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="${thumbW - 2}" height="${thumbH - 2}"
            fill="none" stroke="#8B6F3F" stroke-width="2" opacity="0.6"/>
    </svg>
  `)

  const textLines   = wrapText(input.memoryText || '', 38)
  const lineHeight  = 54
  const titleText   = escapeSvgText(input.displayName || '')
  const bodyLinesSvg = textLines.map((ln, i) => `
    <text x="${CARD_W / 2}" y="${textTop + i * lineHeight}"
          text-anchor="middle"
          font-family="Georgia, 'Times New Roman', serif"
          font-size="38" font-style="italic" fill="#3A2818">${escapeSvgText(ln)}</text>
  `).join('')

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

      <rect width="${CARD_W}" height="${CARD_H}" fill="url(#cream)"/>

      <rect x="${pad}" y="${pad}"
            width="${CARD_W - pad * 2}" height="${CARD_H - pad * 2}"
            fill="none" stroke="url(#foil)" stroke-width="${borderW}"/>

      <rect x="${pad + 18}" y="${pad + 18}"
            width="${CARD_W - (pad + 18) * 2}" height="${CARD_H - (pad + 18) * 2}"
            fill="none" stroke="#8B6F3F" stroke-width="1" opacity="0.35"/>

      <text x="${CARD_W / 2}" y="${titleY}"
            text-anchor="middle"
            font-family="Georgia, 'Times New Roman', serif"
            font-size="56" font-weight="400" fill="#2A1E10"
            letter-spacing="2">${titleText}</text>

      <line x1="${CARD_W / 2 - 110}" y1="${titleY + 18}"
            x2="${CARD_W / 2 + 110}" y2="${titleY + 18}"
            stroke="url(#foil)" stroke-width="1.5"/>

      ${bodyLinesSvg}

      ${plaqueSvg}

      <text x="${CARD_W / 2}" y="${CARD_H - pad - 36}"
            text-anchor="middle"
            font-family="Georgia, 'Times New Roman', serif"
            font-size="20" letter-spacing="6" fill="#8B6F3F" opacity="0.7">MINISCAPE</text>
    </svg>
  `)

  const composed = await sharp(backSvg)
    .composite([
      { input: thumbBuf,       left: thumbLeft, top: thumbTop },
      { input: thumbBorderSvg, left: thumbLeft, top: thumbTop },
    ])
    .png({ quality: 95 })
    .toBuffer()

  return composed.toString('base64')
}

// ── PUBLIC ENTRY POINT ────────────────────────────────────────
export async function generateActionMiniCard(input: {
  sourceImageB64:        string
  kineticMedium:         string
  actionDescription:     string
  freezeMomentQuality?:  string
  hero:                  ActionMiniCardHero | null
  secondaryFigures?:     ActionMiniCardSecondaryFigures
  distinctiveFeatures?:  string
  environment:           string
  displayName:           string
  memoryText:            string
  mood:                  string
  plaqueText?:           string
  artworkStyle?:         CardArtworkStyle
  openaiApiKey:          string
}): Promise<{ frontB64: string; backB64: string }> {

  // Painterly is the only path — artworkStyle field is accepted for compat but ignored
  const style: CardArtworkStyle = 'painterly'

  // Front first — back uses thumbnail extracted from front
  const frontB64 = await buildCardFront({
    sourceImageB64:       input.sourceImageB64,
    kineticMedium:        input.kineticMedium,
    actionDescription:    input.actionDescription,
    freezeMomentQuality:  input.freezeMomentQuality,
    hero:                 input.hero,
    secondaryFigures:     input.secondaryFigures,
    distinctiveFeatures:  input.distinctiveFeatures,
    environment:          input.environment,
    mood:                 input.mood,
    artworkStyle:         style,
    openaiApiKey:         input.openaiApiKey,
  })

  const backB64 = await buildCardBack({
    frontImageB64: frontB64,
    displayName:   input.displayName,
    memoryText:    input.memoryText,
    plaqueText:    input.plaqueText,
  })

  console.log(`[actionmini] collectable_card ${input.displayName} / ${style} — front + back done`)
  return { frontB64, backB64 }
}
